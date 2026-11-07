DO
$$
BEGIN
    IF to_regclass('IR_ViewedChannel_ChannelID_UserID') IS NULL THEN
        CREATE UNIQUE INDEX IR_ViewedChannel_ChannelID_UserID ON IR_ViewedChannel (ChannelID, UserID);
    END IF;
END
$$;
