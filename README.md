# Space Pioneers Remaster

Przeglądarkowa gra MMO odtwarzająca klasyczne **Space Pioneers** (2004–2017).

## Struktura

| Katalog | Zawartość |
|---|---|
| `backend/` | Spring Boot 3 (Java 21) — API, silnik reguł gry, harmonogram zdarzeń |
| `backend/src/main/java/pl/spacepioneers/engine` | Czysty silnik reguł (bez Springa) — ekonomia, kolejki, walka, ruch flot |
| `backend/src/main/resources/gamedata` | Dane gry (budynki, badania, statki, obrona) — sterują silnikiem |
| `backend/src/main/resources/db/migration` | Migracje Flyway dla PostgreSQL |
| `frontend/` | React + TypeScript + Vite — interfejs gry |
| `frontend/public/assets/original` | Miejsce na licencjonowane oryginalne grafiki (patrz `docs/ASSETS.md`) |
| `docs/` | Dokumentacja projektu, reguł i stanu prac |

## Wymagania

- Java 21, Maven 3.9+
- Node.js 20+
- PostgreSQL 15+

## Uruchomienie lokalne

```bash
# baza
createdb -U postgres spacepioneers

# backend (port 8080)
cd backend && mvn spring-boot:run

# frontend (port 5173, proxy /api -> 8080)
cd frontend && npm install && npm run dev
```

Szczegóły i stan prac: [`docs/STATUS.md`](docs/STATUS.md).
