// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package pglayer

import (
	"database/sql"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"

	sq "github.com/Masterminds/squirrel"

	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
	"github.com/pkg/errors"
)

type PgChannelStore struct {
	sqlstore.SqlChannelStore
	rootStore *PgLayer
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

func (s PgChannelStore) CreateIndexesIfNotExists() {
	s.rootStore.CreateIndexIfNotExists("idx_channels_team_id", "Channels", "TeamId")
	s.rootStore.CreateIndexIfNotExists("idx_channels_name", "Channels", "Name")
	s.rootStore.CreateIndexIfNotExists("idx_channels_update_at", "Channels", "UpdateAt")
	s.rootStore.CreateIndexIfNotExists("idx_channels_create_at", "Channels", "CreateAt")
	s.rootStore.CreateIndexIfNotExists("idx_channels_delete_at", "Channels", "DeleteAt")
	s.rootStore.CreateIndexIfNotExists("idx_channels_name_lower", "Channels", "lower(Name)")
	s.rootStore.CreateIndexIfNotExists("idx_channels_displayname_lower", "Channels", "lower(DisplayName)")
	s.rootStore.CreateIndexIfNotExists("idx_channelmembers_channel_id", "ChannelMembers", "ChannelId")
	s.rootStore.CreateIndexIfNotExists("idx_channelmembers_user_id", "ChannelMembers", "UserId")
	s.rootStore.CreateFullTextIndexIfNotExists("idx_channel_search_txt", "Channels", "Name, DisplayName, Purpose")
	s.rootStore.CreateIndexIfNotExists("idx_publicchannels_team_id", "PublicChannels", "TeamId")
	s.rootStore.CreateIndexIfNotExists("idx_publicchannels_name", "PublicChannels", "Name")
	s.rootStore.CreateIndexIfNotExists("idx_publicchannels_delete_at", "PublicChannels", "DeleteAt")
	s.rootStore.CreateIndexIfNotExists("idx_publicchannels_name_lower", "PublicChannels", "lower(Name)")
	s.rootStore.CreateIndexIfNotExists("idx_publicchannels_displayname_lower", "PublicChannels", "lower(DisplayName)")
	s.rootStore.CreateFullTextIndexIfNotExists("idx_publicchannels_search_txt", "PublicChannels", "Name, DisplayName, Purpose")
}

func (s PgChannelStore) upsertPublicChannelT(transaction *gorp.Transaction, channel *model.Channel) error {
	publicChannel := &sqlstore.PublicChannel{
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

	return nil
}

// Save writes the (non-direct) channel channel to the database.
func (s PgChannelStore) Save(channel *model.Channel, maxChannelsPerTeam int64) (*model.Channel, *model.AppError) {
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

func (s PgChannelStore) CreateDirectChannel(user *model.User, otherUser *model.User) (*model.Channel, *model.AppError) {
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

func (s PgChannelStore) SaveDirectChannel(directchannel *model.Channel, member1 *model.ChannelMember, member2 *model.ChannelMember) (*model.Channel, *model.AppError) {
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

	_, member1SaveErr := s.saveMemberT(transaction, member1, newChannel)
	member2SaveErr := member1SaveErr
	if member1.UserId != member2.UserId {
		_, member2SaveErr = s.saveMemberT(transaction, member2, newChannel)
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

func (s PgChannelStore) saveChannelT(transaction *gorp.Transaction, channel *model.Channel, maxChannelsPerTeam int64) (*model.Channel, *model.AppError) {
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
func (s PgChannelStore) Update(channel *model.Channel) (*model.Channel, *model.AppError) {
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

func (s PgChannelStore) updateChannelT(transaction *gorp.Transaction, channel *model.Channel) (*model.Channel, *model.AppError) {
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

func (s PgChannelStore) SaveMember(member *model.ChannelMember) (*model.ChannelMember, *model.AppError) {
	defer s.InvalidateAllChannelMembersForUser(member.UserId)

	// Grab the channel we are saving this member to
	channel, errCh := s.GetFromMaster(member.ChannelId)
	if errCh != nil {
		return nil, errCh
	}

	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.SaveMember", "store.sql_channel.save_member.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer finalizeTransaction(transaction)

	newMember, appErr := s.saveMemberT(transaction, member, channel)
	if appErr != nil {
		return nil, appErr
	}

	if err := transaction.Commit(); err != nil {
		return nil, model.NewAppError("SqlChannelStore.SaveMember", "store.sql_channel.save_member.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return newMember, nil
}

func (s PgChannelStore) saveMemberT(transaction *gorp.Transaction, member *model.ChannelMember, channel *model.Channel) (*model.ChannelMember, *model.AppError) {
	member.PreSave()
	if err := member.IsValid(); err != nil {
		return nil, err
	}

	dbMember := sqlstore.NewChannelMemberFromModel(member)

	if err := transaction.Insert(dbMember); err != nil {
		if IsUniqueConstraintError(err, []string{"ChannelId", "channelmembers_pkey"}) {
			return nil, model.NewAppError("SqlChannelStore.SaveMember", "store.sql_channel.save_member.exists.app_error", nil, "channel_id="+member.ChannelId+", user_id="+member.UserId+", "+err.Error(), http.StatusBadRequest)
		}
		return nil, model.NewAppError("SqlChannelStore.SaveMember", "store.sql_channel.save_member.save.app_error", nil, "channel_id="+member.ChannelId+", user_id="+member.UserId+", "+err.Error(), http.StatusInternalServerError)
	}

	var retrievedMember channelMemberWithSchemeRoles
	if err := transaction.SelectOne(&retrievedMember, sqlstore.CHANNEL_MEMBERS_WITH_SCHEME_SELECT_QUERY+"WHERE ChannelMembers.ChannelId = :ChannelId AND ChannelMembers.UserId = :UserId", map[string]interface{}{"ChannelId": dbMember.ChannelId, "UserId": dbMember.UserId}); err != nil {
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlChannelStore.GetMember", store.MISSING_CHANNEL_MEMBER_ERROR, nil, "channel_id="+dbMember.ChannelId+"user_id="+dbMember.UserId+","+err.Error(), http.StatusNotFound)
		}
		return nil, model.NewAppError("SqlChannelStore.GetMember", "store.sql_channel.get_member.app_error", nil, "channel_id="+dbMember.ChannelId+"user_id="+dbMember.UserId+","+err.Error(), http.StatusInternalServerError)
	}

	return retrievedMember.ToModel(), nil
}

func (s PgChannelStore) UpdateLastViewedAt(channelIds []string, userId string) (map[string]int64, *model.AppError) {
	keys, props := MapStringsToQueryParams(channelIds, "Channel")
	props["UserId"] = userId

	var lastPostAtTimes []struct {
		Id            string
		LastPostAt    int64
		TotalMsgCount int64
	}

	query := `SELECT Id, LastPostAt, TotalMsgCount FROM Channels WHERE Id IN ` + keys
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
	for _, t := range lastPostAtTimes {
		times[t.Id] = t.LastPostAt
	}
	return times, nil
}

func (s PgChannelStore) AutocompleteInTeam(teamId string, term string, includeDeleted bool) (*model.ChannelList, *model.AppError) {
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

func (s PgChannelStore) AutocompleteInTeamForSearch(teamId string, userId string, term string, includeDeleted bool) (*model.ChannelList, *model.AppError) {
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

func (s PgChannelStore) autocompleteInTeamForSearchDirectMessages(userId string, term string) ([]*model.Channel, *model.AppError) {
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

func (s PgChannelStore) SearchInTeam(teamId string, term string, includeDeleted bool) (*model.ChannelList, *model.AppError) {
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

func (s PgChannelStore) SearchArchivedInTeam(teamId string, term string, userId string) (*model.ChannelList, *model.AppError) {
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

func (s PgChannelStore) SearchForUserInTeam(userId string, teamId string, term string, includeDeleted bool) (*model.ChannelList, *model.AppError) {
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

func (s PgChannelStore) channelSearchQuery(term string, opts store.ChannelSearchOpts, countQuery bool) sq.SelectBuilder {
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

	query := s.rootStore.getQueryBuilder().
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

func (s PgChannelStore) SearchAllChannels(term string, opts store.ChannelSearchOpts) (*model.ChannelListWithTeamData, int64, *model.AppError) {
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

func (s PgChannelStore) SearchMore(userId string, teamId string, term string) (*model.ChannelList, *model.AppError) {
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

func (s PgChannelStore) buildLIKEClause(term string, searchColumns string) (likeClause, likeTerm string) {
	likeTerm = sanitizeSearchTerm(term, "*")

	if likeTerm == "" {
		return
	}

	// Prepare the LIKE portion of the query.
	var searchFields []string
	for _, field := range strings.Split(searchColumns, ", ") {
		searchFields = append(searchFields, fmt.Sprintf("lower(%s) LIKE lower(%s) escape '*'", field, ":LikeTerm"))
	}

	likeClause = fmt.Sprintf("(%s)", strings.Join(searchFields, " OR "))
	likeTerm += "%"
	return
}

func (s PgChannelStore) buildFulltextClause(term string, searchColumns string) (fulltextClause, fulltextTerm string) {
	// Copy the terms as we will need to prepare them differently for each search type.
	fulltextTerm = term

	// These chars must be treated as spaces in the fulltext query.
	for _, c := range spaceFulltextSearchChar {
		fulltextTerm = strings.Replace(fulltextTerm, c, " ", -1)
	}

	// Prepare the FULLTEXT portion of the query.
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

	return
}

func (s PgChannelStore) performSearch(searchQuery string, term string, parameters map[string]interface{}) (*model.ChannelList, *model.AppError) {
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

func (s PgChannelStore) getSearchGroupChannelsQuery(userId, term string) (string, map[string]interface{}) {
	baseLikeClause := "ARRAY_TO_STRING(ARRAY_AGG(u.Username), ', ') LIKE %s"
	query := `
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

func (s PgChannelStore) SearchGroupChannels(userId, term string) (*model.ChannelList, *model.AppError) {
	queryString, args := s.getSearchGroupChannelsQuery(userId, term)

	var groupChannels model.ChannelList
	if _, err := s.GetReplica().Select(&groupChannels, queryString, args); err != nil {
		return nil, model.NewAppError("SqlChannelStore.SearchGroupChannels", "store.sql_channel.search_group_channels.app_error", nil, "userId="+userId+", term="+term+", err="+err.Error(), http.StatusInternalServerError)
	}
	return &groupChannels, nil
}
