#!/bin/bash
# Petla kontenera kopii: kopia przy starcie, potem codziennie o BACKUP_HOUR (czas TZ, domyslnie 4:00 Europe/Warsaw).
set -uo pipefail
export TZ="${TZ:-Europe/Warsaw}"
HOUR="${BACKUP_HOUR:-4}"

# reczne polecenia: docker compose run --rm backup backup.sh | restore.sh <plik>
if [ $# -gt 0 ]; then exec "$@"; fi

run() {
  if ! backup.sh; then
    echo "[kopia $(date '+%Y-%m-%d %H:%M:%S')] BLAD - kopia nie powstala, ponowna proba za godzine"
    sleep 3600
    backup.sh || echo "[kopia $(date '+%Y-%m-%d %H:%M:%S')] BLAD - druga proba tez nieudana"
  fi
}

until pg_isready -q; do sleep 2; done
[ "${BACKUP_ON_START:-true}" = "true" ] && run

while true; do
  now=$(date +%s)
  next=$(date -d "today ${HOUR}:00" +%s)
  [ "$next" -le "$now" ] && next=$(date -d "tomorrow ${HOUR}:00" +%s)
  echo "[kopia] nastepna kopia: $(date -d "@$next" '+%Y-%m-%d %H:%M')"
  sleep $(( next - now ))
  run
done
