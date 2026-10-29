# Stan prac

## Gotowe i przetestowane

| Obszar | Zakres | Testy |
|---|---|---|
| Silnik reguł | ekonomia, energia, magazyny, czasy, drzewo technologii, floty, walka, szpiegostwo, rynek, punkty | jednostkowe |
| Logika gry | kolejki budowy/badań/stoczni, 6 misji flot, zawracanie, kolonizacja, recykling, urlop, specjalizacje, sojusze i dyplomacja, ranking, wiadomości | scenariusze w pamięci **i na PostgreSQL** |
| Backend | Spring Boot 3.4, Flyway, JSONB, blokada doradcza, harmonogram zdarzeń, sesje tokenowe, BCrypt, blokada logowania, API REST | MockMvc + PostgreSQL |
| Frontend | React + TS: logowanie, przegląd, surowce, budynki, badania, stocznia, obrona, flota, galaktyka, imperium, technologie, wiadomości z raportami, sojusz, ranking, rynek, ustawienia, pomoc; PL i EN | vitest + E2E w przeglądarce |
| Wdrożenie | Dockerfile, docker-compose, CI (GitHub Actions) | — |

E2E (`frontend/e2e/gameplay.e2e.mjs`) przechodzi przez interfejs pełną ścieżkę: rejestracja dwóch graczy,
rozbudowa 11 poziomów budynków, 2 badania, budowa myśliwców w stoczni, atak, raport walki u obu stron,
założenie sojuszu i przyjęcie członka, galaktyka, ranking — bez błędów JS.
`frontend/e2e/advanced.e2e.mjs`: lista znajomych, ekspedycja z galaktyki (reguła astrofizyki), obrona
sojusznicza ze stacjonowaniem i zawróceniem, księżyc w galaktyce i na liście planet, zabudowa księżyca, falanga.
`frontend/e2e/account.e2e.mjs` (serwer z `MAIL_DEV_OUTBOX=true`): potwierdzenie e-mail linkiem, reset hasła,
zmiana adresu, zaplanowanie i anulowanie usunięcia konta, panel administratora: blokada, odrzucone logowanie
z powodem, pręgierz, zdjęcie blokady, ogłoszenie, dziennik.
`frontend/e2e/social.e2e.mjs`: forum sojuszu (wątek, odpowiedź, licznik nowych wpisów, przypięcie, zamknięcie,
edycja), notatki, archiwum wiadomości i usuwanie wszystkich z zachowaniem archiwum.

## Braki (dokładna lista)

1. **Oryginalna oprawa graficzna** — mechanizm manifestu gotowy, ale grafik nie wgrano (brak plików); do tego
   czasu widoczne są oznaczone zaślepki. Układ (nagłówek, menu po lewej, pasek surowców, tabele) jest
   stylizacją klasycznego interfejsu, nie odwzorowaniem 1:1 — bez materiałów referencyjnych nie da się
   zweryfikować zgodności „95%”.
2. **Liczby i nazwy** — rekonstrukcja (patrz `GAME_RULES.md`); do podmiany oryginalnymi tabelami.
4. **Konto:** poczta wysyłana przez SMTP dopiero po ustawieniu `SPRING_MAIL_HOST` (bez niego linki trafiają do
   dziennika serwera); brak CAPTCHA przy rejestracji; konta nieaktywne nie są usuwane automatycznie.
5. **Języki:** gra jest wyłącznie po polsku (zgodnie z decyzją; przełącznik języka usunięty, częściowe
   tłumaczenie EN pozostało w kodzie nieużywane).
6. **Skalowanie:** zmiany stanu świata są serializowane jedną blokadą — wystarczy dla setek graczy online,
   ale nie dla tysięcy; ranking przeliczany całościowo co 5 min.
7. **Bezpieczeństwo:** blokada logowania trzymana w pamięci instancji; brak limitów zapytań API i CAPTCHA.
