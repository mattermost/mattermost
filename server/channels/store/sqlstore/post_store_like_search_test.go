// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"strings"
	"testing"

	sq "github.com/mattermost/squirrel"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestGenerateLikeSearchQuery(t *testing.T) {
	if enableFullyParallelTests {
		t.Parallel()
	}

	s := &SqlPostStore{}

	t.Run("basic term search", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: false}
		phrases := []string{}
		terms := "hello"
		excludedTerms := ""
		excludedPhrases := []string{}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, "LOWER(Posts.Message) LIKE ? ESCAPE '\\'")
		assert.Equal(t, 1, len(args))
		assert.Equal(t, "%hello%", args[0])
	})

	t.Run("multiple terms with AND operator", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: false}
		phrases := []string{}
		terms := "hello world"
		excludedTerms := ""
		excludedPhrases := []string{}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, "LOWER(Posts.Message) LIKE ? ESCAPE '\\'")
		assert.Contains(t, sql, " AND ")
		assert.Equal(t, 2, len(args))
		assert.Equal(t, "%hello%", args[0])
		assert.Equal(t, "%world%", args[1])
	})

	t.Run("multiple terms with OR operator", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: true}
		phrases := []string{}
		terms := "hello world"
		excludedTerms := ""
		excludedPhrases := []string{}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, "LOWER(Posts.Message) LIKE ? ESCAPE '\\'")
		assert.Contains(t, sql, " OR ")
		assert.Equal(t, 2, len(args))
		assert.Equal(t, "%hello%", args[0])
		assert.Equal(t, "%world%", args[1])
	})

	t.Run("phrase search with quotes", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: false}
		phrases := []string{`"hello world"`}
		terms := ""
		excludedPhrases := []string{}
		excludedTerms := ""
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, "LOWER(Posts.Message) LIKE ? ESCAPE '\\'")
		assert.Equal(t, 1, len(args))
		assert.Equal(t, "%hello world%", args[0])
	})

	t.Run("multiple phrases", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: false}
		phrases := []string{`"hello world"`, `"test phrase"`}
		terms := ""
		excludedTerms := ""
		excludedPhrases := []string{}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, "LOWER(Posts.Message) LIKE ? ESCAPE '\\'")
		assert.Contains(t, sql, " AND ")
		assert.Equal(t, 2, len(args))
		assert.Equal(t, "%hello world%", args[0])
		assert.Equal(t, "%test phrase%", args[1])
	})

	t.Run("hashtag search with prefix", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: false}
		phrases := []string{}
		terms := "#hashtag"
		excludedTerms := ""
		excludedPhrases := []string{}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, "(LOWER(Posts.Message) LIKE ? ESCAPE '\\' OR LOWER(Posts.Message) LIKE ? ESCAPE '\\')")
		assert.Equal(t, 2, len(args))
		assert.Equal(t, "%#hashtag%", args[0])
		assert.Equal(t, "%hashtag%", args[1])
	})

	t.Run("mention search with @ prefix", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: false}
		phrases := []string{}
		terms := "@username"
		excludedTerms := ""
		excludedPhrases := []string{}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, "(LOWER(Posts.Message) LIKE ? ESCAPE '\\' OR LOWER(Posts.Message) LIKE ? ESCAPE '\\')")
		assert.Equal(t, 2, len(args))
		assert.Equal(t, "%@username%", args[0])
		assert.Equal(t, "%username%", args[1])
	})

	t.Run("multiple hashtags with OR", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: true}
		phrases := []string{}
		terms := "#tag1 #tag2"
		excludedTerms := ""
		excludedPhrases := []string{}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, " OR ")
		assert.Equal(t, 4, len(args))
		assert.Equal(t, "%#tag1%", args[0])
		assert.Equal(t, "%tag1%", args[1])
		assert.Equal(t, "%#tag2%", args[2])
		assert.Equal(t, "%tag2%", args[3])
	})

	t.Run("wildcard suffix handling", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: false}
		phrases := []string{}
		terms := "test*"
		excludedTerms := ""
		excludedPhrases := []string{}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, "LOWER(Posts.Message) LIKE ? ESCAPE '\\'")
		assert.Equal(t, 1, len(args))
		assert.Equal(t, "test%", args[0])
	})

	t.Run("excluded terms", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: false}
		phrases := []string{}
		terms := "hello"
		excludedTerms := "world"
		excludedPhrases := []string{}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, "LOWER(Posts.Message) LIKE ? ESCAPE '\\'")
		assert.Contains(t, sql, "LOWER(Posts.Message) NOT LIKE ? ESCAPE '\\'")
		assert.Equal(t, 2, len(args))
		assert.Equal(t, "%hello%", args[0])
		assert.Equal(t, "%world%", args[1])
	})

	t.Run("multiple excluded terms", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: false}
		phrases := []string{}
		terms := "hello"
		excludedTerms := "world test"
		excludedPhrases := []string{}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, "LOWER(Posts.Message) LIKE ? ESCAPE '\\'")
		assert.Contains(t, sql, "LOWER(Posts.Message) NOT LIKE ? ESCAPE '\\'")
		// Count the number of AND operators for excluded terms
		excludedAndCount := strings.Count(sql, "NOT LIKE")
		assert.Equal(t, 2, excludedAndCount)
		assert.Equal(t, 3, len(args))
		assert.Equal(t, "%hello%", args[0])
		assert.Equal(t, "%world%", args[1])
		assert.Equal(t, "%test%", args[2])
	})

	t.Run("excluded hashtag with prefix", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: false}
		phrases := []string{}
		terms := "hello"
		excludedTerms := "#hashtag"
		excludedPhrases := []string{}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, "LOWER(Posts.Message) LIKE ? ESCAPE '\\'")
		assert.Contains(t, sql, "(LOWER(Posts.Message) NOT LIKE ? ESCAPE '\\' AND LOWER(Posts.Message) NOT LIKE ? ESCAPE '\\')")
		assert.Equal(t, 3, len(args))
		assert.Equal(t, "%hello%", args[0])
		assert.Equal(t, "%#hashtag%", args[1])
		assert.Equal(t, "%hashtag%", args[2])
	})

	t.Run("excluded mention with @ prefix", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: false}
		phrases := []string{}
		terms := "hello"
		excludedTerms := "@username"
		excludedPhrases := []string{}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, "LOWER(Posts.Message) LIKE ? ESCAPE '\\'")
		assert.Contains(t, sql, "(LOWER(Posts.Message) NOT LIKE ? ESCAPE '\\' AND LOWER(Posts.Message) NOT LIKE ? ESCAPE '\\')")
		assert.Equal(t, 3, len(args))
		assert.Equal(t, "%hello%", args[0])
		assert.Equal(t, "%@username%", args[1])
		assert.Equal(t, "%username%", args[2])
	})

	t.Run("excluded term with wildcard", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: false}
		phrases := []string{}
		terms := "hello"
		excludedTerms := "test*"
		excludedPhrases := []string{}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, "LOWER(Posts.Message) LIKE ? ESCAPE '\\'")
		assert.Contains(t, sql, "LOWER(Posts.Message) NOT LIKE ? ESCAPE '\\'")
		assert.Equal(t, 2, len(args))
		assert.Equal(t, "%hello%", args[0])
		assert.Equal(t, "test%", args[1])
	})

	t.Run("excluded phrases", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: false}
		phrases := []string{}
		terms := "appear"
		excludedTerms := ""
		excludedPhrases := []string{"will not"}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, "LOWER(Posts.Message) LIKE ? ESCAPE '\\'")
		assert.Contains(t, sql, "LOWER(Posts.Message) NOT LIKE ? ESCAPE '\\'")
		assert.Equal(t, 2, len(args))
		assert.Equal(t, "%appear%", args[0])
		assert.Equal(t, "%will not%", args[1])
	})

	t.Run("case insensitive search", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: false}
		phrases := []string{}
		terms := "HELLO"
		excludedTerms := ""
		excludedPhrases := []string{}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, "LOWER(Posts.Message) LIKE ? ESCAPE '\\'")
		assert.Equal(t, 1, len(args))
		// Should be converted to lowercase
		assert.Equal(t, "%hello%", args[0])
	})

	t.Run("case insensitive phrase search", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: false}
		phrases := []string{`"HelLO WorLd"`}
		terms := ""
		excludedTerms := ""
		excludedPhrases := []string{}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, "LOWER(Posts.Message) LIKE ? ESCAPE '\\'")
		assert.Equal(t, 1, len(args))
		// Should be converted to lowercase
		assert.Equal(t, "%hello world%", args[0])
	})

	t.Run("case insensitive excluded terms", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: false}
		phrases := []string{}
		terms := "hello"
		excludedTerms := "WORLD"
		excludedPhrases := []string{}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, "LOWER(Posts.Message) NOT LIKE ? ESCAPE '\\'")
		assert.Equal(t, 2, len(args))
		assert.Equal(t, "%hello%", args[0])
		// Should be converted to lowercase
		assert.Equal(t, "%world%", args[1])
	})

	t.Run("combined phrases and terms", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: false}
		phrases := []string{`"hello world"`}
		terms := "test"
		excludedTerms := ""
		excludedPhrases := []string{}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, "LOWER(Posts.Message) LIKE ? ESCAPE '\\'")
		assert.Contains(t, sql, " AND ")
		assert.Equal(t, 2, len(args))
		assert.Equal(t, "%hello world%", args[0])
		assert.Equal(t, "%test%", args[1])
	})

	t.Run("empty phrases should be ignored", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: false}
		phrases := []string{`""`, `"valid phrase"`}
		terms := ""
		excludedTerms := ""
		excludedPhrases := []string{}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, "LOWER(Posts.Message) LIKE ? ESCAPE '\\'")
		// Only one phrase should be included
		assert.Equal(t, 1, len(args))
		assert.Equal(t, "%valid phrase%", args[0])
	})

	t.Run("empty excluded terms should be ignored", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: false}
		phrases := []string{}
		terms := "hello"
		excludedTerms := `"" -`
		excludedPhrases := []string{}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, "LOWER(Posts.Message) LIKE ? ESCAPE '\\'")
		assert.Contains(t, sql, "LOWER(Posts.Message) NOT LIKE ? ESCAPE '\\'")
		// The term "hello" and the literal "" (two quotes) as excluded term, minus the standalone "-" which is empty after trimming
		assert.Equal(t, 2, len(args))
		assert.Equal(t, "%hello%", args[0])
		assert.Equal(t, `%""%`, args[1])
	})

	t.Run("no search terms results in no WHERE clause", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: false}
		phrases := []string{}
		terms := ""
		excludedTerms := ""
		excludedPhrases := []string{}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, _, err := result.ToSql()

		require.NoError(t, err)
		// Should not add any search conditions
		assert.NotContains(t, sql, "LIKE")
	})

	t.Run("only excluded terms without search terms", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: false}
		phrases := []string{}
		terms := ""
		excludedTerms := "world"
		excludedPhrases := []string{}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, "LOWER(Posts.Message) NOT LIKE ? ESCAPE '\\'")
		assert.Equal(t, 1, len(args))
		assert.Equal(t, "%world%", args[0])
	})

	t.Run("mixed hashtags, mentions and regular terms", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: false}
		phrases := []string{}
		terms := "#hashtag @username regular"
		excludedTerms := ""
		excludedPhrases := []string{}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, "(LOWER(Posts.Message) LIKE ? ESCAPE '\\' OR LOWER(Posts.Message) LIKE ? ESCAPE '\\')")
		assert.Contains(t, sql, " AND ")
		assert.Equal(t, 5, len(args))
		assert.Equal(t, "%#hashtag%", args[0])
		assert.Equal(t, "%hashtag%", args[1])
		assert.Equal(t, "%@username%", args[2])
		assert.Equal(t, "%username%", args[3])
		assert.Equal(t, "%regular%", args[4])
	})

	t.Run("mixed hashtags, mentions and regular terms", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: false}
		phrases := []string{}
		terms := "田中"
		excludedTerms := ""
		excludedPhrases := []string{"太郎 社長"}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, "(LOWER(Posts.Message) LIKE ? ESCAPE '\\') AND LOWER(Posts.Message) NOT LIKE ? ESCAPE '\\'")
		assert.Contains(t, sql, " AND ")
		assert.Equal(t, 2, len(args))
		assert.Equal(t, "%田中%", args[0])
		assert.Equal(t, "%太郎 社長%", args[1])
	})

	t.Run("complex query with all features", func(t *testing.T) {
		baseQuery := sq.Select("*").From("Posts")
		params := &model.SearchParams{OrTerms: false}
		phrases := []string{`"exact phrase"`}
		terms := "#hashtag @mention word test*"
		excludedTerms := "excluded #excludedtag"
		excludedPhrases := []string{"excluded phrase", "another excluded"}
		searchType := "Posts.Message"

		result := s.generateLikeSearchQueryForPosts(baseQuery, params, phrases, terms, excludedTerms, excludedPhrases, searchType)
		sql, args, err := result.ToSql()

		require.NoError(t, err)
		assert.Contains(t, sql, "LOWER(Posts.Message) LIKE ? ESCAPE '\\'")
		assert.Contains(t, sql, "LOWER(Posts.Message) NOT LIKE ? ESCAPE '\\'")
		assert.Contains(t, sql, " AND ")
		// phrase + hashtag (2) + mention (2) + word + test% + excluded + excludedtag (2)
		assert.Equal(t, 12, len(args))
	})
}
