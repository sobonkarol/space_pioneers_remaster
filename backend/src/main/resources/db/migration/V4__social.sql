-- Archiwum wiadomosci, notatki, forum sojuszu.

alter table messages add column is_archived boolean not null default false;
create index ix_messages_purge on messages (created_at) where not is_archived;

create sequence note_seq;
create table notes (
    id         bigint primary key,
    owner_id   bigint not null references players (id) on delete cascade,
    priority   int    not null,
    updated_at timestamptz not null,
    data       jsonb  not null
);
create index ix_notes_owner on notes (owner_id);

create sequence thread_seq;
create table forum_threads (
    id           bigint primary key,
    alliance_id  bigint  not null references alliances (id) on delete cascade,
    pinned       boolean not null,
    last_post_at timestamptz not null,
    data         jsonb   not null
);
create index ix_forum_threads_alliance on forum_threads (alliance_id, pinned desc, last_post_at desc);

create sequence post_seq;
create table forum_posts (
    id          bigint primary key,
    thread_id   bigint not null references forum_threads (id) on delete cascade,
    alliance_id bigint not null,
    created_at  timestamptz not null,
    data        jsonb  not null
);
create index ix_forum_posts_thread on forum_posts (thread_id, created_at, id);
