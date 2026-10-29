-- Trwala blokada logowania (wspolna dla wszystkich instancji serwera).
create table login_attempts (
    login_key    varchar(254) primary key,
    failures     int          not null,
    last_failure timestamptz  not null,
    locked_until timestamptz
);
