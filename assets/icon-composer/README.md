# Camadas do ícone para o Icon Composer

Recriadas em vetor a partir de `assets/images/icon.png`. Todas em canvas 1024×1024, já alinhadas: basta arrastar sem reposicionar. Use `svg/` (vetor); `png/` é a mesma coisa rasterizada.

Ordem (de baixo para cima) e agrupamento sugerido:

| Grupo | Camada | Observação |
| --- | --- | --- |
| Fundo | `01-ceu` | Ou use o Fill do documento: gradiente linear `#0B1044` → `#3A3487` (55%) → `#65478A` (68%) |
| Céu | `02-brilho` | Halo laranja `#FFAA7D`, 74% → 0% |
| Céu | `03-estrelas` | |
| Astros | `04-lua` | `#EEF0FF` |
| Astros | `05-sol` | Já recortado na linha da colina, para não aparecer através do vidro |
| Terreno | `06-colina-fundo` | `#0D1336` |
| Terreno | `07-colina-frente` | `#060A1C` |
