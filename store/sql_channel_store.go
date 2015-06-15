// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"strings"
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

		tablem := db.AddTableWithName(model.ChannelMember{}, "ChannelMembers").SetKeys(false, "ChannelId", "UserId")
		tablem.ColMap("ChannelId").SetMaxSize(26)
		tablem.ColMap("UserId").SetMaxSize(26)
		tablem.ColMap("Roles").SetMaxSize(64)
		tablem.ColMap("NotifyLevel").SetMaxSize(20)
	}

	return s
}

func (s SqlChannelStore) UpgradeSchemaIfNeeded() {
}

func (s SqlChannelStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_team_id", "Channels", "TeamId")
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

		if count, err := s.GetMaster().SelectInt("SELECT COUNT(0) FROM Channels WHERE TeamId = ? AND DeleteAt = 0 AND (Type ='O' || Type ='P')", channel.TeamId); err != nil {
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
			if strings.Contains(err.Error(), "Duplicate entry") && strings.Contains(err.Error(), "for key 'Name'") {
				result.Err = model.NewAppError("SqlChannelStore.Save", "A channel with that name already exists", "id="+channel.Id+", "+err.Error())
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
			if strings.Contains(err.Error(), "Duplicate entry") && strings.Contains(err.Error(), "for key 'Name'") {
				result.Err = model.NewAppError("SqlChannelStore.Update", "A channel with that name already exists", "id="+channel.Id+", "+err.Error())
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

		_, err := s.GetMaster().Exec("Update Channels SET DeleteAt = ?, UpdateAt = ? WHERE Id = ?", time, time, channelId)
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
		_, err := s.GetReplica().Select(&data, "SELECT * FROM Channels, ChannelMembers WHERE Id = ChannelId AND TeamId = ? AND UserId = ? AND DeleteAt = 0 ORDER BY DisplayName", teamId, userId)

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
			    TeamId = ?
					AND Type IN ("O")
					AND DeleteAt = 0
			        AND Id NOT IN (SELECT 
			            Channels.Id
			        FROM
			            Channels,
			            ChannelMembers
			        WHERE
			            Id = ChannelId
			                AND TeamId = ?
			                AND UserId = ?
			                AND DeleteAt = 0)
			ORDER BY DisplayName`,
			teamId, teamId, userId)

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

func (s SqlChannelStore) GetByName(teamId string, name string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		channel := model.Channel{}

		if err := s.GetReplica().SelectOne(&channel, "SELECT * FROM Channels WHERE TeamId=? AND Name=? AND DeleteAt = 0", teamId, name); err != nil {
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

		if result.Err = member.IsValid(); result.Err != nil {
			storeChannel <- result
			return
		}

		if err := s.GetMaster().Insert(member); err != nil {
			if strings.Contains(err.Error(), "Duplicate entry") && strings.Contains(err.Error(), "for key 'ChannelId'") {
				result.Err = model.NewAppError("SqlChannelStore.SaveMember", "A channel member with that id already exists", "channel_id="+member.ChannelId+", user_id="+member.UserId+", "+err.Error())
			} else {
				result.Err = model.NewAppError("SqlChannelStore.SaveMember", "We couldn't save the channel member", "channel_id="+member.ChannelId+", user_id="+member.UserId+", "+err.Error())
			}
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
		_, err := s.GetReplica().Select(&members, "SELECT * FROM ChannelMembers WHERE ChannelId = ?", channelId)
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
		err := s.GetReplica().SelectOne(&member, "SELECT * FROM ChannelMembers WHERE ChannelId = ? AND UserId = ?", channelId, userId)
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
		_, err := s.GetReplica().Select(&members, "SELECT Id, FullName, Email, ChannelMembers.Roles, Username FROM ChannelMembers, Users WHERE ChannelMembers.UserId = Users.Id AND ChannelId = ? LIMIT ?", channelId, limit)
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetExtraMembers", "We couldn't get the extra info for channel members", "channel_id="+channelId+", "+err.Error())
		} else {
			for i, _ := range members {
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

		_, err := s.GetMaster().Exec("DELETE FROM ChannelMembers WHERE ChannelId = ? AND UserId = ?", channelId, userId)
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.RemoveMember", "We couldn't remove the channel member", "channel_id="+channelId+", user_id="+userId+", "+err.Error())
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
			        AND Channels.TeamId = ?
			        AND Channels.DeleteAt = 0
			        AND ChannelMembers.ChannelId = ?
			        AND ChannelMembers.UserId = ?`,
			teamId, channelId, userId)
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
			        AND Channels.TeamId = ?
			        AND Channels.Name = ?
			        AND Channels.DeleteAt = 0
			        AND ChannelMembers.UserId = ?`,
			teamId, channelName, userId)
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
			    Channels.Id = ?
			        AND Channels.TeamId = ?
			        AND Channels.Type = ?`,
			channelId, teamId, model.CHANNEL_OPEN)
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

		_, err := s.GetMaster().Exec(
			`UPDATE
				ChannelMembers, Channels
			SET
			    ChannelMembers.MentionCount = 0,
			    ChannelMembers.MsgCount = Channels.TotalMsgCount,
			    ChannelMembers.LastViewedAt = Channels.LastPostAt
			WHERE
			    Channels.Id = ChannelMembers.ChannelId
			        AND UserId = ?
			        AND ChannelId = ?`,
			userId, channelId)
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
				UserId = ?
					AND ChannelId = ?`,
			userId, channelId)
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.IncrementMentionCount", "We couldn't increment the mention count", "channel_id="+channelId+", user_id="+userId+", "+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) UpdateNotifyLevel(channelId, userId, notifyLevel string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		_, err := s.GetMaster().Exec(
			`UPDATE
				ChannelMembers
			SET
				NotifyLevel = ?
			WHERE
				UserId = ?
					AND ChannelId = ?`,
			notifyLevel, userId, channelId)
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.UpdateNotifyLevel", "We couldn't update the notify level", "channel_id="+channelId+", user_id="+userId+", "+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
