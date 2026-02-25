-- Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
-- Techzen Web Push Subscriptions table

CREATE TABLE IF NOT EXISTS WebPushSubscriptions (
    Id          VARCHAR(26)   NOT NULL,
    UserId      VARCHAR(26)   NOT NULL,
    Endpoint    TEXT          NOT NULL,
    Auth        TEXT          NOT NULL,
    P256DH      TEXT          NOT NULL,
    UserAgent   VARCHAR(512)  DEFAULT '',
    CreatedAt   BIGINT        NOT NULL,
    CONSTRAINT WebPushSubscriptions_pkey PRIMARY KEY (Id),
    CONSTRAINT WebPushSubscriptions_user_endpoint UNIQUE (UserId, Endpoint)
);

CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_user_id
    ON WebPushSubscriptions (UserId);
