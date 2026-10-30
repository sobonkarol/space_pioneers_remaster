#!/bin/bash
# Odtworzenie bazy z kopii. UWAGA: zastepuje cala obecna zawartosc bazy.
#   docker compose stop game
#   docker compose run --rm backup restore.sh /backups/daily/spacepioneers_2026-10-30_0400.dump
#   (albo z chmury: restore.sh ovh:spacepioneers-kopie/daily/spacepioneers_2026-10-30_0400.dump)
#   docker compose start game
set -euo pipefail
src="${1:?Podaj plik kopii (sciezka lokalna albo zdalna rclone)}"
DB="${PGDATABASE:-spacepioneers}"
if [[ "$src" == *:* && ! -f "$src" ]]; then
  echo "Pobieram $src"
  rclone copyto "$src" /tmp/restore.dump
  src=/tmp/restore.dump
fi
pg_restore --list "$src" > /dev/null
echo "Odtwarzam $DB z $src (obecne dane zostana zastapione)"
pg_restore --clean --if-exists --no-owner --single-transaction --dbname="$DB" "$src"
echo "Gotowe. Uruchom gre: docker compose start game"
