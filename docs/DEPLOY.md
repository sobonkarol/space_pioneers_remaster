# Automatyczne wdrażanie (auto-deploy)

Po każdym merge'u do `main`, gdy całe CI jest zielone, GitHub Actions łączy się z serwerem przez SSH i uruchamia
`deploy/deploy.sh`. Skrypt:

1. przerywa, jeśli na serwerze ktoś ręcznie zmienił pliki z repozytorium (nic nie nadpisuje);
2. pobiera `main` (tylko fast-forward);
3. robi kopię bazy, jeśli działa kontener `backup` (migracje bazy są nieodwracalne);
4. `docker compose up -d --build`;
5. czeka, aż gra odpowie, i dopiero wtedy kończy się sukcesem. Jeśli gra nie wstanie, job deploy w CI jest czerwony,
   a w jego logu są ostatnie linie logów gry.

Pliki tylko z serwera (`.env`, `docker-compose.override.yml`, `backups/`, `backup-config/`) nie są ruszane.
Ręcznie to samo: `bash deploy/deploy.sh` w katalogu gry.

## Włączenie (jednorazowo)

Dopóki w repozytorium nie ma sekretu `DEPLOY_SSH_KEY`, job `deploy` tylko wypisuje informację i nic nie robi.

**1. Na serwerze:** osobny klucz, który pozwala wyłącznie uruchomić aktualizację.
```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N "" -C "github-deploy"
echo "command=\"cd $HOME/space_pioneers_remaster && bash deploy/deploy.sh\",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty $(cat ~/.ssh/github_deploy.pub)" >> ~/.ssh/authorized_keys
cat ~/.ssh/github_deploy          # klucz prywatny - skopiuj całość (z liniami BEGIN/END)
ssh-keyscan 149.56.209.82 2>/dev/null   # odcisk serwera (do sekretu DEPLOY_KNOWN_HOSTS)
```
Dzięki `command=...` nawet ktoś, kto zdobyłby ten klucz, może tylko zaktualizować grę do wersji z GitHuba. Nie dostanie
powłoki na serwerze.

**2. Na GitHubie:** repozytorium → **Settings → Secrets and variables → Actions → New repository secret**:

| sekret | wartość |
|---|---|
| `DEPLOY_SSH_KEY` | zawartość `~/.ssh/github_deploy` (klucz prywatny) |
| `DEPLOY_HOST` | `149.56.209.82` |
| `DEPLOY_USER` | `ubuntu` |
| `DEPLOY_PATH` | `/home/ubuntu/space_pioneers_remaster` |
| `DEPLOY_KNOWN_HOSTS` | wynik `ssh-keyscan 149.56.209.82` (zalecane: chroni przed podszyciem się pod serwer) |

**3. Sprawdzenie:** zrób dowolny merge do `main` i w zakładce **Actions** zobacz job `deploy`. Na końcu jego logu
ma być `gra dziala (<commit>)`. Kolejne aktualizacje dzieją się same, ok. 5 minut po merge'u.

## Wyłączenie

Usuń sekret `DEPLOY_SSH_KEY` na GitHubie (i ewentualnie linię `github-deploy` z `~/.ssh/authorized_keys` na serwerze).
