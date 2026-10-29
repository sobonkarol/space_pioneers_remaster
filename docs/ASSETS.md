# Oryginalne grafiki (licencjonowane)

Interfejs pobiera grafiki z `frontend/public/assets/original/` według pliku `manifest.json`.
Dopóki manifest jest pusty, w miejscu grafik widać **wyraźnie oznaczone zaślepki** (napis „placeholder”,
przerywana ramka) — nie są one finalnym wyglądem gry.

## Jak wgrać materiały

1. Skopiuj pliki do katalogów (rozszerzenie dowolne: gif/png/jpg/webp/svg):

| Katalog | Plik | Klucz w manifeście |
|---|---|---|
| `layout/` | `logo.*`, `background.*` | `logo`, `background` |
| `resources/` | `metal.*`, `crystal.*`, `tritium.*`, `energy.*` | `resource/<klucz>` |
| `buildings/` | `<klucz_budynku>.*` | `building/<klucz>` |
| `research/` | `<klucz_badania>.*` | `research/<klucz>` |
| `ships/` | `<klucz_statku>.*` | `ship/<klucz>` |
| `defense/` | `<klucz_obrony>.*` | `defense/<klucz>` |
| `planets/<typ>/` | `1.*` … `10.*` (typ: hot, dry, normal, water, ice) | `planet/<typ>/<n>` |

Klucze obiektów są w `backend/src/main/resources/gamedata/*.json` (np. `metal_mine`, `light_fighter`).

2. Wygeneruj manifest: `node tools/build-asset-manifest.mjs`
3. Przebuduj frontend (`npm run build`) albo odśwież przeglądarkę w trybie deweloperskim.

Jeśli nazwy plików oryginału są inne, manifest można też edytować ręcznie — wartości to ścieżki
względem `assets/original/`.

## Teksty i dane

Nazwy (PL/EN) i opisy obiektów są w `frontend/src/i18n/`. Koszty, statystyki i wymagania — w
`backend/src/main/resources/gamedata/`. Wartości są rekonstrukcją (patrz `GAME_RULES.md`) i można je
podmienić na oryginalne bez zmian w kodzie; silnik waliduje spójność danych przy starcie.
