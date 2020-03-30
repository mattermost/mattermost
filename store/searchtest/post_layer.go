// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchtest

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var searchPostStoreTests = []searchTest{
	{"Database Post tests", testSearchDatabasePostSearch, []string{ENGINE_ALL}},
	{"Elasticsearch search posts: Markdown Underscores", testSearchESSearchPosts_MarkdownUnderscores, []string{ENGINE_ELASTICSEARCH}},
	{"Elasticsearch search posts: Email Addresses", testSearchESSearchPosts_EmailAddresses, []string{ENGINE_ELASTICSEARCH}},
	{"Elasticsearch search posts: Chinese Words", testSearchESSearchPosts_ChineseWords, []string{ENGINE_ELASTICSEARCH}},
	{"Elasticsearch search posts: Alternative Spellings", testSearchESSearchPosts_AlternativeSpellings, []string{ENGINE_ELASTICSEARCH}},
	{"Elasticsearch search posts: And Or Terms", testSearchESSearchPosts_AndOrTerms, []string{ENGINE_ELASTICSEARCH}},
	{"Elasticsearch search posts: Paging", testSearchESSearchPosts_Paging, []string{ENGINE_ELASTICSEARCH}},
	{"Elasticsearch search posts: Quoted Terms", testSearchESSearchPosts_QuotedTerms, []string{ENGINE_ELASTICSEARCH}},
	{"Elasticsearch search posts: Stop Words", testSearchESSearchPosts_StopWords, []string{ENGINE_ELASTICSEARCH}},
	{"Elasticsearch search posts: Stemming", testSearchESSearchPosts_Stemming, []string{ENGINE_ELASTICSEARCH}},
	{"Elasticsearch search posts: Wildcard", testSearchESSearchPosts_Wildcard, []string{ENGINE_ELASTICSEARCH}},
	{"Elasticsearch search posts: Alternative Unicode Forms", testSearchESSearchPosts_AlternativeUnicodeForms, []string{ENGINE_ELASTICSEARCH}},
	{"Elasticsearch search posts: From and In", testSearchESSearchPosts_FromAndIn, []string{ENGINE_ELASTICSEARCH}},
	{"Elasticsearch search posts: After Before On", testSearchESSearchPosts_AfterBeforeOn, []string{ENGINE_ELASTICSEARCH}},
	{"Elasticsearch search posts: Hashtags", testSearchESSearchPosts_Hashtags, []string{ENGINE_ELASTICSEARCH}},
	{"Elasticsearch search posts: Hashtags and Or words", testSearchESSearchPosts_HashtagsAndOrWords, []string{ENGINE_ELASTICSEARCH}},
	{"Elasticsearch search posts: Hashtags case insensitive", testSearchESSearchPosts_HashtagsCaseInsensitive, []string{ENGINE_ELASTICSEARCH}},
}

func TestSearchPostStore(t *testing.T, s store.Store, testEngine *SearchTestEngine) {
	runTestSearch(t, s, testEngine, searchPostStoreTests)
}

func testSearchDatabasePostSearch(t *testing.T, s store.Store) {
	teamId := model.NewId()
	userId := model.NewId()

	u1 := &model.User{}
	u1.Username = "usera1"
	u1.Email = makeEmail()
	u1, err := s.User().Save(u1)
	require.Nil(t, err)

	t1 := &model.TeamMember{}
	t1.TeamId = teamId
	t1.UserId = u1.Id
	_, err = s.Team().SaveMember(t1, 1000)
	require.Nil(t, err)

	u2 := &model.User{}
	u2.Username = "userb2"
	u2.Email = makeEmail()
	u2, err = s.User().Save(u2)
	require.Nil(t, err)

	t2 := &model.TeamMember{}
	t2.TeamId = teamId
	t2.UserId = u2.Id
	_, err = s.Team().SaveMember(t2, 1000)
	require.Nil(t, err)

	u3 := &model.User{}
	u3.Username = "userc3"
	u3.Email = makeEmail()
	u3, err = s.User().Save(u3)
	require.Nil(t, err)

	t3 := &model.TeamMember{}
	t3.TeamId = teamId
	t3.UserId = u3.Id
	_, err = s.Team().SaveMember(t3, 1000)
	require.Nil(t, err)

	c1 := &model.Channel{}
	c1.TeamId = teamId
	c1.DisplayName = "Channel1"
	c1.Name = "channel-x"
	c1.Type = model.CHANNEL_OPEN
	c1, _ = s.Channel().Save(c1, -1)

	m1 := model.ChannelMember{}
	m1.ChannelId = c1.Id
	m1.UserId = userId
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	_, err = s.Channel().SaveMember(&m1)
	require.Nil(t, err)

	c2 := &model.Channel{}
	c2.TeamId = teamId
	c2.DisplayName = "Channel2"
	c2.Name = "channel-y"
	c2.Type = model.CHANNEL_OPEN
	c2, _ = s.Channel().Save(c2, -1)

	c3 := &model.Channel{}
	c3.TeamId = teamId
	c3.DisplayName = "Channel3"
	c3.Name = "channel-z"
	c3.Type = model.CHANNEL_OPEN
	c3, _ = s.Channel().Save(c3, -1)

	s.Channel().Delete(c3.Id, model.GetMillis())

	m3 := model.ChannelMember{}
	m3.ChannelId = c3.Id
	m3.UserId = userId
	m3.NotifyProps = model.GetDefaultChannelNotifyProps()
	_, err = s.Channel().SaveMember(&m3)
	require.Nil(t, err)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = u1.Id
	o1.Message = "corey mattermost new york United States"
	o1, err = s.Post().Save(o1)
	require.Nil(t, err)

	o1a := &model.Post{}
	o1a.ChannelId = c1.Id
	o1a.UserId = model.NewId()
	o1a.Message = "corey mattermost new york United States"
	o1a.Type = model.POST_JOIN_CHANNEL
	_, err = s.Post().Save(o1a)
	require.Nil(t, err)

	o2 := &model.Post{}
	o2.ChannelId = c1.Id
	o2.UserId = u2.Id
	o2.Message = "New Jersey United States is where John is from"
	o2, err = s.Post().Save(o2)
	require.Nil(t, err)

	o3 := &model.Post{}
	o3.ChannelId = c2.Id
	o3.UserId = model.NewId()
	o3.Message = "New Jersey United States is where John is from corey new york"
	_, err = s.Post().Save(o3)
	require.Nil(t, err)

	o4 := &model.Post{}
	o4.ChannelId = c1.Id
	o4.UserId = model.NewId()
	o4.Hashtags = "#hashtag #tagme"
	o4.Message = "(message)blargh"
	o4, err = s.Post().Save(o4)
	require.Nil(t, err)

	o5 := &model.Post{}
	o5.ChannelId = c1.Id
	o5.UserId = model.NewId()
	o5.Hashtags = "#secret #howdy #tagme"
	o5, err = s.Post().Save(o5)
	require.Nil(t, err)

	o6 := &model.Post{}
	o6.ChannelId = c3.Id
	o6.UserId = model.NewId()
	o6.Hashtags = "#hashtag"
	o6, err = s.Post().Save(o6)
	require.Nil(t, err)

	o7 := &model.Post{}
	o7.ChannelId = c3.Id
	o7.UserId = u3.Id
	o7.Message = "New Jersey United States is where John is from corey new york"
	o7, err = s.Post().Save(o7)
	require.Nil(t, err)

	o8 := &model.Post{}
	o8.ChannelId = c3.Id
	o8.UserId = model.NewId()
	o8.Message = "Deleted"
	o8, err = s.Post().Save(o8)
	require.Nil(t, err)

	tt := []struct {
		name                     string
		searchParams             *model.SearchParams
		expectedResultsCount     int
		expectedMessageResultIds []string
	}{
		{
			"normal-search-1",
			&model.SearchParams{Terms: "corey"},
			1,
			[]string{o1.Id},
		},
		{
			"normal-search-2",
			&model.SearchParams{Terms: "new"},
			2,
			[]string{o1.Id, o2.Id},
		},
		{
			"normal-search-3",
			&model.SearchParams{Terms: "john"},
			1,
			[]string{o2.Id},
		},
		{
			"wildcard-search",
			&model.SearchParams{Terms: "matter*"},
			1,
			[]string{o1.Id},
		},
		{
			"hashtag-search",
			&model.SearchParams{Terms: "#hashtag", IsHashtag: true},
			1,
			[]string{o4.Id},
		},
		{
			"hashtag-search-2",
			&model.SearchParams{Terms: "#secret", IsHashtag: true},
			1,
			[]string{o5.Id},
		},
		{
			"hashtag-search-with-exclusion",
			&model.SearchParams{Terms: "#tagme", ExcludedTerms: "#hashtag", IsHashtag: true},
			1,
			[]string{o5.Id},
		},
		{
			"no-match-mention",
			&model.SearchParams{Terms: "@thisshouldmatchnothing", IsHashtag: true},
			0,
			[]string{},
		},
		{
			"no-results-search",
			&model.SearchParams{Terms: "mattermost jersey"},
			0,
			[]string{},
		},
		{
			"exclude-search",
			&model.SearchParams{Terms: "united", ExcludedTerms: "jersey"},
			1,
			[]string{o1.Id},
		},
		{
			"multiple-words-search",
			&model.SearchParams{Terms: "corey new york"},
			1,
			[]string{o1.Id},
		},
		{
			"multiple-words-with-exclusion-search",
			&model.SearchParams{Terms: "united states", ExcludedTerms: "jersey"},
			1,
			[]string{o1.Id},
		},
		{
			"multiple-excluded-words-search",
			&model.SearchParams{Terms: "united", ExcludedTerms: "corey john"},
			0,
			[]string{},
		},
		{
			"multiple-wildcard-search",
			&model.SearchParams{Terms: "matter* jer*"},
			0,
			[]string{},
		},
		{
			"multiple-wildcard-with-exclusion-search",
			&model.SearchParams{Terms: "unite* state*", ExcludedTerms: "jers*"},
			1,
			[]string{o1.Id},
		},
		{
			"multiple-wildcard-excluded-words-search",
			&model.SearchParams{Terms: "united states", ExcludedTerms: "jers* yor*"},
			0,
			[]string{},
		},
		{
			"search-with-work-next-to-a-symbol",
			&model.SearchParams{Terms: "message blargh"},
			1,
			[]string{o4.Id},
		},
		{
			"search-with-or",
			&model.SearchParams{Terms: "Jersey corey", OrTerms: true},
			2,
			[]string{o1.Id, o2.Id},
		},
		{
			"exclude-search-with-or",
			&model.SearchParams{Terms: "york jersey", ExcludedTerms: "john", OrTerms: true},
			1,
			[]string{o1.Id},
		},
		{
			"search-with-from-user",
			&model.SearchParams{Terms: "united states", FromUsers: []string{"usera1"}, IncludeDeletedChannels: true},
			1,
			[]string{o1.Id},
		},
		{
			"search-with-multiple-from-user",
			&model.SearchParams{Terms: "united states", FromUsers: []string{"usera1", "userc3"}, IncludeDeletedChannels: true},
			2,
			[]string{o1.Id, o7.Id},
		},
		{
			"search-with-excluded-user",
			&model.SearchParams{Terms: "united states", ExcludedUsers: []string{"usera1"}, IncludeDeletedChannels: true},
			2,
			[]string{o2.Id, o7.Id},
		},
		{
			"search-with-multiple-excluded-user",
			&model.SearchParams{Terms: "united states", ExcludedUsers: []string{"usera1", "userb2"}, IncludeDeletedChannels: true},
			1,
			[]string{o7.Id},
		},
		{
			"search-with-deleted-and-channel-filter",
			&model.SearchParams{Terms: "Jersey corey", InChannels: []string{"channel-x"}, IncludeDeletedChannels: true, OrTerms: true},
			2,
			[]string{o1.Id, o2.Id},
		},
		{
			"search-with-deleted-and-multiple-channel-filter",
			&model.SearchParams{Terms: "Jersey corey", InChannels: []string{"channel-x", "channel-z"}, IncludeDeletedChannels: true, OrTerms: true},
			3,
			[]string{o1.Id, o2.Id, o7.Id},
		},
		{
			"search-with-deleted-and-excluded-channel-filter",
			&model.SearchParams{Terms: "Jersey corey", ExcludedChannels: []string{"channel-x"}, IncludeDeletedChannels: true, OrTerms: true},
			1,
			[]string{o7.Id},
		},
		{
			"search-with-deleted-and-multiple-excluded-channel-filter",
			&model.SearchParams{Terms: "Jersey corey", ExcludedChannels: []string{"channel-x", "channel-z"}, IncludeDeletedChannels: true, OrTerms: true},
			0,
			[]string{},
		},
		{
			"search-with-or-and-deleted",
			&model.SearchParams{Terms: "Jersey corey", OrTerms: true, IncludeDeletedChannels: true},
			3,
			[]string{o1.Id, o2.Id, o7.Id},
		},
		{
			"search-hashtag-deleted",
			&model.SearchParams{Terms: "#hashtag", IsHashtag: true, IncludeDeletedChannels: true},
			2,
			[]string{o4.Id, o6.Id},
		},
		{
			"search-deleted-only",
			&model.SearchParams{Terms: "Deleted", IncludeDeletedChannels: true},
			1,
			[]string{o8.Id},
		},
	}
	for _, tc := range tt {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			result, err := s.Post().Search(teamId, userId, tc.searchParams)
			require.Nil(t, err)
			require.Len(t, result.Order, tc.expectedResultsCount)
			for _, expectedMessageResultId := range tc.expectedMessageResultIds {
				assert.Contains(t, result.Order, expectedMessageResultId)
			}
		})
	}
}

func testSearchESSearchPosts_MarkdownUnderscores(t *testing.T, s store.Store) {
	team, err := s.Team().Save(&model.Team{Name: "t1", DisplayName: "t1", Type: model.TEAM_OPEN})
	require.Nil(t, err)
	defer func() { require.Nil(t, s.Team().PermanentDelete(team.Id)) }()
	channel, err := s.Channel().Save(&model.Channel{TeamId: team.Id, Name: "c1", DisplayName: "c1", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)
	user, err := s.User().Save(createUser("testuser", "testuser", "Test", "User"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user, []string{team.Id}, []string{channel.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user.Id)) }()

	// Test searching for posts with Markdown underscores in them.
	post, err := s.Post().Save(createPost(user.Id, channel.Id, "_start middle end_ _both_"))
	require.Nil(t, err)

	searchParams := []*model.SearchParams{
		{
			IsHashtag: false,
			OrTerms:   false,
		},
	}

	testCases := []struct {
		Name  string
		Terms string
	}{
		{
			Name:  "It should match the post by start",
			Terms: "start",
		},
		{
			Name:  "It should match the post by middle",
			Terms: "middle",
		},
		{
			Name:  "It should match the post by end",
			Terms: "end",
		},
		{
			Name:  "It should match the post by both",
			Terms: "both",
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.Name, func(t *testing.T) {
			searchParams[0].Terms = tc.Terms

			res, err := s.Post().SearchPostsInTeamForUser(searchParams, user.Id, team.Id, false, false, 0, 20)
			require.Nil(t, err)

			ids := []string{}
			for id := range res.Posts {
				ids = append(ids, id)
			}

			checkPostInSearchResults(t, post.Id, ids)
			checkMatchesEqual(t, map[string][]string{
				post.Id: {tc.Terms},
			}, res.Matches)
		})
	}
}

func testSearchESSearchPosts_EmailAddresses(t *testing.T, s store.Store) {
	team, err := s.Team().Save(&model.Team{Name: "t1", DisplayName: "t1", Type: model.TEAM_OPEN})
	require.Nil(t, err)
	defer func() { require.Nil(t, s.Team().PermanentDelete(team.Id)) }()
	channel, err := s.Channel().Save(&model.Channel{TeamId: team.Id, Name: "c1", DisplayName: "c1", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)
	user, err := s.User().Save(createUser("testuser", "testuser", "Test", "User"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user, []string{team.Id}, []string{channel.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user.Id)) }()

	// Test searching for posts with Markdown underscores in them.
	post1, err := s.Post().Save(createPost(user.Id, channel.Id, "something test something example.com something"))
	require.Nil(t, err)
	post2, err := s.Post().Save(createPost(user.Id, channel.Id, "test@example.com"))
	require.Nil(t, err)

	searchParams := []*model.SearchParams{
		{
			Terms:     "test@example.com",
			IsHashtag: false,
			OrTerms:   false,
		},
	}

	res, err := s.Post().SearchPostsInTeamForUser(searchParams, user.Id, team.Id, false, false, 0, 20)
	require.Nil(t, err)

	ids := []string{}
	for id := range res.Posts {
		ids = append(ids, id)
	}

	checkPostNotInSearchResults(t, post1.Id, ids)
	checkPostInSearchResults(t, post2.Id, ids)
	checkMatchesEqual(t, map[string][]string{
		post2.Id: {"test", "example.com"},
	}, res.Matches)
}

func testSearchESSearchPosts_ChineseWords(t *testing.T, s store.Store) {
	team, err := s.Team().Save(&model.Team{Name: "t1", DisplayName: "t1", Type: model.TEAM_OPEN})
	require.Nil(t, err)
	defer func() { require.Nil(t, s.Team().PermanentDelete(team.Id)) }()
	channel, err := s.Channel().Save(&model.Channel{TeamId: team.Id, Name: "c1", DisplayName: "c1", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)
	user, err := s.User().Save(createUser("testuser", "testuser", "Test", "User"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user, []string{team.Id}, []string{channel.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user.Id)) }()

	post1, err := s.Post().Save(createPost(user.Id, channel.Id, "你好"))
	require.Nil(t, err)
	post2, err := s.Post().Save(createPost(user.Id, channel.Id, "你"))
	require.Nil(t, err)

	searchParams := []*model.SearchParams{
		{
			IsHashtag: false,
			OrTerms:   false,
		},
	}

	testCases := []struct {
		Name    string
		Terms   string
		Matches map[string][]string
	}{
		{
			Name:  "Test cjk 2 character word match",
			Terms: "你好",
			Matches: map[string][]string{
				post1.Id: {"你好"},
			},
		},
		{
			Name:  "Test cjk 1 character word match",
			Terms: "你",
			Matches: map[string][]string{
				post2.Id: {"你"},
			},
		},
		{
			Name:  "Test cjk wildcard word match",
			Terms: "你*",
			Matches: map[string][]string{
				post1.Id: {"你好"},
				post2.Id: {"你"},
			},
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.Name, func(t *testing.T) {
			searchParams[0].Terms = tc.Terms

			res, err := s.Post().SearchPostsInTeamForUser(searchParams, user.Id, team.Id, false, false, 0, 20)
			require.Nil(t, err)

			expectedIds := []string{}
			for id := range tc.Matches {
				expectedIds = append(expectedIds, id)
			}

			ids := []string{}
			for id := range res.Posts {
				ids = append(ids, id)
			}

			require.ElementsMatch(t, expectedIds, ids)
			checkMatchesEqual(t, tc.Matches, res.Matches)
		})
	}
}

func testSearchESSearchPosts_AlternativeSpellings(t *testing.T, s store.Store) {
	team, err := s.Team().Save(&model.Team{Name: "t1", DisplayName: "t1", Type: model.TEAM_OPEN})
	require.Nil(t, err)
	defer func() { require.Nil(t, s.Team().PermanentDelete(team.Id)) }()
	channel, err := s.Channel().Save(&model.Channel{TeamId: team.Id, Name: "c1", DisplayName: "c1", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)
	user, err := s.User().Save(createUser("testuser", "testuser", "Test", "User"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user, []string{team.Id}, []string{channel.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user.Id)) }()

	post1, err := s.Post().Save(createPost(user.Id, channel.Id, "Straße"))
	require.Nil(t, err)
	post2, err := s.Post().Save(createPost(user.Id, channel.Id, "Strasse"))
	require.Nil(t, err)

	searchParams := []*model.SearchParams{
		{
			IsHashtag: false,
			OrTerms:   false,
		},
	}

	testCases := []struct {
		Name    string
		Terms   string
		Matches map[string][]string
	}{
		{
			Name:  "Search for Straße",
			Terms: "Straße",
			Matches: map[string][]string{
				post1.Id: {"Straße"},
				post2.Id: {"Strasse"},
			},
		},
		{
			Name:  "Search for Strasse",
			Terms: "Strasse",
			Matches: map[string][]string{
				post1.Id: {"Straße"},
				post2.Id: {"Strasse"},
			},
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.Name, func(t *testing.T) {
			searchParams[0].Terms = tc.Terms

			res, err := s.Post().SearchPostsInTeamForUser(searchParams, user.Id, team.Id, false, false, 0, 20)
			require.Nil(t, err)

			expectedIds := []string{}
			for id := range tc.Matches {
				expectedIds = append(expectedIds, id)
			}

			ids := []string{}
			for id := range res.Posts {
				ids = append(ids, id)
			}

			require.ElementsMatch(t, expectedIds, ids)
			checkMatchesEqual(t, tc.Matches, res.Matches)
		})
	}
}

func testSearchESSearchPosts_AndOrTerms(t *testing.T, s store.Store) {
	team, err := s.Team().Save(&model.Team{Name: "t1", DisplayName: "t1", Type: model.TEAM_OPEN})
	require.Nil(t, err)
	defer func() { require.Nil(t, s.Team().PermanentDelete(team.Id)) }()
	channel, err := s.Channel().Save(&model.Channel{TeamId: team.Id, Name: "c1", DisplayName: "c1", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)
	user, err := s.User().Save(createUser("testuser", "testuser", "Test", "User"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user, []string{team.Id}, []string{channel.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user.Id)) }()

	post1, err := s.Post().Save(createPost(user.Id, channel.Id, "things and stuff"))
	require.Nil(t, err)
	post2, err := s.Post().Save(createPost(user.Id, channel.Id, "things"))
	require.Nil(t, err)
	post3, err := s.Post().Save(createPost(user.Id, channel.Id, "stuff"))
	require.Nil(t, err)

	t.Run("Searches for things stuff", func(t *testing.T) {
		searchParams := []*model.SearchParams{
			{
				Terms:     "things stuff",
				IsHashtag: false,
				OrTerms:   false,
			},
		}

		res, err := s.Post().SearchPostsInTeamForUser(searchParams, user.Id, team.Id, false, false, 0, 20)
		require.Nil(t, err)
		require.Len(t, res.Posts, 1)

		ids := []string{}
		for id := range res.Posts {
			ids = append(ids, id)
		}

		checkPostInSearchResults(t, post1.Id, ids)
		checkPostNotInSearchResults(t, post2.Id, ids)
		checkPostNotInSearchResults(t, post3.Id, ids)
		checkMatchesEqual(t, map[string][]string{
			post1.Id: {"things", "stuff"},
		}, res.Matches)
	})

	t.Run("Searches for things", func(t *testing.T) {
		searchParams := []*model.SearchParams{
			{
				Terms:     "things",
				IsHashtag: false,
				OrTerms:   false,
			},
		}

		res, err := s.Post().SearchPostsInTeamForUser(searchParams, user.Id, team.Id, false, false, 0, 20)
		require.Nil(t, err)
		require.Len(t, res.Posts, 2)

		ids := []string{}
		for id := range res.Posts {
			ids = append(ids, id)
		}

		checkPostInSearchResults(t, post1.Id, ids)
		checkPostInSearchResults(t, post2.Id, ids)
		checkPostNotInSearchResults(t, post3.Id, ids)
		checkMatchesEqual(t, map[string][]string{
			post1.Id: {"things"},
			post2.Id: {"things"},
		}, res.Matches)
	})

	t.Run("Searches for stuff", func(t *testing.T) {
		searchParams := []*model.SearchParams{
			{
				Terms:     "stuff",
				IsHashtag: false,
				OrTerms:   false,
			},
		}

		res, err := s.Post().SearchPostsInTeamForUser(searchParams, user.Id, team.Id, false, false, 0, 20)
		require.Nil(t, err)
		require.Len(t, res.Posts, 2)

		ids := []string{}
		for id := range res.Posts {
			ids = append(ids, id)
		}

		checkPostInSearchResults(t, post1.Id, ids)
		checkPostNotInSearchResults(t, post2.Id, ids)
		checkPostInSearchResults(t, post3.Id, ids)
		checkMatchesEqual(t, map[string][]string{
			post1.Id: {"stuff"},
			post3.Id: {"stuff"},
		}, res.Matches)
	})

	t.Run("Searches for things and not stuff", func(t *testing.T) {
		searchParams := []*model.SearchParams{
			{
				Terms:         "things",
				ExcludedTerms: "stuff",
				IsHashtag:     false,
				OrTerms:       false,
			},
		}

		res, err := s.Post().SearchPostsInTeamForUser(searchParams, user.Id, team.Id, false, false, 0, 20)
		require.Nil(t, err)
		require.Len(t, res.Posts, 1)

		ids := []string{}
		for id := range res.Posts {
			ids = append(ids, id)
		}

		checkPostInSearchResults(t, post2.Id, ids)
		checkMatchesEqual(t, map[string][]string{
			post2.Id: {"things"},
		}, res.Matches)
	})

	t.Run("Searches for not things", func(t *testing.T) {
		searchParams := []*model.SearchParams{
			{
				ExcludedTerms: "things",
				IsHashtag:     false,
				OrTerms:       false,
			},
		}

		res, err := s.Post().SearchPostsInTeamForUser(searchParams, user.Id, team.Id, false, false, 0, 20)
		require.Nil(t, err)
		require.Len(t, res.Posts, 1)

		ids := []string{}
		for id := range res.Posts {
			ids = append(ids, id)
		}

		checkPostInSearchResults(t, post3.Id, ids)
		checkMatchesEqual(t, map[string][]string{
			post3.Id: {},
		}, res.Matches)
	})

	t.Run("Searches for things stuff with an or search", func(t *testing.T) {
		searchParams := []*model.SearchParams{
			{
				Terms:     "things stuff",
				IsHashtag: false,
				OrTerms:   true,
			},
		}

		res, err := s.Post().SearchPostsInTeamForUser(searchParams, user.Id, team.Id, false, false, 0, 20)
		require.Nil(t, err)
		require.Len(t, res.Posts, 3)

		ids := []string{}
		for id := range res.Posts {
			ids = append(ids, id)
		}

		checkPostInSearchResults(t, post1.Id, ids)
		checkPostInSearchResults(t, post2.Id, ids)
		checkPostInSearchResults(t, post3.Id, ids)
		checkMatchesEqual(t, map[string][]string{
			post1.Id: {"things", "stuff"},
			post2.Id: {"things"},
			post3.Id: {"stuff"},
		}, res.Matches)
	})
}

func testSearchESSearchPosts_Paging(t *testing.T, s store.Store) {
	team, err := s.Team().Save(&model.Team{Name: "t1", DisplayName: "t1", Type: model.TEAM_OPEN})
	require.Nil(t, err)
	defer func() { require.Nil(t, s.Team().PermanentDelete(team.Id)) }()
	channel, err := s.Channel().Save(&model.Channel{TeamId: team.Id, Name: "c1", DisplayName: "c1", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)
	user, err := s.User().Save(createUser("testuser", "testuser", "Test", "User"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user, []string{team.Id}, []string{channel.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user.Id)) }()

	post1, err := s.Post().Save(createPost(user.Id, channel.Id, "things and stuff"))
	require.Nil(t, err)
	post2, err := s.Post().Save(createPost(user.Id, channel.Id, "things"))
	require.Nil(t, err)
	post3, err := s.Post().Save(createPost(user.Id, channel.Id, "stuff"))
	require.Nil(t, err)

	searchParams := []*model.SearchParams{
		{
			Terms:     "things stuff",
			OrTerms:   true,
			IsHashtag: false,
		},
	}

	testCases := []struct {
		Name    string
		Page    int
		PerPage int
		Matches map[string][]string
	}{
		{
			Name:    "The full page",
			Page:    0,
			PerPage: 20,
			Matches: map[string][]string{
				post1.Id: {"things", "stuff"},
				post2.Id: {"things"},
				post3.Id: {"stuff"},
			},
		},
		{
			Name:    "The first page with two results",
			Page:    0,
			PerPage: 2,
			Matches: map[string][]string{
				post1.Id: {"things", "stuff"},
				post2.Id: {"things"},
			},
		},
		{
			Name:    "The second page with two results",
			Page:    1,
			PerPage: 2,
			Matches: map[string][]string{
				post3.Id: {"stuff"},
			},
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.Name, func(t *testing.T) {
			res, err := s.Post().SearchPostsInTeamForUser(searchParams, user.Id, team.Id, false, false, tc.Page, tc.PerPage)
			require.Nil(t, err)

			expectedIds := []string{}
			for id := range tc.Matches {
				expectedIds = append(expectedIds, id)
			}

			ids := []string{}
			for id := range res.Posts {
				ids = append(ids, id)
			}

			require.ElementsMatch(t, expectedIds, ids)
			checkMatchesEqual(t, tc.Matches, res.Matches)
		})
	}
}

func testSearchESSearchPosts_QuotedTerms(t *testing.T, s store.Store) {
	team, err := s.Team().Save(&model.Team{Name: "t1", DisplayName: "t1", Type: model.TEAM_OPEN})
	require.Nil(t, err)
	defer func() { require.Nil(t, s.Team().PermanentDelete(team.Id)) }()
	channel, err := s.Channel().Save(&model.Channel{TeamId: team.Id, Name: "c1", DisplayName: "c1", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)
	user, err := s.User().Save(createUser("testuser", "testuser", "Test", "User"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user, []string{team.Id}, []string{channel.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user.Id)) }()

	post1, err := s.Post().Save(createPost(user.Id, channel.Id, "large dog"))
	require.Nil(t, err)
	post2, err := s.Post().Save(createPost(user.Id, channel.Id, "large scary dog"))
	require.Nil(t, err)

	searchParams := []*model.SearchParams{
		{
			IsHashtag: false,
			OrTerms:   false,
		},
	}

	testCases := []struct {
		Name          string
		Terms         string
		ExcludedTerms string
		Matches       map[string][]string
	}{
		{
			Name:  "Search for large dog",
			Terms: "large dog",
			Matches: map[string][]string{
				post1.Id: {"large", "dog"},
				post2.Id: {"large", "dog"},
			},
		},
		{
			Name:  "Search for \"large dog\"",
			Terms: "\"large dog\"",
			Matches: map[string][]string{
				post1.Id: {"large", "dog"}, // Note that we don't return the whole string highlighted
			},
		},
		{
			Name:          "Search for dog -\"large scary\"",
			Terms:         "dog",
			ExcludedTerms: "\"large scary\"",
			Matches: map[string][]string{
				post1.Id: {"dog"},
			},
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.Name, func(t *testing.T) {
			searchParams[0].Terms = tc.Terms
			searchParams[0].ExcludedTerms = tc.ExcludedTerms

			res, err := s.Post().SearchPostsInTeamForUser(searchParams, user.Id, team.Id, false, false, 0, 20)
			require.Nil(t, err)

			expectedIds := []string{}
			for id := range tc.Matches {
				expectedIds = append(expectedIds, id)
			}

			ids := []string{}
			for id := range res.Posts {
				ids = append(ids, id)
			}

			require.ElementsMatch(t, expectedIds, ids)
			checkMatchesEqual(t, tc.Matches, res.Matches)
		})
	}
}

func testSearchESSearchPosts_StopWords(t *testing.T, s store.Store) {
	team, err := s.Team().Save(&model.Team{Name: "t1", DisplayName: "t1", Type: model.TEAM_OPEN})
	require.Nil(t, err)
	defer func() { require.Nil(t, s.Team().PermanentDelete(team.Id)) }()
	channel, err := s.Channel().Save(&model.Channel{TeamId: team.Id, Name: "c1", DisplayName: "c1", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)
	user, err := s.User().Save(createUser("testuser", "testuser", "Test", "User"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user, []string{team.Id}, []string{channel.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user.Id)) }()

	post1, err := s.Post().Save(createPost(user.Id, channel.Id, "I enjoyed eating the house"))
	require.Nil(t, err)
	post2, err := s.Post().Save(createPost(user.Id, channel.Id, "I enjoyed eating house"))
	require.Nil(t, err)
	post3, err := s.Post().Save(createPost(user.Id, channel.Id, "I enjoyed eating a house"))
	require.Nil(t, err)

	searchParams := []*model.SearchParams{
		{
			IsHashtag: false,
			OrTerms:   false,
		},
	}

	testCases := []struct {
		Name    string
		Terms   string
		Matches map[string][]string
	}{
		{
			Name:  "Search for the house",
			Terms: "the house",
			Matches: map[string][]string{
				post1.Id: {"house"},
				post2.Id: {"house"},
				post3.Id: {"house"},
			},
		},
		{
			Name:  "Search for eating the house",
			Terms: "eating the house",
			Matches: map[string][]string{
				post1.Id: {"eating", "house"},
				post2.Id: {"eating", "house"},
				post3.Id: {"eating", "house"},
			},
		},
		{
			Name:  "Search for quoted \"eating the house\"",
			Terms: "\"eating the house\"",
			Matches: map[string][]string{
				post1.Id: {"eating", "house"},
				post3.Id: {"eating", "house"},
			},
		},
		{
			Name:  "Search for quoted \"eating house\"",
			Terms: "\"eating house\"",
			Matches: map[string][]string{
				post2.Id: {"eating", "house"},
			},
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.Name, func(t *testing.T) {
			searchParams[0].Terms = tc.Terms

			res, err := s.Post().SearchPostsInTeamForUser(searchParams, user.Id, team.Id, false, false, 0, 20)
			require.Nil(t, err)

			expectedIds := []string{}
			for id := range tc.Matches {
				expectedIds = append(expectedIds, id)
			}

			ids := []string{}
			for id := range res.Posts {
				ids = append(ids, id)
			}

			require.ElementsMatch(t, expectedIds, ids)
			checkMatchesEqual(t, tc.Matches, res.Matches)
		})
	}
}

func testSearchESSearchPosts_Stemming(t *testing.T, s store.Store) {
	team, err := s.Team().Save(&model.Team{Name: "t1", DisplayName: "t1", Type: model.TEAM_OPEN})
	require.Nil(t, err)
	defer func() { require.Nil(t, s.Team().PermanentDelete(team.Id)) }()
	channel, err := s.Channel().Save(&model.Channel{TeamId: team.Id, Name: "c1", DisplayName: "c1", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)
	user, err := s.User().Save(createUser("testuser", "testuser", "Test", "User"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user, []string{team.Id}, []string{channel.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user.Id)) }()

	post1, err := s.Post().Save(createPost(user.Id, channel.Id, "sail"))
	require.Nil(t, err)
	post2, err := s.Post().Save(createPost(user.Id, channel.Id, "sailing"))
	require.Nil(t, err)

	searchParams := []*model.SearchParams{
		{
			IsHashtag: false,
			OrTerms:   false,
		},
	}

	testCases := []struct {
		Name    string
		Terms   string
		Matches map[string][]string
	}{
		{
			Name:  "Search for sail",
			Terms: "sail",
			Matches: map[string][]string{
				post1.Id: {"sail"},
				post2.Id: {"sailing"},
			},
		},
		{
			Name:  "Search for sailing",
			Terms: "sailing",
			Matches: map[string][]string{
				post1.Id: {"sail"},
				post2.Id: {"sailing"},
			},
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.Name, func(t *testing.T) {
			searchParams[0].Terms = tc.Terms

			res, err := s.Post().SearchPostsInTeamForUser(searchParams, user.Id, team.Id, false, false, 0, 20)
			require.Nil(t, err)

			expectedIds := []string{}
			for id := range tc.Matches {
				expectedIds = append(expectedIds, id)
			}

			ids := []string{}
			for id := range res.Posts {
				ids = append(ids, id)
			}

			require.ElementsMatch(t, expectedIds, ids)
			checkMatchesEqual(t, tc.Matches, res.Matches)
		})
	}
}

func testSearchESSearchPosts_Wildcard(t *testing.T, s store.Store) {
	team, err := s.Team().Save(&model.Team{Name: "t1", DisplayName: "t1", Type: model.TEAM_OPEN})
	require.Nil(t, err)
	defer func() { require.Nil(t, s.Team().PermanentDelete(team.Id)) }()
	channel, err := s.Channel().Save(&model.Channel{TeamId: team.Id, Name: "c1", DisplayName: "c1", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)
	user, err := s.User().Save(createUser("testuser", "testuser", "Test", "User"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user, []string{team.Id}, []string{channel.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user.Id)) }()

	post1, err := s.Post().Save(createPost(user.Id, channel.Id, "insensitive"))
	require.Nil(t, err)
	post2, err := s.Post().Save(createPost(user.Id, channel.Id, "insensible"))
	require.Nil(t, err)

	searchParams := []*model.SearchParams{
		{
			IsHashtag: false,
			OrTerms:   false,
		},
	}

	testCases := []struct {
		Name    string
		Terms   string
		Matches map[string][]string
	}{
		{
			Name:  "Search for inse*",
			Terms: "inse*",
			Matches: map[string][]string{
				post1.Id: {"insensitive"},
				post2.Id: {"insensible"},
			},
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.Name, func(t *testing.T) {
			searchParams[0].Terms = tc.Terms

			res, err := s.Post().SearchPostsInTeamForUser(searchParams, user.Id, team.Id, false, false, 0, 20)
			require.Nil(t, err)

			expectedIds := []string{}
			for id := range tc.Matches {
				expectedIds = append(expectedIds, id)
			}

			ids := []string{}
			for id := range res.Posts {
				ids = append(ids, id)
			}

			require.ElementsMatch(t, expectedIds, ids)
			checkMatchesEqual(t, tc.Matches, res.Matches)
		})
	}
}

func testSearchESSearchPosts_AlternativeUnicodeForms(t *testing.T, s store.Store) {
	team, err := s.Team().Save(&model.Team{Name: "t1", DisplayName: "t1", Type: model.TEAM_OPEN})
	require.Nil(t, err)
	defer func() { require.Nil(t, s.Team().PermanentDelete(team.Id)) }()
	channel, err := s.Channel().Save(&model.Channel{TeamId: team.Id, Name: "c1", DisplayName: "c1", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)
	user, err := s.User().Save(createUser("testuser", "testuser", "Test", "User"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user, []string{team.Id}, []string{channel.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user.Id)) }()

	post1, err := s.Post().Save(createPost(user.Id, channel.Id, "café"))
	require.Nil(t, err)
	post2, err := s.Post().Save(createPost(user.Id, channel.Id, "café"))
	require.Nil(t, err)

	searchParams := []*model.SearchParams{
		{
			IsHashtag: false,
			OrTerms:   false,
		},
	}

	testCases := []struct {
		Name    string
		Terms   string
		Matches map[string][]string
	}{
		{
			Name:  "Search for café",
			Terms: "café",
			Matches: map[string][]string{
				post1.Id: {"café"},
				post2.Id: {"café"},
			},
		},
		{
			Name:  "Search for café",
			Terms: "café",
			Matches: map[string][]string{
				post1.Id: {"café"},
				post2.Id: {"café"},
			},
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.Name, func(t *testing.T) {
			searchParams[0].Terms = tc.Terms

			res, err := s.Post().SearchPostsInTeamForUser(searchParams, user.Id, team.Id, false, false, 0, 20)
			require.Nil(t, err)

			expectedIds := []string{}
			for id := range tc.Matches {
				expectedIds = append(expectedIds, id)
			}

			ids := []string{}
			for id := range res.Posts {
				ids = append(ids, id)
			}

			require.ElementsMatch(t, expectedIds, ids)
			checkMatchesEqual(t, tc.Matches, res.Matches)
		})
	}
}

func testSearchESSearchPosts_FromAndIn(t *testing.T, s store.Store) {
	team, err := s.Team().Save(&model.Team{Name: "t1", DisplayName: "t1", Type: model.TEAM_OPEN})
	require.Nil(t, err)
	defer func() { require.Nil(t, s.Team().PermanentDelete(team.Id)) }()
	channel1, err := s.Channel().Save(&model.Channel{TeamId: team.Id, Name: "c1", DisplayName: "c1", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)
	channel2, err := s.Channel().Save(&model.Channel{TeamId: team.Id, Name: "c2", DisplayName: "c2", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)
	user1, err := s.User().Save(createUser("testuserone", "testuserone", "Test", "One"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user1, []string{team.Id}, []string{channel1.Id, channel2.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user1.Id)) }()
	user2, err := s.User().Save(createUser("testusertwo", "testusertwo", "Test", "Two"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user2, []string{team.Id}, []string{channel1.Id, channel2.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user2.Id)) }()

	post1, err := s.Post().Save(createPost(user1.Id, channel1.Id, "post in channel 1 by user 1"))
	require.Nil(t, err)
	post2, err := s.Post().Save(createPost(user1.Id, channel2.Id, "post in channel 2 by user 1"))
	require.Nil(t, err)
	post3, err := s.Post().Save(createPost(user2.Id, channel1.Id, "post in channel 1 by user 2"))
	require.Nil(t, err)
	post4, err := s.Post().Save(createPost(user2.Id, channel2.Id, "post in channel 2 by user 2"))
	require.Nil(t, err)

	searchParams := []*model.SearchParams{
		{
			Terms:     "post",
			IsHashtag: false,
			OrTerms:   false,
		},
	}

	testCases := []struct {
		Name             string
		User             *model.User
		FromUsers        []string
		InChannels       []string
		ExcludedUsers    []string
		ExcludedChannels []string
		Matches          map[string][]string
	}{
		{
			Name:       "Search for post from the user1 in the channel1",
			User:       user1,
			InChannels: []string{channel1.Id},
			FromUsers:  []string{user1.Id},
			Matches: map[string][]string{
				post1.Id: {"post"},
			},
		},
		{
			Name:       "Search for post from the user1 in channel1 and channel2",
			User:       user1,
			InChannels: []string{channel1.Id, channel2.Id},
			FromUsers:  []string{user1.Id},
			Matches: map[string][]string{
				post1.Id: {"post"},
				post2.Id: {"post"},
			},
		},
		{
			Name:       "Search for post from user1 and user2 in channel1 and channel2",
			User:       user1,
			InChannels: []string{channel1.Id, channel2.Id},
			FromUsers:  []string{user1.Id, user2.Id},
			Matches: map[string][]string{
				post1.Id: {"post"},
				post2.Id: {"post"},
				post3.Id: {"post"},
				post4.Id: {"post"},
			},
		},
		{
			Name:          "Search for post not from the user1 in the channel1",
			User:          user1,
			InChannels:    []string{channel1.Id},
			ExcludedUsers: []string{user1.Id},
			Matches: map[string][]string{
				post3.Id: {"post"},
			},
		},
		{
			Name:             "Search for post not in the channel1",
			User:             user1,
			ExcludedChannels: []string{channel1.Id},
			Matches: map[string][]string{
				post2.Id: {"post"},
				post4.Id: {"post"},
			},
		},
		{
			Name:             "Search for post not from user1 and not in the channel1",
			User:             user1,
			ExcludedUsers:    []string{user1.Id},
			ExcludedChannels: []string{channel1.Id},
			Matches: map[string][]string{
				post4.Id: {"post"},
			},
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.Name, func(t *testing.T) {
			searchParams[0].FromUsers = tc.FromUsers
			searchParams[0].InChannels = tc.InChannels
			searchParams[0].ExcludedUsers = tc.ExcludedUsers
			searchParams[0].ExcludedChannels = tc.ExcludedChannels

			res, err := s.Post().SearchPostsInTeamForUser(searchParams, tc.User.Id, team.Id, false, false, 0, 20)
			require.Nil(t, err)

			expectedIds := []string{}
			for id := range tc.Matches {
				expectedIds = append(expectedIds, id)
			}

			ids := []string{}
			for id := range res.Posts {
				ids = append(ids, id)
			}

			require.ElementsMatch(t, expectedIds, ids)
			checkMatchesEqual(t, tc.Matches, res.Matches)
		})
	}
}

func testSearchESSearchPosts_AfterBeforeOn(t *testing.T, s store.Store) {
	team, err := s.Team().Save(&model.Team{Name: "t1", DisplayName: "t1", Type: model.TEAM_OPEN})
	require.Nil(t, err)
	defer func() { require.Nil(t, s.Team().PermanentDelete(team.Id)) }()
	channel, err := s.Channel().Save(&model.Channel{TeamId: team.Id, Name: "c1", DisplayName: "c1", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)
	user, err := s.User().Save(createUser("testuser", "testuser", "Test", "User"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user, []string{team.Id}, []string{channel.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user.Id)) }()

	post1, err := s.Post().Save(createPostAtTime(user.Id, channel.Id, "post on 2018-08-28 at 23:59 GMT", 1535500740000))
	require.Nil(t, err)
	post2, err := s.Post().Save(createPostAtTime(user.Id, channel.Id, "post on 2018-08-29 at 00:01 GMT", 1535500860000))
	require.Nil(t, err)
	post3, err := s.Post().Save(createPostAtTime(user.Id, channel.Id, "post on 2018-08-29 at 23:59 GMT", 1535587140000))
	require.Nil(t, err)
	post4, err := s.Post().Save(createPostAtTime(user.Id, channel.Id, "post on 2018-08-30 at 00:01 GMT", 1535587260000))
	require.Nil(t, err)

	earlierTimeZoneOffset := 1 * 60 * 60
	laterTimeZoneOffset := -1 * 60 * 60

	testCases := []struct {
		Name         string
		SearchParams []*model.SearchParams
		ExpectedIds  []string
	}{
		{
			Name: "after: should return posts on 2018-08-30 or later",
			SearchParams: []*model.SearchParams{
				{
					AfterDate: "2018-08-28",
				},
			},
			ExpectedIds: []string{post2.Id, post3.Id, post4.Id},
		},
		{
			Name: "after: should return posts on 2018-09-01 or later",
			SearchParams: []*model.SearchParams{
				{
					AfterDate: "2018-08-30",
				},
			},
			ExpectedIds: []string{},
		},
		{
			Name: "not before: should return posts on 2018-08-28 or later",
			SearchParams: []*model.SearchParams{
				{
					ExcludedBeforeDate: "2018-08-28",
				},
			},
			ExpectedIds: []string{post1.Id, post2.Id, post3.Id, post4.Id},
		},
		{
			Name: "not before: should return posts on 2018-08-29 or later",
			SearchParams: []*model.SearchParams{
				{
					ExcludedBeforeDate: "2018-08-29",
				},
			},
			ExpectedIds: []string{post2.Id, post3.Id, post4.Id},
		},
		{
			Name: "not before: should return posts on 2018-08-30 or later",
			SearchParams: []*model.SearchParams{
				{
					ExcludedBeforeDate: "2018-08-30",
				},
			},
			ExpectedIds: []string{post4.Id},
		},
		{
			Name: "not before: should return posts on 2018-09-01 or later",
			SearchParams: []*model.SearchParams{
				{
					ExcludedBeforeDate: "2018-09-01",
				},
			},
			ExpectedIds: []string{},
		},
		{
			Name: "before: should return posts on 2018-08-29 or earlier",
			SearchParams: []*model.SearchParams{
				{
					BeforeDate: "2018-08-30",
				},
			},
			ExpectedIds: []string{post1.Id, post2.Id, post3.Id},
		},
		{
			Name: "before: should return posts on 2018-08-28 or earlier",
			SearchParams: []*model.SearchParams{
				{
					BeforeDate: "2018-08-29",
				},
			},
			ExpectedIds: []string{post1.Id},
		},
		{
			Name: "before: should return posts on 2018-08-27 or earlier",
			SearchParams: []*model.SearchParams{
				{
					BeforeDate: "2018-08-28",
				},
			},
			ExpectedIds: []string{},
		},
		{
			Name: "after and before: should return posts on 2018-08-29",
			SearchParams: []*model.SearchParams{
				{
					AfterDate:  "2018-08-28",
					BeforeDate: "2018-08-30",
				},
			},
			ExpectedIds: []string{post2.Id, post3.Id},
		},
		{
			Name: "not after: should return posts on 2018-08-30 or earlier",
			SearchParams: []*model.SearchParams{
				{
					ExcludedAfterDate: "2018-09-01",
				},
			},
			ExpectedIds: []string{post1.Id, post2.Id, post3.Id, post4.Id},
		},
		{
			Name: "not after: should return posts on 2018-08-29 or earlier",
			SearchParams: []*model.SearchParams{
				{
					ExcludedAfterDate: "2018-08-29",
				},
			},
			ExpectedIds: []string{post1.Id, post2.Id, post3.Id},
		},

		{
			Name: "not after: should return posts on 2018-08-28 or earlier",
			SearchParams: []*model.SearchParams{
				{
					ExcludedAfterDate: "2018-08-28",
				},
			},
			ExpectedIds: []string{post1.Id},
		},
		{
			Name: "not after: should return posts on 2018-08-27 or earlier",
			SearchParams: []*model.SearchParams{
				{
					ExcludedAfterDate: "2018-08-27",
				},
			},
			ExpectedIds: []string{},
		},
		{
			Name: "not after and not before: should return posts on 2018-08-29",
			SearchParams: []*model.SearchParams{
				{
					ExcludedAfterDate:  "2018-08-29",
					ExcludedBeforeDate: "2018-08-29",
				},
			},
			ExpectedIds: []string{post2.Id, post3.Id},
		},
		{
			Name: "on: should return posts on 2018-08-28",
			SearchParams: []*model.SearchParams{
				{
					OnDate: "2018-08-28",
				},
			},
			ExpectedIds: []string{post1.Id},
		},
		{
			Name: "on: should return posts on 2018-08-29",
			SearchParams: []*model.SearchParams{
				{
					OnDate: "2018-08-29",
				},
			},
			ExpectedIds: []string{post2.Id, post3.Id},
		},
		{
			Name: "on: should return posts on 2018-08-30",
			SearchParams: []*model.SearchParams{
				{
					OnDate: "2018-08-30",
				},
			},
			ExpectedIds: []string{post4.Id},
		},
		{
			Name: "not on: should return all posts but the ones on 2018-08-28",
			SearchParams: []*model.SearchParams{
				{
					ExcludedDate: "2018-08-28",
				},
			},
			ExpectedIds: []string{post2.Id, post3.Id, post4.Id},
		},
		{
			Name: "not on: should return all posts but the ones on 2018-08-29",
			SearchParams: []*model.SearchParams{
				{
					ExcludedDate: "2018-08-29",
				},
			},
			ExpectedIds: []string{post1.Id, post4.Id},
		},
		{
			Name: "not on: should return all posts but the ones on 2018-08-30",
			SearchParams: []*model.SearchParams{
				{
					ExcludedDate: "2018-08-30",
				},
			},
			ExpectedIds: []string{post1.Id, post2.Id, post3.Id},
		},
		{
			Name: "not on and after: should return posts after 2018-08-30",
			SearchParams: []*model.SearchParams{
				{
					AfterDate:    "2018-08-28",
					ExcludedDate: "2018-08-29",
				},
			},
			ExpectedIds: []string{post4.Id},
		},

		{
			Name: "after with different time zones: should return posts after 2018-08-27 23:00",
			SearchParams: []*model.SearchParams{
				{
					AfterDate:      "2018-08-28",
					TimeZoneOffset: earlierTimeZoneOffset,
				},
			},
			ExpectedIds: []string{post1.Id, post2.Id, post3.Id, post4.Id},
		},
		{
			Name: "after with different time zones: should return posts after 2018-08-28 01:00",
			SearchParams: []*model.SearchParams{
				{
					AfterDate:      "2018-08-28",
					TimeZoneOffset: laterTimeZoneOffset,
				},
			},
			ExpectedIds: []string{post3.Id, post4.Id},
		},
		{
			Name: "before with different time zones: should return posts before 2018-08-27 23:00",
			SearchParams: []*model.SearchParams{
				{
					BeforeDate:     "2018-08-30",
					TimeZoneOffset: earlierTimeZoneOffset,
				},
			},
			ExpectedIds: []string{post1.Id, post2.Id},
		},
		{
			Name: "before with different time zones: should return posts before 2018-08-28 01:00",
			SearchParams: []*model.SearchParams{
				{
					BeforeDate:     "2018-08-30",
					TimeZoneOffset: laterTimeZoneOffset,
				},
			},
			ExpectedIds: []string{post1.Id, post2.Id, post3.Id, post4.Id},
		},
		{
			Name: "on with different time zones: should return posts after 2018-08-28 23:00 and before 2018-08-29 23:00",
			SearchParams: []*model.SearchParams{
				{
					OnDate:         "2018-08-29",
					TimeZoneOffset: earlierTimeZoneOffset,
				},
			},
			ExpectedIds: []string{post1.Id, post2.Id},
		},
		{
			Name: "on with different time zones: should return posts after 2018-08-29 01:00 and before 2018-08-30 01:00",
			SearchParams: []*model.SearchParams{
				{
					OnDate:         "2018-08-29",
					TimeZoneOffset: laterTimeZoneOffset,
				},
			},
			ExpectedIds: []string{post3.Id, post4.Id},
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.Name, func(t *testing.T) {
			res, err := s.Post().SearchPostsInTeamForUser(tc.SearchParams, user.Id, team.Id, false, false, 0, 20)
			require.Nil(t, err)

			ids := []string{}
			for id := range res.Posts {
				ids = append(ids, id)
			}

			require.ElementsMatch(t, tc.ExpectedIds, ids)
		})
	}
}

func testSearchESSearchPosts_Hashtags(t *testing.T, s store.Store) {
	team, err := s.Team().Save(&model.Team{Name: "t1", DisplayName: "t1", Type: model.TEAM_OPEN})
	require.Nil(t, err)
	defer func() { require.Nil(t, s.Team().PermanentDelete(team.Id)) }()
	channel, err := s.Channel().Save(&model.Channel{TeamId: team.Id, Name: "c1", DisplayName: "c1", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)
	user, err := s.User().Save(createUser("testuser", "testuser", "Test", "User"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user, []string{team.Id}, []string{channel.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user.Id)) }()

	post1, err := s.Post().Save(createPostWithHashtags(user.Id, channel.Id, "From bean to cup, you #hashtag up", "#hashtag"))
	require.Nil(t, err)
	post2, err := s.Post().Save(createPost(user.Id, channel.Id, "I liek hashtags"))
	require.Nil(t, err)
	post3, err := s.Post().Save(createPostWithHashtags(user.Id, channel.Id, "moar #hashtag please", "#hashtag"))
	require.Nil(t, err)

	testCases := []struct {
		Name         string
		SearchParams []*model.SearchParams
		Matches      map[string][]string
	}{
		{
			Name: "Search for plain term hashtag",
			SearchParams: []*model.SearchParams{
				{
					Terms:     "hashtag",
					IsHashtag: false,
					OrTerms:   false,
				},
			},
			Matches: map[string][]string{
				post1.Id: {"hashtag", "#hashtag"},
				post2.Id: {"hashtags"},
				post3.Id: {"hashtag", "#hashtag"},
			},
		},
		{
			Name: "Search for #hashtag",
			SearchParams: []*model.SearchParams{
				{
					Terms:     "#hashtag",
					IsHashtag: true,
					OrTerms:   false,
				},
			},
			Matches: map[string][]string{
				post1.Id: {"#hashtag"},
				post3.Id: {"#hashtag"},
			},
		},
		{
			Name: "Search for #hashtag and bean",
			SearchParams: []*model.SearchParams{
				{
					Terms:     "#hashtag",
					IsHashtag: true,
					OrTerms:   false,
				},
				{
					Terms:     "bean",
					IsHashtag: false,
					OrTerms:   false,
				},
			},
			Matches: map[string][]string{
				post1.Id: {"bean", "#hashtag"},
			},
		},
		{
			Name: "Search for not #hashtag",
			SearchParams: []*model.SearchParams{
				{
					ExcludedTerms: "#hashtag",
					IsHashtag:     true,
					OrTerms:       false,
				},
			},
			Matches: map[string][]string{
				post2.Id: {},
			},
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.Name, func(t *testing.T) {
			res, err := s.Post().SearchPostsInTeamForUser(tc.SearchParams, user.Id, team.Id, false, false, 0, 20)
			require.Nil(t, err)

			expectedIds := []string{}
			for id := range tc.Matches {
				expectedIds = append(expectedIds, id)
			}

			ids := []string{}
			for id := range res.Posts {
				ids = append(ids, id)
			}

			require.ElementsMatch(t, expectedIds, ids)
			checkMatchesEqual(t, tc.Matches, res.Matches)
		})
	}
}

func testSearchESSearchPosts_HashtagsAndOrWords(t *testing.T, s store.Store) {
	team, err := s.Team().Save(&model.Team{Name: "t1", DisplayName: "t1", Type: model.TEAM_OPEN})
	require.Nil(t, err)
	defer func() { require.Nil(t, s.Team().PermanentDelete(team.Id)) }()
	channel, err := s.Channel().Save(&model.Channel{TeamId: team.Id, Name: "c1", DisplayName: "c1", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)
	user, err := s.User().Save(createUser("testuser", "testuser", "Test", "User"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user, []string{team.Id}, []string{channel.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user.Id)) }()

	// Test searching for posts with Markdown underscores in them.
	post1, err := s.Post().Save(createPostWithHashtags(user.Id, channel.Id, "From bean to cup, you #hashtag up", "#hashtag"))
	require.Nil(t, err)
	post2, err := s.Post().Save(createPostWithHashtags(user.Id, channel.Id, "#hashtag mashup city", "#hashtag"))
	require.Nil(t, err)
	post3, err := s.Post().Save(createPost(user.Id, channel.Id, "has bean"))
	require.Nil(t, err)

	testCases := []struct {
		Name         string
		SearchParams []*model.SearchParams
		ExpectedIds  []string
	}{
		{
			Name: "Search for bean or #hashtag",
			SearchParams: []*model.SearchParams{
				{
					Terms:     "bean",
					IsHashtag: false,
					OrTerms:   false,
				},
				{
					Terms:     "#hashtag",
					IsHashtag: true,
					OrTerms:   false,
				},
			},
			ExpectedIds: []string{post1.Id},
		},
		{
			Name: "Search for bean and #hashtag",
			SearchParams: []*model.SearchParams{
				{
					Terms:     "bean",
					IsHashtag: false,
					OrTerms:   true,
				},
				{
					Terms:     "#hashtag",
					IsHashtag: true,
					OrTerms:   true,
				},
			},
			ExpectedIds: []string{post1.Id, post2.Id, post3.Id},
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.Name, func(t *testing.T) {
			res, err := s.Post().SearchPostsInTeamForUser(tc.SearchParams, user.Id, team.Id, false, false, 0, 20)
			require.Nil(t, err)

			ids := []string{}
			for id := range res.Posts {
				ids = append(ids, id)
			}

			require.ElementsMatch(t, tc.ExpectedIds, ids)
		})
	}
}

func testSearchESSearchPosts_HashtagsCaseInsensitive(t *testing.T, s store.Store) {
	team, err := s.Team().Save(&model.Team{Name: "t1", DisplayName: "t1", Type: model.TEAM_OPEN})
	require.Nil(t, err)
	defer func() { require.Nil(t, s.Team().PermanentDelete(team.Id)) }()
	channel, err := s.Channel().Save(&model.Channel{TeamId: team.Id, Name: "c1", DisplayName: "c1", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)
	user, err := s.User().Save(createUser("testuser", "testuser", "Test", "User"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user, []string{team.Id}, []string{channel.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user.Id)) }()

	// Test searching for posts with Markdown underscores in them.
	post1, err := s.Post().Save(createPostWithHashtags(user.Id, channel.Id, "From bean to cup, you #hashtag up", "#hashtag"))
	require.Nil(t, err)
	post2, err := s.Post().Save(createPost(user.Id, channel.Id, "I liek hashtags"))
	require.Nil(t, err)
	post3, err := s.Post().Save(createPostWithHashtags(user.Id, channel.Id, "moar #Hashtag please", "#Hashtag"))
	require.Nil(t, err)

	testCases := []struct {
		Name         string
		SearchParams []*model.SearchParams
		Matches      map[string][]string
	}{
		{
			Name: "Search for hashtag",
			SearchParams: []*model.SearchParams{
				{
					Terms:     "hashtag",
					IsHashtag: false,
					OrTerms:   false,
				},
			},
			Matches: map[string][]string{
				post1.Id: {"hashtag", "#hashtag"},
				post2.Id: {"hashtags"},
				post3.Id: {"Hashtag", "#hashtag"},
			},
		},
		{
			Name: "Search for #hashtag",
			SearchParams: []*model.SearchParams{
				{
					Terms:     "#hashtag",
					IsHashtag: true,
					OrTerms:   false,
				},
			},
			Matches: map[string][]string{
				post1.Id: {"#hashtag"},
				post3.Id: {"#hashtag"},
			},
		},
		{
			Name: "Search for #HashTag",
			SearchParams: []*model.SearchParams{
				{
					Terms:     "#HashTag",
					IsHashtag: true,
					OrTerms:   false,
				},
			},
			Matches: map[string][]string{
				post1.Id: {"#hashtag"},
				post3.Id: {"#hashtag"},
			},
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.Name, func(t *testing.T) {
			res, err := s.Post().SearchPostsInTeamForUser(tc.SearchParams, user.Id, team.Id, false, false, 0, 20)
			require.Nil(t, err)

			expectedIds := []string{}
			for id := range tc.Matches {
				expectedIds = append(expectedIds, id)
			}

			ids := []string{}
			for id := range res.Posts {
				ids = append(ids, id)
			}

			require.ElementsMatch(t, expectedIds, ids)
			checkMatchesEqual(t, tc.Matches, res.Matches)
		})
	}
}
