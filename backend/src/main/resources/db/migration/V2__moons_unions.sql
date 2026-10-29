-- Ksiezyce, ataki sojusznicze, obrona sojusznicza, ekspedycje i rakiety.

alter table planets add column is_moon boolean not null default false;
alter table planets drop constraint ux_planets_coordinates;
alter table planets add constraint ux_planets_coordinates unique (galaxy, system, position, is_moon);

alter table fleets add column union_id bigint;
alter table fleets add column target_moon boolean not null default false;
alter table fleets add column origin_galaxy int;
alter table fleets add column origin_system int;
alter table fleets add column origin_position int;
update fleets set origin_galaxy = (data -> 'origin' ->> 'galaxy')::int,
                  origin_system = (data -> 'origin' ->> 'system')::int,
                  origin_position = (data -> 'origin' ->> 'position')::int;
create index ix_fleets_union on fleets (union_id) where union_id is not null;
create index ix_fleets_target on fleets (target_galaxy, target_system, target_position);
create index ix_fleets_origin on fleets (origin_galaxy, origin_system, origin_position);

create sequence union_seq;
create table attack_unions (
    id   bigint primary key,
    data jsonb not null
);

-- lista znajomych
create sequence buddy_seq;
create table buddies (
    id           bigint primary key,
    requester_id bigint not null references players (id) on delete cascade,
    addressee_id bigint not null references players (id) on delete cascade,
    status       varchar(10) not null,
    text         varchar(500) not null default '',
    created_at   timestamptz not null,
    constraint ux_buddy_pair unique (requester_id, addressee_id)
);
create index ix_buddies_addressee on buddies (addressee_id);
