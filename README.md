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
- **Céu (aba AR)**: câmera com o trajeto de hoje, marcadores de hora, trajetos dos solstícios, lua, pontos cardeais, grade de altitude, seta para o sol fora da tela, controle de horário e calibração tocando no sol.
- **Planetário** (botão de estrelas na aba Céu, de dia ou de noite): 1.600 estrelas com cor e brilho reais, as 88 constelações com nomes em português (a que está sob a mira acende), Via Láctea, planetas, Sol e Lua, céu profundo (Nuvens de Magalhães, Nebulosa de Órion, Plêiades, Ômega Centauri, Saco de Carvão…), asterismos como as Três Marias e o Falso Cruzeiro, e o centro da galáxia marcado para fotos. Toque em qualquer estrela para ver nome, constelação, brilho, há quantos anos a luz saiu de lá e, quando é o caso, o estado que ela representa na bandeira do Brasil. **Encontrar** busca e guia até o objeto (desliza no céu virtual; no modo Apontar, uma seta leva o celular até ele, com vibração ao centralizar), com nascer, ocaso e o melhor horário da noite, que você aplica com um toque. **Rastros** simula 2 h de exposição em volta do polo celeste e o **time-lapse** acelera o tempo até 1 h/s. Camadas para chão transparente, atmosfera (o dia apaga as estrelas), câmera ao fundo e visão noturna em vermelho.
- **Diário**: registre nasceres, pores do sol e luas, mantenha uma sequência, ganhe XP, suba de nível e desbloqueie conquistas com celebração animada.
- **Onboarding** em 8 passos com interesses que pré-configuram os lembretes, pedido de localização e de notificações.
- **Lembretes locais** para nascer, pôr, hora dourada, lua cheia e lua nova, com antecedência configurável.
- **Locais**: localização atual, busca offline de cidades e busca por geocodificação, com fuso horário correto por lugar.

## Estrutura

```
src/
  app/          rotas (Expo Router): onboarding, abas, ar, settings, locations, celebrate
  astro/        motor astronômico (astronomy-engine), fusos e formatação pt-BR
    sky/        catálogo do planetário (gerado), nomes em pt-BR, projeção do céu, alvos e busca
  components/   céu dinâmico, glifos de sol e lua, gráficos, botões táteis, barra de abas
    planetarium/ céu em SVG, cartão do objeto e busca
  hooks/        dados do dia, posições ao vivo, janela de registro
  lib/          AR (pose e projeção), conquistas, cidades, localização, notificações, haptics
  store/        estado persistente (zustand + AsyncStorage)
  theme/        tokens de cor, tipografia, movimento e paletas do céu
```

## Design

- Fonte do sistema (SF Pro no iOS, Roboto no Android), sem serifa, com numerais tabulares para horários.
- Neutros carregam a interface; o âmbar solar é a única cor de destaque, usada em dados do sol e no estado ativo. Ações principais são pílulas quase brancas, como as do sistema.
- Formas: ações em pílula, cards com raio 22, peças internas com raio 12.
- Abas nativas (vidro líquido no iOS 26) com o AR como aba "Céu"; ícones SF Symbols no iOS e Material Symbols no Android e na web.
- Movimento discreto com Reanimated no thread de UI, respeitando "Reduzir movimento".

## Dados do céu

`src/astro/sky/data.ts` é gerado por `node scripts/build-sky-data.mjs` a partir do [d3-celestial](https://github.com/ofrohn/d3-celestial) (© Olaf Frohn, BSD-3-Clause, ver `src/astro/sky/LICENSE-d3-celestial.txt`): estrelas até magnitude 5, figuras das constelações e o contorno da Via Láctea, convertido numa malha de brilho suavizado.
