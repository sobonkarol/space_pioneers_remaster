#!/bin/bash
# Jedna kopia zapasowa: zrzut bazy, sprawdzenie pliku, rotacja lokalna, wysylka poza serwer.
#
# Zmienne:
#   PGHOST, PGUSER, PGPASSWORD, PGDATABASE  - polaczenie z baza
#   BACKUP_DIR        katalog lokalny (domyslnie /backups)
#   BACKUP_KEEP_DAILY ile dziennych kopii trzymac lokalnie (7)
#   BACKUP_KEEP_WEEKLY ile niedzielnych kopii trzymac lokalnie (4)
#   BACKUP_REMOTE     cel rclone, np. ovh:spacepioneers-kopie (puste = tylko lokalnie)
#   BACKUP_REMOTE_DAYS po ilu dniach usuwac kopie w zdalnym miejscu (30)
set -euo pipefail

DIR="${BACKUP_DIR:-/backups}"
KEEP_DAILY="${BACKUP_KEEP_DAILY:-7}"
KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-4}"
REMOTE="${BACKUP_REMOTE:-}"
REMOTE_DAYS="${BACKUP_REMOTE_DAYS:-30}"
DB="${PGDATABASE:-spacepioneers}"

log() { echo "[kopia $(date '+%Y-%m-%d %H:%M:%S')] $*"; }

mkdir -p "$DIR/daily" "$DIR/weekly"
stamp="$(date +%Y-%m-%d_%H%M)"
file="$DIR/daily/${DB}_${stamp}.dump"
tmp="$file.part"
# nieudany zrzut nie zostawia smieci
trap 'rm -f "$tmp"' EXIT
rm -f "$DIR"/daily/*.part

log "zrzut bazy $DB"
pg_dump --format=custom --compress=9 --no-owner --file="$tmp" "$DB"
# plik musi dac sie odczytac - inaczej to nie jest kopia
pg_restore --list "$tmp" > /dev/null
mv "$tmp" "$file"
size="$(du -h "$file" | cut -f1)"
log "zapisano $file ($size)"

# niedzielna kopia trafia tez do tygodniowych
if [ "$(date +%u)" = "7" ]; then
  cp "$file" "$DIR/weekly/"
  log "kopia tygodniowa"
fi

rotate() { # katalog, ile zostawic
  local old
  # najnowsze najpierw (nazwy zawieraja date), wszystko ponad limit do usuniecia
  find "$1" -maxdepth 1 -name '*.dump' | sort -r | tail -n +"$(( $2 + 1 ))" | while read -r old; do
    rm -f "$old"
    log "usunieto stara kopie $(basename "$old")"
  done
}
rotate "$DIR/daily" "$KEEP_DAILY"
rotate "$DIR/weekly" "$KEEP_WEEKLY"

if [ -n "$REMOTE" ]; then
  log "wysylka do $REMOTE"
  rclone copy "$file" "$REMOTE/daily/" --no-traverse
  if [ "$(date +%u)" = "7" ]; then rclone copy "$file" "$REMOTE/weekly/" --no-traverse; fi
  # w zdalnym miejscu dzienne kopie zyja REMOTE_DAYS dni, tygodniowe 4x dluzej
  prune() { # katalog zdalny, wiek
    if rclone lsf "$1" > /dev/null 2>&1; then rclone delete "$1" --min-age "$2" || log "nie udalo sie usunac starych kopii w $1"; fi
  }
  prune "$REMOTE/daily/" "${REMOTE_DAYS}d"
  prune "$REMOTE/weekly/" "$(( REMOTE_DAYS * 4 ))d"
  log "wyslano"
else
  log "BACKUP_REMOTE nie ustawiony - kopia tylko na tym serwerze"
fi

date '+%Y-%m-%d %H:%M:%S' > "$DIR/last-success"
log "gotowe"
