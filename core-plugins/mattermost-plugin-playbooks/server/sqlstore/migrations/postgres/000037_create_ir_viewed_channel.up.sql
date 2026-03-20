CREATE TABLE IF NOT EXISTS IR_ViewedChannel (
    ChannelID TEXT NOT NULL,
    UserID    TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS IR_ViewedChannel_ChannelID_UserID ON IR_ViewedChannel (ChannelID, UserID);
