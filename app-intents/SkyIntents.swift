import AppIntents
import Foundation
internal import ExpoAppIntents

/// The sky the app last computed, published from JavaScript as the single entity of kind "sky".
/// Metadata holds comma-separated Unix milliseconds for the next few days, so Siri can answer
/// without opening the app, even days after the last launch.
struct SkySnapshot {
  let place: String
  let metadata: [String: String]

  static func load() async -> SkySnapshot? {
    guard let record = try? await AppIntentEntityStore.shared.entities(ofKind: "sky").first else { return nil }
    return SkySnapshot(place: record.title, metadata: record.metadata)
  }

  func times(_ key: String) -> [Date] {
    (metadata[key] ?? "")
      .split(separator: ",")
      .compactMap { Double($0) }
      .map { Date(timeIntervalSince1970: $0 / 1000) }
  }

  func next(_ key: String, after now: Date = Date()) -> Date? {
    times(key).first { $0 > now }
  }

  /// Windows from paired start/end lists; returns the one in progress or the next one.
  func window(_ startKey: String, _ endKey: String, now: Date = Date()) -> (start: Date, end: Date)? {
    zip(times(startKey), times(endKey)).first { $0.1 > now }.map { (start: $0.0, end: $0.1) }
  }

  static func time(_ date: Date) -> String {
    date.formatted(.dateTime.hour().minute().locale(Locale(identifier: "pt_BR")))
  }

  static func day(_ date: Date) -> String {
    if Calendar.current.isDateInToday(date) { return "hoje" }
    if Calendar.current.isDateInTomorrow(date) { return "amanhã" }
    return date.formatted(.dateTime.weekday(.wide).locale(Locale(identifier: "pt_BR")))
  }
}

private let staleDialog: IntentDialog = "Abra o Solune uma vez para eu calcular o céu do seu lugar."

struct NextSunsetIntent: AppIntent {
  static let title: LocalizedStringResource = "Próximo pôr do sol"
  static let description = IntentDescription("Diz quando o sol se põe no seu lugar.")

  func perform() async throws -> some IntentResult & ProvidesDialog & ReturnsValue<Date?> {
    guard let sky = await SkySnapshot.load(), let at = sky.next("sunset") else {
      return .result(value: nil, dialog: staleDialog)
    }
    return .result(value: at, dialog: "O sol se põe \(SkySnapshot.day(at)) às \(SkySnapshot.time(at)) em \(sky.place).")
  }
}

struct NextSunriseIntent: AppIntent {
  static let title: LocalizedStringResource = "Próximo nascer do sol"
  static let description = IntentDescription("Diz quando o sol nasce no seu lugar.")

  func perform() async throws -> some IntentResult & ProvidesDialog & ReturnsValue<Date?> {
    guard let sky = await SkySnapshot.load(), let at = sky.next("sunrise") else {
      return .result(value: nil, dialog: staleDialog)
    }
    return .result(value: at, dialog: "O sol nasce \(SkySnapshot.day(at)) às \(SkySnapshot.time(at)) em \(sky.place).")
  }
}

struct GoldenHourIntent: AppIntent {
  static let title: LocalizedStringResource = "Hora dourada"
  static let description = IntentDescription("Diz quando começa a próxima hora dourada.")

  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard let sky = await SkySnapshot.load(), let w = sky.window("goldenStart", "goldenEnd") else {
      return .result(dialog: staleDialog)
    }
    if w.start <= Date() {
      return .result(dialog: "A hora dourada está acontecendo agora e vai até \(SkySnapshot.time(w.end)).")
    }
    return .result(dialog: "A próxima hora dourada é \(SkySnapshot.day(w.start)), das \(SkySnapshot.time(w.start)) às \(SkySnapshot.time(w.end)).")
  }
}

struct MoonPhaseIntent: AppIntent {
  static let title: LocalizedStringResource = "Fase da lua"
  static let description = IntentDescription("Diz a fase da lua de hoje e quando vem a próxima cheia.")

  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard let sky = await SkySnapshot.load(), let day0 = Double(sky.metadata["day0"] ?? "") else {
      return .result(dialog: staleDialog)
    }
    let index = Int((Date().timeIntervalSince1970 * 1000 - day0) / 86_400_000)
    guard let phase = sky.metadata["moonPhase\(index)"] else {
      return .result(dialog: staleDialog)
    }
    let illumination = sky.metadata["moonIllumination\(index)"] ?? "?"
    if let full = sky.next("nextFull") {
      return .result(dialog: "Hoje: \(phase), \(illumination)% iluminada. A próxima cheia é \(full.formatted(.dateTime.day().month(.wide).locale(Locale(identifier: "pt_BR")))).")
    }
    return .result(dialog: "Hoje: \(phase), \(illumination)% iluminada.")
  }
}

// Intents that need the app: they open it and hand off to JavaScript.

struct OpenSkyIntent: AppIntent {
  static let title: LocalizedStringResource = "Ver o céu agora"
  static let description = IntentDescription("Abre a câmera com a trilha do sol e da lua.")
  static let openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    await AppIntentDispatcher.shared.dispatch(name: "open", params: ["href": "/sky"])
    return .result()
  }
}

struct OpenMoonIntent: AppIntent {
  static let title: LocalizedStringResource = "Abrir a lua de hoje"
  static let openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    await AppIntentDispatcher.shared.dispatch(name: "open", params: ["href": "/moon"])
    return .result()
  }
}

struct LogSkyIntent: AppIntent {
  static let title: LocalizedStringResource = "Registrar o céu"
  static let description = IntentDescription("Abre o diário para registrar o nascer, o pôr do sol ou a lua.")
  static let openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    await AppIntentDispatcher.shared.dispatch(name: "open", params: ["href": "/journal"])
    return .result()
  }
}

enum SkyMomentKind: String, AppEnum {
  case golden
  case sunset
  case sunrise

  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Momento"
  static let caseDisplayRepresentations: [SkyMomentKind: DisplayRepresentation] = [
    .golden: "Hora dourada",
    .sunset: "Pôr do sol",
    .sunrise: "Nascer do sol",
  ]
}

struct TrackSkyMomentIntent: AppIntent {
  static let title: LocalizedStringResource = "Acompanhar no bloqueio"
  static let description = IntentDescription("Mostra a contagem do momento na Tela Bloqueada e na Dynamic Island.")
  static let openAppWhenRun: Bool = true

  @Parameter(title: "Momento", default: .golden)
  var moment: SkyMomentKind

  static var parameterSummary: some ParameterSummary {
    Summary("Acompanhar \(\.$moment)")
  }

  @MainActor
  func perform() async throws -> some IntentResult {
    await AppIntentDispatcher.shared.dispatch(name: "track", params: ["kind": .string(moment.rawValue)])
    return .result()
  }
}
