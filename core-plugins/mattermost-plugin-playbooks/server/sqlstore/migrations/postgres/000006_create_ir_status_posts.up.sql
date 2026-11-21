CREATE TABLE IF NOT EXISTS IR_StatusPosts (
    IncidentID TEXT NOT NULL REFERENCES IR_Incident(ID),
    PostID TEXT NOT NULL,
    UNIQUE (IncidentID, PostID)
);

CREATE INDEX IF NOT EXISTS IR_StatusPosts_IncidentID ON IR_StatusPosts (IncidentID);
CREATE INDEX IF NOT EXISTS IR_StatusPosts_PostID ON IR_StatusPosts (PostID);
