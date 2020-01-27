// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package pglayer

import (
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
	"github.com/mattermost/mattermost-server/v5/utils"
)

type PgPostStore struct {
	sqlstore.SqlPostStore
}

var specialSearchChar = []string{
	"<",
	">",
	"+",
	"-",
	"(",
	")",
	"~",
	"@",
	":",
}

func (s *PgPostStore) Save(post *model.Post) (*model.Post, *model.AppError) {
	if len(post.Id) > 0 {
		return nil, model.NewAppError("SqlPostStore.Save", "store.sql_post.save.existing.app_error", nil, "id="+post.Id, http.StatusBadRequest)
	}

	maxPostSize := s.GetMaxPostSize()

	post.PreSave()
	if err := post.IsValid(maxPostSize); err != nil {
		return nil, err
	}

	if err := s.GetMaster().Insert(post); err != nil {
		return nil, model.NewAppError("SqlPostStore.Save", "store.sql_post.save.app_error", nil, "id="+post.Id+", "+err.Error(), http.StatusInternalServerError)
	}

	time := post.UpdateAt

	if !post.IsJoinLeaveMessage() {
		if _, err := s.GetMaster().Exec("UPDATE Channels SET LastPostAt = GREATEST(:LastPostAt, LastPostAt), TotalMsgCount = TotalMsgCount + 1 WHERE Id = :ChannelId", map[string]interface{}{"LastPostAt": time, "ChannelId": post.ChannelId}); err != nil {
			mlog.Error("Error updating Channel LastPostAt.", mlog.Err(err))
		}
	} else {
		// don't update TotalMsgCount for unimportant messages so that the channel isn't marked as unread
		if _, err := s.GetMaster().Exec("UPDATE Channels SET LastPostAt = :LastPostAt WHERE Id = :ChannelId AND LastPostAt < :LastPostAt", map[string]interface{}{"LastPostAt": time, "ChannelId": post.ChannelId}); err != nil {
			mlog.Error("Error updating Channel LastPostAt.", mlog.Err(err))
		}
	}

	if len(post.RootId) > 0 {
		if _, err := s.GetMaster().Exec("UPDATE Posts SET UpdateAt = :UpdateAt WHERE Id = :RootId", map[string]interface{}{"UpdateAt": time, "RootId": post.RootId}); err != nil {
			mlog.Error("Error updating Post UpdateAt.", mlog.Err(err))
		}
	}

	return post, nil
}

func (s *PgPostStore) Update(newPost *model.Post, oldPost *model.Post) (*model.Post, *model.AppError) {
	newPost.UpdateAt = model.GetMillis()
	newPost.PreCommit()

	oldPost.DeleteAt = newPost.UpdateAt
	oldPost.UpdateAt = newPost.UpdateAt
	oldPost.OriginalId = oldPost.Id
	oldPost.Id = model.NewId()
	oldPost.PreCommit()

	maxPostSize := s.GetMaxPostSize()

	if err := newPost.IsValid(maxPostSize); err != nil {
		return nil, err
	}

	if _, err := s.GetMaster().Update(newPost); err != nil {
		return nil, model.NewAppError("SqlPostStore.Update", "store.sql_post.update.app_error", nil, "id="+newPost.Id+", "+err.Error(), http.StatusInternalServerError)
	}

	time := model.GetMillis()
	s.GetMaster().Exec("UPDATE Channels SET LastPostAt = :LastPostAt  WHERE Id = :ChannelId AND LastPostAt < :LastPostAt", map[string]interface{}{"LastPostAt": time, "ChannelId": newPost.ChannelId})

	if len(newPost.RootId) > 0 {
		s.GetMaster().Exec("UPDATE Posts SET UpdateAt = :UpdateAt WHERE Id = :RootId AND UpdateAt < :UpdateAt", map[string]interface{}{"UpdateAt": time, "RootId": newPost.RootId})
	}

	// mark the old post as deleted
	s.GetMaster().Insert(oldPost)

	return newPost, nil
}

func (s *PgPostStore) Overwrite(post *model.Post) (*model.Post, *model.AppError) {
	post.UpdateAt = model.GetMillis()

	maxPostSize := s.GetMaxPostSize()
	if appErr := post.IsValid(maxPostSize); appErr != nil {
		return nil, appErr
	}

	if _, err := s.GetMaster().Update(post); err != nil {
		return nil, model.NewAppError("SqlPostStore.Overwrite", "store.sql_post.overwrite.app_error", nil, "id="+post.Id+", "+err.Error(), http.StatusInternalServerError)
	}

	return post, nil
}

func (s *PgPostStore) GetMaxPostSize() int {
	s.MaxPostSizeOnce.Do(func() {
		s.MaxPostSizeCached = s.determineMaxPostSize()
	})
	return s.MaxPostSizeCached
}

func (s *PgPostStore) determineMaxPostSize() int {
	var maxPostSizeBytes int32

	// The Post.Message column in Postgres has historically been VARCHAR(4000), but
	// may be manually enlarged to support longer posts.
	if err := s.GetReplica().SelectOne(&maxPostSizeBytes, `
		SELECT
			COALESCE(character_maximum_length, 0)
		FROM
			information_schema.columns
		WHERE
			table_name = 'posts'
		AND	column_name = 'message'
	`); err != nil {
		mlog.Error("Unable to determine the maximum supported post size", mlog.Err(err))
	}

	// Assume a worst-case representation of four bytes per rune.
	maxPostSize := int(maxPostSizeBytes) / 4

	// To maintain backwards compatibility, don't yield a maximum post
	// size smaller than the previous limit, even though it wasn't
	// actually possible to store 4000 runes in all cases.
	if maxPostSize < model.POST_MESSAGE_MAX_RUNES_V1 {
		maxPostSize = model.POST_MESSAGE_MAX_RUNES_V1
	}

	mlog.Info("Post.Message has size restrictions", mlog.Int("max_characters", maxPostSize), mlog.Int32("max_bytes", maxPostSizeBytes))

	return maxPostSize
}

func (s *PgPostStore) PermanentDeleteBatch(endTime int64, limit int64) (int64, *model.AppError) {
	query := "DELETE from Posts WHERE Id = any (array (SELECT Id FROM Posts WHERE CreateAt < :EndTime LIMIT :Limit))"

	sqlResult, err := s.GetMaster().Exec(query, map[string]interface{}{"EndTime": endTime, "Limit": limit})
	if err != nil {
		return 0, model.NewAppError("SqlPostStore.PermanentDeleteBatch", "store.sql_post.permanent_delete_batch.app_error", nil, ""+err.Error(), http.StatusInternalServerError)
	}

	rowsAffected, err := sqlResult.RowsAffected()
	if err != nil {
		return 0, model.NewAppError("SqlPostStore.PermanentDeleteBatch", "store.sql_post.permanent_delete_batch.app_error", nil, ""+err.Error(), http.StatusInternalServerError)
	}
	return rowsAffected, nil
}

func (s *PgPostStore) AnalyticsPostCountsByDay(options *model.AnalyticsPostCountsOptions) (model.AnalyticsRows, *model.AppError) {
	query :=
		`SELECT
			TO_CHAR(DATE(TO_TIMESTAMP(Posts.CreateAt / 1000)), 'YYYY-MM-DD') AS Name, Count(Posts.Id) AS Value
		FROM Posts`

	if options.BotsOnly {
		query += " INNER JOIN Bots ON Posts.UserId = Bots.Userid"
	}

	if len(options.TeamId) > 0 {
		query += " INNER JOIN Channels ON Posts.ChannelId = Channels.Id  AND Channels.TeamId = :TeamId AND"
	} else {
		query += " WHERE"
	}

	query += ` Posts.CreateAt <= :EndTime
					AND Posts.CreateAt >= :StartTime
		GROUP BY DATE(TO_TIMESTAMP(Posts.CreateAt / 1000))
		ORDER BY Name DESC
		LIMIT 30`

	end := utils.MillisFromTime(utils.EndOfDay(utils.Yesterday()))
	start := utils.MillisFromTime(utils.StartOfDay(utils.Yesterday().AddDate(0, 0, -31)))
	if options.YesterdayOnly {
		start = utils.MillisFromTime(utils.StartOfDay(utils.Yesterday().AddDate(0, 0, -1)))
	}

	var rows model.AnalyticsRows
	_, err := s.GetReplica().Select(
		&rows,
		query,
		map[string]interface{}{"TeamId": options.TeamId, "StartTime": start, "EndTime": end})
	if err != nil {
		return nil, model.NewAppError("SqlPostStore.AnalyticsPostCountsByDay", "store.sql_post.analytics_posts_count_by_day.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return rows, nil
}

func (s *PgPostStore) AnalyticsUserCountsWithPostsByDay(teamId string) (model.AnalyticsRows, *model.AppError) {
	query :=
		`SELECT
			TO_CHAR(DATE(TO_TIMESTAMP(Posts.CreateAt / 1000)), 'YYYY-MM-DD') AS Name, COUNT(DISTINCT Posts.UserId) AS Value
		FROM Posts`

	if len(teamId) > 0 {
		query += " INNER JOIN Channels ON Posts.ChannelId = Channels.Id AND Channels.TeamId = :TeamId AND"
	} else {
		query += " WHERE"
	}

	query += ` Posts.CreateAt >= :StartTime AND Posts.CreateAt <= :EndTime
		GROUP BY DATE(TO_TIMESTAMP(Posts.CreateAt / 1000))
		ORDER BY Name DESC
		LIMIT 30`

	end := utils.MillisFromTime(utils.EndOfDay(utils.Yesterday()))
	start := utils.MillisFromTime(utils.StartOfDay(utils.Yesterday().AddDate(0, 0, -31)))

	var rows model.AnalyticsRows
	_, err := s.GetReplica().Select(
		&rows,
		query,
		map[string]interface{}{"TeamId": teamId, "StartTime": start, "EndTime": end})
	if err != nil {
		return nil, model.NewAppError("SqlPostStore.AnalyticsUserCountsWithPostsByDay", "store.sql_post.analytics_user_counts_posts_by_day.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return rows, nil
}

func (s *PgPostStore) buildSearchUserFilterClause(users []string, paramPrefix string, exclusion bool, queryParams map[string]interface{}) (string, map[string]interface{}) {
	if len(users) == 0 {
		return "", queryParams
	}
	clauseSlice := []string{}
	for i, user := range users {
		paramName := paramPrefix + strconv.FormatInt(int64(i), 10)
		clauseSlice = append(clauseSlice, ":"+paramName)
		queryParams[paramName] = user
	}
	clause := strings.Join(clauseSlice, ", ")
	if exclusion {
		return "AND Username NOT IN (" + clause + ")", queryParams
	}
	return "AND Username IN (" + clause + ")", queryParams
}

func (s *PgPostStore) buildSearchPostFilterClause(fromUsers []string, excludedUsers []string, queryParams map[string]interface{}) (string, map[string]interface{}) {
	if len(fromUsers) == 0 && len(excludedUsers) == 0 {
		return "", queryParams
	}

	filterQuery := `
		AND UserId IN (
			SELECT
				Id
			FROM
				Users,
				TeamMembers
			WHERE
				TeamMembers.TeamId = :TeamId
				AND Users.Id = TeamMembers.UserId
				FROM_USER_FILTER
				EXCLUDED_USER_FILTER)`

	fromUserClause, queryParams := s.buildSearchUserFilterClause(fromUsers, "FromUser", false, queryParams)
	filterQuery = strings.Replace(filterQuery, "FROM_USER_FILTER", fromUserClause, 1)

	excludedUserClause, queryParams := s.buildSearchUserFilterClause(excludedUsers, "ExcludedUser", true, queryParams)
	filterQuery = strings.Replace(filterQuery, "EXCLUDED_USER_FILTER", excludedUserClause, 1)

	return filterQuery, queryParams
}

func (s *PgPostStore) buildCreateDateFilterClause(params *model.SearchParams, queryParams map[string]interface{}) (string, map[string]interface{}) {
	searchQuery := ""
	// handle after: before: on: filters
	if len(params.OnDate) > 0 {
		onDateStart, onDateEnd := params.GetOnDateMillis()
		queryParams["OnDateStart"] = strconv.FormatInt(onDateStart, 10)
		queryParams["OnDateEnd"] = strconv.FormatInt(onDateEnd, 10)

		// between `on date` start of day and end of day
		searchQuery += "AND CreateAt BETWEEN :OnDateStart AND :OnDateEnd "
	} else {

		if len(params.ExcludedDate) > 0 {
			excludedDateStart, excludedDateEnd := params.GetExcludedDateMillis()
			queryParams["ExcludedDateStart"] = strconv.FormatInt(excludedDateStart, 10)
			queryParams["ExcludedDateEnd"] = strconv.FormatInt(excludedDateEnd, 10)

			searchQuery += "AND CreateAt NOT BETWEEN :ExcludedDateStart AND :ExcludedDateEnd "
		}

		if len(params.AfterDate) > 0 {
			afterDate := params.GetAfterDateMillis()
			queryParams["AfterDate"] = strconv.FormatInt(afterDate, 10)

			// greater than `after date`
			searchQuery += "AND CreateAt >= :AfterDate "
		}

		if len(params.BeforeDate) > 0 {
			beforeDate := params.GetBeforeDateMillis()
			queryParams["BeforeDate"] = strconv.FormatInt(beforeDate, 10)

			// less than `before date`
			searchQuery += "AND CreateAt <= :BeforeDate "
		}

		if len(params.ExcludedAfterDate) > 0 {
			afterDate := params.GetExcludedAfterDateMillis()
			queryParams["ExcludedAfterDate"] = strconv.FormatInt(afterDate, 10)

			searchQuery += "AND CreateAt < :ExcludedAfterDate "
		}

		if len(params.ExcludedBeforeDate) > 0 {
			beforeDate := params.GetExcludedBeforeDateMillis()
			queryParams["ExcludedBeforeDate"] = strconv.FormatInt(beforeDate, 10)

			searchQuery += "AND CreateAt > :ExcludedBeforeDate "
		}
	}

	return searchQuery, queryParams
}

func (s *PgPostStore) buildSearchChannelFilterClause(channels []string, paramPrefix string, exclusion bool, queryParams map[string]interface{}) (string, map[string]interface{}) {
	if len(channels) == 0 {
		return "", queryParams
	}

	clauseSlice := []string{}
	for i, channel := range channels {
		paramName := paramPrefix + strconv.FormatInt(int64(i), 10)
		clauseSlice = append(clauseSlice, ":"+paramName)
		queryParams[paramName] = channel
	}
	clause := strings.Join(clauseSlice, ", ")
	if exclusion {
		return "AND Name NOT IN (" + clause + ")", queryParams
	}
	return "AND Name IN (" + clause + ")", queryParams
}

func (s *PgPostStore) Search(teamId string, userId string, params *model.SearchParams) (*model.PostList, *model.AppError) {
	queryParams := map[string]interface{}{
		"TeamId": teamId,
		"UserId": userId,
	}

	list := model.NewPostList()
	if params.Terms == "" && params.ExcludedTerms == "" &&
		len(params.InChannels) == 0 && len(params.ExcludedChannels) == 0 &&
		len(params.FromUsers) == 0 && len(params.ExcludedUsers) == 0 &&
		len(params.OnDate) == 0 && len(params.AfterDate) == 0 && len(params.BeforeDate) == 0 {
		return list, nil
	}

	var posts []*model.Post

	deletedQueryPart := "AND DeleteAt = 0"
	if params.IncludeDeletedChannels {
		deletedQueryPart = ""
	}

	userIdPart := "AND UserId = :UserId"
	if params.SearchWithoutUserId {
		userIdPart = ""
	}

	searchQuery := `
			SELECT
				* ,(SELECT COUNT(Posts.Id) FROM Posts WHERE q2.RootId = '' AND Posts.RootId = q2.Id AND Posts.DeleteAt = 0) as ReplyCount
			FROM
				Posts q2
			WHERE
				DeleteAt = 0
				AND Type NOT LIKE '` + model.POST_SYSTEM_MESSAGE_PREFIX + `%'
				POST_FILTER
				AND ChannelId IN (
					SELECT
						Id
					FROM
						Channels,
						ChannelMembers
					WHERE
						Id = ChannelId
							AND (TeamId = :TeamId OR TeamId = '')
							` + userIdPart + `
							` + deletedQueryPart + `
							IN_CHANNEL_FILTER
							EXCLUDED_CHANNEL_FILTER)
				CREATEDATE_CLAUSE
				SEARCH_CLAUSE
				ORDER BY CreateAt DESC
			LIMIT 100`

	inChannelClause, queryParams := s.buildSearchChannelFilterClause(params.InChannels, "InChannel", false, queryParams)
	searchQuery = strings.Replace(searchQuery, "IN_CHANNEL_FILTER", inChannelClause, 1)

	excludedChannelClause, queryParams := s.buildSearchChannelFilterClause(params.ExcludedChannels, "ExcludedChannel", true, queryParams)
	searchQuery = strings.Replace(searchQuery, "EXCLUDED_CHANNEL_FILTER", excludedChannelClause, 1)

	postFilterClause, queryParams := s.buildSearchPostFilterClause(params.FromUsers, params.ExcludedUsers, queryParams)
	searchQuery = strings.Replace(searchQuery, "POST_FILTER", postFilterClause, 1)

	createDateFilterClause, queryParams := s.buildCreateDateFilterClause(params, queryParams)
	searchQuery = strings.Replace(searchQuery, "CREATEDATE_CLAUSE", createDateFilterClause, 1)

	termMap := map[string]bool{}
	terms := params.Terms
	excludedTerms := params.ExcludedTerms

	searchType := "Message"
	if params.IsHashtag {
		searchType = "Hashtags"
		for _, term := range strings.Split(terms, " ") {
			termMap[strings.ToUpper(term)] = true
		}
	}

	// these chars have special meaning and can be treated as spaces
	for _, c := range specialSearchChar {
		terms = strings.Replace(terms, c, " ", -1)
		excludedTerms = strings.Replace(excludedTerms, c, " ", -1)
	}

	if terms == "" && excludedTerms == "" {
		// we've already confirmed that we have a channel or user to search for
		searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", "", 1)
	} else {
		// Parse text for wildcards
		if wildcard, err := regexp.Compile(`\*($| )`); err == nil {
			terms = wildcard.ReplaceAllLiteralString(terms, ":* ")
			excludedTerms = wildcard.ReplaceAllLiteralString(excludedTerms, ":* ")
		}

		excludeClause := ""
		if excludedTerms != "" {
			excludeClause = " & !(" + strings.Join(strings.Fields(excludedTerms), " | ") + ")"
		}

		if params.OrTerms {
			queryParams["Terms"] = "(" + strings.Join(strings.Fields(terms), " | ") + ")" + excludeClause
		} else {
			queryParams["Terms"] = "(" + strings.Join(strings.Fields(terms), " & ") + ")" + excludeClause
		}

		searchClause := fmt.Sprintf("AND to_tsvector('english', %s) @@  to_tsquery('english', :Terms)", searchType)
		searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", searchClause, 1)
	}

	_, err := s.GetSearchReplica().Select(&posts, searchQuery, queryParams)
	if err != nil {
		mlog.Warn("Query error searching posts.", mlog.Err(err))
		// Don't return the error to the caller as it is of no use to the user. Instead return an empty set of search results.
	} else {
		for _, p := range posts {
			if searchType == "Hashtags" {
				exactMatch := false
				for _, tag := range strings.Split(p.Hashtags, " ") {
					if termMap[strings.ToUpper(tag)] {
						exactMatch = true
						break
					}
				}
				if !exactMatch {
					continue
				}
			}
			list.AddPost(p)
			list.AddOrder(p.Id)
		}
	}
	list.MakeNonNil()
	return list, nil
}
