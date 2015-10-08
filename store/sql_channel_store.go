// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	l4g "code.google.com/p/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

type SqlChannelStore struct {
	*SqlStore
}

func NewSqlChannelStore(sqlStore *SqlStore) ChannelStore {
	s := &SqlChannelStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Channel{}, "Channels").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("TeamId").SetMaxSize(26)
		table.ColMap("Type").SetMaxSize(1)
		table.ColMap("DisplayName").SetMaxSize(64)
		table.ColMap("Name").SetMaxSize(64)
		table.SetUniqueTogether("Name", "TeamId")
		table.ColMap("Description").SetMaxSize(1024)
		table.ColMap("CreatorId").SetMaxSize(26)

		tablem := db.AddTableWithName(model.ChannelMember{}, "ChannelMembers").SetKeys(false, "ChannelId", "UserId")
		tablem.ColMap("ChannelId").SetMaxSize(26)
		tablem.ColMap("UserId").SetMaxSize(26)
		tablem.ColMap("Roles").SetMaxSize(64)
		tablem.ColMap("NotifyProps").SetMaxSize(2000)
	}

	return s
}

func (s SqlChannelStore) UpgradeSchemaIfNeeded() {

	// BEGIN REMOVE AFTER 1.1.0
	if s.CreateColumnIfNotExists("ChannelMembers", "NotifyProps", "varchar(2000)", "varchar(2000)", "{}") {
		// populate NotifyProps from existing NotifyLevel field

		// set default values
		_, err := s.GetMaster().Exec(
			`UPDATE
				ChannelMembers
			SET
				NotifyProps = CONCAT('{"desktop":"', CONCAT(NotifyLevel, '","mark_unread":"` + model.CHANNEL_MARK_UNREAD_ALL + `"}'))`)
		if err != nil {
			l4g.Error("Unable to set default values for ChannelMembers.NotifyProps")
			l4g.Error(err.Error())
		}

		// assume channels with all notifications enabled are just using the default settings
		_, err = s.GetMaster().Exec(
			`UPDATE
				ChannelMembers
			SET
				NotifyProps = '{"desktop":"` + model.CHANNEL_NOTIFY_DEFAULT + `","mark_unread":"` + model.CHANNEL_MARK_UNREAD_ALL + `"}'
			WHERE
				NotifyLevel = '` + model.CHANNEL_NOTIFY_ALL + `'`)
		if err != nil {
			l4g.Error("Unable to set values for ChannelMembers.NotifyProps when members previously had notifyLevel=all")
			l4g.Error(err.Error())
		}

		// set quiet mode channels to have no notifications and only mark the channel unread on mentions
		_, err = s.GetMaster().Exec(
			`UPDATE
				ChannelMembers
			SET
				NotifyProps = '{"desktop":"` + model.CHANNEL_NOTIFY_NONE + `","mark_unread":"` + model.CHANNEL_MARK_UNREAD_MENTION + `"}'
			WHERE
				NotifyLevel = 'quiet'`)
		if err != nil {
			l4g.Error("Unable to set values for ChannelMembers.NotifyProps when members previously had notifyLevel=quiet")
			l4g.Error(err.Error())
		}

		s.RemoveColumnIfExists("ChannelMembers", "NotifyLevel")
	}
	// END REMOVE AFTER 1.1.0
}

func (s SqlChannelStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_channels_team_id", "Channels", "TeamId")
	s.CreateIndexIfNotExists("idx_channels_name", "Channels", "Name")

	s.CreateIndexIfNotExists("idx_channelmembers_channel_id", "ChannelMembers", "ChannelId")
	s.CreateIndexIfNotExists("idx_channelmembers_user_id", "ChannelMembers", "UserId")
}

func (s SqlChannelStore) Save(channel *model.Channel) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if len(channel.Id) > 0 {
			result.Err = model.NewAppError("SqlChannelStore.Save",
				"Must call update for exisiting channel", "id="+channel.Id)
			storeChannel <- result
			close(storeChannel)
			return
		}

		channel.PreSave()
		if result.Err = channel.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if count, err := s.GetMaster().SelectInt("SELECT COUNT(0) FROM Channels WHERE TeamId = :TeamId AND DeleteAt = 0 AND (Type = 'O' OR Type = 'P')", map[string]interface{}{"TeamId": channel.TeamId}); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.Save", "Failed to get current channel count", "teamId="+channel.TeamId+", "+err.Error())
			storeChannel <- result
			close(storeChannel)
			return
		} else if count > 150 {
			result.Err = model.NewAppError("SqlChannelStore.Save", "You've reached the limit of the number of allowed channels.", "teamId="+channel.TeamId)
			storeChannel <- result
			close(storeChannel)
			return
		}

		if err := s.GetMaster().Insert(channel); err != nil {
			if IsUniqueConstraintError(err.Error(), "Name", "channels_name_teamid_key") {
				dupChannel := model.Channel{}
				s.GetReplica().SelectOne(&dupChannel, "SELECT * FROM Channels WHERE TeamId = :TeamId AND Name = :Name AND DeleteAt > 0", map[string]interface{}{"TeamId": channel.TeamId, "Name": channel.Name})
				if dupChannel.DeleteAt > 0 {
					result.Err = model.NewAppError("SqlChannelStore.Update", "A channel with that URL was previously created", "id="+channel.Id+", "+err.Error())
				} else {
					result.Err = model.NewAppError("SqlChannelStore.Update", "A channel with that URL already exists", "id="+channel.Id+", "+err.Error())
				}
			} else {
				result.Err = model.NewAppError("SqlChannelStore.Save", "We couldn't save the channel", "id="+channel.Id+", "+err.Error())
			}
		} else {
			result.Data = channel
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) Update(channel *model.Channel) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		channel.PreUpdate()

		if result.Err = channel.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if count, err := s.GetMaster().Update(channel); err != nil {
			if IsUniqueConstraintError(err.Error(), "Name", "channels_name_teamid_key") {
				dupChannel := model.Channel{}
				s.GetReplica().SelectOne(&dupChannel, "SELECT * FROM Channels WHERE TeamId = :TeamId AND Name= :Name AND DeleteAt > 0", map[string]interface{}{"TeamId": channel.TeamId, "Name": channel.Name})
				if dupChannel.DeleteAt > 0 {
					result.Err = model.NewAppError("SqlChannelStore.Update", "A channel with that handle was previously created", "id="+channel.Id+", "+err.Error())
				} else {
					result.Err = model.NewAppError("SqlChannelStore.Update", "A channel with that handle already exists", "id="+channel.Id+", "+err.Error())
				}
			} else {
				result.Err = model.NewAppError("SqlChannelStore.Update", "We encounted an error updating the channel", "id="+channel.Id+", "+err.Error())
			}
		} else if count != 1 {
			result.Err = model.NewAppError("SqlChannelStore.Update", "We couldn't update the channel", "id="+channel.Id)
		} else {
			result.Data = channel
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) extraUpdated(channel *model.Channel) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		channel.ExtraUpdated()

		_, err := s.GetMaster().Exec(
			`UPDATE
				Channels
			SET
				ExtraUpdateAt = :Time
			WHERE
				Id = :Id`,
			map[string]interface{}{"Id": channel.Id, "Time": channel.ExtraUpdateAt})

		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.extraUpdated", "Problem updating members last updated time", "id="+channel.Id+", "+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) Get(id string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if obj, err := s.GetReplica().Get(model.Channel{}, id); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.Get", "We encounted an error finding the channel", "id="+id+", "+err.Error())
		} else if obj == nil {
			result.Err = model.NewAppError("SqlChannelStore.Get", "We couldn't find the existing channel", "id="+id)
		} else {
			result.Data = obj.(*model.Channel)
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) Delete(channelId string, time int64) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		_, err := s.GetMaster().Exec("Update Channels SET DeleteAt = :Time, UpdateAt = :Time WHERE Id = :ChannelId", map[string]interface{}{"Time": time, "ChannelId": channelId})
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.Delete", "We couldn't delete the channel", "id="+channelId+", err="+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

type channelWithMember struct {
	model.Channel
	model.ChannelMember
}

func (s SqlChannelStore) GetChannels(teamId string, userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var data []channelWithMember
		_, err := s.GetReplica().Select(&data, "SELECT * FROM Channels, ChannelMembers WHERE Id = ChannelId AND TeamId = :TeamId AND UserId = :UserId AND DeleteAt = 0 ORDER BY DisplayName", map[string]interface{}{"TeamId": teamId, "UserId": userId})

		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetChannels", "We couldn't get the channels", "teamId="+teamId+", userId="+userId+", err="+err.Error())
		} else {
			channels := &model.ChannelList{make([]*model.Channel, len(data)), make(map[string]*model.ChannelMember)}
			for i := range data {
				v := data[i]
				channels.Channels[i] = &v.Channel
				channels.Members[v.Channel.Id] = &v.ChannelMember
			}

			if len(channels.Channels) == 0 {
				result.Err = model.NewAppError("SqlChannelStore.GetChannels", "No channels were found", "teamId="+teamId+", userId="+userId)
			} else {
				result.Data = channels
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) GetMoreChannels(teamId string, userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var data []*model.Channel
		_, err := s.GetReplica().Select(&data,
			`SELECT 
			    *
			FROM
			    Channels
			WHERE
			    TeamId = :TeamId1
					AND Type IN ('O')
					AND DeleteAt = 0
			        AND Id NOT IN (SELECT 
			            Channels.Id
			        FROM
			            Channels,
			            ChannelMembers
			        WHERE
			            Id = ChannelId
			                AND TeamId = :TeamId2
			                AND UserId = :UserId
			                AND DeleteAt = 0)
			ORDER BY DisplayName`,
			map[string]interface{}{"TeamId1": teamId, "TeamId2": teamId, "UserId": userId})

		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetMoreChannels", "We couldn't get the channels", "teamId="+teamId+", userId="+userId+", err="+err.Error())
		} else {
			result.Data = &model.ChannelList{data, make(map[string]*model.ChannelMember)}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

type channelIdWithCountAndUpdateAt struct {
	Id            string
	TotalMsgCount int64
	UpdateAt      int64
}

func (s SqlChannelStore) GetChannelCounts(teamId string, userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var data []channelIdWithCountAndUpdateAt
		_, err := s.GetReplica().Select(&data, "SELECT Id, TotalMsgCount, UpdateAt FROM Channels WHERE Id IN (SELECT ChannelId FROM ChannelMembers WHERE UserId = :UserId) AND TeamId = :TeamId AND DeleteAt = 0 ORDER BY DisplayName", map[string]interface{}{"TeamId": teamId, "UserId": userId})

		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetChannelCounts", "We couldn't get the channel counts", "teamId="+teamId+", userId="+userId+", err="+err.Error())
		} else {
			counts := &model.ChannelCounts{Counts: make(map[string]int64), UpdateTimes: make(map[string]int64)}
			for i := range data {
				v := data[i]
				counts.Counts[v.Id] = v.TotalMsgCount
				counts.UpdateTimes[v.Id] = v.UpdateAt
			}

			result.Data = counts
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) GetByName(teamId string, name string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		channel := model.Channel{}

		if err := s.GetReplica().SelectOne(&channel, "SELECT * FROM Channels WHERE TeamId = :TeamId AND Name= :Name AND DeleteAt = 0", map[string]interface{}{"TeamId": teamId, "Name": name}); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetByName", "We couldn't find the existing channel", "teamId="+teamId+", "+"name="+name+", "+err.Error())
		} else {
			result.Data = &channel
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) SaveMember(member *model.ChannelMember) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		// Grab the channel we are saving this member to
		if cr := <-s.Get(member.ChannelId); cr.Err != nil {
			result.Err = cr.Err
		} else {
			channel := cr.Data.(*model.Channel)

			member.PreSave()
			if result.Err = member.IsValid(); result.Err != nil {
				storeChannel <- result
				return
			}

			if err := s.GetMaster().Insert(member); err != nil {
				if IsUniqueConstraintError(err.Error(), "ChannelId", "channelmembers_pkey") {
					result.Err = model.NewAppError("SqlChannelStore.SaveMember", "A channel member with that id already exists", "channel_id="+member.ChannelId+", user_id="+member.UserId+", "+err.Error())
				} else {
					result.Err = model.NewAppError("SqlChannelStore.SaveMember", "We couldn't save the channel member", "channel_id="+member.ChannelId+", user_id="+member.UserId+", "+err.Error())
				}
			} else {
				result.Data = member
				// If sucessfull record members have changed in channel
				if mu := <-s.extraUpdated(channel); mu.Err != nil {
					result.Err = mu.Err
				}
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) UpdateMember(member *model.ChannelMember) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		member.PreUpdate()

		if result.Err = member.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if _, err := s.GetMaster().Update(member); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.UpdateMember", "We encounted an error updating the channel member",
				"channel_id="+member.ChannelId+", "+"user_id="+member.UserId+", "+err.Error())
		} else {
			result.Data = member
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) GetMembers(channelId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var members []model.ChannelMember
		_, err := s.GetReplica().Select(&members, "SELECT * FROM ChannelMembers WHERE ChannelId = :ChannelId", map[string]interface{}{"ChannelId": channelId})
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetMembers", "We couldn't get the channel members", "channel_id="+channelId+err.Error())
		} else {
			result.Data = members
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) GetMember(channelId string, userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var member model.ChannelMember
		err := s.GetReplica().SelectOne(&member, "SELECT * FROM ChannelMembers WHERE ChannelId = :ChannelId AND UserId = :UserId", map[string]interface{}{"ChannelId": channelId, "UserId": userId})
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetMember", "We couldn't get the channel member", "channel_id="+channelId+"user_id="+userId+","+err.Error())
		} else {
			result.Data = member
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) GetExtraMembers(channelId string, limit int) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var members []model.ExtraMember
		_, err := s.GetReplica().Select(&members, "SELECT Id, Nickname, Email, ChannelMembers.Roles, Username FROM ChannelMembers, Users WHERE ChannelMembers.UserId = Users.Id AND ChannelId = :ChannelId LIMIT :Limit", map[string]interface{}{"ChannelId": channelId, "Limit": limit})
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetExtraMembers", "We couldn't get the extra info for channel members", "channel_id="+channelId+", "+err.Error())
		} else {
			for i := range members {
				members[i].Sanitize(utils.SanitizeOptions)
			}
			result.Data = members
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) RemoveMember(channelId string, userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		// Grab the channel we are saving this member to
		if cr := <-s.Get(channelId); cr.Err != nil {
			result.Err = cr.Err
		} else {
			channel := cr.Data.(*model.Channel)

			_, err := s.GetMaster().Exec("DELETE FROM ChannelMembers WHERE ChannelId = :ChannelId AND UserId = :UserId", map[string]interface{}{"ChannelId": channelId, "UserId": userId})
			if err != nil {
				result.Err = model.NewAppError("SqlChannelStore.RemoveMember", "We couldn't remove the channel member", "channel_id="+channelId+", user_id="+userId+", "+err.Error())
			} else {
				// If sucessfull record members have changed in channel
				if mu := <-s.extraUpdated(channel); mu.Err != nil {
					result.Err = mu.Err
				}
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) CheckPermissionsTo(teamId string, channelId string, userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		count, err := s.GetReplica().SelectInt(
			`SELECT
			    COUNT(0)
			FROM
			    Channels,
			    ChannelMembers
			WHERE
			    Channels.Id = ChannelMembers.ChannelId
			        AND Channels.TeamId = :TeamId
			        AND Channels.DeleteAt = 0
			        AND ChannelMembers.ChannelId = :ChannelId
			        AND ChannelMembers.UserId = :UserId`,
			map[string]interface{}{"TeamId": teamId, "ChannelId": channelId, "UserId": userId})
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.CheckPermissionsTo", "We couldn't check the permissions", "channel_id="+channelId+", user_id="+userId+", "+err.Error())
		} else {
			result.Data = count
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) CheckPermissionsToByName(teamId string, channelName string, userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		channelId, err := s.GetReplica().SelectStr(
			`SELECT
			    Channels.Id
			FROM
			    Channels,
			    ChannelMembers
			WHERE
			    Channels.Id = ChannelMembers.ChannelId
			        AND Channels.TeamId = :TeamId
			        AND Channels.Name = :Name
			        AND Channels.DeleteAt = 0
			        AND ChannelMembers.UserId = :UserId`,
			map[string]interface{}{"TeamId": teamId, "Name": channelName, "UserId": userId})
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.CheckPermissionsToByName", "We couldn't check the permissions", "channel_id="+channelName+", user_id="+userId+", "+err.Error())
		} else {
			result.Data = channelId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) CheckOpenChannelPermissions(teamId string, channelId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		count, err := s.GetReplica().SelectInt(
			`SELECT
			    COUNT(0)
			FROM
			    Channels
			WHERE
			    Channels.Id = :ChannelId
			        AND Channels.TeamId = :TeamId
			        AND Channels.Type = :ChannelType`,
			map[string]interface{}{"ChannelId": channelId, "TeamId": teamId, "ChannelType": model.CHANNEL_OPEN})
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.CheckOpenChannelPermissions", "We couldn't check the permissions", "channel_id="+channelId+", "+err.Error())
		} else {
			result.Data = count
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) UpdateLastViewedAt(channelId string, userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var query string

		if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
			query = `UPDATE
				ChannelMembers
			SET
			    MentionCount = 0,
			    MsgCount = Channels.TotalMsgCount,
			    LastViewedAt = Channels.LastPostAt,
			    LastUpdateAt = Channels.LastPostAt
			FROM
				Channels
			WHERE
			    Channels.Id = ChannelMembers.ChannelId
			        AND UserId = :UserId
			        AND ChannelId = :ChannelId`
		} else if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_MYSQL {
			query = `UPDATE
				ChannelMembers, Channels
			SET
			    ChannelMembers.MentionCount = 0,
			    ChannelMembers.MsgCount = Channels.TotalMsgCount,
			    ChannelMembers.LastViewedAt = Channels.LastPostAt,
			    ChannelMembers.LastUpdateAt = Channels.LastPostAt
			WHERE
			    Channels.Id = ChannelMembers.ChannelId
			        AND UserId = :UserId
			        AND ChannelId = :ChannelId`
		}

		_, err := s.GetMaster().Exec(query, map[string]interface{}{"ChannelId": channelId, "UserId": userId})
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.UpdateLastViewedAt", "We couldn't update the last viewed at time", "channel_id="+channelId+", user_id="+userId+", "+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) IncrementMentionCount(channelId string, userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		_, err := s.GetMaster().Exec(
			`UPDATE
				ChannelMembers
			SET
				MentionCount = MentionCount + 1
			WHERE
				UserId = :UserId
					AND ChannelId = :ChannelId`,
			map[string]interface{}{"ChannelId": channelId, "UserId": userId})
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.IncrementMentionCount", "We couldn't increment the mention count", "channel_id="+channelId+", user_id="+userId+", "+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) GetForExport(teamId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var data []*model.Channel
		_, err := s.GetReplica().Select(&data, "SELECT * FROM Channels WHERE TeamId = :TeamId AND DeleteAt = 0 AND Type = 'O'", map[string]interface{}{"TeamId": teamId})

		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetAllChannels", "We couldn't get all the channels", "teamId="+teamId+", err="+err.Error())
		} else {
			result.Data = data
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
