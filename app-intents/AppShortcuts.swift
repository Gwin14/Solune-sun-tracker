import AppIntents

/// Siri phrases and the Shortcuts app tiles. Written in Portuguese (the development region);
/// other languages come from AppShortcuts.strings and Localizable.strings (locales/ folder).
struct AppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: NextSunsetIntent(),
      phrases: [
        "Quando o sol se põe no \(.applicationName)",
        "Que horas é o pôr do sol no \(.applicationName)",
        "Pôr do sol no \(.applicationName)",
      ],
      shortTitle: "Pôr do sol",
      systemImageName: "sunset.fill"
    )
    AppShortcut(
      intent: NextSunriseIntent(),
      phrases: [
        "Quando o sol nasce no \(.applicationName)",
        "Nascer do sol no \(.applicationName)",
      ],
      shortTitle: "Nascer do sol",
      systemImageName: "sunrise.fill"
    )
    AppShortcut(
      intent: GoldenHourIntent(),
      phrases: [
        "Quando é a hora dourada no \(.applicationName)",
        "Hora dourada no \(.applicationName)",
      ],
      shortTitle: "Hora dourada",
      systemImageName: "sun.horizon.fill"
    )
    AppShortcut(
      intent: MoonPhaseIntent(),
      phrases: [
        "Qual a fase da lua no \(.applicationName)",
        "Como está a lua no \(.applicationName)",
      ],
      shortTitle: "Fase da lua",
      systemImageName: "moonphase.waxing.gibbous"
    )
    AppShortcut(
      intent: TrackSkyMomentIntent(),
      phrases: [
        "Acompanhar a hora dourada no \(.applicationName)",
        "Acompanhar \(\.$moment) no \(.applicationName)",
      ],
      shortTitle: "Acompanhar",
      systemImageName: "livephoto"
    )
    AppShortcut(
      intent: OpenSkyIntent(),
      phrases: [
        "Ver o céu no \(.applicationName)",
        "Onde está o sol no \(.applicationName)",
      ],
      shortTitle: "Céu agora",
      systemImageName: "camera.viewfinder"
    )
    AppShortcut(
      intent: LogSkyIntent(),
      phrases: ["Registrar o céu no \(.applicationName)"],
      shortTitle: "Registrar",
      systemImageName: "book.closed.fill"
    )
  }
}
