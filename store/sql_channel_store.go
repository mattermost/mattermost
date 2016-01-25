// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/go-gorp/gorp"
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
		table.ColMap("Header").SetMaxSize(1024)
		table.ColMap("Purpose").SetMaxSize(128)
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
		var result StoreResult
		if channel.Type == model.CHANNEL_DIRECT {
			result.Err = model.NewLocAppError("SqlChannelStore.Save", "store.sql_channel.save.direct_channel.app_error", nil, "")
		} else {
			if transaction, err := s.GetMaster().Begin(); err != nil {
				result.Err = model.NewLocAppError("SqlChannelStore.Save", "store.sql_channel.save.open_transaction.app_error", nil, err.Error())
			} else {
				result = s.saveChannelT(transaction, channel)
				if result.Err != nil {
					transaction.Rollback()
				} else {
					if err := transaction.Commit(); err != nil {
						result.Err = model.NewLocAppError("SqlChannelStore.Save", "store.sql_channel.save.commit_transaction.app_error", nil, err.Error())
					}
				}
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) SaveDirectChannel(directchannel *model.Channel, member1 *model.ChannelMember, member2 *model.ChannelMember) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		var result StoreResult

		if directchannel.Type != model.CHANNEL_DIRECT {
			result.Err = model.NewLocAppError("SqlChannelStore.SaveDirectChannel", "store.sql_channel.save_direct_channel.not_direct.app_error", nil, "")
		} else {
			if transaction, err := s.GetMaster().Begin(); err != nil {
				result.Err = model.NewLocAppError("SqlChannelStore.SaveDirectChannel", "store.sql_channel.save_direct_channel.open_transaction.app_error", nil, err.Error())
			} else {
				channelResult := s.saveChannelT(transaction, directchannel)

				if channelResult.Err != nil {
					transaction.Rollback()
					result.Err = channelResult.Err
				} else {
					newChannel := channelResult.Data.(*model.Channel)
					// Members need new channel ID
					member1.ChannelId = newChannel.Id
					member2.ChannelId = newChannel.Id

					member1Result := s.saveMemberT(transaction, member1, newChannel)
					member2Result := s.saveMemberT(transaction, member2, newChannel)

					if member1Result.Err != nil || member2Result.Err != nil {
						transaction.Rollback()
						details := ""
						if member1Result.Err != nil {
							details += "Member1Err: " + member1Result.Err.Message
						}
						if member2Result.Err != nil {
							details += "Member2Err: " + member2Result.Err.Message
						}
						result.Err = model.NewLocAppError("SqlChannelStore.SaveDirectChannel", "store.sql_channel.save_direct_channel.add_members.app_error", nil, details)
					} else {
						if err := transaction.Commit(); err != nil {
							result.Err = model.NewLocAppError("SqlChannelStore.SaveDirectChannel", "store.sql_channel.save_direct_channel.commit.app_error", nil, err.Error())
						} else {
							result = channelResult
						}
					}
				}
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) saveChannelT(transaction *gorp.Transaction, channel *model.Channel) StoreResult {
	result := StoreResult{}

	if len(channel.Id) > 0 {
		result.Err = model.NewLocAppError("SqlChannelStore.Save", "store.sql_channel.save_channel.existing.app_error", nil, "id="+channel.Id)
		return result
	}

	channel.PreSave()
	if result.Err = channel.IsValid(); result.Err != nil {
		return result
	}

	if channel.Type != model.CHANNEL_DIRECT {
		if count, err := transaction.SelectInt("SELECT COUNT(0) FROM Channels WHERE TeamId = :TeamId AND DeleteAt = 0 AND (Type = 'O' OR Type = 'P')", map[string]interface{}{"TeamId": channel.TeamId}); err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.Save", "store.sql_channel.save_channel.current_count.app_error", nil, "teamId="+channel.TeamId+", "+err.Error())
			return result
		} else if count > 1000 {
			result.Err = model.NewLocAppError("SqlChannelStore.Save", "store.sql_channel.save_channel.limit.app_error", nil, "teamId="+channel.TeamId)
			return result
		}
	}

	if err := transaction.Insert(channel); err != nil {
		if IsUniqueConstraintError(err.Error(), "Name", "channels_name_teamid_key") {
			dupChannel := model.Channel{}
			s.GetMaster().SelectOne(&dupChannel, "SELECT * FROM Channels WHERE TeamId = :TeamId AND Name = :Name AND DeleteAt > 0", map[string]interface{}{"TeamId": channel.TeamId, "Name": channel.Name})
			if dupChannel.DeleteAt > 0 {
				result.Err = model.NewLocAppError("SqlChannelStore.Update", "store.sql_channel.save_channel.previously.app_error", nil, "id="+channel.Id+", "+err.Error())
			} else {
				result.Err = model.NewLocAppError("SqlChannelStore.Update", "store.sql_channel.save_channel.exists.app_error", nil, "id="+channel.Id+", "+err.Error())
			}
		} else {
			result.Err = model.NewLocAppError("SqlChannelStore.Save", "store.sql_channel.save_channel.save.app_error", nil, "id="+channel.Id+", "+err.Error())
		}
	} else {
		result.Data = channel
	}

	return result
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
					result.Err = model.NewLocAppError("SqlChannelStore.Update", "store.sql_channel.update.previously.app_error", nil, "id="+channel.Id+", "+err.Error())
				} else {
					result.Err = model.NewLocAppError("SqlChannelStore.Update", "store.sql_channel.update.exists.app_error", nil, "id="+channel.Id+", "+err.Error())
				}
			} else {
				result.Err = model.NewLocAppError("SqlChannelStore.Update", "store.sql_channel.update.updating.app_error", nil, "id="+channel.Id+", "+err.Error())
			}
		} else if count != 1 {
			result.Err = model.NewLocAppError("SqlChannelStore.Update", "store.sql_channel.update.app_error", nil, "id="+channel.Id)
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
			result.Err = model.NewLocAppError("SqlChannelStore.extraUpdated", "store.sql_channel.extra_updated.app_error", nil, "id="+channel.Id+", "+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) Get(id string) StoreChannel {
	return s.get(id, false)
}

func (s SqlChannelStore) GetFromMaster(id string) StoreChannel {
	return s.get(id, true)
}

func (s SqlChannelStore) get(id string, master bool) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var db *gorp.DbMap
		if master {
			db = s.GetMaster()
		} else {
			db = s.GetReplica()
		}

		if obj, err := db.Get(model.Channel{}, id); err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.Get", "store.sql_channel.get.find.app_error", nil, "id="+id+", "+err.Error())
		} else if obj == nil {
			result.Err = model.NewLocAppError("SqlChannelStore.Get", "store.sql_channel.get.existing.app_error", nil, "id="+id)
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
			result.Err = model.NewLocAppError("SqlChannelStore.Delete", "store.sql_channel.delete.channel.app_error", nil, "id="+channelId+", err="+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) PermanentDeleteByTeam(teamId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := s.GetMaster().Exec("DELETE FROM Channels WHERE TeamId = :TeamId", map[string]interface{}{"TeamId": teamId}); err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.PermanentDeleteByTeam", "store.sql_channel.permanent_delete_by_team.app_error", nil, "teamId="+teamId+", "+err.Error())
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
			result.Err = model.NewLocAppError("SqlChannelStore.GetChannels", "store.sql_channel.get_channels.get.app_error", nil, "teamId="+teamId+", userId="+userId+", err="+err.Error())
		} else {
			channels := &model.ChannelList{make([]*model.Channel, len(data)), make(map[string]*model.ChannelMember)}
			for i := range data {
				v := data[i]
				channels.Channels[i] = &v.Channel
				channels.Members[v.Channel.Id] = &v.ChannelMember
			}

			if len(channels.Channels) == 0 {
				result.Err = model.NewLocAppError("SqlChannelStore.GetChannels", "store.sql_channel.get_channels.not_found.app_error", nil, "teamId="+teamId+", userId="+userId)
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
			result.Err = model.NewLocAppError("SqlChannelStore.GetMoreChannels", "store.sql_channel.get_more_channels.get.app_error", nil, "teamId="+teamId+", userId="+userId+", err="+err.Error())
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
			result.Err = model.NewLocAppError("SqlChannelStore.GetChannelCounts", "store.sql_channel.get_channel_counts.get.app_error", nil, "teamId="+teamId+", userId="+userId+", err="+err.Error())
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
			result.Err = model.NewLocAppError("SqlChannelStore.GetByName", "store.sql_channel.get_by_name.existing.app_error", nil, "teamId="+teamId+", "+"name="+name+", "+err.Error())
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
		var result StoreResult
		// Grab the channel we are saving this member to
		if cr := <-s.GetFromMaster(member.ChannelId); cr.Err != nil {
			result.Err = cr.Err
		} else {
			channel := cr.Data.(*model.Channel)

			if transaction, err := s.GetMaster().Begin(); err != nil {
				result.Err = model.NewLocAppError("SqlChannelStore.SaveMember", "store.sql_channel.save_member.open_transaction.app_error", nil, err.Error())
			} else {
				result = s.saveMemberT(transaction, member, channel)
				if result.Err != nil {
					transaction.Rollback()
				} else {
					if err := transaction.Commit(); err != nil {
						result.Err = model.NewLocAppError("SqlChannelStore.SaveMember", "store.sql_channel.save_member.commit_transaction.app_error", nil, err.Error())
					}
					// If sucessfull record members have changed in channel
					if mu := <-s.extraUpdated(channel); mu.Err != nil {
						result.Err = mu.Err
					}
				}
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) saveMemberT(transaction *gorp.Transaction, member *model.ChannelMember, channel *model.Channel) StoreResult {
	result := StoreResult{}

	member.PreSave()
	if result.Err = member.IsValid(); result.Err != nil {
		return result
	}

	if err := transaction.Insert(member); err != nil {
		if IsUniqueConstraintError(err.Error(), "ChannelId", "channelmembers_pkey") {
			result.Err = model.NewLocAppError("SqlChannelStore.SaveMember", "store.sql_channel.save_member.exists.app_error", nil, "channel_id="+member.ChannelId+", user_id="+member.UserId+", "+err.Error())
		} else {
			result.Err = model.NewLocAppError("SqlChannelStore.SaveMember", "store.sql_channel.save_member.save.app_error", nil, "channel_id="+member.ChannelId+", user_id="+member.UserId+", "+err.Error())
		}
	} else {
		result.Data = member
	}

	return result
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
			result.Err = model.NewLocAppError("SqlChannelStore.UpdateMember", "store.sql_channel.update_member.app_error", nil,
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
			result.Err = model.NewLocAppError("SqlChannelStore.GetMembers", "store.sql_channel.get_members.app_error", nil, "channel_id="+channelId+err.Error())
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
			result.Err = model.NewLocAppError("SqlChannelStore.GetMember", "store.sql_channel.get_member.app_error", nil, "channel_id="+channelId+"user_id="+userId+","+err.Error())
		} else {
			result.Data = member
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) GetMemberCount(channelId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		count, err := s.GetReplica().SelectInt(`
			SELECT
				count(*)
			FROM
				ChannelMembers,
				Users
			WHERE
				ChannelMembers.UserId = Users.Id
				AND ChannelMembers.ChannelId = :ChannelId
				AND Users.DeleteAt = 0`, map[string]interface{}{"ChannelId": channelId})
		if err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.GetMemberCount", "store.sql_channel.get_member_count.app_error", nil, "channel_id="+channelId+", "+err.Error())
		} else {
			result.Data = count
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
		var err error

		if limit != -1 {
			_, err = s.GetReplica().Select(&members, "SELECT Id, Nickname, Email, ChannelMembers.Roles, Username FROM ChannelMembers, Users WHERE ChannelMembers.UserId = Users.Id AND ChannelId = :ChannelId LIMIT :Limit", map[string]interface{}{"ChannelId": channelId, "Limit": limit})
		} else {
			_, err = s.GetReplica().Select(&members, "SELECT Id, Nickname, Email, ChannelMembers.Roles, Username FROM ChannelMembers, Users WHERE ChannelMembers.UserId = Users.Id AND ChannelId = :ChannelId", map[string]interface{}{"ChannelId": channelId})
		}

		if err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.GetExtraMembers", "store.sql_channel.get_extra_members.app_error", nil, "channel_id="+channelId+", "+err.Error())
		} else {
			for i := range members {
				members[i].Sanitize(utils.Cfg.GetSanitizeOptions())
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
				result.Err = model.NewLocAppError("SqlChannelStore.RemoveMember", "store.sql_channel.remove_member.app_error", nil, "channel_id="+channelId+", user_id="+userId+", "+err.Error())
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

func (s SqlChannelStore) PermanentDeleteMembersByUser(userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := s.GetMaster().Exec("DELETE FROM ChannelMembers WHERE UserId = :UserId", map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.RemoveMember", "store.sql_channel.permanent_delete_members_by_user.app_error", nil, "user_id="+userId+", "+err.Error())
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
			result.Err = model.NewLocAppError("SqlChannelStore.CheckPermissionsTo", "store.sql_channel.check_permissions.app_error", nil, "channel_id="+channelId+", user_id="+userId+", "+err.Error())
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
			result.Err = model.NewLocAppError("SqlChannelStore.CheckPermissionsToByName", "store.sql_channel.check_permissions_by_name.app_error", nil, "channel_id="+channelName+", user_id="+userId+", "+err.Error())
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
			result.Err = model.NewLocAppError("SqlChannelStore.CheckOpenChannelPermissions", "store.sql_channel.check_open_channel_permissions.app_error", nil, "channel_id="+channelId+", "+err.Error())
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
			result.Err = model.NewLocAppError("SqlChannelStore.UpdateLastViewedAt", "store.sql_channel.update_last_viewed_at.app_error", nil, "channel_id="+channelId+", user_id="+userId+", "+err.Error())
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
			result.Err = model.NewLocAppError("SqlChannelStore.IncrementMentionCount", "store.sql_channel.increment_mention_count.app_error", nil, "channel_id="+channelId+", user_id="+userId+", "+err.Error())
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
			result.Err = model.NewLocAppError("SqlChannelStore.GetAllChannels", "store.sql_channel.get_for_export.app_error", nil, "teamId="+teamId+", err="+err.Error())
		} else {
			result.Data = data
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) AnalyticsTypeCount(teamId string, channelType string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		query := "SELECT COUNT(Id) AS Value FROM Channels WHERE Type = :ChannelType"

		if len(teamId) > 0 {
			query += " AND TeamId = :TeamId"
		}

		v, err := s.GetReplica().SelectInt(query, map[string]interface{}{"TeamId": teamId, "ChannelType": channelType})
		if err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.AnalyticsTypeCount", "store.sql_channel.analytics_type_count.app_error", nil, err.Error())
		} else {
			result.Data = v
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
