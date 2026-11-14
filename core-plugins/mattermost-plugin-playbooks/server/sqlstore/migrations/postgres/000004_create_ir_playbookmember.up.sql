CREATE TABLE IF NOT EXISTS IR_PlaybookMember (
    PlaybookID TEXT NOT NULL REFERENCES IR_Playbook(ID),
    MemberID TEXT NOT NULL,
    UNIQUE (PlaybookID, MemberID)
);

CREATE INDEX IF NOT EXISTS IR_PlaybookMember_PlaybookID ON IR_PlaybookMember (PlaybookID);
CREATE INDEX IF NOT EXISTS IR_PlaybookMember_MemberID ON IR_PlaybookMember (MemberID);
