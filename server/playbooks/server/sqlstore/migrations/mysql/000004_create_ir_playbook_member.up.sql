CREATE TABLE IF NOT EXISTS IR_PlaybookMember (
    PlaybookID VARCHAR(26) NOT NULL REFERENCES IR_Playbook(ID),
    MemberID VARCHAR(26) NOT NULL,
    INDEX IR_PlaybookMember_PlaybookID (PlaybookID),
    INDEX IR_PlaybookMember_MemberID (MemberID)
) DEFAULT CHARACTER SET utf8mb4;
