// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"
	"strings"

	sq "github.com/mattermost/squirrel"

	"github.com/mattermost/mattermost/server/public/model"
)

func (s *SqlPostStore) generateLikeSearchQuery(baseQuery sq.SelectBuilder, params *model.SearchParams, phrases []string, terms string, excludedTerms string, searchType string) sq.SelectBuilder {
	var searchClauses []string
	var searchArgs []any

	// Make both the index and query lowercase for case-insensitive searching.
	searchType = fmt.Sprintf("LOWER(%s)", searchType)
	terms = strings.ToLower(terms)
	excludedTerms = strings.ToLower(excludedTerms)
	for i, p := range phrases {
		phrases[i] = strings.ToLower(p)
	}

	// Phrase search: search for strings enclosed in “” without splitting them.
	for _, phrase := range phrases {
		cleanPhrase := strings.Trim(phrase, `"`)
		if cleanPhrase != "" {
			searchClauses = append(searchClauses, fmt.Sprintf("%s LIKE ?", searchType))
			searchArgs = append(searchArgs, "%"+cleanPhrase+"%")
		}
	}

	termWords := strings.Fields(terms)
	for _, word := range termWords {
		// Hashtags and mentions are searched with or without the prefix (# or @).
		// Since these are always searched from the front, wildcards are not checked.
		if strings.HasPrefix(word, "#") || strings.HasPrefix(word, "@") {
			searchClauses = append(searchClauses, fmt.Sprintf("(%s LIKE ? OR %s LIKE ?)", searchType, searchType))
			searchArgs = append(searchArgs, "%"+word+"%", "%"+word[1:]+"%")
		} else {
			// Accept prefix search when wildcard are in the appropriate position, otherwise treat as middle match.
			if !strings.HasSuffix(word, "%") {
				word = "%" + word + "%"
			}
			searchClauses = append(searchClauses, fmt.Sprintf("%s LIKE ?", searchType))
			searchArgs = append(searchArgs, word)
		}
	}

	if len(searchClauses) > 0 {
		logicalOperator := " AND "
		if params.OrTerms {
			logicalOperator = " OR "
		}
		baseQuery = baseQuery.Where("("+strings.Join(searchClauses, logicalOperator)+")", searchArgs...)
	}

	// Handle excluded words
	excludedWords := strings.Fields(excludedTerms)
	if len(excludedWords) > 0 {
		var excludedClauses []string
		var excludedArgs []any
		for _, word := range excludedWords {
			cleanWord := strings.TrimPrefix(strings.Trim(word, `"`), "-")
			if cleanWord == "" {
				continue
			}
			if strings.HasPrefix(cleanWord, "#") || strings.HasPrefix(cleanWord, "@") {
				excludedClauses = append(excludedClauses, fmt.Sprintf("(%s NOT LIKE ? AND %s NOT LIKE ?)", searchType, searchType))
				excludedArgs = append(excludedArgs, "%"+cleanWord+"%", "%"+cleanWord[1:]+"%")
			} else {
				if !strings.HasSuffix(cleanWord, "%") {
					cleanWord = "%" + cleanWord + "%"
				}
				excludedClauses = append(excludedClauses, fmt.Sprintf("%s NOT LIKE ?", searchType))
				excludedArgs = append(excludedArgs, cleanWord)
			}
		}
		if len(excludedClauses) > 0 {
			baseQuery = baseQuery.Where(strings.Join(excludedClauses, " AND "), excludedArgs...)
		}
	}
	return baseQuery
}
