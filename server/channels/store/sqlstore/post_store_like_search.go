// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"
	"strings"
	"sync"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (s *SqlPostStore) likesearch(teamId string, userId string, params *model.SearchParams, channelsByName bool, userByUsername bool) (*model.PostList, error) {
	list := model.NewPostList()
	if params.Terms == "" && params.ExcludedTerms == "" &&
		len(params.InChannels) == 0 && len(params.ExcludedChannels) == 0 &&
		len(params.FromUsers) == 0 && len(params.ExcludedUsers) == 0 &&
		params.OnDate == "" && params.AfterDate == "" && params.BeforeDate == "" {
		return list, nil
	}

	baseQuery := s.getQueryBuilder().Select(
		"*",
		"(SELECT COUNT(*) FROM Posts WHERE Posts.RootId = (CASE WHEN q2.RootId = '' THEN q2.Id ELSE q2.RootId END) AND Posts.DeleteAt = 0) as ReplyCount",
	).From("Posts q2").
		Where("q2.DeleteAt = 0").
		Where(fmt.Sprintf("q2.Type NOT LIKE '%s%%'", model.PostSystemMessagePrefix)).
		OrderByClause("q2.CreateAt DESC").
		Limit(100)

	var err error
	baseQuery, err = s.buildSearchPostFilterClause(teamId, params.FromUsers, params.ExcludedUsers, userByUsername, baseQuery)
	if err != nil {
		return nil, errors.Wrap(err, "failed to build search post filter clause")
	}
	baseQuery = s.buildCreateDateFilterClause(params, baseQuery)

	termMap := map[string]bool{}
	terms := params.Terms
	excludedTerms := params.ExcludedTerms

	searchType := "Message"
	if params.IsHashtag {
		searchType = "Hashtags"
		for term := range strings.SplitSeq(terms, " ") {
			termMap[strings.ToUpper(term)] = true
		}
	}

	for _, c := range s.specialSearchChars() {
		if !params.IsHashtag {
			terms = strings.Replace(terms, c, " ", -1)
		}
		excludedTerms = strings.Replace(excludedTerms, c, " ", -1)
	}

	if terms == "" && excludedTerms == "" {
		// we've already confirmed that we have a channel or user to search for
	} else {
		//  ワイルドカードをLIKE句の検索用に変換
		terms = wildCardRegex.ReplaceAllLiteralString(terms, "%")
		excludedTerms = wildCardRegex.ReplaceAllLiteralString(excludedTerms, "%")

		var searchClauses []string
		var searchArgs []any

		phrases := quotedStringsRegex.FindAllString(terms, -1)
		terms = quotedStringsRegex.ReplaceAllString(terms, " ")

		//フレーズ検索に対応
		for _, phrase := range phrases {
			cleanPhrase := strings.Trim(phrase, `"`)
			if cleanPhrase != "" {
				searchClauses = append(searchClauses, fmt.Sprintf("%s LIKE ?", searchType))
				searchArgs = append(searchArgs, "%"+cleanPhrase+"%")
			}
		}

		termWords := strings.Fields(terms)
		if len(termWords) > 0 {
			for _, word := range termWords {
				//前方一致検索のみ対応
				if strings.HasSuffix(word, "%") {
					searchClauses = append(searchClauses, fmt.Sprintf("%s LIKE ?", searchType))
					searchArgs = append(searchArgs, word)
				} else {
					searchClauses = append(searchClauses, fmt.Sprintf("%s LIKE ?", searchType))
					searchArgs = append(searchArgs, "%"+word+"%")
				}
			}
		}

		logicalOperator := " AND "
		if params.OrTerms {
			logicalOperator = " OR "
		}

		baseQuery = baseQuery.Where("("+strings.Join(searchClauses, logicalOperator)+")", searchArgs...)

		excludedWords := strings.Fields(excludedTerms)
		if len(excludedWords) > 0 {
			var excludedClauses []string
			var excludedArgs []any
			for _, word := range excludedWords {
				cleanWord := strings.TrimPrefix(strings.Trim(word, `"`), "-")
				if cleanWord == "" {
					continue
				}
				if strings.HasSuffix(cleanWord, "%") {
					excludedClauses = append(excludedClauses, fmt.Sprintf("%s NOT LIKE ?", searchType))
					excludedArgs = append(excludedArgs, cleanWord)
				} else {
					excludedClauses = append(excludedClauses, fmt.Sprintf("%s NOT LIKE ?", searchType))
					excludedArgs = append(excludedArgs, "%"+cleanWord+"%")
				}
			}
			baseQuery = baseQuery.Where(strings.Join(excludedClauses, " AND "), excludedArgs...)
		}
	}

	inQuery := s.getSubQueryBuilder().Select("Id").
		From("Channels, ChannelMembers").
		Where("Id = ChannelId")

	if !params.IncludeDeletedChannels {
		inQuery = inQuery.Where("Channels.DeleteAt = 0")
	}

	if !params.SearchWithoutUserId {
		inQuery = inQuery.Where("ChannelMembers.UserId = ?", userId)
	}

	inQuery = s.buildSearchTeamFilterClause(teamId, inQuery)
	inQuery = s.buildSearchChannelFilterClause(params.InChannels, false, channelsByName, inQuery)
	inQuery = s.buildSearchChannelFilterClause(params.ExcludedChannels, true, channelsByName, inQuery)

	inQueryClause, inQueryClauseArgs, err := inQuery.ToSql()
	if err != nil {
		return nil, err
	}

	baseQuery = baseQuery.Where(fmt.Sprintf("ChannelId IN (%s)", inQueryClause), inQueryClauseArgs...)

	searchQuery, searchQueryArgs, err := baseQuery.ToSql()
	if err != nil {
		return nil, err
	}

	var posts []*model.Post

	if err := s.GetSearchReplicaX().Select(&posts, searchQuery, searchQueryArgs...); err != nil {
		mlog.Warn("Query error searching posts.", mlog.String("error", trimInput(err.Error())))
		// Don't return the error to the caller as it is of no use to the user. Instead return an empty set of search results.
	} else {
		for _, p := range posts {
			if searchType == "Hashtags" {
				exactMatch := false
				for tag := range strings.SplitSeq(p.Hashtags, " ") {
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

func (s *SqlPostStore) LikeSearchPostsForUser(rctx request.CTX, paramsList []*model.SearchParams, userId, teamId string, page, perPage int) (*model.PostSearchResults, error) {
	// Since we don't support paging for DB search, we just return nothing for later pages
	if page > 0 {
		return model.MakePostSearchResults(model.NewPostList(), nil), nil
	}

	if err := model.IsSearchParamsListValid(paramsList); err != nil {
		return nil, err
	}

	var wg sync.WaitGroup

	pchan := make(chan store.StoreResult[*model.PostList], len(paramsList))

	for _, params := range paramsList {
		// remove any unquoted term that contains only non-alphanumeric chars
		// ex: abcd "**" && abc     >>     abcd "**" abc
		params.Terms = removeNonAlphaNumericUnquotedTerms(params.Terms, " ")

		wg.Add(1)

		go func(params *model.SearchParams) {
			defer wg.Done()
			postList, err := s.likesearch(teamId, userId, params, false, false)
			pchan <- store.StoreResult[*model.PostList]{Data: postList, NErr: err}
		}(params)
	}

	wg.Wait()
	close(pchan)

	posts := model.NewPostList()

	for result := range pchan {
		if result.NErr != nil {
			return nil, result.NErr
		}
		posts.Extend(result.Data)
	}

	posts.SortByCreateAt()

	return model.MakePostSearchResults(posts, nil), nil
}
