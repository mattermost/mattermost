package helper

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
)

type LastPostAtTimes []struct {
	Id            string
	LastPostAt    int64
	TotalMsgCount int64
}

func ChannelCreateIndexesIfNotExists(s sqlstore.SqlStore, createExtraIndexes func(s sqlstore.SqlStore)) {
	s.CreateIndexIfNotExists("idx_channels_team_id", "Channels", "TeamId")
	s.CreateIndexIfNotExists("idx_channels_name", "Channels", "Name")
	s.CreateIndexIfNotExists("idx_channels_update_at", "Channels", "UpdateAt")
	s.CreateIndexIfNotExists("idx_channels_create_at", "Channels", "CreateAt")
	s.CreateIndexIfNotExists("idx_channels_delete_at", "Channels", "DeleteAt")
	s.CreateIndexIfNotExists("idx_channelmembers_channel_id", "ChannelMembers", "ChannelId")
	s.CreateIndexIfNotExists("idx_channelmembers_user_id", "ChannelMembers", "UserId")
	s.CreateFullTextIndexIfNotExists("idx_channel_search_txt", "Channels", "Name, DisplayName, Purpose")
	s.CreateIndexIfNotExists("idx_publicchannels_team_id", "PublicChannels", "TeamId")
	s.CreateIndexIfNotExists("idx_publicchannels_name", "PublicChannels", "Name")
	s.CreateIndexIfNotExists("idx_publicchannels_delete_at", "PublicChannels", "DeleteAt")
	s.CreateFullTextIndexIfNotExists("idx_publicchannels_search_txt", "PublicChannels", "Name, DisplayName, Purpose")
	createExtraIndexes(s)
}

func ChannelUpdateLastViewedAt(s sqlstore.SqlStore,
	channelIds []string,
	userId string,
	buildQuery func(string) string,
	calculateTimes func(s sqlstore.SqlStore, times map[string]int64, lastPostAtTimes LastPostAtTimes, props map[string]interface{}, keys string, channelIds []string, userId string) (map[string]int64, *model.AppError)) (map[string]int64, *model.AppError) {
	keys, props := sqlstore.MapStringsToQueryParams(channelIds, "Channel")
	props["UserId"] = userId
	var lastPostAtTimes LastPostAtTimes

	query := buildQuery(keys)

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
	return calculateTimes(s, times, lastPostAtTimes, props, keys, channelIds, userId)
}

func ChannelAutocompleteInTeam(s sqlstore.SqlStore, teamId string, term string, includeDeleted bool, buildSearchFields func([]string, string) []string, buildFullTextClause func(string, string) (string, string)) (*model.ChannelList, *model.AppError) {
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

	if likeClause, likeTerm := channelBuildLIKEClause(s, term, "c.Name, c.DisplayName, c.Purpose", buildSearchFields); likeClause == "" {
		if _, err := s.GetReplica().Select(&channels, fmt.Sprintf(queryFormat, ""), map[string]interface{}{"TeamId": teamId}); err != nil {
			return nil, model.NewAppError("SqlChannelStore.AutocompleteInTeam", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
		}
	} else {
		// Using a UNION results in index_merge and fulltext queries and is much faster than the ref
		// query you would get using an OR of the LIKE and full-text clauses.
		fulltextClause, fulltextTerm := channelBuildFulltextClause(s, term, "c.Name, c.DisplayName, c.Purpose", buildFullTextClause)
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

func ChannelAutocompleteInTeamForSearch(s sqlstore.SqlStore, teamId string, userId string, term string, includeDeleted bool, buildSearchFields func([]string, string) []string, buildFullTextClause func(string, string) (string, string)) (*model.ChannelList, *model.AppError) {
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

	if likeClause, likeTerm := channelBuildLIKEClause(s, term, "Name, DisplayName, Purpose", buildSearchFields); likeClause == "" {
		if _, err := s.GetReplica().Select(&channels, fmt.Sprintf(queryFormat, ""), map[string]interface{}{"TeamId": teamId, "UserId": userId}); err != nil {
			return nil, model.NewAppError("SqlChannelStore.AutocompleteInTeamForSearch", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
		}
	} else {
		// Using a UNION results in index_merge and fulltext queries and is much faster than the ref
		// query you would get using an OR of the LIKE and full-text clauses.
		fulltextClause, fulltextTerm := channelBuildFulltextClause(s, term, "Name, DisplayName, Purpose", buildFullTextClause)
		likeQuery := fmt.Sprintf(queryFormat, "AND "+likeClause)
		fulltextQuery := fmt.Sprintf(queryFormat, "AND "+fulltextClause)
		query := fmt.Sprintf("(%v) UNION (%v) LIMIT 50", likeQuery, fulltextQuery)

		if _, err := s.GetReplica().Select(&channels, query, map[string]interface{}{"TeamId": teamId, "UserId": userId, "LikeTerm": likeTerm, "FulltextTerm": fulltextTerm}); err != nil {
			return nil, model.NewAppError("SqlChannelStore.AutocompleteInTeamForSearch", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
		}
	}

	directChannels, err := channelAutocompleteInTeamForSearchDirectMessages(s, userId, term, buildSearchFields)
	if err != nil {
		return nil, err
	}

	channels = append(channels, directChannels...)

	sort.Slice(channels, func(a, b int) bool {
		return strings.ToLower(channels[a].DisplayName) < strings.ToLower(channels[b].DisplayName)
	})
	return &channels, nil
}

func ChannelSearchInTeam(s sqlstore.SqlStore, teamId string, term string, includeDeleted bool, buildSearchFields func([]string, string) []string, buildFullTextClause func(string, string) (string, string)) (*model.ChannelList, *model.AppError) {
	deleteFilter := "AND c.DeleteAt = 0"
	if includeDeleted {
		deleteFilter = ""
	}

	return channelPerformSearch(s, `
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
	}, buildSearchFields, buildFullTextClause)
}

func ChannelSearchArchivedInTeam(s sqlstore.SqlStore, teamId string, term string, userId string, buildSearchFields func([]string, string) []string, buildFullTextClause func(string, string) (string, string)) (*model.ChannelList, *model.AppError) {
	publicChannels, publicErr := channelPerformSearch(s, `
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
	}, buildSearchFields, buildFullTextClause)

	privateChannels, privateErr := channelPerformSearch(s, `
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
	}, buildSearchFields, buildFullTextClause)

	output := *publicChannels
	output = append(output, *privateChannels...)

	outputErr := publicErr
	if privateErr != nil {
		outputErr = privateErr
	}

	return &output, outputErr
}

func ChannelSearchForUserInTeam(s sqlstore.SqlStore, userId string, teamId string, term string, includeDeleted bool, buildSearchFields func([]string, string) []string, buildFullTextClause func(string, string) (string, string)) (*model.ChannelList, *model.AppError) {
	deleteFilter := "AND c.DeleteAt = 0"
	if includeDeleted {
		deleteFilter = ""
	}

	return channelPerformSearch(s, `
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
	}, buildSearchFields, buildFullTextClause)
}

func ChannelSearchAllChannels(s sqlstore.SqlStore, term string, opts store.ChannelSearchOpts, buildSearchFields func([]string, string) []string, buildFullTextClause func(string, string) (string, string)) (*model.ChannelListWithTeamData, int64, *model.AppError) {
	queryString, args, err := channelSearchQuery(s, term, opts, false, buildSearchFields, buildFullTextClause).ToSql()
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
		queryString, args, err = channelSearchQuery(s, term, opts, true, buildSearchFields, buildFullTextClause).ToSql()
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

func ChannelSearchMore(s sqlstore.SqlStore, userId string, teamId string, term string, buildSearchFields func([]string, string) []string, buildFullTextClause func(string, string) (string, string)) (*model.ChannelList, *model.AppError) {
	return channelPerformSearch(s, `
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
	}, buildSearchFields, buildFullTextClause)
}

func ChannelSearchGroupChannels(s sqlstore.SqlStore, userId, term string, buildClauseAndQuery func() (string, string)) (*model.ChannelList, *model.AppError) {
	queryString, args := channelGetSearchGroupChannelsQuery(s, userId, term, buildClauseAndQuery)

	var groupChannels model.ChannelList
	if _, err := s.GetReplica().Select(&groupChannels, queryString, args); err != nil {
		return nil, model.NewAppError("SqlChannelStore.SearchGroupChannels", "store.sql_channel.search_group_channels.app_error", nil, "userId="+userId+", term="+term+", err="+err.Error(), http.StatusInternalServerError)
	}
	return &groupChannels, nil
}

func channelBuildLIKEClause(s sqlstore.SqlStore, term string, searchColumns string, buildSearchFields func([]string, string) []string) (likeClause, likeTerm string) {
	likeTerm = sanitizeSearchTerm(term, "*")
	if likeTerm == "" {
		return
	}
	// Prepare the LIKE portion of the query.
	var searchFields []string
	for _, field := range strings.Split(searchColumns, ", ") {
		searchFields = buildSearchFields(searchFields, field)
	}

	likeClause = fmt.Sprintf("(%s)", strings.Join(searchFields, " OR "))
	likeTerm += "%"
	return
}

func channelBuildFulltextClause(s sqlstore.SqlStore, term string, searchColumns string, buildFullTextClause func(string, string) (string, string)) (fulltextClause, fulltextTerm string) {
	// Copy the terms as we will need to prepare them differently for each search type.
	fulltextTerm = term
	// These chars must be treated as spaces in the fulltext query.
	for _, c := range spaceFulltextSearchChar {
		fulltextTerm = strings.Replace(fulltextTerm, c, " ", -1)
	}

	return buildFullTextClause(fulltextTerm, searchColumns)
}

func channelGetSearchGroupChannelsQuery(s sqlstore.SqlStore, userId, term string, buildClauseAndQuery func() (string, string)) (string, map[string]interface{}) {
	query, baseLikeClause := buildClauseAndQuery()
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

func channelPerformSearch(s sqlstore.SqlStore, searchQuery string, term string, parameters map[string]interface{}, buildSearchFields func([]string, string) []string, buildFullTextClause func(string, string) (string, string)) (*model.ChannelList, *model.AppError) {
	likeClause, likeTerm := channelBuildLIKEClause(s, term, "c.Name, c.DisplayName, c.Purpose", buildSearchFields)
	if likeTerm == "" {
		// If the likeTerm is empty after preparing, then don't bother searching.
		searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", "", 1)
	} else {
		parameters["LikeTerm"] = likeTerm
		fulltextClause, fulltextTerm := channelBuildFulltextClause(s, term, "c.Name, c.DisplayName, c.Purpose", buildFullTextClause)
		parameters["FulltextTerm"] = fulltextTerm
		searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", "AND ("+likeClause+" OR "+fulltextClause+")", 1)
	}

	var channels model.ChannelList

	if _, err := s.GetReplica().Select(&channels, searchQuery, parameters); err != nil {
		return nil, model.NewAppError("SqlChannelStore.Search", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
	}

	return &channels, nil
}

func channelAutocompleteInTeamForSearchDirectMessages(s sqlstore.SqlStore, userId string, term string, buildSearchFields func([]string, string) []string) ([]*model.Channel, *model.AppError) {
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

	if likeClause, likeTerm := channelBuildLIKEClause(s, term, "IU.Username, IU.Nickname", buildSearchFields); likeClause == "" {
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

func channelSearchQuery(s sqlstore.SqlStore, term string, opts store.ChannelSearchOpts, countQuery bool, buildSearchFields func([]string, string) []string, buildFullTextClause func(string, string) (string, string)) sq.SelectBuilder {
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

	query := getQueryBuilder().
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

	likeClause, likeTerm := channelBuildLIKEClause(s, term, "c.Name, c.DisplayName, c.Purpose", buildSearchFields)
	if likeTerm != "" {
		likeClause = strings.ReplaceAll(likeClause, ":LikeTerm", "?")
		fulltextClause, fulltextTerm := channelBuildFulltextClause(s, term, "c.Name, c.DisplayName, c.Purpose", buildFullTextClause)
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
