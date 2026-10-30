-- Publiczne forum gry (wszyscy gracze, czytanie bez logowania).

create sequence board_thread_seq;
create table board_threads (
    id           bigint primary key,
    category     varchar(20) not null,
    pinned       boolean     not null,
    last_post_at timestamptz not null,
    data         jsonb       not null
);
create index ix_board_threads_category on board_threads (category, pinned desc, last_post_at desc);
create index ix_board_threads_latest on board_threads (last_post_at desc);

create sequence board_post_seq;
create table board_posts (
    id         bigint primary key,
    thread_id  bigint not null references board_threads (id) on delete cascade,
    created_at timestamptz not null,
    data       jsonb  not null
);
create index ix_board_posts_thread on board_posts (thread_id, created_at, id);
