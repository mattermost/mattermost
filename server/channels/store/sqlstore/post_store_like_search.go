// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"
	"strings"

	sq "github.com/mattermost/squirrel"

	"github.com/mattermost/mattermost/server/public/model"
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

func (s *SqlPostStore) generateLikeSearchQueryForPosts(baseQuery sq.SelectBuilder, params *model.SearchParams, phrases []string, terms string, excludedTerms string, excludedPhrases []string, searchType string) sq.SelectBuilder {
	var searchClauses []string
	var searchArgs []any

	// Make both index and query lowercase for case-insensitive searching.
	phrases, terms, excludedTerms, excludedPhrases, searchType = toLowerSearchArgsForPosts(phrases, terms, excludedTerms, excludedPhrases, searchType)

	// Phrase search: search for strings enclosed in “” without splitting them.
	searchClauses, searchArgs = buildPhrasesQuery(phrases, searchType, searchClauses, searchArgs)

	// Normal search by word
	termWords := strings.Fields(terms)
	searchClauses, searchArgs = buildTermsQuery(termWords, searchType, searchClauses, searchArgs)

	if len(searchClauses) > 0 {
		logicalOperator := " AND "
		if params.OrTerms {
			logicalOperator = " OR "
		}
		baseQuery = baseQuery.Where("("+strings.Join(searchClauses, logicalOperator)+")", searchArgs...)
	}

	// Excluded words
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
