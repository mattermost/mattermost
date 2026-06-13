CREATE TABLE IF NOT EXISTS HealthCheckFindings (
    Fingerprint          VARCHAR(512)  NOT NULL,
    RuleCode             VARCHAR(256)  NOT NULL,
    State                VARCHAR(32)   NOT NULL DEFAULT 'unknown',
    FirstFiredAt         BIGINT        NOT NULL DEFAULT 0,
    LastFiredAt          BIGINT        NOT NULL DEFAULT 0,
    ResolvedAt           BIGINT        NOT NULL DEFAULT 0,
    ConsecutiveFailures  INTEGER       NOT NULL DEFAULT 0,
    MutedAt              BIGINT        NOT NULL DEFAULT 0,
    MutedByUserId        VARCHAR(26)   NOT NULL DEFAULT '',
    UpdatedAt            BIGINT        NOT NULL DEFAULT 0,
    CONSTRAINT pk_health_check_findings PRIMARY KEY (Fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_health_check_findings_state
    ON HealthCheckFindings (State);

CREATE INDEX IF NOT EXISTS idx_health_check_findings_muted
    ON HealthCheckFindings (MutedAt)
    WHERE MutedAt > 0;
