CREATE TABLE IF NOT EXISTS IR_ViewedChannel (
    ChannelID     VARCHAR(26) NOT NULL,
    UserID        VARCHAR(26) NOT NULL,
    UNIQUE INDEX  IR_ViewedChannel_ChannelID_UserID (ChannelID, UserID)
) DEFAULT CHARACTER SET utf8mb4;