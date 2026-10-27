CREATE TABLE IF NOT EXISTS BotEventSubscriptions (
    BotUserId               varchar(26) PRIMARY KEY,
    Mode                    varchar(8)  NOT NULL,
    CallbackURL             text        NOT NULL DEFAULT '',
    Secret                  varchar(64) NOT NULL,
    IgnoreBotAuthors        boolean     NOT NULL DEFAULT true,
    Enabled                 boolean     NOT NULL DEFAULT true,
    DisabledReason          varchar(64) NOT NULL DEFAULT '',
    AckCursorCreateAt       bigint      NOT NULL DEFAULT 0,
    AckCursorId             varchar(26) NOT NULL DEFAULT '',
    ConsecutiveFailures     integer     NOT NULL DEFAULT 0,
    FirstFailureAt          bigint      NOT NULL DEFAULT 0,
    NextAttemptAt           bigint      NOT NULL DEFAULT 0,
    LeaseNode               varchar(64) NOT NULL DEFAULT '',
    LeaseExpiresAt          bigint      NOT NULL DEFAULT 0,
    CreateAt                bigint      NOT NULL,
    UpdateAt                bigint      NOT NULL,
    LastDeliveredAt         bigint      NOT NULL DEFAULT 0
);
