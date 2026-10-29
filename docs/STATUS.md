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

## Braki (dokładna lista)

1. **Oryginalna oprawa graficzna** — mechanizm manifestu gotowy, ale grafik nie wgrano (brak plików); do tego
   czasu widoczne są oznaczone zaślepki. Układ (nagłówek, menu po lewej, pasek surowców, tabele) jest
   stylizacją klasycznego interfejsu, nie odwzorowaniem 1:1 — bez materiałów referencyjnych nie da się
   zweryfikować zgodności „95%”.
2. **Liczby i nazwy** — rekonstrukcja (patrz `GAME_RULES.md`); do podmiany oryginalnymi tabelami.
3. **Brak funkcji spotykanych w grach tego typu, niezaimplementowanych:** księżyce i falanga, rakiety
   międzyplanetarne, ataki sojusznicze (ACS) i obrona sojusznicza (zatrzymanie floty), rapid fire, ekspedycje,
   historia/archiwum raportów poza skrzynką, forum sojuszu, notatki, lista znajomych.
4. **Konto:** brak weryfikacji e-mail, resetu hasła przez e-mail (wymaga serwera SMTP), usuwania konta,
   panelu administratora (pierwszy gracz ma tylko flagę `admin`) i systemu kar/blokad.
5. **Języki:** pełny PL; EN — nazwy i część interfejsu (reszta PL); brak DE/FR/IT/ES.
6. **Skalowanie:** zmiany stanu świata są serializowane jedną blokadą — wystarczy dla setek graczy online,
   ale nie dla tysięcy; ranking przeliczany całościowo co 5 min.
7. **Bezpieczeństwo:** blokada logowania trzymana w pamięci instancji; brak limitów zapytań API i CAPTCHA.
