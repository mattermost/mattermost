UPDATE IR_Incident
INNER JOIN Channels ON IR_Incident.ChannelID = Channels.ID
SET IR_Incident.CreateAt = Channels.CreateAt,
    IR_Incident.DeleteAt = Channels.DeleteAt
WHERE IR_Incident.CreateAt = 0
    AND IR_Incident.DeleteAt = 0
    AND IR_Incident.ChannelID = Channels.ID

