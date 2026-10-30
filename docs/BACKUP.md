# Kopie zapasowe bazy

Kontener `backup` (docker-compose) robi kopię bazy **przy starcie i codziennie o 4:00** (czas polski):

1. `pg_dump` całej bazy do pliku `.dump` (format PostgreSQL, skompresowany);
2. sprawdza, czy plik da się odczytać (`pg_restore --list`), uszkodzony nie zastąpi dobrych kopii;
3. trzyma na serwerze w `./backups/` **7 ostatnich dziennych i 4 niedzielne** kopie;
4. wysyła kopię **poza serwer** przez [rclone](https://rclone.org) (`BACKUP_REMOTE`), gdzie dzienne żyją 30 dni,
   a tygodniowe 120 dni.

Nieudana kopia jest ponawiana po godzinie. Ostatnia udana kopia: `backups/last-success`.

## Uruchomienie na serwerze (OVHcloud Object Storage)

Kopia trzymana na tym samym VPS-ie nie chroni przed jego awarią, dlatego wysyłamy ją do Object Storage w innym
regionie niż serwer gry (gra stoi w Kanadzie, kopie np. w Warszawie). Przy bazie tej wielkości koszt to grosze miesięcznie.

1. W panelu OVHcloud: **Public Cloud → Object Storage** utwórz kontener S3 (np. `spacepioneers-kopie`, region
   `WAW`) i użytkownika Object Storage z prawem zapisu. Zapisz jego *access key* i *secret key*.
2. Na serwerze, w katalogu gry:
   ```bash
   mkdir -p backup-config
   cp deploy/backup/rclone.conf.example backup-config/rclone.conf
   nano backup-config/rclone.conf        # wklej klucze, sprawdź region
   chmod 600 backup-config/rclone.conf
   echo 'BACKUP_REMOTE=ovh:spacepioneers-kopie' >> .env
   ```
3. Start i sprawdzenie:
   ```bash
   docker compose up -d --build backup
   docker compose logs -f backup          # "wyslano" i "gotowe" = działa
   docker compose run --rm backup rclone ls ovh:spacepioneers-kopie
   ```

Bez `BACKUP_REMOTE` kontener też działa, ale trzyma kopie tylko na serwerze (w logu pojawi się ostrzeżenie).
Zamiast OVH może to być dowolne miejsce obsługiwane przez rclone (Google Drive, Dropbox, inny serwer przez SFTP):
`docker compose run --rm backup rclone config` przeprowadzi przez konfigurację.

## Ręczna kopia

```bash
docker compose run --rm backup backup.sh
```

Warto zrobić ją przed każdą większą aktualizacją gry.

## Odtworzenie bazy

**Zastępuje całą obecną zawartość bazy.**

```bash
ls backups/daily                                       # albo: docker compose run --rm backup rclone ls ovh:spacepioneers-kopie
docker compose stop game
docker compose run --rm backup restore.sh /backups/daily/spacepioneers_2026-10-30_0400.dump
# z chmury: restore.sh ovh:spacepioneers-kopie/daily/spacepioneers_2026-10-30_0400.dump
docker compose start game
```

Odtworzenie jest jedną transakcją: jeśli coś się nie uda, baza zostaje taka, jaka była.

## Ustawienia (`.env`)

| zmienna | domyślnie | znaczenie |
|---|---|---|
| `BACKUP_REMOTE` | (puste) | cel rclone, np. `ovh:spacepioneers-kopie` |
| `BACKUP_HOUR` | 4 | godzina codziennej kopii (czas polski) |
| `BACKUP_KEEP_DAILY` / `BACKUP_KEEP_WEEKLY` | 7 / 4 | ile kopii trzymać na serwerze |
| `BACKUP_REMOTE_DAYS` | 30 | po ilu dniach usuwać dzienne kopie w chmurze (tygodniowe: ×4) |
