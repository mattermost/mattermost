CREATE TABLE IF NOT EXISTS IR_TimelineEvent (
    ID            VARCHAR(26)   NOT NULL,
    IncidentID    VARCHAR(26)   NOT NULL REFERENCES IR_Incident(ID),
    CreateAt      BIGINT        NOT NULL,
    DeleteAt      BIGINT        NOT NULL DEFAULT 0,
    EventAt       BIGINT        NOT NULL,
    EventType     VARCHAR(32)   NOT NULL DEFAULT '',
    Summary       VARCHAR(256)  NOT NULL DEFAULT '',
    Details       VARCHAR(4096) NOT NULL DEFAULT '',
    PostID        VARCHAR(26)   NOT NULL DEFAULT '',
    SubjectUserID VARCHAR(26)   NOT NULL DEFAULT '',
    CreatorUserID VARCHAR(26)   NOT NULL DEFAULT '',
    INDEX IR_TimelineEvent_ID (ID),
    INDEX IR_TimelineEvent_IncidentID (IncidentID)
) DEFAULT CHARACTER SET utf8mb4;
