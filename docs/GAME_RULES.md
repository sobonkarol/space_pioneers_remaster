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
- Szybkie działa (rapid fire): po trafieniu w typ celu z wartością `rf` jednostka strzela ponownie z
  prawdopodobieństwem `(rf-1)/rf`. Statki mają `5` przeciw sondom i satelitom; pozostałe tabele w `units.json`.
- Po walce: 30% metalu i kryształu zniszczonych statków → pole zniszczeń; ~70% obrony odbudowane;
  zwycięzca rabuje do 50% surowców w granicach ładowności.

## Ochrona i społeczność
- Ochrona początkujących poniżej 5000 pkt przy przewadze ×5 (nie dotyczy nieaktywnych 7+ dni).
- Tryb urlopowy: min. 48 h, brak produkcji, brak ataków.
- Sojusze: członkowie i sojusze z aktywnym paktem nie mogą się atakować; wojna jest jednostronna i natychmiastowa.
- Handlarz: +20% ładowności, Centrum handlowe i rynek (3:2:1, prowizja 10% → 5%), Frachtowiec.

## Księżyce, rakiety, ataki i obrona sojusznicza, ekspedycje
- Księżyc: szansa `min(20%, (metal+kryształ pola zniszczeń) / 100 000 %)` po walce; 1 pole bazowe,
  brak produkcji. Baza księżycowa +3 pola za poziom. Budynki mają lokalizację (planeta / księżyc / obie).
- Falanga czujnikowa (księżyc): zasięg `poziom² − 1` układów, skan kosztuje 5000 trytu, pokazuje floty lecące
  do i z planety oraz stacjonujące przy niej.
- Teleporter: natychmiastowy przerzut statków między własnymi księżycami z teleporterem, 1 h ładowania
  (podzielone przez prędkość galaktyki).
- Silos: 10 miejsc na poziom; rakieta przechwytująca 1 miejsce, międzyplanetarna 2. Zasięg rakiet
  `5 · impuls − 1` układów, lot `(30 + 60·układy) / prędkość floty` s. Przechwytujące niszczą rakiety 1:1,
  reszta niszczy obronę (cel główny najpierw), bez pola zniszczeń.
- Atak sojuszniczy: założyciel tworzy związek z lecącej floty i zaprasza sojuszników/znajomych (do 8 flot);
  dołączenie wyrównuje czas przylotu wszystkich flot, ale nie więcej niż o 30% czasu lotu dołączanej floty.
  Łup dzielony proporcjonalnie do wolnej ładowności.
- Obrona sojusznicza: misja „Obrona” do planety sojusznika lub znajomego, pobyt 1–32 h; stacjonująca flota
  walczy po stronie obrońcy i może zostać zawrócona.
- Ekspedycja: na pozycję 16 układu, pobyt 1–8 h, równocześnie `⌊√astrofizyka⌋`. Wyniki: utrata floty 2%,
  nic 30%, surowce 25%, statki 10%, piraci 10%, opóźnienie 12%, wcześniejszy powrót 11%.

## Konto i administracja
- Rejestracja wysyła link potwierdzający adres (ważny 3 dni); konto niepotwierdzone może grać, widzi przypomnienie.
- Reset hasła linkiem z e-maila (ważny 1 h, jednorazowy), unieważnia wszystkie sesje. Najwyżej 3 wiadomości
  jednego rodzaju na godzinę; odpowiedź na prośbę o reset nie zdradza, czy adres istnieje.
- Usunięcie konta po 7 dniach (można anulować); sojusz założyciela przejmuje oficer, a gdy go brak - najsilniejszy
  członek; pusty sojusz jest rozwiązywany.
- Pierwszy gracz serwera jest administratorem i może nadawać uprawnienia. Blokada (1 h – 365 dni albo na stałe)
  unieważnia sesje, uniemożliwia logowanie, włącza wymuszony tryb urlopowy i trafia na publiczny pręgierz.

## Wiadomości, notatki, forum
- Wiadomości spoza archiwum: przeczytane usuwane po 7 dniach, nieprzeczytane po 30. Archiwum mieści 100 wiadomości.
- Notatki: do 100 na gracza, priorytet niski / normalny / ważny.
- Forum sojuszu widoczne tylko dla członków; założyciel i oficerowie przypinają, zamykają i usuwają wątki
  i wpisy; autor edytuje i usuwa własne wpisy (usunięcie pierwszego wpisu usuwa wątek). 20 wpisów na stronę,
  nowe wpisy oznaczane w menu i na liście wątków.
