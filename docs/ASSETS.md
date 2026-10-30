# Oprawa graficzna

Gra używa **własnej, oryginalnej oprawy** wygenerowanej programowo (bez materiałów z oryginalnego Space Pioneers):
logo, tło, ikony surowców, grafiki 19 budynków (w tym księżycowych), 14 badań, 13 statków, 8 budowli obronnych,
2 rakiet oraz 55 wariantów planet (5 typów × 10) i księżyców (5). Pliki leżą w `frontend/public/assets/art/`, a `manifest.json` mapuje klucze na pliki.

## Generator 3D (budynki, badania, statki, obrona)

Budynki, badania, statki i obrona to rendery scen 3D w stylu filmów science fiction: modele budowane
w kodzie z prymitywów i przekrojów kadłuba (`loft`), proceduralne tekstury płyt z nitami i zabrudzeniami,
materiały PBR, miękkie cienie, tone mapping ACES, bloom, winieta i ziarno. Renderuje je three.js w Chromium
bez okna (WebGL przez SwiftShader), z nadpróbkowaniem 768 → 320 px, do JPG.

```bash
cd frontend/scripts
CHROME_PATH=/usr/bin/chromium node art3d/render.mjs                               # wszystkie grupy
CHROME_PATH=/usr/bin/chromium node art3d/render.mjs --only=ships --keys=cruiser   # wybrane grafiki
CHROME_PATH=/usr/bin/chromium node art3d/render.mjs --only=research --out=/tmp/podglad  # podgląd poza grą
```

- `art3d/lib3d.js` — tekstury, materiały, geometria, oświetlenie, tła (kosmos, powierzchnia planety), render;
- `art3d/scenes.js` — ujęcia: powierzchnia planety (budynki, obrona), laboratorium (badania);
- `art3d/ships3d.js`, `defense3d.js`, `buildings3d.js`, `research3d.js` — modele.

Każda scena ma stałe ziarno losowości, więc ponowny render daje ten sam obraz. Jeden obraz to 1,5–7 s.
Bez `--out` pliki trafiają do `public/assets/art/<grupa>/<klucz>.jpg` i aktualizują `manifest.json`.

## Generator 2D (planety, logo, tło, ikony)

Planety, księżyce, tło, logo i ikony surowców są rysowane jako SVG w `frontend/scripts/art/*.mjs`
i rasteryzowane przez Chromium:

```bash
cd frontend
CHROME_PATH=/usr/bin/chromium node scripts/art/generate.mjs                 # wszystko
CHROME_PATH=/usr/bin/chromium node scripts/art/generate.mjs --only=ui --sheet
```

Grupy: `planets` (z tłem), `ui` (logo, ikony surowców).
Gotowe pliki są w repozytorium, więc do budowania gry żaden generator nie jest potrzebny.

## Podmiana grafik

Każdą grafikę można zastąpić własnym plikiem: wystarczy podmienić plik (lub zmienić ścieżkę w `manifest.json`).
Klucze: `logo`, `background`, `resource/<metal|crystal|tritium|energy>`, `building/<klucz>`, `research/<klucz>`,
`ship/<klucz>`, `defense/<klucz>`, `planet/<hot|dry|normal|water|ice>/<1-10>`, `planet/default`.
Brak klucza w manifeście = interfejs pokazuje oznaczoną zaślepkę.
