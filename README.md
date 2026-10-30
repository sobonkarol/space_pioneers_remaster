# Space Pioneers Remaster — dokumentacja techniczna

Przeglądarkowa gra MMO odtwarzająca klasyczne **Space Pioneers** (2004–2017): ekonomia, budynki, badania, floty,
walki, galaktyka, kolonizacja, sojusze, rankingi, a do tego boty, forum gry i wiki.
Produkcja: **https://spacepioneers.pl** (VPS OVH `149.56.209.82`).

Jedyny plik dokumentacji w repozytorium. Opisuje każdy katalog, klasę i plik TypeScript, a także sposób
uruchamiania, testowania i wdrażania.

## Spis treści

1. [Architektura](#1-architektura)
2. [Struktura repozytorium](#2-struktura-repozytorium)
3. [Uruchomienie](#3-uruchomienie)
4. [Backend — pakiety i klasy](#4-backend--pakiety-i-klasy)
5. [Zasady gry i dane gry](#5-zasady-gry-i-dane-gry)
6. [Baza danych](#6-baza-danych)
7. [API REST](#7-api-rest)
8. [Czas w grze i harmonogram](#8-czas-w-grze-i-harmonogram)
9. [Bezpieczeństwo](#9-bezpieczeństwo)
10. [Boty (gracze sterowani przez komputer)](#10-boty-gracze-sterowani-przez-komputer)
11. [Frontend — pliki TypeScript](#11-frontend--pliki-typescript)
12. [Oprawa graficzna i generatory](#12-oprawa-graficzna-i-generatory)
13. [Testy](#13-testy)
14. [CI i automatyczne wdrażanie](#14-ci-i-automatyczne-wdrażanie)
15. [Konfiguracja (zmienne środowiskowe)](#15-konfiguracja-zmienne-środowiskowe)
16. [Kopie zapasowe](#16-kopie-zapasowe)
17. [Poczta i dokumenty prawne](#17-poczta-i-dokumenty-prawne)
18. [Wydajność](#18-wydajność)
19. [Znane ograniczenia](#19-znane-ograniczenia)

---

## 1. Architektura

```
Przeglądarka (React 19 SPA)  ──HTTP/JSON, Bearer token──▶  Spring Boot 3.4 (Java 21, wątki wirtualne)
                                                             ├─ api/        kontrolery REST
                                                             ├─ security/   sesje, limity, CSP
                                                             ├─ game/       logika gry (bez Springa)
                                                             │    └─ store/GameStore (port)
                                                             ├─ engine/     czyste reguły (bez Springa, bez stanu)
                                                             └─ infra/      JdbcGameStore ──▶ PostgreSQL 16 (JSONB)
```

Zasady podziału:

- **`engine`** to czyste funkcje i definicje: formuły ekonomii, walki, lotów. Nie zna bazy ani Springa, więc łatwo
  go testować jednostkowo.
- **`game`** to logika rozgrywki: serwisy operujące na modelu (`Player`, `Planet`, `Fleet`…). Dostęp do danych ma
  tylko przez interfejs `GameStore`. Dzięki temu te same scenariusze testowe działają na magazynie w pamięci
  i na PostgreSQL.
- **`infra`** to implementacja `GameStore` na PostgreSQL. Obiekty gry są trzymane jako dokumenty JSONB, a kolumny
  pomocnicze służą do indeksów i zapytań.
- **`api`, `security`, `config`, `account`** to warstwa Springa: HTTP, uwierzytelnianie, harmonogram i poczta.
- **Spójność:** każda operacja zapisu działa w transakcji z blokadą doradczą `pg_advisory_xact_lock`. Zapisy są
  więc serializowane, także między instancjami. Odczyty bez zaległych zdarzeń idą bez blokady.
- **Czas:** świat jest „doganiany” leniwie przed każdą operacją (zob. [§8](#8-czas-w-grze-i-harmonogram)), a harmonogram
  co sekundę obsługuje zdarzenia graczy offline.
- **Frontend** jest budowany przez Vite do `frontend/dist` i wbudowywany w jar (`classpath:/static`).
  `SpaForwardFilter` przekazuje ścieżki SPA do `index.html`.

## 2. Struktura repozytorium

| Ścieżka | Zawartość |
|---|---|
| `backend/` | Spring Boot (Maven, `pom.xml`) |
| `backend/src/main/java/pl/spacepioneers/` | kod serwera (pakiety opisane w [§4](#4-backend--pakiety-i-klasy)) |
| `backend/src/main/resources/application.yml` | konfiguracja i mapowanie zmiennych środowiskowych |
| `backend/src/main/resources/db/migration/` | migracje Flyway `V1`–`V6` |
| `backend/src/main/resources/gamedata/` | dane gry: `buildings.json`, `research.json`, `units.json` |
| `backend/src/test/` | testy silnika, scenariusze gry, testy PostgreSQL i API |
| `frontend/` | React + TypeScript + Vite |
| `frontend/src/` | kod aplikacji (opisany w [§11](#11-frontend--pliki-typescript)) |
| `frontend/e2e/` | scenariusze E2E w przeglądarce (playwright-core) |
| `frontend/scripts/art`, `art3d` | generatory grafik 2D i 3D |
| `frontend/public/assets/art/` | gotowe grafiki i `manifest.json` |
| `deploy/deploy.sh` | skrypt aktualizacji gry na serwerze (auto-deploy) |
| `deploy/backup/` | obraz kontenera kopii zapasowych |
| `loadtest/load.mjs` | test obciążeniowy API |
| `Dockerfile` | obraz produkcyjny: frontend wbudowany w jar backendu |
| `docker-compose.yml` | usługi `db`, `game`, `backup` |
| `.github/workflows/ci.yml` | CI i auto-deploy |
| `docs/img/` | zrzuty ekranu używane w opisach pull requestów |

## 3. Uruchomienie

### Docker
```bash
DB_PASSWORD=sekret docker compose up --build
# http://localhost:8080
```
Na produkcji obok leży `docker-compose.override.yml` z Caddy (HTTPS dla spacepioneers.pl). Ten plik i `.env`
istnieją tylko na serwerze.

### Lokalnie
```bash
createdb spacepioneers && createdb spacepioneers_test
cd frontend && npm install && npm run build && cd ..
cd backend && FRONTEND_DIR=../frontend/dist mvn spring-boot:run
# tryb deweloperski frontendu: cd frontend && npm run dev   (http://localhost:5173, proxy /api → :8080)
```
Pierwsze zarejestrowane konto zostaje administratorem (menu „Administracja”). Administratorzy nie występują w rankingu.

## 4. Backend — pakiety i klasy

Pakiet bazowy: `pl.spacepioneers`. Punkt startowy: `SpacePioneersApplication`.

### 4.1 `engine` — czyste reguły gry

| Klasa | Odpowiedzialność |
|---|---|
| `Rules` | Zasady ogólne: ochrona początkujących, limit planet, sloty flot itp. |
| **`engine.common`** | |
| `Branch` | Specjalizacja gracza: handlarz albo wojownik (odblokowuje jedne opcje, blokuje inne). |
| `Coordinates` | Współrzędne `galaktyka:system:pozycja`, parsowanie i porównywanie. |
| `ResourceType` | Enum surowców: metal, kryształ, tryt. |
| `Resources` | Niezmienny wektor surowców (`double`, bo produkcja narasta ułamkowo), działania arytmetyczne. |
| `UniverseConfig` | Parametry galaktyki: liczba galaktyk i systemów, prędkość, próg ochrony nowych. |
| **`engine.data`** | |
| `GameData` | Katalog definicji wczytany z `resources/gamedata/*.json`, z wyszukiwaniem po kluczu. |
| `BuildingDef` | Definicja budynku: koszty, formuły produkcji i energii, miejsce budowy (planeta / księżyc / obie). |
| `ResearchDef` | Definicja badania. |
| `UnitDef` | Statek lub obrona: koszt, atak, osłona, struktura, prędkość, ładowność, paliwo, szybkie działa. |
| `GrowthFormula` | Formuła `base · L · growth^L`, opcjonalnie podbijana poziomem badania (`techBonusKey`). |
| `Requirements` | Wymagania: minimalne poziomy budynków (na planecie) i badań (gracza). |
| **`engine.economy`** | |
| `Economy` | Produkcja, bilans energii, magazyny, narastanie surowców w czasie. |
| `ProductionReport` | Wynik obliczenia produkcji planety na godzinę (na stronę „Surowce”). |
| `PlanetSnapshot` | Obraz planety niezależny od bazy, na nim liczy silnik. |
| `PlanetGenerator` | Losuje rozmiar (pola) i temperaturę nowej planety zależnie od pozycji. |
| `Timing` | Czasy budowy, badań i produkcji jednostek w sekundach. |
| `Points` | Punkty rankingowe: 1 pkt za 1000 wydanych surowców. |
| `RequirementChecker` | Sprawdza drzewo technologii i zwraca brakujące wymagania. |
| `TechLevels` | Poziomy badań gracza (widok tylko do odczytu). |
| `Market` | Kursy rynku handlarza (metal 3, kryształ 2, tryt 1) i prowizja. |
| **`engine.fleet`** | |
| `FleetMath` | Odległości, prędkości, czasy lotu, paliwo, ładowność, rabunek. |
| **`engine.combat`** | |
| `CombatEngine` | Walka turowa: do 6 rund, losowe cele, odbicie strzału < 1% osłony, szybkie działa, odbudowa obrony, pole zniszczeń. |
| `Combatant` | Uczestnik walki: flota atakującego albo planeta lub flota obrońcy, z technologiami. |
| `CombatResult` | Wynik walki z przebiegiem rund, stratami i zwycięzcą. |
| `Espionage` | Szpiegostwo sondami: poziom szczegółów raportu i szansa wykrycia. |
| **`engine.special`** | |
| `Moons` | Szansa powstania księżyca i zasięg falangi czujnikowej. |
| `MissileStrike` | Atak rakietami międzyplanetarnymi: przechwytywanie 1:1, obrażenia obrony (najpierw cel główny). |
| `Expedition` | Losowy wynik ekspedycji skalowany wartością floty. |

### 4.2 `game` — logika rozgrywki

`GameException` to naruszenie zasad zgłaszane graczowi. Pole `code` jest stabilnym kluczem tłumaczenia we frontendzie.

**`game.model`** — model zapisywany w JSONB:

| Klasa | Opis |
|---|---|
| `Player` | Konto: login, e-mail, hash hasła, badania, specjalizacja, urlop, blokada, admin, wersja zaakceptowanego regulaminu (`termsVersion`, `termsAcceptedAt`), pole `bot` (`BotBrain`, nigdy nie trafia do API). |
| `Planet` | Planeta lub księżyc: budynki, jednostki, surowce, ustawienia produkcji, kolejki. |
| `BuildOrder` | Pozycja kolejki budowy. Koszt jest pobierany przy dodaniu, a czas liczony przy starcie (uwzględnia ukończone fabryki robotów). |
| `ResearchJob` | Trwające badanie (jedno naraz na gracza). |
| `ShipyardOrder` | Zlecenie stoczni: `count` sztuk po `secondsPerUnit`, dostarczane pojedynczo. |
| `Fleet` | Flota w locie: misja, statki, ładunek, czasy przylotu, postoju i powrotu. |
| `AttackUnion` | Atak sojuszniczy: kilka flot przylatuje razem. |
| `DebrisField` | Pole zniszczeń (metal i kryształ). |
| `Message` | Wiadomość w skrzynce: typ, treść, `payload` z raportem w JSON, archiwum. |
| `Alliance`, `AllianceApplication` | Sojusz (tag, opis HTML, rangi, członkowie) i podanie o przyjęcie. |
| `Treaty` | Traktat między sojuszami: pakt obronny lub handlowy wymaga akceptacji, wojna jest jednostronna. |
| `Buddy` | Znajomość dwóch graczy. |
| `Score` | Punkty w kategoriach: budynki, badania, flota, obrona. |
| `Note` | Prywatna notatka z priorytetem 0, 1 lub 2. |
| `ForumThread`, `ForumPost` | Forum sojuszu. `lastPostId` oznacza nowe wpisy. |
| `BoardThread`, `BoardPost` | Publiczne forum gry. `status` dotyczy tylko działu „Zgłoszenia błędów”. |
| `BotBrain` | Stan bota: charakter, rytm dnia, wagi strategii, pamięć celów, historia nagród. |

**`game.service`** — serwisy. Wszystkie dziedziczą po `ServiceBase`.

| Klasa | Odpowiedzialność |
|---|---|
| `ServiceBase` | Transakcje: `tx()` (zapis z blokadą), `read()` (odczyt), `txRun()`. Przed operacją dogania świat (`World`). |
| `GameContext` | Wspólne zależności: `GameStore`, `GameData`, `UniverseConfig`, zegar, RNG, `World`, `Mailer`. |
| `Game` | Fasada: składa wszystkie serwisy na jednym kontekście (`game.planets()`, `game.fleets()`, `game.bots()`…). |
| `World` | Upływ czasu: obsługuje zaległe zdarzenia chronologicznie i nalicza produkcję. |
| `PlayerService` | Rejestracja (z akceptacją regulaminu), profil, specjalizacja, urlop, hasło, język, `acceptTerms`, `exportData` (RODO), `TERMS_VERSION`. |
| `AccountService` | Potwierdzanie e-maila, zmiana adresu, usuwanie konta z 7-dniowym okresem, wygasanie blokad, usuwanie nieaktywnych. |
| `AdminService` | Panel administratora: statystyki (także liczba botów), lista graczy, blokady, uprawnienia, ogłoszenia, usuwanie kont. |
| `PlanetService` | Przegląd planety, budynki, kolejka budowy, rozbiórka, produkcja, zmiana nazwy, porzucenie planety, imperium. |
| `ResearchService` | Badania: start, anulowanie, jedno naraz. |
| `ShipyardService` | Stocznia: statki i obrona, limity (silos, kopuły). |
| `FleetService` | Wysyłanie flot (wszystkie misje), szacunek lotu, zawracanie, ataki sojusznicze, rakiety, falanga, teleporter. |
| `MissionProcessor` | Przyloty, postoje i powroty: atak, transport, stacjonowanie, kolonizacja, recykling, szpiegostwo, obrona, ekspedycja. |
| `GalaxyService` | Widok układu słonecznego (planety, księżyce, pola zniszczeń, aktywność). |
| `MessageService` | Skrzynka, archiwum (do 100), wiadomości prywatne, wygasanie (7 dni po przeczytaniu, 30 nieprzeczytane). |
| `Mailer` | Tworzy wiadomości systemowe i raporty. |
| `Reports` | Struktury raportów (walka, szpieg, ekspedycja…) zapisywane w `Message.payload`. |
| `AllianceService` | Sojusze: zakładanie, podania, rangi, okólnik, opis HTML (przez `SafeHtml`, do 20 000 znaków), traktaty, rozwiązanie. |
| `Diplomacy` | Relacje: ten sam sojusz, pakt, znajomi (kto może kogo atakować i bronić). |
| `BuddyService` | Lista znajomych: zaproszenia, akceptacja, usuwanie. |
| `ForumService` | Forum sojuszu: wątki i wpisy, moderacja założyciela i oficerów. |
| `BoardService` | Publiczne forum gry: działy, wątki, wpisy, moderacja administratorów, status zgłoszeń, odstęp 15 s między wpisami. |
| `NoteService` | Notatki (do 100 na gracza). |
| `MarketService` | Wymiana surowców na rynku handlarza. |
| `RankingService` | Przeliczanie punktów (cyklicznie i na żądanie), ranking graczy z kolumną specjalizacji i sojuszy z liczbą członków. Pomija administratorów. |
| `SearchService` | Wyszukiwarka graczy, sojuszy i planet. |
| `SimulatorService` | Symulator walki: wielokrotne powtórzenie `CombatEngine` bez zmiany stanu. |
| `BotService` | Boty: zakładanie kont i tury (zob. [§10](#10-boty-gracze-sterowani-przez-komputer)). |
| `Views` | Rekordy widoków zwracane przez API (np. `RankingRow` z `members` i `branch`). |

**`game.store`**:

| Klasa | Opis |
|---|---|
| `GameStore` | Port magazynu. Zwraca kopie obiektów, zmiany wymagają `save`. Zapisy tylko w `inTransaction`. Zawiera zapytania o zdarzenia, ranking (`rankedPlayerCount`), galaktykę i fora. |
| `InMemoryGameStore` | Magazyn w pamięci do testów: głębokie kopie, blokada i wycofanie przy wyjątku. |
| `DueEvent` | Zdarzenie do obsłużenia: koniec budowy, koniec badania, przylot lub powrót floty. |
| `Json` | Wspólny `ObjectMapper` (`Json.MAPPER`) z widocznością pól, do JSONB i raportów. |

**Pozostałe pakiety `game`:**

| Klasa | Opis |
|---|---|
| `game.text.SafeHtml` | Czyszczenie HTML od graczy (jsoup, biała lista znaczników, atrybutów i bezpiecznych właściwości CSS). |
| `game.bot.BotNames` | Generator nicków botów (polskie i angielskie słowa, przydomki, liczby), bez słów zdradzających bota. |

### 4.3 `infra`

| Klasa | Opis |
|---|---|
| `JdbcGameStore` | `GameStore` na PostgreSQL (JdbcTemplate). Dokumenty w kolumnie `data jsonb` i kolumny pomocnicze do zapytań. Transakcja zakłada `pg_advisory_xact_lock`. Ranking pomija adminów: `coalesce((data ->> 'admin')::boolean, false) = false`. |

### 4.4 `account` — poczta i tokeny

| Klasa | Opis |
|---|---|
| `AccountTokens` | Jednorazowe tokeny linków (potwierdzenie, reset). W bazie jest tylko skrót SHA-256. Najwyżej 3 wiadomości jednego rodzaju na godzinę. |
| `AccountMails` | Treści e-maili (PL/EN). |
| `AdminLog` | Dziennik działań administratorów. Wpisy BAN tworzą publiczny pręgierz. |
| `EmailSender` | Interfejs wysyłki. |
| `SmtpEmailSender` | Wysyłka przez SMTP (`SPRING_MAIL_*`). |
| `LogEmailSender` | Tryb bez SMTP: wiadomości trafiają do logu, a przy `MAIL_DEV_OUTBOX=true` do `/api/dev/outbox`. |
| `MailConfiguration` | Wybiera SMTP, gdy ustawiono `spring.mail.host`, a w przeciwnym razie log. |

### 4.5 `api` — kontrolery REST

| Klasa | Zakres |
|---|---|
| `AuthController` | Rejestracja (wymaga `acceptTerms`), logowanie, wylogowanie, potwierdzenie e-maila, reset hasła. |
| `MeController` | Profil, akceptacja regulaminu, eksport danych, specjalizacja, urlop, język, hasło, e-mail, usunięcie konta. |
| `PlanetController` | Planety, imperium, budynki, kolejka, surowce, badania, stocznia. |
| `FleetController` | Floty, szacunek lotu, związki ataku, rakiety, falanga, teleporter. |
| `SocialController` | Galaktyka, wiadomości, notatki, forum sojuszu, sojusze, traktaty, znajomi, ranking, rynek. |
| `ToolsController` | Wyszukiwarka, symulator. |
| `BoardController` | Publiczne forum gry (GET bez logowania). |
| `AdminController` | Panel administratora (uprawnienia sprawdza logika gry, każda akcja trafia do dziennika). |
| `ConfigController` | `/api/config` (parametry galaktyki, katalog definicji, `legal {operator,address,email,termsVersion}`) i `/api/stats`. |
| `PublicController` | Pręgierz i (tylko w testach) skrzynka e-maili. |
| `ApiExceptionHandler` | Jednolity format błędu `{"code": "...", "message": "..."}`. |

### 4.6 `security`

| Klasa | Opis |
|---|---|
| `SecurityConfig` | Łańcuch filtrów Spring Security, publiczne ścieżki, nagłówki (CSP i in.), BCrypt. |
| `SessionService` | Sesje oparte na losowych tokenach. W bazie jest skrót SHA-256, TTL 14 dni. |
| `TokenAuthenticationFilter` | Uwierzytelnianie nagłówkiem `Authorization: Bearer <token>`. |
| `PlayerPrincipal` | Zalogowany gracz (id, admin). |
| `LoginThrottle` | Po 8 nieudanych próbach login jest zablokowany na 10 minut. Stan jest trzymany w bazie (`login_attempts`). |
| `RateLimitFilter` | Wiadro żetonów: na sesję albo IP. Osobny limit dla logowania, rejestracji i resetu. Przekroczenie daje HTTP 429. |

### 4.7 `config`

| Klasa | Opis |
|---|---|
| `GameConfiguration` | Beany: `GameData`, `UniverseConfig`, `JdbcGameStore`, `Game`, surowce startowe. |
| `GameScheduler` | Zadania cykliczne (zob. [§8](#8-czas-w-grze-i-harmonogram)). |
| `UniverseProperties` | `spacepioneers.universe.*` (w tym `startResources`). |
| `BotProperties` | `spacepioneers.bots.*`: `enabled`, `target` (50), `perWeek` (5), `turnsPerTick` (8). |
| `LegalProperties` | `spacepioneers.legal.*`: dane administratora do regulaminu. |
| `SpaForwardFilter` | Przekazuje ścieżki SPA (GET bez kropki, poza `/api` i `/actuator`) do `index.html`. |

## 5. Zasady gry i dane gry

Wszystkie liczby siedzą w `backend/src/main/resources/gamedata/*.json` (19 budynków, 14 badań, 23 jednostki:
statki, obrona i rakiety) oraz w stałych silnika. Podmiana wartości nie wymaga zmian w kodzie.

Wartości są rekonstrukcją w duchu oryginału, bo archiwa SP i Spacepedii nie były dostępne. Wzory są przepisane
1:1 do wiki w `frontend/src/pages/wiki/wikiMath.ts`. Zmiana wzoru w silniku wymaga zmiany także tam (pilnuje
tego `wikiMath.test.ts`).

**Ekonomia**
- Produkcja na godzinę na poziomie L: `base · L · growth^L` (metal 30, kryształ 20, tryt 10 · czynnik temperatury),
  pomnożona przez prędkość galaktyki.
- Produkcja podstawowa: 30 metalu i 15 kryształu na godzinę. Niedobór energii obniża wydajność kopalń proporcjonalnie.
- Elektrownia fuzyjna zużywa tryt. Satelita słoneczny daje `floor((Tmax+140)/6)` energii.
- Magazyn mieści `10 000 × 1,8^L`. Pełny magazyn zatrzymuje produkcję (nadwyżka z transportu nie przepada).
- Koszt poziomu L: `baseCost · costFactor^(L-1)`. Punkty: 1 pkt za 1000 wydanych surowców.

**Czasy**
- Budowa: `(metal+kryształ) / (2500 · (1+roboty) · 2^nanity)` h. Rozbiórka trwa połowę czasu i kosztuje połowę.
- Badania: `(metal+kryształ) / (1000 · (1+laboratorium))` h, jedno naraz na gracza.
- Stocznia liczy jak budowa, ale z poziomem stoczni, a jednostki są dostarczane pojedynczo.

**Floty**
- Odległość: inna galaktyka `20 000·Δ`, inny system `2700 + 95·Δ`, ten sam system `1000 + 5·Δ`.
- Czas lotu: `(35000/prędkość% · √(10·odległość/v) + 10) / prędkość galaktyki`. Paliwo zależy od odległości i prędkości.
- Sloty flot: `1 + technologia komputerowa`. Planety: `1 + ⌈astrofizyka/2⌉` (najwyżej 9).

**Walka**
- Do 6 rund, każda jednostka strzela raz. Strzał słabszy niż 1% osłony celu odbija się.
- Każdy poziom technologii daje +10% ataku, osłon lub struktury. Wojownik ma +10% ataku i +1% za każdy poziom Akademii.
- Szybkie działa: po trafieniu celu z wartością `rf` jednostka strzela ponownie z prawdopodobieństwem `(rf-1)/rf`.
- Po walce 30% metalu i kryształu zniszczonych statków trafia do pola zniszczeń. Około 70% obrony jest odbudowywane.
  Zwycięzca rabuje do 50% surowców w granicach ładowności.

**Ochrona i społeczność**
- Ochrona początkujących obowiązuje poniżej 5000 pkt przy przewadze ×5. Nie dotyczy kont nieaktywnych od 7 dni.
- Tryb urlopowy trwa co najmniej 48 h: nie ma wtedy produkcji ani ataków.
- Członkowie jednego sojuszu i sojuszy z paktem nie mogą się atakować.
- Handlarz ma +20% ładowności, Centrum handlowe, rynek (kursy 3:2:1, prowizja 10% → 5%) i Frachtowiec.

**Księżyce, rakiety, ataki sojusznicze, ekspedycje**
- Szansa na księżyc po walce: `min(20%, (metal+kryształ pola zniszczeń) / 100 000 %)`. Baza księżycowa daje +3 pola na poziom.
- Falanga ma zasięg `poziom² − 1` układów, a skan kosztuje 5000 trytu.
- Teleporter przerzuca statki między księżycami natychmiast, z 1 h ładowania.
- Silos ma 10 miejsc na poziom: rakieta przechwytująca zajmuje 1, międzyplanetarna 2. Zasięg rakiet to `5 · impuls − 1` układów.
- Atak sojuszniczy łączy do 8 flot. Dołączenie wyrównuje czas przylotu o najwyżej 30% czasu lotu dołączanej floty.
  Łup jest dzielony według wolnej ładowności.
- Obrona sojusznicza: pobyt 1–32 h, flota walczy po stronie obrońcy.
- Ekspedycja leci na pozycję 16, trwa 1–8 h, a liczba równoczesnych to `⌊√astrofizyka⌋`.
  Wyniki: utrata floty 2%, nic 30%, surowce 25%, statki 10%, piraci 10%, opóźnienie 12%, wcześniejszy powrót 11%.

**Konto**
- Link potwierdzający jest ważny 3 dni. Link resetu hasła jest ważny 1 h i unieważnia wszystkie sesje.
- Usunięcie konta następuje po 7 dniach (można je anulować). Sojusz usuwanego założyciela przejmuje oficer
  albo najsilniejszy członek.
- Blokada (od 1 h do 365 dni albo na stałe) unieważnia sesje, włącza tryb urlopowy i trafia na pręgierz.

**Opis sojuszu w HTML**
- Dozwolone są formatowanie, `font`, `center`, tabele, listy, `hr`, obrazki (tylko https), linki (nowa karta,
  `nofollow`), `marquee` i bezpieczne style.
- HTML czyści serwer (`SafeHtml`) przy zapisie i odczycie, a potem drugi raz przeglądarka (DOMPurify).

## 6. Baza danych

PostgreSQL 16, migracje Flyway w `db/migration`:

| Migracja | Zawartość |
|---|---|
| `V1__init.sql` | `players`, `planets`, `fleets`, `debris_fields`, `messages`, `alliances`, `alliance_applications`, `treaties`, `sessions` |
| `V2__moons_unions.sql` | księżyce, `attack_unions`, `buddies`, kolumny obrony sojuszniczej, ekspedycji i rakiet |
| `V3__accounts_admin.sql` | `account_tokens`, `account_token_log`, `admin_log` |
| `V4__social.sql` | archiwum wiadomości, `notes`, `forum_threads`, `forum_posts` |
| `V5__security.sql` | `login_attempts` (trwała blokada logowania) |
| `V6__public_forum.sql` | `board_threads`, `board_posts` |

Wzorzec tabel: `id` jest kluczem, `data jsonb` przechowuje cały obiekt modelu (serializowany przez `Json.MAPPER`),
a kolumny pomocnicze służą do indeksów (właściciel, współrzędne, czas zdarzenia). Zdarzenia (`DueEvent`) wybiera się
po kolumnach czasu w `planets`, `players` i `fleets`.

Nowa migracja to nowy plik `V7__opis.sql`. Istniejących migracji nie wolno edytować.

## 7. API REST

Wszystkie ścieżki zaczynają się od `/api`. Uwierzytelnianie: `Authorization: Bearer <token>`. Błąd ma postać
`{code, message}`.

| Obszar | Endpointy |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/logout`, `/auth/verify`, `/auth/forgot-password`, `/auth/reset-password` |
| Konto | `GET /me`, `POST /me/terms`, `GET /me/export`, `POST /me/branch`, `/me/vacation`, `/me/language`, `/me/password`, `/me/email`, `/me/verification`, `POST/DELETE /me/deletion` |
| Planety | `GET /planets`, `GET /empire`, `GET /planets/{id}/overview`, `…/buildings`, `POST …/buildings/{key}`, `POST …/buildings/{key}/demolish`, `DELETE …/build-queue/{orderId}`, `GET …/resources`, `PUT …/production`, `PUT …/name`, `DELETE /planets/{id}` |
| Badania | `GET /planets/{id}/research`, `POST …/research/{key}`, `DELETE /research` |
| Stocznia | `GET /planets/{id}/shipyard`, `POST /planets/{id}/shipyard` |
| Floty | `GET /planets/{id}/fleet-dispatch`, `POST /fleets/estimate`, `POST /fleets`, `GET /fleets`, `POST /fleets/{id}/recall`, `POST /fleets/{id}/union`, `GET /unions`, `POST /unions/{id}/invite`, `POST /planets/{id}/missiles`, `POST /planets/{moonId}/phalanx`, `POST /planets/{moonId}/jump` |
| Galaktyka | `GET /galaxy/{galaxy}/{system}` |
| Wiadomości | `GET /messages`, `/messages/unread`, `/messages/{id}`, `/messages/archive`, `POST /messages`, `/messages/read-all`, `/messages/{id}/archive`, `DELETE /messages`, `/messages/{id}` |
| Notatki | `GET/POST /notes`, `PUT/DELETE /notes/{id}` |
| Forum sojuszu | `GET /forum`, `POST /forum/threads`, `GET/PUT/DELETE /forum/threads/{id}`, `POST /forum/threads/{id}/posts`, `PUT/DELETE /forum/posts/{id}` |
| Sojusze | `GET/POST /alliances`, `GET /alliances/{id}`, `POST /alliances/{id}/apply`, `DELETE /alliances/application`, `POST /alliances/applications/{id}`, `POST /alliances/leave`, `DELETE /alliances/members/{playerId}`, `PUT …/members/{playerId}/rank`, `PUT /alliances/settings`, `DELETE /alliances`, `POST /alliances/circular`, `POST /alliances/treaties`, `POST …/treaties/{id}/accept`, `DELETE …/treaties/{id}` |
| Znajomi | `GET/POST /buddies`, `POST/DELETE /buddies/{id}` |
| Ranking, rynek | `GET /ranking`, `GET/POST /market/{planetId}` |
| Narzędzia | `GET /search`, `POST /simulator`, `GET /simulator/own` |
| Forum gry | `GET /board`, `/board/categories/{category}`, `/board/threads/{id}`, `POST /board/threads`, `POST /board/threads/{id}/posts`, `PUT/DELETE /board/threads/{id}`, `PUT/DELETE /board/posts/{id}` |
| Admin | `GET /admin/stats`, `/admin/players`, `/admin/players/{id}`, `/admin/log`, `POST /admin/players/{id}/ban`, `…/unban`, `…/admin`, `…/delete`, `POST /admin/announce` |
| Publiczne | `GET /config`, `/stats`, `/pillory`, `/dev/outbox` (tylko `MAIL_DEV_OUTBOX=true`) |

Spring Actuator udostępnia tylko `/actuator/health`.

## 8. Czas w grze i harmonogram

- **Leniwe doganianie (`World`):** przed każdą operacją `ServiceBase` pobiera zaległe `DueEvent` aż do „teraz”
  i obsługuje je chronologicznie. Planety naliczają produkcję do chwili zdarzenia. Dzięki temu np. koniec budowy
  kopalni wpływa na produkcję dokładnie od momentu jej ukończenia.
- **`GameScheduler`:**
  - co 1 s obsługuje zdarzenia, także graczy offline;
  - co `RANKING_INTERVAL_MS` (5 min) przelicza ranking;
  - co 15 s wykonuje tury botów;
  - okresowo sprząta wygasłe sesje, tokeny i wiadomości, wykonuje zaplanowane usunięcia kont, zdejmuje wygasłe
    blokady i usuwa nieaktywnych.
- Zegar i RNG pochodzą z `GameContext`, więc testy sterują czasem (`GameFixture`).

## 9. Bezpieczeństwo

- **Hasła:** BCrypt. **Sesje:** losowy token, w bazie skrót SHA-256, ważny 14 dni. Reset hasła unieważnia wszystkie sesje.
- **Logowanie:** `LoginThrottle` blokuje login na 10 minut po 8 nieudanych próbach. Stan jest w bazie.
- **Limity zapytań:** `RateLimitFilter`. Logowanie, rejestracja i reset: 20 na minutę na IP. API: 600 na minutę
  i zryw 120 na sesję. Adresy IP są trzymane tylko w pamięci. Za proxy trzeba ustawić
  `SERVER_FORWARD_HEADERS_STRATEGY=native`. Na wielu instancjach limity API liczą się osobno na każdej.
- **Nagłówki:** CSP `default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline';
  script-src 'self'; connect-src 'self'; frame-ancestors 'none'`.
- **HTML graczy:** `SafeHtml` (jsoup) na serwerze i DOMPurify 3.2.4 w `AllianceHtml.tsx`. Hook DOMPurify sprawdza
  `href`/`src` (tylko https, linki z `target=_blank rel="nofollow noopener"`). Usuwane są skrypty, ramki, formularze,
  zdarzenia, `javascript:`, `url()` i `position`.
- **Błędy:** `server.error.include-message: never`, a do klienta trafia tylko `{code,message}` z `GameException`.

## 10. Boty (gracze sterowani przez komputer)

Boty to zwykłe konta, którymi steruje serwer (`BotService`, stan w `Player.bot` → `BotBrain`). Grają przez te same
serwisy co ludzie i nie mają ułatwień. Widzą tylko to, co widziałby gracz. W grze nie są oznaczone, a w panelu
administratora mają dopisek „(AI)” z charakterem. Konto bota ma e-mail `<nick>.<losowe>@gracze.invalid` i hasło,
które nie przechodzi walidacji logowania, więc nie da się na nie zalogować.

**Włączenie** (`.env` na serwerze, potem `docker compose up -d`):
```
BOTS_ENABLED=true
BOTS_TARGET=50        # docelowa liczba botów
BOTS_PER_WEEK=5       # najwyżej tyle nowych w ciągu 7 dni (równo rozłożone)
BOTS_TURNS_PER_TICK=8 # ile tur najwyżej na jedno wywołanie harmonogramu
```
- Boty powstają tylko wtedy, gdy istnieje co najmniej jeden człowiek.
- `BOTS_ENABLED=false` zatrzymuje tury, ale konta zostają.
- Usunięte boty są uzupełniane do `BOTS_TARGET` w tempie `BOTS_PER_WEEK`.

**Charakter** ustala początkowe wagi strategii:
- `MINER` — ekonomia;
- `RAIDER` — flota;
- `TURTLE` — obrona;
- `EXPLORER` — ekspansja i ekspedycje;
- `BALANCED` — zrównoważony.

**Rytm dnia:** zapaleńcy zaglądają co 5–25 min, regularni co 20–90 min, niedzielni co 1,5–5 h. Każdy bot śpi kilka
godzin w nocy (Europe/Warsaw).

**Tura:**
1. Raporty: szpiegowskie zapisuje w pamięci celów, a z raportów walki liczy nagrody.
2. Obrona: gdy nadlatuje silniejszy atak, wysyła flotę z surowcami w bezpieczne miejsce, a resztę wydaje na obronę.
3. Stocznia: odkłada budżet na wojsko według charakteru (sondy, transportowce, okręty, obrona, kolonizator).
4. Budowa: kolejkuje tyle, żeby wystarczyło do następnej wizyty. Pilnuje energii i magazynów, a odkłada tylko na to,
   co uzbiera w ≤ 4 h. Przy braku energii podbija elektrownie.
5. Badania: najpierw te, które odblokowują sondy, transport i kolonizację.
6. Floty: przegląda okoliczne układy i szpieguje (liczba sond dobierana do celu). Atakuje tylko wtedy, gdy symulator
   daje wysoką szansę wygranej i łup przewyższa straty. Zbiera pola zniszczeń, kolonizuje, wysyła ekspedycje.
7. Uczenie: co 6 h ocenia przyrost punktów, łupy i straty bieżącej strategii (`ECONOMY`, `RESEARCH`, `FLEET`,
   `DEFENSE`, `EXPANSION`) i wybiera kolejną metodą ε-zachłanną. Pamięta cele za mocne lub nieopłacalne oraz to,
   kto go atakował.

Boty nie piszą wiadomości, nie zakładają sojuszy i nie handlują. Odebrane wiadomości kasują. Tura na PostgreSQL
trwa ok. 0,2–0,3 s, a 50 botów w ludzkim rytmie to średnio mniej niż jedna tura na minutę.

## 11. Frontend — pliki TypeScript

Stos: React 19, React Router, TypeScript, Vite, vitest, DOMPurify, oxlint. Kod w `frontend/src`.

### 11.1 Rdzeń

| Plik | Odpowiedzialność |
|---|---|
| `main.tsx` | Montuje aplikację, ładuje manifest grafik. |
| `App.tsx` | Routing. Strony publiczne: `/verify`, `/reset-password`, `/pillory`, `/forum-gry/*`, `/wiki/*`, `/regulamin`, `/prywatnosc`. Strony gry za `Layout`: `/overview`, `/resources`, `/buildings`, `/research`, `/shipyard`, `/defense`, `/fleet`, `/galaxy`, `/empire`, `/techtree`, `/messages`, `/alliance[/:id]`, `/buddies`, `/forum[/:threadId]`, `/notes`, `/search`, `/simulator`, `/ranking`, `/market`, `/settings`, `/admin`. `/help` przekierowuje do wiki. |
| `api/client.ts` | `fetch` z tokenem (`setToken`/`getToken` w localStorage), `ApiError` (`code`, `status`), obsługa 401 (`setUnauthorizedHandler`), obiekt `api` z metodami get/post/put/delete. |
| `api/types.ts` | Typy odpowiedzi API, lustro `Views` i modeli backendu. |
| `state/session.tsx` | `SessionProvider` / `useSession()`: zalogowany gracz (`/api/me`), logowanie, wylogowanie, odświeżanie profilu, wybór planety. |
| `state/game.tsx` | `GameProvider` / `useGame()`: przegląd bieżącej planety odświeżany cyklicznie (pasek surowców, licznik wiadomości, floty). `useServerNow()` uwzględnia przesunięcie zegara serwera. |
| `i18n/index.ts` | `t(klucz, {parametry})`, tłumaczenia kodów błędów. |
| `i18n/pl.ts`, `i18n/en.ts` | Teksty interfejsu. Używany jest tylko polski, angielski jest częściowy i nieużywany. |
| `lib/format.ts` | `fmt` (kropka jako separator tysięcy), `duration`, `dateTime`, `clockTime`, `covers`, `scale`, `totalOf`, `parseAmount`. |
| `lib/assets.ts` | Manifest grafik: `loadAssetManifest`, `assetUrl`, `itemAssetKey`, `planetAssetKey`, `firstAsset`. |
| `styles/game.css` | Cały wygląd: klasyczny, ciemny, tabelaryczny, bez wersji mobilnej (świadomie oldschool). |

### 11.2 Komponenty (`components/`)

| Plik | Opis |
|---|---|
| `Layout.tsx` | Rama gry: logo, menu (nowe wiadomości i wpisy forum), pasek surowców, wybór planety, przypomnienia (niepotwierdzony e-mail, zaplanowane usunięcie), `TermsGate` (ponowna akceptacja regulaminu po zmianie `termsVersion`), `AttackAlarm`, stopka z linkami prawnymi. |
| `AttackAlarm.tsx` | Alarm o obcych flotach lecących na planety gracza (ataki, ataki sojusznicze, rakiety, sondy), najbliższe najpierw, z odliczaniem. Test: `AttackAlarm.test.ts`. |
| `FleetTable.tsx` | Tabela ruchów flot z odliczaniem do przylotu i powrotu. |
| `Reports.tsx` | Renderowanie raportów z `payload`: walka (rundy, straty, łup), szpieg (przycisk „do symulatora”), ekspedycja, rakiety, falanga. |
| `AllianceHtml.tsx` | Bezpieczne wyświetlanie opisu sojuszu (DOMPurify + hook dla `href`/`src`). |
| `AssetImage.tsx` | Grafika obiektu z manifestu albo oznaczona zaślepka. |
| `common.tsx` | `Countdown`, `Cost`, `MissingRequirements`, `Panel`, `ErrorBox`, `InfoBox`, `SuccessBox`, `Loading`, `errorText`, `useLoad` (ładowanie danych), `useAction` (akcja z obsługą błędu). |

### 11.3 Strony gry (`pages/`)

| Plik | Opis |
|---|---|
| `AuthPage.tsx` | Logowanie i rejestracja (z checkboxem akceptacji regulaminu), formularz „nie pamiętam hasła”. |
| `AccountLinkPages.tsx` | Strony bez logowania: `VerifyEmailPage`, `ResetPasswordPage`, `ForgotPasswordForm`, `PilloryPage`. |
| `OverviewPage.tsx` | Przegląd planety: pola, temperatura, kolejki, floty, punkty. |
| `ResourcesPage.tsx` | Produkcja, energia, magazyny, suwaki wydajności. |
| `BuildingsPage.tsx` | Budynki (także wiersz badania: grafika, opis, koszt, czas, powód blokady), kolejka, rozbiórka. |
| `ResearchPage.tsx` | Badania. |
| `ShipyardPage.tsx` | Stocznia i obrona (ta sama strona pod `/shipyard` i `/defense`). |
| `FleetPage.tsx` | Wysyłanie floty: wybór statków, cel, misja, prędkość, ładunek, szacunek, związki ataku, rakiety. |
| `GalaxyPage.tsx` | Widok układu: planety, księżyce, pola zniszczeń, akcje (szpieg, atak, recykling, ekspedycja, falanga, znajomy). |
| `EmpirePage.tsx` | Zestawienie wszystkich planet. |
| `TechTreePage.tsx` | Drzewo technologii z zaznaczeniem spełnionych wymagań. |
| `MessagesPage.tsx` | Skrzynka, archiwum, pisanie wiadomości, raporty. |
| `AlliancePage.tsx` | Sojusz: lista, zakładanie, podania, członkowie i rangi, edytor opisu HTML z podglądem, okólnik, traktaty. |
| `BuddiesPage.tsx` | Znajomi. |
| `ForumPage.tsx` | Forum sojuszu (lista wątków albo wątek). |
| `NotesPage.tsx` | Notatki. |
| `SearchPage.tsx` | Wyszukiwarka. |
| `SimulatorPage.tsx` | Symulator walki (może przyjąć dane z raportu szpiegowskiego). |
| `RankingPage.tsx` | Ranking graczy (z kolumną specjalizacji) i sojuszy. |
| `MarketPage.tsx` | Rynek handlarza. |
| `SettingsPage.tsx` | Ustawienia: specjalizacja, urlop, hasło, e-mail, usunięcie konta, eksport danych (RODO, plik JSON). |
| `AdminPage.tsx` | Panel administratora: statystyki (w tym boty), gracze, blokady, uprawnienia, ogłoszenia, dziennik. |

### 11.4 Strony otwierane w osobnej karcie

| Plik | Opis |
|---|---|
| `wiki/WikiPages.tsx` | Kosmopedia: jedna trasa `/wiki` i `/wiki/:slug`, spis treści, wyszukiwanie, strony obiektów. |
| `wiki/WikiFrame.tsx` | Rama w stylu klasycznej wiki (nagłówek, boczne menu, okruszki). |
| `wiki/WikiArticles.tsx` | Artykuły z zasadami: ekonomia, floty, misje, walka, sojusze, księżyce, rakiety, ekspedycje, konto, alarm, opis HTML, specjalizacje. |
| `wiki/WikiItems.tsx` | Strony budynków, badań, statków, obrony i rakiet z tabelami poziomów, drzewo technologii, szybkie działa, kalkulator lotów. |
| `wiki/wikiMath.ts` | Wzory silnika przepisane 1:1. Tabele są liczone z definicji z `/api/config`. Test: `wikiMath.test.ts`. |
| `board/BoardPages.tsx` | Publiczne forum gry `/forum-gry`: działy (Ogłoszenia, Dyskusja ogólna, Pomysły, Zgłoszenia błędów, Pomoc), wątki, wpisy, moderacja. |
| `legal/LegalPages.tsx` | Regulamin (`/regulamin`) i polityka prywatności (`/prywatnosc`). Dane administratora pochodzą z `/api/config.legal`. Przy zmianie treści trzeba podnieść `PlayerService.TERMS_VERSION` i `LEGAL_DATE`. |

### 11.5 Testy jednostkowe frontendu

Pliki `*.test.ts` leżą obok testowanego kodu, zgodnie z konwencją Vite/vitest. Uruchamia je `npm test`.

| Plik | Co testuje |
|---|---|
| `lib/format.test.ts` | Formatowanie liczb, czasów i kwot. |
| `components/AttackAlarm.test.ts` | Wybór i kolejność flot w alarmie. |
| `pages/wiki/wikiMath.test.ts` | Zgodność wzorów wiki z wartościami silnika. |

## 12. Oprawa graficzna i generatory

Oprawa jest w całości własna, generowana programowo:
- logo, tło i ikony surowców;
- 19 budynków, 14 badań, 13 statków, 10 obron i rakiet;
- 55 planet i księżyców.

Pliki leżą w `frontend/public/assets/art/<grupa>/`, a `manifest.json` mapuje na nie klucze:
- `logo`, `background`;
- `resource/<metal|crystal|tritium|energy>`;
- `building/<klucz>`, `research/<klucz>`, `ship/<klucz>`, `defense/<klucz>`;
- `planet/<hot|dry|normal|water|ice>/<1-10>`, `planet/default`.

Brak klucza w manifeście oznacza, że interfejs pokaże zaślepkę. Gotowe pliki są w repozytorium, więc do budowania
gry żaden generator nie jest potrzebny.

**Generator 3D** (`frontend/scripts/art3d`, three.js w Chromium bez okna, WebGL przez SwiftShader). Renderuje
budynki, badania, statki i obronę z materiałami PBR, miękkimi cieniami, ACES, bloomem i ziarnem, z nadpróbkowaniem
768 → 320 px do JPG:
```bash
cd frontend/scripts
CHROME_PATH=/usr/bin/chromium node art3d/render.mjs                               # wszystko
CHROME_PATH=/usr/bin/chromium node art3d/render.mjs --only=ships --keys=cruiser   # wybrane
CHROME_PATH=/usr/bin/chromium node art3d/render.mjs --only=research --out=/tmp/x  # podgląd poza grą
```

| Plik | Opis |
|---|---|
| `render.mjs` | Uruchamia Chromium, renderuje sceny, zapisuje pliki i aktualizuje manifest. |
| `render.html` | Strona-host dla three.js. |
| `lib3d.js` | Tekstury, materiały, geometria (`loft`), oświetlenie, tła, postprocessing. |
| `scenes.js` | Ujęcia: powierzchnia planety (budynki, obrona) i laboratorium (badania). |
| `ships3d.js`, `defense3d.js`, `buildings3d.js`, `research3d.js` | Modele. |

Sceny mają stałe ziarno, więc render jest powtarzalny. Jeden obraz zajmuje 1,5–7 s.

**Generator 2D** (`frontend/scripts/art`, SVG rasteryzowane przez Chromium):
```bash
cd frontend
CHROME_PATH=/usr/bin/chromium node scripts/art/generate.mjs                  # wszystko
CHROME_PATH=/usr/bin/chromium node scripts/art/generate.mjs --only=ui --sheet
```

| Plik | Opis |
|---|---|
| `generate.mjs` | Punkt wejścia i grupy (`planets`, `ui`). |
| `lib.mjs` | RNG mulberry32, szum, narzędzia SVG. |
| `planets.mjs` | Planety i księżyce (palety typów, szum terenu). |
| `ui.mjs` | Logo, tło, ikony surowców. |

## 13. Testy

```bash
cd backend && mvn test     # silnik, scenariusze (pamięć + PostgreSQL), API, symulacja botów
cd frontend && npm test    # vitest
```
Testy PostgreSQL wymagają bazy `spacepioneers_test`. Inną bazę wskazują `TEST_DB_URL`, `TEST_DB_USER`
i `TEST_DB_PASSWORD`.

**Backend (`backend/src/test/java/pl/spacepioneers`):**

| Grupa | Pliki |
|---|---|
| Silnik | `engine/EconomyTest`, `CombatEngineTest`, `FleetMathTest`, `RulesTest`, `AdvancedRulesTest`, `GameDataTest` |
| Scenariusze (pamięć) | `game/EconomyFlowTest`, `FleetFlowTest`, `SocialFlowTest`, `SocialExtrasFlowTest`, `AdvancedFlowTest`, `AccountAdminFlowTest`, `BoardFlowTest`, `ToolsFlowTest`, `SafeHtmlTest`. Wspólne środowisko to `GameFixture` (zegar sterowany, deterministyczny RNG). |
| Boty | `game/bot/BotSimulationTest`: 24 boty przez 16 dni, zero błędów tur, rozwój, szpiegowanie, ataki, uczenie, tempo zakładania kont. |
| PostgreSQL | `infra/Jdbc*FlowTest` uruchamiają te same scenariusze na prawdziwej bazie (`JdbcTestSupport` czyści schemat). `JdbcBotSimulationTest` sprawdza zapis `BotBrain` w JSONB. |
| API | `api/ApiIntegrationTest` (HTTP → bezpieczeństwo → logika → PostgreSQL), `AccountApiTest`, `SecurityLimitsTest`. Do tego `config/SpaForwardFilterTest`. |

**E2E (`frontend/e2e`, playwright-core + Chromium):**
```bash
# serwer w trybie szybkim (jak w CI):
FRONTEND_DIR=$PWD/frontend/dist MAIL_DEV_OUTBOX=true UNIVERSE_SPEED=2000 UNIVERSE_GALAXIES=1 UNIVERSE_SYSTEMS=3 \
  UNIVERSE_NEWBIE_POINTS=0 UNIVERSE_START_RESOURCES=1000000 RANKING_INTERVAL_MS=5000 \
  java -jar backend/target/space-pioneers-backend-*.jar
cd frontend && for t in gameplay advanced account social tools board; do CHROME_PATH=/usr/bin/chromium node e2e/$t.e2e.mjs; done
```

| Scenariusz | Zakres |
|---|---|
| `lib.mjs` | Wspólne narzędzia: start przeglądarki, rejestracja, `buildShips`, czekanie, asercje, zrzuty ekranu w `e2e-shots/`, błędy jako adnotacje `::error`. |
| `gameplay` | Dwóch graczy, budynki, badania, myśliwce, atak i raporty, sojusz, galaktyka, ranking (admin poza rankingiem). |
| `advanced` | Znajomi, ekspedycja, obrona sojusznicza, księżyc, falanga. |
| `account` | E-mail, reset hasła, zmiana adresu, usuwanie konta, blokada, pręgierz, ogłoszenie, dziennik. |
| `social` | Forum sojuszu, notatki, archiwum. |
| `tools` | Wyszukiwarka i symulator. |
| `board` | Publiczne forum gry. |

Cały pakiet trwa ok. minuty dzięki przyspieszeniu ×2000 i surowcom startowym. Wiki nie ma testu E2E (pilnuje jej
`wikiMath.test.ts`).

## 14. CI i automatyczne wdrażanie

`.github/workflows/ci.yml` uruchamia się na każdym PR i pushu do `main`:

| Job | Co robi |
|---|---|
| `backend` | `mvn -B test` na PostgreSQL 16 (service container). |
| `frontend` | `npm ci`, `npm test`, `npm run build`. |
| `docker` | Buduje obraz gry i obraz `deploy/backup`. |
| `e2e` | Build frontendu i jara, start szybkiego serwera, 6 scenariuszy. Zrzuty trafiają do artefaktu `e2e-shots`. |
| `deploy` | Tylko push na `main` po zielonych jobach: SSH na serwer i `deploy/deploy.sh`. |

Zasada pracy: zmiany na osobnych gałęziach, pull request do `main`, merge po zielonym CI. Merge automatycznie wdraża
grę na produkcję (ok. 5 min).

**`deploy/deploy.sh`** na serwerze:
1. Przerywa, jeśli ktoś ręcznie zmienił pliki z repozytorium.
2. Pobiera `main` (tylko fast-forward).
3. Robi kopię bazy, jeśli działa kontener `backup`.
4. Uruchamia `docker compose up -d --build`.
5. Czeka, aż gra odpowie. W razie porażki job jest czerwony i pokazuje ostatnie linie logów gry.

Pliki istniejące tylko na serwerze (`.env`, `docker-compose.override.yml`, `backups/`, `backup-config/`) nie są ruszane.
Ręcznie: `bash deploy/deploy.sh` w katalogu gry.

**Konfiguracja (jednorazowo).** Na serwerze tworzy się klucz, który pozwala wyłącznie uruchomić aktualizację
(wymuszona komenda):
```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N "" -C "github-deploy"
echo "command=\"cd $HOME/space_pioneers_remaster && bash deploy/deploy.sh\",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty $(cat ~/.ssh/github_deploy.pub)" >> ~/.ssh/authorized_keys
base64 -w0 ~/.ssh/github_deploy; echo   # → sekret DEPLOY_SSH_KEY
ssh-keyscan 149.56.209.82 2>/dev/null   # → sekret DEPLOY_KNOWN_HOSTS
```
Sekrety GitHuba (Settings → Secrets and variables → Actions):

| Sekret | Wartość |
|---|---|
| `DEPLOY_SSH_KEY` | Klucz prywatny jako jedna linia base64. Cały plik PEM z liniami BEGIN/END też działa. |
| `DEPLOY_HOST` | `149.56.209.82` |
| `DEPLOY_USER` | `ubuntu` |
| `DEPLOY_PATH` | `/home/ubuntu/space_pioneers_remaster` |
| `DEPLOY_KNOWN_HOSTS` | wynik `ssh-keyscan` |

Bez `DEPLOY_SSH_KEY` job `deploy` tylko wypisuje informację. Żeby wyłączyć auto-deploy, usuń ten sekret.

**Gdy deploy jest czerwony:**
- Porównaj odcisk klucza z adnotacji joba z wynikiem `ssh-keygen -lf ~/.ssh/github_deploy.pub` na serwerze.
- Sprawdź `sudo journalctl -u ssh --since "15 min ago"`.
- Komunikat „nie jest poprawnym kluczem” oznacza ucięty sekret. Wklej go ponownie jako jedną linię base64.

## 15. Konfiguracja (zmienne środowiskowe)

Zmienne są mapowane w `application.yml`, a na serwerze ustawiane w `.env` (czyta go `docker-compose.yml`).

| Zmienna | Domyślnie | Znaczenie |
|---|---|---|
| `DB_URL`, `DB_USER`, `DB_PASSWORD` | lokalny `spacepioneers` | połączenie z bazą |
| `PORT` | 8080 | port HTTP |
| `FRONTEND_DIR` | `../frontend/dist` | katalog zbudowanego frontendu (poza jarem) |
| `PUBLIC_URL` | `http://localhost:8080` | adres gry w linkach z e-maili |
| `UNIVERSE_NAME` | Uniwersum 1 | nazwa galaktyki |
| `UNIVERSE_SPEED` | 1 | prędkość (produkcja, czasy, loty) |
| `UNIVERSE_GALAXIES`, `UNIVERSE_SYSTEMS` | 5, 200 | rozmiar świata (15 pozycji w układzie) |
| `UNIVERSE_NEWBIE_POINTS` | 5000 | próg ochrony początkujących |
| `UNIVERSE_START_RESOURCES` | (puste) | tylko testy: surowce startowe |
| `RANKING_INTERVAL_MS` | 300000 | co ile przeliczać ranking |
| `INACTIVE_DELETE_DAYS` | 0 | usuwanie nieaktywnych kont (0 = wyłączone) |
| `RATE_LIMIT_ENABLED` | true | limity zapytań |
| `RATE_LIMIT_AUTH_PER_MINUTE` | 20 | logowanie, rejestracja i reset na IP |
| `RATE_LIMIT_API_PER_MINUTE`, `RATE_LIMIT_API_BURST` | 600, 120 | API na sesję |
| `SERVER_FORWARD_HEADERS_STRATEGY` | — | `native` za proxy (Caddy) |
| `MAIL_FROM` | `no-reply@spacepioneers.local` | nadawca |
| `SPRING_MAIL_HOST`, `_PORT`, `_USERNAME`, `_PASSWORD`, `SPRING_MAIL_PROPERTIES_*` | — | SMTP (bez tego poczta trafia do logu) |
| `MAIL_DEV_OUTBOX` | false | tylko testy: `/api/dev/outbox` |
| `LEGAL_OPERATOR`, `LEGAL_ADDRESS`, `LEGAL_EMAIL` | (puste) | dane administratora w regulaminie |
| `BOTS_ENABLED`, `BOTS_TARGET`, `BOTS_PER_WEEK`, `BOTS_TURNS_PER_TICK` | false, 50, 5, 8 | boty |
| `BACKUP_*` | zob. [§16](#16-kopie-zapasowe) | kopie zapasowe |

Po zmianie `.env` uruchom `docker compose up -d`, co odtwarza kontenery ze zmienionymi zmiennymi.

## 16. Kopie zapasowe

Kontener `backup` (`deploy/backup`: `Dockerfile`, `entrypoint.sh`, `backup.sh`, `restore.sh`, `rclone.conf.example`)
robi kopię przy starcie i codziennie o `BACKUP_HOUR` (czas polski):
1. `pg_dump` do `.dump` (format custom, skompresowany).
2. Weryfikacja `pg_restore --list`. Uszkodzona kopia nie zastąpi dobrych.
3. Na serwerze w `./backups/` zostaje 7 dziennych i 4 niedzielne kopie.
4. Opcjonalnie kopia jest wysyłana poza serwer przez rclone (`BACKUP_REMOTE`). Tam dzienne żyją `BACKUP_REMOTE_DAYS`
   dni, a tygodniowe 4 razy dłużej.

Nieudana kopia jest ponawiana po godzinie. Znacznik ostatniej udanej kopii: `backups/last-success`.

| Zmienna | Domyślnie | Znaczenie |
|---|---|---|
| `BACKUP_REMOTE` | (puste) | cel rclone, np. `ovh:spacepioneers-kopie` (puste = tylko lokalnie) |
| `BACKUP_HOUR` | 4 | godzina kopii |
| `BACKUP_KEEP_DAILY` / `BACKUP_KEEP_WEEKLY` | 7 / 4 | ile kopii trzymać lokalnie |
| `BACKUP_REMOTE_DAYS` | 30 | retencja w chmurze |

Kopia poza serwerem (np. OVH Object Storage S3 w innym regionie):
```bash
mkdir -p backup-config && cp deploy/backup/rclone.conf.example backup-config/rclone.conf
nano backup-config/rclone.conf && chmod 600 backup-config/rclone.conf
echo 'BACKUP_REMOTE=ovh:spacepioneers-kopie' >> .env
docker compose up -d --build backup && docker compose logs -f backup
```
Ręczna kopia: `docker compose run --rm backup backup.sh`.

Odtworzenie zastępuje całą bazę i działa w jednej transakcji:
```bash
docker compose stop game
docker compose run --rm backup restore.sh /backups/daily/spacepioneers_2026-10-30_0400.dump
docker compose start game
```

## 17. Poczta i dokumenty prawne

- **Poczta:** konto OVH Zimbra `kontakt@spacepioneers.pl`, SMTP `smtp.mail.ovh.net:465` (SSL). Ustawienia są w `.env`
  na serwerze (`SPRING_MAIL_HOST`, `SPRING_MAIL_PORT=465`, `SPRING_MAIL_PROPERTIES_MAIL_SMTP_SSL_ENABLE=true`,
  `MAIL_FROM`, `PUBLIC_URL=https://spacepioneers.pl`). Bez poprawnego `PUBLIC_URL` linki w e-mailach prowadzą
  na localhost.
- **Regulamin i polityka prywatności:** treść jest w `frontend/src/pages/legal/LegalPages.tsx`, a dane administratora
  pochodzą z `LEGAL_*`. Rejestracja wymaga akceptacji. Po podniesieniu `PlayerService.TERMS_VERSION` (obecnie 2)
  każdy gracz przy wejściu zobaczy `TermsGate` i musi zaakceptować nową wersję (`POST /api/me/terms`).
  Eksport danych (`GET /api/me/export`) realizuje prawo dostępu i przenoszenia danych.

## 18. Wydajność

`loadtest/load.mjs` (Node 18+, bez zależności): N graczy rejestruje się i w pętli pobiera przegląd, budynki,
badania, galaktykę, wiadomości, floty i ranking, a do tego zleca rozbudowę.
```bash
RATE_LIMIT_AUTH_PER_MINUTE=100000 RATE_LIMIT_API_PER_MINUTE=1000000 RATE_LIMIT_API_BURST=100000 \
  UNIVERSE_SPEED=100 UNIVERSE_GALAXIES=2 UNIVERSE_SYSTEMS=50 java -jar backend/target/space-pioneers-backend-*.jar
node loadtest/load.mjs 100 60                             # 100 graczy bez przerw, 60 s
node loadtest/load.mjs 300 60 http://localhost:8080 1000  # 300 graczy, 1 s przerwy
```

Wyniki z 29.10.2026 (2 vCPU, 7 GB RAM; gra, PostgreSQL i generator obciążenia na jednej maszynie):

| Scenariusz | Zapytań/s | Błędy | p50 | p95 | p99 |
|---|---|---|---|---|---|
| 1 gracz, bez przerw | 305 | 0 | 2,7 ms | 6,4 ms | 11 ms |
| 100 graczy, bez przerw | 357 | 0 | 190 ms | 663 ms | 1,3 s |
| 300 graczy, 1 s przerwy | 339 | 0 | 417 ms | 1,3 s | 16 s* |

\* p99 zawyżają rejestracje (BCrypt) wykonane naraz. Zwykłe zapytania mają p99 1,4–3 s.

Około 350 zapytań/s ogranicza procesor. Taka maszyna obsłuży rzędu 1000–1500 jednocześnie aktywnych graczy.
Następny krok skalowania to podział globalnej blokady zapisu na układy lub graczy.

## 19. Znane ograniczenia

- Liczby i formuły są rekonstrukcją (brak dostępu do oryginalnych tabel). Wszystkie da się podmienić w `gamedata/*.json`.
- Grafika jest własna, nie oryginalna.
- Rejestracja nie ma CAPTCHA. Chroni ją limit 20 prób na minutę na IP.
- Interfejs jest tylko po polsku. Angielskie tłumaczenie jest częściowe i nieużywane.
- Jest jedna globalna blokada zapisu, a limity API liczą się osobno na każdej instancji.
- Nie ma funkcji płatnych ani premium.
- Odłożone na później: utwardzenie SSH (logowanie hasłem) i kopia poza serwerem (OVH Object Storage).
