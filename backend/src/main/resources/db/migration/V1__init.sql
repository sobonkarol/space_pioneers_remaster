-- Space Pioneers Remaster - schemat poczatkowy.
-- Encje gry zapisywane sa jako dokument JSONB (kolumna data), a pola potrzebne do wyszukiwania
-- i harmonogramu zdarzen sa zdenormalizowane do zwyklych kolumn z indeksami.

create sequence player_seq;
create sequence planet_seq;
create sequence fleet_seq;
create sequence message_seq;
create sequence alliance_seq;
create sequence application_seq;
create sequence treaty_seq;
create sequence build_seq;
create sequence shipyard_seq;

create table players (
    id             bigint primary key,
    username       varchar(20)  not null,
    email          varchar(254) not null,
    alliance_id    bigint,
    research_end   timestamptz,
    score_total    double precision not null default 0,
    last_activity  timestamptz,
    data           jsonb        not null
);
create unique index ux_players_username on players (lower(username));
create unique index ux_players_email on players (lower(email));
create index ix_players_alliance on players (alliance_id);
create index ix_players_research_end on players (research_end) where research_end is not null;

create table planets (
    id         bigint primary key,
    owner_id   bigint not null references players (id) on delete cascade,
    galaxy     int    not null,
    system     int    not null,
    position   int    not null,
    build_end  timestamptz,
    data       jsonb  not null,
    constraint ux_planets_coordinates unique (galaxy, system, position)
);
create index ix_planets_owner on planets (owner_id);
create index ix_planets_build_end on planets (build_end) where build_end is not null;

create table fleets (
    id              bigint primary key,
    owner_id        bigint not null references players (id) on delete cascade,
    origin_planet_id bigint not null,
    target_owner_id bigint,
    target_galaxy   int    not null,
    target_system   int    not null,
    target_position int    not null,
    status          varchar(10) not null,
    next_event_at   timestamptz not null,
    data            jsonb  not null
);
create index ix_fleets_owner on fleets (owner_id);
create index ix_fleets_target_owner on fleets (target_owner_id);
create index ix_fleets_next_event on fleets (next_event_at);

create table debris_fields (
    galaxy   int not null,
    system   int not null,
    position int not null,
    metal    double precision not null,
    crystal  double precision not null,
    primary key (galaxy, system, position)
);

create table messages (
    id           bigint primary key,
    recipient_id bigint not null references players (id) on delete cascade,
    sender_id    bigint,
    sender_name  varchar(20),
    type         varchar(12) not null,
    subject      varchar(200) not null,
    body         text not null,
    payload      jsonb,
    created_at   timestamptz not null,
    is_read      boolean not null default false
);
create index ix_messages_recipient on messages (recipient_id, created_at desc, id desc);
create index ix_messages_unread on messages (recipient_id) where not is_read;

create table alliances (
    id   bigint primary key,
    tag  varchar(8) not null,
    data jsonb not null
);
create unique index ux_alliances_tag on alliances (lower(tag));

create table alliance_applications (
    id          bigint primary key,
    alliance_id bigint not null references alliances (id) on delete cascade,
    player_id   bigint not null references players (id) on delete cascade,
    text        text   not null,
    created_at  timestamptz not null,
    constraint ux_application_player unique (player_id)
);

create table treaties (
    id          bigint primary key,
    alliance_a  bigint not null references alliances (id) on delete cascade,
    alliance_b  bigint not null references alliances (id) on delete cascade,
    type        varchar(20) not null,
    status      varchar(10) not null,
    proposed_by bigint not null,
    created_at  timestamptz not null
);
create index ix_treaties_a on treaties (alliance_a);
create index ix_treaties_b on treaties (alliance_b);

-- sesje logowania (token przechowywany jako skrot SHA-256)
create table sessions (
    token_hash varchar(64) primary key,
    player_id  bigint not null references players (id) on delete cascade,
    created_at timestamptz not null,
    expires_at timestamptz not null
);
create index ix_sessions_player on sessions (player_id);
