-- Tokeny z linkow e-mail (tylko skrot SHA-256), dziennik ich wydawania (limit na godzine)
-- oraz dziennik dzialan administratorow (pregierz).

create table account_tokens (
    token_hash varchar(64) primary key,
    player_id  bigint      not null references players (id) on delete cascade,
    purpose    varchar(20) not null,
    email      varchar(254) not null,
    created_at timestamptz not null,
    expires_at timestamptz not null
);
create index ix_account_tokens_player on account_tokens (player_id, purpose);

create table account_token_log (
    player_id  bigint      not null references players (id) on delete cascade,
    purpose    varchar(20) not null,
    created_at timestamptz not null
);
create index ix_account_token_log on account_token_log (player_id, purpose, created_at);

create table admin_log (
    id          bigserial primary key,
    at          timestamptz  not null,
    admin_name  varchar(20)  not null,
    action      varchar(20)  not null,
    target_id   bigint,
    target_name varchar(20),
    details     varchar(5000),
    until       timestamptz
);
create index ix_admin_log_action on admin_log (action, id desc);
