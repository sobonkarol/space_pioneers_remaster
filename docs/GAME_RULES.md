# Zasady gry (stan implementacji)

**Źródła.** Publicznie dostępne opisy Space Pioneers (Wikipedia DE, katalogi gier) potwierdzają ramy gry:
trzy surowce (metal, kryształ, tryt), kopalnie zasilane energią z elektrowni i satelitów słonecznych,
budynki i badania skracające czasy, statki kolonizacyjne, ataki z rabunkiem, pola zniszczeń do recyklingu,
walka turowa rozstrzygana automatycznie, specjalizacje handlarz/wojownik, sojusze z traktatami (obrona, handel,
wojna), ranking punktowy za wszystko, co zbudowano i zbadano. Archiwa oryginalnej strony i wiki Spacepedia
nie były dostępne podczas prac, więc **konkretne nazwy, liczby i formuły są rekonstrukcją** w duchu gier tego
gatunku (SP powstało jako alternatywa dla OGame). Wszystkie liczby siedzą w plikach JSON i stałych silnika.

## Ekonomia
- Produkcja/h poziomu L: `base · L · growth^L` (metal 30, kryształ 20, tryt 10·czynnik temperatury), ×prędkość galaktyki.
- Produkcja podstawowa: 30 metalu, 15 kryształu /h. Niedobór energii obniża wydajność kopalni proporcjonalnie.
- Elektrownia fuzyjna zużywa tryt; satelita daje `floor((Tmax+140)/6)` energii.
- Magazyn: 10 000 × 1,8^L. Po zapełnieniu produkcja staje (nadwyżka z transportu nie przepada).
- Koszt poziomu L: `koszt bazowy · współczynnik^(L-1)`. Punkty: 1 pkt / 1000 wydanych surowców.

## Czasy
- Budowa: `(metal+kryształ) / (2500 · (1+roboty) · 2^nanity)` h; rozbiórka: połowa czasu, połowa kosztu.
- Badania: `(metal+kryształ) / (1000 · (1+laboratorium))` h; jedno naraz na gracza.
- Stocznia: jak budowa, ale z poziomem stoczni; jednostki dostarczane pojedynczo.

## Floty
- Odległość: inna galaktyka 20 000·Δ, inny system 2700 + 95·Δ, ta sama planeta-system 1000 + 5·Δ.
- Czas: `(35000/prędkość% · √(10·odległość/v) + 10) / prędkość galaktyki`; paliwo zależne od odległości i prędkości.
- Sloty: 1 + technologia komputerowa. Planety: 1 + ⌈astrofizyka/2⌉ (max 9).

## Walka
- Do 6 rund; każda jednostka strzela raz w losowy cel; strzał < 1% osłony celu odbija się.
- Technologie: +10% ataku/osłon/struktury za poziom; wojownik +10% ataku (+1% za poziom Akademii).
- Po walce: 30% metalu i kryształu zniszczonych statków → pole zniszczeń; ~70% obrony odbudowane;
  zwycięzca rabuje do 50% surowców w granicach ładowności.

## Ochrona i społeczność
- Ochrona początkujących poniżej 5000 pkt przy przewadze ×5 (nie dotyczy nieaktywnych 7+ dni).
- Tryb urlopowy: min. 48 h, brak produkcji, brak ataków.
- Sojusze: członkowie i sojusze z aktywnym paktem nie mogą się atakować; wojna jest jednostronna i natychmiastowa.
- Handlarz: +20% ładowności, Centrum handlowe i rynek (3:2:1, prowizja 10% → 5%), Frachtowiec.
