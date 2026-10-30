#!/bin/bash
# Aktualizacja gry na serwerze: pobranie maina, kopia bazy, przebudowa kontenerow, sprawdzenie, ze gra wstala.
# Uruchamiane automatycznie z GitHub Actions po zielonym CI na mainie (docs/DEPLOY.md), mozna tez recznie:
#   bash deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

log() { echo "[deploy $(date '+%H:%M:%S')] $*"; }

# lokalnych zmian w plikach z repozytorium nie nadpisujemy - trzeba je najpierw ogarnac recznie
if ! git diff --quiet || ! git diff --cached --quiet; then
  log "Na serwerze sa niezacommitowane zmiany w plikach repozytorium - przerywam:"
  git status --short
  exit 1
fi

before="$(git rev-parse --short HEAD)"
git fetch --quiet origin main
git merge --ff-only --quiet origin/main
after="$(git rev-parse --short HEAD)"
log "kod: $before -> $after"
git log --oneline "$before..$after" | sed 's/^/    /' || true

# kopia bazy przed aktualizacja (jesli dziala kontener kopii) - migracje bazy sa nieodwracalne
if docker compose ps --services --status running 2>/dev/null | grep -qx backup; then
  log "kopia bazy przed aktualizacja"
  docker compose exec -T backup backup.sh
fi

log "przebudowa i restart kontenerow"
docker compose up -d --build --remove-orphans

log "czekam, az gra wstanie"
# port 8080 na serwerze albo publiczny adres przez Caddy (PUBLIC_URL z .env)
public="$(grep -E '^PUBLIC_URL=' .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' || true)"
up() {
  curl -fsS --max-time 3 http://localhost:8080/api/stats > /dev/null 2>&1 \
    || { [ -n "$public" ] && curl -fsS --max-time 5 "$public/api/stats" > /dev/null 2>&1; }
}
sleep 5
for i in $(seq 1 90); do
  if up; then
    log "gra dziala ($after)"
    docker image prune -f > /dev/null 2>&1 || true
    exit 0
  fi
  sleep 2
done

log "BLAD: gra nie odpowiada po 3 minutach. Ostatnie logi:"
docker compose logs --tail=80 game
exit 1
