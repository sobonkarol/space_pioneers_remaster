# Kopie zapasowe bazy: pg_dump (ta sama wersja co baza) + rclone do wysylki poza serwer.
FROM postgres:16
RUN apt-get update && apt-get install -y --no-install-recommends rclone ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/*
COPY backup.sh restore.sh entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
