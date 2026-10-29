# Test obciążeniowy

Skrypt: `loadtest/load.mjs` (Node 18+, bez zależności). Każdy wirtualny gracz rejestruje się, a potem w pętli
pobiera przegląd planety, budynki, badania, galaktykę, wiadomości, stan floty, co piąty obieg ranking,
i zleca rozbudowę budynku (odrzucenia przez reguły gry, np. brak surowców, są poprawnymi odpowiedziami).

```bash
RATE_LIMIT_AUTH_PER_MINUTE=100000 RATE_LIMIT_API_PER_MINUTE=1000000 RATE_LIMIT_API_BURST=100000 \
  UNIVERSE_SPEED=100 UNIVERSE_GALAXIES=2 UNIVERSE_SYSTEMS=50 java -jar backend/target/space-pioneers-backend-*.jar
node loadtest/load.mjs 100 60                            # 100 graczy bez przerw, 60 s
node loadtest/load.mjs 300 60 http://localhost:8080 1000 # 300 graczy, 1 s przerwy po każdym obiegu
```

## Wyniki (29.10.2026)

Maszyna: 2 vCPU, 7 GB RAM; serwer gry, PostgreSQL 16 i generator obciążenia na tej samej maszynie
(generator sam zużywa ok. 1/3 procesora). Java 21, wątki wirtualne.

| Scenariusz | Zapytań/s | Błędy | p50 | p95 | p99 |
|---|---|---|---|---|---|
| 1 gracz, bez przerw (czas obsługi) | 305 | 0 | 2,7 ms | 6,4 ms | 11 ms |
| 100 graczy, bez przerw | 357 | 0 | 190 ms | 663 ms | 1,3 s |
| 300 graczy, 1 s przerwy | 339 | 0 | 417 ms | 1,3 s | 16 s* |

\* p99 zawyżają rejestracje (BCrypt) wykonywane wszystkie naraz na początku testu; zwykłe zapytania mają p99 1,4–3 s.

Wnioski:
- Brak błędów i utraty danych przy pełnym nasyceniu procesora; przepustowość ~350 zapytań/s ogranicza
  tu procesor (Java ok. 55%, PostgreSQL ok. 70%, generator ok. 65% z 200%).
- Zwykły gracz wysyła średnio jedno zapytanie co kilka sekund (odświeżanie widoku), więc taka maszyna
  obsłuży rzędu 1000–1500 jednocześnie aktywnych graczy z odpowiedziami poniżej sekundy.
- Zapisy są serializowane jedną blokadą doradczą PostgreSQL (spójność zdarzeń czasowych). Odczyty
  bez zaległych zdarzeń (galaktyka, ranking, wiadomości, sojusz, znajomi, notatki) idą bez blokady.

## Skalowanie dalej
- Silniejszy serwer bazy i serwera gry (zysk prawie liniowy do wysycenia jednej blokady zapisu, ~2–3 ms na zapis).
- Kilka instancji serwera za load balancerem działa poprawnie (blokada i limity logowania są w bazie),
  ale limity zapytań API liczone są na instancję.
- Dalszy krok: podział blokady na układy/graczy zamiast jednej globalnej.
