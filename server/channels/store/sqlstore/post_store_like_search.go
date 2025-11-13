// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"
	"strings"

	"github.com/pkg/errors"

	sq "github.com/mattermost/squirrel"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func addWildcardToTerm(term string, alwaysMiddleMatch bool) string {
	// Accept prefix search when wildcard are in the appropriate position, otherwise treat as middle match.
	// Suffix is only considered when the alwaysMiddleMatch is false.
	if !strings.HasSuffix(term, "*") || alwaysMiddleMatch {
		term = "%" + term + "%"
	} else {
		term = strings.TrimSuffix(term, "*") + "%"
	}
	return term
}

func toLowerSearchArgsForPosts(phrases []string, terms string, excludedTerms string, excludedPhrases []string, searchType string) ([]string, string, string, []string, string) {
	for i, p := range phrases {
		phrases[i] = strings.ToLower(p)
	}
	terms = strings.ToLower(terms)
	excludedTerms = strings.ToLower(excludedTerms)
	for i, p := range excludedPhrases {
		excludedPhrases[i] = strings.ToLower(p)
	}

	searchType = fmt.Sprintf("LOWER(%s)", searchType)

	return phrases, terms, excludedTerms, excludedPhrases, searchType
}

func toLowerHashtagTerms(hashtagTerm []string, searchType string) ([]string, string) {
	for i, term := range hashtagTerm {
		hashtagTerm[i] = strings.ToLower(term)
	}

	searchType = fmt.Sprintf("LOWER(%s)", searchType)

	return hashtagTerm, searchType
}

func buildPhrasesQuery(phrases []string, searchType string, searchClauses []string, searchArgs []any) ([]string, []any) {
	for _, phrase := range phrases {
		cleanPhrase := strings.Trim(phrase, `"`)
		if cleanPhrase == "" {
			continue
		}
		searchClauses = append(searchClauses, fmt.Sprintf("%s LIKE ? ESCAPE '\\'", searchType))
		searchArgs = append(searchArgs, addWildcardToTerm(cleanPhrase, true))
	}
	return searchClauses, searchArgs
}

func buildTermsQuery(terms []string, searchType string, searchClauses []string, searchArgs []any) ([]string, []any) {
	for _, term := range terms {
		// Hashtags and mentions are searched with or without the prefix (# or @).
		if strings.HasPrefix(term, "#") || strings.HasPrefix(term, "@") {
			searchClauses = append(searchClauses, fmt.Sprintf("(%[1]s LIKE ? ESCAPE '\\' OR %[1]s LIKE ? ESCAPE '\\')", searchType))
			searchArgs = append(searchArgs, addWildcardToTerm(term, true), addWildcardToTerm(term[1:], true))
		} else {
			searchClauses = append(searchClauses, fmt.Sprintf("%s LIKE ? ESCAPE '\\'", searchType))
			searchArgs = append(searchArgs, addWildcardToTerm(term, false))
		}
	}
	return searchClauses, searchArgs
}

func buildExcludedTermsQuery(excludedWords []string, searchType string, excludedClauses []string, excludedArgs []any) ([]string, []any) {
	for _, word := range excludedWords {
		cleanWord := strings.TrimPrefix(word, "-")
		if cleanWord == "" {
			continue
		}
		if strings.HasPrefix(cleanWord, "#") || strings.HasPrefix(cleanWord, "@") {
			excludedClauses = append(excludedClauses, fmt.Sprintf("(%[1]s NOT LIKE ? ESCAPE '\\' AND %[1]s NOT LIKE ? ESCAPE '\\')", searchType))
			excludedArgs = append(excludedArgs, addWildcardToTerm(cleanWord, true), addWildcardToTerm(cleanWord[1:], true))
		} else {
			excludedClauses = append(excludedClauses, fmt.Sprintf("%s NOT LIKE ? ESCAPE '\\'", searchType))
			excludedArgs = append(excludedArgs, addWildcardToTerm(cleanWord, false))
		}
	}
	return excludedClauses, excludedArgs
}

func buildExcludedPhrasesQuery(excludedPhrases []string, searchType string, excludedClauses []string, excludedArgs []any) ([]string, []any) {
	for _, phrase := range excludedPhrases {
		cleanPhrase := strings.Trim(phrase, `"`)
		if cleanPhrase == "" {
			continue
		}
		excludedClauses = append(excludedClauses, fmt.Sprintf("%s NOT LIKE ? ESCAPE '\\'", searchType))
		excludedArgs = append(excludedArgs, addWildcardToTerm(cleanPhrase, true))
	}
	return excludedClauses, excludedArgs
}

/**
This function builds queried with certain SQL condition for exact hashtag matching

 * For exact hashtag matching, we need to match the tag as a complete token
 * Hashtags are stored in DB with spaces: " #tag1 #tag2 #tag3"
 * We need to match: " #tag " (middle), " #tag" (end), or "#tag " (start)
 */
func buildHashtagQuery(hashtagTerms []string, searchType string, searchClauses []string, searchArgs []any) ([]string, []any) {
	for _, term := range hashtagTerms {
		if !strings.HasPrefix(term, "#") {
			continue
		}

		// Build OR condition for: start, middle, or end position
		hashtagClause := fmt.Sprintf("(%[1]s LIKE ? ESCAPE '\\' OR %[1]s LIKE ? ESCAPE '\\' OR %[1]s = ?)", searchType)
		searchClauses = append(searchClauses, hashtagClause)

		// " #tag " - tag in the middle or alone with surrounding spaces
		searchArgs = append(searchArgs, "% "+term+" %")
		// " #tag" - tag at the end
		searchArgs = append(searchArgs, "% "+term)
		// " #tag " - tag at the start or standalone (exact match with one trailing space)
		searchArgs = append(searchArgs, " "+term+" ")
	}
	return searchClauses, searchArgs
}

/*
The query built in this func assumes the existence of a functional index of LOWER() using pg_bigm.
*/
func (s *SqlPostStore) generateLikeSearchQueryForPosts(baseQuery sq.SelectBuilder, params *model.SearchParams, hashtagTerms, phrases, excludedPhrases []string, terms, excludedTerms string) sq.SelectBuilder {
	var searchClauses []string
	var searchArgs []any
	var searchType string

	if len(hashtagTerms) > 0 {
		searchType = "Hashtags"
		// support case-insensitive search like non-hashtag term
		hashtagTerms, searchType = toLowerHashtagTerms(hashtagTerms, searchType)
		searchClauses, searchArgs = buildHashtagQuery(hashtagTerms, searchType, searchClauses, searchArgs)
	}

	searchType = "Message"

	// Make args lowercase for case-insensitive search.
	phrases, terms, excludedTerms, excludedPhrases, searchType = toLowerSearchArgsForPosts(phrases, terms, excludedTerms, excludedPhrases, searchType)

	// Phrase: strings enclosed in “” without splitting them.
	searchClauses, searchArgs = buildPhrasesQuery(phrases, searchType, searchClauses, searchArgs)

	termWords := strings.Fields(terms)
	searchClauses, searchArgs = buildTermsQuery(termWords, searchType, searchClauses, searchArgs)

	if len(searchClauses) > 0 {
		logicalOperator := " AND "
		if params.OrTerms {
			logicalOperator = " OR "
		}
		baseQuery = baseQuery.Where("("+strings.Join(searchClauses, logicalOperator)+")", searchArgs...)
	}

	excludedWords := strings.Fields(excludedTerms)
	if len(excludedWords) > 0 || len(excludedPhrases) > 0 {
		var excludedClauses []string
		var excludedArgs []any

		excludedClauses, excludedArgs = buildExcludedTermsQuery(excludedWords, searchType, excludedClauses, excludedArgs)
		excludedClauses, excludedArgs = buildExcludedPhrasesQuery(excludedPhrases, searchType, excludedClauses, excludedArgs)

		if len(excludedClauses) > 0 {
			baseQuery = baseQuery.Where(strings.Join(excludedClauses, " AND "), excludedArgs...)
		}
	}



	return baseQuery
}

/**
 * This function is an alternative to `search()` for replacing queries with like searches.
 * Additionally, to support pagination, it has been modified to accepts params as a list and adds page and perpage arguments.
*/
func (s *SqlPostStore) likesearch(teamId string, userId string, paramsList []*model.SearchParams, channelsByName bool, userByUsername bool, page, perPage int) (*model.PostList, error) {
	list := model.NewPostList()

	// check if all params are empty
	allEmpty := true
	for _, params := range paramsList {
		if !(params.Terms == "" && params.ExcludedTerms == "" &&
		len(params.InChannels) == 0 && len(params.ExcludedChannels) == 0 &&
		len(params.FromUsers) == 0 && len(params.ExcludedUsers) == 0 &&
		params.OnDate == "" && params.AfterDate == "" && params.BeforeDate == "") {
			allEmpty = false
			break
		}
	}
	if allEmpty {
		return list, nil
	}

	// Use perPage for limit, default to 60 if not specified
	limit := uint64(perPage)
	if perPage <= 0 {
		limit = 60
	}
	// Fetch N+1 results to determine if there are more pages (HasNext)
	fetchLimit := limit + 1

	baseQuery := s.getQueryBuilder().Select(
		"*",
		"(SELECT COUNT(*) FROM Posts WHERE Posts.RootId = (CASE WHEN q2.RootId = '' THEN q2.Id ELSE q2.RootId END) AND Posts.DeleteAt = 0) as ReplyCount",
	).From("Posts q2").
		Where("q2.DeleteAt = 0").
		Where(fmt.Sprintf("q2.Type NOT LIKE '%s%%'", model.PostSystemMessagePrefix)).
		OrderByClause("q2.CreateAt DESC").
		Limit(fetchLimit)
		
	if page > 0 {
		baseQuery = baseQuery.Offset(uint64(page) * limit)
	}

	// Use the first params for common filters (channel, date, user filters are same across all params)
	params := paramsList[0]

	var err error
	baseQuery, err = s.buildSearchPostFilterClause(teamId, params.FromUsers, params.ExcludedUsers, userByUsername, baseQuery)
	if err != nil {
		return nil, errors.Wrap(err, "failed to build search post filter clause")
	}
	baseQuery = s.buildCreateDateFilterClause(params, baseQuery)

	var allTerms []string
	var allExcludedTerms []string
	var hashtagTerms []string

	// Combine the Terms & excludedTerms stored within each params into a single entity
	for _, params := range paramsList {
		// terms := params.Terms
		// excludedTerms := params.ExcludedTerms

		if params.IsHashtag {
			for term := range strings.SplitSeq(params.Terms, " ") {
				if term != "" {
					hashtagTerms = append(hashtagTerms, term)
				}
			}
		} else if params.Terms != "" {
			allTerms = append(allTerms, params.Terms)
		}

		if params.ExcludedTerms != "" {
			allExcludedTerms = append(allExcludedTerms, params.ExcludedTerms)
		}
	}

	terms := strings.Join(allTerms, " ")
	excludedTerms := strings.Join(allExcludedTerms, " ")

	if terms == "" && excludedTerms == "" && len(hashtagTerms) == 0 {
		// we've already confirmed that we have a channel or user to search for
	} else {
		// Query generation customized for Japanese by bypassing the original implementation
		// build LIKE search query using pg_bigm index

		// Escape wildcards of LIKE searches used within strings with a backslash("\").
		terms = sanitizeSearchTerm(terms, "\\")
		excludedTerms = sanitizeSearchTerm(excludedTerms, "\\")

		phrases := quotedStringsRegex.FindAllString(terms, -1)
		terms = quotedStringsRegex.ReplaceAllString(terms, " ")
		excludedPhrases := quotedStringsRegex.FindAllString(excludedTerms, -1)
		excludedTerms = quotedStringsRegex.ReplaceAllLiteralString(excludedTerms, " ")

		baseQuery = s.generateLikeSearchQueryForPosts(baseQuery, params, hashtagTerms, phrases, excludedPhrases, terms, excludedTerms)
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
		// Check if we got more results than requested (N+1(=fetchlimit) pattern for HasNext)
		hasNext := len(posts) > int(limit)
		if hasNext {
			// Remove the extra post we fetched
			posts = posts[:limit]
		}

		for _, p := range posts {
			list.AddPost(p)
			list.AddOrder(p.Id)
		}

		// Set HasNext flag on the list of result
		list.HasNext = &hasNext
	}
	list.MakeNonNil()
	return list, nil
}
