// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchtest

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

var searchPostStoreTests = []searchTest{
	{
		Name: "Should be able to search posts including results from DMs",
		Fn:   testSearchPostsIncludingDMs,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should be able to search posts using pagination",
		Fn:   testSearchPostsWithPagination,
		Tags: []string{EngineElasticSearch, EngineBleve},
	},
	{
		Name: "Should return pinned and unpinned posts",
		Fn:   testSearchReturnPinnedAndUnpinned,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should be able to search for quoted patterns with AND OR combinations",
		Fn:   testSearchANDORQuotesCombinations,
		Tags: []string{EnginePostgres, EngineMySQL, EngineElasticSearch},
	},
	{
		// Postgres supports search with and without quotes
		Name: "Should be able to search for email addresses with or without quotes",
		Fn:   testSearchEmailAddresses,
		Tags: []string{EnginePostgres, EngineElasticSearch},
	},
	{
		// MySql supports search with quotes only
		Name: "Should be able to search for email addresses with quotes",
		Fn:   testSearchEmailAddressesWithQuotes,
		Tags: []string{EngineMySQL},
	},
	{
		Name: "Should be able to search when markdown underscores are applied",
		Fn:   testSearchMarkdownUnderscores,
		Tags: []string{EnginePostgres, EngineElasticSearch},
	},
	{
		Name: "Should be able to search for non-latin words",
		Fn:   testSearchNonLatinWords,
		Tags: []string{EngineElasticSearch},
	},
	{
		Name: "Should be able to search for alternative spellings of words",
		Fn:   testSearchAlternativeSpellings,
		Tags: []string{EngineElasticSearch},
	},
	{
		Name: "Should be able to search for alternative spellings of words with and without accents",
		Fn:   testSearchAlternativeSpellingsAccents,
		Tags: []string{EngineElasticSearch},
	},
	{
		Name: "Should be able to search or exclude messages written by a specific user",
		Fn:   testSearchOrExcludePostsBySpecificUser,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should be able to search or exclude messages written in a specific channel",
		Fn:   testSearchOrExcludePostsInChannel,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should be able to search or exclude messages written in a DM or GM",
		Fn:   testSearchOrExcludePostsInDMGM,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should be able to filter messages written after a specific date",
		Fn:   testFilterMessagesAfterSpecificDate,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should be able to filter messages written before a specific date",
		Fn:   testFilterMessagesBeforeSpecificDate,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should be able to filter messages written on a specific date",
		Fn:   testFilterMessagesInSpecificDate,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should be able to exclude messages that contain a search term",
		Fn:   testFilterMessagesWithATerm,
		Tags: []string{EngineMySQL, EnginePostgres},
	},
	{
		Name: "Should be able to search using boolean operators",
		Fn:   testSearchUsingBooleanOperators,
		Tags: []string{EngineMySQL, EnginePostgres, EngineElasticSearch},
	},
	{
		Name: "Should be able to search with combined filters",
		Fn:   testSearchUsingCombinedFilters,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should be able to ignore stop words",
		Fn:   testSearchIgnoringStopWords,
		Tags: []string{EngineMySQL, EngineElasticSearch},
	},
	{
		Name: "Should support search stemming",
		Fn:   testSupportStemming,
		Tags: []string{EnginePostgres, EngineElasticSearch},
	},
	{
		Name: "Should support search with wildcards",
		Fn:   testSupportWildcards,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should not support search with preceding wildcards",
		Fn:   testNotSupportPrecedingWildcards,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should discard a wildcard if it's not placed immediately by text",
		Fn:   testSearchDiscardWildcardAlone,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should support terms with dash",
		Fn:   testSupportTermsWithDash,
		Tags: []string{EngineAll},
		Skip: true,
	},
	{
		Name: "Should support terms with underscore",
		Fn:   testSupportTermsWithUnderscore,
		Tags: []string{EngineMySQL, EngineElasticSearch},
	},
	{
		Name: "Should search or exclude post using hashtags",
		Fn:   testSearchOrExcludePostsWithHashtags,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should support searching for hashtags surrounded by markdown",
		Fn:   testSearchHashtagWithMarkdown,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should support searching for multiple hashtags",
		Fn:   testSearchWithMultipleHashtags,
		Tags: []string{EngineElasticSearch},
	},
	{
		Name: "Should support searching hashtags with dots",
		Fn:   testSearchPostsWithDotsInHashtags,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should be able to search or exclude messages with hashtags in a case insensitive manner",
		Fn:   testSearchHashtagCaseInsensitive,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should be able to search by hashtags with dashes",
		Fn:   testSearchHashtagWithDash,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should be able to search by hashtags with numbers",
		Fn:   testSearchHashtagWithNumbers,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should be able to search by hashtags with dots",
		Fn:   testSearchHashtagWithDots,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should be able to search by hashtags with underscores",
		Fn:   testSearchHashtagWithUnderscores,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should be able to search by hashtags with dashes and numbers",
		Fn:   testSearchHashtagWithDashAndNumbers,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should not return system messages",
		Fn:   testSearchShouldExcludeSystemMessages,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should be able to search matching by mentions",
		Fn:   testSearchShouldBeAbleToMatchByMentions,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should be able to search in deleted/archived channels",
		Fn:   testSearchInDeletedOrArchivedChannels,
		Tags: []string{EngineMySQL, EnginePostgres},
	},
	{
		Name:        "Should be able to search terms with dashes",
		Fn:          testSearchTermsWithDashes,
		Tags:        []string{EngineAll},
		Skip:        true,
		SkipMessage: "Not working",
	},
	{
		Name: "Should be able to search terms with dots",
		Fn:   testSearchTermsWithDots,
		Tags: []string{EnginePostgres, EngineElasticSearch},
	},
	{
		Name: "Should be able to search terms with underscores",
		Fn:   testSearchTermsWithUnderscores,
		Tags: []string{EngineMySQL, EngineElasticSearch},
	},
	{
		Name: "Should be able to search posts made by bot accounts",
		Fn:   testSearchBotAccountsPosts,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should be able to combine stemming and wildcards",
		Fn:   testSupportStemmingAndWildcards,
		Tags: []string{EngineElasticSearch},
	},
	{
		Name: "Should support wildcard outside quotes",
		Fn:   testSupportWildcardOutsideQuotes,
		Tags: []string{EngineElasticSearch},
	},
	{
		Name: "Should support hashtags with 3 or more characters",
		Fn:   testHashtagSearchShouldSupportThreeOrMoreCharacters,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should not support slash as character separator",
		Fn:   testSlashShouldNotBeCharSeparator,
		Tags: []string{EngineMySQL, EngineElasticSearch},
	},
	{
		Name: "Should be able to search in comments",
		Fn:   testSupportSearchInComments,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should be able to search terms within links",
		Fn:   testSupportSearchTermsWithinLinks,
		Tags: []string{EngineMySQL, EngineElasticSearch},
	},
	{
		Name: "Should not return links that are embedded in markdown",
		Fn:   testShouldNotReturnLinksEmbeddedInMarkdown,
		Tags: []string{EnginePostgres, EngineElasticSearch},
	},
	{
		Name: "Should search across teams",
		Fn:   testSearchAcrossTeams,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should be removed from search index when deleted",
		Fn:   testSearchPostDeleted,
		Tags: []string{EngineAll},
	},
}

func TestSearchPostStore(t *testing.T, s store.Store, testEngine *SearchTestEngine) {
	th := &SearchTestHelper{
		Context: request.TestContext(t),
		Store:   s,
	}
	err := th.SetupBasicFixtures()
	require.NoError(t, err)
	defer th.CleanFixtures()

	runTestSearch(t, testEngine, searchPostStoreTests, th)
}

func testSearchPostsIncludingDMs(t *testing.T, th *SearchTestHelper) {
	direct, err := th.createDirectChannel(th.Team.Id, "direct", []*model.User{th.User, th.User2})
	require.NoError(t, err)
	defer th.deleteChannel(direct)

	p1, err := th.createPost(th.User.Id, direct.Id, "dm test", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User.Id, direct.Id, "dm other", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "channel test", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	params := &model.SearchParams{Terms: "test"}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 2)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)
	th.checkPostInSearchResults(t, p2.Id, results.Posts)
}

func testSearchPostsWithPagination(t *testing.T, th *SearchTestHelper) {
	direct, err := th.createDirectChannel(th.Team.Id, "direct", []*model.User{th.User, th.User2})
	require.NoError(t, err)
	defer th.deleteChannel(direct)

	p1, err := th.createPost(th.User.Id, direct.Id, "dm test", "", model.PostTypeDefault, 10000, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User.Id, direct.Id, "dm other", "", model.PostTypeDefault, 20000, false)
	require.NoError(t, err)
	p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "channel test", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	params := &model.SearchParams{Terms: "test"}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 1)
	require.NoError(t, err)

	require.Len(t, results.Posts, 1)
	th.checkPostInSearchResults(t, p2.Id, results.Posts)

	results, err = th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 1, 1)
	require.NoError(t, err)

	require.Len(t, results.Posts, 1)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)
}

func testSearchReturnPinnedAndUnpinned(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "channel test unpinned", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "channel test pinned", "", model.PostTypeDefault, 0, true)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	params := &model.SearchParams{Terms: "test"}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 2)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)
	th.checkPostInSearchResults(t, p2.Id, results.Posts)
}

func testSearchANDORQuotesCombinations(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "one two three four", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "one two five", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p3, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "one five six", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)

	defer th.deleteUserPosts(th.User.Id)

	testCases := []struct {
		name        string
		terms       string
		orTerms     bool
		expectedLen int
		expectedIDs []string
	}{
		{
			name:        "AND operator, No Quotes, Matches 1",
			terms:       `two four`,
			orTerms:     false,
			expectedLen: 1,
			expectedIDs: []string{p1.Id},
		},
		{
			name:        "AND operator, No Quotes, Matches 0",
			terms:       `two six`,
			orTerms:     false,
			expectedLen: 0,
			expectedIDs: []string{},
		},
		{
			name:        "AND operator, With Full Quotes, Matches 0",
			terms:       `"two four"`,
			orTerms:     false,
			expectedLen: 0,
			expectedIDs: []string{},
		},
		{
			name:        "AND operator, With Full Quotes, Matches 1",
			terms:       `"two three four"`,
			orTerms:     false,
			expectedLen: 1,
			expectedIDs: []string{p1.Id},
		},
		{
			name:        "AND operator, With Part Quotes, Matches 1",
			terms:       `two "three four"`,
			orTerms:     false,
			expectedLen: 1,
			expectedIDs: []string{p1.Id},
		},
		{
			name:        "OR operator, No Quotes, Matches 2",
			terms:       `two four`,
			orTerms:     true,
			expectedLen: 2,
			expectedIDs: []string{p1.Id, p2.Id},
		},
		{
			name:        "OR operator, No Quotes, Matches 3",
			terms:       `two six`,
			orTerms:     true,
			expectedLen: 3,
			expectedIDs: []string{p1.Id, p2.Id, p3.Id},
		},
		{
			name:        "OR operator, With Full Quotes, Matches 0",
			terms:       `"two four"`,
			orTerms:     true,
			expectedLen: 0,
			expectedIDs: []string{},
		},
		{
			name:        "OR operator, With Full Quotes, Matches 1",
			terms:       `"two three four"`,
			orTerms:     true,
			expectedLen: 1,
			expectedIDs: []string{p1.Id},
		},
		{
			name:        "OR operator, With Part Quotes, Matches 2",
			terms:       `two "three four"`,
			orTerms:     true,
			expectedLen: 2,
			expectedIDs: []string{p1.Id, p2.Id},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			params := &model.SearchParams{Terms: tc.terms, OrTerms: tc.orTerms}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)

			require.Len(t, results.Posts, tc.expectedLen)
			for _, id := range tc.expectedIDs {
				th.checkPostInSearchResults(t, id, results.Posts)
			}
		})
	}
}

func testSearchEmailAddresses(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "email test@test.com", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User.Id, th.ChannelBasic.Id, "email test2@test.com", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	t.Run("Should search email addresses enclosed by quotes", func(t *testing.T) {
		params := &model.SearchParams{Terms: "\"test@test.com\""}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})

	t.Run("Should search email addresses without quotes", func(t *testing.T) {
		params := &model.SearchParams{Terms: "test@test.com"}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})
}

func testSearchEmailAddressesWithQuotes(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "email test@test.com", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User.Id, th.ChannelBasic.Id, "email test2@test.com", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	params := &model.SearchParams{Terms: "\"test@test.com\""}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 1)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)
}

func testSearchMarkdownUnderscores(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "_start middle end_ _another_", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	t.Run("Should search the start inside the markdown underscore", func(t *testing.T) {
		params := &model.SearchParams{Terms: "start"}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})

	t.Run("Should search a word in the middle of the markdown underscore", func(t *testing.T) {
		params := &model.SearchParams{Terms: "middle"}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})

	t.Run("Should search in the end of the markdown underscore", func(t *testing.T) {
		params := &model.SearchParams{Terms: "end"}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})

	t.Run("Should search inside markdown underscore", func(t *testing.T) {
		params := &model.SearchParams{Terms: "another"}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})
}

func testSearchNonLatinWords(t *testing.T, th *SearchTestHelper) {
	t.Run("Should be able to search chinese words", func(t *testing.T) {
		p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "你好", "", model.PostTypeDefault, 0, false)
		require.NoError(t, err)
		p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "你", "", model.PostTypeDefault, 0, false)
		require.NoError(t, err)
		defer th.deleteUserPosts(th.User.Id)

		t.Run("Should search one word", func(t *testing.T) {
			params := &model.SearchParams{Terms: "你"}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)

			require.Len(t, results.Posts, 1)
			th.checkPostInSearchResults(t, p2.Id, results.Posts)
		})
		t.Run("Should search two words", func(t *testing.T) {
			params := &model.SearchParams{Terms: "你好"}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)

			require.Len(t, results.Posts, 1)
			th.checkPostInSearchResults(t, p1.Id, results.Posts)
		})
		t.Run("Should search with wildcard", func(t *testing.T) {
			params := &model.SearchParams{Terms: "你*"}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)

			require.Len(t, results.Posts, 2)
			th.checkPostInSearchResults(t, p1.Id, results.Posts)
			th.checkPostInSearchResults(t, p2.Id, results.Posts)
		})
	})
	t.Run("Should be able to search cyrillic words", func(t *testing.T) {
		p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "слово test", "", model.PostTypeDefault, 0, false)
		require.NoError(t, err)
		defer th.deleteUserPosts(th.User.Id)

		t.Run("Should search one word", func(t *testing.T) {
			params := &model.SearchParams{Terms: "слово"}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)

			require.Len(t, results.Posts, 1)
			th.checkPostInSearchResults(t, p1.Id, results.Posts)
		})
		t.Run("Should search using wildcard", func(t *testing.T) {
			params := &model.SearchParams{Terms: "слов*"}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)

			require.Len(t, results.Posts, 1)
			th.checkPostInSearchResults(t, p1.Id, results.Posts)
		})
	})

	t.Run("Should be able to search japanese words", func(t *testing.T) {
		p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "本", "", model.PostTypeDefault, 0, false)
		require.NoError(t, err)
		p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "本木", "", model.PostTypeDefault, 0, false)
		require.NoError(t, err)
		defer th.deleteUserPosts(th.User.Id)

		t.Run("Should search one word", func(t *testing.T) {
			params := &model.SearchParams{Terms: "本"}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)

			require.Len(t, results.Posts, 2)
			th.checkPostInSearchResults(t, p1.Id, results.Posts)
			th.checkPostInSearchResults(t, p2.Id, results.Posts)
		})
		t.Run("Should search two words", func(t *testing.T) {
			params := &model.SearchParams{Terms: "本木"}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)

			require.Len(t, results.Posts, 1)
			th.checkPostInSearchResults(t, p2.Id, results.Posts)
		})
		t.Run("Should search with wildcard", func(t *testing.T) {
			params := &model.SearchParams{Terms: "本*"}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)

			require.Len(t, results.Posts, 2)
			th.checkPostInSearchResults(t, p1.Id, results.Posts)
			th.checkPostInSearchResults(t, p2.Id, results.Posts)
		})
	})

	t.Run("Should be able to search korean words", func(t *testing.T) {
		p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "불", "", model.PostTypeDefault, 0, false)
		require.NoError(t, err)
		p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "불다", "", model.PostTypeDefault, 0, false)
		require.NoError(t, err)
		defer th.deleteUserPosts(th.User.Id)

		t.Run("Should search one word", func(t *testing.T) {
			params := &model.SearchParams{Terms: "불"}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)

			require.Len(t, results.Posts, 1)
			th.checkPostInSearchResults(t, p1.Id, results.Posts)
		})
		t.Run("Should search two words", func(t *testing.T) {
			params := &model.SearchParams{Terms: "불다"}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)

			require.Len(t, results.Posts, 1)
			th.checkPostInSearchResults(t, p2.Id, results.Posts)
		})
		t.Run("Should search with wildcard", func(t *testing.T) {
			params := &model.SearchParams{Terms: "불*"}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)

			require.Len(t, results.Posts, 2)
			th.checkPostInSearchResults(t, p1.Id, results.Posts)
			th.checkPostInSearchResults(t, p2.Id, results.Posts)
		})
	})
}

func testSearchAlternativeSpellings(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "Straße test", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "Strasse test", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	params := &model.SearchParams{Terms: "Straße"}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 2)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)
	th.checkPostInSearchResults(t, p2.Id, results.Posts)

	params = &model.SearchParams{Terms: "Strasse"}
	results, err = th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 2)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)
	th.checkPostInSearchResults(t, p2.Id, results.Posts)
}

func testSearchAlternativeSpellingsAccents(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "café", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "café", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	params := &model.SearchParams{Terms: "café"}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 2)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)
	th.checkPostInSearchResults(t, p2.Id, results.Posts)

	params = &model.SearchParams{Terms: "café"}
	results, err = th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 2)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)
	th.checkPostInSearchResults(t, p2.Id, results.Posts)

	params = &model.SearchParams{Terms: "cafe"}
	results, err = th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 0)
}

func testSearchOrExcludePostsBySpecificUser(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelPrivate.Id, "test fromuser", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User2.Id, th.ChannelPrivate.Id, "test fromuser 2", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)
	defer th.deleteUserPosts(th.User2.Id)

	params := &model.SearchParams{
		Terms:     "fromuser",
		FromUsers: []string{th.User.Id},
	}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 1)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)
}

func testSearchOrExcludePostsInChannel(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "test fromuser", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User2.Id, th.ChannelPrivate.Id, "test fromuser 2", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)
	defer th.deleteUserPosts(th.User2.Id)

	params := &model.SearchParams{
		Terms:      "fromuser",
		InChannels: []string{th.ChannelBasic.Id},
	}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 1)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)
}

func testSearchOrExcludePostsInDMGM(t *testing.T, th *SearchTestHelper) {
	direct, err := th.createDirectChannel(th.Team.Id, "direct", []*model.User{th.User, th.User2})
	require.NoError(t, err)
	defer th.deleteChannel(direct)

	group, err := th.createGroupChannel(th.Team.Id, "test group", []*model.User{th.User, th.User2})
	require.NoError(t, err)
	defer th.deleteChannel(group)

	p1, err := th.createPost(th.User.Id, direct.Id, "test fromuser", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p2, err := th.createPost(th.User2.Id, group.Id, "test fromuser 2", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)
	defer th.deleteUserPosts(th.User2.Id)

	t.Run("Should be able to search in both DM and GM channels", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:      "fromuser",
			InChannels: []string{direct.Id, group.Id},
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 2)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
	})

	t.Run("Should be able to search only in DM channel", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:      "fromuser",
			InChannels: []string{direct.Id},
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})

	t.Run("Should be able to search only in GM channel", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:      "fromuser",
			InChannels: []string{group.Id},
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
	})
}

func testFilterMessagesInSpecificDate(t *testing.T, th *SearchTestHelper) {
	creationDate := model.GetMillisForTime(time.Date(2020, 03, 22, 12, 0, 0, 0, time.UTC))
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "test in specific date", "", model.PostTypeDefault, creationDate, false)
	require.NoError(t, err)
	creationDate2 := model.GetMillisForTime(time.Date(2020, 03, 23, 0, 0, 0, 0, time.UTC))
	p2, err := th.createPost(th.User.Id, th.ChannelPrivate.Id, "test in the present", "", model.PostTypeDefault, creationDate2, false)
	require.NoError(t, err)
	creationDate3 := model.GetMillisForTime(time.Date(2020, 03, 21, 23, 59, 59, 0, time.UTC))
	p3, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "test in the present", "", model.PostTypeDefault, creationDate3, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	t.Run("Should be able to search posts on date", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:  "test",
			OnDate: "2020-03-22",
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})
	t.Run("Should be able to exclude posts on date", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:        "test",
			ExcludedDate: "2020-03-22",
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 2)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
		th.checkPostInSearchResults(t, p3.Id, results.Posts)
	})
}

func testFilterMessagesBeforeSpecificDate(t *testing.T, th *SearchTestHelper) {
	creationDate := model.GetMillisForTime(time.Date(2020, 03, 01, 12, 0, 0, 0, time.UTC))
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "test in specific date", "", model.PostTypeDefault, creationDate, false)
	require.NoError(t, err)
	creationDate2 := model.GetMillisForTime(time.Date(2020, 03, 22, 23, 59, 59, 0, time.UTC))
	p2, err := th.createPost(th.User.Id, th.ChannelPrivate.Id, "test in specific date 2", "", model.PostTypeDefault, creationDate2, false)
	require.NoError(t, err)
	creationDate3 := model.GetMillisForTime(time.Date(2020, 03, 26, 16, 55, 0, 0, time.UTC))
	p3, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "test in the present", "", model.PostTypeDefault, creationDate3, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	t.Run("Should be able to search posts before a date", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:      "test",
			BeforeDate: "2020-03-23",
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 2)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
	})

	t.Run("Should be able to exclude posts before a date", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:              "test",
			ExcludedBeforeDate: "2020-03-23",
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p3.Id, results.Posts)
	})
}

func testFilterMessagesAfterSpecificDate(t *testing.T, th *SearchTestHelper) {
	creationDate := model.GetMillisForTime(time.Date(2020, 03, 01, 12, 0, 0, 0, time.UTC))
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "test in specific date", "", model.PostTypeDefault, creationDate, false)
	require.NoError(t, err)
	creationDate2 := model.GetMillisForTime(time.Date(2020, 03, 22, 23, 59, 59, 0, time.UTC))
	p2, err := th.createPost(th.User.Id, th.ChannelPrivate.Id, "test in specific date 2", "", model.PostTypeDefault, creationDate2, false)
	require.NoError(t, err)
	creationDate3 := model.GetMillisForTime(time.Date(2020, 03, 26, 16, 55, 0, 0, time.UTC))
	p3, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "test in the present", "", model.PostTypeDefault, creationDate3, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	t.Run("Should be able to search posts after a date", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:     "test",
			AfterDate: "2020-03-23",
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p3.Id, results.Posts)
	})

	t.Run("Should be able to exclude posts after a date", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:             "test",
			ExcludedAfterDate: "2020-03-23",
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 2)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
	})
}

func testFilterMessagesWithATerm(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "one two three", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p2, err := th.createPost(th.User.Id, th.ChannelPrivate.Id, "one four five six", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User.Id, th.ChannelBasic.Id, "one seven eight nine", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	t.Run("Should exclude terms", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:         "one",
			ExcludedTerms: "five eight",
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})

	t.Run("Should exclude quoted terms", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:         "one",
			ExcludedTerms: "\"eight nine\"",
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 2)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
	})
}

func testSearchUsingBooleanOperators(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "one two three message", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "two messages", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User.Id, th.ChannelBasic.Id, "another message", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	t.Run("Should search posts using OR operator", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:   "one two",
			OrTerms: true,
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 2)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
	})

	t.Run("Should search posts using AND operator", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:   "one two",
			OrTerms: false,
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})
}

func testSearchUsingCombinedFilters(t *testing.T, th *SearchTestHelper) {
	creationDate := model.GetMillisForTime(time.Date(2020, 03, 01, 12, 0, 0, 0, time.UTC))
	p1, err := th.createPost(th.User.Id, th.ChannelPrivate.Id, "one two three message", "", model.PostTypeDefault, creationDate, false)
	require.NoError(t, err)
	creationDate2 := model.GetMillisForTime(time.Date(2020, 03, 10, 12, 0, 0, 0, time.UTC))
	p2, err := th.createPost(th.User2.Id, th.ChannelPrivate.Id, "two messages", "", model.PostTypeDefault, creationDate2, false)
	require.NoError(t, err)
	creationDate3 := model.GetMillisForTime(time.Date(2020, 03, 20, 12, 0, 0, 0, time.UTC))
	p3, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "two another message", "", model.PostTypeDefault, creationDate3, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)
	defer th.deleteUserPosts(th.User2.Id)

	t.Run("Should search combining from user and in channel filters", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:      "two",
			FromUsers:  []string{th.User2.Id},
			InChannels: []string{th.ChannelPrivate.Id},
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
	})

	t.Run("Should search combining excluding users and in channel filters", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:         "two",
			ExcludedUsers: []string{th.User2.Id},
			InChannels:    []string{th.ChannelPrivate.Id},
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})

	t.Run("Should search combining excluding dates and in channel filters", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:              "two",
			ExcludedBeforeDate: "2020-03-09",
			ExcludedAfterDate:  "2020-03-11",
			InChannels:         []string{th.ChannelPrivate.Id},
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
	})
	t.Run("Should search combining excluding dates and in channel filters", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:            "two",
			AfterDate:        "2020-03-11",
			ExcludedChannels: []string{th.ChannelPrivate.Id},
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p3.Id, results.Posts)
	})
}

func testSearchIgnoringStopWords(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "the search for a bunch of stop words", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "the objective is to avoid a bunch of stop words", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p3, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "in the a on to where you", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p4, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "where is the car?", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	t.Run("Should avoid stop word 'the'", func(t *testing.T) {
		params := &model.SearchParams{
			Terms: "the search",
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})

	t.Run("Should avoid stop word 'a'", func(t *testing.T) {
		params := &model.SearchParams{
			Terms: "a avoid",
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
	})

	t.Run("Should avoid stop word 'in'", func(t *testing.T) {
		params := &model.SearchParams{
			Terms: "in where you",
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p3.Id, results.Posts)
	})

	t.Run("Should avoid stop words 'where', 'is' and 'the'", func(t *testing.T) {
		results, err := th.Store.Post().Search(th.Team.Id, th.User.Id, &model.SearchParams{Terms: "where is the car"})
		require.NoError(t, err)
		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p4.Id, results.Posts)
	})

	t.Run("Should remove all terms and return empty list", func(t *testing.T) {
		results, err := th.Store.Post().Search(th.Team.Id, th.User.Id, &model.SearchParams{Terms: "where is the"})
		require.NoError(t, err)
		require.Empty(t, results.Posts)
	})
}

func testSupportStemming(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "search post", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "searching post", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User.Id, th.ChannelBasic.Id, "another post", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	params := &model.SearchParams{
		Terms: "search",
	}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 2)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)
	th.checkPostInSearchResults(t, p2.Id, results.Posts)
}

func testSupportWildcards(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "search post", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "searching", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User.Id, th.ChannelBasic.Id, "another post", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	t.Run("Simple wildcard-only search", func(t *testing.T) {
		params := &model.SearchParams{
			Terms: "search*",
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 2)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
	})

	t.Run("Wildcard search with another term placed after", func(t *testing.T) {
		params := &model.SearchParams{
			Terms: "sear* post",
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})
}

func testNotSupportPrecedingWildcards(t *testing.T, th *SearchTestHelper) {
	_, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "search post", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User.Id, th.ChannelBasic.Id, "searching post", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User.Id, th.ChannelBasic.Id, "another post", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	params := &model.SearchParams{
		Terms: "*earch",
	}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 0)
}

func testSearchDiscardWildcardAlone(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "qwerty", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User.Id, th.ChannelBasic.Id, "qwertyjkl", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	params := &model.SearchParams{
		Terms: "qwerty *",
	}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 1)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)
}

func testSupportTermsWithDash(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "search term-with-dash", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User.Id, th.ChannelBasic.Id, "searching term with dash", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	t.Run("Should search terms with dash", func(t *testing.T) {
		params := &model.SearchParams{
			Terms: "term-with-dash",
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})

	t.Run("Should search terms with dash using quotes", func(t *testing.T) {
		params := &model.SearchParams{
			Terms: "\"term-with-dash\"",
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})
}

func testSupportTermsWithUnderscore(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "search term_with_underscore", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User.Id, th.ChannelBasic.Id, "searching term with underscore", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	t.Run("Should search terms with underscore", func(t *testing.T) {
		params := &model.SearchParams{
			Terms: "term_with_underscore",
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})

	t.Run("Should search terms with underscore using quotes", func(t *testing.T) {
		params := &model.SearchParams{
			Terms: "\"term_with_underscore\"",
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})
}

func testSearchOrExcludePostsWithHashtags(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "search post with #hashtag", "#hashtag", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "searching term with hashtag", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p3, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "searching term with", "#hashtag", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	t.Run("Should search terms with hashtags", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:     "#hashtag",
			IsHashtag: true,
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 2)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
		th.checkPostInSearchResults(t, p3.Id, results.Posts)
	})

	t.Run("Should search hashtag terms without hashtag option", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:     "#hashtag",
			IsHashtag: false,
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 2)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
	})
}

func testSearchHashtagWithMarkdown(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "searching hashtag #hashtag", "#hashtag", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "searching term with `#hashtag`", "#hashtag", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p3, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "searching term with **#hashtag**", "#hashtag", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p4, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "searching term with ~~#hashtag~~", "#hashtag", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p5, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "searching term with _#hashtag_", "#hashtag", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	params := &model.SearchParams{
		Terms:     "#hashtag",
		IsHashtag: true,
	}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 5)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)
	th.checkPostInSearchResults(t, p2.Id, results.Posts)
	th.checkPostInSearchResults(t, p3.Id, results.Posts)
	th.checkPostInSearchResults(t, p4.Id, results.Posts)
	th.checkPostInSearchResults(t, p5.Id, results.Posts)
}

func testSearchWithMultipleHashtags(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "searching hashtag #hashtag", "#hashtwo #hashone", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "searching term with `#hashtag`", "#hashtwo #hashthree", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	t.Run("Should search posts with multiple hashtags", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:     "#hashone #hashtwo",
			IsHashtag: true,
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})

	t.Run("Should search posts with multiple hashtags using OR", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:     "#hashone #hashtwo",
			IsHashtag: true,
			OrTerms:   true,
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 2)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
	})
}

func testSearchPostsWithDotsInHashtags(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "searching hashtag #hashtag.dot", "#hashtag.dot", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	params := &model.SearchParams{
		Terms:     "#hashtag.dot",
		IsHashtag: true,
	}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 1)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)
}

func testSearchHashtagCaseInsensitive(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "searching hashtag #HaShTaG", "#HaShTaG", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "searching hashtag #hashtag", "#hashtag", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p3, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "searching hashtag #HASHTAG", "#HASHTAG", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	t.Run("Lower case hashtag", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:     "#hashtag",
			IsHashtag: true,
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 3)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
		th.checkPostInSearchResults(t, p3.Id, results.Posts)
	})

	t.Run("Upper case hashtag", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:     "#HASHTAG",
			IsHashtag: true,
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 3)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
		th.checkPostInSearchResults(t, p3.Id, results.Posts)
	})

	t.Run("Mixed case hashtag", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:     "#HaShTaG",
			IsHashtag: true,
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 3)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
		th.checkPostInSearchResults(t, p3.Id, results.Posts)
	})
}

func testSearchHashtagWithDash(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "searching hashtag #hashtag-test", "#hashtag-test", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User.Id, th.ChannelBasic.Id, "searching hashtag #hashtagtest", "#hashtagtest", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	params := &model.SearchParams{
		Terms:     "#hashtag-test",
		IsHashtag: true,
	}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 1)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)
}

func testSearchHashtagWithNumbers(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "searching hashtag #h4sht4g", "#h4sht4g", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User.Id, th.ChannelBasic.Id, "searching hashtag #hashtag", "#hashtag", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	params := &model.SearchParams{
		Terms:     "#h4sht4g",
		IsHashtag: true,
	}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 1)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)
}

func testSearchHashtagWithDots(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "searching hashtag #hashtag.test", "#hashtag.test", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User.Id, th.ChannelBasic.Id, "searching hashtag #hashtagtest", "#hashtagtest", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	params := &model.SearchParams{
		Terms:     "#hashtag.test",
		IsHashtag: true,
	}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 1)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)
}

func testSearchHashtagWithUnderscores(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "searching hashtag #hashtag_test", "#hashtag_test", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User.Id, th.ChannelBasic.Id, "searching hashtag #hashtagtest", "#hashtagtest", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	params := &model.SearchParams{
		Terms:     "#hashtag_test",
		IsHashtag: true,
	}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 1)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)
}

func testSearchHashtagWithDashAndNumbers(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "searching hashtag #hashtag-1-finals23", "#hashtag-1-finals23", model.PostTypeDefault, 0, false)
	require.NoError(t, err)

	p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "searching hashtag #hashtag-1-finals23", "#hashtag-1-finals23", model.PostTypeDefault, 0, false)
	require.NoError(t, err)

	_, err = th.createPost(th.User.Id, th.ChannelBasic.Id, "searching hashtag #hashtag-finals20", "#hashtag-finals20", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	params := &model.SearchParams{
		Terms:     "#hashtag-1-finals23",
		IsHashtag: true,
	}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 2)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)
	th.checkPostInSearchResults(t, p2.Id, results.Posts)
}

func testSearchShouldExcludeSystemMessages(t *testing.T, th *SearchTestHelper) {
	_, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "test system message one", "", model.PostTypeJoinChannel, 0, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User.Id, th.ChannelBasic.Id, "test system message two", "", model.PostTypeLeaveChannel, 0, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User.Id, th.ChannelBasic.Id, "test system message three", "", model.PostTypeLeaveTeam, 0, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User.Id, th.ChannelBasic.Id, "test system message four", "", model.PostTypeAddToChannel, 0, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User.Id, th.ChannelBasic.Id, "test system message five", "", model.PostTypeAddToTeam, 0, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User.Id, th.ChannelBasic.Id, "test system message six", "", model.PostTypeHeaderChange, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	params := &model.SearchParams{Terms: "test system"}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 0)
}

func testSearchShouldBeAbleToMatchByMentions(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "test system @testuser", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "test system testuser", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p3, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "test system #testuser", "#testuser", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	params := &model.SearchParams{Terms: "@testuser"}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 3)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)
	th.checkPostInSearchResults(t, p2.Id, results.Posts)
	th.checkPostInSearchResults(t, p3.Id, results.Posts)
}

func testSearchInDeletedOrArchivedChannels(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelDeleted.Id, "message in deleted channel", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "message in regular channel", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p3, err := th.createPost(th.User.Id, th.ChannelPrivate.Id, "message in private channel", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	t.Run("Doesn't include posts in deleted channels", func(t *testing.T) {
		params := &model.SearchParams{Terms: "message", IncludeDeletedChannels: false}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 2)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
		th.checkPostInSearchResults(t, p3.Id, results.Posts)
	})

	t.Run("Include posts in deleted channels", func(t *testing.T) {
		params := &model.SearchParams{Terms: "message", IncludeDeletedChannels: true}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 3)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
		th.checkPostInSearchResults(t, p3.Id, results.Posts)
	})

	t.Run("Include posts in deleted channels using multiple terms", func(t *testing.T) {
		params := &model.SearchParams{Terms: "message channel", IncludeDeletedChannels: true}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 3)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
		th.checkPostInSearchResults(t, p3.Id, results.Posts)
	})

	t.Run("Include posts in deleted channels using multiple OR terms", func(t *testing.T) {
		params := &model.SearchParams{
			Terms:                  "message channel",
			IncludeDeletedChannels: true,
			OrTerms:                true,
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 3)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
		th.checkPostInSearchResults(t, p3.Id, results.Posts)
	})

	t.Run("All IncludeDeletedChannels params should have same value if multiple SearchParams provided", func(t *testing.T) {
		params1 := &model.SearchParams{
			Terms:                  "message channel",
			IncludeDeletedChannels: true,
		}
		params2 := &model.SearchParams{
			Terms:                  "#hashtag",
			IncludeDeletedChannels: false,
		}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params1, params2}, th.User.Id, th.Team.Id, 0, 20)
		require.Nil(t, results)
		require.Error(t, err)
	})
}

func testSearchTermsWithDashes(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "message with-dash-term", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "message with dash term", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	t.Run("Search for terms with dash", func(t *testing.T) {
		params := &model.SearchParams{Terms: "with-dash-term"}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})

	t.Run("Search for terms with quoted dash", func(t *testing.T) {
		params := &model.SearchParams{Terms: "\"with-dash-term\""}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})

	t.Run("Search for multiple terms with one having dash", func(t *testing.T) {
		params := &model.SearchParams{Terms: "with-dash-term message"}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})

	t.Run("Search for multiple OR terms with one having dash", func(t *testing.T) {
		params := &model.SearchParams{Terms: "with-dash-term message", OrTerms: true}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 2)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
	})
}

func testSearchTermsWithDots(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "message with.dots.term", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "message with dots term", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	t.Run("Search for terms with dots", func(t *testing.T) {
		params := &model.SearchParams{Terms: "with.dots.term"}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})

	t.Run("Search for terms with quoted dots", func(t *testing.T) {
		params := &model.SearchParams{Terms: "\"with.dots.term\""}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})

	t.Run("Search for multiple terms with one having dots", func(t *testing.T) {
		params := &model.SearchParams{Terms: "with.dots.term message"}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})

	t.Run("Search for multiple OR terms with one having dots", func(t *testing.T) {
		params := &model.SearchParams{Terms: "with.dots.term message", OrTerms: true}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 2)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
	})
}

func testSearchTermsWithUnderscores(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "message with_underscores_term", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "message with underscores term", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	t.Run("Search for terms with underscores", func(t *testing.T) {
		params := &model.SearchParams{Terms: "with_underscores_term"}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})

	t.Run("Search for terms with quoted underscores", func(t *testing.T) {
		params := &model.SearchParams{Terms: "\"with_underscores_term\""}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})

	t.Run("Search for multiple terms with one having underscores", func(t *testing.T) {
		params := &model.SearchParams{Terms: "with_underscores_term message"}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
	})

	t.Run("Search for multiple OR terms with one having underscores", func(t *testing.T) {
		params := &model.SearchParams{Terms: "with_underscores_term message", OrTerms: true}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 2)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
	})
}

func testSearchBotAccountsPosts(t *testing.T, th *SearchTestHelper) {
	bot, err := th.createBot("testbot", "Test Bot", th.User.Id)
	require.NoError(t, err)
	defer th.deleteBotUser(bot.UserId)
	err = th.addUserToTeams(model.UserFromBot(bot), []string{th.Team.Id})
	require.NoError(t, err)
	p1, err := th.createPost(bot.UserId, th.ChannelBasic.Id, "bot test message", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p2, err := th.createPost(bot.UserId, th.ChannelPrivate.Id, "bot test message in private", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(bot.UserId)

	params := &model.SearchParams{Terms: "bot"}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 2)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)
	th.checkPostInSearchResults(t, p2.Id, results.Posts)
}

func testSupportStemmingAndWildcards(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "approve", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p2, err := th.createPost(th.User.Id, th.ChannelPrivate.Id, "approved", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p3, err := th.createPost(th.User.Id, th.ChannelPrivate.Id, "approvedz", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	t.Run("Should stem appr", func(t *testing.T) {
		params := &model.SearchParams{Terms: "appr*"}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 3)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
		th.checkPostInSearchResults(t, p3.Id, results.Posts)
	})

	t.Run("Should stem approve", func(t *testing.T) {
		params := &model.SearchParams{Terms: "approve*"}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p3.Id, results.Posts)
	})
}

func testSupportWildcardOutsideQuotes(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "hello world", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p2, err := th.createPost(th.User.Id, th.ChannelPrivate.Id, "hell or heaven", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	t.Run("Should return results without quotes", func(t *testing.T) {
		params := &model.SearchParams{Terms: "hell*"}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 2)
		th.checkPostInSearchResults(t, p1.Id, results.Posts)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
	})

	t.Run("Should return just one result with quotes", func(t *testing.T) {
		params := &model.SearchParams{Terms: "\"hell\"*"}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)

		require.Len(t, results.Posts, 1)
		th.checkPostInSearchResults(t, p2.Id, results.Posts)
	})
}

func testHashtagSearchShouldSupportThreeOrMoreCharacters(t *testing.T, th *SearchTestHelper) {
	_, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "one char hashtag #1", "#1", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	_, err = th.createPost(th.User.Id, th.ChannelPrivate.Id, "two chars hashtag #12", "#12", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	p3, err := th.createPost(th.User.Id, th.ChannelPrivate.Id, "three chars hashtag #123", "#123", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	params := &model.SearchParams{Terms: "#123", IsHashtag: true}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 1)
	th.checkPostInSearchResults(t, p3.Id, results.Posts)
}

func testSlashShouldNotBeCharSeparator(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "alpha/beta gamma, theta", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	params := &model.SearchParams{Terms: "gamma"}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 1)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)

	params = &model.SearchParams{Terms: "beta"}
	results, err = th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 1)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)

	params = &model.SearchParams{Terms: "alpha"}
	results, err = th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 1)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)
}

func testSupportSearchInComments(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "message test@test.com", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	r1, err := th.createReply(th.User.Id, "reply check", "", p1, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	params := &model.SearchParams{Terms: "reply"}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 1)
	th.checkPostInSearchResults(t, r1.Id, results.Posts)
}

func testSupportSearchTermsWithinLinks(t *testing.T, th *SearchTestHelper) {
	p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "message with link http://www.wikipedia.org/dolphins", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	params := &model.SearchParams{Terms: "wikipedia"}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 1)
	th.checkPostInSearchResults(t, p1.Id, results.Posts)
}

func testShouldNotReturnLinksEmbeddedInMarkdown(t *testing.T, th *SearchTestHelper) {
	_, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "message with link [here](http://www.wikipedia.org/dolphins)", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)

	params := &model.SearchParams{Terms: "wikipedia"}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 0)
}

func testSearchAcrossTeams(t *testing.T, th *SearchTestHelper) {
	err := th.addUserToChannels(th.User, []string{th.ChannelAnotherTeam.Id})
	require.NoError(t, err)
	defer th.Store.Channel().RemoveMember(th.Context, th.ChannelAnotherTeam.Id, th.User.Id)

	_, err = th.createPost(th.User.Id, th.ChannelAnotherTeam.Id, "text to search", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)
	defer th.deleteUserPosts(th.User.Id)
	_, err = th.createPost(th.User.Id, th.ChannelBasic.Id, "text to search", "", model.PostTypeDefault, 0, false)
	require.NoError(t, err)

	params := &model.SearchParams{Terms: "search"}
	results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, "", 0, 20)
	require.NoError(t, err)

	require.Len(t, results.Posts, 2)
}

func testSearchPostDeleted(t *testing.T, th *SearchTestHelper) {
	t.Run("Search for soft deleted post", func(t *testing.T) {
		p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "message to delete", "", model.PostTypeDefault, 0, false)
		require.NoError(t, err)

		err = th.Store.Post().Delete(th.Context, p1.Id, p1.UpdateAt, th.User.Id)
		require.NoError(t, err)

		params := &model.SearchParams{Terms: "message to delete"}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)
		require.Len(t, results.Posts, 0)
	})

	t.Run("Search for hard deleted post", func(t *testing.T) {
		p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "message to delete", "", model.PostTypeDefault, 0, false)
		require.NoError(t, err)

		err = th.Store.Post().PermanentDelete(th.Context, p2.Id)
		require.NoError(t, err)

		params := &model.SearchParams{Terms: "message to delete"}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
		require.NoError(t, err)
		require.Len(t, results.Posts, 0)
	})
}
