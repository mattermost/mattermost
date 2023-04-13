CREATE TABLE IF NOT EXISTS IR_StatusPosts (
    IncidentID VARCHAR(26) NOT NULL REFERENCES IR_Incident(ID),
    PostID VARCHAR(26) NOT NULL,
    CONSTRAINT posts_unique UNIQUE (IncidentID, PostID),
    INDEX IR_StatusPosts_IncidentID (IncidentID),
    INDEX IR_StatusPosts_PostID (PostID)
) DEFAULT CHARACTER SET utf8mb4;
