CREATE TABLE IF NOT EXISTS IR_TimelineEvent (
    ID            TEXT   NOT NULL,
    IncidentID    TEXT   NOT NULL REFERENCES IR_Incident(ID),
    CreateAt      BIGINT NOT NULL,
    DeleteAt      BIGINT NOT NULL DEFAULT 0,
    EventAt       BIGINT NOT NULL,
    EventType     TEXT   NOT NULL DEFAULT '',
    Summary       TEXT   NOT NULL DEFAULT '',
    Details       TEXT   NOT NULL DEFAULT '',
    PostID        TEXT   NOT NULL DEFAULT '',
    SubjectUserID TEXT   NOT NULL DEFAULT '',
    CreatorUserID TEXT   NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS IR_TimelineEvent_ID ON IR_TimelineEvent (ID);
CREATE INDEX IF NOT EXISTS IR_TimelineEvent_IncidentID ON IR_TimelineEvent (IncidentID);
