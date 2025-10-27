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
	// 検索キーワードの処理
	var searchClauses []string
	var searchArgs []any

	//フレーズ検索
	for _, phrase := range phrases {
		cleanPhrase := strings.Trim(phrase, `"`)
		if cleanPhrase != "" {
			searchClauses = append(searchClauses, fmt.Sprintf("LOWER(%s) LIKE ?", searchType))
			searchArgs = append(searchArgs, "%"+strings.ToLower(cleanPhrase)+"%")
		}
	}

	//前方検索
	termWords := strings.Fields(terms)
	for _, word := range termWords {
		if strings.HasPrefix(word, "#") {
			searchClauses = append(searchClauses, fmt.Sprintf("(LOWER(%s) LIKE ? OR LOWER(%s) LIKE ?)", searchType, searchType))
			searchArgs = append(searchArgs, "%"+strings.ToLower(word)+"%", "%"+strings.ToLower(strings.TrimPrefix(word, "#"))+"%")
		} else {
			searchClauses = append(searchClauses, fmt.Sprintf("LOWER(%s) LIKE ?", searchType))
			if strings.HasSuffix(word, "%") {
				searchArgs = append(searchArgs, strings.ToLower(word))
			} else {
				searchArgs = append(searchArgs, "%"+strings.ToLower(word)+"%")
			}
		}
	}

	if len(searchClauses) > 0 {
		logicalOperator := " AND "
		if params.OrTerms {
			logicalOperator = " OR "
		}
		baseQuery = baseQuery.Where("("+strings.Join(searchClauses, logicalOperator)+")", searchArgs...)
	}

	// 除外キーワードの処理
	excludedWords := strings.Fields(excludedTerms)
	if len(excludedWords) > 0 {
		var excludedClauses []string
		var excludedArgs []any
		for _, word := range excludedWords {
			cleanWord := strings.TrimPrefix(strings.Trim(word, `"`), "-")
			if cleanWord == "" {
				continue
			}
			excludedClauses = append(excludedClauses, fmt.Sprintf("LOWER(%s) NOT LIKE ?", searchType))
			if strings.HasSuffix(cleanWord, "%") {
				excludedArgs = append(excludedArgs, strings.ToLower(cleanWord))
			} else {
				excludedArgs = append(excludedArgs, "%"+strings.ToLower(cleanWord)+"%")
			}
		}
		if len(excludedClauses) > 0 {
			baseQuery = baseQuery.Where(strings.Join(excludedClauses, " AND "), excludedArgs...)
		}
	}

	return baseQuery
}
