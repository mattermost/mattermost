// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package pglayer

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/store/helper"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
)

type PgChannelStore struct {
	sqlstore.SqlChannelStore
	rootStore *PgLayer
}

func (s PgChannelStore) CreateIndexesIfNotExists() {
	helper.ChannelCreateIndexesIfNotExists(s, createExtraIndexes)
}

func (s PgChannelStore) UpdateLastViewedAt(channelIds []string, userId string) (map[string]int64, *model.AppError) {
	return helper.ChannelUpdateLastViewedAt(s, channelIds, userId, buildUpdateLastViewedAtQuery, calculateTimes)
}

func (s PgChannelStore) AutocompleteInTeam(teamId string, term string, includeDeleted bool) (*model.ChannelList, *model.AppError) {
	return helper.ChannelAutocompleteInTeam(s, teamId, term, includeDeleted, buildSearchFields, buildFullTextClause)
}

func (s PgChannelStore) AutocompleteInTeamForSearch(teamId string, userId string, term string, includeDeleted bool) (*model.ChannelList, *model.AppError) {
	return helper.ChannelAutocompleteInTeamForSearch(s, teamId, userId, term, includeDeleted, buildSearchFields, buildFullTextClause)
}

func (s PgChannelStore) SearchInTeam(teamId string, term string, includeDeleted bool) (*model.ChannelList, *model.AppError) {
	return helper.ChannelSearchInTeam(s, teamId, term, includeDeleted, buildSearchFields, buildFullTextClause)
}

func (s PgChannelStore) SearchArchivedInTeam(teamId string, term string, userId string) (*model.ChannelList, *model.AppError) {
	return helper.ChannelSearchArchivedInTeam(s, teamId, term, userId, buildSearchFields, buildFullTextClause)
}

func (s PgChannelStore) SearchForUserInTeam(userId string, teamId string, term string, includeDeleted bool) (*model.ChannelList, *model.AppError) {
	return helper.ChannelSearchForUserInTeam(s, userId, teamId, term, includeDeleted, buildSearchFields, buildFullTextClause)
}

func (s PgChannelStore) SearchAllChannels(term string, opts store.ChannelSearchOpts) (*model.ChannelListWithTeamData, int64, *model.AppError) {
	return helper.ChannelSearchAllChannels(s, term, opts, buildSearchFields, buildFullTextClause)
}

func (s PgChannelStore) SearchMore(userId string, teamId string, term string) (*model.ChannelList, *model.AppError) {
	return helper.ChannelSearchMore(s, userId, teamId, term, buildSearchFields, buildFullTextClause)
}

func (s PgChannelStore) SearchGroupChannels(userId, term string) (*model.ChannelList, *model.AppError) {
	return helper.ChannelSearchGroupChannels(s, userId, term, buildClauseAndQuery)
}

func buildSearchFields(searchFields []string, field string) []string {
	return append(searchFields, fmt.Sprintf("lower(%s) LIKE lower(%s) escape '*'", field, ":LikeTerm"))
}

func buildFullTextClause(fulltextTerm, searchColumns string) (string, string) {
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

	fulltextClause := fmt.Sprintf("((to_tsvector('english', %s)) @@ to_tsquery('english', :FulltextTerm))", convertMySQLFullTextColumnsToPostgres(searchColumns))
	return fulltextClause, fulltextTerm
}

func buildClauseAndQuery() (string, string) {
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
	return baseLikeClause, query
}

func buildUpdateLastViewedAtQuery(keys string) string {
	query := `SELECT Id, LastPostAt, TotalMsgCount FROM Channels WHERE Id IN ` + keys
	return `WITH c AS ( ` + query + `),
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

func calculateTimes(s sqlstore.SqlStore, times map[string]int64, lastPostAtTimes helper.LastPostAtTimes, props map[string]interface{}, keys string, channelIds []string, userId string) (map[string]int64, *model.AppError) {
	for _, t := range lastPostAtTimes {
		times[t.Id] = t.LastPostAt
	}
	return times, nil
}

func createExtraIndexes(s sqlstore.SqlStore) {
	s.CreateIndexIfNotExists("idx_channels_name_lower", "Channels", "lower(Name)")
	s.CreateIndexIfNotExists("idx_channels_displayname_lower", "Channels", "lower(DisplayName)")
	s.CreateIndexIfNotExists("idx_publicchannels_name_lower", "PublicChannels", "lower(Name)")
	s.CreateIndexIfNotExists("idx_publicchannels_displayname_lower", "PublicChannels", "lower(DisplayName)")
}
