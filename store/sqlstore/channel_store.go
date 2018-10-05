// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/mattermost/gorp"

	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/mlog"
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

type channelMember struct {
	ChannelId    string
	UserId       string
	Roles        string
	LastViewedAt int64
	MsgCount     int64
	MentionCount int64
	NotifyProps  model.StringMap
	LastUpdateAt int64
	SchemeUser   sql.NullBool
	SchemeAdmin  sql.NullBool
}

func NewChannelMemberFromModel(cm *model.ChannelMember) *channelMember {
	return &channelMember{
		ChannelId:    cm.ChannelId,
		UserId:       cm.UserId,
		Roles:        cm.ExplicitRoles,
		LastViewedAt: cm.LastViewedAt,
		MsgCount:     cm.MsgCount,
		MentionCount: cm.MentionCount,
		NotifyProps:  cm.NotifyProps,
		LastUpdateAt: cm.LastUpdateAt,
		SchemeUser:   sql.NullBool{Valid: true, Bool: cm.SchemeUser},
		SchemeAdmin:  sql.NullBool{Valid: true, Bool: cm.SchemeAdmin},
	}
}

type channelMemberWithSchemeRoles struct {
	ChannelId                     string
	UserId                        string
	Roles                         string
	LastViewedAt                  int64
	MsgCount                      int64
	MentionCount                  int64
	NotifyProps                   model.StringMap
	LastUpdateAt                  int64
	SchemeUser                    sql.NullBool
	SchemeAdmin                   sql.NullBool
	TeamSchemeDefaultUserRole     sql.NullString
	TeamSchemeDefaultAdminRole    sql.NullString
	ChannelSchemeDefaultUserRole  sql.NullString
	ChannelSchemeDefaultAdminRole sql.NullString
}

type channelMemberWithSchemeRolesList []channelMemberWithSchemeRoles

func (db channelMemberWithSchemeRoles) ToModel() *model.ChannelMember {
	var roles []string
	var explicitRoles []string

	// Identify any system-wide scheme derived roles that are in "Roles" field due to not yet being migrated,
	// and exclude them from ExplicitRoles field.
	schemeUser := db.SchemeUser.Valid && db.SchemeUser.Bool
	schemeAdmin := db.SchemeAdmin.Valid && db.SchemeAdmin.Bool
	for _, role := range strings.Fields(db.Roles) {
		isImplicit := false
		if role == model.CHANNEL_USER_ROLE_ID {
			// We have an implicit role via the system scheme. Override the "schemeUser" field to true.
			schemeUser = true
			isImplicit = true
		} else if role == model.CHANNEL_ADMIN_ROLE_ID {
			// We have an implicit role via the system scheme.
			schemeAdmin = true
			isImplicit = true
		}

		if !isImplicit {
			explicitRoles = append(explicitRoles, role)
		}
		roles = append(roles, role)
	}

	// Add any scheme derived roles that are not in the Roles field due to being Implicit from the Scheme, and add
	// them to the Roles field for backwards compatibility reasons.
	var schemeImpliedRoles []string
	if db.SchemeUser.Valid && db.SchemeUser.Bool {
		if db.ChannelSchemeDefaultUserRole.Valid && db.ChannelSchemeDefaultUserRole.String != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, db.ChannelSchemeDefaultUserRole.String)
		} else if db.TeamSchemeDefaultUserRole.Valid && db.TeamSchemeDefaultUserRole.String != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, db.TeamSchemeDefaultUserRole.String)
		} else {
			schemeImpliedRoles = append(schemeImpliedRoles, model.CHANNEL_USER_ROLE_ID)
		}
	}
	if db.SchemeAdmin.Valid && db.SchemeAdmin.Bool {
		if db.ChannelSchemeDefaultAdminRole.Valid && db.ChannelSchemeDefaultAdminRole.String != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, db.ChannelSchemeDefaultAdminRole.String)
		} else if db.TeamSchemeDefaultAdminRole.Valid && db.TeamSchemeDefaultAdminRole.String != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, db.TeamSchemeDefaultAdminRole.String)
		} else {
			schemeImpliedRoles = append(schemeImpliedRoles, model.CHANNEL_ADMIN_ROLE_ID)
		}
	}
	for _, impliedRole := range schemeImpliedRoles {
		alreadyThere := false
		for _, role := range roles {
			if role == impliedRole {
				alreadyThere = true
			}
		}
		if !alreadyThere {
			roles = append(roles, impliedRole)
		}
	}

	return &model.ChannelMember{
		ChannelId:     db.ChannelId,
		UserId:        db.UserId,
		Roles:         strings.Join(roles, " "),
		LastViewedAt:  db.LastViewedAt,
		MsgCount:      db.MsgCount,
		MentionCount:  db.MentionCount,
		NotifyProps:   db.NotifyProps,
		LastUpdateAt:  db.LastUpdateAt,
		SchemeAdmin:   schemeAdmin,
		SchemeUser:    schemeUser,
		ExplicitRoles: strings.Join(explicitRoles, " "),
	}
}

func (db channelMemberWithSchemeRolesList) ToModel() *model.ChannelMembers {
	cms := model.ChannelMembers{}

	for _, cm := range db {
		cms = append(cms, *cm.ToModel())
	}

	return &cms
}

type allChannelMember struct {
	ChannelId                     string
	Roles                         string
	SchemeUser                    sql.NullBool
	SchemeAdmin                   sql.NullBool
	TeamSchemeDefaultUserRole     sql.NullString
	TeamSchemeDefaultAdminRole    sql.NullString
	ChannelSchemeDefaultUserRole  sql.NullString
	ChannelSchemeDefaultAdminRole sql.NullString
}

type allChannelMembers []allChannelMember

func (db allChannelMember) Process() (string, string) {
	roles := strings.Fields(db.Roles)

	// Add any scheme derived roles that are not in the Roles field due to being Implicit from the Scheme, and add
	// them to the Roles field for backwards compatibility reasons.
	var schemeImpliedRoles []string
	if db.SchemeUser.Valid && db.SchemeUser.Bool {
		if db.ChannelSchemeDefaultUserRole.Valid && db.ChannelSchemeDefaultUserRole.String != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, db.ChannelSchemeDefaultUserRole.String)
		} else if db.TeamSchemeDefaultUserRole.Valid && db.TeamSchemeDefaultUserRole.String != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, db.TeamSchemeDefaultUserRole.String)
		} else {
			schemeImpliedRoles = append(schemeImpliedRoles, model.CHANNEL_USER_ROLE_ID)
		}
	}
	if db.SchemeAdmin.Valid && db.SchemeAdmin.Bool {
		if db.ChannelSchemeDefaultAdminRole.Valid && db.ChannelSchemeDefaultAdminRole.String != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, db.ChannelSchemeDefaultAdminRole.String)
		} else if db.TeamSchemeDefaultAdminRole.Valid && db.TeamSchemeDefaultAdminRole.String != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, db.TeamSchemeDefaultAdminRole.String)
		} else {
			schemeImpliedRoles = append(schemeImpliedRoles, model.CHANNEL_ADMIN_ROLE_ID)
		}
	}
	for _, impliedRole := range schemeImpliedRoles {
		alreadyThere := false
		for _, role := range roles {
			if role == impliedRole {
				alreadyThere = true
			}
		}
		if !alreadyThere {
			roles = append(roles, impliedRole)
		}
	}

	return db.ChannelId, strings.Join(roles, " ")
}

func (db allChannelMembers) ToMapStringString() map[string]string {
	result := make(map[string]string)

	for _, item := range db {
		key, value := item.Process()
		result[key] = value
	}

	return result
}

var channelMemberCountsCache = utils.NewLru(CHANNEL_MEMBERS_COUNTS_CACHE_SIZE)
var allChannelMembersForUserCache = utils.NewLru(ALL_CHANNEL_MEMBERS_FOR_USER_CACHE_SIZE)
var allChannelMembersNotifyPropsForChannelCache = utils.NewLru(ALL_CHANNEL_MEMBERS_NOTIFY_PROPS_FOR_CHANNEL_CACHE_SIZE)
var channelCache = utils.NewLru(model.CHANNEL_CACHE_SIZE)
var channelByNameCache = utils.NewLru(model.CHANNEL_CACHE_SIZE)

func (s SqlChannelStore) ClearCaches() {
	channelMemberCountsCache.Purge()
	allChannelMembersForUserCache.Purge()
	allChannelMembersNotifyPropsForChannelCache.Purge()
	channelCache.Purge()
	channelByNameCache.Purge()

	if s.metrics != nil {
		s.metrics.IncrementMemCacheInvalidationCounter("Channel Member Counts - Purge")
		s.metrics.IncrementMemCacheInvalidationCounter("All Channel Members for User - Purge")
		s.metrics.IncrementMemCacheInvalidationCounter("All Channel Members Notify Props for Channel - Purge")
		s.metrics.IncrementMemCacheInvalidationCounter("Channel - Purge")
		s.metrics.IncrementMemCacheInvalidationCounter("Channel By Name - Purge")
	}
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
		table.ColMap("SchemeId").SetMaxSize(26)

		tablem := db.AddTableWithName(channelMember{}, "ChannelMembers").SetKeys(false, "ChannelId", "UserId")
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

	s.CreateFullTextIndexIfNotExists("idx_channel_search_txt", "Channels", "Name, DisplayName, Purpose")
}

func (s SqlChannelStore) MigratePublicChannels() error {
	// See SqlChannelStoreExperimental
	return nil
}

func (s SqlChannelStore) DropPublicChannels() error {
	// See SqlChannelStoreExperimental
	return nil
}

// Save writes the (non-direct) channel channel to the database.
//
// @see ChannelStoreExperimental for how this update propagates to the PublicChannels table.
func (s SqlChannelStore) Save(channel *model.Channel, maxChannelsPerTeam int64) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if channel.DeleteAt != 0 {
			result.Err = model.NewAppError("SqlChannelStore.Save", "store.sql_channel.save.archived_channel.app_error", nil, "", http.StatusBadRequest)
			return
		}

		if channel.Type == model.CHANNEL_DIRECT {
			result.Err = model.NewAppError("SqlChannelStore.Save", "store.sql_channel.save.direct_channel.app_error", nil, "", http.StatusBadRequest)
			return
		}

		transaction, err := s.GetMaster().Begin()
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.Save", "store.sql_channel.save.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		*result = s.saveChannelT(transaction, channel, maxChannelsPerTeam)
		if result.Err != nil {
			transaction.Rollback()
			return
		}

		if err := transaction.Commit(); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.Save", "store.sql_channel.save.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
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
		SchemeUser:  true,
	}
	cm2 := &model.ChannelMember{
		UserId:      otherUserId,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
		SchemeUser:  true,
	}

	return s.SaveDirectChannel(channel, cm1, cm2)
}

func (s SqlChannelStore) SaveDirectChannel(directchannel *model.Channel, member1 *model.ChannelMember, member2 *model.ChannelMember) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if directchannel.DeleteAt != 0 {
			result.Err = model.NewAppError("SqlChannelStore.Save", "store.sql_channel.save.archived_channel.app_error", nil, "", http.StatusBadRequest)
			return
		}

		if directchannel.Type != model.CHANNEL_DIRECT {
			result.Err = model.NewAppError("SqlChannelStore.SaveDirectChannel", "store.sql_channel.save_direct_channel.not_direct.app_error", nil, "", http.StatusBadRequest)
			return
		}

		transaction, err := s.GetMaster().Begin()
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.SaveDirectChannel", "store.sql_channel.save_direct_channel.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		directchannel.TeamId = ""
		channelResult := s.saveChannelT(transaction, directchannel, 0)

		if channelResult.Err != nil {
			transaction.Rollback()
			result.Err = channelResult.Err
			result.Data = channelResult.Data
			return
		}

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
			return
		}

		if err := transaction.Commit(); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.SaveDirectChannel", "store.sql_channel.save_direct_channel.commit.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		*result = channelResult
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

// Update writes the updated channel to the database.
//
// @see ChannelStoreExperimental for how this update propagates to the PublicChannels table.
func (s SqlChannelStore) Update(channel *model.Channel) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		transaction, err := s.GetMaster().Begin()
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.Update", "store.sql_channel.update.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		*result = s.updateChannelT(transaction, channel)
		if result.Err != nil {
			transaction.Rollback()
			return
		}

		if err := transaction.Commit(); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.Update", "store.sql_channel.update.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}
	})
}

func (s SqlChannelStore) updateChannelT(transaction *gorp.Transaction, channel *model.Channel) store.StoreResult {
	result := store.StoreResult{}

	channel.PreUpdate()

	if channel.DeleteAt != 0 {
		result.Err = model.NewAppError("SqlChannelStore.Update", "store.sql_channel.update.archived_channel.app_error", nil, "", http.StatusBadRequest)
		return result
	}

	if result.Err = channel.IsValid(); result.Err != nil {
		return result
	}

	count, err := transaction.Update(channel)
	if err != nil {
		if IsUniqueConstraintError(err, []string{"Name", "channels_name_teamid_key"}) {
			dupChannel := model.Channel{}
			s.GetReplica().SelectOne(&dupChannel, "SELECT * FROM Channels WHERE TeamId = :TeamId AND Name= :Name AND DeleteAt > 0", map[string]interface{}{"TeamId": channel.TeamId, "Name": channel.Name})
			if dupChannel.DeleteAt > 0 {
				result.Err = model.NewAppError("SqlChannelStore.Update", "store.sql_channel.update.previously.app_error", nil, "id="+channel.Id+", "+err.Error(), http.StatusBadRequest)
				return result
			}
			result.Err = model.NewAppError("SqlChannelStore.Update", "store.sql_channel.update.exists.app_error", nil, "id="+channel.Id+", "+err.Error(), http.StatusBadRequest)
			return result
		}
		result.Err = model.NewAppError("SqlChannelStore.Update", "store.sql_channel.update.updating.app_error", nil, "id="+channel.Id+", "+err.Error(), http.StatusInternalServerError)
		return result
	}

	if count != 1 {
		result.Err = model.NewAppError("SqlChannelStore.Update", "store.sql_channel.update.app_error", nil, "id="+channel.Id, http.StatusInternalServerError)
		return result
	}

	result.Data = channel

	return result
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

func (s SqlChannelStore) InvalidateChannel(id string) {
	channelCache.Remove(id)
	if s.metrics != nil {
		s.metrics.IncrementMemCacheInvalidationCounter("Channel - Remove by ChannelId")
	}
}

func (s SqlChannelStore) InvalidateChannelByName(teamId, name string) {
	channelByNameCache.Remove(teamId + name)
	if s.metrics != nil {
		s.metrics.IncrementMemCacheInvalidationCounter("Channel by Name - Remove by TeamId and Name")
	}
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
			}
		}

		if s.metrics != nil {
			s.metrics.IncrementMemCacheMissCounter("Channel")
		}

		obj, err := db.Get(model.Channel{}, id)
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.Get", "store.sql_channel.get.find.app_error", nil, "id="+id+", "+err.Error(), http.StatusInternalServerError)
			return
		}

		if obj == nil {
			result.Err = model.NewAppError("SqlChannelStore.Get", "store.sql_channel.get.existing.app_error", nil, "id="+id, http.StatusNotFound)
			return
		}

		result.Data = obj.(*model.Channel)
		channelCache.AddWithExpiresInSecs(id, obj.(*model.Channel), CHANNEL_CACHE_SEC)
	})
}

// Delete records the given deleted timestamp to the channel in question.
//
// @see ChannelStoreExperimental for how this update propagates to the PublicChannels table.
func (s SqlChannelStore) Delete(channelId string, time int64) store.StoreChannel {
	return s.SetDeleteAt(channelId, time, time)
}

// Restore reverts a previous deleted timestamp from the channel in question.
//
// @see ChannelStoreExperimental for how this update propagates to the PublicChannels table.
func (s SqlChannelStore) Restore(channelId string, time int64) store.StoreChannel {
	return s.SetDeleteAt(channelId, 0, time)
}

// SetDeleteAt records the given deleted and updated timestamp to the channel in question.
//
// @see ChannelStoreExperimental for how this update propagates to the PublicChannels table.
func (s SqlChannelStore) SetDeleteAt(channelId string, deleteAt, updateAt int64) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		transaction, err := s.GetMaster().Begin()
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.SetDeleteAt", "store.sql_channel.set_delete_at.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		*result = s.setDeleteAtT(transaction, channelId, deleteAt, updateAt)
		if result.Err != nil {
			transaction.Rollback()
			return
		}

		if err := transaction.Commit(); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.SetDeleteAt", "store.sql_channel.set_delete_at.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}
	})
}

func (s SqlChannelStore) setDeleteAtT(transaction *gorp.Transaction, channelId string, deleteAt, updateAt int64) store.StoreResult {
	result := store.StoreResult{}

	_, err := transaction.Exec("Update Channels SET DeleteAt = :DeleteAt, UpdateAt = :UpdateAt WHERE Id = :ChannelId", map[string]interface{}{"DeleteAt": deleteAt, "UpdateAt": updateAt, "ChannelId": channelId})
	if err != nil {
		result.Err = model.NewAppError("SqlChannelStore.Delete", "store.sql_channel.delete.channel.app_error", nil, "id="+channelId+", err="+err.Error(), http.StatusInternalServerError)
		return result
	}

	return result
}

// PermanentDeleteByTeam removes all channels for the given team from the database.
//
// @see ChannelStoreExperimental for how this update propagates to the PublicChannels table.
func (s SqlChannelStore) PermanentDeleteByTeam(teamId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		transaction, err := s.GetMaster().Begin()
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.PermanentDeleteByTeam", "store.sql_channel.permanent_delete_by_team.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		*result = s.permanentDeleteByTeamtT(transaction, teamId)
		if result.Err != nil {
			transaction.Rollback()
			return
		}

		if err := transaction.Commit(); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.PermanentDeleteByTeam", "store.sql_channel.permanent_delete_by_team.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}
	})
}

func (s SqlChannelStore) permanentDeleteByTeamtT(transaction *gorp.Transaction, teamId string) store.StoreResult {
	result := store.StoreResult{}

	if _, err := transaction.Exec("DELETE FROM Channels WHERE TeamId = :TeamId", map[string]interface{}{"TeamId": teamId}); err != nil {
		result.Err = model.NewAppError("SqlChannelStore.PermanentDeleteByTeam", "store.sql_channel.permanent_delete_by_team.app_error", nil, "teamId="+teamId+", "+err.Error(), http.StatusInternalServerError)
		return result
	}

	return result
}

// PermanentDelete removes the given channel from the database.
//
// @see ChannelStoreExperimental for how this update propagates to the PublicChannels table.
func (s SqlChannelStore) PermanentDelete(channelId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		transaction, err := s.GetMaster().Begin()
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.PermanentDelete", "store.sql_channel.permanent_delete.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		*result = s.permanentDeleteT(transaction, channelId)
		if result.Err != nil {
			transaction.Rollback()
			return
		}

		if err := transaction.Commit(); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.PermanentDelete", "store.sql_channel.permanent_delete.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}
	})
}

func (s SqlChannelStore) permanentDeleteT(transaction *gorp.Transaction, channelId string) store.StoreResult {
	result := store.StoreResult{}

	if _, err := transaction.Exec("DELETE FROM Channels WHERE Id = :ChannelId", map[string]interface{}{"ChannelId": channelId}); err != nil {
		result.Err = model.NewAppError("SqlChannelStore.PermanentDelete", "store.sql_channel.permanent_delete.app_error", nil, "channel_id="+channelId+", "+err.Error(), http.StatusInternalServerError)
		return result
	}

	return result
}

func (s SqlChannelStore) PermanentDeleteMembersByChannel(channelId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		_, err := s.GetMaster().Exec("DELETE FROM ChannelMembers WHERE ChannelId = :ChannelId", map[string]interface{}{"ChannelId": channelId})
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.RemoveAllMembersByChannel", "store.sql_channel.remove_member.app_error", nil, "channel_id="+channelId+", "+err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s SqlChannelStore) GetChannels(teamId string, userId string, includeDeleted bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		query := "SELECT Channels.* FROM Channels, ChannelMembers WHERE Id = ChannelId AND UserId = :UserId AND DeleteAt = 0 AND (TeamId = :TeamId OR TeamId = '') ORDER BY DisplayName"
		if includeDeleted {
			query = "SELECT Channels.* FROM Channels, ChannelMembers WHERE Id = ChannelId AND UserId = :UserId AND (TeamId = :TeamId OR TeamId = '') ORDER BY DisplayName"
		}
		data := &model.ChannelList{}
		_, err := s.GetReplica().Select(data, query, map[string]interface{}{"TeamId": teamId, "UserId": userId})

		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetChannels", "store.sql_channel.get_channels.get.app_error", nil, "teamId="+teamId+", userId="+userId+", err="+err.Error(), http.StatusInternalServerError)
			return
		}

		if len(*data) == 0 {
			result.Err = model.NewAppError("SqlChannelStore.GetChannels", "store.sql_channel.get_channels.not_found.app_error", nil, "teamId="+teamId+", userId="+userId, http.StatusBadRequest)
			return
		}

		result.Data = data
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
			return
		}

		result.Data = data
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
			return
		}

		result.Data = data
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
			return
		}

		counts := &model.ChannelCounts{Counts: make(map[string]int64), UpdateTimes: make(map[string]int64)}
		for i := range data {
			v := data[i]
			counts.Counts[v.Id] = v.TotalMsgCount
			counts.UpdateTimes[v.Id] = v.UpdateAt
		}

		result.Data = counts
	})
}

func (s SqlChannelStore) GetTeamChannels(teamId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		data := &model.ChannelList{}
		_, err := s.GetReplica().Select(data, "SELECT * FROM Channels WHERE TeamId = :TeamId And Type != 'D' ORDER BY DisplayName", map[string]interface{}{"TeamId": teamId})

		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetTeamChannels", "store.sql_channel.get_channels.get.app_error", nil, "teamId="+teamId+",  err="+err.Error(), http.StatusInternalServerError)
			return
		}

		if len(*data) == 0 {
			result.Err = model.NewAppError("SqlChannelStore.GetTeamChannels", "store.sql_channel.get_channels.not_found.app_error", nil, "teamId="+teamId, http.StatusNotFound)
			return
		}

		result.Data = data
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
			}
			if s.metrics != nil {
				s.metrics.IncrementMemCacheMissCounter("Channel By Name")
			}
		}

		if err := s.GetReplica().SelectOne(&channel, query, map[string]interface{}{"TeamId": teamId, "Name": name}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlChannelStore.GetByName", store.MISSING_CHANNEL_ERROR, nil, "teamId="+teamId+", "+"name="+name+", "+err.Error(), http.StatusNotFound)
				return
			}
			result.Err = model.NewAppError("SqlChannelStore.GetByName", "store.sql_channel.get_by_name.existing.app_error", nil, "teamId="+teamId+", "+"name="+name+", "+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = &channel
		channelByNameCache.AddWithExpiresInSecs(teamId+name, &channel, CHANNEL_CACHE_SEC)
	})
}

func (s SqlChannelStore) GetDeletedByName(teamId string, name string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		channel := model.Channel{}

		if err := s.GetReplica().SelectOne(&channel, "SELECT * FROM Channels WHERE (TeamId = :TeamId OR TeamId = '') AND Name = :Name AND DeleteAt != 0", map[string]interface{}{"TeamId": teamId, "Name": name}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlChannelStore.GetDeletedByName", "store.sql_channel.get_deleted_by_name.missing.app_error", nil, "teamId="+teamId+", "+"name="+name+", "+err.Error(), http.StatusNotFound)
				return
			}
			result.Err = model.NewAppError("SqlChannelStore.GetDeletedByName", "store.sql_channel.get_deleted_by_name.existing.app_error", nil, "teamId="+teamId+", "+"name="+name+", "+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = &channel
	})
}

func (s SqlChannelStore) GetDeleted(teamId string, offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		channels := &model.ChannelList{}

		if _, err := s.GetReplica().Select(channels, "SELECT * FROM Channels WHERE (TeamId = :TeamId OR TeamId = '') AND DeleteAt != 0 ORDER BY DisplayName LIMIT :Limit OFFSET :Offset", map[string]interface{}{"TeamId": teamId, "Limit": limit, "Offset": offset}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlChannelStore.GetDeleted", "store.sql_channel.get_deleted.missing.app_error", nil, "teamId="+teamId+", "+err.Error(), http.StatusNotFound)
				return
			}
			result.Err = model.NewAppError("SqlChannelStore.GetDeleted", "store.sql_channel.get_deleted.existing.app_error", nil, "teamId="+teamId+", "+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = channels
	})
}

var CHANNEL_MEMBERS_WITH_SCHEME_SELECT_QUERY = `
	SELECT
		ChannelMembers.*,
		TeamScheme.DefaultChannelUserRole TeamSchemeDefaultUserRole,
		TeamScheme.DefaultChannelAdminRole TeamSchemeDefaultAdminRole,
		ChannelScheme.DefaultChannelUserRole ChannelSchemeDefaultUserRole,
		ChannelScheme.DefaultChannelAdminRole ChannelSchemeDefaultAdminRole
	FROM
		ChannelMembers
	INNER JOIN
		Channels ON ChannelMembers.ChannelId = Channels.Id
	LEFT JOIN
		Schemes ChannelScheme ON Channels.SchemeId = ChannelScheme.Id
	LEFT JOIN
		Teams ON Channels.TeamId = Teams.Id
	LEFT JOIN
		Schemes TeamScheme ON Teams.SchemeId = TeamScheme.Id
`

func (s SqlChannelStore) SaveMember(member *model.ChannelMember) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		defer s.InvalidateAllChannelMembersForUser(member.UserId)

		// Grab the channel we are saving this member to
		cr := <-s.GetFromMaster(member.ChannelId)
		if cr.Err != nil {
			result.Err = cr.Err
			return
		}

		channel := cr.Data.(*model.Channel)

		transaction, err := s.GetMaster().Begin()
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.SaveMember", "store.sql_channel.save_member.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		*result = s.saveMemberT(transaction, member, channel)
		if result.Err != nil {
			transaction.Rollback()
			return
		}

		if err := transaction.Commit(); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.SaveMember", "store.sql_channel.save_member.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}
	})
}

func (s SqlChannelStore) saveMemberT(transaction *gorp.Transaction, member *model.ChannelMember, channel *model.Channel) store.StoreResult {
	result := store.StoreResult{}

	member.PreSave()
	if result.Err = member.IsValid(); result.Err != nil {
		return result
	}

	dbMember := NewChannelMemberFromModel(member)

	if err := transaction.Insert(dbMember); err != nil {
		if IsUniqueConstraintError(err, []string{"ChannelId", "channelmembers_pkey"}) {
			result.Err = model.NewAppError("SqlChannelStore.SaveMember", "store.sql_channel.save_member.exists.app_error", nil, "channel_id="+member.ChannelId+", user_id="+member.UserId+", "+err.Error(), http.StatusBadRequest)
			return result
		}
		result.Err = model.NewAppError("SqlChannelStore.SaveMember", "store.sql_channel.save_member.save.app_error", nil, "channel_id="+member.ChannelId+", user_id="+member.UserId+", "+err.Error(), http.StatusInternalServerError)
		return result
	}

	var retrievedMember channelMemberWithSchemeRoles
	if err := transaction.SelectOne(&retrievedMember, CHANNEL_MEMBERS_WITH_SCHEME_SELECT_QUERY+"WHERE ChannelMembers.ChannelId = :ChannelId AND ChannelMembers.UserId = :UserId", map[string]interface{}{"ChannelId": dbMember.ChannelId, "UserId": dbMember.UserId}); err != nil {
		if err == sql.ErrNoRows {
			result.Err = model.NewAppError("SqlChannelStore.GetMember", store.MISSING_CHANNEL_MEMBER_ERROR, nil, "channel_id="+dbMember.ChannelId+"user_id="+dbMember.UserId+","+err.Error(), http.StatusNotFound)
			return result
		}
		result.Err = model.NewAppError("SqlChannelStore.GetMember", "store.sql_channel.get_member.app_error", nil, "channel_id="+dbMember.ChannelId+"user_id="+dbMember.UserId+","+err.Error(), http.StatusInternalServerError)
		return result
	}

	result.Data = retrievedMember.ToModel()
	return result
}

func (s SqlChannelStore) UpdateMember(member *model.ChannelMember) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		member.PreUpdate()

		if result.Err = member.IsValid(); result.Err != nil {
			return
		}

		if _, err := s.GetMaster().Update(NewChannelMemberFromModel(member)); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.UpdateMember", "store.sql_channel.update_member.app_error", nil, "channel_id="+member.ChannelId+", "+"user_id="+member.UserId+", "+err.Error(), http.StatusInternalServerError)
			return
		}

		var dbMember channelMemberWithSchemeRoles

		if err := s.GetReplica().SelectOne(&dbMember, CHANNEL_MEMBERS_WITH_SCHEME_SELECT_QUERY+"WHERE ChannelMembers.ChannelId = :ChannelId AND ChannelMembers.UserId = :UserId", map[string]interface{}{"ChannelId": member.ChannelId, "UserId": member.UserId}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlChannelStore.GetMember", store.MISSING_CHANNEL_MEMBER_ERROR, nil, "channel_id="+member.ChannelId+"user_id="+member.UserId+","+err.Error(), http.StatusNotFound)
				return
			}
			result.Err = model.NewAppError("SqlChannelStore.GetMember", "store.sql_channel.get_member.app_error", nil, "channel_id="+member.ChannelId+"user_id="+member.UserId+","+err.Error(), http.StatusInternalServerError)
			return
		}
		result.Data = dbMember.ToModel()
	})
}

func (s SqlChannelStore) GetMembers(channelId string, offset, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var dbMembers channelMemberWithSchemeRolesList
		_, err := s.GetReplica().Select(&dbMembers, CHANNEL_MEMBERS_WITH_SCHEME_SELECT_QUERY+"WHERE ChannelId = :ChannelId LIMIT :Limit OFFSET :Offset", map[string]interface{}{"ChannelId": channelId, "Limit": limit, "Offset": offset})
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetMembers", "store.sql_channel.get_members.app_error", nil, "channel_id="+channelId+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = dbMembers.ToModel()
	})
}

func (s SqlChannelStore) GetMember(channelId string, userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var dbMember channelMemberWithSchemeRoles

		if err := s.GetReplica().SelectOne(&dbMember, CHANNEL_MEMBERS_WITH_SCHEME_SELECT_QUERY+"WHERE ChannelMembers.ChannelId = :ChannelId AND ChannelMembers.UserId = :UserId", map[string]interface{}{"ChannelId": channelId, "UserId": userId}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlChannelStore.GetMember", store.MISSING_CHANNEL_MEMBER_ERROR, nil, "channel_id="+channelId+"user_id="+userId+","+err.Error(), http.StatusNotFound)
				return
			}
			result.Err = model.NewAppError("SqlChannelStore.GetMember", "store.sql_channel.get_member.app_error", nil, "channel_id="+channelId+"user_id="+userId+","+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = dbMember.ToModel()
	})
}

func (s SqlChannelStore) InvalidateAllChannelMembersForUser(userId string) {
	allChannelMembersForUserCache.Remove(userId)
	allChannelMembersForUserCache.Remove(userId + "_deleted")
	if s.metrics != nil {
		s.metrics.IncrementMemCacheInvalidationCounter("All Channel Members for User - Remove by UserId")
	}
}

func (s SqlChannelStore) IsUserInChannelUseCache(userId string, channelId string) bool {
	if cacheItem, ok := allChannelMembersForUserCache.Get(userId); ok {
		if s.metrics != nil {
			s.metrics.IncrementMemCacheHitCounter("All Channel Members for User")
		}
		ids := cacheItem.(map[string]string)
		if _, ok := ids[channelId]; ok {
			return true
		}
		return false
	}

	if s.metrics != nil {
		s.metrics.IncrementMemCacheMissCounter("All Channel Members for User")
	}

	result := <-s.GetAllChannelMembersForUser(userId, true, false)
	if result.Err != nil {
		mlog.Error("SqlChannelStore.IsUserInChannelUseCache: " + result.Err.Error())
		return false
	}

	ids := result.Data.(map[string]string)
	if _, ok := ids[channelId]; ok {
		return true
	}

	return false
}

func (s SqlChannelStore) GetMemberForPost(postId string, userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var dbMember channelMemberWithSchemeRoles
		if err := s.GetReplica().SelectOne(&dbMember,
			`
			SELECT
				ChannelMembers.*,
				TeamScheme.DefaultChannelUserRole TeamSchemeDefaultUserRole,
				TeamScheme.DefaultChannelAdminRole TeamSchemeDefaultAdminRole,
				ChannelScheme.DefaultChannelUserRole ChannelSchemeDefaultUserRole,
				ChannelScheme.DefaultChannelAdminRole ChannelSchemeDefaultAdminRole
			FROM
				ChannelMembers
			INNER JOIN
				Posts ON ChannelMembers.ChannelId = Posts.ChannelId
			INNER JOIN
				Channels ON ChannelMembers.ChannelId = Channels.Id
			LEFT JOIN
				Schemes ChannelScheme ON Channels.SchemeId = ChannelScheme.Id
			LEFT JOIN
				Teams ON Channels.TeamId = Teams.Id
			LEFT JOIN
				Schemes TeamScheme ON Teams.SchemeId = TeamScheme.Id
			WHERE
				ChannelMembers.UserId = :UserId
				AND Posts.Id = :PostId`, map[string]interface{}{"UserId": userId, "PostId": postId}); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetMemberForPost", "store.sql_channel.get_member_for_post.app_error", nil, "postId="+postId+", err="+err.Error(), http.StatusInternalServerError)
			return
		}
		result.Data = dbMember.ToModel()
	})
}

func (s SqlChannelStore) GetAllChannelMembersForUser(userId string, allowFromCache bool, includeDeleted bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		cache_key := userId
		if includeDeleted {
			cache_key += "_deleted"
		}
		if allowFromCache {
			if cacheItem, ok := allChannelMembersForUserCache.Get(cache_key); ok {
				if s.metrics != nil {
					s.metrics.IncrementMemCacheHitCounter("All Channel Members for User")
				}
				result.Data = cacheItem.(map[string]string)
				return
			}
		}

		if s.metrics != nil {
			s.metrics.IncrementMemCacheMissCounter("All Channel Members for User")
		}

		var deletedClause string
		if !includeDeleted {
			deletedClause = "Channels.DeleteAt = 0 AND"
		}

		var data allChannelMembers
		_, err := s.GetReplica().Select(&data, `
			SELECT
				ChannelMembers.ChannelId, ChannelMembers.Roles, ChannelMembers.SchemeUser, ChannelMembers.SchemeAdmin,
				TeamScheme.DefaultChannelUserRole TeamSchemeDefaultUserRole,
				TeamScheme.DefaultChannelAdminRole TeamSchemeDefaultAdminRole,
				ChannelScheme.DefaultChannelUserRole ChannelSchemeDefaultUserRole,
				ChannelScheme.DefaultChannelAdminRole ChannelSchemeDefaultAdminRole
			FROM
				ChannelMembers
			INNER JOIN
				Channels ON ChannelMembers.ChannelId = Channels.Id
			LEFT JOIN
				Schemes ChannelScheme ON Channels.SchemeId = ChannelScheme.Id
			LEFT JOIN
				Teams ON Channels.TeamId = Teams.Id
			LEFT JOIN
				Schemes TeamScheme ON Teams.SchemeId = TeamScheme.Id
			WHERE
				`+deletedClause+`
				ChannelMembers.UserId = :UserId`, map[string]interface{}{"UserId": userId})

		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetAllChannelMembersForUser", "store.sql_channel.get_channels.get.app_error", nil, "userId="+userId+", err="+err.Error(), http.StatusInternalServerError)
			return
		}

		ids := data.ToMapStringString()
		result.Data = ids

		if allowFromCache {
			allChannelMembersForUserCache.AddWithExpiresInSecs(cache_key, ids, ALL_CHANNEL_MEMBERS_FOR_USER_CACHE_SEC)
		}
	})
}

func (s SqlChannelStore) InvalidateCacheForChannelMembersNotifyProps(channelId string) {
	allChannelMembersNotifyPropsForChannelCache.Remove(channelId)
	if s.metrics != nil {
		s.metrics.IncrementMemCacheInvalidationCounter("All Channel Members Notify Props for Channel - Remove by ChannelId")
	}
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
			}
		}

		if s.metrics != nil {
			s.metrics.IncrementMemCacheMissCounter("All Channel Members Notify Props for Channel")
		}

		var data []allChannelMemberNotifyProps
		_, err := s.GetReplica().Select(&data, `
			SELECT UserId, NotifyProps
			FROM ChannelMembers
			WHERE ChannelId = :ChannelId`, map[string]interface{}{"ChannelId": channelId})

		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetAllChannelMembersPropsForChannel", "store.sql_channel.get_members.app_error", nil, "channelId="+channelId+", err="+err.Error(), http.StatusInternalServerError)
			return
		}

		props := make(map[string]model.StringMap)
		for i := range data {
			props[data[i].UserId] = data[i].NotifyProps
		}

		result.Data = props

		allChannelMembersNotifyPropsForChannelCache.AddWithExpiresInSecs(channelId, props, ALL_CHANNEL_MEMBERS_NOTIFY_PROPS_FOR_CHANNEL_CACHE_SEC)
	})
}

func (s SqlChannelStore) InvalidateMemberCount(channelId string) {
	channelMemberCountsCache.Remove(channelId)
	if s.metrics != nil {
		s.metrics.IncrementMemCacheInvalidationCounter("Channel Member Counts - Remove by ChannelId")
	}
}

func (s SqlChannelStore) GetMemberCountFromCache(channelId string) int64 {
	if cacheItem, ok := channelMemberCountsCache.Get(channelId); ok {
		if s.metrics != nil {
			s.metrics.IncrementMemCacheHitCounter("Channel Member Counts")
		}
		return cacheItem.(int64)
	}

	if s.metrics != nil {
		s.metrics.IncrementMemCacheMissCounter("Channel Member Counts")
	}

	result := <-s.GetMemberCount(channelId, true)
	if result.Err != nil {
		return 0
	}

	return result.Data.(int64)
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
			}
		}

		if s.metrics != nil {
			s.metrics.IncrementMemCacheMissCounter("Channel Member Counts")
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
			return
		}
		result.Data = count

		if allowFromCache {
			channelMemberCountsCache.AddWithExpiresInSecs(channelId, count, CHANNEL_MEMBERS_COUNTS_CACHE_SEC)
		}
	})
}

func (s SqlChannelStore) RemoveMember(channelId string, userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		_, err := s.GetMaster().Exec("DELETE FROM ChannelMembers WHERE ChannelId = :ChannelId AND UserId = :UserId", map[string]interface{}{"ChannelId": channelId, "UserId": userId})
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.RemoveMember", "store.sql_channel.remove_member.app_error", nil, "channel_id="+channelId+", user_id="+userId+", "+err.Error(), http.StatusInternalServerError)
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
			return
		}

		result.Data = times
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
			return
		}

		result.Data = data
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
			return
		}

		result.Data = channel
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
			return
		}

		result.Data = v
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
			return
		}

		result.Data = v
	})
}

func (s SqlChannelStore) GetMembersForUser(teamId string, userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var dbMembers channelMemberWithSchemeRolesList
		_, err := s.GetReplica().Select(&dbMembers, CHANNEL_MEMBERS_WITH_SCHEME_SELECT_QUERY+"WHERE ChannelMembers.UserId = :UserId", map[string]interface{}{"TeamId": teamId, "UserId": userId})

		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetMembersForUser", "store.sql_channel.get_members.app_error", nil, "teamId="+teamId+", userId="+userId+", err="+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = dbMembers.ToModel()
	})
}

func (s SqlChannelStore) AutocompleteInTeam(teamId string, term string, includeDeleted bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		deleteFilter := "AND DeleteAt = 0"
		if includeDeleted {
			deleteFilter = ""
		}

		queryFormat := `
			SELECT
				*
			FROM
				Channels
			WHERE
				TeamId = :TeamId
				AND Type = 'O'
				` + deleteFilter + `
				%v
			LIMIT 50`

		var channels model.ChannelList

		if likeClause, likeTerm := s.buildLIKEClause(term, "Name, DisplayName, Purpose"); likeClause == "" {
			if _, err := s.GetReplica().Select(&channels, fmt.Sprintf(queryFormat, ""), map[string]interface{}{"TeamId": teamId}); err != nil {
				result.Err = model.NewAppError("SqlChannelStore.AutocompleteInTeam", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
			}
		} else {
			// Using a UNION results in index_merge and fulltext queries and is much faster than the ref
			// query you would get using an OR of the LIKE and full-text clauses.
			fulltextClause, fulltextTerm := s.buildFulltextClause(term, "Name, DisplayName, Purpose")
			likeQuery := fmt.Sprintf(queryFormat, "AND "+likeClause)
			fulltextQuery := fmt.Sprintf(queryFormat, "AND "+fulltextClause)
			query := fmt.Sprintf("(%v) UNION (%v) LIMIT 50", likeQuery, fulltextQuery)

			if _, err := s.GetReplica().Select(&channels, query, map[string]interface{}{"TeamId": teamId, "LikeTerm": likeTerm, "FulltextTerm": fulltextTerm}); err != nil {
				result.Err = model.NewAppError("SqlChannelStore.AutocompleteInTeam", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
			}
		}

		sort.Slice(channels, func(a, b int) bool {
			return strings.ToLower(channels[a].DisplayName) < strings.ToLower(channels[b].DisplayName)
		})
		result.Data = &channels
	})
}

func (s SqlChannelStore) AutocompleteInTeamForSearch(teamId string, userId string, term string, includeDeleted bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		deleteFilter := "AND DeleteAt = 0"
		if includeDeleted {
			deleteFilter = ""
		}

		queryFormat := `
			SELECT
				C.*
			FROM
				Channels AS C
			JOIN
				ChannelMembers AS CM ON CM.ChannelId = C.Id
			WHERE
			    (C.TeamId = :TeamId OR (C.TeamId = '' AND C.Type = 'G'))
				AND CM.UserId = :UserId
				` + deleteFilter + `
				%v
			LIMIT 50`

		var channels model.ChannelList

		if likeClause, likeTerm := s.buildLIKEClause(term, "Name, DisplayName, Purpose"); likeClause == "" {
			if _, err := s.GetReplica().Select(&channels, fmt.Sprintf(queryFormat, ""), map[string]interface{}{"TeamId": teamId, "UserId": userId}); err != nil {
				result.Err = model.NewAppError("SqlChannelStore.AutocompleteInTeamForSearch", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
			}
		} else {
			// Using a UNION results in index_merge and fulltext queries and is much faster than the ref
			// query you would get using an OR of the LIKE and full-text clauses.
			fulltextClause, fulltextTerm := s.buildFulltextClause(term, "Name, DisplayName, Purpose")
			likeQuery := fmt.Sprintf(queryFormat, "AND "+likeClause)
			fulltextQuery := fmt.Sprintf(queryFormat, "AND "+fulltextClause)
			query := fmt.Sprintf("(%v) UNION (%v) LIMIT 50", likeQuery, fulltextQuery)

			if _, err := s.GetReplica().Select(&channels, query, map[string]interface{}{"TeamId": teamId, "UserId": userId, "LikeTerm": likeTerm, "FulltextTerm": fulltextTerm}); err != nil {
				result.Err = model.NewAppError("SqlChannelStore.AutocompleteInTeamForSearch", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
			}
		}

		directChannels, err := s.autocompleteInTeamForSearchDirectMessages(userId, term)
		if err != nil {
			result.Err = err
			return
		}

		channels = append(channels, directChannels...)

		sort.Slice(channels, func(a, b int) bool {
			return strings.ToLower(channels[a].DisplayName) < strings.ToLower(channels[b].DisplayName)
		})
		result.Data = &channels
	})
}

func (s SqlChannelStore) autocompleteInTeamForSearchDirectMessages(userId string, term string) ([]*model.Channel, *model.AppError) {
	queryFormat := `
			SELECT
				C.*,
				OtherUsers.Username as DisplayName
			FROM
				Channels AS C
			JOIN
				ChannelMembers AS CM ON CM.ChannelId = C.Id
			INNER JOIN (
				SELECT
					ICM.ChannelId AS ChannelId, IU.Username AS Username
				FROM
					Users as IU
				JOIN
					ChannelMembers AS ICM ON ICM.UserId = IU.Id
				WHERE
					IU.Id != :UserId
					%v
				) AS OtherUsers ON OtherUsers.ChannelId = C.Id
			WHERE
			    C.Type = 'D'
				AND CM.UserId = :UserId
			LIMIT 50`

	var channels model.ChannelList

	if likeClause, likeTerm := s.buildLIKEClause(term, "IU.Username, IU.Nickname"); likeClause == "" {
		if _, err := s.GetReplica().Select(&channels, fmt.Sprintf(queryFormat, ""), map[string]interface{}{"UserId": userId}); err != nil {
			return nil, model.NewAppError("SqlChannelStore.AutocompleteInTeamForSearch", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
		}
	} else {
		query := fmt.Sprintf(queryFormat, "AND "+likeClause)

		if _, err := s.GetReplica().Select(&channels, query, map[string]interface{}{"UserId": userId, "LikeTerm": likeTerm}); err != nil {
			return nil, model.NewAppError("SqlChannelStore.AutocompleteInTeamForSearch", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
		}
	}

	return channels, nil
}

func (s SqlChannelStore) SearchInTeam(teamId string, term string, includeDeleted bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		deleteFilter := "AND DeleteAt = 0"
		if includeDeleted {
			deleteFilter = ""
		}
		searchQuery := `
			SELECT
				*
			FROM
				Channels
			WHERE
				TeamId = :TeamId
				AND Type = 'O'
				` + deleteFilter + `
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

func (s SqlChannelStore) buildLIKEClause(term string, searchColumns string) (likeClause, likeTerm string) {
	likeTerm = term

	// These chars must be removed from the like query.
	for _, c := range ignoreLikeSearchChar {
		likeTerm = strings.Replace(likeTerm, c, "", -1)
	}

	// These chars must be escaped in the like query.
	for _, c := range escapeLikeSearchChar {
		likeTerm = strings.Replace(likeTerm, c, "*"+c, -1)
	}

	if likeTerm == "" {
		return
	}

	// Prepare the LIKE portion of the query.
	var searchFields []string
	for _, field := range strings.Split(searchColumns, ", ") {
		if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
			searchFields = append(searchFields, fmt.Sprintf("lower(%s) LIKE lower(%s) escape '*'", field, ":LikeTerm"))
		} else {
			searchFields = append(searchFields, fmt.Sprintf("%s LIKE %s escape '*'", field, ":LikeTerm"))
		}
	}

	likeClause = fmt.Sprintf("(%s)", strings.Join(searchFields, " OR "))
	likeTerm += "%"
	return
}

func (s SqlChannelStore) buildFulltextClause(term string, searchColumns string) (fulltextClause, fulltextTerm string) {
	// Copy the terms as we will need to prepare them differently for each search type.
	fulltextTerm = term

	// These chars must be treated as spaces in the fulltext query.
	for _, c := range spaceFulltextSearchChar {
		fulltextTerm = strings.Replace(fulltextTerm, c, " ", -1)
	}

	// Prepare the FULLTEXT portion of the query.
	if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		fulltextTerm = strings.Replace(fulltextTerm, "|", "", -1)

		splitTerm := strings.Fields(fulltextTerm)
		for i, t := range strings.Fields(fulltextTerm) {
			if i == len(splitTerm)-1 {
				splitTerm[i] = t + ":*"
			} else {
				splitTerm[i] = t + ":* &"
			}
		}

		fulltextTerm = strings.Join(splitTerm, " ")

		fulltextClause = fmt.Sprintf("((%s) @@ to_tsquery(:FulltextTerm))", convertMySQLFullTextColumnsToPostgres(searchColumns))
	} else if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
		splitTerm := strings.Fields(fulltextTerm)
		for i, t := range strings.Fields(fulltextTerm) {
			splitTerm[i] = "+" + t + "*"
		}

		fulltextTerm = strings.Join(splitTerm, " ")

		fulltextClause = fmt.Sprintf("MATCH(%s) AGAINST (:FulltextTerm IN BOOLEAN MODE)", searchColumns)
	}

	return
}

func (s SqlChannelStore) performSearch(searchQuery string, term string, parameters map[string]interface{}) store.StoreResult {
	result := store.StoreResult{}

	likeClause, likeTerm := s.buildLIKEClause(term, "Name, DisplayName, Purpose")
	if likeTerm == "" {
		// If the likeTerm is empty after preparing, then don't bother searching.
		searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", "", 1)
	} else {
		parameters["LikeTerm"] = likeTerm
		fulltextClause, fulltextTerm := s.buildFulltextClause(term, "Name, DisplayName, Purpose")
		parameters["FulltextTerm"] = fulltextTerm
		searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", "AND ("+likeClause+" OR "+fulltextClause+")", 1)
	}

	var channels model.ChannelList

	if _, err := s.GetReplica().Select(&channels, searchQuery, parameters); err != nil {
		result.Err = model.NewAppError("SqlChannelStore.Search", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
		return result
	}

	result.Data = &channels
	return result
}

func (s SqlChannelStore) GetMembersByIds(channelId string, userIds []string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var dbMembers channelMemberWithSchemeRolesList
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

		if _, err := s.GetReplica().Select(&dbMembers, CHANNEL_MEMBERS_WITH_SCHEME_SELECT_QUERY+"WHERE ChannelMembers.ChannelId = :ChannelId AND ChannelMembers.UserId IN ("+idQuery+")", props); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetMembersByIds", "store.sql_channel.get_members_by_ids.app_error", nil, "channelId="+channelId+" "+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = dbMembers.ToModel()
	})
}

func (s SqlChannelStore) GetChannelsByScheme(schemeId string, offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var channels model.ChannelList
		_, err := s.GetReplica().Select(&channels, "SELECT * FROM Channels WHERE SchemeId = :SchemeId ORDER BY DisplayName LIMIT :Limit OFFSET :Offset", map[string]interface{}{"SchemeId": schemeId, "Offset": offset, "Limit": limit})
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetChannelsByScheme", "store.sql_channel.get_by_scheme.app_error", nil, "schemeId="+schemeId+" "+err.Error(), http.StatusInternalServerError)
			return
		}
		result.Data = channels
	})
}

// This function does the Advanced Permissions Phase 2 migration for ChannelMember objects. It performs the migration
// in batches as a single transaction per batch to ensure consistency but to also minimise execution time to avoid
// causing unnecessary table locks. **THIS FUNCTION SHOULD NOT BE USED FOR ANY OTHER PURPOSE.** Executing this function
// *after* the new Schemes functionality has been used on an installation will have unintended consequences.
func (s SqlChannelStore) MigrateChannelMembers(fromChannelId string, fromUserId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var transaction *gorp.Transaction
		var err error

		if transaction, err = s.GetMaster().Begin(); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.MigrateChannelMembers", "store.sql_channel.migrate_channel_members.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		var channelMembers []channelMember
		if _, err := transaction.Select(&channelMembers, "SELECT * from ChannelMembers WHERE (ChannelId, UserId) > (:FromChannelId, :FromUserId) ORDER BY ChannelId, UserId LIMIT 100", map[string]interface{}{"FromChannelId": fromChannelId, "FromUserId": fromUserId}); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.MigrateChannelMembers", "store.sql_channel.migrate_channel_members.select.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		if len(channelMembers) == 0 {
			// No more channel members in query result means that the migration has finished.
			return
		}

		for _, member := range channelMembers {
			roles := strings.Fields(member.Roles)
			var newRoles []string
			if !member.SchemeAdmin.Valid {
				member.SchemeAdmin = sql.NullBool{Bool: false, Valid: true}
			}
			if !member.SchemeUser.Valid {
				member.SchemeUser = sql.NullBool{Bool: false, Valid: true}
			}
			for _, role := range roles {
				if role == model.CHANNEL_ADMIN_ROLE_ID {
					member.SchemeAdmin = sql.NullBool{Bool: true, Valid: true}
				} else if role == model.CHANNEL_USER_ROLE_ID {
					member.SchemeUser = sql.NullBool{Bool: true, Valid: true}
				} else {
					newRoles = append(newRoles, role)
				}
			}
			member.Roles = strings.Join(newRoles, " ")

			if _, err := transaction.Update(&member); err != nil {
				if err2 := transaction.Rollback(); err2 != nil {
					result.Err = model.NewAppError("SqlChannelStore.MigrateChannelMembers", "store.sql_channel.migrate_channel_members.rollback_transaction.app_error", nil, err2.Error(), http.StatusInternalServerError)
					return
				}
				result.Err = model.NewAppError("SqlChannelStore.MigrateChannelMembers", "store.sql_channel.migrate_channel_members.update.app_error", nil, err.Error(), http.StatusInternalServerError)
				return
			}

		}

		if err := transaction.Commit(); err != nil {
			if err2 := transaction.Rollback(); err2 != nil {
				result.Err = model.NewAppError("SqlChannelStore.MigrateChannelMembers", "store.sql_channel.migrate_channel_members.rollback_transaction.app_error", nil, err2.Error(), http.StatusInternalServerError)
				return
			}
			result.Err = model.NewAppError("SqlChannelStore.MigrateChannelMembers", "store.sql_channel.migrate_channel_members.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		data := make(map[string]string)
		data["ChannelId"] = channelMembers[len(channelMembers)-1].ChannelId
		data["UserId"] = channelMembers[len(channelMembers)-1].UserId
		result.Data = data
	})
}

func (s SqlChannelStore) ResetAllChannelSchemes() store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		transaction, err := s.GetMaster().Begin()
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.ResetAllChannelSchemes", "store.sql_channel.reset_all_channel_schemes.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		*result = s.resetAllChannelSchemesT(transaction)
		if result.Err != nil {
			transaction.Rollback()
			return
		}

		if err := transaction.Commit(); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.ResetAllChannelSchemes", "store.sql_channel.reset_all_channel_schemes.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}
	})
}

func (s SqlChannelStore) resetAllChannelSchemesT(transaction *gorp.Transaction) store.StoreResult {
	result := store.StoreResult{}

	if _, err := transaction.Exec("UPDATE Channels SET SchemeId=''"); err != nil {
		result.Err = model.NewAppError("SqlChannelStore.ResetAllChannelSchemes", "store.sql_channel.reset_all_channel_schemes.app_error", nil, err.Error(), http.StatusInternalServerError)
		return result
	}

	return result
}

func (s SqlChannelStore) ClearAllCustomRoleAssignments() store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		builtInRoles := model.MakeDefaultRoles()
		lastUserId := strings.Repeat("0", 26)
		lastChannelId := strings.Repeat("0", 26)

		for {
			var transaction *gorp.Transaction
			var err error

			if transaction, err = s.GetMaster().Begin(); err != nil {
				result.Err = model.NewAppError("SqlChannelStore.ClearAllCustomRoleAssignments", "store.sql_channel.clear_all_custom_role_assignments.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
				return
			}

			var channelMembers []*channelMember
			if _, err := transaction.Select(&channelMembers, "SELECT * from ChannelMembers WHERE (ChannelId, UserId) > (:ChannelId, :UserId) ORDER BY ChannelId, UserId LIMIT 1000", map[string]interface{}{"ChannelId": lastChannelId, "UserId": lastUserId}); err != nil {
				if err2 := transaction.Rollback(); err2 != nil {
					result.Err = model.NewAppError("SqlChannelStore.ClearAllCustomRoleAssignments", "store.sql_channel.clear_all_custom_role_assignments.rollback_transaction.app_error", nil, err2.Error(), http.StatusInternalServerError)
					return
				}
				result.Err = model.NewAppError("SqlChannelStore.ClearAllCustomRoleAssignments", "store.sql_channel.clear_all_custom_role_assignments.select.app_error", nil, err.Error(), http.StatusInternalServerError)
				return
			}

			if len(channelMembers) == 0 {
				break
			}

			for _, member := range channelMembers {
				lastUserId = member.UserId
				lastChannelId = member.ChannelId

				var newRoles []string

				for _, role := range strings.Fields(member.Roles) {
					for name := range builtInRoles {
						if name == role {
							newRoles = append(newRoles, role)
							break
						}
					}
				}

				newRolesString := strings.Join(newRoles, " ")
				if newRolesString != member.Roles {
					if _, err := transaction.Exec("UPDATE ChannelMembers SET Roles = :Roles WHERE UserId = :UserId AND ChannelId = :ChannelId", map[string]interface{}{"Roles": newRolesString, "ChannelId": member.ChannelId, "UserId": member.UserId}); err != nil {
						if err2 := transaction.Rollback(); err2 != nil {
							result.Err = model.NewAppError("SqlChannelStore.ClearAllCustomRoleAssignments", "store.sql_channel.clear_all_custom_role_assignments.rollback_transaction.app_error", nil, err2.Error(), http.StatusInternalServerError)
							return
						}
						result.Err = model.NewAppError("SqlChannelStore.ClearAllCustomRoleAssignments", "store.sql_channel.clear_all_custom_role_assignments.update.app_error", nil, err.Error(), http.StatusInternalServerError)
						return
					}
				}
			}

			if err := transaction.Commit(); err != nil {
				if err2 := transaction.Rollback(); err2 != nil {
					result.Err = model.NewAppError("SqlChannelStore.ClearAllCustomRoleAssignments", "store.sql_channel.clear_all_custom_role_assignments.rollback_transaction.app_error", nil, err2.Error(), http.StatusInternalServerError)
					return
				}
				result.Err = model.NewAppError("SqlChannelStore.ClearAllCustomRoleAssignments", "store.sql_channel.clear_all_custom_role_assignments.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
				return
			}
		}
	})
}

func (s SqlChannelStore) ResetLastPostAt() store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		transaction, err := s.GetMaster().Begin()
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.ResetLastPostAt", "store.sql_channel.reset_last_post_at.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		*result = s.resetLastPostAtT(transaction)
		if result.Err != nil {
			transaction.Rollback()
			return
		}

		if err := transaction.Commit(); err != nil {
			result.Err = model.NewAppError("SqlChannelStore.ResetLastPostAt", "store.sql_channel.reset_last_post_at.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}
	})
}

func (s SqlChannelStore) resetLastPostAtT(transaction *gorp.Transaction) store.StoreResult {
	result := store.StoreResult{}

	var query string
	if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		query = "UPDATE Channels SET LastPostAt = COALESCE((SELECT UpdateAt FROM Posts WHERE ChannelId = Channels.Id ORDER BY UpdateAt DESC LIMIT 1), Channels.CreateAt);"
	} else {
		query = "UPDATE Channels SET LastPostAt = IFNULL((SELECT UpdateAt FROM Posts WHERE ChannelId = Channels.Id ORDER BY UpdateAt DESC LIMIT 1), Channels.CreateAt);"
	}

	if _, err := transaction.Exec(query); err != nil {
		result.Err = model.NewAppError("SqlChannelStore.ResetLastPostAt", "store.sql_channel.reset_last_post_at.app_error", nil, err.Error(), http.StatusInternalServerError)
		return result
	}

	return result
}

func (s SqlChannelStore) EnableExperimentalPublicChannelsMaterialization() {
	// See SqlChannelStoreExperimental
}

func (s SqlChannelStore) DisableExperimentalPublicChannelsMaterialization() {
	// See SqlChannelStoreExperimental
}

func (s SqlChannelStore) IsExperimentalPublicChannelsMaterializationEnabled() bool {
	// See SqlChannelStoreExperimental
	return false
}

func (s SqlChannelStore) GetAllChannelsForExportAfter(limit int, afterId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var data []*model.ChannelForExport
		if _, err := s.GetReplica().Select(&data, `
			SELECT
				Channels.*,
				Teams.Name as TeamName,
				Schemes.Name as SchemeName
			FROM Channels
			INNER JOIN
				Teams ON Channels.TeamId = Teams.Id
			LEFT JOIN
				Schemes ON Channels.SchemeId = Schemes.Id
			WHERE
				Channels.Id > :AfterId
				AND Channels.Type IN ('O', 'P')
			ORDER BY
				Id
			LIMIT :Limit`,
			map[string]interface{}{"AfterId": afterId, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetAllChannelsForExportAfter", "store.sql_channel.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = data
	})
}

func (s SqlChannelStore) GetChannelMembersForExport(userId string, teamId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var members []*model.ChannelMemberForExport
		_, err := s.GetReplica().Select(&members, `
            SELECT
                ChannelMembers.*,
                Channels.Name as ChannelName
            FROM
                ChannelMembers
            INNER JOIN
                Channels ON ChannelMembers.ChannelId = Channels.Id
            WHERE
                ChannelMembers.UserId = :UserId
				AND Channels.TeamId = :TeamId
				AND Channels.DeleteAt = 0`,
			map[string]interface{}{"TeamId": teamId, "UserId": userId})

		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetChannelMembersForExport", "store.sql_channel.get_members.app_error", nil, "teamId="+teamId+", userId="+userId+", err="+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = members
	})
}
