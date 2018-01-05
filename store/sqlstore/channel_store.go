// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
)

const (
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
	metrics einterfaces.MetricsInterface
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

func NewSqlChannelStore(sqlStore SqlStore, metrics einterfaces.MetricsInterface) store.ChannelStore {
	s := &SqlChannelStore{
		SqlStore: sqlStore,
		metrics:  metrics,
	}

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

	if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		s.CreateIndexIfNotExists("idx_channels_name_lower", "Channels", "lower(Name)")
		s.CreateIndexIfNotExists("idx_channels_displayname_lower", "Channels", "lower(DisplayName)")
	}

	s.CreateIndexIfNotExists("idx_channelmembers_channel_id", "ChannelMembers", "ChannelId")
	s.CreateIndexIfNotExists("idx_channelmembers_user_id", "ChannelMembers", "UserId")

	s.CreateFullTextIndexIfNotExists("idx_channels_txt", "Channels", "Name, DisplayName")
}

func (s SqlChannelStore) Save(channel *model.Channel, maxChannelsPerTeam int64) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if channel.Type == model.CHANNEL_DIRECT {
			result.Err = model.NewAppError("SqlChannelStore.Save", "store.sql_channel.save.direct_channel.app_error", nil, "", http.StatusBadRequest)
		} else {
			if transaction, err := s.GetMaster().Begin(); err != nil {
				result.Err = model.NewAppError("SqlChannelStore.Save", "store.sql_channel.save.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			} else {
				*result = s.saveChannelT(transaction, channel, maxChannelsPerTeam)
				if result.Err != nil {
					transaction.Rollback()
				} else {
					if err := transaction.Commit(); err != nil {
						result.Err = model.NewAppError("SqlChannelStore.Save", "store.sql_channel.save.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
					}
				}
			}
		}
	})
}

func (s SqlChannelStore) CreateDirectChannel(userId string, otherUserId string) store.StoreChannel {
	channel := new(model.Channel)

	channel.DisplayName = ""
	channel.Name = model.GetDMNameFromIds(otherUserId, userId)

	channel.Header = ""
	channel.Type = model.CHANNEL_DIRECT

	cm1 := &model.ChannelMember{
		UserId:      userId,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
		Roles:       model.CHANNEL_USER_ROLE_ID,
	}
	cm2 := &model.ChannelMember{
		UserId:      otherUserId,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
		Roles:       model.CHANNEL_USER_ROLE_ID,
	}

	return s.SaveDirectChannel(channel, cm1, cm2)
}

func (s SqlChannelStore) SaveDirectChannel(directchannel *model.Channel, member1 *model.ChannelMember, member2 *model.ChannelMember) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if directchannel.Type != model.CHANNEL_DIRECT {
			result.Err = model.NewAppError("SqlChannelStore.SaveDirectChannel", "store.sql_channel.save_direct_channel.not_direct.app_error", nil, "", http.StatusBadRequest)
		} else {
			if transaction, err := s.GetMaster().Begin(); err != nil {
				result.Err = model.NewAppError("SqlChannelStore.SaveDirectChannel", "store.sql_channel.save_direct_channel.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			} else {
				directchannel.TeamId = ""
				channelResult := s.saveChannelT(transaction, directchannel, 0)

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
					member2Result := member1Result
					if member1.UserId != member2.UserId {
						member2Result = s.saveMemberT(transaction, member2, newChannel)
					}

					if member1Result.Err != nil || member2Result.Err != nil {
						transaction.Rollback()
						details := ""
						if member1Result.Err != nil {
							details += "Member1Err: " + member1Result.Err.Message
						}
						if member2Result.Err != nil {
							details += "Member2Err: " + member2Result.Err.Message
						}
						result.Err = model.NewAppError("SqlChannelStore.SaveDirectChannel", "store.sql_channel.save_direct_channel.add_members.app_error", nil, details, http.StatusInternalServerError)
					} else {
						if err := transaction.Commit(); err != nil {
							result.Err = model.NewAppError("SqlChannelStore.SaveDirectChannel", "store.sql_channel.save_direct_channel.commit.app_error", nil, err.Error(), http.StatusInternalServerError)
						} else {
							*result = channelResult
						}
					}
				}
			}
		}
	})
}

func (s SqlChannelStore) saveChannelT(transaction *gorp.Transaction, channel *model.Channel, maxChannelsPerTeam int64) store.StoreResult {
	result := store.StoreResult{}

	if len(channel.Id) > 0 {
		result.Err = model.NewAppError("SqlChannelStore.Save", "store.sql_channel.save_channel.existing.app_error", nil, "id="+channel.Id, http.StatusBadRequest)
		return result
	}

	channel.PreSave()
	if result.Err = channel.IsValid(); result.Err != nil {
		return result
	}

	if channel.Type != model.CHANNEL_DIRECT && channel.Type != model.CHANNEL_GROUP && maxChannelsPerTeam >= 0 {
		if count, err := transaction.SelectInt("SELECT COUNT(0) FROM Channels WHERE TeamId = :TeamId AND DeleteAt = 0 AND (Type = 'O' OR Type = 'P')", map[string]interface{}{"TeamId": channel.TeamId}); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.Save", "store.sql_channel.save_channel.current_count.app_error", nil, "teamId="+channel.TeamId+", "+err.Error(), http.StatusInternalServerError)
			return result
		} else if count >= maxChannelsPerTeam {
			result.Err = model.NewAppError("SqlChannelStore.Save", "store.sql_channel.save_channel.limit.app_error", nil, "teamId="+channel.TeamId, http.StatusBadRequest)
			return result
		}
	}

	if err := transaction.Insert(channel); err != nil {
		if IsUniqueConstraintError(err, []string{"Name", "channels_name_teamid_key"}) {
			dupChannel := model.Channel{}
			s.GetMaster().SelectOne(&dupChannel, "SELECT * FROM Channels WHERE TeamId = :TeamId AND Name = :Name", map[string]interface{}{"TeamId": channel.TeamId, "Name": channel.Name})
			if dupChannel.DeleteAt > 0 {
				result.Err = model.NewAppError("SqlChannelStore.Save", "store.sql_channel.save_channel.previously.app_error", nil, "id="+channel.Id+", "+err.Error(), http.StatusBadRequest)
			} else {
				result.Err = model.NewAppError("SqlChannelStore.Save", store.CHANNEL_EXISTS_ERROR, nil, "id="+channel.Id+", "+err.Error(), http.StatusBadRequest)
				result.Data = &dupChannel
			}
		} else {
			result.Err = model.NewAppError("SqlChannelStore.Save", "store.sql_channel.save_channel.save.app_error", nil, "id="+channel.Id+", "+err.Error(), http.StatusInternalServerError)
		}
	} else {
		result.Data = channel
	}

	return result
}

func (s SqlChannelStore) Update(channel *model.Channel) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		channel.PreUpdate()

		if result.Err = channel.IsValid(); result.Err != nil {
			return
		}

		if count, err := s.GetMaster().Update(channel); err != nil {
			if IsUniqueConstraintError(err, []string{"Name", "channels_name_teamid_key"}) {
				dupChannel := model.Channel{}
				s.GetReplica().SelectOne(&dupChannel, "SELECT * FROM Channels WHERE TeamId = :TeamId AND Name= :Name AND DeleteAt > 0", map[string]interface{}{"TeamId": channel.TeamId, "Name": channel.Name})
				if dupChannel.DeleteAt > 0 {
					result.Err = model.NewAppError("SqlChannelStore.Update", "store.sql_channel.update.previously.app_error", nil, "id="+channel.Id+", "+err.Error(), http.StatusBadRequest)
				} else {
					result.Err = model.NewAppError("SqlChannelStore.Update", "store.sql_channel.update.exists.app_error", nil, "id="+channel.Id+", "+err.Error(), http.StatusBadRequest)
				}
			} else {
				result.Err = model.NewAppError("SqlChannelStore.Update", "store.sql_channel.update.updating.app_error", nil, "id="+channel.Id+", "+err.Error(), http.StatusInternalServerError)
			}
		} else if count != 1 {
			result.Err = model.NewAppError("SqlChannelStore.Update", "store.sql_channel.update.app_error", nil, "id="+channel.Id, http.StatusInternalServerError)
		} else {
			result.Data = channel
		}
	})
}

func (s SqlChannelStore) extraUpdated(channel *model.Channel) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
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
			result.Err = model.NewAppError("SqlChannelStore.extraUpdated", "store.sql_channel.extra_updated.app_error", nil, "id="+channel.Id+", "+err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s SqlChannelStore) GetChannelUnread(channelId, userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
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
	})
}

func (us SqlChannelStore) InvalidateChannel(id string) {
	channelCache.Remove(id)
}

func (us SqlChannelStore) InvalidateChannelByName(teamId, name string) {
	channelByNameCache.Remove(teamId + name)
}

func (s SqlChannelStore) Get(id string, allowFromCache bool) store.StoreChannel {
	return s.get(id, false, allowFromCache)
}

func (s SqlChannelStore) GetPinnedPosts(channelId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		pl := model.NewPostList()

		var posts []*model.Post
		if _, err := s.GetReplica().Select(&posts, "SELECT * FROM Posts WHERE IsPinned = true AND ChannelId = :ChannelId AND DeleteAt = 0 ORDER BY CreateAt ASC", map[string]interface{}{"ChannelId": channelId}); err != nil {
			result.Err = model.NewAppError("SqlPostStore.GetPinnedPosts", "store.sql_channel.pinned_posts.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			for _, post := range posts {
				pl.AddPost(post)
				pl.AddOrder(post.Id)
			}
		}

		result.Data = pl
	})
}

func (s SqlChannelStore) GetFromMaster(id string) store.StoreChannel {
	return s.get(id, true, false)
}

func (s SqlChannelStore) get(id string, master bool, allowFromCache bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var db *gorp.DbMap
		if master {
			db = s.GetMaster()
		} else {
			db = s.GetReplica()
		}

		if allowFromCache {
			if cacheItem, ok := channelCache.Get(id); ok {
				if s.metrics != nil {
					s.metrics.IncrementMemCacheHitCounter("Channel")
				}
				result.Data = (cacheItem.(*model.Channel)).DeepCopy()
				return
			} else {
				if s.metrics != nil {
					s.metrics.IncrementMemCacheMissCounter("Channel")
				}
			}
		} else {
			if s.metrics != nil {
				s.metrics.IncrementMemCacheMissCounter("Channel")
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
	})
}

func (s SqlChannelStore) Delete(channelId string, time int64) store.StoreChannel {
	return s.SetDeleteAt(channelId, time, time)
}

func (s SqlChannelStore) Restore(channelId string, time int64) store.StoreChannel {
	return s.SetDeleteAt(channelId, 0, time)
}

func (s SqlChannelStore) SetDeleteAt(channelId string, deleteAt int64, updateAt int64) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		_, err := s.GetMaster().Exec("Update Channels SET DeleteAt = :DeleteAt, UpdateAt = :UpdateAt WHERE Id = :ChannelId", map[string]interface{}{"DeleteAt": deleteAt, "UpdateAt": updateAt, "ChannelId": channelId})
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.Delete", "store.sql_channel.delete.channel.app_error", nil, "id="+channelId+", err="+err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s SqlChannelStore) PermanentDeleteByTeam(teamId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := s.GetMaster().Exec("DELETE FROM Channels WHERE TeamId = :TeamId", map[string]interface{}{"TeamId": teamId}); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.PermanentDeleteByTeam", "store.sql_channel.permanent_delete_by_team.app_error", nil, "teamId="+teamId+", "+err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s SqlChannelStore) PermanentDelete(channelId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := s.GetMaster().Exec("DELETE FROM Channels WHERE Id = :ChannelId", map[string]interface{}{"ChannelId": channelId}); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.PermanentDelete", "store.sql_channel.permanent_delete.app_error", nil, "channel_id="+channelId+", "+err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s SqlChannelStore) PermanentDeleteMembersByChannel(channelId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		_, err := s.GetMaster().Exec("DELETE FROM ChannelMembers WHERE ChannelId = :ChannelId", map[string]interface{}{"ChannelId": channelId})
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.RemoveAllMembersByChannel", "store.sql_channel.remove_member.app_error", nil, "channel_id="+channelId+", "+err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s SqlChannelStore) GetChannels(teamId string, userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		data := &model.ChannelList{}
		_, err := s.GetReplica().Select(data, "SELECT Channels.* FROM Channels, ChannelMembers WHERE Id = ChannelId AND UserId = :UserId AND DeleteAt = 0 AND (TeamId = :TeamId OR TeamId = '') ORDER BY DisplayName", map[string]interface{}{"TeamId": teamId, "UserId": userId})

		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetChannels", "store.sql_channel.get_channels.get.app_error", nil, "teamId="+teamId+", userId="+userId+", err="+err.Error(), http.StatusInternalServerError)
		} else {
			if len(*data) == 0 {
				result.Err = model.NewAppError("SqlChannelStore.GetChannels", "store.sql_channel.get_channels.not_found.app_error", nil, "teamId="+teamId+", userId="+userId, http.StatusBadRequest)
			} else {
				result.Data = data
			}
		}
	})
}

func (s SqlChannelStore) GetMoreChannels(teamId string, userId string, offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
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
			result.Err = model.NewAppError("SqlChannelStore.GetMoreChannels", "store.sql_channel.get_more_channels.get.app_error", nil, "teamId="+teamId+", userId="+userId+", err="+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = data
		}
	})
}

func (s SqlChannelStore) GetPublicChannelsForTeam(teamId string, offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
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
			result.Err = model.NewAppError("SqlChannelStore.GetPublicChannelsForTeam", "store.sql_channel.get_public_channels.get.app_error", nil, "teamId="+teamId+", err="+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = data
		}
	})
}

func (s SqlChannelStore) GetPublicChannelsByIdsForTeam(teamId string, channelIds []string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
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
			result.Err = model.NewAppError("SqlChannelStore.GetPublicChannelsByIdsForTeam", "store.sql_channel.get_channels_by_ids.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		if len(*data) == 0 {
			result.Err = model.NewAppError("SqlChannelStore.GetPublicChannelsByIdsForTeam", "store.sql_channel.get_channels_by_ids.not_found.app_error", nil, "", http.StatusNotFound)
		}

		result.Data = data
	})
}

type channelIdWithCountAndUpdateAt struct {
	Id            string
	TotalMsgCount int64
	UpdateAt      int64
}

func (s SqlChannelStore) GetChannelCounts(teamId string, userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var data []channelIdWithCountAndUpdateAt
		_, err := s.GetReplica().Select(&data, "SELECT Id, TotalMsgCount, UpdateAt FROM Channels WHERE Id IN (SELECT ChannelId FROM ChannelMembers WHERE UserId = :UserId) AND (TeamId = :TeamId OR TeamId = '') AND DeleteAt = 0 ORDER BY DisplayName", map[string]interface{}{"TeamId": teamId, "UserId": userId})

		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetChannelCounts", "store.sql_channel.get_channel_counts.get.app_error", nil, "teamId="+teamId+", userId="+userId+", err="+err.Error(), http.StatusInternalServerError)
		} else {
			counts := &model.ChannelCounts{Counts: make(map[string]int64), UpdateTimes: make(map[string]int64)}
			for i := range data {
				v := data[i]
				counts.Counts[v.Id] = v.TotalMsgCount
				counts.UpdateTimes[v.Id] = v.UpdateAt
			}

			result.Data = counts
		}
	})
}

func (s SqlChannelStore) GetTeamChannels(teamId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		data := &model.ChannelList{}
		_, err := s.GetReplica().Select(data, "SELECT * FROM Channels WHERE TeamId = :TeamId And Type != 'D' ORDER BY DisplayName", map[string]interface{}{"TeamId": teamId})

		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetChannels", "store.sql_channel.get_channels.get.app_error", nil, "teamId="+teamId+",  err="+err.Error(), http.StatusInternalServerError)
		} else {
			if len(*data) == 0 {
				result.Err = model.NewAppError("SqlChannelStore.GetChannels", "store.sql_channel.get_channels.not_found.app_error", nil, "teamId="+teamId, http.StatusNotFound)
			} else {
				result.Data = data
			}
		}
	})
}

func (s SqlChannelStore) GetByName(teamId string, name string, allowFromCache bool) store.StoreChannel {
	return s.getByName(teamId, name, false, allowFromCache)
}

func (s SqlChannelStore) GetByNames(teamId string, names []string, allowFromCache bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var channels []*model.Channel

		if allowFromCache {
			var misses []string
			visited := make(map[string]struct{})
			for _, name := range names {
				if _, ok := visited[name]; ok {
					continue
				}
				visited[name] = struct{}{}
				if cacheItem, ok := channelByNameCache.Get(teamId + name); ok {
					if s.metrics != nil {
						s.metrics.IncrementMemCacheHitCounter("Channel By Name")
					}
					channels = append(channels, cacheItem.(*model.Channel))
				} else {
					if s.metrics != nil {
						s.metrics.IncrementMemCacheMissCounter("Channel By Name")
					}
					misses = append(misses, name)
				}
			}
			names = misses
		}

		if len(names) > 0 {
			props := map[string]interface{}{}
			var namePlaceholders []string
			for _, name := range names {
				key := fmt.Sprintf("Name%v", len(namePlaceholders))
				props[key] = name
				namePlaceholders = append(namePlaceholders, ":"+key)
			}

			var query string
			if teamId == "" {
				query = `SELECT * FROM Channels WHERE Name IN (` + strings.Join(namePlaceholders, ", ") + `) AND DeleteAt = 0`
			} else {
				props["TeamId"] = teamId
				query = `SELECT * FROM Channels WHERE Name IN (` + strings.Join(namePlaceholders, ", ") + `) AND TeamId = :TeamId AND DeleteAt = 0`
			}

			var dbChannels []*model.Channel
			if _, err := s.GetReplica().Select(&dbChannels, query, props); err != nil && err != sql.ErrNoRows {
				result.Err = model.NewAppError("SqlChannelStore.GetByName", "store.sql_channel.get_by_name.existing.app_error", nil, "teamId="+teamId+", "+err.Error(), http.StatusInternalServerError)
				return
			}
			for _, channel := range dbChannels {
				channelByNameCache.AddWithExpiresInSecs(teamId+channel.Name, channel, CHANNEL_CACHE_SEC)
				channels = append(channels, channel)
			}
		}

		result.Data = channels
	})
}

func (s SqlChannelStore) GetByNameIncludeDeleted(teamId string, name string, allowFromCache bool) store.StoreChannel {
	return s.getByName(teamId, name, true, allowFromCache)
}

func (s SqlChannelStore) getByName(teamId string, name string, includeDeleted bool, allowFromCache bool) store.StoreChannel {
	var query string
	if includeDeleted {
		query = "SELECT * FROM Channels WHERE (TeamId = :TeamId OR TeamId = '') AND Name = :Name"
	} else {
		query = "SELECT * FROM Channels WHERE (TeamId = :TeamId OR TeamId = '') AND Name = :Name AND DeleteAt = 0"
	}
	return store.Do(func(result *store.StoreResult) {
		channel := model.Channel{}

		if allowFromCache {
			if cacheItem, ok := channelByNameCache.Get(teamId + name); ok {
				if s.metrics != nil {
					s.metrics.IncrementMemCacheHitCounter("Channel By Name")
				}
				result.Data = cacheItem.(*model.Channel)
				return
			} else {
				if s.metrics != nil {
					s.metrics.IncrementMemCacheMissCounter("Channel By Name")
				}
			}
		}
		if err := s.GetReplica().SelectOne(&channel, query, map[string]interface{}{"TeamId": teamId, "Name": name}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlChannelStore.GetByName", store.MISSING_CHANNEL_ERROR, nil, "teamId="+teamId+", "+"name="+name+", "+err.Error(), http.StatusNotFound)
			} else {
				result.Err = model.NewAppError("SqlChannelStore.GetByName", "store.sql_channel.get_by_name.existing.app_error", nil, "teamId="+teamId+", "+"name="+name+", "+err.Error(), http.StatusInternalServerError)
			}
		} else {
			result.Data = &channel
			channelByNameCache.AddWithExpiresInSecs(teamId+name, &channel, CHANNEL_CACHE_SEC)
		}
	})
}

func (s SqlChannelStore) GetDeletedByName(teamId string, name string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		channel := model.Channel{}

		if err := s.GetReplica().SelectOne(&channel, "SELECT * FROM Channels WHERE (TeamId = :TeamId OR TeamId = '') AND Name = :Name AND DeleteAt != 0", map[string]interface{}{"TeamId": teamId, "Name": name}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlChannelStore.GetDeletedByName", "store.sql_channel.get_deleted_by_name.missing.app_error", nil, "teamId="+teamId+", "+"name="+name+", "+err.Error(), http.StatusNotFound)
			} else {
				result.Err = model.NewAppError("SqlChannelStore.GetDeletedByName", "store.sql_channel.get_deleted_by_name.existing.app_error", nil, "teamId="+teamId+", "+"name="+name+", "+err.Error(), http.StatusInternalServerError)
			}
		} else {
			result.Data = &channel
		}
	})
}

func (s SqlChannelStore) GetDeleted(teamId string, offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		channels := &model.ChannelList{}

		if _, err := s.GetReplica().Select(channels, "SELECT * FROM Channels WHERE (TeamId = :TeamId OR TeamId = '') AND DeleteAt != 0 ORDER BY DisplayName LIMIT :Limit OFFSET :Offset", map[string]interface{}{"TeamId": teamId, "Limit": limit, "Offset": offset}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlChannelStore.GetDeleted", "store.sql_channel.get_deleted.missing.app_error", nil, "teamId="+teamId+", "+err.Error(), http.StatusNotFound)
			} else {
				result.Err = model.NewAppError("SqlChannelStore.GetDeleted", "store.sql_channel.get_deleted.existing.app_error", nil, "teamId="+teamId+", "+err.Error(), http.StatusInternalServerError)
			}
		} else {
			result.Data = channels
		}
	})
}

func (s SqlChannelStore) SaveMember(member *model.ChannelMember) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		// Grab the channel we are saving this member to
		if cr := <-s.GetFromMaster(member.ChannelId); cr.Err != nil {
			result.Err = cr.Err
		} else {
			channel := cr.Data.(*model.Channel)

			if transaction, err := s.GetMaster().Begin(); err != nil {
				result.Err = model.NewAppError("SqlChannelStore.SaveMember", "store.sql_channel.save_member.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			} else {
				*result = s.saveMemberT(transaction, member, channel)
				if result.Err != nil {
					transaction.Rollback()
				} else {
					if err := transaction.Commit(); err != nil {
						result.Err = model.NewAppError("SqlChannelStore.SaveMember", "store.sql_channel.save_member.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
					}
					// If sucessfull record members have changed in channel
					if mu := <-s.extraUpdated(channel); mu.Err != nil {
						result.Err = mu.Err
					}
				}
			}
		}

		s.InvalidateAllChannelMembersForUser(member.UserId)
	})
}

func (s SqlChannelStore) saveMemberT(transaction *gorp.Transaction, member *model.ChannelMember, channel *model.Channel) store.StoreResult {
	result := store.StoreResult{}

	member.PreSave()
	if result.Err = member.IsValid(); result.Err != nil {
		return result
	}

	if err := transaction.Insert(member); err != nil {
		if IsUniqueConstraintError(err, []string{"ChannelId", "channelmembers_pkey"}) {
			result.Err = model.NewAppError("SqlChannelStore.SaveMember", "store.sql_channel.save_member.exists.app_error", nil, "channel_id="+member.ChannelId+", user_id="+member.UserId+", "+err.Error(), http.StatusBadRequest)
		} else {
			result.Err = model.NewAppError("SqlChannelStore.SaveMember", "store.sql_channel.save_member.save.app_error", nil, "channel_id="+member.ChannelId+", user_id="+member.UserId+", "+err.Error(), http.StatusInternalServerError)
		}
	} else {
		result.Data = member
	}

	return result
}

func (s SqlChannelStore) UpdateMember(member *model.ChannelMember) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		member.PreUpdate()

		if result.Err = member.IsValid(); result.Err != nil {
			return
		}

		if _, err := s.GetMaster().Update(member); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.UpdateMember", "store.sql_channel.update_member.app_error", nil, "channel_id="+member.ChannelId+", "+"user_id="+member.UserId+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = member
		}
	})
}

func (s SqlChannelStore) GetMembers(channelId string, offset, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var members model.ChannelMembers
		_, err := s.GetReplica().Select(&members, "SELECT * FROM ChannelMembers WHERE ChannelId = :ChannelId LIMIT :Limit OFFSET :Offset", map[string]interface{}{"ChannelId": channelId, "Limit": limit, "Offset": offset})
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetMembers", "store.sql_channel.get_members.app_error", nil, "channel_id="+channelId+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = &members
		}
	})
}

func (s SqlChannelStore) GetMember(channelId string, userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var member model.ChannelMember

		if err := s.GetReplica().SelectOne(&member, "SELECT * FROM ChannelMembers WHERE ChannelId = :ChannelId AND UserId = :UserId", map[string]interface{}{"ChannelId": channelId, "UserId": userId}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlChannelStore.GetMember", store.MISSING_CHANNEL_MEMBER_ERROR, nil, "channel_id="+channelId+"user_id="+userId+","+err.Error(), http.StatusNotFound)
			} else {
				result.Err = model.NewAppError("SqlChannelStore.GetMember", "store.sql_channel.get_member.app_error", nil, "channel_id="+channelId+"user_id="+userId+","+err.Error(), http.StatusInternalServerError)
			}
		} else {
			result.Data = &member
		}
	})
}

func (us SqlChannelStore) InvalidateAllChannelMembersForUser(userId string) {
	allChannelMembersForUserCache.Remove(userId)
}

func (us SqlChannelStore) IsUserInChannelUseCache(userId string, channelId string) bool {
	if cacheItem, ok := allChannelMembersForUserCache.Get(userId); ok {
		if us.metrics != nil {
			us.metrics.IncrementMemCacheHitCounter("All Channel Members for User")
		}
		ids := cacheItem.(map[string]string)
		if _, ok := ids[channelId]; ok {
			return true
		} else {
			return false
		}
	} else {
		if us.metrics != nil {
			us.metrics.IncrementMemCacheMissCounter("All Channel Members for User")
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

func (s SqlChannelStore) GetMemberForPost(postId string, userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
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
			result.Err = model.NewAppError("SqlChannelStore.GetMemberForPost", "store.sql_channel.get_member_for_post.app_error", nil, "postId="+postId+", err="+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = member
		}
	})
}

type allChannelMember struct {
	ChannelId string
	Roles     string
}

func (s SqlChannelStore) GetAllChannelMembersForUser(userId string, allowFromCache bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if allowFromCache {
			if cacheItem, ok := allChannelMembersForUserCache.Get(userId); ok {
				if s.metrics != nil {
					s.metrics.IncrementMemCacheHitCounter("All Channel Members for User")
				}
				result.Data = cacheItem.(map[string]string)
				return
			} else {
				if s.metrics != nil {
					s.metrics.IncrementMemCacheMissCounter("All Channel Members for User")
				}
			}
		} else {
			if s.metrics != nil {
				s.metrics.IncrementMemCacheMissCounter("All Channel Members for User")
			}
		}

		var data []allChannelMember
		_, err := s.GetReplica().Select(&data, "SELECT ChannelId, Roles FROM Channels, ChannelMembers WHERE Channels.Id = ChannelMembers.ChannelId AND ChannelMembers.UserId = :UserId AND Channels.DeleteAt = 0", map[string]interface{}{"UserId": userId})

		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetAllChannelMembersForUser", "store.sql_channel.get_channels.get.app_error", nil, "userId="+userId+", err="+err.Error(), http.StatusInternalServerError)
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
	})
}

func (us SqlChannelStore) InvalidateCacheForChannelMembersNotifyProps(channelId string) {
	allChannelMembersNotifyPropsForChannelCache.Remove(channelId)
}

type allChannelMemberNotifyProps struct {
	UserId      string
	NotifyProps model.StringMap
}

func (s SqlChannelStore) GetAllChannelMembersNotifyPropsForChannel(channelId string, allowFromCache bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if allowFromCache {
			if cacheItem, ok := allChannelMembersNotifyPropsForChannelCache.Get(channelId); ok {
				if s.metrics != nil {
					s.metrics.IncrementMemCacheHitCounter("All Channel Members Notify Props for Channel")
				}
				result.Data = cacheItem.(map[string]model.StringMap)
				return
			} else {
				if s.metrics != nil {
					s.metrics.IncrementMemCacheMissCounter("All Channel Members Notify Props for Channel")
				}
			}
		} else {
			if s.metrics != nil {
				s.metrics.IncrementMemCacheMissCounter("All Channel Members Notify Props for Channel")
			}
		}

		var data []allChannelMemberNotifyProps
		_, err := s.GetReplica().Select(&data, `
			SELECT ChannelMembers.UserId, ChannelMembers.NotifyProps
			FROM Channels, ChannelMembers
			WHERE Channels.Id = ChannelMembers.ChannelId AND ChannelMembers.ChannelId = :ChannelId`, map[string]interface{}{"ChannelId": channelId})

		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetAllChannelMembersPropsForChannel", "store.sql_channel.get_members.app_error", nil, "channelId="+channelId+", err="+err.Error(), http.StatusInternalServerError)
		} else {

			props := make(map[string]model.StringMap)
			for i := range data {
				props[data[i].UserId] = data[i].NotifyProps
			}

			result.Data = props

			allChannelMembersNotifyPropsForChannelCache.AddWithExpiresInSecs(channelId, props, ALL_CHANNEL_MEMBERS_NOTIFY_PROPS_FOR_CHANNEL_CACHE_SEC)
		}
	})
}

func (us SqlChannelStore) InvalidateMemberCount(channelId string) {
	channelMemberCountsCache.Remove(channelId)
}

func (s SqlChannelStore) GetMemberCountFromCache(channelId string) int64 {
	if cacheItem, ok := channelMemberCountsCache.Get(channelId); ok {
		if s.metrics != nil {
			s.metrics.IncrementMemCacheHitCounter("Channel Member Counts")
		}
		return cacheItem.(int64)
	} else {
		if s.metrics != nil {
			s.metrics.IncrementMemCacheMissCounter("Channel Member Counts")
		}
	}

	if result := <-s.GetMemberCount(channelId, true); result.Err != nil {
		return 0
	} else {
		return result.Data.(int64)
	}
}

func (s SqlChannelStore) GetMemberCount(channelId string, allowFromCache bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if allowFromCache {
			if cacheItem, ok := channelMemberCountsCache.Get(channelId); ok {
				if s.metrics != nil {
					s.metrics.IncrementMemCacheHitCounter("Channel Member Counts")
				}
				result.Data = cacheItem.(int64)
				return
			} else {
				if s.metrics != nil {
					s.metrics.IncrementMemCacheMissCounter("Channel Member Counts")
				}
			}
		} else {
			if s.metrics != nil {
				s.metrics.IncrementMemCacheMissCounter("Channel Member Counts")
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
			result.Err = model.NewAppError("SqlChannelStore.GetMemberCount", "store.sql_channel.get_member_count.app_error", nil, "channel_id="+channelId+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = count

			if allowFromCache {
				channelMemberCountsCache.AddWithExpiresInSecs(channelId, count, CHANNEL_MEMBERS_COUNTS_CACHE_SEC)
			}
		}
	})
}

func (s SqlChannelStore) RemoveMember(channelId string, userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		// Grab the channel we are saving this member to
		if cr := <-s.Get(channelId, true); cr.Err != nil {
			result.Err = cr.Err
		} else {
			channel := cr.Data.(*model.Channel)

			_, err := s.GetMaster().Exec("DELETE FROM ChannelMembers WHERE ChannelId = :ChannelId AND UserId = :UserId", map[string]interface{}{"ChannelId": channelId, "UserId": userId})
			if err != nil {
				result.Err = model.NewAppError("SqlChannelStore.RemoveMember", "store.sql_channel.remove_member.app_error", nil, "channel_id="+channelId+", user_id="+userId+", "+err.Error(), http.StatusInternalServerError)
			} else {
				// If sucessfull record members have changed in channel
				if mu := <-s.extraUpdated(channel); mu.Err != nil {
					result.Err = mu.Err
				}
			}
		}
	})
}

func (s SqlChannelStore) PermanentDeleteMembersByUser(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := s.GetMaster().Exec("DELETE FROM ChannelMembers WHERE UserId = :UserId", map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.RemoveMember", "store.sql_channel.permanent_delete_members_by_user.app_error", nil, "user_id="+userId+", "+err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s SqlChannelStore) UpdateLastViewedAt(channelIds []string, userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		props := make(map[string]interface{})

		updateIdQuery := ""
		for index, channelId := range channelIds {
			if len(updateIdQuery) > 0 {
				updateIdQuery += " OR "
			}

			props["channelId"+strconv.Itoa(index)] = channelId
			updateIdQuery += "ChannelId = :channelId" + strconv.Itoa(index)
		}

		selectIdQuery := strings.Replace(updateIdQuery, "ChannelId", "Id", -1)

		var lastPostAtTimes []struct {
			Id            string
			LastPostAt    int64
			TotalMsgCount int64
		}

		selectQuery := "SELECT Id, LastPostAt, TotalMsgCount FROM Channels WHERE (" + selectIdQuery + ")"

		if _, err := s.GetMaster().Select(&lastPostAtTimes, selectQuery, props); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.UpdateLastViewedAt", "store.sql_channel.update_last_viewed_at.app_error", nil, "channel_ids="+strings.Join(channelIds, ",")+", user_id="+userId+", "+err.Error(), http.StatusInternalServerError)
			return
		}

		times := map[string]int64{}
		msgCountQuery := ""
		lastViewedQuery := ""
		for index, t := range lastPostAtTimes {
			times[t.Id] = t.LastPostAt

			props["msgCount"+strconv.Itoa(index)] = t.TotalMsgCount
			msgCountQuery += fmt.Sprintf("WHEN :channelId%d THEN GREATEST(MsgCount, :msgCount%d) ", index, index)

			props["lastViewed"+strconv.Itoa(index)] = t.LastPostAt
			lastViewedQuery += fmt.Sprintf("WHEN :channelId%d THEN GREATEST(LastViewedAt, :lastViewed%d) ", index, index)

			props["channelId"+strconv.Itoa(index)] = t.Id
		}

		var updateQuery string

		if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
			updateQuery = `UPDATE
				ChannelMembers
			SET
			    MentionCount = 0,
			    MsgCount = CAST(CASE ChannelId ` + msgCountQuery + ` END AS BIGINT),
			    LastViewedAt = CAST(CASE ChannelId ` + lastViewedQuery + ` END AS BIGINT),
			    LastUpdateAt = CAST(CASE ChannelId ` + lastViewedQuery + ` END AS BIGINT)
			WHERE
			        UserId = :UserId
			        AND (` + updateIdQuery + `)`
		} else if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
			updateQuery = `UPDATE
				ChannelMembers
			SET
			    MentionCount = 0,
			    MsgCount = CASE ChannelId ` + msgCountQuery + ` END,
			    LastViewedAt = CASE ChannelId ` + lastViewedQuery + ` END,
			    LastUpdateAt = CASE ChannelId ` + lastViewedQuery + ` END
			WHERE
			        UserId = :UserId
			        AND (` + updateIdQuery + `)`
		}

		props["UserId"] = userId

		if _, err := s.GetMaster().Exec(updateQuery, props); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.UpdateLastViewedAt", "store.sql_channel.update_last_viewed_at.app_error", nil, "channel_ids="+strings.Join(channelIds, ",")+", user_id="+userId+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = times
		}
	})
}

func (s SqlChannelStore) IncrementMentionCount(channelId string, userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
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
			result.Err = model.NewAppError("SqlChannelStore.IncrementMentionCount", "store.sql_channel.increment_mention_count.app_error", nil, "channel_id="+channelId+", user_id="+userId+", "+err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s SqlChannelStore) GetAll(teamId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var data []*model.Channel
		_, err := s.GetReplica().Select(&data, "SELECT * FROM Channels WHERE TeamId = :TeamId AND Type != 'D' ORDER BY Name", map[string]interface{}{"TeamId": teamId})

		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetAll", "store.sql_channel.get_all.app_error", nil, "teamId="+teamId+", err="+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = data
		}
	})
}

func (s SqlChannelStore) GetForPost(postId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
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
			result.Err = model.NewAppError("SqlChannelStore.GetForPost", "store.sql_channel.get_for_post.app_error", nil, "postId="+postId+", err="+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = channel
		}
	})
}

func (s SqlChannelStore) AnalyticsTypeCount(teamId string, channelType string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		query := "SELECT COUNT(Id) AS Value FROM Channels WHERE Type = :ChannelType"

		if len(teamId) > 0 {
			query += " AND TeamId = :TeamId"
		}

		v, err := s.GetReplica().SelectInt(query, map[string]interface{}{"TeamId": teamId, "ChannelType": channelType})
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.AnalyticsTypeCount", "store.sql_channel.analytics_type_count.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = v
		}
	})
}

func (s SqlChannelStore) AnalyticsDeletedTypeCount(teamId string, channelType string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		query := "SELECT COUNT(Id) AS Value FROM Channels WHERE Type = :ChannelType AND DeleteAt > 0"

		if len(teamId) > 0 {
			query += " AND TeamId = :TeamId"
		}

		v, err := s.GetReplica().SelectInt(query, map[string]interface{}{"TeamId": teamId, "ChannelType": channelType})
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.AnalyticsDeletedTypeCount", "store.sql_channel.analytics_deleted_type_count.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = v
		}
	})
}

func (s SqlChannelStore) ExtraUpdateByUser(userId string, time int64) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		_, err := s.GetMaster().Exec(
			`UPDATE Channels SET ExtraUpdateAt = :Time
			WHERE Id IN (SELECT ChannelId FROM ChannelMembers WHERE UserId = :UserId);`,
			map[string]interface{}{"UserId": userId, "Time": time})

		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.extraUpdated", "store.sql_channel.extra_updated.app_error", nil, "user_id="+userId+", "+err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s SqlChannelStore) GetMembersForUser(teamId string, userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
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
			result.Err = model.NewAppError("SqlChannelStore.GetMembersForUser", "store.sql_channel.get_members.app_error", nil, "teamId="+teamId+", userId="+userId+", err="+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = members
		}
	})
}

func (s SqlChannelStore) SearchInTeam(teamId string, term string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
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

		*result = s.performSearch(searchQuery, term, map[string]interface{}{"TeamId": teamId})
	})
}

func (s SqlChannelStore) SearchMore(userId string, teamId string, term string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
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

		*result = s.performSearch(searchQuery, term, map[string]interface{}{"TeamId": teamId, "UserId": userId})
	})
}

func (s SqlChannelStore) performSearch(searchQuery string, term string, parameters map[string]interface{}) store.StoreResult {
	result := store.StoreResult{}

	// Copy the terms as we will need to prepare them differently for each search type.
	likeTerm := term
	fulltextTerm := term

	searchColumns := "Name, DisplayName"

	// These chars must be removed from the like query.
	for _, c := range ignoreLikeSearchChar {
		likeTerm = strings.Replace(likeTerm, c, "", -1)
	}

	// These chars must be escaped in the like query.
	for _, c := range escapeLikeSearchChar {
		likeTerm = strings.Replace(likeTerm, c, "*"+c, -1)
	}

	// These chars must be treated as spaces in the fulltext query.
	for _, c := range spaceFulltextSearchChar {
		fulltextTerm = strings.Replace(fulltextTerm, c, " ", -1)
	}

	if likeTerm == "" {
		// If the likeTerm is empty after preparing, then don't bother searching.
		searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", "", 1)
	} else {
		// Prepare the LIKE portion of the query.
		var searchFields []string
		for _, field := range strings.Split(searchColumns, ", ") {
			if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
				searchFields = append(searchFields, fmt.Sprintf("lower(%s) LIKE lower(%s) escape '*'", field, ":LikeTerm"))
			} else {
				searchFields = append(searchFields, fmt.Sprintf("%s LIKE %s escape '*'", field, ":LikeTerm"))
			}
		}
		likeSearchClause := fmt.Sprintf("(%s)", strings.Join(searchFields, " OR "))
		parameters["LikeTerm"] = fmt.Sprintf("%s%%", likeTerm)

		// Prepare the FULLTEXT portion of the query.
		if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
			splitTerm := strings.Fields(fulltextTerm)
			for i, t := range strings.Fields(fulltextTerm) {
				if i == len(splitTerm)-1 {
					splitTerm[i] = t + ":*"
				} else {
					splitTerm[i] = t + ":* &"
				}
			}

			fulltextTerm = strings.Join(splitTerm, " ")

			fulltextSearchClause := fmt.Sprintf("((%s) @@ to_tsquery(:FulltextTerm))", convertMySQLFullTextColumnsToPostgres(searchColumns))
			searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", "AND ("+likeSearchClause+" OR "+fulltextSearchClause+")", 1)
		} else if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
			splitTerm := strings.Fields(fulltextTerm)
			for i, t := range strings.Fields(fulltextTerm) {
				splitTerm[i] = "+" + t + "*"
			}

			fulltextTerm = strings.Join(splitTerm, " ")

			fulltextSearchClause := fmt.Sprintf("MATCH(%s) AGAINST (:FulltextTerm IN BOOLEAN MODE)", searchColumns)
			searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", fmt.Sprintf("AND (%s OR %s)", likeSearchClause, fulltextSearchClause), 1)
		}
	}

	parameters["FulltextTerm"] = fulltextTerm

	var channels model.ChannelList

	if _, err := s.GetReplica().Select(&channels, searchQuery, parameters); err != nil {
		result.Err = model.NewAppError("SqlChannelStore.Search", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
	} else {
		result.Data = &channels
	}

	return result
}

func (s SqlChannelStore) GetMembersByIds(channelId string, userIds []string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
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
			result.Err = model.NewAppError("SqlChannelStore.GetMembersByIds", "store.sql_channel.get_members_by_ids.app_error", nil, "channelId="+channelId+" "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = &members

		}
	})
}
