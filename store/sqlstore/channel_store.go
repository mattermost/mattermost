// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/services/cache"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

const (
	AllChannelMembersForUserCacheSize     = model.SessionCacheSize
	AllChannelMembersForUserCacheDuration = 15 * time.Minute // 15 mins

	AllChannelMembersNotifyPropsForChannelCacheSize     = model.SessionCacheSize
	AllChannelMembersNotifyPropsForChannelCacheDuration = 30 * time.Minute // 30 mins

	ChannelCacheDuration = 15 * time.Minute // 15 mins
)

type SqlChannelStore struct {
	*SqlStore
	metrics einterfaces.MetricsInterface
}

type channelMember struct {
	ChannelId        string
	UserId           string
	Roles            string
	LastViewedAt     int64
	MsgCount         int64
	MentionCount     int64
	NotifyProps      model.StringMap
	LastUpdateAt     int64
	SchemeUser       sql.NullBool
	SchemeAdmin      sql.NullBool
	SchemeGuest      sql.NullBool
	MentionCountRoot int64
	MsgCountRoot     int64
}

func NewChannelMemberFromModel(cm *model.ChannelMember) *channelMember {
	return &channelMember{
		ChannelId:        cm.ChannelId,
		UserId:           cm.UserId,
		Roles:            cm.ExplicitRoles,
		LastViewedAt:     cm.LastViewedAt,
		MsgCount:         cm.MsgCount,
		MentionCount:     cm.MentionCount,
		MentionCountRoot: cm.MentionCountRoot,
		MsgCountRoot:     cm.MsgCountRoot,
		NotifyProps:      cm.NotifyProps,
		LastUpdateAt:     cm.LastUpdateAt,
		SchemeGuest:      sql.NullBool{Valid: true, Bool: cm.SchemeGuest},
		SchemeUser:       sql.NullBool{Valid: true, Bool: cm.SchemeUser},
		SchemeAdmin:      sql.NullBool{Valid: true, Bool: cm.SchemeAdmin},
	}
}

type channelMemberWithSchemeRoles struct {
	ChannelId                     string
	UserId                        string
	Roles                         string
	LastViewedAt                  int64
	MsgCount                      int64
	MentionCount                  int64
	MentionCountRoot              int64
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
	MsgCountRoot                  int64
}

type channelMemberWithTeamWithSchemeRoles struct {
	channelMemberWithSchemeRoles
	TeamDisplayName string
	TeamName        string
	TeamUpdateAt    int64
}

type channelMemberWithTeamWithSchemeRolesList []channelMemberWithTeamWithSchemeRoles

func channelMemberSliceColumns() []string {
	return []string{"ChannelId", "UserId", "Roles", "LastViewedAt", "MsgCount", "MsgCountRoot", "MentionCount", "MentionCountRoot", "NotifyProps", "LastUpdateAt", "SchemeUser", "SchemeAdmin", "SchemeGuest"}
}

func channelMemberToSlice(member *model.ChannelMember) []interface{} {
	resultSlice := []interface{}{}
	resultSlice = append(resultSlice, member.ChannelId)
	resultSlice = append(resultSlice, member.UserId)
	resultSlice = append(resultSlice, member.ExplicitRoles)
	resultSlice = append(resultSlice, member.LastViewedAt)
	resultSlice = append(resultSlice, member.MsgCount)
	resultSlice = append(resultSlice, member.MsgCountRoot)
	resultSlice = append(resultSlice, member.MentionCount)
	resultSlice = append(resultSlice, member.MentionCountRoot)
	resultSlice = append(resultSlice, model.MapToJSON(member.NotifyProps))
	resultSlice = append(resultSlice, member.LastUpdateAt)
	resultSlice = append(resultSlice, member.SchemeUser)
	resultSlice = append(resultSlice, member.SchemeAdmin)
	resultSlice = append(resultSlice, member.SchemeGuest)
	return resultSlice
}

type channelMemberWithSchemeRolesList []channelMemberWithSchemeRoles

func getChannelRoles(schemeGuest, schemeUser, schemeAdmin bool, defaultTeamGuestRole, defaultTeamUserRole, defaultTeamAdminRole, defaultChannelGuestRole, defaultChannelUserRole, defaultChannelAdminRole string,
	roles []string) rolesInfo {
	result := rolesInfo{
		roles:         []string{},
		explicitRoles: []string{},
		schemeGuest:   schemeGuest,
		schemeUser:    schemeUser,
		schemeAdmin:   schemeAdmin,
	}

	// Identify any scheme derived roles that are in "Roles" field due to not yet being migrated, and exclude
	// them from ExplicitRoles field.
	for _, role := range roles {
		switch role {
		case model.ChannelGuestRoleId:
			result.schemeGuest = true
		case model.ChannelUserRoleId:
			result.schemeUser = true
		case model.ChannelAdminRoleId:
			result.schemeAdmin = true
		default:
			result.explicitRoles = append(result.explicitRoles, role)
			result.roles = append(result.roles, role)
		}
	}

	// Add any scheme derived roles that are not in the Roles field due to being Implicit from the Scheme, and add
	// them to the Roles field for backwards compatibility reasons.
	var schemeImpliedRoles []string
	if result.schemeGuest {
		if defaultChannelGuestRole != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, defaultChannelGuestRole)
		} else if defaultTeamGuestRole != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, defaultTeamGuestRole)
		} else {
			schemeImpliedRoles = append(schemeImpliedRoles, model.ChannelGuestRoleId)
		}
	}
	if result.schemeUser {
		if defaultChannelUserRole != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, defaultChannelUserRole)
		} else if defaultTeamUserRole != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, defaultTeamUserRole)
		} else {
			schemeImpliedRoles = append(schemeImpliedRoles, model.ChannelUserRoleId)
		}
	}
	if result.schemeAdmin {
		if defaultChannelAdminRole != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, defaultChannelAdminRole)
		} else if defaultTeamAdminRole != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, defaultTeamAdminRole)
		} else {
			schemeImpliedRoles = append(schemeImpliedRoles, model.ChannelAdminRoleId)
		}
	}
	for _, impliedRole := range schemeImpliedRoles {
		alreadyThere := false
		for _, role := range result.roles {
			if role == impliedRole {
				alreadyThere = true
				break
			}
		}
		if !alreadyThere {
			result.roles = append(result.roles, impliedRole)
		}
	}
	return result
}

func (db channelMemberWithSchemeRoles) ToModel() *model.ChannelMember {
	// Identify any system-wide scheme derived roles that are in "Roles" field due to not yet being migrated,
	// and exclude them from ExplicitRoles field.
	schemeGuest := db.SchemeGuest.Valid && db.SchemeGuest.Bool
	schemeUser := db.SchemeUser.Valid && db.SchemeUser.Bool
	schemeAdmin := db.SchemeAdmin.Valid && db.SchemeAdmin.Bool

	defaultTeamGuestRole := ""
	if db.TeamSchemeDefaultGuestRole.Valid {
		defaultTeamGuestRole = db.TeamSchemeDefaultGuestRole.String
	}

	defaultTeamUserRole := ""
	if db.TeamSchemeDefaultUserRole.Valid {
		defaultTeamUserRole = db.TeamSchemeDefaultUserRole.String
	}

	defaultTeamAdminRole := ""
	if db.TeamSchemeDefaultAdminRole.Valid {
		defaultTeamAdminRole = db.TeamSchemeDefaultAdminRole.String
	}

	defaultChannelGuestRole := ""
	if db.ChannelSchemeDefaultGuestRole.Valid {
		defaultChannelGuestRole = db.ChannelSchemeDefaultGuestRole.String
	}

	defaultChannelUserRole := ""
	if db.ChannelSchemeDefaultUserRole.Valid {
		defaultChannelUserRole = db.ChannelSchemeDefaultUserRole.String
	}

	defaultChannelAdminRole := ""
	if db.ChannelSchemeDefaultAdminRole.Valid {
		defaultChannelAdminRole = db.ChannelSchemeDefaultAdminRole.String
	}

	rolesResult := getChannelRoles(
		schemeGuest, schemeUser, schemeAdmin,
		defaultTeamGuestRole, defaultTeamUserRole, defaultTeamAdminRole,
		defaultChannelGuestRole, defaultChannelUserRole, defaultChannelAdminRole,
		strings.Fields(db.Roles),
	)
	return &model.ChannelMember{
		ChannelId:        db.ChannelId,
		UserId:           db.UserId,
		Roles:            strings.Join(rolesResult.roles, " "),
		LastViewedAt:     db.LastViewedAt,
		MsgCount:         db.MsgCount,
		MsgCountRoot:     db.MsgCountRoot,
		MentionCount:     db.MentionCount,
		MentionCountRoot: db.MentionCountRoot,
		NotifyProps:      db.NotifyProps,
		LastUpdateAt:     db.LastUpdateAt,
		SchemeAdmin:      rolesResult.schemeAdmin,
		SchemeUser:       rolesResult.schemeUser,
		SchemeGuest:      rolesResult.schemeGuest,
		ExplicitRoles:    strings.Join(rolesResult.explicitRoles, " "),
	}
}

// This is almost an entire copy of the above method with team information added.
func (db channelMemberWithTeamWithSchemeRoles) ToModel() *model.ChannelMemberWithTeamData {
	// Identify any system-wide scheme derived roles that are in "Roles" field due to not yet being migrated,
	// and exclude them from ExplicitRoles field.
	schemeGuest := db.SchemeGuest.Valid && db.SchemeGuest.Bool
	schemeUser := db.SchemeUser.Valid && db.SchemeUser.Bool
	schemeAdmin := db.SchemeAdmin.Valid && db.SchemeAdmin.Bool

	defaultTeamGuestRole := ""
	if db.TeamSchemeDefaultGuestRole.Valid {
		defaultTeamGuestRole = db.TeamSchemeDefaultGuestRole.String
	}

	defaultTeamUserRole := ""
	if db.TeamSchemeDefaultUserRole.Valid {
		defaultTeamUserRole = db.TeamSchemeDefaultUserRole.String
	}

	defaultTeamAdminRole := ""
	if db.TeamSchemeDefaultAdminRole.Valid {
		defaultTeamAdminRole = db.TeamSchemeDefaultAdminRole.String
	}

	defaultChannelGuestRole := ""
	if db.ChannelSchemeDefaultGuestRole.Valid {
		defaultChannelGuestRole = db.ChannelSchemeDefaultGuestRole.String
	}

	defaultChannelUserRole := ""
	if db.ChannelSchemeDefaultUserRole.Valid {
		defaultChannelUserRole = db.ChannelSchemeDefaultUserRole.String
	}

	defaultChannelAdminRole := ""
	if db.ChannelSchemeDefaultAdminRole.Valid {
		defaultChannelAdminRole = db.ChannelSchemeDefaultAdminRole.String
	}

	rolesResult := getChannelRoles(
		schemeGuest, schemeUser, schemeAdmin,
		defaultTeamGuestRole, defaultTeamUserRole, defaultTeamAdminRole,
		defaultChannelGuestRole, defaultChannelUserRole, defaultChannelAdminRole,
		strings.Fields(db.Roles),
	)
	return &model.ChannelMemberWithTeamData{
		ChannelMember: model.ChannelMember{
			ChannelId:        db.ChannelId,
			UserId:           db.UserId,
			Roles:            strings.Join(rolesResult.roles, " "),
			LastViewedAt:     db.LastViewedAt,
			MsgCount:         db.MsgCount,
			MsgCountRoot:     db.MsgCountRoot,
			MentionCount:     db.MentionCount,
			MentionCountRoot: db.MentionCountRoot,
			NotifyProps:      db.NotifyProps,
			LastUpdateAt:     db.LastUpdateAt,
			SchemeAdmin:      rolesResult.schemeAdmin,
			SchemeUser:       rolesResult.schemeUser,
			SchemeGuest:      rolesResult.schemeGuest,
			ExplicitRoles:    strings.Join(rolesResult.explicitRoles, " "),
		},
		TeamName:        db.TeamName,
		TeamDisplayName: db.TeamDisplayName,
		TeamUpdateAt:    db.TeamUpdateAt,
	}
}

func (db channelMemberWithSchemeRolesList) ToModel() model.ChannelMembers {
	cms := model.ChannelMembers{}

	for _, cm := range db {
		cms = append(cms, *cm.ToModel())
	}

	return cms
}

func (db channelMemberWithTeamWithSchemeRolesList) ToModel() model.ChannelMembersWithTeamData {
	cms := model.ChannelMembersWithTeamData{}

	for _, cm := range db {
		cms = append(cms, *cm.ToModel())
	}

	return cms
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
			schemeImpliedRoles = append(schemeImpliedRoles, model.ChannelGuestRoleId)
		}
	}
	if db.SchemeUser.Valid && db.SchemeUser.Bool {
		if db.ChannelSchemeDefaultUserRole.Valid && db.ChannelSchemeDefaultUserRole.String != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, db.ChannelSchemeDefaultUserRole.String)
		} else if db.TeamSchemeDefaultUserRole.Valid && db.TeamSchemeDefaultUserRole.String != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, db.TeamSchemeDefaultUserRole.String)
		} else {
			schemeImpliedRoles = append(schemeImpliedRoles, model.ChannelUserRoleId)
		}
	}
	if db.SchemeAdmin.Valid && db.SchemeAdmin.Bool {
		if db.ChannelSchemeDefaultAdminRole.Valid && db.ChannelSchemeDefaultAdminRole.String != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, db.ChannelSchemeDefaultAdminRole.String)
		} else if db.TeamSchemeDefaultAdminRole.Valid && db.TeamSchemeDefaultAdminRole.String != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, db.TeamSchemeDefaultAdminRole.String)
		} else {
			schemeImpliedRoles = append(schemeImpliedRoles, model.ChannelAdminRoleId)
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

// channelInternal is a struct without the db:"-" tags
// which does not work with sqlx. This would be removed once we
// move to the new migration system.
type channelInternal struct {
	Id                string
	CreateAt          int64
	UpdateAt          int64
	DeleteAt          int64
	TeamId            string
	Type              model.ChannelType
	DisplayName       string
	Name              string
	Header            string
	Purpose           string
	LastPostAt        int64
	TotalMsgCount     int64
	ExtraUpdateAt     int64
	CreatorId         string
	SchemeId          *string
	Props             map[string]interface{}
	GroupConstrained  *bool
	Shared            *bool
	TotalMsgCountRoot int64
	PolicyId          *string
	LastRootPostAt    int64
}

func (ci *channelInternal) ToModel() *model.Channel {
	return &model.Channel{
		Id:                ci.Id,
		CreateAt:          ci.CreateAt,
		UpdateAt:          ci.UpdateAt,
		DeleteAt:          ci.DeleteAt,
		TeamId:            ci.TeamId,
		Type:              ci.Type,
		DisplayName:       ci.DisplayName,
		Name:              ci.Name,
		Header:            ci.Header,
		Purpose:           ci.Purpose,
		LastPostAt:        ci.LastPostAt,
		TotalMsgCount:     ci.TotalMsgCount,
		ExtraUpdateAt:     ci.ExtraUpdateAt,
		CreatorId:         ci.CreatorId,
		SchemeId:          ci.SchemeId,
		Props:             ci.Props,
		GroupConstrained:  ci.GroupConstrained,
		Shared:            ci.Shared,
		TotalMsgCountRoot: ci.TotalMsgCountRoot,
		PolicyID:          ci.PolicyId,
		LastRootPostAt:    ci.LastRootPostAt,
	}
}

type channelWithTeamDataInternal struct {
	channelInternal
	TeamDisplayName string
	TeamName        string
	TeamUpdateAt    int64
}

func (ctd *channelWithTeamDataInternal) ToModel() *model.ChannelWithTeamData {
	res := &model.ChannelWithTeamData{
		TeamDisplayName: ctd.TeamDisplayName,
		TeamName:        ctd.TeamName,
		TeamUpdateAt:    ctd.TeamUpdateAt,
	}
	res.Channel = *ctd.channelInternal.ToModel()
	return res
}

func channelWithTeamDataSliceToModel(channels []*channelWithTeamDataInternal) model.ChannelListWithTeamData {
	res := make(model.ChannelListWithTeamData, 0, len(channels))
	for _, ch := range channels {
		res = append(res, ch.ToModel())
	}
	return res
}

var allChannelMembersForUserCache = cache.NewLRU(cache.LRUOptions{
	Size: AllChannelMembersForUserCacheSize,
})
var allChannelMembersNotifyPropsForChannelCache = cache.NewLRU(cache.LRUOptions{
	Size: AllChannelMembersNotifyPropsForChannelCacheSize,
})
var channelByNameCache = cache.NewLRU(cache.LRUOptions{
	Size: model.ChannelCacheSize,
})

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

func newSqlChannelStore(sqlStore *SqlStore, metrics einterfaces.MetricsInterface) store.ChannelStore {
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
		table.ColMap("LastRootPostAt").SetDefaultConstraint(model.NewString("0"))

		tablem := db.AddTableWithName(channelMember{}, "ChannelMembers").SetKeys(false, "ChannelId", "UserId")
		tablem.ColMap("ChannelId").SetMaxSize(26)
		tablem.ColMap("UserId").SetMaxSize(26)
		tablem.ColMap("Roles").SetMaxSize(model.UserRolesMaxLength)
		tablem.ColMap("NotifyProps").SetDataType(sqlStore.jsonDataType())

		tablePublicChannels := db.AddTableWithName(publicChannel{}, "PublicChannels").SetKeys(false, "Id")
		tablePublicChannels.ColMap("Id").SetMaxSize(26)
		tablePublicChannels.ColMap("TeamId").SetMaxSize(26)
		tablePublicChannels.ColMap("DisplayName").SetMaxSize(64)
		tablePublicChannels.ColMap("Name").SetMaxSize(64)
		tablePublicChannels.SetUniqueTogether("Name", "TeamId")
		tablePublicChannels.ColMap("Header").SetMaxSize(1024)
		tablePublicChannels.ColMap("Purpose").SetMaxSize(250)

		tableSidebarCategories := db.AddTableWithName(model.SidebarCategory{}, "SidebarCategories").SetKeys(false, "Id")
		tableSidebarCategories.ColMap("Id").SetMaxSize(128)
		tableSidebarCategories.ColMap("UserId").SetMaxSize(26)
		tableSidebarCategories.ColMap("TeamId").SetMaxSize(26)
		tableSidebarCategories.ColMap("Sorting").SetMaxSize(64)
		tableSidebarCategories.ColMap("Type").SetMaxSize(64)
		tableSidebarCategories.ColMap("DisplayName").SetMaxSize(64)

		tableSidebarChannels := db.AddTableWithName(model.SidebarChannel{}, "SidebarChannels").SetKeys(false, "ChannelId", "UserId", "CategoryId")
		tableSidebarChannels.ColMap("ChannelId").SetMaxSize(26)
		tableSidebarChannels.ColMap("UserId").SetMaxSize(26)
		tableSidebarChannels.ColMap("CategoryId").SetMaxSize(128)
	}

	return s
}

func (s SqlChannelStore) upsertPublicChannelT(transaction *sqlxTxWrapper, channel *model.Channel) error {
	publicChannel := &publicChannel{
		Id:          channel.Id,
		DeleteAt:    channel.DeleteAt,
		TeamId:      channel.TeamId,
		DisplayName: channel.DisplayName,
		Name:        channel.Name,
		Header:      channel.Header,
		Purpose:     channel.Purpose,
	}

	if channel.Type != model.ChannelTypeOpen {
		if _, err := transaction.Exec(`DELETE FROM PublicChannels WHERE Id=?`, publicChannel.Id); err != nil {
			return errors.Wrap(err, "failed to delete public channel")
		}

		return nil
	}

	vals := map[string]interface{}{
		"id":          publicChannel.Id,
		"deleteat":    publicChannel.DeleteAt,
		"teamid":      publicChannel.TeamId,
		"displayname": publicChannel.DisplayName,
		"name":        publicChannel.Name,
		"header":      publicChannel.Header,
		"purpose":     publicChannel.Purpose,
	}
	var err error
	if s.DriverName() == model.DatabaseDriverMysql {
		_, err = transaction.NamedExec(`
			INSERT INTO
			    PublicChannels(Id, DeleteAt, TeamId, DisplayName, Name, Header, Purpose)
			VALUES
			    (:id, :deleteat, :teamid, :displayname, :name, :header, :purpose)
			ON DUPLICATE KEY UPDATE
			    DeleteAt = :deleteat,
			    TeamId = :teamid,
			    DisplayName = :displayname,
			    Name = :name,
			    Header = :header,
			    Purpose = :purpose;
		`, vals)
	} else {
		_, err = transaction.NamedExec(`
			INSERT INTO
			    PublicChannels(Id, DeleteAt, TeamId, DisplayName, Name, Header, Purpose)
			VALUES
			    (:id, :deleteat, :teamid, :displayname, :name, :header, :purpose)
			ON CONFLICT (id) DO UPDATE
			SET DeleteAt = :deleteat,
			    TeamId = :teamid,
			    DisplayName = :displayname,
			    Name = :name,
			    Header = :header,
			    Purpose = :purpose;
		`, vals)
	}
	if err != nil {
		return errors.Wrap(err, "failed to insert public channel")
	}

	return nil
}

// Save writes the (non-direct) channel channel to the database.
func (s SqlChannelStore) Save(channel *model.Channel, maxChannelsPerTeam int64) (*model.Channel, error) {
	if channel.DeleteAt != 0 {
		return nil, store.NewErrInvalidInput("Channel", "DeleteAt", channel.DeleteAt)
	}

	if channel.Type == model.ChannelTypeDirect {
		return nil, store.NewErrInvalidInput("Channel", "Type", channel.Type)
	}

	var newChannel *model.Channel
	transaction, err := s.GetMasterX().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction)

	newChannel, err = s.saveChannelT(transaction, channel, maxChannelsPerTeam)
	if err != nil {
		return newChannel, err
	}

	// Additionally propagate the write to the PublicChannels table.
	if err = s.upsertPublicChannelT(transaction, newChannel); err != nil {
		return nil, errors.Wrap(err, "upsert_public_channel")
	}

	if err = transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}
	// There are cases when in case of conflict, the original channel value is returned.
	// So we return both and let the caller do the checks.
	return newChannel, err
}

func (s SqlChannelStore) CreateDirectChannel(user *model.User, otherUser *model.User, channelOptions ...model.ChannelOption) (*model.Channel, error) {
	channel := new(model.Channel)

	for _, option := range channelOptions {
		option(channel)
	}

	channel.DisplayName = ""
	channel.Name = model.GetDMNameFromIds(otherUser.Id, user.Id)

	channel.Header = ""
	channel.Type = model.ChannelTypeDirect
	channel.Shared = model.NewBool(user.IsRemote() || otherUser.IsRemote())
	channel.CreatorId = user.Id

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

func (s SqlChannelStore) SaveDirectChannel(directChannel *model.Channel, member1 *model.ChannelMember, member2 *model.ChannelMember) (*model.Channel, error) {
	if directChannel.DeleteAt != 0 {
		return nil, store.NewErrInvalidInput("Channel", "DeleteAt", directChannel.DeleteAt)
	}

	if directChannel.Type != model.ChannelTypeDirect {
		return nil, store.NewErrInvalidInput("Channel", "Type", directChannel.Type)
	}

	transaction, err := s.GetMasterX().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction)

	directChannel.TeamId = ""
	newChannel, err := s.saveChannelT(transaction, directChannel, 0)
	if err != nil {
		return newChannel, err
	}

	// Members need new channel ID
	member1.ChannelId = newChannel.Id
	member2.ChannelId = newChannel.Id

	if member1.UserId != member2.UserId {
		_, err = s.saveMultipleMembers([]*model.ChannelMember{member1, member2})
	} else {
		_, err = s.saveMemberT(member2)
	}
	if err != nil {
		return nil, err
	}

	if err := transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}

	return newChannel, nil

}

func (s SqlChannelStore) saveChannelT(transaction *sqlxTxWrapper, channel *model.Channel, maxChannelsPerTeam int64) (*model.Channel, error) {
	if channel.Id != "" && !channel.IsShared() {
		return nil, store.NewErrInvalidInput("Channel", "Id", channel.Id)
	}

	channel.PreSave()
	if err := channel.IsValid(); err != nil { // TODO: this needs to return plain error in v6.
		return nil, err // we just pass through the error as-is for now.
	}

	if channel.Type != model.ChannelTypeDirect && channel.Type != model.ChannelTypeGroup && maxChannelsPerTeam >= 0 {
		var count int64
		if err := transaction.Get(&count, "SELECT COUNT(0) FROM Channels WHERE TeamId = ? AND DeleteAt = 0 AND (Type = 'O' OR Type = 'P')", channel.TeamId); err != nil {
			return nil, errors.Wrapf(err, "save_channel_count: teamId=%s", channel.TeamId)
		} else if count >= maxChannelsPerTeam {
			return nil, store.NewErrLimitExceeded("channels_per_team", int(count), "teamId="+channel.TeamId)
		}
	}

	if _, err := transaction.NamedExec(`INSERT INTO Channels
		(Id, CreateAt, UpdateAt, DeleteAt, TeamId, Type, DisplayName, Name, Header, Purpose, LastPostAt, TotalMsgCount, ExtraUpdateAt, CreatorId, SchemeId, GroupConstrained, Shared, TotalMsgCountRoot, LastRootPostAt)
		VALUES
		(:Id, :CreateAt, :UpdateAt, :DeleteAt, :TeamId, :Type, :DisplayName, :Name, :Header, :Purpose, :LastPostAt, :TotalMsgCount, :ExtraUpdateAt, :CreatorId, :SchemeId, :GroupConstrained, :Shared, :TotalMsgCountRoot, :LastRootPostAt)`, channel); err != nil {
		if IsUniqueConstraintError(err, []string{"Name", "channels_name_teamid_key"}) {
			dupChannel := model.Channel{}
			s.GetMasterX().Get(&dupChannel, "SELECT * FROM Channels WHERE TeamId = ? AND Name = ?", channel.TeamId, channel.Name)
			return &dupChannel, store.NewErrConflict("Channel", err, "id="+channel.Id)
		}
		return nil, errors.Wrapf(err, "save_channel: id=%s", channel.Id)
	}
	return channel, nil
}

// Update writes the updated channel to the database.
func (s SqlChannelStore) Update(channel *model.Channel) (*model.Channel, error) {
	transaction, err := s.GetMasterX().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction)

	updatedChannel, err := s.updateChannelT(transaction, channel)
	if err != nil {
		return nil, err
	}

	// Additionally propagate the write to the PublicChannels table.
	if err := s.upsertPublicChannelT(transaction, updatedChannel); err != nil {
		return nil, errors.Wrap(err, "upsertPublicChannelT: failed to upsert channel")
	}

	if err := transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}
	return updatedChannel, nil
}

func (s SqlChannelStore) updateChannelT(transaction *sqlxTxWrapper, channel *model.Channel) (*model.Channel, error) {
	channel.PreUpdate()

	if channel.DeleteAt != 0 {
		return nil, store.NewErrInvalidInput("Channel", "DeleteAt", channel.DeleteAt)
	}

	if err := channel.IsValid(); err != nil {
		return nil, err
	}

	res, err := transaction.NamedExec(`UPDATE Channels
		SET CreateAt=:CreateAt,
			UpdateAt=:UpdateAt,
			DeleteAt=:DeleteAt,
			TeamId=:TeamId,
			Type=:Type,
			DisplayName=:DisplayName,
			Name=:Name,
			Header=:Header,
			Purpose=:Purpose,
			LastPostAt=:LastPostAt,
			TotalMsgCount=:TotalMsgCount,
			ExtraUpdateAt=:ExtraUpdateAt,
			CreatorId=:CreatorId,
			SchemeId=:SchemeId,
			GroupConstrained=:GroupConstrained,
			Shared=:Shared,
			TotalMsgCountRoot=:TotalMsgCountRoot,
			LastRootPostAt=:LastRootPostAt
		WHERE Id=:Id`, channel)
	if err != nil {
		if IsUniqueConstraintError(err, []string{"Name", "channels_name_teamid_key"}) {
			dupChannel := model.Channel{}
			s.GetReplicaX().Get(&dupChannel, "SELECT * FROM Channels WHERE TeamId = :TeamId AND Name= :Name AND DeleteAt > 0", map[string]interface{}{"TeamId": channel.TeamId, "Name": channel.Name})
			if dupChannel.DeleteAt > 0 {
				return nil, store.NewErrInvalidInput("Channel", "Id", channel.Id)
			}
			return nil, store.NewErrInvalidInput("Channel", "Id", channel.Id)
		}
		return nil, errors.Wrapf(err, "failed to update channel with id=%s", channel.Id)
	}

	count, err := res.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "error while getting rowsAffected in updateChannelT")
	}
	if count > 1 {
		return nil, fmt.Errorf("the expected number of channels to be updated is <=1 but was %d", count)
	}

	return channel, nil
}

func (s SqlChannelStore) GetChannelUnread(channelId, userId string) (*model.ChannelUnread, error) {
	var unreadChannel model.ChannelUnread
	err := s.GetReplicaX().Get(&unreadChannel,
		`SELECT
				Channels.TeamId TeamId, Channels.Id ChannelId, (Channels.TotalMsgCount - ChannelMembers.MsgCount) MsgCount, (Channels.TotalMsgCountRoot - ChannelMembers.MsgCountRoot) MsgCountRoot, ChannelMembers.MentionCount MentionCount, ChannelMembers.MentionCountRoot MentionCountRoot, ChannelMembers.NotifyProps NotifyProps
			FROM
				Channels, ChannelMembers
			WHERE
				Id = ChannelId
                AND Id = ?
                AND UserId = ?
                AND DeleteAt = 0`,
		channelId, userId)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Channel", fmt.Sprintf("channelId=%s,userId=%s", channelId, userId))
		}
		return nil, errors.Wrapf(err, "failed to get Channel with channelId=%s and userId=%s", channelId, userId)
	}
	return &unreadChannel, nil
}

//nolint:unparam
func (s SqlChannelStore) InvalidateChannel(id string) {
}

func (s SqlChannelStore) InvalidateChannelByName(teamId, name string) {
	channelByNameCache.Remove(teamId + name)
	if s.metrics != nil {
		s.metrics.IncrementMemCacheInvalidationCounter("Channel by Name - Remove by TeamId and Name")
	}
}

//nolint:unparam
func (s SqlChannelStore) Get(id string, allowFromCache bool) (*model.Channel, error) {
	return s.get(id, false)
}

func (s SqlChannelStore) GetPinnedPosts(channelId string) (*model.PostList, error) {
	pl := model.NewPostList()

	posts := []*postInternal{}
	if err := s.GetReplicaX().Select(&posts, "SELECT *, (SELECT count(Posts.Id) FROM Posts WHERE Posts.RootId = (CASE WHEN p.RootId = '' THEN p.Id ELSE p.RootId END) AND Posts.DeleteAt = 0) as ReplyCount  FROM Posts p WHERE IsPinned = true AND ChannelId = ? AND DeleteAt = 0 ORDER BY CreateAt ASC", channelId); err != nil {
		return nil, errors.Wrap(err, "failed to find Posts")
	}
	for _, post := range posts {
		pl.AddPost(post.ToModel())
		pl.AddOrder(post.Id)
	}
	return pl, nil
}

func (s SqlChannelStore) GetFromMaster(id string) (*model.Channel, error) {
	return s.get(id, true)
}

func (s SqlChannelStore) get(id string, master bool) (*model.Channel, error) {
	var db *sqlxDBWrapper

	if master {
		db = s.GetMasterX()
	} else {
		db = s.GetReplicaX()
	}

	ch := model.Channel{}
	err := db.Get(&ch, `SELECT * FROM Channels WHERE Id=?`, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Channel", id)
		}
		return nil, errors.Wrapf(err, "failed to find channel with id = %s", id)
	}

	return &ch, nil
}

// Delete records the given deleted timestamp to the channel in question.
func (s SqlChannelStore) Delete(channelId string, time int64) error {
	return s.SetDeleteAt(channelId, time, time)
}

// Restore reverts a previous deleted timestamp from the channel in question.
func (s SqlChannelStore) Restore(channelId string, time int64) error {
	return s.SetDeleteAt(channelId, 0, time)
}

// SetDeleteAt records the given deleted and updated timestamp to the channel in question.
func (s SqlChannelStore) SetDeleteAt(channelId string, deleteAt, updateAt int64) error {
	defer s.InvalidateChannel(channelId)

	transaction, err := s.GetMasterX().Beginx()
	if err != nil {
		return errors.Wrap(err, "SetDeleteAt: begin_transaction")
	}
	defer finalizeTransactionX(transaction)

	err = s.setDeleteAtT(transaction, channelId, deleteAt, updateAt)
	if err != nil {
		return errors.Wrap(err, "setDeleteAtT")
	}

	// Additionally propagate the write to the PublicChannels table.
	if _, err := transaction.Exec(`
			UPDATE
			    PublicChannels
			SET
			    DeleteAt = ?
			WHERE
			    Id = ?
		`, deleteAt, channelId); err != nil {
		return errors.Wrapf(err, "failed to delete public channels with id=%s", channelId)
	}

	if err := transaction.Commit(); err != nil {
		return errors.Wrapf(err, "SetDeleteAt: commit_transaction")
	}

	return nil
}

func (s SqlChannelStore) setDeleteAtT(transaction *sqlxTxWrapper, channelId string, deleteAt, updateAt int64) error {
	_, err := transaction.Exec(`UPDATE Channels
			SET DeleteAt = ?,
				UpdateAt = ?
			WHERE Id = ?`, deleteAt, updateAt, channelId)
	if err != nil {
		return errors.Wrapf(err, "failed to delete channel with id=%s", channelId)
	}

	return nil
}

// PermanentDeleteByTeam removes all channels for the given team from the database.
func (s SqlChannelStore) PermanentDeleteByTeam(teamId string) error {
	transaction, err := s.GetMasterX().Beginx()
	if err != nil {
		return errors.Wrap(err, "PermanentDeleteByTeam: begin_transaction")
	}
	defer finalizeTransactionX(transaction)

	if err := s.permanentDeleteByTeamtT(transaction, teamId); err != nil {
		return errors.Wrap(err, "permanentDeleteByTeamtT")
	}

	// Additionally propagate the deletions to the PublicChannels table.
	if _, err := transaction.Exec(`
			DELETE FROM
			    PublicChannels
			WHERE
			    TeamId = ?
		`, teamId); err != nil {
		return errors.Wrapf(err, "failed to delete public channels by team with teamId=%s", teamId)
	}

	if err := transaction.Commit(); err != nil {
		return errors.Wrap(err, "PermanentDeleteByTeam: commit_transaction")
	}

	return nil
}

func (s SqlChannelStore) permanentDeleteByTeamtT(transaction *sqlxTxWrapper, teamId string) error {
	if _, err := transaction.Exec("DELETE FROM Channels WHERE TeamId = ?", teamId); err != nil {
		return errors.Wrapf(err, "failed to delete channel by team with teamId=%s", teamId)
	}

	return nil
}

// PermanentDelete removes the given channel from the database.
func (s SqlChannelStore) PermanentDelete(channelId string) error {
	transaction, err := s.GetMasterX().Beginx()
	if err != nil {
		return errors.Wrap(err, "PermanentDelete: begin_transaction")
	}
	defer finalizeTransactionX(transaction)

	if err := s.permanentDeleteT(transaction, channelId); err != nil {
		return errors.Wrap(err, "permanentDeleteT")
	}

	// Additionally propagate the deletion to the PublicChannels table.
	if _, err := transaction.Exec(`
			DELETE FROM
			    PublicChannels
			WHERE
			    Id = ?
		`, channelId); err != nil {
		return errors.Wrapf(err, "failed to delete public channels with id=%s", channelId)
	}

	if err := transaction.Commit(); err != nil {
		return errors.Wrap(err, "PermanentDelete: commit_transaction")
	}

	return nil
}

func (s SqlChannelStore) permanentDeleteT(transaction *sqlxTxWrapper, channelId string) error {
	if _, err := transaction.Exec("DELETE FROM Channels WHERE Id = ?", channelId); err != nil {
		return errors.Wrapf(err, "failed to delete channel with id=%s", channelId)
	}

	return nil
}

func (s SqlChannelStore) PermanentDeleteMembersByChannel(channelId string) error {
	_, err := s.GetMasterX().Exec("DELETE FROM ChannelMembers WHERE ChannelId = ?", channelId)
	if err != nil {
		return errors.Wrapf(err, "failed to delete Channel with channelId=%s", channelId)
	}

	return nil
}

func (s SqlChannelStore) GetChannels(teamId string, userId string, includeDeleted bool, lastDeleteAt int) (model.ChannelList, error) {
	query := s.getQueryBuilder().
		Select("Channels.*").
		From("Channels, ChannelMembers").
		Where(
			sq.And{
				sq.Expr("Id = ChannelId"),
				sq.Eq{"UserId": userId},
			},
		).
		OrderBy("DisplayName")

	if teamId != "" {
		query = query.Where(sq.Or{
			sq.Eq{"TeamId": teamId},
			sq.Eq{"TeamId": ""},
		})
	}

	if includeDeleted {
		if lastDeleteAt != 0 {
			// We filter by non-archived, and archived >= a timestamp.
			query = query.Where(sq.Or{
				sq.Eq{"DeleteAt": 0},
				sq.GtOrEq{"DeleteAt": lastDeleteAt},
			})
		}
		// If lastDeleteAt is not set, we include everything. That means no filter is needed.
	} else {
		// Don't include archived channels.
		query = query.Where(sq.Eq{"DeleteAt": 0})
	}

	channels := model.ChannelList{}
	sql, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "getchannels_tosql")
	}

	err = s.GetReplicaX().Select(&channels, sql, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get channels with TeamId=%s and UserId=%s", teamId, userId)
	}

	if len(channels) == 0 {
		return nil, store.NewErrNotFound("Channel", "userId="+userId)
	}

	return channels, nil
}

func (s SqlChannelStore) GetChannelsByUser(userId string, includeDeleted bool, lastDeleteAt, pageSize int, fromChannelID string) (model.ChannelList, error) {
	query := s.getQueryBuilder().
		Select("Channels.*").
		From("Channels, ChannelMembers").
		Where(
			sq.And{
				sq.Expr("Id = ChannelId"),
				sq.Eq{"UserId": userId},
			},
		).
		OrderBy("Id ASC")

	if fromChannelID != "" {
		query = query.Where(sq.Gt{"Id": fromChannelID})
	}

	if pageSize != -1 {
		query = query.Limit(uint64(pageSize))
	}

	if includeDeleted {
		if lastDeleteAt != 0 {
			// We filter by non-archived, and archived >= a timestamp.
			query = query.Where(sq.Or{
				sq.Eq{"DeleteAt": 0},
				sq.GtOrEq{"DeleteAt": lastDeleteAt},
			})
		}
		// If lastDeleteAt is not set, we include everything. That means no filter is needed.
	} else {
		// Don't include archived channels.
		query = query.Where(sq.Eq{"DeleteAt": 0})
	}

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "getchannels_tosql")
	}

	channels := model.ChannelList{}
	err = s.GetReplicaX().Select(&channels, sql, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get channels with UserId=%s", userId)
	}

	if len(channels) == 0 {
		return nil, store.NewErrNotFound("Channel", "userId="+userId)
	}

	return channels, nil
}

func (s SqlChannelStore) GetAllChannelMembersById(channelID string) ([]string, error) {
	dbMembers := channelMemberWithSchemeRolesList{}
	err := s.GetReplicaX().Select(&dbMembers, channelMembersForTeamWithSchemeSelectQuery+"WHERE ChannelId = ?", channelID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get ChannelMembers with channelID=%s", channelID)
	}

	res := make([]string, 0, len(dbMembers))
	for _, member := range dbMembers.ToModel() {
		res = append(res, member.UserId)
	}

	return res, nil
}

func (s SqlChannelStore) GetAllChannels(offset, limit int, opts store.ChannelSearchOpts) (model.ChannelListWithTeamData, error) {
	query := s.getAllChannelsQuery(opts, false)

	query = query.
		OrderBy("c.DisplayName, Teams.DisplayName").
		Limit(uint64(limit)).
		Offset(uint64(offset))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to create query")
	}

	data := []*channelWithTeamDataInternal{}
	err = s.GetReplicaX().Select(&data, queryString, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get all channels")
	}

	return channelWithTeamDataSliceToModel(data), nil
}

func (s SqlChannelStore) GetAllChannelsCount(opts store.ChannelSearchOpts) (int64, error) {
	query := s.getAllChannelsQuery(opts, true)

	queryString, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "failed to create query")
	}

	var count int64
	err = s.GetReplicaX().Get(&count, queryString, args...)
	if err != nil {
		return 0, errors.Wrap(err, "failed to count all channels")
	}

	return count, nil
}

func (s SqlChannelStore) getAllChannelsQuery(opts store.ChannelSearchOpts, forCount bool) sq.SelectBuilder {
	var selectStr string
	if forCount {
		selectStr = "count(c.Id)"
	} else {
		selectStr = "c.*, Teams.DisplayName AS TeamDisplayName, Teams.Name AS TeamName, Teams.UpdateAt AS TeamUpdateAt"
		if opts.IncludePolicyID {
			selectStr += ", RetentionPoliciesChannels.PolicyId"
		}
	}

	query := s.getQueryBuilder().
		Select(selectStr).
		From("Channels AS c").
		Where(sq.Eq{"c.Type": []model.ChannelType{model.ChannelTypePrivate, model.ChannelTypeOpen}})

	if !forCount {
		query = query.Join("Teams ON Teams.Id = c.TeamId")
	}

	if !opts.IncludeDeleted {
		query = query.Where(sq.Eq{"c.DeleteAt": int(0)})
	}

	if opts.NotAssociatedToGroup != "" {
		query = query.Where("c.Id NOT IN (SELECT ChannelId FROM GroupChannels WHERE GroupChannels.GroupId = ? AND GroupChannels.DeleteAt = 0)", opts.NotAssociatedToGroup)
	}

	if len(opts.ExcludeChannelNames) > 0 {
		query = query.Where(sq.NotEq{"c.Name": opts.ExcludeChannelNames})
	}

	if opts.ExcludePolicyConstrained || opts.IncludePolicyID {
		query = query.LeftJoin("RetentionPoliciesChannels ON c.Id = RetentionPoliciesChannels.ChannelId")
	}
	if opts.ExcludePolicyConstrained {
		query = query.Where("RetentionPoliciesChannels.ChannelId IS NULL")
	}

	return query
}

func (s SqlChannelStore) GetMoreChannels(teamId string, userId string, offset int, limit int) (model.ChannelList, error) {
	channels := model.ChannelList{}
	err := s.GetReplicaX().Select(&channels, `
		SELECT
			Channels.*
		FROM
			Channels
		JOIN
			PublicChannels c ON (c.Id = Channels.Id)
		WHERE
			c.TeamId = ?
		AND c.DeleteAt = 0
		AND c.Id NOT IN (
			SELECT
				c.Id
			FROM
				PublicChannels c
			JOIN
				ChannelMembers cm ON (cm.ChannelId = c.Id)
			WHERE
				c.TeamId = ?
			AND cm.UserId = ?
			AND c.DeleteAt = 0
		)
		ORDER BY
			c.DisplayName
		LIMIT ?
		OFFSET ?
		`, teamId, teamId, userId, limit, offset)

	if err != nil {
		return nil, errors.Wrapf(err, "failed getting channels with teamId=%s and userId=%s", teamId, userId)
	}

	return channels, nil
}

func (s SqlChannelStore) GetPrivateChannelsForTeam(teamId string, offset int, limit int) (model.ChannelList, error) {
	channels := model.ChannelList{}

	builder := s.getQueryBuilder().
		Select("*").
		From("Channels").
		Where(sq.Eq{"Type": model.ChannelTypePrivate, "TeamId": teamId, "DeleteAt": 0}).
		OrderBy("DisplayName").
		Limit(uint64(limit)).
		Offset(uint64(offset))

	query, args, err := builder.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channels_tosql")
	}

	err = s.GetReplicaX().Select(&channels, query, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find chaneld with teamId=%s", teamId)
	}
	return channels, nil
}

func (s SqlChannelStore) GetPublicChannelsForTeam(teamId string, offset int, limit int) (model.ChannelList, error) {
	channels := model.ChannelList{}
	err := s.GetReplicaX().Select(&channels, `
		SELECT
			Channels.*
		FROM
			Channels
		JOIN
			PublicChannels pc ON (pc.Id = Channels.Id)
		WHERE
			pc.TeamId = ?
		AND pc.DeleteAt = 0
		ORDER BY pc.DisplayName
		LIMIT ?
		OFFSET ?
		`, teamId, limit, offset)

	if err != nil {
		return nil, errors.Wrapf(err, "failed to find chaneld with teamId=%s", teamId)
	}

	return channels, nil
}

func (s SqlChannelStore) GetPublicChannelsByIdsForTeam(teamId string, channelIds []string) (model.ChannelList, error) {
	props := make(map[string]interface{})
	props["teamId"] = teamId

	idQuery := ""

	for index, channelId := range channelIds {
		if idQuery != "" {
			idQuery += ", "
		}

		props["channelId"+strconv.Itoa(index)] = channelId
		idQuery += ":channelId" + strconv.Itoa(index)
	}

	var data model.ChannelList

	builder := s.getQueryBuilder().
		Select("Channels.*").
		From("Channels").
		Join("PublicChannels pc ON (pc.Id = Channels.Id)").
		Where(sq.And{
			sq.Eq{"pc.TeamId": teamId},
			sq.Eq{"pc.DeleteAt": 0},
			sq.Eq{"pc.Id": channelIds},
		}).
		OrderBy("pc.DisplayName")

	queryString, args, err := builder.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "GetPublicChannelsByIdsForTeam to_sql")
	}
	err = s.GetReplicaX().Select(&data, queryString, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Channels")
	}

	if len(data) == 0 {
		return nil, store.NewErrNotFound("Channel", fmt.Sprintf("teamId=%s, channelIds=%v", teamId, channelIds))
	}

	return data, nil
}

func (s SqlChannelStore) GetChannelCounts(teamId string, userId string) (*model.ChannelCounts, error) {
	data := []struct {
		Id                string
		TotalMsgCount     int64
		TotalMsgCountRoot int64
		UpdateAt          int64
	}{}
	err := s.GetReplicaX().Select(&data, `SELECT Id, TotalMsgCount, TotalMsgCountRoot, UpdateAt
			FROM Channels
			WHERE Id IN (SELECT ChannelId FROM ChannelMembers WHERE UserId = ?)
				AND	(TeamId = ? OR TeamId = '')
				AND	DeleteAt = 0
				ORDER BY DisplayName`, userId, teamId)

	if err != nil {
		return nil, errors.Wrapf(err, "failed to get channels count with teamId=%s and userId=%s", teamId, userId)
	}

	counts := &model.ChannelCounts{
		Counts:      make(map[string]int64),
		CountsRoot:  make(map[string]int64),
		UpdateTimes: make(map[string]int64),
	}
	for i := range data {
		v := data[i]
		counts.Counts[v.Id] = v.TotalMsgCount
		counts.CountsRoot[v.Id] = v.TotalMsgCountRoot
		counts.UpdateTimes[v.Id] = v.UpdateAt
	}

	return counts, nil
}

func (s SqlChannelStore) GetTeamChannels(teamId string) (model.ChannelList, error) {
	data := model.ChannelList{}
	err := s.GetReplicaX().Select(&data, "SELECT * FROM Channels WHERE TeamId = ? And Type != 'D' ORDER BY DisplayName", teamId)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Channels with teamId=%s", teamId)
	}

	if len(data) == 0 {
		return nil, store.NewErrNotFound("Channel", fmt.Sprintf("teamId=%s", teamId))
	}

	return data, nil
}

func (s SqlChannelStore) GetByName(teamId string, name string, allowFromCache bool) (*model.Channel, error) {
	return s.getByName(teamId, name, false, allowFromCache)
}

func (s SqlChannelStore) GetByNames(teamId string, names []string, allowFromCache bool) ([]*model.Channel, error) {
	var channels []*model.Channel

	if allowFromCache {
		var misses []string
		visited := make(map[string]struct{})
		for _, name := range names {
			if _, ok := visited[name]; ok {
				continue
			}
			visited[name] = struct{}{}
			var cacheItem *model.Channel
			if err := channelByNameCache.Get(teamId+name, &cacheItem); err == nil {
				channels = append(channels, cacheItem)
			} else {
				misses = append(misses, name)
			}
		}
		names = misses
	}

	if len(names) > 0 {
		builder := s.getQueryBuilder().
			Select("*").
			From("Channels").
			Where(
				sq.And{
					sq.Eq{"Name": names},
					sq.Eq{"DeleteAt": 0},
				},
			)

		if teamId != "" {
			builder = builder.Where(sq.Eq{"TeamId": teamId})
		}

		query, args, err := builder.ToSql()
		if err != nil {
			return nil, errors.Wrap(err, "GetByNames_tosql")
		}

		dbChannels := []*model.Channel{}
		if err := s.GetReplicaX().Select(&dbChannels, query, args...); err != nil && err != sql.ErrNoRows {
			msg := fmt.Sprintf("failed to get channels with names=%v", names)
			if teamId != "" {
				msg += fmt.Sprintf("teamId=%s", teamId)
			}
			return nil, errors.Wrap(err, msg)
		}
		for _, channel := range dbChannels {
			channelByNameCache.SetWithExpiry(teamId+channel.Name, channel, ChannelCacheDuration)
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

func (s SqlChannelStore) GetByNameIncludeDeleted(teamId string, name string, allowFromCache bool) (*model.Channel, error) {
	return s.getByName(teamId, name, true, allowFromCache)
}

func (s SqlChannelStore) getByName(teamId string, name string, includeDeleted bool, allowFromCache bool) (*model.Channel, error) {
	var query string
	if includeDeleted {
		query = "SELECT * FROM Channels WHERE (TeamId = ? OR TeamId = '') AND Name = ?"
	} else {
		query = "SELECT * FROM Channels WHERE (TeamId = ? OR TeamId = '') AND Name = ? AND DeleteAt = 0"
	}
	channel := model.Channel{}

	if allowFromCache {
		var cacheItem *model.Channel
		if err := channelByNameCache.Get(teamId+name, &cacheItem); err == nil {
			if s.metrics != nil {
				s.metrics.IncrementMemCacheHitCounter("Channel By Name")
			}
			return cacheItem, nil
		}
		if s.metrics != nil {
			s.metrics.IncrementMemCacheMissCounter("Channel By Name")
		}
	}

	if err := s.GetReplicaX().Get(&channel, query, teamId, name); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Channel", fmt.Sprintf("TeamId=%s&Name=%s", teamId, name))
		}
		return nil, errors.Wrapf(err, "failed to find channel with TeamId=%s and Name=%s", teamId, name)
	}

	channelByNameCache.SetWithExpiry(teamId+name, &channel, ChannelCacheDuration)
	return &channel, nil
}

func (s SqlChannelStore) GetDeletedByName(teamId string, name string) (*model.Channel, error) {
	channel := model.Channel{}

	if err := s.GetReplicaX().Get(&channel, `SELECT *
			FROM Channels
			WHERE (TeamId = ? OR TeamId = '')
			AND Name = ?
			AND DeleteAt != 0`, teamId, name); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Channel", fmt.Sprintf("name=%s", name))
		}
		return nil, errors.Wrapf(err, "failed to get channel by teamId=%s and name=%s", teamId, name)
	}

	return &channel, nil
}

func (s SqlChannelStore) GetDeleted(teamId string, offset int, limit int, userId string) (model.ChannelList, error) {
	channels := model.ChannelList{}

	query := `
		SELECT * FROM Channels
		WHERE (TeamId = ? OR TeamId = '')
		AND DeleteAt != 0
		AND Type != 'P'
		UNION
			SELECT * FROM Channels
			WHERE (TeamId = ? OR TeamId = '')
			AND DeleteAt != 0
			AND Type = 'P'
			AND Id IN (SELECT ChannelId FROM ChannelMembers WHERE UserId = ?)
		ORDER BY DisplayName LIMIT ? OFFSET ?
	`

	if err := s.GetReplicaX().Select(&channels, query, teamId, teamId, userId, limit, offset); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Channel", fmt.Sprintf("TeamId=%s,UserId=%s", teamId, userId))
		}
		return nil, errors.Wrapf(err, "failed to get deleted channels with TeamId=%s and UserId=%s", teamId, userId)
	}

	return channels, nil
}

var channelMembersForTeamWithSchemeSelectQuery = `
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

var channelMembersWithSchemeSelectQuery = `
	SELECT
		ChannelMembers.*,
		COALESCE(Teams.DisplayName, '') TeamDisplayName,
		COALESCE(Teams.Name, '') TeamName,
		COALESCE(Teams.UpdateAt, 0) TeamUpdateAt,
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

func (s SqlChannelStore) SaveMultipleMembers(members []*model.ChannelMember) ([]*model.ChannelMember, error) {
	for _, member := range members {
		defer s.InvalidateAllChannelMembersForUser(member.UserId)
	}

	newMembers, err := s.saveMultipleMembers(members)
	if err != nil {
		return nil, err
	}

	return newMembers, nil
}

func (s SqlChannelStore) SaveMember(member *model.ChannelMember) (*model.ChannelMember, error) {
	newMembers, err := s.SaveMultipleMembers([]*model.ChannelMember{member})
	if err != nil {
		return nil, err
	}
	return newMembers[0], nil
}

func (s SqlChannelStore) saveMultipleMembers(members []*model.ChannelMember) ([]*model.ChannelMember, error) {
	newChannelMembers := map[string]int{}
	users := map[string]bool{}
	for _, member := range members {
		if val, ok := newChannelMembers[member.ChannelId]; val < 1 || !ok {
			newChannelMembers[member.ChannelId] = 1
		} else {
			newChannelMembers[member.ChannelId]++
		}
		users[member.UserId] = true

		member.PreSave()
		if err := member.IsValid(); err != nil { // TODO: this needs to return plain error in v6.
			return nil, err
		}
	}

	channels := []string{}
	for channel := range newChannelMembers {
		channels = append(channels, channel)
	}

	defaultChannelRolesByChannel := map[string]struct {
		Id    string
		Guest sql.NullString
		User  sql.NullString
		Admin sql.NullString
	}{}

	channelRolesQuery := s.getQueryBuilder().
		Select(
			"Channels.Id as Id",
			"ChannelScheme.DefaultChannelGuestRole as Guest",
			"ChannelScheme.DefaultChannelUserRole as User",
			"ChannelScheme.DefaultChannelAdminRole as Admin",
		).
		From("Channels").
		LeftJoin("Schemes ChannelScheme ON Channels.SchemeId = ChannelScheme.Id").
		Where(sq.Eq{"Channels.Id": channels})

	channelRolesSql, channelRolesArgs, err := channelRolesQuery.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channel_roles_tosql")
	}

	defaultChannelsRoles := []struct {
		Id    string
		Guest sql.NullString
		User  sql.NullString
		Admin sql.NullString
	}{}
	err = s.GetMasterX().Select(&defaultChannelsRoles, channelRolesSql, channelRolesArgs...)
	if err != nil {
		return nil, errors.Wrap(err, "default_channel_roles_select")
	}

	for _, defaultRoles := range defaultChannelsRoles {
		defaultChannelRolesByChannel[defaultRoles.Id] = defaultRoles
	}

	defaultTeamRolesByChannel := map[string]struct {
		Id    string
		Guest sql.NullString
		User  sql.NullString
		Admin sql.NullString
	}{}

	teamRolesQuery := s.getQueryBuilder().
		Select(
			"Channels.Id as Id",
			"TeamScheme.DefaultChannelGuestRole as Guest",
			"TeamScheme.DefaultChannelUserRole as User",
			"TeamScheme.DefaultChannelAdminRole as Admin",
		).
		From("Channels").
		LeftJoin("Teams ON Teams.Id = Channels.TeamId").
		LeftJoin("Schemes TeamScheme ON Teams.SchemeId = TeamScheme.Id").
		Where(sq.Eq{"Channels.Id": channels})

	teamRolesSql, teamRolesArgs, err := teamRolesQuery.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "team_roles_tosql")
	}

	defaultTeamsRoles := []struct {
		Id    string
		Guest sql.NullString
		User  sql.NullString
		Admin sql.NullString
	}{}
	err = s.GetMasterX().Select(&defaultTeamsRoles, teamRolesSql, teamRolesArgs...)
	if err != nil {
		return nil, errors.Wrap(err, "default_team_roles_select")
	}

	for _, defaultRoles := range defaultTeamsRoles {
		defaultTeamRolesByChannel[defaultRoles.Id] = defaultRoles
	}

	query := s.getQueryBuilder().Insert("ChannelMembers").Columns(channelMemberSliceColumns()...)
	for _, member := range members {
		query = query.Values(channelMemberToSlice(member)...)
	}

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channel_members_tosql")
	}

	if _, err := s.GetMasterX().Exec(sql, args...); err != nil {
		if IsUniqueConstraintError(err, []string{"ChannelId", "channelmembers_pkey", "PRIMARY"}) {
			return nil, store.NewErrConflict("ChannelMembers", err, "")
		}
		return nil, errors.Wrap(err, "channel_members_save")
	}

	newMembers := []*model.ChannelMember{}
	for _, member := range members {
		defaultTeamGuestRole := defaultTeamRolesByChannel[member.ChannelId].Guest.String
		defaultTeamUserRole := defaultTeamRolesByChannel[member.ChannelId].User.String
		defaultTeamAdminRole := defaultTeamRolesByChannel[member.ChannelId].Admin.String
		defaultChannelGuestRole := defaultChannelRolesByChannel[member.ChannelId].Guest.String
		defaultChannelUserRole := defaultChannelRolesByChannel[member.ChannelId].User.String
		defaultChannelAdminRole := defaultChannelRolesByChannel[member.ChannelId].Admin.String
		rolesResult := getChannelRoles(
			member.SchemeGuest, member.SchemeUser, member.SchemeAdmin,
			defaultTeamGuestRole, defaultTeamUserRole, defaultTeamAdminRole,
			defaultChannelGuestRole, defaultChannelUserRole, defaultChannelAdminRole,
			strings.Fields(member.ExplicitRoles),
		)
		newMember := *member
		newMember.SchemeGuest = rolesResult.schemeGuest
		newMember.SchemeUser = rolesResult.schemeUser
		newMember.SchemeAdmin = rolesResult.schemeAdmin
		newMember.Roles = strings.Join(rolesResult.roles, " ")
		newMember.ExplicitRoles = strings.Join(rolesResult.explicitRoles, " ")
		newMembers = append(newMembers, &newMember)
	}
	return newMembers, nil
}

func (s SqlChannelStore) saveMemberT(member *model.ChannelMember) (*model.ChannelMember, error) {
	members, err := s.saveMultipleMembers([]*model.ChannelMember{member})
	if err != nil {
		return nil, err
	}
	return members[0], nil
}

func (s SqlChannelStore) UpdateMultipleMembers(members []*model.ChannelMember) ([]*model.ChannelMember, error) {
	for _, member := range members {
		member.PreUpdate()

		if err := member.IsValid(); err != nil {
			return nil, err
		}
	}

	var transaction *sqlxTxWrapper
	var err error

	if transaction, err = s.GetMasterX().Beginx(); err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction)

	updatedMembers := []*model.ChannelMember{}
	for _, member := range members {
		if _, err := transaction.NamedExec(`UPDATE ChannelMembers
			SET Roles=:Roles,
			LastViewedAt=:LastViewedAt,
			MsgCount=:MsgCount,
			MentionCount=:MentionCount,
			NotifyProps=:NotifyProps,
			LastUpdateAt=:LastUpdateAt,
			SchemeUser=:SchemeUser,
			SchemeAdmin=:SchemeAdmin,
			SchemeGuest=:SchemeGuest,
			MentionCountRoot=:MentionCountRoot,
			MsgCountRoot=:MsgCountRoot
			WHERE ChannelId=:ChannelId AND UserId=:UserId`, NewChannelMemberFromModel(member)); err != nil {
			return nil, errors.Wrap(err, "failed to update ChannelMember")
		}

		// TODO: Get this out of the transaction when is possible
		var dbMember channelMemberWithSchemeRoles
		if err := transaction.Get(&dbMember, channelMembersForTeamWithSchemeSelectQuery+"WHERE ChannelMembers.ChannelId = ? AND ChannelMembers.UserId = ?", member.ChannelId, member.UserId); err != nil {
			if err == sql.ErrNoRows {
				return nil, store.NewErrNotFound("ChannelMember", fmt.Sprintf("channelId=%s, userId=%s", member.ChannelId, member.UserId))
			}
			return nil, errors.Wrapf(err, "failed to get ChannelMember with channelId=%s and userId=%s", member.ChannelId, member.UserId)
		}
		updatedMembers = append(updatedMembers, dbMember.ToModel())
	}

	if err := transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}
	return updatedMembers, nil
}

func (s SqlChannelStore) UpdateMember(member *model.ChannelMember) (*model.ChannelMember, error) {
	updatedMembers, err := s.UpdateMultipleMembers([]*model.ChannelMember{member})
	if err != nil {
		return nil, err
	}
	return updatedMembers[0], nil
}

func (s SqlChannelStore) UpdateMemberNotifyProps(channelID, userID string, props map[string]string) (*model.ChannelMember, error) {
	tx, err := s.GetMasterX().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(tx)

	if s.DriverName() == model.DatabaseDriverPostgres {
		_, err = tx.Exec(`UPDATE channelmembers
			SET notifyprops = notifyprops || ?::jsonb
			WHERE userid=? AND channelid=?`, model.MapToJSON(props), userID, channelID)
	} else {
		// It's difficult to construct a SQL query for MySQL
		// to handle a case of empty map. So we just ignore it.
		if len(props) > 0 {
			// unpack the keys and values to pass to MySQL.
			args, argString := constructMySQLJSONArgs(props)
			args = append(args, userID, channelID)

			// Example: UPDATE ChannelMembers
			// SET NotifyProps = JSON_SET(NotifyProps, '$.mark_unread', '"yes"' [, ...])
			// WHERE ...
			_, err = tx.Exec(`UPDATE ChannelMembers
				SET NotifyProps = JSON_SET(NotifyProps, `+argString+`)
				WHERE UserId=? AND ChannelId=?`, args...)
		}
	}
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update ChannelMember with channelID=%s and userID=%s", channelID, userID)
	}

	var dbMember channelMemberWithSchemeRoles
	if err2 := tx.Get(&dbMember, channelMembersForTeamWithSchemeSelectQuery+"WHERE ChannelMembers.ChannelId = ? AND ChannelMembers.UserId = ?", channelID, userID); err2 != nil {
		if err2 == sql.ErrNoRows {
			return nil, store.NewErrNotFound("ChannelMember", fmt.Sprintf("channelId=%s, userId=%s", channelID, userID))
		}
		return nil, errors.Wrapf(err2, "failed to get ChannelMember with channelId=%s and userId=%s", channelID, userID)
	}

	if err2 := tx.Commit(); err2 != nil {
		return nil, errors.Wrap(err2, "commit_transaction")
	}

	return dbMember.ToModel(), err
}

func (s SqlChannelStore) GetMembers(channelId string, offset, limit int) (model.ChannelMembers, error) {
	dbMembers := channelMemberWithSchemeRolesList{}
	err := s.GetReplicaX().Select(&dbMembers, channelMembersForTeamWithSchemeSelectQuery+"WHERE ChannelId = ? LIMIT ? OFFSET ?", channelId, limit, offset)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get ChannelMembers with channelId=%s", channelId)
	}

	return dbMembers.ToModel(), nil
}

func (s SqlChannelStore) GetChannelMembersTimezones(channelId string) ([]model.StringMap, error) {
	dbMembersTimezone := []model.StringMap{}
	err := s.GetReplicaX().Select(&dbMembersTimezone, `
		SELECT
			Users.Timezone
		FROM
			ChannelMembers
		LEFT JOIN
			Users  ON ChannelMembers.UserId = Id
		WHERE ChannelId = ?
	`, channelId)

	if err != nil {
		return nil, errors.Wrapf(err, "failed to find user timezones for users in channels with channelId=%s", channelId)
	}

	return dbMembersTimezone, nil
}

func (s SqlChannelStore) GetMember(ctx context.Context, channelId string, userId string) (*model.ChannelMember, error) {
	var dbMember channelMemberWithSchemeRoles

	if err := s.DBXFromContext(ctx).Get(&dbMember, channelMembersForTeamWithSchemeSelectQuery+"WHERE ChannelMembers.ChannelId = ? AND ChannelMembers.UserId = ?", channelId, userId); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("ChannelMember", fmt.Sprintf("channelId=%s, userId=%s", channelId, userId))
		}
		return nil, errors.Wrapf(err, "failed to get ChannelMember with channelId=%s and userId=%s", channelId, userId)
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
	var ids map[string]string
	if err := allChannelMembersForUserCache.Get(userId, &ids); err == nil {
		if s.metrics != nil {
			s.metrics.IncrementMemCacheHitCounter("All Channel Members for User")
		}
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

func (s SqlChannelStore) GetMemberForPost(postId string, userId string) (*model.ChannelMember, error) {
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
			ChannelMembers.UserId = ?
		AND
			Posts.Id = ?`
	if err := s.GetReplicaX().Get(&dbMember, query, userId, postId); err != nil {
		return nil, errors.Wrapf(err, "failed to get ChannelMember with postId=%s and userId=%s", postId, userId)
	}
	return dbMember.ToModel(), nil
}

func (s SqlChannelStore) GetAllChannelMembersForUser(userId string, allowFromCache bool, includeDeleted bool) (map[string]string, error) {
	cache_key := userId
	if includeDeleted {
		cache_key += "_deleted"
	}
	if allowFromCache {
		var ids map[string]string
		if err := allChannelMembersForUserCache.Get(cache_key, &ids); err == nil {
			if s.metrics != nil {
				s.metrics.IncrementMemCacheHitCounter("All Channel Members for User")
			}
			return ids, nil
		}
	}

	if s.metrics != nil {
		s.metrics.IncrementMemCacheMissCounter("All Channel Members for User")
	}

	query := s.getQueryBuilder().
		Select(`
				ChannelMembers.ChannelId, ChannelMembers.Roles, ChannelMembers.SchemeGuest,
				ChannelMembers.SchemeUser, ChannelMembers.SchemeAdmin,
				TeamScheme.DefaultChannelGuestRole TeamSchemeDefaultGuestRole,
				TeamScheme.DefaultChannelUserRole TeamSchemeDefaultUserRole,
				TeamScheme.DefaultChannelAdminRole TeamSchemeDefaultAdminRole,
				ChannelScheme.DefaultChannelGuestRole ChannelSchemeDefaultGuestRole,
				ChannelScheme.DefaultChannelUserRole ChannelSchemeDefaultUserRole,
				ChannelScheme.DefaultChannelAdminRole ChannelSchemeDefaultAdminRole
		`).
		From("ChannelMembers").
		Join("Channels ON ChannelMembers.ChannelId = Channels.Id").
		LeftJoin("Schemes ChannelScheme ON Channels.SchemeId = ChannelScheme.Id").
		LeftJoin("Teams ON Channels.TeamId = Teams.Id").
		LeftJoin("Schemes TeamScheme ON Teams.SchemeId = TeamScheme.Id").
		Where(sq.Eq{"ChannelMembers.UserId": userId})
	if !includeDeleted {
		query = query.Where(sq.Eq{"Channels.DeleteAt": 0})
	}
	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channel_tosql")
	}

	rows, err := s.GetReplicaX().DB.Query(queryString, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find ChannelMembers, TeamScheme and ChannelScheme data")
	}

	var data allChannelMembers
	defer rows.Close()
	for rows.Next() {
		var cm allChannelMember
		err = rows.Scan(
			&cm.ChannelId, &cm.Roles, &cm.SchemeGuest, &cm.SchemeUser,
			&cm.SchemeAdmin, &cm.TeamSchemeDefaultGuestRole, &cm.TeamSchemeDefaultUserRole,
			&cm.TeamSchemeDefaultAdminRole, &cm.ChannelSchemeDefaultGuestRole,
			&cm.ChannelSchemeDefaultUserRole, &cm.ChannelSchemeDefaultAdminRole,
		)
		if err != nil {
			return nil, errors.Wrap(err, "unable to scan columns")
		}
		data = append(data, cm)
	}
	if err = rows.Err(); err != nil {
		return nil, errors.Wrap(err, "error while iterating over rows")
	}
	ids := data.ToMapStringString()

	if allowFromCache {
		allChannelMembersForUserCache.SetWithExpiry(cache_key, ids, AllChannelMembersForUserCacheDuration)
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

func (s SqlChannelStore) GetAllChannelMembersNotifyPropsForChannel(channelId string, allowFromCache bool) (map[string]model.StringMap, error) {
	if allowFromCache {
		var cacheItem map[string]model.StringMap
		if err := allChannelMembersNotifyPropsForChannelCache.Get(channelId, &cacheItem); err == nil {
			if s.metrics != nil {
				s.metrics.IncrementMemCacheHitCounter("All Channel Members Notify Props for Channel")
			}
			return cacheItem, nil
		}
	}

	if s.metrics != nil {
		s.metrics.IncrementMemCacheMissCounter("All Channel Members Notify Props for Channel")
	}

	data := []allChannelMemberNotifyProps{}
	err := s.GetReplicaX().Select(&data, `
		SELECT UserId, NotifyProps
		FROM ChannelMembers
		WHERE ChannelId = ?`, channelId)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find data from ChannelMembers with channelId=%s", channelId)
	}

	props := make(map[string]model.StringMap)
	for i := range data {
		props[data[i].UserId] = data[i].NotifyProps
	}

	allChannelMembersNotifyPropsForChannelCache.SetWithExpiry(channelId, props, AllChannelMembersNotifyPropsForChannelCacheDuration)

	return props, nil
}

//nolint:unparam
func (s SqlChannelStore) InvalidateMemberCount(channelId string) {
}

func (s SqlChannelStore) GetMemberCountFromCache(channelId string) int64 {
	count, _ := s.GetMemberCount(channelId, true)
	return count
}

//nolint:unparam
func (s SqlChannelStore) GetMemberCount(channelId string, allowFromCache bool) (int64, error) {
	var count int64
	err := s.GetReplicaX().Get(&count, `
		SELECT
			count(*)
		FROM
			ChannelMembers,
			Users
		WHERE
			ChannelMembers.UserId = Users.Id
			AND ChannelMembers.ChannelId = ?
			AND Users.DeleteAt = 0`, channelId)
	if err != nil {
		return 0, errors.Wrapf(err, "failed to count ChanenelMembers with channelId=%s", channelId)
	}

	return count, nil
}

// GetMemberCountsByGroup returns a slice of ChannelMemberCountByGroup for a given channel
// which contains the number of channel members for each group and optionally the number of unique timezones present for each group in the channel
func (s SqlChannelStore) GetMemberCountsByGroup(ctx context.Context, channelID string, includeTimezones bool) ([]*model.ChannelMemberCountByGroup, error) {
	selectStr := "GroupMembers.GroupId, COUNT(ChannelMembers.UserId) AS ChannelMemberCount"

	if includeTimezones {
		if s.DriverName() == model.DatabaseDriverMysql {
			selectStr += `,
				COUNT(DISTINCT
				(
					CASE WHEN Timezone->"$.useAutomaticTimezone" = 'true' AND LENGTH(JSON_UNQUOTE(Timezone->"$.automaticTimezone")) > 0
					THEN Timezone->"$.automaticTimezone"
					WHEN Timezone->"$.useAutomaticTimezone" = 'false' AND LENGTH(JSON_UNQUOTE(Timezone->"$.manualTimezone")) > 0
					THEN Timezone->"$.manualTimezone"
					END
				)) AS ChannelMemberTimezonesCount`
		} else if s.DriverName() == model.DatabaseDriverPostgres {
			selectStr += `,
				COUNT(DISTINCT
				(
					CASE WHEN Timezone->>'useAutomaticTimezone' = 'true' AND length(Timezone->>'automaticTimezone') > 0
					THEN Timezone->>'automaticTimezone'
					WHEN Timezone->>'useAutomaticTimezone' = 'false' AND length(Timezone->>'manualTimezone') > 0
					THEN Timezone->>'manualTimezone'
					END
				)) AS ChannelMemberTimezonesCount`
		}
	}

	query := s.getQueryBuilder().
		Select(selectStr).
		From("ChannelMembers").
		Join("GroupMembers ON GroupMembers.UserId = ChannelMembers.UserId")

	if includeTimezones {
		query = query.Join("Users ON Users.Id = GroupMembers.UserId")
	}

	query = query.Where(sq.Eq{"ChannelMembers.ChannelId": channelID}).GroupBy("GroupMembers.GroupId")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channel_tosql")
	}

	data := []*model.ChannelMemberCountByGroup{}
	if err := s.DBXFromContext(ctx).Select(&data, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to count ChannelMembers with channelId=%s", channelID)
	}

	return data, nil
}

//nolint:unparam
func (s SqlChannelStore) InvalidatePinnedPostCount(channelId string) {
}

//nolint:unparam
func (s SqlChannelStore) GetPinnedPostCount(channelId string, allowFromCache bool) (int64, error) {
	var count int64
	err := s.GetReplicaX().Get(&count, `
		SELECT count(*)
			FROM Posts
		WHERE
			IsPinned = true
			AND ChannelId = ?
			AND DeleteAt = 0`, channelId)

	if err != nil {
		return 0, errors.Wrapf(err, "failed to count pinned Posts with channelId=%s", channelId)
	}

	return count, nil
}

//nolint:unparam
func (s SqlChannelStore) InvalidateGuestCount(channelId string) {
}

//nolint:unparam
func (s SqlChannelStore) GetGuestCount(channelId string, allowFromCache bool) (int64, error) {
	var indexHint string
	if s.DriverName() == model.DatabaseDriverMysql {
		indexHint = `USE INDEX(idx_channelmembers_channel_id_scheme_guest_user_id)`
	}
	var count int64
	err := s.GetReplicaX().Get(&count, `
		SELECT
			count(*)
		FROM
			ChannelMembers `+indexHint+`,
			Users
		WHERE
			ChannelMembers.UserId = Users.Id
			AND ChannelMembers.ChannelId = ?
			AND ChannelMembers.SchemeGuest = TRUE
			AND Users.DeleteAt = 0`, channelId)
	if err != nil {
		return 0, errors.Wrapf(err, "failed to count Guests with channelId=%s", channelId)
	}
	return count, nil
}

func (s SqlChannelStore) RemoveMembers(channelId string, userIds []string) error {
	builder := s.getQueryBuilder().
		Delete("ChannelMembers").
		Where(sq.Eq{"ChannelId": channelId}).
		Where(sq.Eq{"UserId": userIds})
	query, args, err := builder.ToSql()
	if err != nil {
		return errors.Wrap(err, "channel_tosql")
	}
	_, err = s.GetMasterX().Exec(query, args...)
	if err != nil {
		return errors.Wrap(err, "failed to delete ChannelMembers")
	}

	// cleanup sidebarchannels table if the user is no longer a member of that channel
	query, args, err = s.getQueryBuilder().
		Delete("SidebarChannels").
		Where(sq.And{
			sq.Eq{"ChannelId": channelId},
			sq.Eq{"UserId": userIds},
		}).ToSql()
	if err != nil {
		return errors.Wrap(err, "channel_tosql")
	}
	_, err = s.GetMasterX().Exec(query, args...)
	if err != nil {
		return errors.Wrap(err, "failed to delete SidebarChannels")
	}
	return nil
}

func (s SqlChannelStore) RemoveMember(channelId string, userId string) error {
	return s.RemoveMembers(channelId, []string{userId})
}

func (s SqlChannelStore) RemoveAllDeactivatedMembers(channelId string) error {
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
			ChannelMembers.ChannelId = ?
	`

	_, err := s.GetMasterX().Exec(query, channelId)
	if err != nil {
		return errors.Wrapf(err, "failed to delete ChannelMembers with channelId=%s", channelId)
	}
	return nil
}

func (s SqlChannelStore) PermanentDeleteMembersByUser(userId string) error {
	if _, err := s.GetMasterX().Exec("DELETE FROM ChannelMembers WHERE UserId = ?", userId); err != nil {
		return errors.Wrapf(err, "failed to permanent delete ChannelMembers with userId=%s", userId)
	}
	return nil
}

// TODO: convert to squirrel (https://github.com/mattermost/mattermost-server/issues/19332)
func (s SqlChannelStore) UpdateLastViewedAt(channelIds []string, userId string, updateThreads bool) (map[string]int64, error) {
	var threadsToUpdate []string
	now := model.GetMillis()
	if updateThreads {
		var err error
		threadsToUpdate, err = s.Thread().CollectThreadsWithNewerReplies(userId, channelIds, now)
		if err != nil {
			return nil, err
		}
	}

	keys, props := MapStringsToQueryParams(channelIds, "Channel")
	props["UserId"] = userId

	var lastPostAtTimes []struct {
		Id                string
		LastPostAt        int64
		TotalMsgCount     int64
		TotalMsgCountRoot int64
	}

	query := `SELECT Id, LastPostAt, TotalMsgCount, TotalMsgCountRoot FROM Channels WHERE Id IN ` + keys
	// TODO: use a CTE for mysql too when version 8 becomes the minimum supported version.
	if s.DriverName() == model.DatabaseDriverPostgres {
		query = `WITH c AS ( ` + query + `),
	updated AS (
	UPDATE
		ChannelMembers cm
	SET
		MentionCount = 0,
		MentionCountRoot = 0,
		MsgCount = greatest(cm.MsgCount, c.TotalMsgCount),
		MsgCountRoot = greatest(cm.MsgCountRoot, c.TotalMsgCountRoot),
		LastViewedAt = greatest(cm.LastViewedAt, c.LastPostAt),
		LastUpdateAt = greatest(cm.LastViewedAt, c.LastPostAt)
	FROM c
		WHERE cm.UserId = :UserId
		AND c.Id=cm.ChannelId
)
	SELECT Id, LastPostAt FROM c`
	}

	_, err := s.GetMaster().Select(&lastPostAtTimes, query, props)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find ChannelMembers data with userId=%s and channelId in %v", userId, channelIds)
	}

	if len(lastPostAtTimes) == 0 {
		return nil, store.NewErrInvalidInput("Channel", "Id", fmt.Sprintf("%v", channelIds))
	}

	times := map[string]int64{}
	if s.DriverName() == model.DatabaseDriverPostgres {
		for _, t := range lastPostAtTimes {
			times[t.Id] = t.LastPostAt
		}
		if updateThreads {
			s.Thread().UpdateUnreadsByChannel(userId, threadsToUpdate, now, true)
		}
		return times, nil
	}

	msgCountQuery := ""
	msgCountQueryRoot := ""
	lastViewedQuery := ""

	for index, t := range lastPostAtTimes {
		times[t.Id] = t.LastPostAt

		props["msgCount"+strconv.Itoa(index)] = t.TotalMsgCount
		msgCountQuery += fmt.Sprintf("WHEN :channelId%d THEN GREATEST(MsgCount, :msgCount%d) ", index, index)

		props["msgCountRoot"+strconv.Itoa(index)] = t.TotalMsgCountRoot
		msgCountQueryRoot += fmt.Sprintf("WHEN :channelId%d THEN GREATEST(MsgCountRoot, :msgCountRoot%d) ", index, index)

		props["lastViewed"+strconv.Itoa(index)] = t.LastPostAt
		lastViewedQuery += fmt.Sprintf("WHEN :channelId%d THEN GREATEST(LastViewedAt, :lastViewed%d) ", index, index)

		props["channelId"+strconv.Itoa(index)] = t.Id
	}

	updateQuery := `UPDATE
			ChannelMembers
		SET
			MentionCount = 0,
			MentionCountRoot = 0,
			MsgCount = CASE ChannelId ` + msgCountQuery + ` END,
			MsgCountRoot = CASE ChannelId ` + msgCountQueryRoot + ` END,
			LastViewedAt = CASE ChannelId ` + lastViewedQuery + ` END,
			LastUpdateAt = LastViewedAt
		WHERE
				UserId = :UserId
				AND ChannelId IN ` + keys

	if _, err := s.GetMaster().Exec(updateQuery, props); err != nil {
		return nil, errors.Wrapf(err, "failed to update ChannelMembers with userId=%s and channelId in %v", userId, channelIds)
	}

	if updateThreads {
		s.Thread().UpdateUnreadsByChannel(userId, threadsToUpdate, now, true)
	}
	return times, nil
}

// CountPostsAfter returns the number of posts in the given channel created after but not including the given timestamp. If given a non-empty user ID, only counts posts made by that user.
func (s SqlChannelStore) CountPostsAfter(channelId string, timestamp int64, userId string) (int, int, error) {
	joinLeavePostTypes := []string{
		// These types correspond to the ones checked by Post.IsJoinLeaveMessage
		model.PostTypeJoinLeave,
		model.PostTypeAddRemove,
		model.PostTypeJoinChannel,
		model.PostTypeLeaveChannel,
		model.PostTypeJoinTeam,
		model.PostTypeLeaveTeam,
		model.PostTypeAddToChannel,
		model.PostTypeRemoveFromChannel,
		model.PostTypeAddToTeam,
		model.PostTypeRemoveFromTeam,
	}
	query := s.getQueryBuilder().
		Select("count(*)").
		From("Posts").
		Where(sq.And{
			sq.Eq{"ChannelId": channelId},
			sq.Gt{"CreateAt": timestamp},
			sq.NotEq{"Type": joinLeavePostTypes},
			sq.Eq{"DeleteAt": 0},
		})

	if userId != "" {
		query = query.Where(sq.Eq{"UserId": userId})
	}
	sql, args, _ := query.ToSql()

	var unread int64
	err := s.GetReplicaX().Get(&unread, sql, args...)
	if err != nil {
		return 0, 0, errors.Wrap(err, "failed to count Posts")
	}
	sql2, args2, _ := query.Where(sq.Eq{"RootId": ""}).ToSql()

	var unreadRoot int64
	err = s.GetReplicaX().Get(&unreadRoot, sql2, args2...)
	if err != nil {
		return 0, 0, errors.Wrap(err, "failed to count root Posts")
	}
	return int(unread), int(unreadRoot), nil
}

// UpdateLastViewedAtPost updates a ChannelMember as if the user last read the channel at the time of the given post.
// If the provided mentionCount is -1, the given post and all posts after it are considered to be mentions. Returns
// an updated model.ChannelUnreadAt that can be returned to the client.
func (s SqlChannelStore) UpdateLastViewedAtPost(unreadPost *model.Post, userID string, mentionCount, mentionCountRoot int, updateThreads bool, setUnreadCountRoot bool) (*model.ChannelUnreadAt, error) {
	var threadsToUpdate []string
	unreadDate := unreadPost.CreateAt - 1
	if updateThreads {
		var err error
		threadsToUpdate, err = s.Thread().CollectThreadsWithNewerReplies(userID, []string{unreadPost.ChannelId}, unreadDate)
		if err != nil {
			return nil, err
		}
	}

	unread, unreadRoot, err := s.CountPostsAfter(unreadPost.ChannelId, unreadDate, "")
	if err != nil {
		return nil, err
	}

	if !setUnreadCountRoot {
		unreadRoot = 0
	}

	params := map[string]interface{}{
		"mentions":        mentionCount,
		"mentionsroot":    mentionCountRoot,
		"unreadcount":     unread,
		"unreadcountroot": unreadRoot,
		"lastviewedat":    unreadDate,
		"userid":          userID,
		"channelid":       unreadPost.ChannelId,
		"updatedat":       model.GetMillis(),
	}

	// msg count uses the value from channels to prevent counting on older channels where no. of messages can be high.
	// we only count the unread which will be a lot less in 99% cases
	setUnreadQuery := `
	UPDATE
		ChannelMembers
	SET
		MentionCount = :mentions,
		MentionCountRoot = :mentionsroot,
		MsgCount = (SELECT TotalMsgCount FROM Channels WHERE ID = :channelid) - :unreadcount,
		MsgCountRoot = (SELECT TotalMsgCountRoot FROM Channels WHERE ID = :channelid) - :unreadcountroot,
		LastViewedAt = :lastviewedat,
		LastUpdateAt = :updatedat
	WHERE
		UserId = :userid
		AND ChannelId = :channelid
	`
	_, err = s.GetMasterX().NamedExec(setUnreadQuery, params)
	if err != nil {
		return nil, errors.Wrap(err, "failed to update ChannelMembers")
	}

	chanUnreadQuery := `
	SELECT
		c.TeamId TeamId,
		cm.UserId UserId,
		cm.ChannelId ChannelId,
		cm.MsgCount MsgCount,
		cm.MsgCountRoot MsgCountRoot,
		cm.MentionCount MentionCount,
		cm.MentionCountRoot MentionCountRoot,
		cm.LastViewedAt LastViewedAt,
		cm.NotifyProps NotifyProps
	FROM
		ChannelMembers cm
	LEFT JOIN Channels c ON c.Id=cm.ChannelId
	WHERE
		cm.UserId = ?
		AND cm.channelId = ?
		AND c.DeleteAt = 0
	`
	result := &model.ChannelUnreadAt{}
	if err = s.GetMasterX().Get(result, chanUnreadQuery, userID, unreadPost.ChannelId); err != nil {
		return nil, errors.Wrapf(err, "failed to get ChannelMember with channelId=%s", unreadPost.ChannelId)
	}

	if updateThreads {
		s.Thread().UpdateUnreadsByChannel(userID, threadsToUpdate, unreadDate, false)
	}
	return result, nil
}

func (s SqlChannelStore) IncrementMentionCount(channelId string, userId string, updateThreads, isRoot bool) error {
	now := model.GetMillis()
	var threadsToUpdate []string
	if updateThreads {
		var err error
		threadsToUpdate, err = s.Thread().CollectThreadsWithNewerReplies(userId, []string{channelId}, now)
		if err != nil {
			return err
		}
	}
	rootInc := 0
	if isRoot {
		rootInc = 1
	}
	_, err := s.GetMasterX().Exec(
		`UPDATE
			ChannelMembers
		SET
			MentionCount = MentionCount + 1,
			MentionCountRoot = MentionCountRoot + ?,
			LastUpdateAt = ?
		WHERE
			UserId = ?
			AND ChannelId = ?`, rootInc, now, userId, channelId)
	if err != nil {
		return errors.Wrapf(err, "failed to Update ChannelMembers with channelId=%s and userId=%s", channelId, userId)
	}
	if updateThreads {
		s.Thread().UpdateUnreadsByChannel(userId, threadsToUpdate, now, false)
	}
	return nil
}

func (s SqlChannelStore) GetAll(teamId string) ([]*model.Channel, error) {
	data := []*model.Channel{}
	err := s.GetReplicaX().Select(&data, "SELECT * FROM Channels WHERE TeamId = ? AND Type != 'D' ORDER BY Name", teamId)

	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Channels with teamId=%s", teamId)
	}

	return data, nil
}

func (s SqlChannelStore) GetChannelsByIds(channelIds []string, includeDeleted bool) ([]*model.Channel, error) {
	query := s.getQueryBuilder().
		Select("*").
		From("Channels").
		Where(sq.Eq{"Id": channelIds}).
		OrderBy("Name")

	if !includeDeleted {
		query = query.Where(sq.Eq{"DeleteAt": 0})
	}

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "GetChannelsByIds_tosql")
	}

	channels := []*model.Channel{}
	err = s.GetReplicaX().Select(&channels, sql, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Channels")
	}
	return channels, nil
}

func (s SqlChannelStore) GetChannelsWithTeamDataByIds(channelIDs []string, includeDeleted bool) ([]*model.ChannelWithTeamData, error) {
	query := s.getQueryBuilder().
		Select("c.*",
			"COALESCE(t.DisplayName, '') As TeamDisplayName",
			"COALESCE(t.Name, '') AS TeamName",
			"COALESCE(t.UpdateAt, 0) AS TeamUpdateAt").
		From("Channels c").
		LeftJoin("Teams t ON c.TeamId = t.Id").
		Where(sq.Eq{"c.Id": channelIDs}).
		OrderBy("c.Name")

	if !includeDeleted {
		query = query.Where(sq.Eq{"c.DeleteAt": 0})
	}

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "getChannelsWithTeamData_tosql")
	}

	channels := []*model.ChannelWithTeamData{}
	err = s.GetReplicaX().Select(&channels, sql, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Channels")
	}
	return channels, nil
}

func (s SqlChannelStore) GetForPost(postId string) (*model.Channel, error) {
	channel := model.Channel{}
	if err := s.GetReplicaX().Get(
		&channel,
		`SELECT
			Channels.*
		FROM
			Channels,
			Posts
		WHERE
			Channels.Id = Posts.ChannelId
			AND Posts.Id = ?`, postId); err != nil {
		return nil, errors.Wrapf(err, "failed to get Channel with postId=%s", postId)

	}
	return &channel, nil
}

func (s SqlChannelStore) AnalyticsTypeCount(teamId string, channelType model.ChannelType) (int64, error) {

	query := s.getQueryBuilder().
		Select("COUNT(Id) AS Value").
		From("Channels").
		Where(sq.Eq{"Type": channelType})

	if teamId != "" {
		query = query.Where(sq.Eq{"TeamId": teamId})
	}

	sql, args, err := query.ToSql()
	if err != nil {
		return int64(0), errors.Wrap(err, "AnalyticsTypeCount_tosql")
	}

	var value int64
	err = s.GetReplicaX().Get(&value, sql, args...)
	if err != nil {
		return int64(0), errors.Wrap(err, "failed to count Channels")
	}
	return value, nil
}

func (s SqlChannelStore) AnalyticsDeletedTypeCount(teamId string, channelType string) (int64, error) {
	query := s.getQueryBuilder().
		Select("COUNT(Id) AS Value").
		From("Channels").
		Where(sq.And{
			sq.Eq{"Type": channelType},
			sq.Gt{"DeleteAt": 0},
		})

	if teamId != "" {
		query = query.Where(sq.Eq{"TeamId": teamId})
	}

	sql, args, err := query.ToSql()
	if err != nil {
		return int64(0), errors.Wrap(err, "AnalyticsDeletedTypeCount_tosql")
	}

	var v int64
	err = s.GetReplicaX().Get(&v, sql, args...)
	if err != nil {
		return 0, errors.Wrapf(err, "failed to count Channels with teamId=%s and channelType=%s", teamId, channelType)
	}

	return v, nil
}

func (s SqlChannelStore) GetMembersForUser(teamId string, userId string) (model.ChannelMembers, error) {
	dbMembers := channelMemberWithSchemeRolesList{}
	err := s.GetReplicaX().Select(&dbMembers, channelMembersForTeamWithSchemeSelectQuery+"WHERE ChannelMembers.UserId = ? AND (Teams.Id = ? OR Teams.Id = '' OR Teams.Id IS NULL)", userId, teamId)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find ChannelMembers data with teamId=%s and userId=%s", teamId, userId)
	}

	return dbMembers.ToModel(), nil
}

func (s SqlChannelStore) GetMembersForUserWithPagination(userId string, page, perPage int) (model.ChannelMembersWithTeamData, error) {
	dbMembers := channelMemberWithTeamWithSchemeRolesList{}
	offset := page * perPage
	err := s.GetReplicaX().Select(&dbMembers, channelMembersWithSchemeSelectQuery+"WHERE ChannelMembers.UserId = ? ORDER BY ChannelId ASC Limit ? Offset ?", userId, perPage, offset)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find ChannelMembers data with and userId=%s", userId)
	}

	return dbMembers.ToModel(), nil
}

func (s SqlChannelStore) GetTeamMembersForChannel(channelID string) ([]string, error) {
	teamMemberIDs := []string{}
	if err := s.GetReplicaX().Select(&teamMemberIDs, `SELECT tm.UserId
		FROM Channels c, Teams t, TeamMembers tm
		WHERE
			c.TeamId=t.Id
			AND
			t.Id=tm.TeamId
			AND
			c.Id = ?`,
		channelID); err != nil {
		return nil, errors.Wrapf(err, "error while getting team members for a channel")
	}

	return teamMemberIDs, nil
}

// TODO: rewrite in squirrel (https://github.com/mattermost/mattermost-server/issues/19333)
func (s SqlChannelStore) Autocomplete(userID, term string, includeDeleted bool) (model.ChannelListWithTeamData, error) {
	deleteFilter := "AND c.DeleteAt = 0"
	if includeDeleted {
		deleteFilter = ""
	}

	return s.performGlobalSearch(`
	SELECT
		c.*, t.DisplayName AS TeamDisplayName, t.Name AS TeamName, t.UpdateAt AS TeamUpdateAt
	FROM
		Channels c, Teams t, TeamMembers tm
	WHERE
		c.TeamId=t.Id
		AND
		t.Id=tm.TeamId
		AND
		tm.UserId = :UserId
		`+deleteFilter+`
		SEARCH_CLAUSE
		AND (
			c.Type != 'P'
			OR (
				c.Type = 'P'
				AND c.Id IN (SELECT ChannelId FROM ChannelMembers WHERE UserId = :UserId)
			)
		)
	ORDER BY c.DisplayName
	`, term, map[string]interface{}{
		"UserId": userID,
	})
}

// TODO: rewrite in squirrel (https://github.com/mattermost/mattermost-server/issues/19333)
func (s SqlChannelStore) AutocompleteInTeam(teamID, userID, term string, includeDeleted bool) (model.ChannelList, error) {
	deleteFilter := "AND c.DeleteAt = 0"
	if includeDeleted {
		deleteFilter = ""
	}

	return s.performSearch(`
	SELECT
		*
	FROM
		Channels c
	WHERE
		c.TeamId = :TeamId
		`+deleteFilter+`
		SEARCH_CLAUSE
		AND (
			c.Type != 'P'
			OR (
				c.Type = 'P'
				AND c.Id IN (SELECT ChannelId FROM ChannelMembers WHERE UserId = :UserId)
			)
		)
	ORDER BY c.DisplayName
	LIMIT :Limit
	`, term, map[string]interface{}{
		"TeamId": teamID,
		"UserId": userID,
		"Limit":  model.ChannelSearchDefaultLimit,
	})
}

// TODO: rewrite in squirrel (https://github.com/mattermost/mattermost-server/issues/19334)
func (s SqlChannelStore) AutocompleteInTeamForSearch(teamId string, userId string, term string, includeDeleted bool) (model.ChannelList, error) {
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
			return nil, errors.Wrapf(err, "failed to find Channels with term='%s'", term)
		}
	} else {
		// Using a UNION results in index_merge and fulltext queries and is much faster than the ref
		// query you would get using an OR of the LIKE and full-text clauses.
		fulltextClause, fulltextTerm := s.buildFulltextClause(term, "Name, DisplayName, Purpose")
		likeQuery := fmt.Sprintf(queryFormat, "AND "+likeClause)
		fulltextQuery := fmt.Sprintf(queryFormat, "AND "+fulltextClause)
		query := fmt.Sprintf("(%v) UNION (%v) LIMIT 50", likeQuery, fulltextQuery)

		if _, err := s.GetReplica().Select(&channels, query, map[string]interface{}{"TeamId": teamId, "UserId": userId, "LikeTerm": likeTerm, "FulltextTerm": fulltextTerm}); err != nil {
			return nil, errors.Wrapf(err, "failed to find Channels with term='%s'", term)
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
	return channels, nil
}

// TODO: rewrite in squirrel (https://github.com/mattermost/mattermost-server/issues/19334)
func (s SqlChannelStore) autocompleteInTeamForSearchDirectMessages(userId string, term string) ([]*model.Channel, error) {
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
			return nil, errors.Wrapf(err, "failed to find Channels with term='%s'", term)
		}
	} else {
		query := fmt.Sprintf(queryFormat, "AND "+likeClause)

		if _, err := s.GetReplica().Select(&channels, query, map[string]interface{}{"UserId": userId, "LikeTerm": likeTerm}); err != nil {
			return nil, errors.Wrapf(err, "failed to find Channels with term='%s'", term)
		}
	}

	return channels, nil
}

// TODO: rewrite in squirrel (https://github.com/mattermost/mattermost-server/issues/19333)
func (s SqlChannelStore) SearchInTeam(teamId string, term string, includeDeleted bool) (model.ChannelList, error) {
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

// TODO: rewrite in squirrel (https://github.com/mattermost/mattermost-server/issues/19334)
func (s SqlChannelStore) SearchArchivedInTeam(teamId string, term string, userId string) (model.ChannelList, error) {
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

	outputErr := publicErr
	if privateErr != nil {
		outputErr = privateErr
	}

	if outputErr != nil {
		return nil, outputErr
	}

	output := publicChannels
	output = append(output, privateChannels...)

	return output, nil
}

// TODO: rewrite in squirrel (https://github.com/mattermost/mattermost-server/issues/19334)
func (s SqlChannelStore) SearchForUserInTeam(userId string, teamId string, term string, includeDeleted bool) (model.ChannelList, error) {
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

func (s SqlChannelStore) channelSearchQuery(opts *store.ChannelSearchOpts) sq.SelectBuilder {
	var limit int
	if opts.PerPage != nil {
		limit = *opts.PerPage
	} else {
		limit = 100
	}

	var selectStr string
	if opts.CountOnly {
		selectStr = "count(*)"
	} else {
		selectStr = "c.*"
		if opts.IncludeTeamInfo {
			selectStr += ", t.DisplayName AS TeamDisplayName, t.Name AS TeamName, t.UpdateAt as TeamUpdateAt"
		}
		if opts.IncludePolicyID {
			selectStr += ", RetentionPoliciesChannels.PolicyId"
		}
	}

	query := s.getQueryBuilder().
		Select(selectStr).
		From("Channels AS c").
		Join("Teams AS t ON t.Id = c.TeamId")

	// don't bother ordering or limiting if we're just getting the count
	if !opts.CountOnly {
		query = query.
			OrderBy("c.DisplayName, t.DisplayName").
			Limit(uint64(limit))
	}
	if opts.Deleted {
		query = query.Where(sq.NotEq{"c.DeleteAt": int(0)})
	} else if !opts.IncludeDeleted {
		query = query.Where(sq.Eq{"c.DeleteAt": int(0)})
	}

	if opts.IsPaginated() && !opts.CountOnly {
		query = query.Offset(uint64(*opts.Page * *opts.PerPage))
	}

	if opts.PolicyID != "" {
		query = query.
			InnerJoin("RetentionPoliciesChannels ON c.Id = RetentionPoliciesChannels.ChannelId").
			Where(sq.Eq{"RetentionPoliciesChannels.PolicyId": opts.PolicyID})
	} else if opts.ExcludePolicyConstrained {
		query = query.
			LeftJoin("RetentionPoliciesChannels ON c.Id = RetentionPoliciesChannels.ChannelId").
			Where("RetentionPoliciesChannels.ChannelId IS NULL")
	} else if opts.IncludePolicyID {
		query = query.
			LeftJoin("RetentionPoliciesChannels ON c.Id = RetentionPoliciesChannels.ChannelId")
	}

	likeClause, likeTerm := s.buildLIKEClause(opts.Term, "c.Name, c.DisplayName, c.Purpose")
	if likeTerm != "" {
		likeClause = strings.ReplaceAll(likeClause, ":LikeTerm", "?")
		fulltextClause, fulltextTerm := s.buildFulltextClause(opts.Term, "c.Name, c.DisplayName, c.Purpose")
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

	if opts.NotAssociatedToGroup != "" {
		query = query.Where("c.Id NOT IN (SELECT ChannelId FROM GroupChannels WHERE GroupChannels.GroupId = ? AND GroupChannels.DeleteAt = 0)", opts.NotAssociatedToGroup)
	}

	if len(opts.TeamIds) > 0 {
		query = query.Where(sq.Eq{"c.TeamId": opts.TeamIds})
	}

	if opts.GroupConstrained {
		query = query.Where(sq.Eq{"c.GroupConstrained": true})
	} else if opts.ExcludeGroupConstrained {
		query = query.Where(sq.Or{
			sq.NotEq{"c.GroupConstrained": true},
			sq.Eq{"c.GroupConstrained": nil},
		})
	}

	if opts.Public && !opts.Private {
		query = query.InnerJoin("PublicChannels ON c.Id = PublicChannels.Id")
	} else if opts.Private && !opts.Public {
		query = query.Where(sq.Eq{"c.Type": model.ChannelTypePrivate})
	} else {
		query = query.Where(sq.Or{
			sq.Eq{"c.Type": model.ChannelTypeOpen},
			sq.Eq{"c.Type": model.ChannelTypePrivate},
		})
	}

	return query
}

func (s SqlChannelStore) SearchAllChannels(term string, opts store.ChannelSearchOpts) (model.ChannelListWithTeamData, int64, error) {
	opts.Term = term
	opts.IncludeTeamInfo = true
	queryString, args, err := s.channelSearchQuery(&opts).ToSql()
	if err != nil {
		return nil, 0, errors.Wrap(err, "channel_tosql")
	}
	channels := []*channelWithTeamDataInternal{}
	if err2 := s.GetReplicaX().Select(&channels, queryString, args...); err2 != nil {
		return nil, 0, errors.Wrapf(err2, "failed to find Channels with term='%s'", term)
	}

	var totalCount int64

	// only query a 2nd time for the count if the results are being requested paginated.
	if opts.IsPaginated() {
		opts.CountOnly = true
		queryString, args, err = s.channelSearchQuery(&opts).ToSql()
		if err != nil {
			return nil, 0, errors.Wrap(err, "channel_tosql")
		}
		if err2 := s.GetReplicaX().Get(&totalCount, queryString, args...); err2 != nil {
			return nil, 0, errors.Wrapf(err2, "failed to find Channels with term='%s'", term)
		}
	} else {
		totalCount = int64(len(channels))
	}

	return channelWithTeamDataSliceToModel(channels), totalCount, nil
}

// TODO: rewrite in squrrel
func (s SqlChannelStore) SearchMore(userId string, teamId string, term string) (model.ChannelList, error) {
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
		if s.DriverName() == model.DatabaseDriverPostgres {
			searchFields = append(searchFields, fmt.Sprintf("lower(%s) LIKE lower(%s) escape '*'", field, ":LikeTerm"))
		} else {
			searchFields = append(searchFields, fmt.Sprintf("%s LIKE %s escape '*'", field, ":LikeTerm"))
		}
	}

	likeClause = fmt.Sprintf("(%s)", strings.Join(searchFields, " OR "))
	likeTerm = wildcardSearchTerm(likeTerm)
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
	if s.DriverName() == model.DatabaseDriverPostgres {
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
	} else if s.DriverName() == model.DatabaseDriverMysql {
		splitTerm := strings.Fields(fulltextTerm)
		for i, t := range strings.Fields(fulltextTerm) {
			splitTerm[i] = "+" + t + "*"
		}

		fulltextTerm = strings.Join(splitTerm, " ")

		fulltextClause = fmt.Sprintf("MATCH(%s) AGAINST (:FulltextTerm IN BOOLEAN MODE)", searchColumns)
	}

	return
}

func (s SqlChannelStore) performSearch(searchQuery string, term string, parameters map[string]interface{}) (model.ChannelList, error) {
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
		return nil, errors.Wrapf(err, "failed to find Channels with term='%s'", term)
	}

	return channels, nil
}

func (s SqlChannelStore) performGlobalSearch(searchQuery string, term string, parameters map[string]interface{}) (model.ChannelListWithTeamData, error) {
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

	var channels model.ChannelListWithTeamData

	if _, err := s.GetReplica().Select(&channels, searchQuery, parameters); err != nil {
		return nil, errors.Wrapf(err, "failed to find Channels with term='%s'", term)
	}

	return channels, nil
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
                        ` + strconv.Itoa(model.ChannelSearchDefaultLimit) + `
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
                ` + strconv.Itoa(model.ChannelSearchDefaultLimit)
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

// TODO: rewrite in squirrel (https://github.com/mattermost/mattermost-server/issues/19335)
func (s SqlChannelStore) SearchGroupChannels(userId, term string) (model.ChannelList, error) {
	isPostgreSQL := s.DriverName() == model.DatabaseDriverPostgres
	queryString, args := s.getSearchGroupChannelsQuery(userId, term, isPostgreSQL)

	var groupChannels model.ChannelList
	if _, err := s.GetReplica().Select(&groupChannels, queryString, args); err != nil {
		return nil, errors.Wrapf(err, "failed to find Channels with term='%s' and userId=%s", term, userId)
	}
	return groupChannels, nil
}

// TODO: rewrite in squirrel (https://github.com/mattermost/mattermost-server/issues/19336)
func (s SqlChannelStore) GetMembersByIds(channelId string, userIds []string) (model.ChannelMembers, error) {
	var dbMembers channelMemberWithSchemeRolesList

	keys, props := MapStringsToQueryParams(userIds, "User")
	props["ChannelId"] = channelId

	if _, err := s.GetReplica().Select(&dbMembers, channelMembersForTeamWithSchemeSelectQuery+"WHERE ChannelMembers.ChannelId = :ChannelId AND ChannelMembers.UserId IN "+keys, props); err != nil {
		return nil, errors.Wrapf(err, "failed to find ChannelMembers with channelId=%s and userId in %v", channelId, userIds)
	}

	return dbMembers.ToModel(), nil
}

// TODO: rewrite in squirrel (https://github.com/mattermost/mattermost-server/issues/19336)
func (s SqlChannelStore) GetMembersByChannelIds(channelIds []string, userId string) (model.ChannelMembers, error) {
	var dbMembers channelMemberWithSchemeRolesList

	keys, props := MapStringsToQueryParams(channelIds, "Channel")
	props["UserId"] = userId

	if _, err := s.GetReplica().Select(&dbMembers, channelMembersForTeamWithSchemeSelectQuery+"WHERE ChannelMembers.UserId = :UserId AND ChannelMembers.ChannelId IN "+keys, props); err != nil {
		return nil, errors.Wrapf(err, "failed to find ChannelMembers with userId=%s and channelId in %v", userId, channelIds)
	}

	return dbMembers.ToModel(), nil
}

func (s SqlChannelStore) GetChannelsByScheme(schemeId string, offset int, limit int) (model.ChannelList, error) {
	channels := model.ChannelList{}
	err := s.GetReplicaX().Select(&channels, "SELECT * FROM Channels WHERE SchemeId = ? ORDER BY DisplayName LIMIT ? OFFSET ?", schemeId, limit, offset)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Channels with schemeId=%s", schemeId)
	}
	return channels, nil
}

// This function does the Advanced Permissions Phase 2 migration for ChannelMember objects. It performs the migration
// in batches as a single transaction per batch to ensure consistency but to also minimise execution time to avoid
// causing unnecessary table locks. **THIS FUNCTION SHOULD NOT BE USED FOR ANY OTHER PURPOSE.** Executing this function
// *after* the new Schemes functionality has been used on an installation will have unintended consequences.
func (s SqlChannelStore) MigrateChannelMembers(fromChannelId string, fromUserId string) (map[string]string, error) {
	var transaction *sqlxTxWrapper
	var err error

	if transaction, err = s.GetMasterX().Beginx(); err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction)

	channelMembers := []channelMember{}
	if err := transaction.Select(&channelMembers, "SELECT * from ChannelMembers WHERE (ChannelId, UserId) > (?, ?) ORDER BY ChannelId, UserId LIMIT 100", fromChannelId, fromUserId); err != nil {
		return nil, errors.Wrap(err, "failed to find ChannelMembers")
	}

	if len(channelMembers) == 0 {
		// No more channel members in query result means that the migration has finished.
		return nil, nil
	}

	for i := range channelMembers {
		member := channelMembers[i]
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
			if role == model.ChannelAdminRoleId {
				member.SchemeAdmin = sql.NullBool{Bool: true, Valid: true}
			} else if role == model.ChannelUserRoleId {
				member.SchemeUser = sql.NullBool{Bool: true, Valid: true}
			} else if role == model.ChannelGuestRoleId {
				member.SchemeGuest = sql.NullBool{Bool: true, Valid: true}
			} else {
				newRoles = append(newRoles, role)
			}
		}
		member.Roles = strings.Join(newRoles, " ")

		if _, err := transaction.NamedExec(`UPDATE ChannelMembers
			SET Roles=:Roles,
				LastViewedAt=:LastViewedAt,
				MsgCount=:MsgCount,
				MentionCount=:MentionCount,
				NotifyProps=:NotifyProps,
				LastUpdateAt=:LastUpdateAt,
				SchemeUser=:SchemeUser,
				SchemeAdmin=:SchemeAdmin,
				SchemeGuest=:SchemeGuest,
				MentionCountRoot=:MentionCountRoot,
				MsgCountRoot=:MsgCountRoot
			WHERE ChannelId=:ChannelId AND UserId=:UserId`, &member); err != nil {
			return nil, errors.Wrap(err, "failed to update ChannelMember")
		}

	}

	if err := transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}

	data := make(map[string]string)
	data["ChannelId"] = channelMembers[len(channelMembers)-1].ChannelId
	data["UserId"] = channelMembers[len(channelMembers)-1].UserId
	return data, nil
}

func (s SqlChannelStore) ResetAllChannelSchemes() error {
	transaction, err := s.GetMasterX().Beginx()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction)

	err = s.resetAllChannelSchemesT(transaction)
	if err != nil {
		return err
	}

	if err := transaction.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}

	return nil
}

func (s SqlChannelStore) resetAllChannelSchemesT(transaction *sqlxTxWrapper) error {
	if _, err := transaction.Exec("UPDATE Channels SET SchemeId=''"); err != nil {
		return errors.Wrap(err, "failed to update Channels")
	}

	return nil
}

func (s SqlChannelStore) ClearAllCustomRoleAssignments() error {
	builtInRoles := model.MakeDefaultRoles()
	lastUserId := strings.Repeat("0", 26)
	lastChannelId := strings.Repeat("0", 26)

	for {
		var transaction *sqlxTxWrapper
		var err error

		if transaction, err = s.GetMasterX().Beginx(); err != nil {
			return errors.Wrap(err, "begin_transaction")
		}

		channelMembers := []*channelMember{}
		if err := transaction.Select(&channelMembers, "SELECT * from ChannelMembers WHERE (ChannelId, UserId) > (?, ?) ORDER BY ChannelId, UserId LIMIT 1000", lastChannelId, lastUserId); err != nil {
			finalizeTransactionX(transaction)
			return errors.Wrap(err, "failed to find ChannelMembers")
		}

		if len(channelMembers) == 0 {
			finalizeTransactionX(transaction)
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
				if _, err := transaction.Exec("UPDATE ChannelMembers SET Roles = ? WHERE UserId = ? AND ChannelId = ?", newRolesString, member.UserId, member.ChannelId); err != nil {
					finalizeTransactionX(transaction)
					return errors.Wrap(err, "failed to update ChannelMembers")
				}
			}
		}

		if err := transaction.Commit(); err != nil {
			finalizeTransactionX(transaction)
			return errors.Wrap(err, "commit_transaction")
		}
	}

	return nil
}

func (s SqlChannelStore) GetAllChannelsForExportAfter(limit int, afterId string) ([]*model.ChannelForExport, error) {
	channels := []*model.ChannelForExport{}
	if err := s.GetReplicaX().Select(&channels, `
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
			Channels.Id > ?
			AND Channels.Type IN ('O', 'P')
		ORDER BY
			Id
		LIMIT ?`,
		afterId, limit); err != nil {
		return nil, errors.Wrap(err, "failed to find Channels for export")
	}

	return channels, nil
}

func (s SqlChannelStore) GetChannelMembersForExport(userId string, teamId string) ([]*model.ChannelMemberForExport, error) {
	members := []*model.ChannelMemberForExport{}
	err := s.GetReplicaX().Select(&members, `
		SELECT
			ChannelMembers.ChannelId,
			ChannelMembers.UserId,
			ChannelMembers.Roles,
			ChannelMembers.LastViewedAt,
			ChannelMembers.MsgCount,
			ChannelMembers.MentionCount,
			ChannelMembers.MentionCountRoot,
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
			ChannelMembers.UserId = ?
			AND Channels.TeamId = ?
			AND Channels.DeleteAt = 0`,
		userId, teamId)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Channels for export")
	}

	return members, nil
}

func (s SqlChannelStore) GetAllDirectChannelsForExportAfter(limit int, afterId string) ([]*model.DirectChannelForExport, error) {
	directChannelsForExport := []*model.DirectChannelForExport{}
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
		return nil, errors.Wrap(err, "channel_tosql")
	}

	if err2 := s.GetReplicaX().Select(&directChannelsForExport, queryString, args...); err2 != nil {
		return nil, errors.Wrap(err2, "failed to find direct Channels for export")
	}

	var channelIds []string
	for _, channel := range directChannelsForExport {
		channelIds = append(channelIds, channel.Id)
	}
	query = s.getQueryBuilder().
		Select("u.Username as Username, ChannelId, UserId, cm.Roles as Roles, LastViewedAt, MsgCount, MentionCount, MentionCountRoot, cm.NotifyProps as NotifyProps, LastUpdateAt, SchemeUser, SchemeAdmin, (SchemeGuest IS NOT NULL AND SchemeGuest) as SchemeGuest").
		From("ChannelMembers cm").
		Join("Users u ON ( u.Id = cm.UserId )").
		Where(sq.And{
			sq.Eq{"cm.ChannelId": channelIds},
			sq.Eq{"u.DeleteAt": int(0)},
		})

	queryString, args, err = query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channel_tosql")
	}

	channelMembers := []*model.ChannelMemberForExport{}
	if err2 := s.GetReplicaX().Select(&channelMembers, queryString, args...); err2 != nil {
		return nil, errors.Wrap(err2, "failed to find ChannelMembers")
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

func (s SqlChannelStore) GetChannelsBatchForIndexing(startTime, endTime int64, limit int) ([]*model.Channel, error) {
	query :=
		`SELECT
			 *
		 FROM
			 Channels
		 WHERE
			 CreateAt >= ?
		 AND
			 CreateAt < ?
		 ORDER BY
			 CreateAt
		 LIMIT
			 ?`

	channels := []*model.Channel{}
	err := s.GetSearchReplicaX().Select(&channels, query, startTime, endTime, limit)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Channels")
	}

	return channels, nil
}

func (s SqlChannelStore) UserBelongsToChannels(userId string, channelIds []string) (bool, error) {
	query := s.getQueryBuilder().
		Select("Count(*)").
		From("ChannelMembers").
		Where(sq.And{
			sq.Eq{"UserId": userId},
			sq.Eq{"ChannelId": channelIds},
		})

	queryString, args, err := query.ToSql()
	if err != nil {
		return false, errors.Wrap(err, "channel_tosql")
	}
	var c int64
	err = s.GetReplicaX().Get(&c, queryString, args...)
	if err != nil {
		return false, errors.Wrap(err, "failed to count ChannelMembers")
	}
	return c > 0, nil
}

// TODO: parameterize userIDs
func (s SqlChannelStore) UpdateMembersRole(channelID string, userIDs []string) error {
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
			ChannelId = ?
			AND (SchemeGuest = false OR SchemeGuest IS NULL)
			`, strings.Join(userIDs, "', '"))

	if _, err := s.GetMasterX().Exec(sql, channelID); err != nil {
		return errors.Wrap(err, "failed to update ChannelMembers")
	}

	return nil
}

func (s SqlChannelStore) GroupSyncedChannelCount() (int64, error) {
	query := s.getQueryBuilder().
		Select("COUNT(*)").
		From("Channels").
		Where(sq.Eq{"GroupConstrained": true, "DeleteAt": 0})

	sql, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "channel_tosql")
	}

	var count int64
	err = s.GetReplicaX().Get(&count, sql, args...)
	if err != nil {
		return 0, errors.Wrap(err, "failed to count Channels")
	}

	return count, nil
}

// SetShared sets the Shared flag true/false
func (s SqlChannelStore) SetShared(channelId string, shared bool) error {
	squery, args, err := s.getQueryBuilder().
		Update("Channels").
		Set("Shared", shared).
		Where(sq.Eq{"Id": channelId}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "channel_set_shared_tosql")
	}

	result, err := s.GetMasterX().Exec(squery, args...)
	if err != nil {
		return errors.Wrap(err, "failed to update `Shared` for Channels")
	}

	count, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to determine rows affected")
	}
	if count == 0 {
		return fmt.Errorf("id not found: %s", channelId)
	}
	return nil
}

// GetTeamForChannel returns the team for a given channelID.
func (s SqlChannelStore) GetTeamForChannel(channelID string) (*model.Team, error) {
	nestedQ, nestedArgs, err := s.getQueryBuilder().Select("TeamId").From("Channels").Where(sq.Eq{"Id": channelID}).ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_team_for_channel_nested_tosql")
	}
	query, args, err := s.getQueryBuilder().
		Select("*").
		From("Teams").Where(sq.Expr("Id = ("+nestedQ+")", nestedArgs...)).ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_team_for_channel_tosql")
	}

	team := model.Team{}
	err = s.GetReplicaX().Get(&team, query, args...)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Team", fmt.Sprintf("channel_id=%s", channelID))
		}
		return nil, errors.Wrapf(err, "failed to find team with channel_id=%s", channelID)
	}
	return &team, nil
}
