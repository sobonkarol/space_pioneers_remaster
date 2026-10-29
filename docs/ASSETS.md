# Oprawa graficzna

Gra używa **własnej, oryginalnej oprawy** wygenerowanej programowo (bez materiałów z oryginalnego Space Pioneers):
logo, tło, ikony surowców, grafiki 15 budynków, 14 badań, 13 statków, 8 budowli obronnych oraz 50 wariantów
planet (5 typów × 10). Pliki leżą w `frontend/public/assets/art/`, a `manifest.json` mapuje klucze na pliki.

## Generator

Grafiki są rysowane jako SVG w `frontend/scripts/art/*.mjs` (budynki, statki, obrona, badania, planety, logo/tło)
i rasteryzowane przez Chromium do PNG/JPG:

```bash
cd frontend
CHROME_PATH=/usr/bin/chromium node scripts/art/generate.mjs            # wszystko
CHROME_PATH=/usr/bin/chromium node scripts/art/generate.mjs --only=ships --sheet   # wybrana grupa + arkusz podglądu
```

Grupy: `buildings`, `research`, `ships`, `defense`, `planets` (z tłem), `ui` (logo, ikony surowców).
Gotowe pliki są w repozytorium, więc do budowania gry generator nie jest potrzebny.

## Podmiana grafik

Każdą grafikę można zastąpić własnym plikiem: wystarczy podmienić plik (lub zmienić ścieżkę w `manifest.json`).
Klucze: `logo`, `background`, `resource/<metal|crystal|tritium|energy>`, `building/<klucz>`, `research/<klucz>`,
`ship/<klucz>`, `defense/<klucz>`, `planet/<hot|dry|normal|water|ice>/<1-10>`, `planet/default`.
Brak klucza w manifeście = interfejs pokazuje oznaczoną zaślepkę.
