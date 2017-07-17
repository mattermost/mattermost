// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/gorp"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

const (
	MISSING_CHANNEL_ERROR        = "store.sql_channel.get_by_name.missing.app_error"
	MISSING_CHANNEL_MEMBER_ERROR = "store.sql_channel.get_member.missing.app_error"
	CHANNEL_EXISTS_ERROR         = "store.sql_channel.save_channel.exists.app_error"

	ALL_CHANNEL_MEMBERS_FOR_USER_CACHE_SIZE = model.SESSION_CACHE_SIZE
	ALL_CHANNEL_MEMBERS_FOR_USER_CACHE_SEC  = 900 // 15 mins

	ALL_CHANNEL_MEMBERS_NOTIFY_PROPS_FOR_CHANNEL_CACHE_SIZE = model.SESSION_CACHE_SIZE
	ALL_CHANNEL_MEMBERS_NOTIFY_PROPS_FOR_CHANNEL_CACHE_SEC  = 1800 // 30 mins

	CHANNEL_MEMBERS_COUNTS_CACHE_SIZE = model.CHANNEL_CACHE_SIZE
	CHANNEL_MEMBERS_COUNTS_CACHE_SEC  = 1800 // 30 mins

	CHANNEL_CACHE_SEC = 900 // 15 mins
)

type SqlChannelStore struct {
	SqlStore
}

var channelMemberCountsCache = utils.NewLru(CHANNEL_MEMBERS_COUNTS_CACHE_SIZE)
var allChannelMembersForUserCache = utils.NewLru(ALL_CHANNEL_MEMBERS_FOR_USER_CACHE_SIZE)
var allChannelMembersNotifyPropsForChannelCache = utils.NewLru(ALL_CHANNEL_MEMBERS_NOTIFY_PROPS_FOR_CHANNEL_CACHE_SIZE)
var channelCache = utils.NewLru(model.CHANNEL_CACHE_SIZE)
var channelByNameCache = utils.NewLru(model.CHANNEL_CACHE_SIZE)

func ClearChannelCaches() {
	channelMemberCountsCache.Purge()
	allChannelMembersForUserCache.Purge()
	allChannelMembersNotifyPropsForChannelCache.Purge()
	channelCache.Purge()
	channelByNameCache.Purge()
}

func NewSqlChannelStore(sqlStore SqlStore) ChannelStore {
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
		table.ColMap("Purpose").SetMaxSize(250)
		table.ColMap("CreatorId").SetMaxSize(26)

		tablem := db.AddTableWithName(model.ChannelMember{}, "ChannelMembers").SetKeys(false, "ChannelId", "UserId")
		tablem.ColMap("ChannelId").SetMaxSize(26)
		tablem.ColMap("UserId").SetMaxSize(26)
		tablem.ColMap("Roles").SetMaxSize(64)
		tablem.ColMap("NotifyProps").SetMaxSize(2000)
	}

	return s
}

func (s SqlChannelStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_channels_team_id", "Channels", "TeamId")
	s.CreateIndexIfNotExists("idx_channels_name", "Channels", "Name")
	s.CreateIndexIfNotExists("idx_channels_update_at", "Channels", "UpdateAt")
	s.CreateIndexIfNotExists("idx_channels_create_at", "Channels", "CreateAt")
	s.CreateIndexIfNotExists("idx_channels_delete_at", "Channels", "DeleteAt")

	s.CreateIndexIfNotExists("idx_channelmembers_channel_id", "ChannelMembers", "ChannelId")
	s.CreateIndexIfNotExists("idx_channelmembers_user_id", "ChannelMembers", "UserId")

	s.CreateFullTextIndexIfNotExists("idx_channels_txt", "Channels", "Name, DisplayName")
}

func (s SqlChannelStore) Save(channel *model.Channel) StoreChannel {
	storeChannel := make(StoreChannel, 1)

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

func (s SqlChannelStore) CreateDirectChannel(userId string, otherUserId string) StoreChannel {
	channel := new(model.Channel)

	channel.DisplayName = ""
	channel.Name = model.GetDMNameFromIds(otherUserId, userId)

	channel.Header = ""
	channel.Type = model.CHANNEL_DIRECT

	cm1 := &model.ChannelMember{
		UserId:      userId,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
		Roles:       model.ROLE_CHANNEL_USER.Id,
	}
	cm2 := &model.ChannelMember{
		UserId:      otherUserId,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
		Roles:       model.ROLE_CHANNEL_USER.Id,
	}

	return s.SaveDirectChannel(channel, cm1, cm2)
}

func (s SqlChannelStore) SaveDirectChannel(directchannel *model.Channel, member1 *model.ChannelMember, member2 *model.ChannelMember) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		var result StoreResult

		if directchannel.Type != model.CHANNEL_DIRECT {
			result.Err = model.NewLocAppError("SqlChannelStore.SaveDirectChannel", "store.sql_channel.save_direct_channel.not_direct.app_error", nil, "")
		} else {
			if transaction, err := s.GetMaster().Begin(); err != nil {
				result.Err = model.NewLocAppError("SqlChannelStore.SaveDirectChannel", "store.sql_channel.save_direct_channel.open_transaction.app_error", nil, err.Error())
			} else {
				directchannel.TeamId = ""
				channelResult := s.saveChannelT(transaction, directchannel)

				if channelResult.Err != nil {
					transaction.Rollback()
					result.Err = channelResult.Err
					result.Data = channelResult.Data
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

	if channel.Type != model.CHANNEL_DIRECT && channel.Type != model.CHANNEL_GROUP {
		if count, err := transaction.SelectInt("SELECT COUNT(0) FROM Channels WHERE TeamId = :TeamId AND DeleteAt = 0 AND (Type = 'O' OR Type = 'P')", map[string]interface{}{"TeamId": channel.TeamId}); err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.Save", "store.sql_channel.save_channel.current_count.app_error", nil, "teamId="+channel.TeamId+", "+err.Error())
			return result
		} else if count > *utils.Cfg.TeamSettings.MaxChannelsPerTeam {
			result.Err = model.NewLocAppError("SqlChannelStore.Save", "store.sql_channel.save_channel.limit.app_error", nil, "teamId="+channel.TeamId)
			return result
		}
	}

	if err := transaction.Insert(channel); err != nil {
		if IsUniqueConstraintError(err.Error(), []string{"Name", "channels_name_teamid_key"}) {
			dupChannel := model.Channel{}
			s.GetMaster().SelectOne(&dupChannel, "SELECT * FROM Channels WHERE TeamId = :TeamId AND Name = :Name", map[string]interface{}{"TeamId": channel.TeamId, "Name": channel.Name})
			if dupChannel.DeleteAt > 0 {
				result.Err = model.NewLocAppError("SqlChannelStore.Save", "store.sql_channel.save_channel.previously.app_error", nil, "id="+channel.Id+", "+err.Error())
			} else {
				result.Err = model.NewAppError("SqlChannelStore.Save", CHANNEL_EXISTS_ERROR, nil, "id="+channel.Id+", "+err.Error(), http.StatusBadRequest)
				result.Data = &dupChannel
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

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		channel.PreUpdate()

		if result.Err = channel.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if count, err := s.GetMaster().Update(channel); err != nil {
			if IsUniqueConstraintError(err.Error(), []string{"Name", "channels_name_teamid_key"}) {
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
	storeChannel := make(StoreChannel, 1)

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

func (s SqlChannelStore) GetChannelUnread(channelId, userId string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		var unreadChannel model.ChannelUnread
		err := s.GetReplica().SelectOne(&unreadChannel,
			`SELECT
				Channels.TeamId TeamId, Channels.Id ChannelId, (Channels.TotalMsgCount - ChannelMembers.MsgCount) MsgCount, ChannelMembers.MentionCount MentionCount, ChannelMembers.NotifyProps NotifyProps
			FROM
				Channels, ChannelMembers
			WHERE
				Id = ChannelId
                AND Id = :ChannelId
                AND UserId = :UserId
                AND DeleteAt = 0`,
			map[string]interface{}{"ChannelId": channelId, "UserId": userId})

		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetChannelUnread", "store.sql_channel.get_unread.app_error", nil, "channelId="+channelId+" "+err.Error(), http.StatusInternalServerError)
			if err == sql.ErrNoRows {
				result.Err.StatusCode = http.StatusNotFound
			}
		} else {
			result.Data = &unreadChannel
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlChannelStore) InvalidateChannel(id string) {
	channelCache.Remove(id)
}

func (us SqlChannelStore) InvalidateChannelByName(teamId, name string) {
	channelByNameCache.Remove(teamId + name)
}

func (s SqlChannelStore) Get(id string, allowFromCache bool) StoreChannel {
	return s.get(id, false, allowFromCache)
}

func (s SqlChannelStore) GetPinnedPosts(channelId string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}
		pl := model.NewPostList()

		var posts []*model.Post
		if _, err := s.GetReplica().Select(&posts, "SELECT * FROM Posts WHERE IsPinned = true AND ChannelId = :ChannelId AND DeleteAt = 0 ORDER BY CreateAt ASC", map[string]interface{}{"ChannelId": channelId}); err != nil {
			result.Err = model.NewLocAppError("SqlPostStore.GetPinnedPosts", "store.sql_channel.pinned_posts.app_error", nil, err.Error())
		} else {
			for _, post := range posts {
				pl.AddPost(post)
				pl.AddOrder(post.Id)
			}
		}

		result.Data = pl

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) GetFromMaster(id string) StoreChannel {
	return s.get(id, true, false)
}

func (s SqlChannelStore) get(id string, master bool, allowFromCache bool) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}
		metrics := einterfaces.GetMetricsInterface()

		var db *gorp.DbMap
		if master {
			db = s.GetMaster()
		} else {
			db = s.GetReplica()
		}

		if allowFromCache {
			if cacheItem, ok := channelCache.Get(id); ok {
				if metrics != nil {
					metrics.IncrementMemCacheHitCounter("Channel")
				}
				result.Data = cacheItem.(*model.Channel)
				storeChannel <- result
				close(storeChannel)
				return
			} else {
				if metrics != nil {
					metrics.IncrementMemCacheMissCounter("Channel")
				}
			}
		} else {
			if metrics != nil {
				metrics.IncrementMemCacheMissCounter("Channel")
			}
		}

		if obj, err := db.Get(model.Channel{}, id); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.Get", "store.sql_channel.get.find.app_error", nil, "id="+id+", "+err.Error(), http.StatusInternalServerError)
		} else if obj == nil {
			result.Err = model.NewAppError("SqlChannelStore.Get", "store.sql_channel.get.existing.app_error", nil, "id="+id, http.StatusNotFound)
		} else {
			result.Data = obj.(*model.Channel)
			channelCache.AddWithExpiresInSecs(id, obj.(*model.Channel), CHANNEL_CACHE_SEC)
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) Delete(channelId string, time int64) StoreChannel {
	return s.SetDeleteAt(channelId, time, time)
}

func (s SqlChannelStore) Restore(channelId string, time int64) StoreChannel {
	return s.SetDeleteAt(channelId, 0, time)
}

func (s SqlChannelStore) SetDeleteAt(channelId string, deleteAt int64, updateAt int64) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		_, err := s.GetMaster().Exec("Update Channels SET DeleteAt = :DeleteAt, UpdateAt = :UpdateAt WHERE Id = :ChannelId", map[string]interface{}{"DeleteAt": deleteAt, "UpdateAt": updateAt, "ChannelId": channelId})
		if err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.Delete", "store.sql_channel.delete.channel.app_error", nil, "id="+channelId+", err="+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) PermanentDeleteByTeam(teamId string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

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

func (s SqlChannelStore) PermanentDelete(channelId string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		if _, err := s.GetMaster().Exec("DELETE FROM Channels WHERE Id = :ChannelId", map[string]interface{}{"ChannelId": channelId}); err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.PermanentDelete", "store.sql_channel.permanent_delete.app_error", nil, "channel_id="+channelId+", "+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) PermanentDeleteMembersByChannel(channelId string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		_, err := s.GetMaster().Exec("DELETE FROM ChannelMembers WHERE ChannelId = :ChannelId", map[string]interface{}{"ChannelId": channelId})
		if err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.RemoveAllMembersByChannel", "store.sql_channel.remove_member.app_error", nil, "channel_id="+channelId+", "+err.Error())
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
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		data := &model.ChannelList{}
		_, err := s.GetReplica().Select(data, "SELECT Channels.* FROM Channels, ChannelMembers WHERE Id = ChannelId AND UserId = :UserId AND DeleteAt = 0 AND (TeamId = :TeamId OR TeamId = '') ORDER BY DisplayName", map[string]interface{}{"TeamId": teamId, "UserId": userId})

		if err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.GetChannels", "store.sql_channel.get_channels.get.app_error", nil, "teamId="+teamId+", userId="+userId+", err="+err.Error())
		} else {
			if len(*data) == 0 {
				result.Err = model.NewAppError("SqlChannelStore.GetChannels", "store.sql_channel.get_channels.not_found.app_error", nil, "teamId="+teamId+", userId="+userId, http.StatusBadRequest)
			} else {
				result.Data = data
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) GetMoreChannels(teamId string, userId string, offset int, limit int) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		data := &model.ChannelList{}
		_, err := s.GetReplica().Select(data,
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
			ORDER BY DisplayName
			LIMIT :Limit
			OFFSET :Offset`,
			map[string]interface{}{"TeamId1": teamId, "TeamId2": teamId, "UserId": userId, "Limit": limit, "Offset": offset})

		if err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.GetMoreChannels", "store.sql_channel.get_more_channels.get.app_error", nil, "teamId="+teamId+", userId="+userId+", err="+err.Error())
		} else {
			result.Data = data
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) GetPublicChannelsForTeam(teamId string, offset int, limit int) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		data := &model.ChannelList{}
		_, err := s.GetReplica().Select(data,
			`SELECT
			    *
			FROM
			    Channels
			WHERE
			    TeamId = :TeamId
					AND Type = 'O'
					AND DeleteAt = 0
			ORDER BY DisplayName
			LIMIT :Limit
			OFFSET :Offset`,
			map[string]interface{}{"TeamId": teamId, "Limit": limit, "Offset": offset})

		if err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.GetPublicChannelsForTeam", "store.sql_channel.get_public_channels.get.app_error", nil, "teamId="+teamId+", err="+err.Error())
		} else {
			result.Data = data
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) GetPublicChannelsByIdsForTeam(teamId string, channelIds []string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		props := make(map[string]interface{})
		props["teamId"] = teamId

		idQuery := ""

		for index, channelId := range channelIds {
			if len(idQuery) > 0 {
				idQuery += ", "
			}

			props["channelId"+strconv.Itoa(index)] = channelId
			idQuery += ":channelId" + strconv.Itoa(index)
		}

		data := &model.ChannelList{}
		_, err := s.GetReplica().Select(data,
			`SELECT
			    *
			FROM
			    Channels
			WHERE
			    TeamId = :teamId
					AND Type = 'O'
					AND DeleteAt = 0
					AND Id IN (`+idQuery+`)
			ORDER BY DisplayName`,
			props)

		if err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.GetPublicChannelsByIdsForTeam", "store.sql_channel.get_channels_by_ids.get.app_error", nil, err.Error())
		}

		if len(*data) == 0 {
			result.Err = model.NewAppError("SqlChannelStore.GetPublicChannelsByIdsForTeam", "store.sql_channel.get_channels_by_ids.not_found.app_error", nil, "", http.StatusNotFound)
		}

		result.Data = data
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
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		var data []channelIdWithCountAndUpdateAt
		_, err := s.GetReplica().Select(&data, "SELECT Id, TotalMsgCount, UpdateAt FROM Channels WHERE Id IN (SELECT ChannelId FROM ChannelMembers WHERE UserId = :UserId) AND (TeamId = :TeamId OR TeamId = '') AND DeleteAt = 0 ORDER BY DisplayName", map[string]interface{}{"TeamId": teamId, "UserId": userId})

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

func (s SqlChannelStore) GetTeamChannels(teamId string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		data := &model.ChannelList{}
		_, err := s.GetReplica().Select(data, "SELECT * FROM Channels WHERE TeamId = :TeamId And Type != 'D' ORDER BY DisplayName", map[string]interface{}{"TeamId": teamId})

		if err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.GetChannels", "store.sql_channel.get_channels.get.app_error", nil, "teamId="+teamId+",  err="+err.Error())
		} else {
			if len(*data) == 0 {
				result.Err = model.NewLocAppError("SqlChannelStore.GetChannels", "store.sql_channel.get_channels.not_found.app_error", nil, "teamId="+teamId)
			} else {
				result.Data = data
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) GetByName(teamId string, name string, allowFromCache bool) StoreChannel {
	return s.getByName(teamId, name, false, allowFromCache)
}

func (s SqlChannelStore) GetByNameIncludeDeleted(teamId string, name string, allowFromCache bool) StoreChannel {
	return s.getByName(teamId, name, true, allowFromCache)
}

func (s SqlChannelStore) getByName(teamId string, name string, includeDeleted bool, allowFromCache bool) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	var query string
	if includeDeleted {
		query = "SELECT * FROM Channels WHERE (TeamId = :TeamId OR TeamId = '') AND Name = :Name"
	} else {
		query = "SELECT * FROM Channels WHERE (TeamId = :TeamId OR TeamId = '') AND Name = :Name AND DeleteAt = 0"
	}

	go func() {
		result := StoreResult{}

		channel := model.Channel{}

		if allowFromCache {
			metrics := einterfaces.GetMetricsInterface()
			if cacheItem, ok := channelByNameCache.Get(teamId + name); ok {
				if metrics != nil {
					metrics.IncrementMemCacheHitCounter("Channel By Name")
				}
				result.Data = cacheItem.(*model.Channel)
				storeChannel <- result
				close(storeChannel)
				return
			} else {
				if metrics != nil {
					metrics.IncrementMemCacheMissCounter("Channel By Name")
				}
			}
		}
		if err := s.GetReplica().SelectOne(&channel, query, map[string]interface{}{"TeamId": teamId, "Name": name}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewLocAppError("SqlChannelStore.GetByName", MISSING_CHANNEL_ERROR, nil, "teamId="+teamId+", "+"name="+name+", "+err.Error())
			} else {
				result.Err = model.NewLocAppError("SqlChannelStore.GetByName", "store.sql_channel.get_by_name.existing.app_error", nil, "teamId="+teamId+", "+"name="+name+", "+err.Error())
			}
		} else {
			result.Data = &channel
			channelByNameCache.AddWithExpiresInSecs(teamId+name, &channel, CHANNEL_CACHE_SEC)
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) GetDeletedByName(teamId string, name string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		channel := model.Channel{}

		if err := s.GetReplica().SelectOne(&channel, "SELECT * FROM Channels WHERE (TeamId = :TeamId OR TeamId = '') AND Name = :Name AND DeleteAt != 0", map[string]interface{}{"TeamId": teamId, "Name": name}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewLocAppError("SqlChannelStore.GetDeletedByName", "store.sql_channel.get_deleted_by_name.missing.app_error", nil, "teamId="+teamId+", "+"name="+name+", "+err.Error())
			} else {
				result.Err = model.NewLocAppError("SqlChannelStore.GetDeletedByName", "store.sql_channel.get_deleted_by_name.existing.app_error", nil, "teamId="+teamId+", "+"name="+name+", "+err.Error())
			}
		} else {
			result.Data = &channel
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) GetDeleted(teamId string, offset int, limit int) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		channels := &model.ChannelList{}

		if _, err := s.GetReplica().Select(channels, "SELECT * FROM Channels WHERE (TeamId = :TeamId OR TeamId = '') AND DeleteAt != 0 ORDER BY DisplayName LIMIT :Limit OFFSET :Offset", map[string]interface{}{"TeamId": teamId, "Limit": limit, "Offset": offset}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewLocAppError("SqlChannelStore.GetDeleted", "store.sql_channel.get_deleted.missing.app_error", nil, "teamId="+teamId+", "+err.Error())
			} else {
				result.Err = model.NewLocAppError("SqlChannelStore.GetDeleted", "store.sql_channel.get_deleted.existing.app_error", nil, "teamId="+teamId+", "+err.Error())
			}
		} else {
			result.Data = channels
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) SaveMember(member *model.ChannelMember) StoreChannel {
	storeChannel := make(StoreChannel, 1)

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

		s.InvalidateAllChannelMembersForUser(member.UserId)

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
		if IsUniqueConstraintError(err.Error(), []string{"ChannelId", "channelmembers_pkey"}) {
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
	storeChannel := make(StoreChannel, 1)

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

func (s SqlChannelStore) GetMembers(channelId string, offset, limit int) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		var members model.ChannelMembers
		_, err := s.GetReplica().Select(&members, "SELECT * FROM ChannelMembers WHERE ChannelId = :ChannelId LIMIT :Limit OFFSET :Offset", map[string]interface{}{"ChannelId": channelId, "Limit": limit, "Offset": offset})
		if err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.GetMembers", "store.sql_channel.get_members.app_error", nil, "channel_id="+channelId+err.Error())
		} else {
			result.Data = &members
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) GetMember(channelId string, userId string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		var member model.ChannelMember

		if err := s.GetReplica().SelectOne(&member, "SELECT * FROM ChannelMembers WHERE ChannelId = :ChannelId AND UserId = :UserId", map[string]interface{}{"ChannelId": channelId, "UserId": userId}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlChannelStore.GetMember", MISSING_CHANNEL_MEMBER_ERROR, nil, "channel_id="+channelId+"user_id="+userId+","+err.Error(), http.StatusNotFound)
			} else {
				result.Err = model.NewLocAppError("SqlChannelStore.GetMember", "store.sql_channel.get_member.app_error", nil, "channel_id="+channelId+"user_id="+userId+","+err.Error())
			}
		} else {
			result.Data = &member
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlChannelStore) InvalidateAllChannelMembersForUser(userId string) {
	allChannelMembersForUserCache.Remove(userId)
}

func (us SqlChannelStore) IsUserInChannelUseCache(userId string, channelId string) bool {
	metrics := einterfaces.GetMetricsInterface()
	if cacheItem, ok := allChannelMembersForUserCache.Get(userId); ok {
		if metrics != nil {
			metrics.IncrementMemCacheHitCounter("All Channel Members for User")
		}
		ids := cacheItem.(map[string]string)
		if _, ok := ids[channelId]; ok {
			return true
		} else {
			return false
		}
	} else {
		if metrics != nil {
			metrics.IncrementMemCacheMissCounter("All Channel Members for User")
		}
	}

	if result := <-us.GetAllChannelMembersForUser(userId, true); result.Err != nil {
		l4g.Error("SqlChannelStore.IsUserInChannelUseCache: " + result.Err.Error())
		return false
	} else {
		ids := result.Data.(map[string]string)
		if _, ok := ids[channelId]; ok {
			return true
		} else {
			return false
		}
	}
}

func (s SqlChannelStore) GetMemberForPost(postId string, userId string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		member := &model.ChannelMember{}
		if err := s.GetReplica().SelectOne(
			member,
			`SELECT
				ChannelMembers.*
			FROM
				ChannelMembers,
				Posts
			WHERE
				ChannelMembers.ChannelId = Posts.ChannelId
				AND ChannelMembers.UserId = :UserId
				AND Posts.Id = :PostId`, map[string]interface{}{"UserId": userId, "PostId": postId}); err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.GetMemberForPost", "store.sql_channel.get_member_for_post.app_error", nil, "postId="+postId+", err="+err.Error())
		} else {
			result.Data = member
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

type allChannelMember struct {
	ChannelId string
	Roles     string
}

func (s SqlChannelStore) GetAllChannelMembersForUser(userId string, allowFromCache bool) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}
		metrics := einterfaces.GetMetricsInterface()

		if allowFromCache {
			if cacheItem, ok := allChannelMembersForUserCache.Get(userId); ok {
				if metrics != nil {
					metrics.IncrementMemCacheHitCounter("All Channel Members for User")
				}
				result.Data = cacheItem.(map[string]string)
				storeChannel <- result
				close(storeChannel)
				return
			} else {
				if metrics != nil {
					metrics.IncrementMemCacheMissCounter("All Channel Members for User")
				}
			}
		} else {
			if metrics != nil {
				metrics.IncrementMemCacheMissCounter("All Channel Members for User")
			}
		}

		var data []allChannelMember
		_, err := s.GetReplica().Select(&data, "SELECT ChannelId, Roles FROM Channels, ChannelMembers WHERE Channels.Id = ChannelMembers.ChannelId AND ChannelMembers.UserId = :UserId AND Channels.DeleteAt = 0", map[string]interface{}{"UserId": userId})

		if err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.GetAllChannelMembersForUser", "store.sql_channel.get_channels.get.app_error", nil, "userId="+userId+", err="+err.Error())
		} else {

			ids := make(map[string]string)
			for i := range data {
				ids[data[i].ChannelId] = data[i].Roles
			}

			result.Data = ids

			if allowFromCache {
				allChannelMembersForUserCache.AddWithExpiresInSecs(userId, ids, ALL_CHANNEL_MEMBERS_FOR_USER_CACHE_SEC)
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlChannelStore) InvalidateCacheForChannelMembersNotifyProps(channelId string) {
	allChannelMembersNotifyPropsForChannelCache.Remove(channelId)
}

type allChannelMemberNotifyProps struct {
	UserId      string
	NotifyProps model.StringMap
}

func (s SqlChannelStore) GetAllChannelMembersNotifyPropsForChannel(channelId string, allowFromCache bool) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}
		metrics := einterfaces.GetMetricsInterface()

		if allowFromCache {
			if cacheItem, ok := allChannelMembersNotifyPropsForChannelCache.Get(channelId); ok {
				if metrics != nil {
					metrics.IncrementMemCacheHitCounter("All Channel Members Notify Props for Channel")
				}
				result.Data = cacheItem.(map[string]model.StringMap)
				storeChannel <- result
				close(storeChannel)
				return
			} else {
				if metrics != nil {
					metrics.IncrementMemCacheMissCounter("All Channel Members Notify Props for Channel")
				}
			}
		} else {
			if metrics != nil {
				metrics.IncrementMemCacheMissCounter("All Channel Members Notify Props for Channel")
			}
		}

		var data []allChannelMemberNotifyProps
		_, err := s.GetReplica().Select(&data, `
			SELECT ChannelMembers.UserId, ChannelMembers.NotifyProps
			FROM Channels, ChannelMembers
			WHERE Channels.Id = ChannelMembers.ChannelId AND ChannelMembers.ChannelId = :ChannelId`, map[string]interface{}{"ChannelId": channelId})

		if err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.GetAllChannelMembersPropsForChannel", "store.sql_channel.get_members.app_error", nil, "channelId="+channelId+", err="+err.Error())
		} else {

			props := make(map[string]model.StringMap)
			for i := range data {
				props[data[i].UserId] = data[i].NotifyProps
			}

			result.Data = props

			allChannelMembersNotifyPropsForChannelCache.AddWithExpiresInSecs(channelId, props, ALL_CHANNEL_MEMBERS_NOTIFY_PROPS_FOR_CHANNEL_CACHE_SEC)
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlChannelStore) InvalidateMemberCount(channelId string) {
	channelMemberCountsCache.Remove(channelId)
}

func (s SqlChannelStore) GetMemberCountFromCache(channelId string) int64 {
	metrics := einterfaces.GetMetricsInterface()

	if cacheItem, ok := channelMemberCountsCache.Get(channelId); ok {
		if metrics != nil {
			metrics.IncrementMemCacheHitCounter("Channel Member Counts")
		}
		return cacheItem.(int64)
	} else {
		if metrics != nil {
			metrics.IncrementMemCacheMissCounter("Channel Member Counts")
		}
	}

	if result := <-s.GetMemberCount(channelId, true); result.Err != nil {
		return 0
	} else {
		return result.Data.(int64)
	}
}

func (s SqlChannelStore) GetMemberCount(channelId string, allowFromCache bool) StoreChannel {
	storeChannel := make(StoreChannel, 1)
	metrics := einterfaces.GetMetricsInterface()

	go func() {
		result := StoreResult{}

		if allowFromCache {
			if cacheItem, ok := channelMemberCountsCache.Get(channelId); ok {
				if metrics != nil {
					metrics.IncrementMemCacheHitCounter("Channel Member Counts")
				}
				result.Data = cacheItem.(int64)
				storeChannel <- result
				close(storeChannel)
				return
			} else {
				if metrics != nil {
					metrics.IncrementMemCacheMissCounter("Channel Member Counts")
				}
			}
		} else {
			if metrics != nil {
				metrics.IncrementMemCacheMissCounter("Channel Member Counts")
			}
		}

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

			if allowFromCache {
				channelMemberCountsCache.AddWithExpiresInSecs(channelId, count, CHANNEL_MEMBERS_COUNTS_CACHE_SEC)
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) RemoveMember(channelId string, userId string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		// Grab the channel we are saving this member to
		if cr := <-s.Get(channelId, true); cr.Err != nil {
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
	storeChannel := make(StoreChannel, 1)

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

func (s SqlChannelStore) UpdateLastViewedAt(channelIds []string, userId string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		var query string
		props := make(map[string]interface{})

		idQuery := ""
		for index, channelId := range channelIds {
			if len(idQuery) > 0 {
				idQuery += " OR "
			}

			props["channelId"+strconv.Itoa(index)] = channelId
			idQuery += "ChannelId = :channelId" + strconv.Itoa(index)
		}

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
			        AND (` + idQuery + `)`
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
			        AND (` + idQuery + `)`
		}

		props["UserId"] = userId

		_, err := s.GetMaster().Exec(query, props)
		if err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.UpdateLastViewedAt", "store.sql_channel.update_last_viewed_at.app_error", nil, "channel_ids="+strings.Join(channelIds, ",")+", user_id="+userId+", "+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) IncrementMentionCount(channelId string, userId string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		_, err := s.GetMaster().Exec(
			`UPDATE
				ChannelMembers
			SET
				MentionCount = MentionCount + 1,
				LastUpdateAt = :LastUpdateAt
			WHERE
				UserId = :UserId
					AND ChannelId = :ChannelId`,
			map[string]interface{}{"ChannelId": channelId, "UserId": userId, "LastUpdateAt": model.GetMillis()})
		if err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.IncrementMentionCount", "store.sql_channel.increment_mention_count.app_error", nil, "channel_id="+channelId+", user_id="+userId+", "+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) GetAll(teamId string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		var data []*model.Channel
		_, err := s.GetReplica().Select(&data, "SELECT * FROM Channels WHERE TeamId = :TeamId AND Type != 'D' ORDER BY Name", map[string]interface{}{"TeamId": teamId})

		if err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.GetAll", "store.sql_channel.get_all.app_error", nil, "teamId="+teamId+", err="+err.Error())
		} else {
			result.Data = data
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) GetForPost(postId string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		channel := &model.Channel{}
		if err := s.GetReplica().SelectOne(
			channel,
			`SELECT
				Channels.*
			FROM
				Channels,
				Posts
			WHERE
				Channels.Id = Posts.ChannelId
				AND Posts.Id = :PostId`, map[string]interface{}{"PostId": postId}); err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.GetForPost", "store.sql_channel.get_for_post.app_error", nil, "postId="+postId+", err="+err.Error())
		} else {
			result.Data = channel
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) AnalyticsTypeCount(teamId string, channelType string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

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

func (s SqlChannelStore) AnalyticsDeletedTypeCount(teamId string, channelType string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		query := "SELECT COUNT(Id) AS Value FROM Channels WHERE Type = :ChannelType AND DeleteAt > 0"

		if len(teamId) > 0 {
			query += " AND TeamId = :TeamId"
		}

		v, err := s.GetReplica().SelectInt(query, map[string]interface{}{"TeamId": teamId, "ChannelType": channelType})
		if err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.AnalyticsDeletedTypeCount", "store.sql_channel.analytics_deleted_type_count.app_error", nil, err.Error())
		} else {
			result.Data = v
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) ExtraUpdateByUser(userId string, time int64) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		_, err := s.GetMaster().Exec(
			`UPDATE Channels SET ExtraUpdateAt = :Time
			WHERE Id IN (SELECT ChannelId FROM ChannelMembers WHERE UserId = :UserId);`,
			map[string]interface{}{"UserId": userId, "Time": time})

		if err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.extraUpdated", "store.sql_channel.extra_updated.app_error", nil, "user_id="+userId+", "+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) GetMembersForUser(teamId string, userId string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		members := &model.ChannelMembers{}
		_, err := s.GetReplica().Select(members, `
            SELECT cm.*
            FROM ChannelMembers cm
            INNER JOIN Channels c
                ON c.Id = cm.ChannelId
                AND (c.TeamId = :TeamId OR c.TeamId = '')
                AND c.DeleteAt = 0
            WHERE cm.UserId = :UserId
		`, map[string]interface{}{"TeamId": teamId, "UserId": userId})

		if err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.GetMembersForUser", "store.sql_channel.get_members.app_error", nil, "teamId="+teamId+", userId="+userId+", err="+err.Error())
		} else {
			result.Data = members
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) SearchInTeam(teamId string, term string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		searchQuery := `
			SELECT
			    *
			FROM
			    Channels
			WHERE
			    TeamId = :TeamId
				AND Type = 'O'
				AND DeleteAt = 0
			    SEARCH_CLAUSE
			ORDER BY DisplayName
			LIMIT 100`

		storeChannel <- s.performSearch(searchQuery, term, map[string]interface{}{"TeamId": teamId})
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) SearchMore(userId string, teamId string, term string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		searchQuery := `
			SELECT
			    *
			FROM
			    Channels
			WHERE
			    TeamId = :TeamId
				AND Type = 'O'
				AND DeleteAt = 0
			    AND Id NOT IN (SELECT
			        Channels.Id
			    FROM
			        Channels,
			        ChannelMembers
			    WHERE
			        Id = ChannelId
			        AND TeamId = :TeamId
			        AND UserId = :UserId
			        AND DeleteAt = 0)
			    SEARCH_CLAUSE
			ORDER BY DisplayName
			LIMIT 100`

		storeChannel <- s.performSearch(searchQuery, term, map[string]interface{}{"TeamId": teamId, "UserId": userId})
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlChannelStore) performSearch(searchQuery string, term string, parameters map[string]interface{}) StoreResult {
	result := StoreResult{}

	// these chars have special meaning and can be treated as spaces
	for _, c := range specialUserSearchChar {
		term = strings.Replace(term, c, " ", -1)
	}

	if term == "" {
		searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", "", 1)
	} else if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
		splitTerm := strings.Fields(term)
		for i, t := range strings.Fields(term) {
			if i == len(splitTerm)-1 {
				splitTerm[i] = t + ":*"
			} else {
				splitTerm[i] = t + ":* &"
			}
		}

		term = strings.Join(splitTerm, " ")

		searchClause := fmt.Sprintf("AND (%s) @@  to_tsquery('simple', :Term)", "Name || ' ' || DisplayName")
		searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", searchClause, 1)
	} else if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_MYSQL {
		splitTerm := strings.Fields(term)
		for i, t := range strings.Fields(term) {
			splitTerm[i] = "+" + t + "*"
		}

		term = strings.Join(splitTerm, " ")

		searchClause := fmt.Sprintf("AND MATCH(%s) AGAINST (:Term IN BOOLEAN MODE)", "Name, DisplayName")
		searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", searchClause, 1)
	}

	var channels model.ChannelList

	parameters["Term"] = term

	if _, err := s.GetReplica().Select(&channels, searchQuery, parameters); err != nil {
		result.Err = model.NewLocAppError("SqlChannelStore.Search", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error())
	} else {
		result.Data = &channels
	}

	return result
}

func (s SqlChannelStore) GetMembersByIds(channelId string, userIds []string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		var members model.ChannelMembers
		props := make(map[string]interface{})
		idQuery := ""

		for index, userId := range userIds {
			if len(idQuery) > 0 {
				idQuery += ", "
			}

			props["userId"+strconv.Itoa(index)] = userId
			idQuery += ":userId" + strconv.Itoa(index)
		}

		props["ChannelId"] = channelId

		if _, err := s.GetReplica().Select(&members, "SELECT * FROM ChannelMembers WHERE ChannelId = :ChannelId AND UserId IN ("+idQuery+")", props); err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.GetMembersByIds", "store.sql_channel.get_members_by_ids.app_error", nil, "channelId="+channelId+" "+err.Error())
		} else {
			result.Data = &members

		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
