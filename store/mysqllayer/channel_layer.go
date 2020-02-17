// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mysqllayer

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/store/helper"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
)

type MySQLChannelStore struct {
	sqlstore.SqlChannelStore
}

func (s MySQLChannelStore) CreateIndexesIfNotExists() {
	helper.ChannelCreateIndexesIfNotExists(s, createExtraIndexes)
}

func (s MySQLChannelStore) UpdateLastViewedAt(channelIds []string, userId string) (map[string]int64, *model.AppError) {
	return helper.ChannelUpdateLastViewedAt(s, channelIds, userId, buildUpdateLastViewedAtQuery, updateLastViewedAtShouldExit)
}

func (s MySQLChannelStore) AutocompleteInTeam(teamId string, term string, includeDeleted bool) (*model.ChannelList, *model.AppError) {
	return helper.ChannelAutocompleteInTeam(s, teamId, term, includeDeleted, buildSearchFields, buildFullTextClause)
}

func (s MySQLChannelStore) AutocompleteInTeamForSearch(teamId string, userId string, term string, includeDeleted bool) (*model.ChannelList, *model.AppError) {
	return helper.ChannelAutocompleteInTeamForSearch(s, teamId, userId, term, includeDeleted, buildSearchFields, buildFullTextClause)
}

func (s MySQLChannelStore) SearchInTeam(teamId string, term string, includeDeleted bool) (*model.ChannelList, *model.AppError) {
	return helper.ChannelSearchInTeam(s, teamId, term, includeDeleted, buildSearchFields, buildFullTextClause)
}

func (s MySQLChannelStore) SearchArchivedInTeam(teamId string, term string, userId string) (*model.ChannelList, *model.AppError) {
	return helper.ChannelSearchArchivedInTeam(s, teamId, term, userId, buildSearchFields, buildFullTextClause)
}

func (s MySQLChannelStore) SearchForUserInTeam(userId string, teamId string, term string, includeDeleted bool) (*model.ChannelList, *model.AppError) {
	return helper.ChannelSearchForUserInTeam(s, userId, teamId, term, includeDeleted, buildSearchFields, buildFullTextClause)
}

func (s MySQLChannelStore) SearchAllChannels(term string, opts store.ChannelSearchOpts) (*model.ChannelListWithTeamData, int64, *model.AppError) {
	return helper.ChannelSearchAllChannels(s, term, opts, buildSearchFields, buildFullTextClause)
}

func (s MySQLChannelStore) SearchMore(userId string, teamId string, term string) (*model.ChannelList, *model.AppError) {
	return helper.ChannelSearchMore(s, userId, teamId, term, buildSearchFields, buildFullTextClause)
}

func (s MySQLChannelStore) SearchGroupChannels(userId, term string) (*model.ChannelList, *model.AppError) {
	return helper.ChannelSearchGroupChannels(s, userId, term, buildClauseAndQuery)
}

func buildSearchFields(searchFields []string, field string) []string {
	return append(searchFields, fmt.Sprintf("%s LIKE %s escape '*'", field, ":LikeTerm"))
}

func buildFullTextClause(fulltextTerm, searchColumns string) (string, string) {
	splitTerm := strings.Fields(fulltextTerm)
	for i, t := range strings.Fields(fulltextTerm) {
		splitTerm[i] = "+" + t + "*"
	}
	fulltextTerm = strings.Join(splitTerm, " ")
	fulltextClause := fmt.Sprintf("MATCH(%s) AGAINST (:FulltextTerm IN BOOLEAN MODE)", searchColumns)
	return fulltextClause, fulltextTerm
}

func buildClauseAndQuery() (string, string) {
	baseLikeClause := "GROUP_CONCAT(u.Username SEPARATOR ', ') LIKE %s"
	query := `
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
	return baseLikeClause, query
}

func buildUpdateLastViewedAtQuery(keys string) string {
	// TODO: use a CTE for mysql too when version 8 becomes the minimum supported version.
	return `SELECT Id, LastPostAt, TotalMsgCount FROM Channels WHERE Id IN ` + keys
}

func updateLastViewedAtShouldExit(s sqlstore.SqlStore, times map[string]int64, lastPostAtTimes helper.LastPostAtTimes, props map[string]interface{}, keys string, channelIds []string, userId string) (map[string]int64, *model.AppError) {
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

func createExtraIndexes(s sqlstore.SqlStore) {
	return
}
