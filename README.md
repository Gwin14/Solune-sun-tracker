# Solune

Acompanhe o sol e a lua: horários de luz, fases, trajetos e um céu em realidade aumentada.
Projeto Expo (SDK 58) para iOS, Android e web.

## Rodar

```bash
npm install
npx expo start
```

Pressione `i` para o simulador iOS, `a` para o emulador Android ou `w` para a web.
Tudo roda no Expo Go. Para lembretes confiáveis e o AR com câmera em produção, gere um development build:

```bash
npx expo run:ios
```

O modo AR com câmera precisa de um aparelho físico (simuladores não têm câmera nem bússola). No simulador e na web, o AR abre no modo **Céu virtual**, que você navega arrastando e fazendo pinça.

## Funcionalidades

- **Hoje**: próximo evento em destaque, céu de fundo que muda com a altitude do sol, gráfico do trajeto do sol e da lua que você arrasta para ver qualquer horário (o céu acompanha), nascer e pôr com direção, horas dourada e azul, linha do tempo dos crepúsculos, bússola com posição atual e tamanho da sua sombra, duração do dia ao longo do ano.
- **Lua**: fase renderizada com o lado iluminado correto para o seu hemisfério, arraste para viajar ±15 dias, nascer e ocaso, distância com perigeu e apogeu, superluas e microluas, próximas fases e calendário lunar do mês.
- **Eventos**: planejador de dia com 60 dias, solstícios e equinócios do seu hemisfério, eclipses solares e lunares (com visibilidade local), luas cheias com nomes tradicionais e chuvas de meteoros com aviso sobre a lua.
- **Céu AR**: câmera com o trajeto de hoje, marcadores de hora, trajetos dos solstícios, lua, pontos cardeais, grade de altitude, seta para o sol fora da tela, controle de horário e calibração tocando no sol.
- **Diário**: registre nasceres, pores do sol e luas, mantenha uma sequência, ganhe XP, suba de nível e desbloqueie conquistas com celebração animada.
- **Onboarding** em 8 passos com interesses que pré-configuram os lembretes, pedido de localização e de notificações.
- **Lembretes locais** para nascer, pôr, hora dourada, lua cheia e lua nova, com antecedência configurável.
- **Locais**: localização atual, busca offline de cidades e busca por geocodificação, com fuso horário correto por lugar.

## Estrutura

```
src/
  app/          rotas (Expo Router): onboarding, abas, ar, settings, locations, celebrate
  astro/        motor astronômico (astronomy-engine), fusos e formatação pt-BR
  components/   céu dinâmico, glifos de sol e lua, gráficos, botões táteis, barra de abas
  hooks/        dados do dia, posições ao vivo, janela de registro
  lib/          AR (pose e projeção), conquistas, cidades, localização, notificações, haptics
  store/        estado persistente (zustand + AsyncStorage)
  theme/        tokens de cor, tipografia, movimento e paletas do céu
```

## Design

- Fonte Manrope (sem serifa), com numerais tabulares para horários.
- Uma cor de destaque (dourado solar); o prata da lua é cor de dado, não de ação.
- Formas: ações em pílula, cards com raio 24, peças internas com raio 14.
- Ícones SF Symbols no iOS e Material Symbols no Android e na web.
- Movimento com Reanimated no thread de UI, respeitando "Reduzir movimento".
