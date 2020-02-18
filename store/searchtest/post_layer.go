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
