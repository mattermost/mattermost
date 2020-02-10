// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/mattermost/gorp"
	"github.com/pkg/errors"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-server/v5/einterfaces"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/cache/lru"
	"github.com/mattermost/mattermost-server/v5/store"
)

const (
	ALL_CHANNEL_MEMBERS_FOR_USER_CACHE_SIZE = model.SESSION_CACHE_SIZE
	ALL_CHANNEL_MEMBERS_FOR_USER_CACHE_SEC  = 900 // 15 mins

	ALL_CHANNEL_MEMBERS_NOTIFY_PROPS_FOR_CHANNEL_CACHE_SIZE = model.SESSION_CACHE_SIZE
	ALL_CHANNEL_MEMBERS_NOTIFY_PROPS_FOR_CHANNEL_CACHE_SEC  = 1800 // 30 mins

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
	SchemeGuest  sql.NullBool
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
		SchemeGuest:  sql.NullBool{Valid: true, Bool: cm.SchemeGuest},
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
	SchemeGuest                   sql.NullBool
	SchemeUser                    sql.NullBool
	SchemeAdmin                   sql.NullBool
	TeamSchemeDefaultGuestRole    sql.NullString
	TeamSchemeDefaultUserRole     sql.NullString
	TeamSchemeDefaultAdminRole    sql.NullString
	ChannelSchemeDefaultGuestRole sql.NullString
	ChannelSchemeDefaultUserRole  sql.NullString
	ChannelSchemeDefaultAdminRole sql.NullString
}

type channelMemberWithSchemeRolesList []channelMemberWithSchemeRoles

func (db channelMemberWithSchemeRoles) ToModel() *model.ChannelMember {
	var roles []string
	var explicitRoles []string

	// Identify any system-wide scheme derived roles that are in "Roles" field due to not yet being migrated,
	// and exclude them from ExplicitRoles field.
	schemeGuest := db.SchemeGuest.Valid && db.SchemeGuest.Bool
	schemeUser := db.SchemeUser.Valid && db.SchemeUser.Bool
	schemeAdmin := db.SchemeAdmin.Valid && db.SchemeAdmin.Bool
	for _, role := range strings.Fields(db.Roles) {
		isImplicit := false
		if role == model.CHANNEL_GUEST_ROLE_ID {
			// We have an implicit role via the system scheme. Override the "schemeGuest" field to true.
			schemeGuest = true
			isImplicit = true
		} else if role == model.CHANNEL_USER_ROLE_ID {
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
	if db.SchemeGuest.Valid && db.SchemeGuest.Bool {
		if db.ChannelSchemeDefaultGuestRole.Valid && db.ChannelSchemeDefaultGuestRole.String != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, db.ChannelSchemeDefaultGuestRole.String)
		} else if db.TeamSchemeDefaultGuestRole.Valid && db.TeamSchemeDefaultGuestRole.String != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, db.TeamSchemeDefaultGuestRole.String)
		} else {
			schemeImpliedRoles = append(schemeImpliedRoles, model.CHANNEL_GUEST_ROLE_ID)
		}
	}
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
		SchemeGuest:   schemeGuest,
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
	SchemeGuest                   sql.NullBool
	SchemeUser                    sql.NullBool
	SchemeAdmin                   sql.NullBool
	TeamSchemeDefaultGuestRole    sql.NullString
	TeamSchemeDefaultUserRole     sql.NullString
	TeamSchemeDefaultAdminRole    sql.NullString
	ChannelSchemeDefaultGuestRole sql.NullString
	ChannelSchemeDefaultUserRole  sql.NullString
	ChannelSchemeDefaultAdminRole sql.NullString
}

type allChannelMembers []allChannelMember

func (db allChannelMember) Process() (string, string) {
	roles := strings.Fields(db.Roles)

	// Add any scheme derived roles that are not in the Roles field due to being Implicit from the Scheme, and add
	// them to the Roles field for backwards compatibility reasons.
	var schemeImpliedRoles []string
	if db.SchemeGuest.Valid && db.SchemeGuest.Bool {
		if db.ChannelSchemeDefaultGuestRole.Valid && db.ChannelSchemeDefaultGuestRole.String != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, db.ChannelSchemeDefaultGuestRole.String)
		} else if db.TeamSchemeDefaultGuestRole.Valid && db.TeamSchemeDefaultGuestRole.String != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, db.TeamSchemeDefaultGuestRole.String)
		} else {
			schemeImpliedRoles = append(schemeImpliedRoles, model.CHANNEL_GUEST_ROLE_ID)
		}
	}
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

// publicChannel is a subset of the metadata corresponding to public channels only.
type publicChannel struct {
	Id          string `json:"id"`
	DeleteAt    int64  `json:"delete_at"`
	TeamId      string `json:"team_id"`
	DisplayName string `json:"display_name"`
	Name        string `json:"name"`
	Header      string `json:"header"`
	Purpose     string `json:"purpose"`
}

var allChannelMembersForUserCache = lru.New(ALL_CHANNEL_MEMBERS_FOR_USER_CACHE_SIZE)
var allChannelMembersNotifyPropsForChannelCache = lru.New(ALL_CHANNEL_MEMBERS_NOTIFY_PROPS_FOR_CHANNEL_CACHE_SIZE)
var channelByNameCache = lru.New(model.CHANNEL_CACHE_SIZE)

func (s SqlChannelStore) ClearCaches() {
	allChannelMembersForUserCache.Purge()
	allChannelMembersNotifyPropsForChannelCache.Purge()
	channelByNameCache.Purge()

	if s.metrics != nil {
		s.metrics.IncrementMemCacheInvalidationCounter("All Channel Members for User - Purge")
		s.metrics.IncrementMemCacheInvalidationCounter("All Channel Members Notify Props for Channel - Purge")
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

		tablePublicChannels := db.AddTableWithName(publicChannel{}, "PublicChannels").SetKeys(false, "Id")
		tablePublicChannels.ColMap("Id").SetMaxSize(26)
		tablePublicChannels.ColMap("TeamId").SetMaxSize(26)
		tablePublicChannels.ColMap("DisplayName").SetMaxSize(64)
		tablePublicChannels.ColMap("Name").SetMaxSize(64)
		tablePublicChannels.SetUniqueTogether("Name", "TeamId")
		tablePublicChannels.ColMap("Header").SetMaxSize(1024)
		tablePublicChannels.ColMap("Purpose").SetMaxSize(250)
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

	s.CreateIndexIfNotExists("idx_publicchannels_team_id", "PublicChannels", "TeamId")
	s.CreateIndexIfNotExists("idx_publicchannels_name", "PublicChannels", "Name")
	s.CreateIndexIfNotExists("idx_publicchannels_delete_at", "PublicChannels", "DeleteAt")
	if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		s.CreateIndexIfNotExists("idx_publicchannels_name_lower", "PublicChannels", "lower(Name)")
		s.CreateIndexIfNotExists("idx_publicchannels_displayname_lower", "PublicChannels", "lower(DisplayName)")
	}
	s.CreateFullTextIndexIfNotExists("idx_publicchannels_search_txt", "PublicChannels", "Name, DisplayName, Purpose")
}

// MigratePublicChannels initializes the PublicChannels table with data created before this version
// of the Mattermost server kept it up-to-date.
func (s SqlChannelStore) MigratePublicChannels() error {
	if _, err := s.GetMaster().Exec(`
		INSERT INTO PublicChannels
		    (Id, DeleteAt, TeamId, DisplayName, Name, Header, Purpose)
		SELECT
		    c.Id, c.DeleteAt, c.TeamId, c.DisplayName, c.Name, c.Header, c.Purpose
		FROM
		    Channels c
		LEFT JOIN
		    PublicChannels pc ON (pc.Id = c.Id)
		WHERE
		    c.Type = 'O'
		AND pc.Id IS NULL
	`); err != nil {
		return err
	}

	return nil
}

func (s SqlChannelStore) upsertPublicChannelT(transaction *gorp.Transaction, channel *model.Channel) error {
	publicChannel := &publicChannel{
		Id:          channel.Id,
		DeleteAt:    channel.DeleteAt,
		TeamId:      channel.TeamId,
		DisplayName: channel.DisplayName,
		Name:        channel.Name,
		Header:      channel.Header,
		Purpose:     channel.Purpose,
	}

	if channel.Type != model.CHANNEL_OPEN {
		if _, err := transaction.Delete(publicChannel); err != nil {
			return errors.Wrap(err, "failed to delete public channel")
		}

		return nil
	}

	if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
		// Leverage native upsert for MySQL, since RowsAffected returns 0 if the row exists
		// but no changes were made, breaking the update-then-insert paradigm below when
		// the row already exists. (Postgres 9.4 doesn't support native upsert.)
		if _, err := transaction.Exec(`
			INSERT INTO
			    PublicChannels(Id, DeleteAt, TeamId, DisplayName, Name, Header, Purpose)
			VALUES
			    (:Id, :DeleteAt, :TeamId, :DisplayName, :Name, :Header, :Purpose)
			ON DUPLICATE KEY UPDATE
			    DeleteAt = :DeleteAt,
			    TeamId = :TeamId,
			    DisplayName = :DisplayName,
			    Name = :Name,
			    Header = :Header,
			    Purpose = :Purpose;
		`, map[string]interface{}{
			"Id":          publicChannel.Id,
			"DeleteAt":    publicChannel.DeleteAt,
			"TeamId":      publicChannel.TeamId,
			"DisplayName": publicChannel.DisplayName,
			"Name":        publicChannel.Name,
			"Header":      publicChannel.Header,
			"Purpose":     publicChannel.Purpose,
		}); err != nil {
			return errors.Wrap(err, "failed to insert public channel")
		}
	} else {
		count, err := transaction.Update(publicChannel)
		if err != nil {
			return errors.Wrap(err, "failed to update public channel")
		}
		if count > 0 {
			return nil
		}

		if err := transaction.Insert(publicChannel); err != nil {
			return errors.Wrap(err, "failed to insert public channel")
		}
	}

	return nil
}

// Save writes the (non-direct) channel channel to the database.
func (s SqlChannelStore) Save(channel *model.Channel, maxChannelsPerTeam int64) (*model.Channel, *model.AppError) {

	if channel.DeleteAt != 0 {
		return nil, model.NewAppError("SqlChannelStore.Save", "store.sql_channel.save.archived_channel.app_error", nil, "", http.StatusBadRequest)
	}

	if channel.Type == model.CHANNEL_DIRECT {
		return nil, model.NewAppError("SqlChannelStore.Save", "store.sql_channel.save.direct_channel.app_error", nil, "", http.StatusBadRequest)
	}

	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.Save", "store.sql_channel.save.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer finalizeTransaction(transaction)

	newChannel, appErr := s.saveChannelT(transaction, channel, maxChannelsPerTeam)
	if appErr != nil {
		return newChannel, appErr
	}

	// Additionally propagate the write to the PublicChannels table.
	if err := s.upsertPublicChannelT(transaction, newChannel); err != nil {
		return nil, model.NewAppError("SqlChannelStore.Save", "store.sql_channel.save.upsert_public_channel.app_error", nil, err.Error(), http.StatusInternalServerError)

	}

	if err := transaction.Commit(); err != nil {
		return nil, model.NewAppError("SqlChannelStore.Save", "store.sql_channel.save.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return newChannel, nil
}

func (s SqlChannelStore) CreateDirectChannel(user *model.User, otherUser *model.User) (*model.Channel, *model.AppError) {
	channel := new(model.Channel)

	channel.DisplayName = ""
	channel.Name = model.GetDMNameFromIds(otherUser.Id, user.Id)

	channel.Header = ""
	channel.Type = model.CHANNEL_DIRECT

	cm1 := &model.ChannelMember{
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
		SchemeGuest: user.IsGuest(),
		SchemeUser:  !user.IsGuest(),
	}
	cm2 := &model.ChannelMember{
		UserId:      otherUser.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
		SchemeGuest: otherUser.IsGuest(),
		SchemeUser:  !otherUser.IsGuest(),
	}

	return s.SaveDirectChannel(channel, cm1, cm2)
}

func (s SqlChannelStore) SaveDirectChannel(directchannel *model.Channel, member1 *model.ChannelMember, member2 *model.ChannelMember) (*model.Channel, *model.AppError) {
	if directchannel.DeleteAt != 0 {
		return nil, model.NewAppError("SqlChannelStore.Save", "store.sql_channel.save.archived_channel.app_error", nil, "", http.StatusBadRequest)
	}

	if directchannel.Type != model.CHANNEL_DIRECT {
		return nil, model.NewAppError("SqlChannelStore.SaveDirectChannel", "store.sql_channel.save_direct_channel.not_direct.app_error", nil, "", http.StatusBadRequest)
	}

	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.SaveDirectChannel", "store.sql_channel.save_direct_channel.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer finalizeTransaction(transaction)

	directchannel.TeamId = ""
	newChannel, appErr := s.saveChannelT(transaction, directchannel, 0)
	if appErr != nil {
		return newChannel, appErr
	}

	// Members need new channel ID
	member1.ChannelId = newChannel.Id
	member2.ChannelId = newChannel.Id

	_, member1SaveErr := s.saveMemberT(transaction, member1)
	member2SaveErr := member1SaveErr
	if member1.UserId != member2.UserId {
		_, member2SaveErr = s.saveMemberT(transaction, member2)
	}

	if member1SaveErr != nil || member2SaveErr != nil {
		details := ""
		if member1SaveErr != nil {
			details += "Member1Err: " + member1SaveErr.Message
		}
		if member2SaveErr != nil {
			details += "Member2Err: " + member2SaveErr.Message
		}
		return nil, model.NewAppError("SqlChannelStore.SaveDirectChannel", "store.sql_channel.save_direct_channel.add_members.app_error", nil, details, http.StatusInternalServerError)
	}

	if err := transaction.Commit(); err != nil {
		return nil, model.NewAppError("SqlChannelStore.SaveDirectChannel", "store.sql_channel.save_direct_channel.commit.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return newChannel, nil

}

func (s SqlChannelStore) saveChannelT(transaction *gorp.Transaction, channel *model.Channel, maxChannelsPerTeam int64) (*model.Channel, *model.AppError) {
	if len(channel.Id) > 0 {
		return nil, model.NewAppError("SqlChannelStore.Save", "store.sql_channel.save_channel.existing.app_error", nil, "id="+channel.Id, http.StatusBadRequest)
	}

	channel.PreSave()
	if err := channel.IsValid(); err != nil {
		return nil, err
	}

	if channel.Type != model.CHANNEL_DIRECT && channel.Type != model.CHANNEL_GROUP && maxChannelsPerTeam >= 0 {
		if count, err := transaction.SelectInt("SELECT COUNT(0) FROM Channels WHERE TeamId = :TeamId AND DeleteAt = 0 AND (Type = 'O' OR Type = 'P')", map[string]interface{}{"TeamId": channel.TeamId}); err != nil {
			return nil, model.NewAppError("SqlChannelStore.Save", "store.sql_channel.save_channel.current_count.app_error", nil, "teamId="+channel.TeamId+", "+err.Error(), http.StatusInternalServerError)
		} else if count >= maxChannelsPerTeam {
			return nil, model.NewAppError("SqlChannelStore.Save", "store.sql_channel.save_channel.limit.app_error", nil, "teamId="+channel.TeamId, http.StatusBadRequest)
		}
	}

	if err := transaction.Insert(channel); err != nil {
		if IsUniqueConstraintError(err, []string{"Name", "channels_name_teamid_key"}) {
			dupChannel := model.Channel{}
			s.GetMaster().SelectOne(&dupChannel, "SELECT * FROM Channels WHERE TeamId = :TeamId AND Name = :Name", map[string]interface{}{"TeamId": channel.TeamId, "Name": channel.Name})
			return &dupChannel, model.NewAppError("SqlChannelStore.Save", store.CHANNEL_EXISTS_ERROR, nil, "id="+channel.Id+", "+err.Error(), http.StatusBadRequest)
		}
		return nil, model.NewAppError("SqlChannelStore.Save", "store.sql_channel.save_channel.save.app_error", nil, "id="+channel.Id+", "+err.Error(), http.StatusInternalServerError)
	}
	return channel, nil
}

// Update writes the updated channel to the database.
func (s SqlChannelStore) Update(channel *model.Channel) (*model.Channel, *model.AppError) {
	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.Update", "store.sql_channel.update.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer finalizeTransaction(transaction)

	updatedChannel, appErr := s.updateChannelT(transaction, channel)
	if appErr != nil {
		return nil, appErr
	}

	// Additionally propagate the write to the PublicChannels table.
	if err := s.upsertPublicChannelT(transaction, updatedChannel); err != nil {
		return nil, model.NewAppError("SqlChannelStore.Update", "store.sql_channel.update.upsert_public_channel.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if err := transaction.Commit(); err != nil {
		return nil, model.NewAppError("SqlChannelStore.Update", "store.sql_channel.update.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return updatedChannel, nil
}

func (s SqlChannelStore) updateChannelT(transaction *gorp.Transaction, channel *model.Channel) (*model.Channel, *model.AppError) {
	channel.PreUpdate()

	if channel.DeleteAt != 0 {
		return nil, model.NewAppError("SqlChannelStore.Update", "store.sql_channel.update.archived_channel.app_error", nil, "", http.StatusBadRequest)
	}

	if err := channel.IsValid(); err != nil {
		return nil, err
	}

	count, err := transaction.Update(channel)
	if err != nil {
		if IsUniqueConstraintError(err, []string{"Name", "channels_name_teamid_key"}) {
			dupChannel := model.Channel{}
			s.GetReplica().SelectOne(&dupChannel, "SELECT * FROM Channels WHERE TeamId = :TeamId AND Name= :Name AND DeleteAt > 0", map[string]interface{}{"TeamId": channel.TeamId, "Name": channel.Name})
			if dupChannel.DeleteAt > 0 {
				return nil, model.NewAppError("SqlChannelStore.Update", "store.sql_channel.update.previously.app_error", nil, "id="+channel.Id+", "+err.Error(), http.StatusBadRequest)
			}
			return nil, model.NewAppError("SqlChannelStore.Update", "store.sql_channel.update.exists.app_error", nil, "id="+channel.Id+", "+err.Error(), http.StatusBadRequest)
		}
		return nil, model.NewAppError("SqlChannelStore.Update", "store.sql_channel.update.updating.app_error", nil, "id="+channel.Id+", "+err.Error(), http.StatusInternalServerError)
	}

	if count != 1 {
		return nil, model.NewAppError("SqlChannelStore.Update", "store.sql_channel.update.app_error", nil, "id="+channel.Id, http.StatusInternalServerError)
	}

	return channel, nil
}

func (s SqlChannelStore) GetChannelUnread(channelId, userId string) (*model.ChannelUnread, *model.AppError) {
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
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlChannelStore.GetChannelUnread", "store.sql_channel.get_unread.app_error", nil, "channelId="+channelId+" "+err.Error(), http.StatusNotFound)
		}
		return nil, model.NewAppError("SqlChannelStore.GetChannelUnread", "store.sql_channel.get_unread.app_error", nil, "channelId="+channelId+" "+err.Error(), http.StatusInternalServerError)
	}
	return &unreadChannel, nil
}

func (s SqlChannelStore) InvalidateChannel(id string) {
}

func (s SqlChannelStore) InvalidateChannelByName(teamId, name string) {
	channelByNameCache.Remove(teamId + name)
	if s.metrics != nil {
		s.metrics.IncrementMemCacheInvalidationCounter("Channel by Name - Remove by TeamId and Name")
	}
}

func (s SqlChannelStore) Get(id string, allowFromCache bool) (*model.Channel, *model.AppError) {
	return s.get(id, false, allowFromCache)
}

func (s SqlChannelStore) GetPinnedPosts(channelId string) (*model.PostList, *model.AppError) {
	pl := model.NewPostList()

	var posts []*model.Post
	if _, err := s.GetReplica().Select(&posts, "SELECT * FROM Posts WHERE IsPinned = true AND ChannelId = :ChannelId AND DeleteAt = 0 ORDER BY CreateAt ASC", map[string]interface{}{"ChannelId": channelId}); err != nil {
		return nil, model.NewAppError("SqlPostStore.GetPinnedPosts", "store.sql_channel.pinned_posts.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	for _, post := range posts {
		pl.AddPost(post)
		pl.AddOrder(post.Id)
	}
	return pl, nil
}

func (s SqlChannelStore) GetFromMaster(id string) (*model.Channel, *model.AppError) {
	return s.get(id, true, false)
}

func (s SqlChannelStore) get(id string, master bool, allowFromCache bool) (*model.Channel, *model.AppError) {
	var db *gorp.DbMap

	if master {
		db = s.GetMaster()
	} else {
		db = s.GetReplica()
	}

	obj, err := db.Get(model.Channel{}, id)
	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.Get", "store.sql_channel.get.find.app_error", nil, "id="+id+", "+err.Error(), http.StatusInternalServerError)
	}

	if obj == nil {
		return nil, model.NewAppError("SqlChannelStore.Get", "store.sql_channel.get.existing.app_error", nil, "id="+id, http.StatusNotFound)
	}

	ch := obj.(*model.Channel)
	return ch, nil
}

// Delete records the given deleted timestamp to the channel in question.
func (s SqlChannelStore) Delete(channelId string, time int64) *model.AppError {
	return s.SetDeleteAt(channelId, time, time)
}

// Restore reverts a previous deleted timestamp from the channel in question.
func (s SqlChannelStore) Restore(channelId string, time int64) *model.AppError {
	return s.SetDeleteAt(channelId, 0, time)
}

// SetDeleteAt records the given deleted and updated timestamp to the channel in question.
func (s SqlChannelStore) SetDeleteAt(channelId string, deleteAt, updateAt int64) *model.AppError {
	defer s.InvalidateChannel(channelId)

	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return model.NewAppError("SqlChannelStore.SetDeleteAt", "store.sql_channel.set_delete_at.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer finalizeTransaction(transaction)

	appErr := s.setDeleteAtT(transaction, channelId, deleteAt, updateAt)
	if appErr != nil {
		return appErr
	}

	// Additionally propagate the write to the PublicChannels table.
	if _, err := transaction.Exec(`
			UPDATE
			    PublicChannels
			SET
			    DeleteAt = :DeleteAt
			WHERE
			    Id = :ChannelId
		`, map[string]interface{}{
		"DeleteAt":  deleteAt,
		"ChannelId": channelId,
	}); err != nil {
		return model.NewAppError("SqlChannelStore.SetDeleteAt", "store.sql_channel.set_delete_at.update_public_channel.app_error", nil, "channel_id="+channelId+", "+err.Error(), http.StatusInternalServerError)
	}

	if err := transaction.Commit(); err != nil {
		return model.NewAppError("SqlChannelStore.SetDeleteAt", "store.sql_channel.set_delete_at.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (s SqlChannelStore) setDeleteAtT(transaction *gorp.Transaction, channelId string, deleteAt, updateAt int64) *model.AppError {
	_, err := transaction.Exec("Update Channels SET DeleteAt = :DeleteAt, UpdateAt = :UpdateAt WHERE Id = :ChannelId", map[string]interface{}{"DeleteAt": deleteAt, "UpdateAt": updateAt, "ChannelId": channelId})
	if err != nil {
		return model.NewAppError("SqlChannelStore.Delete", "store.sql_channel.delete.channel.app_error", nil, "id="+channelId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return nil
}

// PermanentDeleteByTeam removes all channels for the given team from the database.
func (s SqlChannelStore) PermanentDeleteByTeam(teamId string) *model.AppError {
	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return model.NewAppError("SqlChannelStore.PermanentDeleteByTeam", "store.sql_channel.permanent_delete_by_team.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer finalizeTransaction(transaction)

	if err := s.permanentDeleteByTeamtT(transaction, teamId); err != nil {
		return err
	}

	// Additionally propagate the deletions to the PublicChannels table.
	if _, err := transaction.Exec(`
			DELETE FROM
			    PublicChannels
			WHERE
			    TeamId = :TeamId
		`, map[string]interface{}{
		"TeamId": teamId,
	}); err != nil {
		return model.NewAppError("SqlChannelStore.PermanentDeleteByTeamt", "store.sql_channel.permanent_delete_by_team.delete_public_channels.app_error", nil, "team_id="+teamId+", "+err.Error(), http.StatusInternalServerError)
	}

	if err := transaction.Commit(); err != nil {
		return model.NewAppError("SqlChannelStore.PermanentDeleteByTeam", "store.sql_channel.permanent_delete_by_team.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (s SqlChannelStore) permanentDeleteByTeamtT(transaction *gorp.Transaction, teamId string) *model.AppError {
	if _, err := transaction.Exec("DELETE FROM Channels WHERE TeamId = :TeamId", map[string]interface{}{"TeamId": teamId}); err != nil {
		return model.NewAppError("SqlChannelStore.PermanentDeleteByTeam", "store.sql_channel.permanent_delete_by_team.app_error", nil, "teamId="+teamId+", "+err.Error(), http.StatusInternalServerError)
	}

	return nil
}

// PermanentDelete removes the given channel from the database.
func (s SqlChannelStore) PermanentDelete(channelId string) *model.AppError {
	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return model.NewAppError("SqlChannelStore.PermanentDelete", "store.sql_channel.permanent_delete.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer finalizeTransaction(transaction)

	if err := s.permanentDeleteT(transaction, channelId); err != nil {
		return err
	}

	// Additionally propagate the deletion to the PublicChannels table.
	if _, err := transaction.Exec(`
			DELETE FROM
			    PublicChannels
			WHERE
			    Id = :ChannelId
		`, map[string]interface{}{
		"ChannelId": channelId,
	}); err != nil {
		return model.NewAppError("SqlChannelStore.PermanentDelete", "store.sql_channel.permanent_delete.delete_public_channel.app_error", nil, "channel_id="+channelId+", "+err.Error(), http.StatusInternalServerError)
	}

	if err := transaction.Commit(); err != nil {
		return model.NewAppError("SqlChannelStore.PermanentDelete", "store.sql_channel.permanent_delete.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (s SqlChannelStore) permanentDeleteT(transaction *gorp.Transaction, channelId string) *model.AppError {
	if _, err := transaction.Exec("DELETE FROM Channels WHERE Id = :ChannelId", map[string]interface{}{"ChannelId": channelId}); err != nil {
		return model.NewAppError("SqlChannelStore.PermanentDelete", "store.sql_channel.permanent_delete.app_error", nil, "channel_id="+channelId+", "+err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (s SqlChannelStore) PermanentDeleteMembersByChannel(channelId string) *model.AppError {
	_, err := s.GetMaster().Exec("DELETE FROM ChannelMembers WHERE ChannelId = :ChannelId", map[string]interface{}{"ChannelId": channelId})
	if err != nil {
		return model.NewAppError("SqlChannelStore.RemoveAllMembersByChannel", "store.sql_channel.remove_member.app_error", nil, "channel_id="+channelId+", "+err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (s SqlChannelStore) GetChannels(teamId string, userId string, includeDeleted bool) (*model.ChannelList, *model.AppError) {
	query := "SELECT Channels.* FROM Channels, ChannelMembers WHERE Id = ChannelId AND UserId = :UserId AND DeleteAt = 0 AND (TeamId = :TeamId OR TeamId = '') ORDER BY DisplayName"
	if includeDeleted {
		query = "SELECT Channels.* FROM Channels, ChannelMembers WHERE Id = ChannelId AND UserId = :UserId AND (TeamId = :TeamId OR TeamId = '') ORDER BY DisplayName"
	}
	channels := &model.ChannelList{}
	_, err := s.GetReplica().Select(channels, query, map[string]interface{}{"TeamId": teamId, "UserId": userId})

	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.GetChannels", "store.sql_channel.get_channels.get.app_error", nil, "teamId="+teamId+", userId="+userId+", err="+err.Error(), http.StatusInternalServerError)
	}

	if len(*channels) == 0 {
		return nil, model.NewAppError("SqlChannelStore.GetChannels", "store.sql_channel.get_channels.not_found.app_error", nil, "teamId="+teamId+", userId="+userId, http.StatusBadRequest)
	}

	return channels, nil
}

func (s SqlChannelStore) GetAllChannels(offset, limit int, opts store.ChannelSearchOpts) (*model.ChannelListWithTeamData, *model.AppError) {
	query := s.getAllChannelsQuery(opts, false)

	query = query.OrderBy("c.DisplayName, Teams.DisplayName").Limit(uint64(limit)).Offset(uint64(offset))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.GetAllChannels", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	data := &model.ChannelListWithTeamData{}
	_, err = s.GetReplica().Select(data, queryString, args...)

	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.GetAllChannels", "store.sql_channel.get_all_channels.get.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return data, nil
}

func (s SqlChannelStore) GetAllChannelsCount(opts store.ChannelSearchOpts) (int64, *model.AppError) {
	query := s.getAllChannelsQuery(opts, true)

	queryString, args, err := query.ToSql()
	if err != nil {
		return 0, model.NewAppError("SqlChannelStore.GetAllChannelsCount", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	count, err := s.GetReplica().SelectInt(queryString, args...)
	if err != nil {
		return 0, model.NewAppError("SqlChannelStore.GetAllChannelsCount", "store.sql_channel.get_all_channels.get.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return count, nil
}

func (s SqlChannelStore) getAllChannelsQuery(opts store.ChannelSearchOpts, forCount bool) sq.SelectBuilder {
	var selectStr string
	if forCount {
		selectStr = "count(c.Id)"
	} else {
		selectStr = "c.*, Teams.DisplayName AS TeamDisplayName, Teams.Name AS TeamName, Teams.UpdateAt AS TeamUpdateAt"
	}

	query := s.getQueryBuilder().
		Select(selectStr).
		From("Channels AS c").
		Where(sq.Eq{"c.Type": []string{model.CHANNEL_PRIVATE, model.CHANNEL_OPEN}})

	if !forCount {
		query = query.Join("Teams ON Teams.Id = c.TeamId")
	}

	if !opts.IncludeDeleted {
		query = query.Where(sq.Eq{"c.DeleteAt": int(0)})
	}

	if len(opts.NotAssociatedToGroup) > 0 {
		query = query.Where("c.Id NOT IN (SELECT ChannelId FROM GroupChannels WHERE GroupChannels.GroupId = ? AND GroupChannels.DeleteAt = 0)", opts.NotAssociatedToGroup)
	}

	if len(opts.ExcludeChannelNames) > 0 {
		query = query.Where(sq.NotEq{"c.Name": opts.ExcludeChannelNames})
	}

	return query
}

func (s SqlChannelStore) GetMoreChannels(teamId string, userId string, offset int, limit int) (*model.ChannelList, *model.AppError) {
	channels := &model.ChannelList{}
	_, err := s.GetReplica().Select(channels, `
		SELECT
			Channels.*
		FROM
			Channels
		JOIN
			PublicChannels c ON (c.Id = Channels.Id)
		WHERE
			c.TeamId = :TeamId
		AND c.DeleteAt = 0
		AND c.Id NOT IN (
			SELECT
				c.Id
			FROM
				PublicChannels c
			JOIN
				ChannelMembers cm ON (cm.ChannelId = c.Id)
			WHERE
				c.TeamId = :TeamId
			AND cm.UserId = :UserId
			AND c.DeleteAt = 0
		)
		ORDER BY
			c.DisplayName
		LIMIT :Limit
		OFFSET :Offset
		`, map[string]interface{}{
		"TeamId": teamId,
		"UserId": userId,
		"Limit":  limit,
		"Offset": offset,
	})

	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.GetMoreChannels", "store.sql_channel.get_more_channels.get.app_error", nil, "teamId="+teamId+", userId="+userId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return channels, nil
}

func (s SqlChannelStore) GetPublicChannelsForTeam(teamId string, offset int, limit int) (*model.ChannelList, *model.AppError) {
	channels := &model.ChannelList{}
	_, err := s.GetReplica().Select(channels, `
		SELECT
			Channels.*
		FROM
			Channels
		JOIN
			PublicChannels pc ON (pc.Id = Channels.Id)
		WHERE
			pc.TeamId = :TeamId
		AND pc.DeleteAt = 0
		ORDER BY pc.DisplayName
		LIMIT :Limit
		OFFSET :Offset
		`, map[string]interface{}{
		"TeamId": teamId,
		"Limit":  limit,
		"Offset": offset,
	})

	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.GetPublicChannelsForTeam", "store.sql_channel.get_public_channels.get.app_error", nil, "teamId="+teamId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return channels, nil
}

func (s SqlChannelStore) GetPublicChannelsByIdsForTeam(teamId string, channelIds []string) (*model.ChannelList, *model.AppError) {
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
	_, err := s.GetReplica().Select(data, `
		SELECT
			Channels.*
		FROM
			Channels
		JOIN
			PublicChannels pc ON (pc.Id = Channels.Id)
		WHERE
			pc.TeamId = :teamId
		AND pc.DeleteAt = 0
		AND pc.Id IN (`+idQuery+`)
		ORDER BY pc.DisplayName
		`, props)

	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.GetPublicChannelsByIdsForTeam", "store.sql_channel.get_channels_by_ids.get.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if len(*data) == 0 {
		return nil, model.NewAppError("SqlChannelStore.GetPublicChannelsByIdsForTeam", "store.sql_channel.get_channels_by_ids.not_found.app_error", nil, "", http.StatusNotFound)
	}

	return data, nil
}

type channelIdWithCountAndUpdateAt struct {
	Id            string
	TotalMsgCount int64
	UpdateAt      int64
}

func (s SqlChannelStore) GetChannelCounts(teamId string, userId string) (*model.ChannelCounts, *model.AppError) {
	var data []channelIdWithCountAndUpdateAt
	_, err := s.GetReplica().Select(&data, "SELECT Id, TotalMsgCount, UpdateAt FROM Channels WHERE Id IN (SELECT ChannelId FROM ChannelMembers WHERE UserId = :UserId) AND (TeamId = :TeamId OR TeamId = '') AND DeleteAt = 0 ORDER BY DisplayName", map[string]interface{}{"TeamId": teamId, "UserId": userId})

	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.GetChannelCounts", "store.sql_channel.get_channel_counts.get.app_error", nil, "teamId="+teamId+", userId="+userId+", err="+err.Error(), http.StatusInternalServerError)
	}

	counts := &model.ChannelCounts{Counts: make(map[string]int64), UpdateTimes: make(map[string]int64)}
	for i := range data {
		v := data[i]
		counts.Counts[v.Id] = v.TotalMsgCount
		counts.UpdateTimes[v.Id] = v.UpdateAt
	}

	return counts, nil
}

func (s SqlChannelStore) GetTeamChannels(teamId string) (*model.ChannelList, *model.AppError) {
	data := &model.ChannelList{}
	_, err := s.GetReplica().Select(data, "SELECT * FROM Channels WHERE TeamId = :TeamId And Type != 'D' ORDER BY DisplayName", map[string]interface{}{"TeamId": teamId})

	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.GetTeamChannels", "store.sql_channel.get_channels.get.app_error", nil, "teamId="+teamId+",  err="+err.Error(), http.StatusInternalServerError)
	}

	if len(*data) == 0 {
		return nil, model.NewAppError("SqlChannelStore.GetTeamChannels", "store.sql_channel.get_channels.not_found.app_error", nil, "teamId="+teamId, http.StatusNotFound)
	}

	return data, nil
}

func (s SqlChannelStore) GetByName(teamId string, name string, allowFromCache bool) (*model.Channel, *model.AppError) {
	return s.getByName(teamId, name, false, allowFromCache)
}

func (s SqlChannelStore) GetByNames(teamId string, names []string, allowFromCache bool) ([]*model.Channel, *model.AppError) {
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
				channels = append(channels, cacheItem.(*model.Channel))
			} else {
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
			return nil, model.NewAppError("SqlChannelStore.GetByName", "store.sql_channel.get_by_name.existing.app_error", nil, "teamId="+teamId+", "+err.Error(), http.StatusInternalServerError)
		}
		for _, channel := range dbChannels {
			channelByNameCache.AddWithExpiresInSecs(teamId+channel.Name, channel, CHANNEL_CACHE_SEC)
			channels = append(channels, channel)
		}
		// Not all channels are in cache. Increment aggregate miss counter.
		if s.metrics != nil {
			s.metrics.IncrementMemCacheMissCounter("Channel By Name - Aggregate")
		}
	} else {
		// All of the channel names are in cache. Increment aggregate hit counter.
		if s.metrics != nil {
			s.metrics.IncrementMemCacheHitCounter("Channel By Name - Aggregate")
		}
	}

	return channels, nil
}

func (s SqlChannelStore) GetByNameIncludeDeleted(teamId string, name string, allowFromCache bool) (*model.Channel, *model.AppError) {
	return s.getByName(teamId, name, true, allowFromCache)
}

func (s SqlChannelStore) getByName(teamId string, name string, includeDeleted bool, allowFromCache bool) (*model.Channel, *model.AppError) {
	var query string
	if includeDeleted {
		query = "SELECT * FROM Channels WHERE (TeamId = :TeamId OR TeamId = '') AND Name = :Name"
	} else {
		query = "SELECT * FROM Channels WHERE (TeamId = :TeamId OR TeamId = '') AND Name = :Name AND DeleteAt = 0"
	}
	channel := model.Channel{}

	if allowFromCache {
		if cacheItem, ok := channelByNameCache.Get(teamId + name); ok {
			if s.metrics != nil {
				s.metrics.IncrementMemCacheHitCounter("Channel By Name")
			}
			return cacheItem.(*model.Channel), nil
		}
		if s.metrics != nil {
			s.metrics.IncrementMemCacheMissCounter("Channel By Name")
		}
	}

	if err := s.GetReplica().SelectOne(&channel, query, map[string]interface{}{"TeamId": teamId, "Name": name}); err != nil {
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlChannelStore.GetByName", store.MISSING_CHANNEL_ERROR, nil, "teamId="+teamId+", "+"name="+name+"", http.StatusNotFound)
		}
		return nil, model.NewAppError("SqlChannelStore.GetByName", "store.sql_channel.get_by_name.existing.app_error", nil, "teamId="+teamId+", "+"name="+name+", "+err.Error(), http.StatusInternalServerError)
	}

	channelByNameCache.AddWithExpiresInSecs(teamId+name, &channel, CHANNEL_CACHE_SEC)
	return &channel, nil
}

func (s SqlChannelStore) GetDeletedByName(teamId string, name string) (*model.Channel, *model.AppError) {
	channel := model.Channel{}

	if err := s.GetReplica().SelectOne(&channel, "SELECT * FROM Channels WHERE (TeamId = :TeamId OR TeamId = '') AND Name = :Name AND DeleteAt != 0", map[string]interface{}{"TeamId": teamId, "Name": name}); err != nil {
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlChannelStore.GetDeletedByName", "store.sql_channel.get_deleted_by_name.missing.app_error", nil, "teamId="+teamId+", "+"name="+name+", "+err.Error(), http.StatusNotFound)
		}
		return nil, model.NewAppError("SqlChannelStore.GetDeletedByName", "store.sql_channel.get_deleted_by_name.existing.app_error", nil, "teamId="+teamId+", "+"name="+name+", "+err.Error(), http.StatusInternalServerError)
	}

	return &channel, nil
}

func (s SqlChannelStore) GetDeleted(teamId string, offset int, limit int, userId string) (*model.ChannelList, *model.AppError) {
	channels := &model.ChannelList{}

	query := `
		SELECT * FROM Channels
		WHERE (TeamId = :TeamId OR TeamId = '')
		AND DeleteAt != 0
		AND Type != 'P'
		UNION
			SELECT * FROM Channels
			WHERE (TeamId = :TeamId OR TeamId = '')
			AND DeleteAt != 0
			AND Type = 'P'
			AND Id IN (SELECT ChannelId FROM ChannelMembers WHERE UserId = :UserId)
		ORDER BY DisplayName LIMIT :Limit OFFSET :Offset
	`

	if _, err := s.GetReplica().Select(channels, query, map[string]interface{}{"TeamId": teamId, "Limit": limit, "Offset": offset, "UserId": userId}); err != nil {
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlChannelStore.GetDeleted", "store.sql_channel.get_deleted.missing.app_error", nil, "teamId="+teamId+", "+err.Error(), http.StatusNotFound)
		}
		return nil, model.NewAppError("SqlChannelStore.GetDeleted", "store.sql_channel.get_deleted.existing.app_error", nil, "teamId="+teamId+", "+err.Error(), http.StatusInternalServerError)
	}

	return channels, nil
}

var CHANNEL_MEMBERS_WITH_SCHEME_SELECT_QUERY = `
	SELECT
		ChannelMembers.*,
		TeamScheme.DefaultChannelGuestRole TeamSchemeDefaultGuestRole,
		TeamScheme.DefaultChannelUserRole TeamSchemeDefaultUserRole,
		TeamScheme.DefaultChannelAdminRole TeamSchemeDefaultAdminRole,
		ChannelScheme.DefaultChannelGuestRole ChannelSchemeDefaultGuestRole,
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

func (s SqlChannelStore) SaveMember(member *model.ChannelMember) (*model.ChannelMember, *model.AppError) {
	defer s.InvalidateAllChannelMembersForUser(member.UserId)

	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.SaveMember", "store.sql_channel.save_member.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer finalizeTransaction(transaction)

	newMember, appErr := s.saveMemberT(transaction, member)
	if appErr != nil {
		return nil, appErr
	}

	if err := transaction.Commit(); err != nil {
		return nil, model.NewAppError("SqlChannelStore.SaveMember", "store.sql_channel.save_member.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return newMember, nil
}

func (s SqlChannelStore) saveMemberT(transaction *gorp.Transaction, member *model.ChannelMember) (*model.ChannelMember, *model.AppError) {
	member.PreSave()
	if err := member.IsValid(); err != nil {
		return nil, err
	}

	dbMember := NewChannelMemberFromModel(member)

	if err := transaction.Insert(dbMember); err != nil {
		if IsUniqueConstraintError(err, []string{"ChannelId", "channelmembers_pkey"}) {
			return nil, model.NewAppError("SqlChannelStore.SaveMember", "store.sql_channel.save_member.exists.app_error", nil, "channel_id="+member.ChannelId+", user_id="+member.UserId+", "+err.Error(), http.StatusBadRequest)
		}
		return nil, model.NewAppError("SqlChannelStore.SaveMember", "store.sql_channel.save_member.save.app_error", nil, "channel_id="+member.ChannelId+", user_id="+member.UserId+", "+err.Error(), http.StatusInternalServerError)
	}

	var retrievedMember channelMemberWithSchemeRoles
	if err := transaction.SelectOne(&retrievedMember, CHANNEL_MEMBERS_WITH_SCHEME_SELECT_QUERY+"WHERE ChannelMembers.ChannelId = :ChannelId AND ChannelMembers.UserId = :UserId", map[string]interface{}{"ChannelId": dbMember.ChannelId, "UserId": dbMember.UserId}); err != nil {
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlChannelStore.GetMember", store.MISSING_CHANNEL_MEMBER_ERROR, nil, "channel_id="+dbMember.ChannelId+"user_id="+dbMember.UserId+","+err.Error(), http.StatusNotFound)
		}
		return nil, model.NewAppError("SqlChannelStore.GetMember", "store.sql_channel.get_member.app_error", nil, "channel_id="+dbMember.ChannelId+"user_id="+dbMember.UserId+","+err.Error(), http.StatusInternalServerError)
	}

	return retrievedMember.ToModel(), nil
}

func (s SqlChannelStore) UpdateMember(member *model.ChannelMember) (*model.ChannelMember, *model.AppError) {
	member.PreUpdate()

	if err := member.IsValid(); err != nil {
		return nil, err
	}

	if _, err := s.GetMaster().Update(NewChannelMemberFromModel(member)); err != nil {
		return nil, model.NewAppError("SqlChannelStore.UpdateMember", "store.sql_channel.update_member.app_error", nil, "channel_id="+member.ChannelId+", "+"user_id="+member.UserId+", "+err.Error(), http.StatusInternalServerError)
	}

	var dbMember channelMemberWithSchemeRoles

	if err := s.GetReplica().SelectOne(&dbMember, CHANNEL_MEMBERS_WITH_SCHEME_SELECT_QUERY+"WHERE ChannelMembers.ChannelId = :ChannelId AND ChannelMembers.UserId = :UserId", map[string]interface{}{"ChannelId": member.ChannelId, "UserId": member.UserId}); err != nil {
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlChannelStore.GetMember", store.MISSING_CHANNEL_MEMBER_ERROR, nil, "channel_id="+member.ChannelId+"user_id="+member.UserId+","+err.Error(), http.StatusNotFound)
		}
		return nil, model.NewAppError("SqlChannelStore.GetMember", "store.sql_channel.get_member.app_error", nil, "channel_id="+member.ChannelId+"user_id="+member.UserId+","+err.Error(), http.StatusInternalServerError)
	}
	return dbMember.ToModel(), nil
}

func (s SqlChannelStore) GetMembers(channelId string, offset, limit int) (*model.ChannelMembers, *model.AppError) {
	var dbMembers channelMemberWithSchemeRolesList
	_, err := s.GetReplica().Select(&dbMembers, CHANNEL_MEMBERS_WITH_SCHEME_SELECT_QUERY+"WHERE ChannelId = :ChannelId LIMIT :Limit OFFSET :Offset", map[string]interface{}{"ChannelId": channelId, "Limit": limit, "Offset": offset})
	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.GetMembers", "store.sql_channel.get_members.app_error", nil, "channel_id="+channelId+","+err.Error(), http.StatusInternalServerError)
	}

	return dbMembers.ToModel(), nil
}

func (s SqlChannelStore) GetChannelMembersTimezones(channelId string) ([]model.StringMap, *model.AppError) {
	var dbMembersTimezone []model.StringMap
	_, err := s.GetReplica().Select(&dbMembersTimezone, `
		SELECT
			Users.Timezone
		FROM
			ChannelMembers
		LEFT JOIN
			Users  ON ChannelMembers.UserId = Id
		WHERE ChannelId = :ChannelId
	`, map[string]interface{}{"ChannelId": channelId})

	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.GetChannelMembersTimezones", "store.sql_channel.get_members.app_error", nil, "channel_id="+channelId+","+err.Error(), http.StatusInternalServerError)
	}

	return dbMembersTimezone, nil
}

func (s SqlChannelStore) GetMember(channelId string, userId string) (*model.ChannelMember, *model.AppError) {
	var dbMember channelMemberWithSchemeRoles

	if err := s.GetReplica().SelectOne(&dbMember, CHANNEL_MEMBERS_WITH_SCHEME_SELECT_QUERY+"WHERE ChannelMembers.ChannelId = :ChannelId AND ChannelMembers.UserId = :UserId", map[string]interface{}{"ChannelId": channelId, "UserId": userId}); err != nil {
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlChannelStore.GetMember", store.MISSING_CHANNEL_MEMBER_ERROR, nil, "channel_id="+channelId+"user_id="+userId+","+err.Error(), http.StatusNotFound)
		}
		return nil, model.NewAppError("SqlChannelStore.GetMember", "store.sql_channel.get_member.app_error", nil, "channel_id="+channelId+"user_id="+userId+","+err.Error(), http.StatusInternalServerError)
	}

	return dbMember.ToModel(), nil
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

	ids, err := s.GetAllChannelMembersForUser(userId, true, false)
	if err != nil {
		mlog.Error("Error getting all channel members for user", mlog.Err(err))
		return false
	}

	if _, ok := ids[channelId]; ok {
		return true
	}

	return false
}

func (s SqlChannelStore) GetMemberForPost(postId string, userId string) (*model.ChannelMember, *model.AppError) {
	var dbMember channelMemberWithSchemeRoles
	query := `
		SELECT
			ChannelMembers.*,
			TeamScheme.DefaultChannelGuestRole TeamSchemeDefaultGuestRole,
			TeamScheme.DefaultChannelUserRole TeamSchemeDefaultUserRole,
			TeamScheme.DefaultChannelAdminRole TeamSchemeDefaultAdminRole,
			ChannelScheme.DefaultChannelGuestRole ChannelSchemeDefaultGuestRole,
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
		AND
			Posts.Id = :PostId`
	if err := s.GetReplica().SelectOne(&dbMember, query, map[string]interface{}{"UserId": userId, "PostId": postId}); err != nil {
		return nil, model.NewAppError("SqlChannelStore.GetMemberForPost", "store.sql_channel.get_member_for_post.app_error", nil, "postId="+postId+", err="+err.Error(), http.StatusInternalServerError)
	}
	return dbMember.ToModel(), nil
}

func (s SqlChannelStore) GetAllChannelMembersForUser(userId string, allowFromCache bool, includeDeleted bool) (map[string]string, *model.AppError) {
	cache_key := userId
	if includeDeleted {
		cache_key += "_deleted"
	}
	if allowFromCache {
		if cacheItem, ok := allChannelMembersForUserCache.Get(cache_key); ok {
			if s.metrics != nil {
				s.metrics.IncrementMemCacheHitCounter("All Channel Members for User")
			}
			ids := cacheItem.(map[string]string)
			return ids, nil
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
				ChannelMembers.ChannelId, ChannelMembers.Roles,
				ChannelMembers.SchemeGuest, ChannelMembers.SchemeUser, ChannelMembers.SchemeAdmin,
				TeamScheme.DefaultChannelGuestRole TeamSchemeDefaultGuestRole,
				TeamScheme.DefaultChannelUserRole TeamSchemeDefaultUserRole,
				TeamScheme.DefaultChannelAdminRole TeamSchemeDefaultAdminRole,
				ChannelScheme.DefaultChannelGuestRole ChannelSchemeDefaultGuestRole,
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
		return nil, model.NewAppError("SqlChannelStore.GetAllChannelMembersForUser", "store.sql_channel.get_channels.get.app_error", nil, "userId="+userId+", err="+err.Error(), http.StatusInternalServerError)
	}

	ids := data.ToMapStringString()

	if allowFromCache {
		allChannelMembersForUserCache.AddWithExpiresInSecs(cache_key, ids, ALL_CHANNEL_MEMBERS_FOR_USER_CACHE_SEC)
	}
	return ids, nil
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

func (s SqlChannelStore) GetAllChannelMembersNotifyPropsForChannel(channelId string, allowFromCache bool) (map[string]model.StringMap, *model.AppError) {
	if allowFromCache {
		if cacheItem, ok := allChannelMembersNotifyPropsForChannelCache.Get(channelId); ok {
			if s.metrics != nil {
				s.metrics.IncrementMemCacheHitCounter("All Channel Members Notify Props for Channel")
			}
			return cacheItem.(map[string]model.StringMap), nil
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
		return nil, model.NewAppError("SqlChannelStore.GetAllChannelMembersPropsForChannel", "store.sql_channel.get_members.app_error", nil, "channelId="+channelId+", err="+err.Error(), http.StatusInternalServerError)
	}

	props := make(map[string]model.StringMap)
	for i := range data {
		props[data[i].UserId] = data[i].NotifyProps
	}

	allChannelMembersNotifyPropsForChannelCache.AddWithExpiresInSecs(channelId, props, ALL_CHANNEL_MEMBERS_NOTIFY_PROPS_FOR_CHANNEL_CACHE_SEC)

	return props, nil
}

func (s SqlChannelStore) InvalidateMemberCount(channelId string) {
}

func (s SqlChannelStore) GetMemberCountFromCache(channelId string) int64 {
	count, _ := s.GetMemberCount(channelId, true)
	return count
}

func (s SqlChannelStore) GetMemberCount(channelId string, allowFromCache bool) (int64, *model.AppError) {
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
		return 0, model.NewAppError("SqlChannelStore.GetMemberCount", "store.sql_channel.get_member_count.app_error", nil, "channel_id="+channelId+", "+err.Error(), http.StatusInternalServerError)
	}

	return count, nil
}

func (s SqlChannelStore) InvalidatePinnedPostCount(channelId string) {
}

func (s SqlChannelStore) GetPinnedPostCount(channelId string, allowFromCache bool) (int64, *model.AppError) {
	count, err := s.GetReplica().SelectInt(`
		SELECT count(*)
			FROM Posts
		WHERE
			IsPinned = true
			AND ChannelId = :ChannelId
			AND DeleteAt = 0`, map[string]interface{}{"ChannelId": channelId})

	if err != nil {
		return 0, model.NewAppError("SqlChannelStore.GetPinnedPostCount", "store.sql_channel.get_pinnedpost_count.app_error", nil, "channel_id="+channelId+", "+err.Error(), http.StatusInternalServerError)
	}

	return count, nil
}

func (s SqlChannelStore) InvalidateGuestCount(channelId string) {
}

func (s SqlChannelStore) GetGuestCount(channelId string, allowFromCache bool) (int64, *model.AppError) {
	count, err := s.GetReplica().SelectInt(`
		SELECT
			count(*)
		FROM
			ChannelMembers,
			Users
		WHERE
			ChannelMembers.UserId = Users.Id
			AND ChannelMembers.ChannelId = :ChannelId
			AND ChannelMembers.SchemeGuest = TRUE
			AND Users.DeleteAt = 0`, map[string]interface{}{"ChannelId": channelId})
	if err != nil {
		return 0, model.NewAppError("SqlChannelStore.GetGuestCount", "store.sql_channel.get_member_count.app_error", nil, "channel_id="+channelId+", "+err.Error(), http.StatusInternalServerError)
	}
	return count, nil
}

func (s SqlChannelStore) RemoveMember(channelId string, userId string) *model.AppError {
	_, err := s.GetMaster().Exec("DELETE FROM ChannelMembers WHERE ChannelId = :ChannelId AND UserId = :UserId", map[string]interface{}{"ChannelId": channelId, "UserId": userId})
	if err != nil {
		return model.NewAppError("SqlChannelStore.RemoveMember", "store.sql_channel.remove_member.app_error", nil, "channel_id="+channelId+", user_id="+userId+", "+err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (s SqlChannelStore) RemoveAllDeactivatedMembers(channelId string) *model.AppError {
	query := `
		DELETE
		FROM
			ChannelMembers
		WHERE
			UserId IN (
				SELECT
					Id
				FROM
					Users
				WHERE
					Users.DeleteAt != 0
			)
		AND
			ChannelMembers.ChannelId = :ChannelId
	`

	_, err := s.GetMaster().Exec(query, map[string]interface{}{"ChannelId": channelId})
	if err != nil {
		return model.NewAppError("SqlChannelStore.RemoveAllDeactivatedMembers", "store.sql_channel.remove_all_deactivated_members.app_error", nil, "channel_id="+channelId+", "+err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (s SqlChannelStore) PermanentDeleteMembersByUser(userId string) *model.AppError {
	if _, err := s.GetMaster().Exec("DELETE FROM ChannelMembers WHERE UserId = :UserId", map[string]interface{}{"UserId": userId}); err != nil {
		return model.NewAppError("SqlChannelStore.ChannelPermanentDeleteMembersByUser", "store.sql_channel.permanent_delete_members_by_user.app_error", nil, "user_id="+userId+", "+err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (s SqlChannelStore) UpdateLastViewedAt(channelIds []string, userId string) (map[string]int64, *model.AppError) {
	keys, props := MapStringsToQueryParams(channelIds, "Channel")
	props["UserId"] = userId

	var lastPostAtTimes []struct {
		Id            string
		LastPostAt    int64
		TotalMsgCount int64
	}

	query := `SELECT Id, LastPostAt, TotalMsgCount FROM Channels WHERE Id IN ` + keys
	// TODO: use a CTE for mysql too when version 8 becomes the minimum supported version.
	if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		query = `WITH c AS ( ` + query + `),
	updated AS (
	UPDATE
		ChannelMembers cm
	SET
		MentionCount = 0,
		MsgCount = greatest(cm.MsgCount, c.TotalMsgCount),
		LastViewedAt = greatest(cm.LastViewedAt, c.LastPostAt),
		LastUpdateAt = greatest(cm.LastViewedAt, c.LastPostAt)
	FROM c
		WHERE cm.UserId = :UserId
		AND c.Id=cm.ChannelId
)
	SELECT Id, LastPostAt FROM c`
	}

	_, err := s.GetMaster().Select(&lastPostAtTimes, query, props)
	if err != nil || len(lastPostAtTimes) == 0 {
		status := http.StatusInternalServerError
		var extra string
		if err == nil {
			status = http.StatusBadRequest
			extra = "No channels found"
		} else {
			extra = err.Error()
		}

		return nil, model.NewAppError("SqlChannelStore.UpdateLastViewedAt",
			"store.sql_channel.update_last_viewed_at.app_error",
			nil,
			"channel_ids="+strings.Join(channelIds, ",")+", user_id="+userId+", "+extra,
			status)
	}

	times := map[string]int64{}
	if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		for _, t := range lastPostAtTimes {
			times[t.Id] = t.LastPostAt
		}
		return times, nil
	}

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

	updateQuery := `UPDATE
			ChannelMembers
		SET
			MentionCount = 0,
			MsgCount = CASE ChannelId ` + msgCountQuery + ` END,
			LastViewedAt = CASE ChannelId ` + lastViewedQuery + ` END,
			LastUpdateAt = LastViewedAt
		WHERE
				UserId = :UserId
				AND ChannelId IN ` + keys

	if _, err := s.GetMaster().Exec(updateQuery, props); err != nil {
		return nil, model.NewAppError("SqlChannelStore.UpdateLastViewedAt", "store.sql_channel.update_last_viewed_at.app_error", nil, "channel_ids="+strings.Join(channelIds, ",")+", user_id="+userId+", "+err.Error(), http.StatusInternalServerError)
	}

	return times, nil
}

// CountPostsAfter returns the number of posts in the given channel created after but not including the given timestamp. If given a non-empty user ID, only counts posts made by that user.
func (s SqlChannelStore) CountPostsAfter(channelId string, timestamp int64, userId string) (int, *model.AppError) {
	joinLeavePostTypes, params := MapStringsToQueryParams([]string{
		// These types correspond to the ones checked by Post.IsJoinLeaveMessage
		model.POST_JOIN_LEAVE,
		model.POST_ADD_REMOVE,
		model.POST_JOIN_CHANNEL,
		model.POST_LEAVE_CHANNEL,
		model.POST_JOIN_TEAM,
		model.POST_LEAVE_TEAM,
		model.POST_ADD_TO_CHANNEL,
		model.POST_REMOVE_FROM_CHANNEL,
		model.POST_ADD_TO_TEAM,
		model.POST_REMOVE_FROM_TEAM,
	}, "PostType")

	query := `
	SELECT count(*)
	FROM Posts
	WHERE
		ChannelId = :ChannelId
		AND CreateAt > :CreateAt
		AND Type NOT IN ` + joinLeavePostTypes + `
		AND DeleteAt = 0
	`

	params["ChannelId"] = channelId
	params["CreateAt"] = timestamp

	if userId != "" {
		query += " AND UserId = :UserId"
		params["UserId"] = userId
	}

	unread, err := s.GetReplica().SelectInt(query, params)
	if err != nil {
		return 0, model.NewAppError("SqlChannelStore.CountPostsAfter", "store.sql_channel.count_posts_since.app_error", nil, fmt.Sprintf("channel_id=%s, timestamp=%d, err=%s", channelId, timestamp, err), http.StatusInternalServerError)
	}
	return int(unread), nil
}

// UpdateLastViewedAtPost updates a ChannelMember as if the user last read the channel at the time of the given post.
// If the provided mentionCount is -1, the given post and all posts after it are considered to be mentions. Returns
// an updated model.ChannelUnreadAt that can be returned to the client.
func (s SqlChannelStore) UpdateLastViewedAtPost(unreadPost *model.Post, userID string, mentionCount int) (*model.ChannelUnreadAt, *model.AppError) {
	unreadDate := unreadPost.CreateAt - 1

	unread, appErr := s.CountPostsAfter(unreadPost.ChannelId, unreadDate, "")
	if appErr != nil {
		return nil, appErr
	}

	params := map[string]interface{}{
		"mentions":     mentionCount,
		"unreadCount":  unread,
		"lastViewedAt": unreadDate,
		"userId":       userID,
		"channelId":    unreadPost.ChannelId,
		"updatedAt":    model.GetMillis(),
	}

	// msg count uses the value from channels to prevent counting on older channels where no. of messages can be high.
	// we only count the unread which will be a lot less in 99% cases
	setUnreadQuery := `
	UPDATE
		ChannelMembers
	SET
		MentionCount = :mentions,
		MsgCount = (SELECT TotalMsgCount FROM Channels WHERE ID = :channelId) - :unreadCount,
		LastViewedAt = :lastViewedAt,
		LastUpdateAt = :updatedAt
	WHERE
		UserId = :userId
		AND ChannelId = :channelId
	`
	_, err := s.GetMaster().Exec(setUnreadQuery, params)
	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.UpdateLastViewedAtPost", "store.sql_channel.update_last_viewed_at_post.app_error", params, "Error setting channel "+unreadPost.ChannelId+" as unread: "+err.Error(), http.StatusInternalServerError)
	}

	chanUnreadQuery := `
	SELECT
		c.TeamId TeamId,
		cm.UserId UserId,
		cm.ChannelId ChannelId,
		cm.MsgCount MsgCount,
		cm.MentionCount MentionCount,
		cm.LastViewedAt LastViewedAt,
		cm.NotifyProps NotifyProps
	FROM
		ChannelMembers cm
	LEFT JOIN Channels c ON c.Id=cm.ChannelId
	WHERE
		cm.UserId = :userId
		AND cm.channelId = :channelId
		AND c.DeleteAt = 0
	`
	result := &model.ChannelUnreadAt{}
	if err = s.GetMaster().SelectOne(result, chanUnreadQuery, params); err != nil {
		return nil, model.NewAppError("SqlChannelStore.UpdateLastViewedAtPost", "store.sql_channel.update_last_viewed_at_post.app_error", params, "Error retrieving unread status from channel "+unreadPost.ChannelId+", error was: "+err.Error(), http.StatusInternalServerError)
	}
	return result, nil
}

func (s SqlChannelStore) IncrementMentionCount(channelId string, userId string) *model.AppError {
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
		return model.NewAppError("SqlChannelStore.IncrementMentionCount", "store.sql_channel.increment_mention_count.app_error", nil, "channel_id="+channelId+", user_id="+userId+", "+err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (s SqlChannelStore) GetAll(teamId string) ([]*model.Channel, *model.AppError) {
	var data []*model.Channel
	_, err := s.GetReplica().Select(&data, "SELECT * FROM Channels WHERE TeamId = :TeamId AND Type != 'D' ORDER BY Name", map[string]interface{}{"TeamId": teamId})

	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.GetAll", "store.sql_channel.get_all.app_error", nil, "teamId="+teamId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return data, nil
}

func (s SqlChannelStore) GetChannelsByIds(channelIds []string) ([]*model.Channel, *model.AppError) {
	keys, params := MapStringsToQueryParams(channelIds, "Channel")
	query := `SELECT * FROM Channels WHERE Id IN ` + keys + ` ORDER BY Name`

	var channels []*model.Channel
	_, err := s.GetReplica().Select(&channels, query, params)

	if err != nil {
		mlog.Error("Query error getting channels by ids", mlog.Err(err))
		return nil, model.NewAppError("SqlChannelStore.GetChannelsByIds", "store.sql_channel.get_channels_by_ids.app_error", nil, "", http.StatusInternalServerError)
	}
	return channels, nil
}

func (s SqlChannelStore) GetForPost(postId string) (*model.Channel, *model.AppError) {
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
		return nil, model.NewAppError("SqlChannelStore.GetForPost", "store.sql_channel.get_for_post.app_error", nil, "postId="+postId+", err="+err.Error(), http.StatusInternalServerError)

	}
	return channel, nil
}

func (s SqlChannelStore) AnalyticsTypeCount(teamId string, channelType string) (int64, *model.AppError) {
	query := "SELECT COUNT(Id) AS Value FROM Channels WHERE Type = :ChannelType"

	if len(teamId) > 0 {
		query += " AND TeamId = :TeamId"
	}

	value, err := s.GetReplica().SelectInt(query, map[string]interface{}{"TeamId": teamId, "ChannelType": channelType})
	if err != nil {
		return int64(0), model.NewAppError("SqlChannelStore.AnalyticsTypeCount", "store.sql_channel.analytics_type_count.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return value, nil
}

func (s SqlChannelStore) AnalyticsDeletedTypeCount(teamId string, channelType string) (int64, *model.AppError) {
	query := "SELECT COUNT(Id) AS Value FROM Channels WHERE Type = :ChannelType AND DeleteAt > 0"

	if len(teamId) > 0 {
		query += " AND TeamId = :TeamId"
	}

	v, err := s.GetReplica().SelectInt(query, map[string]interface{}{"TeamId": teamId, "ChannelType": channelType})
	if err != nil {
		return 0, model.NewAppError("SqlChannelStore.AnalyticsDeletedTypeCount", "store.sql_channel.analytics_deleted_type_count.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return v, nil
}

func (s SqlChannelStore) GetMembersForUser(teamId string, userId string) (*model.ChannelMembers, *model.AppError) {
	var dbMembers channelMemberWithSchemeRolesList
	_, err := s.GetReplica().Select(&dbMembers, CHANNEL_MEMBERS_WITH_SCHEME_SELECT_QUERY+"WHERE ChannelMembers.UserId = :UserId AND (Teams.Id = :TeamId OR Teams.Id = '' OR Teams.Id IS NULL)", map[string]interface{}{"TeamId": teamId, "UserId": userId})
	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.GetMembersForUser", "store.sql_channel.get_members.app_error", nil, "teamId="+teamId+", userId="+userId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return dbMembers.ToModel(), nil
}

func (s SqlChannelStore) GetMembersForUserWithPagination(teamId, userId string, page, perPage int) (*model.ChannelMembers, *model.AppError) {
	var dbMembers channelMemberWithSchemeRolesList
	offset := page * perPage
	_, err := s.GetReplica().Select(&dbMembers, CHANNEL_MEMBERS_WITH_SCHEME_SELECT_QUERY+"WHERE ChannelMembers.UserId = :UserId Limit :Limit Offset :Offset", map[string]interface{}{"TeamId": teamId, "UserId": userId, "Limit": perPage, "Offset": offset})

	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.GetMembersForUserWithPagination", "store.sql_channel.get_members.app_error", nil, "teamId="+teamId+", userId="+userId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return dbMembers.ToModel(), nil
}

func (s SqlChannelStore) AutocompleteInTeam(teamId string, term string, includeDeleted bool) (*model.ChannelList, *model.AppError) {
	deleteFilter := "AND c.DeleteAt = 0"
	if includeDeleted {
		deleteFilter = ""
	}

	queryFormat := `
		SELECT
			Channels.*
		FROM
			Channels
		JOIN
			PublicChannels c ON (c.Id = Channels.Id)
		WHERE
			c.TeamId = :TeamId
			` + deleteFilter + `
			%v
		LIMIT ` + strconv.Itoa(model.CHANNEL_SEARCH_DEFAULT_LIMIT)

	var channels model.ChannelList

	if likeClause, likeTerm := s.buildLIKEClause(term, "c.Name, c.DisplayName, c.Purpose"); likeClause == "" {
		if _, err := s.GetReplica().Select(&channels, fmt.Sprintf(queryFormat, ""), map[string]interface{}{"TeamId": teamId}); err != nil {
			return nil, model.NewAppError("SqlChannelStore.AutocompleteInTeam", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
		}
	} else {
		// Using a UNION results in index_merge and fulltext queries and is much faster than the ref
		// query you would get using an OR of the LIKE and full-text clauses.
		fulltextClause, fulltextTerm := s.buildFulltextClause(term, "c.Name, c.DisplayName, c.Purpose")
		likeQuery := fmt.Sprintf(queryFormat, "AND "+likeClause)
		fulltextQuery := fmt.Sprintf(queryFormat, "AND "+fulltextClause)
		query := fmt.Sprintf("(%v) UNION (%v) LIMIT 50", likeQuery, fulltextQuery)

		if _, err := s.GetReplica().Select(&channels, query, map[string]interface{}{"TeamId": teamId, "LikeTerm": likeTerm, "FulltextTerm": fulltextTerm}); err != nil {
			return nil, model.NewAppError("SqlChannelStore.AutocompleteInTeam", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
		}
	}

	sort.Slice(channels, func(a, b int) bool {
		return strings.ToLower(channels[a].DisplayName) < strings.ToLower(channels[b].DisplayName)
	})
	return &channels, nil
}

func (s SqlChannelStore) AutocompleteInTeamForSearch(teamId string, userId string, term string, includeDeleted bool) (*model.ChannelList, *model.AppError) {
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
			return nil, model.NewAppError("SqlChannelStore.AutocompleteInTeamForSearch", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
		}
	} else {
		// Using a UNION results in index_merge and fulltext queries and is much faster than the ref
		// query you would get using an OR of the LIKE and full-text clauses.
		fulltextClause, fulltextTerm := s.buildFulltextClause(term, "Name, DisplayName, Purpose")
		likeQuery := fmt.Sprintf(queryFormat, "AND "+likeClause)
		fulltextQuery := fmt.Sprintf(queryFormat, "AND "+fulltextClause)
		query := fmt.Sprintf("(%v) UNION (%v) LIMIT 50", likeQuery, fulltextQuery)

		if _, err := s.GetReplica().Select(&channels, query, map[string]interface{}{"TeamId": teamId, "UserId": userId, "LikeTerm": likeTerm, "FulltextTerm": fulltextTerm}); err != nil {
			return nil, model.NewAppError("SqlChannelStore.AutocompleteInTeamForSearch", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
		}
	}

	directChannels, err := s.autocompleteInTeamForSearchDirectMessages(userId, term)
	if err != nil {
		return nil, err
	}

	channels = append(channels, directChannels...)

	sort.Slice(channels, func(a, b int) bool {
		return strings.ToLower(channels[a].DisplayName) < strings.ToLower(channels[b].DisplayName)
	})
	return &channels, nil
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

func (s SqlChannelStore) SearchInTeam(teamId string, term string, includeDeleted bool) (*model.ChannelList, *model.AppError) {
	deleteFilter := "AND c.DeleteAt = 0"
	if includeDeleted {
		deleteFilter = ""
	}

	return s.performSearch(`
		SELECT
			Channels.*
		FROM
			Channels
		JOIN
			PublicChannels c ON (c.Id = Channels.Id)
		WHERE
			c.TeamId = :TeamId
			`+deleteFilter+`
			SEARCH_CLAUSE
		ORDER BY c.DisplayName
		LIMIT 100
		`, term, map[string]interface{}{
		"TeamId": teamId,
	})
}

func (s SqlChannelStore) SearchArchivedInTeam(teamId string, term string, userId string) (*model.ChannelList, *model.AppError) {
	publicChannels, publicErr := s.performSearch(`
		SELECT
			Channels.*
		FROM
			Channels
		JOIN
			Channels c ON (c.Id = Channels.Id)
		WHERE
			c.TeamId = :TeamId
			SEARCH_CLAUSE
			AND c.DeleteAt != 0
			AND c.Type != 'P'
		ORDER BY c.DisplayName
		LIMIT 100
		`, term, map[string]interface{}{
		"TeamId": teamId,
		"UserId": userId,
	})

	privateChannels, privateErr := s.performSearch(`
		SELECT
			Channels.*
		FROM
			Channels
		JOIN
			Channels c ON (c.Id = Channels.Id)
		WHERE
			c.TeamId = :TeamId
			SEARCH_CLAUSE
			AND c.DeleteAt != 0
			AND c.Type = 'P'
			AND c.Id IN (SELECT ChannelId FROM ChannelMembers WHERE UserId = :UserId)
		ORDER BY c.DisplayName
		LIMIT 100
		`, term, map[string]interface{}{
		"TeamId": teamId,
		"UserId": userId,
	})

	output := *publicChannels
	output = append(output, *privateChannels...)

	outputErr := publicErr
	if privateErr != nil {
		outputErr = privateErr
	}

	return &output, outputErr
}

func (s SqlChannelStore) SearchForUserInTeam(userId string, teamId string, term string, includeDeleted bool) (*model.ChannelList, *model.AppError) {
	deleteFilter := "AND c.DeleteAt = 0"
	if includeDeleted {
		deleteFilter = ""
	}

	return s.performSearch(`
		SELECT
			Channels.*
		FROM
			Channels
		JOIN
			PublicChannels c ON (c.Id = Channels.Id)
        JOIN
            ChannelMembers cm ON (c.Id = cm.ChannelId)
		WHERE
			c.TeamId = :TeamId
        AND
            cm.UserId = :UserId
			`+deleteFilter+`
			SEARCH_CLAUSE
		ORDER BY c.DisplayName
		LIMIT 100
		`, term, map[string]interface{}{
		"TeamId": teamId,
		"UserId": userId,
	})
}

func (s SqlChannelStore) channelSearchQuery(term string, opts store.ChannelSearchOpts, countQuery bool) sq.SelectBuilder {
	var limit int
	if opts.PerPage != nil {
		limit = *opts.PerPage
	} else {
		limit = 100
	}

	var selectStr string
	if countQuery {
		selectStr = "count(*)"
	} else {
		selectStr = "c.*, t.DisplayName AS TeamDisplayName, t.Name AS TeamName, t.UpdateAt as TeamUpdateAt"
	}

	query := s.getQueryBuilder().
		Select(selectStr).
		From("Channels AS c").
		Join("Teams AS t ON t.Id = c.TeamId").
		Where(sq.Eq{"c.Type": []string{model.CHANNEL_PRIVATE, model.CHANNEL_OPEN}})

	// don't bother ordering or limiting if we're just getting the count
	if !countQuery {
		query = query.
			OrderBy("c.DisplayName, t.DisplayName").
			Limit(uint64(limit))
	}

	if !opts.IncludeDeleted {
		query = query.Where(sq.Eq{"c.DeleteAt": int(0)})
	}

	if opts.IsPaginated() && !countQuery {
		query = query.Offset(uint64(*opts.Page * *opts.PerPage))
	}

	likeClause, likeTerm := s.buildLIKEClause(term, "c.Name, c.DisplayName, c.Purpose")
	if likeTerm != "" {
		likeClause = strings.ReplaceAll(likeClause, ":LikeTerm", "?")
		fulltextClause, fulltextTerm := s.buildFulltextClause(term, "c.Name, c.DisplayName, c.Purpose")
		fulltextClause = strings.ReplaceAll(fulltextClause, ":FulltextTerm", "?")
		query = query.Where(sq.Or{
			sq.Expr(likeClause, likeTerm, likeTerm, likeTerm), // Keep the number of likeTerms same as the number
			// of columns (c.Name, c.DisplayName, c.Purpose)
			sq.Expr(fulltextClause, fulltextTerm),
		})
	}

	if len(opts.ExcludeChannelNames) > 0 {
		query = query.Where(sq.NotEq{"c.Name": opts.ExcludeChannelNames})
	}

	if len(opts.NotAssociatedToGroup) > 0 {
		query = query.Where("c.Id NOT IN (SELECT ChannelId FROM GroupChannels WHERE GroupChannels.GroupId = ? AND GroupChannels.DeleteAt = 0)", opts.NotAssociatedToGroup)
	}

	return query
}

func (s SqlChannelStore) SearchAllChannels(term string, opts store.ChannelSearchOpts) (*model.ChannelListWithTeamData, int64, *model.AppError) {
	queryString, args, err := s.channelSearchQuery(term, opts, false).ToSql()
	if err != nil {
		return nil, 0, model.NewAppError("SqlChannelStore.SearchAllChannels", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	var channels model.ChannelListWithTeamData
	if _, err = s.GetReplica().Select(&channels, queryString, args...); err != nil {
		return nil, 0, model.NewAppError("SqlChannelStore.Search", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
	}

	var totalCount int64

	// only query a 2nd time for the count if the results are being requested paginated.
	if opts.IsPaginated() {
		queryString, args, err = s.channelSearchQuery(term, opts, true).ToSql()
		if err != nil {
			return nil, 0, model.NewAppError("SqlChannelStore.SearchAllChannels", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		if totalCount, err = s.GetReplica().SelectInt(queryString, args...); err != nil {
			return nil, 0, model.NewAppError("SqlChannelStore.Search", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
		}
	} else {
		totalCount = int64(len(channels))
	}

	return &channels, totalCount, nil
}

func (s SqlChannelStore) SearchMore(userId string, teamId string, term string) (*model.ChannelList, *model.AppError) {
	return s.performSearch(`
		SELECT
			Channels.*
		FROM
			Channels
		JOIN
			PublicChannels c ON (c.Id = Channels.Id)
		WHERE
			c.TeamId = :TeamId
		AND c.DeleteAt = 0
		AND c.Id NOT IN (
			SELECT
				c.Id
			FROM
				PublicChannels c
			JOIN
				ChannelMembers cm ON (cm.ChannelId = c.Id)
			WHERE
				c.TeamId = :TeamId
			AND cm.UserId = :UserId
			AND c.DeleteAt = 0
			)
		SEARCH_CLAUSE
		ORDER BY c.DisplayName
		LIMIT 100
		`, term, map[string]interface{}{
		"TeamId": teamId,
		"UserId": userId,
	})
}

func (s SqlChannelStore) buildLIKEClause(term string, searchColumns string) (likeClause, likeTerm string) {
	likeTerm = sanitizeSearchTerm(term, "*")

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

		fulltextClause = fmt.Sprintf("((to_tsvector('english', %s)) @@ to_tsquery('english', :FulltextTerm))", convertMySQLFullTextColumnsToPostgres(searchColumns))
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

func (s SqlChannelStore) performSearch(searchQuery string, term string, parameters map[string]interface{}) (*model.ChannelList, *model.AppError) {
	likeClause, likeTerm := s.buildLIKEClause(term, "c.Name, c.DisplayName, c.Purpose")
	if likeTerm == "" {
		// If the likeTerm is empty after preparing, then don't bother searching.
		searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", "", 1)
	} else {
		parameters["LikeTerm"] = likeTerm
		fulltextClause, fulltextTerm := s.buildFulltextClause(term, "c.Name, c.DisplayName, c.Purpose")
		parameters["FulltextTerm"] = fulltextTerm
		searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", "AND ("+likeClause+" OR "+fulltextClause+")", 1)
	}

	var channels model.ChannelList

	if _, err := s.GetReplica().Select(&channels, searchQuery, parameters); err != nil {
		return nil, model.NewAppError("SqlChannelStore.Search", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
	}

	return &channels, nil
}

func (s SqlChannelStore) getSearchGroupChannelsQuery(userId, term string, isPostgreSQL bool) (string, map[string]interface{}) {
	var query, baseLikeClause string
	if isPostgreSQL {
		baseLikeClause = "ARRAY_TO_STRING(ARRAY_AGG(u.Username), ', ') LIKE %s"
		query = `
            SELECT
                *
            FROM
                Channels
            WHERE
                Id IN (
                    SELECT
                        cc.Id
                    FROM (
                        SELECT
                            c.Id
                        FROM
                            Channels c
                        JOIN
                            ChannelMembers cm on c.Id = cm.ChannelId
                        JOIN
                            Users u on u.Id = cm.UserId
                        WHERE
                            c.Type = 'G'
                        AND
                            u.Id = :UserId
                        GROUP BY
                            c.Id
                    ) cc
                    JOIN
                        ChannelMembers cm on cc.Id = cm.ChannelId
                    JOIN
                        Users u on u.Id = cm.UserId
                    GROUP BY
                        cc.Id
                    HAVING
                        %s
                    LIMIT
                        ` + strconv.Itoa(model.CHANNEL_SEARCH_DEFAULT_LIMIT) + `
                )`
	} else {
		baseLikeClause = "GROUP_CONCAT(u.Username SEPARATOR ', ') LIKE %s"
		query = `
            SELECT
                cc.*
            FROM (
                SELECT
                    c.*
                FROM
                    Channels c
                JOIN
                    ChannelMembers cm on c.Id = cm.ChannelId
                JOIN
                    Users u on u.Id = cm.UserId
                WHERE
                    c.Type = 'G'
                AND
                    u.Id = :UserId
                GROUP BY
                    c.Id
            ) cc
            JOIN
                ChannelMembers cm on cc.Id = cm.ChannelId
            JOIN
                Users u on u.Id = cm.UserId
            GROUP BY
                cc.Id
            HAVING
                %s
            LIMIT
                ` + strconv.Itoa(model.CHANNEL_SEARCH_DEFAULT_LIMIT)
	}

	var likeClauses []string
	args := map[string]interface{}{"UserId": userId}
	terms := strings.Split(strings.ToLower(strings.Trim(term, " ")), " ")

	for idx, term := range terms {
		argName := fmt.Sprintf("Term%v", idx)
		term = sanitizeSearchTerm(term, "\\")
		likeClauses = append(likeClauses, fmt.Sprintf(baseLikeClause, ":"+argName))
		args[argName] = "%" + term + "%"
	}

	query = fmt.Sprintf(query, strings.Join(likeClauses, " AND "))
	return query, args
}

func (s SqlChannelStore) SearchGroupChannels(userId, term string) (*model.ChannelList, *model.AppError) {
	isPostgreSQL := s.DriverName() == model.DATABASE_DRIVER_POSTGRES
	queryString, args := s.getSearchGroupChannelsQuery(userId, term, isPostgreSQL)

	var groupChannels model.ChannelList
	if _, err := s.GetReplica().Select(&groupChannels, queryString, args); err != nil {
		return nil, model.NewAppError("SqlChannelStore.SearchGroupChannels", "store.sql_channel.search_group_channels.app_error", nil, "userId="+userId+", term="+term+", err="+err.Error(), http.StatusInternalServerError)
	}
	return &groupChannels, nil
}

func (s SqlChannelStore) GetMembersByIds(channelId string, userIds []string) (*model.ChannelMembers, *model.AppError) {
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
		return nil, model.NewAppError("SqlChannelStore.GetMembersByIds", "store.sql_channel.get_members_by_ids.app_error", nil, "channelId="+channelId+" "+err.Error(), http.StatusInternalServerError)
	}

	return dbMembers.ToModel(), nil
}

func (s SqlChannelStore) GetChannelsByScheme(schemeId string, offset int, limit int) (model.ChannelList, *model.AppError) {
	var channels model.ChannelList
	_, err := s.GetReplica().Select(&channels, "SELECT * FROM Channels WHERE SchemeId = :SchemeId ORDER BY DisplayName LIMIT :Limit OFFSET :Offset", map[string]interface{}{"SchemeId": schemeId, "Offset": offset, "Limit": limit})
	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.GetChannelsByScheme", "store.sql_channel.get_by_scheme.app_error", nil, "schemeId="+schemeId+" "+err.Error(), http.StatusInternalServerError)
	}
	return channels, nil
}

// This function does the Advanced Permissions Phase 2 migration for ChannelMember objects. It performs the migration
// in batches as a single transaction per batch to ensure consistency but to also minimise execution time to avoid
// causing unnecessary table locks. **THIS FUNCTION SHOULD NOT BE USED FOR ANY OTHER PURPOSE.** Executing this function
// *after* the new Schemes functionality has been used on an installation will have unintended consequences.
func (s SqlChannelStore) MigrateChannelMembers(fromChannelId string, fromUserId string) (map[string]string, *model.AppError) {
	var transaction *gorp.Transaction
	var err error

	if transaction, err = s.GetMaster().Begin(); err != nil {
		return nil, model.NewAppError("SqlChannelStore.MigrateChannelMembers", "store.sql_channel.migrate_channel_members.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer finalizeTransaction(transaction)

	var channelMembers []channelMember
	if _, err := transaction.Select(&channelMembers, "SELECT * from ChannelMembers WHERE (ChannelId, UserId) > (:FromChannelId, :FromUserId) ORDER BY ChannelId, UserId LIMIT 100", map[string]interface{}{"FromChannelId": fromChannelId, "FromUserId": fromUserId}); err != nil {
		return nil, model.NewAppError("SqlChannelStore.MigrateChannelMembers", "store.sql_channel.migrate_channel_members.select.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if len(channelMembers) == 0 {
		// No more channel members in query result means that the migration has finished.
		return nil, nil
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
		if !member.SchemeGuest.Valid {
			member.SchemeGuest = sql.NullBool{Bool: false, Valid: true}
		}
		for _, role := range roles {
			if role == model.CHANNEL_ADMIN_ROLE_ID {
				member.SchemeAdmin = sql.NullBool{Bool: true, Valid: true}
			} else if role == model.CHANNEL_USER_ROLE_ID {
				member.SchemeUser = sql.NullBool{Bool: true, Valid: true}
			} else if role == model.CHANNEL_GUEST_ROLE_ID {
				member.SchemeGuest = sql.NullBool{Bool: true, Valid: true}
			} else {
				newRoles = append(newRoles, role)
			}
		}
		member.Roles = strings.Join(newRoles, " ")

		if _, err := transaction.Update(&member); err != nil {
			return nil, model.NewAppError("SqlChannelStore.MigrateChannelMembers", "store.sql_channel.migrate_channel_members.update.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

	}

	if err := transaction.Commit(); err != nil {
		return nil, model.NewAppError("SqlChannelStore.MigrateChannelMembers", "store.sql_channel.migrate_channel_members.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	data := make(map[string]string)
	data["ChannelId"] = channelMembers[len(channelMembers)-1].ChannelId
	data["UserId"] = channelMembers[len(channelMembers)-1].UserId
	return data, nil
}

func (s SqlChannelStore) ResetAllChannelSchemes() *model.AppError {
	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return model.NewAppError("SqlChannelStore.ResetAllChannelSchemes", "store.sql_channel.reset_all_channel_schemes.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer finalizeTransaction(transaction)

	resetErr := s.resetAllChannelSchemesT(transaction)
	if resetErr != nil {
		return resetErr
	}

	if err := transaction.Commit(); err != nil {
		return model.NewAppError("SqlChannelStore.ResetAllChannelSchemes", "store.sql_channel.reset_all_channel_schemes.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (s SqlChannelStore) resetAllChannelSchemesT(transaction *gorp.Transaction) *model.AppError {
	if _, err := transaction.Exec("UPDATE Channels SET SchemeId=''"); err != nil {
		return model.NewAppError("SqlChannelStore.ResetAllChannelSchemes", "store.sql_channel.reset_all_channel_schemes.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (s SqlChannelStore) ClearAllCustomRoleAssignments() *model.AppError {
	builtInRoles := model.MakeDefaultRoles()
	lastUserId := strings.Repeat("0", 26)
	lastChannelId := strings.Repeat("0", 26)

	for {
		var transaction *gorp.Transaction
		var err error

		if transaction, err = s.GetMaster().Begin(); err != nil {
			return model.NewAppError("SqlChannelStore.ClearAllCustomRoleAssignments", "store.sql_channel.clear_all_custom_role_assignments.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		var channelMembers []*channelMember
		if _, err := transaction.Select(&channelMembers, "SELECT * from ChannelMembers WHERE (ChannelId, UserId) > (:ChannelId, :UserId) ORDER BY ChannelId, UserId LIMIT 1000", map[string]interface{}{"ChannelId": lastChannelId, "UserId": lastUserId}); err != nil {
			finalizeTransaction(transaction)
			return model.NewAppError("SqlChannelStore.ClearAllCustomRoleAssignments", "store.sql_channel.clear_all_custom_role_assignments.select.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		if len(channelMembers) == 0 {
			finalizeTransaction(transaction)
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
					finalizeTransaction(transaction)
					return model.NewAppError("SqlChannelStore.ClearAllCustomRoleAssignments", "store.sql_channel.clear_all_custom_role_assignments.update.app_error", nil, err.Error(), http.StatusInternalServerError)
				}
			}
		}

		if err := transaction.Commit(); err != nil {
			finalizeTransaction(transaction)
			return model.NewAppError("SqlChannelStore.ClearAllCustomRoleAssignments", "store.sql_channel.clear_all_custom_role_assignments.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return nil
}

func (s SqlChannelStore) GetAllChannelsForExportAfter(limit int, afterId string) ([]*model.ChannelForExport, *model.AppError) {
	var channels []*model.ChannelForExport
	if _, err := s.GetReplica().Select(&channels, `
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
		return nil, model.NewAppError("SqlChannelStore.GetAllChannelsForExportAfter", "store.sql_channel.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return channels, nil
}

func (s SqlChannelStore) GetChannelMembersForExport(userId string, teamId string) ([]*model.ChannelMemberForExport, *model.AppError) {
	var members []*model.ChannelMemberForExport
	_, err := s.GetReplica().Select(&members, `
		SELECT
			ChannelMembers.ChannelId,
			ChannelMembers.UserId,
			ChannelMembers.Roles,
			ChannelMembers.LastViewedAt,
			ChannelMembers.MsgCount,
			ChannelMembers.MentionCount,
			ChannelMembers.NotifyProps,
			ChannelMembers.LastUpdateAt,
			ChannelMembers.SchemeUser,
			ChannelMembers.SchemeAdmin,
			(ChannelMembers.SchemeGuest IS NOT NULL AND ChannelMembers.SchemeGuest) as SchemeGuest,
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
		return nil, model.NewAppError("SqlChannelStore.GetChannelMembersForExport", "store.sql_channel.get_members.app_error", nil, "teamId="+teamId+", userId="+userId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return members, nil
}

func (s SqlChannelStore) GetAllDirectChannelsForExportAfter(limit int, afterId string) ([]*model.DirectChannelForExport, *model.AppError) {
	var directChannelsForExport []*model.DirectChannelForExport
	query := s.getQueryBuilder().
		Select("Channels.*").
		From("Channels").
		Where(sq.And{
			sq.Gt{"Channels.Id": afterId},
			sq.Eq{"Channels.DeleteAt": int(0)},
			sq.Eq{"Channels.Type": []string{"D", "G"}},
		}).
		OrderBy("Channels.Id").
		Limit(uint64(limit))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.GetAllDirectChannelsForExportAfter", "store.sql_channel.get_all_direct.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if _, err = s.GetReplica().Select(&directChannelsForExport, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlChannelStore.GetAllDirectChannelsForExportAfter", "store.sql_channel.get_all_direct.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var channelIds []string
	for _, channel := range directChannelsForExport {
		channelIds = append(channelIds, channel.Id)
	}
	query = s.getQueryBuilder().
		Select("u.Username as Username, ChannelId, UserId, cm.Roles as Roles, LastViewedAt, MsgCount, MentionCount, cm.NotifyProps as NotifyProps, LastUpdateAt, SchemeUser, SchemeAdmin, (SchemeGuest IS NOT NULL AND SchemeGuest) as SchemeGuest").
		From("ChannelMembers cm").
		Join("Users u ON ( u.Id = cm.UserId )").
		Where(sq.And{
			sq.Eq{"cm.ChannelId": channelIds},
			sq.Eq{"u.DeleteAt": int(0)},
		})

	queryString, args, err = query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.GetAllDirectChannelsForExportAfter", "store.sql_channel.get_all_direct.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var channelMembers []*model.ChannelMemberForExport
	if _, err := s.GetReplica().Select(&channelMembers, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlChannelStore.GetAllDirectChannelsForExportAfter", "store.sql_channel.get_all_direct.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	// Populate each channel with its members
	dmChannelsMap := make(map[string]*model.DirectChannelForExport)
	for _, channel := range directChannelsForExport {
		channel.Members = &[]string{}
		dmChannelsMap[channel.Id] = channel
	}
	for _, member := range channelMembers {
		members := dmChannelsMap[member.ChannelId].Members
		*members = append(*members, member.Username)
	}

	return directChannelsForExport, nil
}

func (s SqlChannelStore) GetChannelsBatchForIndexing(startTime, endTime int64, limit int) ([]*model.Channel, *model.AppError) {
	query :=
		`SELECT
			 *
		 FROM
			 Channels
		 WHERE
			 Type = 'O'
		 AND
			 CreateAt >= :StartTime
		 AND
			 CreateAt < :EndTime
		 ORDER BY
			 CreateAt
		 LIMIT
			 :NumChannels`

	var channels []*model.Channel
	_, err := s.GetSearchReplica().Select(&channels, query, map[string]interface{}{"StartTime": startTime, "EndTime": endTime, "NumChannels": limit})
	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.GetChannelsBatchForIndexing", "store.sql_channel.get_channels_batch_for_indexing.get.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return channels, nil
}

func (s SqlChannelStore) UserBelongsToChannels(userId string, channelIds []string) (bool, *model.AppError) {
	query := s.getQueryBuilder().
		Select("Count(*)").
		From("ChannelMembers").
		Where(sq.And{
			sq.Eq{"UserId": userId},
			sq.Eq{"ChannelId": channelIds},
		})

	queryString, args, err := query.ToSql()
	if err != nil {
		return false, model.NewAppError("SqlChannelStore.UserBelongsToChannels", "store.sql_channel.user_belongs_to_channels.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	c, err := s.GetReplica().SelectInt(queryString, args...)
	if err != nil {
		return false, model.NewAppError("SqlChannelStore.UserBelongsToChannels", "store.sql_channel.user_belongs_to_channels.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return c > 0, nil
}

func (s SqlChannelStore) UpdateMembersRole(channelID string, userIDs []string) *model.AppError {
	sql := fmt.Sprintf(`
		UPDATE
			ChannelMembers
		SET
			SchemeAdmin = CASE WHEN UserId IN ('%s') THEN
				TRUE
			ELSE
				FALSE
			END
		WHERE
			ChannelId = :ChannelId
			AND (SchemeGuest = false OR SchemeGuest IS NULL)
			`, strings.Join(userIDs, "', '"))

	if _, err := s.GetMaster().Exec(sql, map[string]interface{}{"ChannelId": channelID}); err != nil {
		return model.NewAppError("SqlChannelStore.UpdateMembersRole", "store.update_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (s SqlChannelStore) GroupSyncedChannelCount() (int64, *model.AppError) {
	query := s.getQueryBuilder().Select("COUNT(*)").From("Channels").Where(sq.Eq{"GroupConstrained": true, "DeleteAt": 0})

	sql, args, err := query.ToSql()
	if err != nil {
		return 0, model.NewAppError("SqlChannelStore.GroupSyncedChannelCount", "store.sql_group.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	count, err := s.GetReplica().SelectInt(sql, args...)
	if err != nil {
		return 0, model.NewAppError("SqlChannelStore.GroupSyncedChannelCount", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return count, nil
}
