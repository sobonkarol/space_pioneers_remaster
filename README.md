# Space Pioneers Remaster

Przeglądarkowa gra MMO odtwarzająca klasyczne **Space Pioneers** (2004–2017): ekonomia, budynki, badania,
floty, walki, galaktyka, kolonizacja, sojusze i rankingi.

## Struktura

| Katalog | Zawartość |
|---|---|
| `backend/` | Spring Boot 3 (Java 21) + PostgreSQL |
| `backend/.../engine` | czysty silnik reguł (bez Springa) |
| `backend/.../game` | logika rozgrywki (bez Springa), port `GameStore` |
| `backend/.../infra`, `api`, `security`, `config` | PostgreSQL, REST, uwierzytelnianie, harmonogram |
| `backend/src/main/resources/gamedata` | dane gry (JSON) |
| `frontend/` | React + TypeScript + Vite |
| `frontend/public/assets/original` | licencjonowane grafiki (patrz `docs/ASSETS.md`) |
| `docs/` | zasady (`GAME_RULES.md`), grafiki (`ASSETS.md`), stan prac i braki (`STATUS.md`) |

## Uruchomienie

### Docker
```bash
DB_PASSWORD=sekret docker compose up --build
# http://localhost:8080
```

### Lokalnie
```bash
createdb spacepioneers && createdb spacepioneers_test
cd frontend && npm install && npm run build && cd ..
cd backend && FRONTEND_DIR=../frontend/dist mvn spring-boot:run
# albo tryb deweloperski frontendu: cd frontend && npm run dev  (http://localhost:5173, proxy /api)
```

Ustawienia galaktyki (zmienne środowiskowe): `UNIVERSE_NAME`, `UNIVERSE_SPEED`, `UNIVERSE_GALAXIES`,
`UNIVERSE_SYSTEMS`, `UNIVERSE_NEWBIE_POINTS`; baza: `DB_URL`, `DB_USER`, `DB_PASSWORD`.
Pierwszy zarejestrowany gracz otrzymuje flagę administratora.

## Testy

```bash
cd backend && mvn test          # silnik, scenariusze (pamięć + PostgreSQL), API
cd frontend && npm test         # testy jednostkowe
# E2E w przeglądarce (szybka galaktyka, patrz nagłówek pliku):
cd frontend && CHROME_PATH=/usr/bin/chromium node e2e/gameplay.e2e.mjs
```

Stan prac i lista braków: [`docs/STATUS.md`](docs/STATUS.md).
