# Stan prac

## Gotowe i przetestowane

| Obszar | Zakres | Testy |
|---|---|---|
| Silnik reguł | ekonomia, energia, magazyny, czasy, drzewo technologii, floty, walka z szybkimi działami, szpiegostwo, rynek, punkty, rakiety, księżyce, ekspedycje | jednostkowe |
| Logika gry | kolejki budowy/badań/stoczni; misje: atak, transport, stacjonowanie, kolonizacja, recykling, szpiegostwo, obrona sojusznicza, ekspedycja, atak rakietowy; ataki sojusznicze (do 8 flot), zawracanie; księżyce z bazą, falangą i teleporterem; urlop, specjalizacje, sojusze i dyplomacja, znajomi, ranking, wiadomości z archiwum, notatki, forum sojuszu, wyszukiwarka, symulator walki | scenariusze w pamięci **i na PostgreSQL** |
| Konto i administracja | potwierdzanie e-mail, reset hasła, zmiana adresu, usuwanie konta po 7 dniach, panel administratora (statystyki, gracze, blokady, uprawnienia, ogłoszenia, dziennik), pręgierz | scenariusze + API |
| Backend | Spring Boot 3.4, Java 21, Flyway (V1–V5), JSONB, blokada doradcza dla zapisów, odczyty bez blokady, harmonogram zdarzeń, sesje tokenowe (SHA-256), BCrypt, trwała blokada logowania, limity zapytań, SMTP | MockMvc + PostgreSQL |
| Frontend | React 19 + TypeScript: wszystkie widoki gry, panel administratora, strony bez logowania (potwierdzenie e-mail, nowe hasło, pręgierz); wersja polska | vitest + 5 scenariuszy E2E w przeglądarce |
| Oprawa | własne logo, tło, ikony, grafiki 19 budynków, 14 badań, 13 statków, 10 obron i rakiet, 55 planet i księżyców — generowane programowo (`docs/ASSETS.md`) | podgląd w E2E |
| Wdrożenie | Dockerfile, docker-compose, CI w GitHub Actions: testy backendu na PostgreSQL, testy i build frontendu, budowa obrazu Dockera, E2E | CI zielone na każdym PR |
| Wydajność | `loadtest/load.mjs`, wyniki w `docs/LOADTEST.md` | ~350 zapytań/s bez błędów na 2 vCPU |

Testy: `mvn test` — 187 testów (silnik, scenariusze w pamięci i te same scenariusze na PostgreSQL, API).
Scenariusze E2E w przeglądarce (`frontend/e2e/`), wszystkie bez błędów JS:
- `gameplay` — rejestracja dwóch graczy, rozbudowa 11 poziomów budynków, 2 badania, budowa myśliwców, atak,
  raport walki u obu stron, sojusz z przyjęciem członka, galaktyka, ranking;
- `advanced` — znajomi, ekspedycja z galaktyki (reguła astrofizyki), obrona sojusznicza ze stacjonowaniem
  i zawróceniem, księżyc w galaktyce i na liście planet, zabudowa księżyca, falanga;
- `account` (serwer z `MAIL_DEV_OUTBOX=true`) — potwierdzenie e-mail linkiem, reset hasła, zmiana adresu,
  zaplanowanie i anulowanie usunięcia konta, blokada z panelu, odrzucone logowanie z powodem, pręgierz,
  zdjęcie blokady, ogłoszenie, dziennik;
- `social` — forum sojuszu (wątek, odpowiedź, licznik nowych wpisów, przypięcie, zamknięcie, edycja), notatki,
  archiwum wiadomości;
- `tools` — wyszukiwarka i symulator walki;
- `overview` — aktualne działania na przeglądzie: budowa z kolejką, badanie, stocznia, budowy na innych planetach,
  paski postępu.

## Braki i ograniczenia (dokładna lista)

1. **Zgodność z oryginałem.** Nie miałem dostępu do oryginalnych tabel ani zrzutów ekranu Space Pioneers
   (archiwa i wiki były niedostępne), więc liczby, formuły i nazwy są rekonstrukcją w duchu gry
   (`GAME_RULES.md`), a wygląd — stylizacją klasycznego interfejsu, nie odwzorowaniem 1:1. Zgodności „95%”
   nie da się zweryfikować bez materiałów referencyjnych. Wszystkie liczby siedzą w `backend/src/main/resources/gamedata/*.json`,
   więc podmiana na oryginalne wartości nie wymaga zmian w kodzie.
2. **Grafika** jest własna i generowana programowo (SVG → PNG), zgodnie z decyzją; nie są to oryginalne
   rysunki z gry.
3. **Poczta** wychodzi dopiero po skonfigurowaniu serwera SMTP (`SPRING_MAIL_HOST` i in.); bez niego linki
   z wiadomości trafiają do dziennika serwera. Wysyłki do prawdziwej skrzynki nie dało się sprawdzić w tym środowisku.
4. **Brak CAPTCHA** przy rejestracji — przed masowym zakładaniem kont chroni limit 20 prób na minutę na adres IP.
5. **Język**: tylko polski (zgodnie z decyzją). Częściowe angielskie tłumaczenie zostało w kodzie, nieużywane.
6. **Skalowanie**: wszystkie zapisy przechodzą przez jedną blokadę bazy; wystarcza to na rzędu 1000–1500
   aktywnych graczy na maszynie 2 vCPU (`docs/LOADTEST.md`). Limity zapytań API są liczone osobno na każdą
   instancję serwera. Ranking przeliczany jest co 5 minut.
7. **Docker**: obraz buduje się w CI (GitHub Actions); lokalnie nie było demona Dockera, więc `docker compose up`
   nie był uruchamiany w tym środowisku.
8. **Funkcje płatne / premium** (np. oficerowie, waluta premium) nie są zaimplementowane.
