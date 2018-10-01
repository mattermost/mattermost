// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync/atomic"

	"github.com/pkg/errors"

	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

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

type SqlChannelStoreExperimental struct {
	SqlChannelStore
	experimentalPublicChannelsMaterializationDisabled *uint32
}

func NewSqlChannelStoreExperimental(sqlStore SqlStore, metrics einterfaces.MetricsInterface, enabled bool) store.ChannelStore {
	s := &SqlChannelStoreExperimental{
		SqlChannelStore: *NewSqlChannelStore(sqlStore, metrics).(*SqlChannelStore),
		experimentalPublicChannelsMaterializationDisabled: new(uint32),
	}

	if enabled {
		// Forcibly log, since the default state is enabled and we want this on startup.
		mlog.Info("Enabling experimental public channels materialization")
		s.EnableExperimentalPublicChannelsMaterialization()
	} else {
		s.DisableExperimentalPublicChannelsMaterialization()
	}

	if s.IsExperimentalPublicChannelsMaterializationEnabled() {
		for _, db := range sqlStore.GetAllConns() {
			tablePublicChannels := db.AddTableWithName(publicChannel{}, "PublicChannels").SetKeys(false, "Id")
			tablePublicChannels.ColMap("Id").SetMaxSize(26)
			tablePublicChannels.ColMap("TeamId").SetMaxSize(26)
			tablePublicChannels.ColMap("DisplayName").SetMaxSize(64)
			tablePublicChannels.ColMap("Name").SetMaxSize(64)
			tablePublicChannels.SetUniqueTogether("Name", "TeamId")
			tablePublicChannels.ColMap("Header").SetMaxSize(1024)
			tablePublicChannels.ColMap("Purpose").SetMaxSize(250)
		}
	}

	return s
}

// migratePublicChannels initializes the PublicChannels table with data created before this version
// of the Mattermost server kept it up-to-date.
func (s SqlChannelStoreExperimental) MigratePublicChannels() error {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.MigratePublicChannels()
	}

	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return err
	}

	if _, err := transaction.Exec(`
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

	if err := transaction.Commit(); err != nil {
		return err
	}

	return nil
}

// DropPublicChannels removes the public channels table.
func (s SqlChannelStoreExperimental) DropPublicChannels() error {
	_, err := s.GetMaster().Exec(`
		DROP TABLE IF EXISTS PublicChannels
	`)
	if err != nil {
		return errors.Wrap(err, "failed to drop public channels table")
	}

	return nil
}

func (s SqlChannelStoreExperimental) CreateIndexesIfNotExists() {
	s.SqlChannelStore.CreateIndexesIfNotExists()

	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return
	}

	s.CreateIndexIfNotExists("idx_publicchannels_team_id", "PublicChannels", "TeamId")
	s.CreateIndexIfNotExists("idx_publicchannels_name", "PublicChannels", "Name")
	s.CreateIndexIfNotExists("idx_publicchannels_delete_at", "PublicChannels", "DeleteAt")
	if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		s.CreateIndexIfNotExists("idx_publicchannels_name_lower", "PublicChannels", "lower(Name)")
		s.CreateIndexIfNotExists("idx_publicchannels_displayname_lower", "PublicChannels", "lower(DisplayName)")
	}
	s.CreateFullTextIndexIfNotExists("idx_publicchannels_search_txt", "PublicChannels", "Name, DisplayName, Purpose")
}

func (s SqlChannelStoreExperimental) upsertPublicChannelT(transaction *gorp.Transaction, channel *model.Channel) error {
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

func (s SqlChannelStoreExperimental) Save(channel *model.Channel, maxChannelsPerTeam int64) store.StoreChannel {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.Save(channel, maxChannelsPerTeam)
	}

	return store.Do(func(result *store.StoreResult) {
		if channel.DeleteAt != 0 {
			result.Err = model.NewAppError("SqlChannelStoreExperimental.Save", "store.sql_channel.save.archived_channel.app_error", nil, "", http.StatusBadRequest)
			return
		}

		if channel.Type == model.CHANNEL_DIRECT {
			result.Err = model.NewAppError("SqlChannelStoreExperimental.Save", "store.sql_channel.save.direct_channel.app_error", nil, "", http.StatusBadRequest)
			return
		}

		transaction, err := s.GetMaster().Begin()
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStoreExperimental.Save", "store.sql_channel.save.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		*result = s.saveChannelT(transaction, channel, maxChannelsPerTeam)
		if result.Err != nil {
			transaction.Rollback()
			return
		}

		// Additionally propagate the write to the PublicChannels table.
		if err := s.upsertPublicChannelT(transaction, result.Data.(*model.Channel)); err != nil {
			transaction.Rollback()
			result.Err = model.NewAppError("SqlChannelStoreExperimental.Save", "store.sql_channel.save.upsert_public_channel.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		if err := transaction.Commit(); err != nil {
			result.Err = model.NewAppError("SqlChannelStoreExperimental.Save", "store.sql_channel.save.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}
	})
}

func (s SqlChannelStoreExperimental) Update(channel *model.Channel) store.StoreChannel {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.Update(channel)
	}

	return store.Do(func(result *store.StoreResult) {
		transaction, err := s.GetMaster().Begin()
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStoreExperimental.Update", "store.sql_channel.update.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		*result = s.updateChannelT(transaction, channel)
		if result.Err != nil {
			transaction.Rollback()
			return
		}

		// Additionally propagate the write to the PublicChannels table.
		if err := s.upsertPublicChannelT(transaction, result.Data.(*model.Channel)); err != nil {
			transaction.Rollback()
			result.Err = model.NewAppError("SqlChannelStoreExperimental.Update", "store.sql_channel.update.upsert_public_channel.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		if err := transaction.Commit(); err != nil {
			result.Err = model.NewAppError("SqlChannelStoreExperimental.Update", "store.sql_channel.update.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}
	})
}

func (s SqlChannelStoreExperimental) Delete(channelId string, time int64) store.StoreChannel {
	// Call the experimental version first.
	return s.SetDeleteAt(channelId, time, time)
}

func (s SqlChannelStoreExperimental) Restore(channelId string, time int64) store.StoreChannel {
	// Call the experimental version first.
	return s.SetDeleteAt(channelId, 0, time)
}

func (s SqlChannelStoreExperimental) SetDeleteAt(channelId string, deleteAt, updateAt int64) store.StoreChannel {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.SetDeleteAt(channelId, deleteAt, updateAt)
	}

	return store.Do(func(result *store.StoreResult) {
		transaction, err := s.GetMaster().Begin()
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStoreExperimental.SetDeleteAt", "store.sql_channel.set_delete_at.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		*result = s.setDeleteAtT(transaction, channelId, deleteAt, updateAt)
		if result.Err != nil {
			transaction.Rollback()
			return
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
			transaction.Rollback()
			result.Err = model.NewAppError("SqlChannelStoreExperimental.SetDeleteAt", "store.sql_channel.set_delete_at.update_public_channel.app_error", nil, "channel_id="+channelId+", "+err.Error(), http.StatusInternalServerError)
			return
		}

		if err := transaction.Commit(); err != nil {
			result.Err = model.NewAppError("SqlChannelStoreExperimental.SetDeleteAt", "store.sql_channel.set_delete_at.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}
	})
}

func (s SqlChannelStoreExperimental) PermanentDeleteByTeam(teamId string) store.StoreChannel {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.PermanentDeleteByTeam(teamId)
	}

	return store.Do(func(result *store.StoreResult) {
		transaction, err := s.GetMaster().Begin()
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStoreExperimental.PermanentDeleteByTeam", "store.sql_channel.permanent_delete_by_team.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		*result = s.permanentDeleteByTeamtT(transaction, teamId)
		if result.Err != nil {
			transaction.Rollback()
			return
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
			transaction.Rollback()
			result.Err = model.NewAppError("SqlChannelStoreExperimental.PermanentDeleteByTeamt", "store.sql_channel.permanent_delete_by_team.delete_public_channels.app_error", nil, "team_id="+teamId+", "+err.Error(), http.StatusInternalServerError)
			return
		}

		if err := transaction.Commit(); err != nil {
			result.Err = model.NewAppError("SqlChannelStoreExperimental.PermanentDeleteByTeam", "store.sql_channel.permanent_delete_by_team.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}
	})
}

func (s SqlChannelStoreExperimental) PermanentDelete(channelId string) store.StoreChannel {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.PermanentDelete(channelId)
	}

	return store.Do(func(result *store.StoreResult) {
		transaction, err := s.GetMaster().Begin()
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStoreExperimental.PermanentDelete", "store.sql_channel.permanent_delete.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		*result = s.permanentDeleteT(transaction, channelId)
		if result.Err != nil {
			transaction.Rollback()
			return
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
			transaction.Rollback()
			result.Err = model.NewAppError("SqlChannelStoreExperimental.PermanentDelete", "store.sql_channel.permanent_delete.delete_public_channel.app_error", nil, "channel_id="+channelId+", "+err.Error(), http.StatusInternalServerError)
			return
		}

		if err := transaction.Commit(); err != nil {
			result.Err = model.NewAppError("SqlChannelStoreExperimental.PermanentDelete", "store.sql_channel.permanent_delete.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}
	})
}

func (s SqlChannelStoreExperimental) GetMoreChannels(teamId string, userId string, offset int, limit int) store.StoreChannel {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.GetMoreChannels(teamId, userId, offset, limit)
	}

	return store.Do(func(result *store.StoreResult) {
		data := &model.ChannelList{}
		_, err := s.GetReplica().Select(data, `
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
			result.Err = model.NewAppError("SqlChannelStore.GetMoreChannels", "store.sql_channel.get_more_channels.get.app_error", nil, "teamId="+teamId+", userId="+userId+", err="+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = data
	})
}

func (s SqlChannelStoreExperimental) GetPublicChannelsForTeam(teamId string, offset int, limit int) store.StoreChannel {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.GetPublicChannelsForTeam(teamId, offset, limit)
	}

	return store.Do(func(result *store.StoreResult) {
		data := &model.ChannelList{}
		_, err := s.GetReplica().Select(data, `
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
			result.Err = model.NewAppError("SqlChannelStore.GetPublicChannelsForTeam", "store.sql_channel.get_public_channels.get.app_error", nil, "teamId="+teamId+", err="+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = data
	})
}

func (s SqlChannelStoreExperimental) GetPublicChannelsByIdsForTeam(teamId string, channelIds []string) store.StoreChannel {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.GetPublicChannelsByIdsForTeam(teamId, channelIds)
	}

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
			result.Err = model.NewAppError("SqlChannelStore.GetPublicChannelsByIdsForTeam", "store.sql_channel.get_channels_by_ids.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		if len(*data) == 0 {
			result.Err = model.NewAppError("SqlChannelStore.GetPublicChannelsByIdsForTeam", "store.sql_channel.get_channels_by_ids.not_found.app_error", nil, "", http.StatusNotFound)
		}

		result.Data = data
	})
}

func (s SqlChannelStoreExperimental) AutocompleteInTeam(teamId string, term string, includeDeleted bool) store.StoreChannel {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.AutocompleteInTeam(teamId, term, includeDeleted)
	}

	return store.Do(func(result *store.StoreResult) {
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
			LIMIT 50
		`

		var channels model.ChannelList

		if likeClause, likeTerm := s.buildLIKEClause(term, "c.Name, c.DisplayName, c.Purpose"); likeClause == "" {
			if _, err := s.GetReplica().Select(&channels, fmt.Sprintf(queryFormat, ""), map[string]interface{}{"TeamId": teamId}); err != nil {
				result.Err = model.NewAppError("SqlChannelStore.AutocompleteInTeam", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
			}
		} else {
			// Using a UNION results in index_merge and fulltext queries and is much faster than the ref
			// query you would get using an OR of the LIKE and full-text clauses.
			fulltextClause, fulltextTerm := s.buildFulltextClause(term, "c.Name, c.DisplayName, c.Purpose")
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

func (s SqlChannelStoreExperimental) SearchInTeam(teamId string, term string, includeDeleted bool) store.StoreChannel {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.SearchInTeam(teamId, term, includeDeleted)
	}

	return store.Do(func(result *store.StoreResult) {
		deleteFilter := "AND c.DeleteAt = 0"
		if includeDeleted {
			deleteFilter = ""
		}

		*result = s.performSearch(`
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
	})
}

func (s SqlChannelStoreExperimental) SearchMore(userId string, teamId string, term string) store.StoreChannel {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.SearchMore(userId, teamId, term)
	}

	return store.Do(func(result *store.StoreResult) {
		*result = s.performSearch(`
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
	})
}

func (s SqlChannelStoreExperimental) buildLIKEClause(term string, searchColumns string) (likeClause, likeTerm string) {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.buildLIKEClause(term, searchColumns)
	}

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

func (s SqlChannelStoreExperimental) buildFulltextClause(term string, searchColumns string) (fulltextClause, fulltextTerm string) {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.buildFulltextClause(term, searchColumns)
	}

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

func (s SqlChannelStoreExperimental) performSearch(searchQuery string, term string, parameters map[string]interface{}) store.StoreResult {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.performSearch(searchQuery, term, parameters)
	}

	result := store.StoreResult{}

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
		result.Err = model.NewAppError("SqlChannelStore.Search", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
		return result
	}

	result.Data = &channels
	return result
}

func (s SqlChannelStoreExperimental) EnableExperimentalPublicChannelsMaterialization() {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		mlog.Info("Enabling experimental public channels materialization")
	}

	atomic.StoreUint32(s.experimentalPublicChannelsMaterializationDisabled, 0)
}

func (s SqlChannelStoreExperimental) DisableExperimentalPublicChannelsMaterialization() {
	if s.IsExperimentalPublicChannelsMaterializationEnabled() {
		mlog.Info("Disabling experimental public channels materialization")
	}

	atomic.StoreUint32(s.experimentalPublicChannelsMaterializationDisabled, 1)
}

func (s SqlChannelStoreExperimental) IsExperimentalPublicChannelsMaterializationEnabled() bool {
	return atomic.LoadUint32(s.experimentalPublicChannelsMaterializationDisabled) == 0
}
