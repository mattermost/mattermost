// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package postgressearchengine

import (
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
)

const (
	exitCreateIndexPostgres = 117
)

var spaceFulltextSearchChar = []string{
	"<",
	">",
	"+",
	"-",
	"(",
	")",
	"~",
	":",
	"*",
	"\"",
	"!",
	"@",
}

var escapeLikeSearchChar = []string{
	"%",
	"_",
}

type PostgresSearchEngine struct {
	version            int
	store              sqlstore.SqlStore
	enableIndexing     *bool
	enableSearching    *bool
	enableAutocomplete *bool
}

func New(version int, cfg *model.DatabaseSearchSettings) *PostgresSearchEngine {
	return &PostgresSearchEngine{
		version:            -1,
		enableIndexing:     cfg.EnableIndexing,
		enableSearching:    cfg.EnableSearching,
		enableAutocomplete: cfg.EnableAutocomplete,
	}
}

func (pse *PostgresSearchEngine) createIndexIfNotExists(indexName string, tableName string, columnName string) {
	query := "CREATE INDEX CONCURRENTLY IF NOT EXISTS " + indexName + " ON " + tableName + " USING gin(to_tsvector('english', " + columnName + "))"
	_, err := pse.store.GetMaster().ExecNoTimeout(query)
	if err != nil {
		mlog.Critical("Failed to create index", mlog.Err(err))
		time.Sleep(time.Second)
		os.Exit(exitCreateIndexPostgres)
	}
}

func (pse *PostgresSearchEngine) dropIndexIfExists(indexName string) {
	query := "DROP INDEX CONCURRENTLY IF EXISTS " + indexName
	_, err := pse.store.GetMaster().ExecNoTimeout(query)
	if err != nil {
		mlog.Critical("Failed to drop index", mlog.Err(err))
		time.Sleep(time.Second)
		os.Exit(exitCreateIndexPostgres)
	}
}

func (pse *PostgresSearchEngine) Stop() *model.AppError          { return nil }
func (pse *PostgresSearchEngine) UpdateConfig(cfg *model.Config) {}
func (pse *PostgresSearchEngine) IsIndexingSync() bool           { return true }
func (pse *PostgresSearchEngine) IndexPost(post *model.Post, teamId string) *model.AppError {
	return nil
}
func (pse *PostgresSearchEngine) DeletePost(post *model.Post) *model.AppError          { return nil }
func (pse *PostgresSearchEngine) IndexChannel(channel *model.Channel) *model.AppError  { return nil }
func (pse *PostgresSearchEngine) DeleteChannel(channel *model.Channel) *model.AppError { return nil }
func (pse *PostgresSearchEngine) IndexUser(user *model.User, teamsIds, channelsIds []string) *model.AppError {
	return nil
}
func (pse *PostgresSearchEngine) DeleteUser(user *model.User) *model.AppError  { return nil }
func (pse *PostgresSearchEngine) TestConfig(cfg *model.Config) *model.AppError { return nil }
func (pse *PostgresSearchEngine) RefreshIndexes() *model.AppError              { return nil }
func (pse *PostgresSearchEngine) DataRetentionDeleteIndexes(cutoff time.Time) *model.AppError {
	return nil
}

func (pse *PostgresSearchEngine) Start() *model.AppError {
	pse.createIndexIfNotExists("idx_posts_message_txt", "Posts", "Message")
	pse.createIndexIfNotExists("idx_posts_hashtags_txt", "Posts", "Hashtags")
	pse.createIndexIfNotExists("idx_channel_search_txt", "Channels", "Name || DisplayName || Purpose")
	pse.createIndexIfNotExists("idx_publicchannels_search_txt", "PublicChannels", "Name || DisplayName || Purpose")
	pse.createIndexIfNotExists("idx_users_all_txt", "Users", "Username || FirstName || LastName || Nickname || Email")
	pse.createIndexIfNotExists("idx_users_all_no_full_name_txt", "Users", "Username || Nickname || Email")
	pse.createIndexIfNotExists("idx_users_names_txt", "Users", "Username || FirstName || LastName || Nickname")
	pse.createIndexIfNotExists("idx_users_names_no_full_name_txt", "Users", "Username || Nickname")
	return nil
}

func (pse *PostgresSearchEngine) GetVersion() int {
	return pse.version
}

func (pse *PostgresSearchEngine) GetName() string {
	return "postgres"
}

func (pse *PostgresSearchEngine) IsActive() bool {
	return *pse.enableIndexing
}

func (pse *PostgresSearchEngine) IsIndexingEnabled() bool {
	return *pse.enableIndexing
}

func (pse *PostgresSearchEngine) IsSearchEnabled() bool {
	return *pse.enableSearching
}

func (pse *PostgresSearchEngine) IsAutocompletionEnabled() bool {
	return *pse.enableAutocomplete
}

func (pse *PostgresSearchEngine) SearchPosts(channels *model.ChannelList, searchParams []*model.SearchParams, page, perPage int) ([]string, model.PostSearchMatches, *model.AppError) {
	// TODO Copy search post
	return nil, nil, nil
}

func sanitizeSearchTerm(term string, escapeChar string) string {
	term = strings.Replace(term, escapeChar, "", -1)

	for _, c := range escapeLikeSearchChar {
		term = strings.Replace(term, c, escapeChar+c, -1)
	}

	return term
}

func buildChannelsLIKEClause(term string, searchColumns []string) (string, string) {
	likeTerm := sanitizeSearchTerm(term, "*")

	if likeTerm == "" {
		return "", ""
	}

	// Prepare the LIKE portion of the query.
	var searchFields []string
	for _, field := range searchColumns {
		searchFields = append(searchFields, fmt.Sprintf("lower(%s) LIKE lower(%s) escape '*'", field, ":LikeTerm"))
	}

	likeTerm += "%"
	likeClause := fmt.Sprintf("(%s)", strings.Join(searchFields, " OR "))
	return likeClause, likeTerm
}

func buildChannelsFulltextClause(term string, searchColumns string) (string, string) {
	// Copy the terms as we will need to prepare them differently for each search type.
	fulltextTerm := term

	// These chars must be treated as spaces in the fulltext query.
	for _, c := range spaceFulltextSearchChar {
		fulltextTerm = strings.Replace(fulltextTerm, c, " ", -1)
	}

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

	fulltextClause := fmt.Sprintf("((to_tsvector('english', %s)) @@ to_tsquery('english', :FulltextTerm))", searchColumns)

	return fulltextClause, fulltextTerm
}

func (pse *PostgresSearchEngine) SearchChannels(teamId, term string) ([]string, *model.AppError) {
	queryFormat := `
		SELECT
			Id
		FROM
			Channels
		WHERE
			TeamId = :TeamId
			%v
		LIMIT ` + strconv.Itoa(model.CHANNEL_SEARCH_DEFAULT_LIMIT)

	var channelIds []string
	if likeClause, likeTerm := buildChannelsLIKEClause(term, []string{"Name", "DisplayName", "Purpose"}); likeClause == "" {
		if _, err := pse.store.GetReplica().Select(&channelIds, fmt.Sprintf(queryFormat, ""), map[string]interface{}{"TeamId": teamId}); err != nil {
			return nil, model.NewAppError("PostgresSearchEngine.SearchChannels", "postgressearchengine.search_channels.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
		}
	} else {
		// Using a UNION results in index_merge and fulltext queries and is much faster than the ref
		// query you would get using an OR of the LIKE and full-text clauses.
		fulltextClause, fulltextTerm := buildChannelsFulltextClause(term, "Name || DisplayName || Purpose")
		likeQuery := fmt.Sprintf(queryFormat, "AND "+likeClause)
		fulltextQuery := fmt.Sprintf(queryFormat, "AND "+fulltextClause)
		query := fmt.Sprintf("(%v) UNION (%v) LIMIT 50", likeQuery, fulltextQuery)

		if _, err := pse.store.GetReplica().Select(&channelIds, query, map[string]interface{}{"TeamId": teamId, "LikeTerm": likeTerm, "FulltextTerm": fulltextTerm}); err != nil {
			return nil, model.NewAppError("PostgresSearchEngine.SearchChannels", "postgressearchengine.search_channels.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
		}
	}

	return channelIds, nil
}

func (pse *PostgresSearchEngine) SearchUsersInChannel(teamId, channelId string, restrictedToChannels []string, term string, options *model.UserSearchOptions) ([]string, []string, *model.AppError) {
	// TODO Copy search users in channel
	return nil, nil, nil
}

func (pse *PostgresSearchEngine) SearchUsersInTeam(teamId string, restrictedToChannels []string, term string, options *model.UserSearchOptions) ([]string, *model.AppError) {
	// TODO Copy search users in team
	return nil, nil
}

func (pse *PostgresSearchEngine) PurgeIndexes() *model.AppError {
	if pse.IsActive() {
		return model.NewAppError("PurgeIndexes", "postgressearchengine.purge-indexes.app-error", nil, "", http.StatusBadRequest)
	}
	pse.dropIndexIfExists("idx_posts_message_txt")
	pse.dropIndexIfExists("idx_posts_hashtags_txt")
	pse.dropIndexIfExists("idx_channel_search_txt")
	pse.dropIndexIfExists("idx_publicchannels_search_txt")
	pse.dropIndexIfExists("idx_users_all_txt")
	pse.dropIndexIfExists("idx_users_all_no_full_name_txt")
	pse.dropIndexIfExists("idx_users_names_txt")
	pse.dropIndexIfExists("idx_users_names_no_full_name_txt")
	return nil
}
