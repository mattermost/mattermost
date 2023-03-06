UPDATE IR_Incident
SET CreateAt = Channels.CreateAt,
    DeleteAt = Channels.DeleteAt
FROM Channels
WHERE IR_Incident.CreateAt = 0
    AND IR_Incident.DeleteAt = 0
    AND IR_Incident.ChannelID = Channels.ID