// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchtest

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"

	"github.com/stretchr/testify/require"
)

var searchChannelStoreTests = []searchTest{
	{"Database Channel AutocompleteInTeamForSearch tests", testSearchDatabaseChannelAutocompleteInTeamForSearch, []string{ENGINE_MYSQL, ENGINE_POSTGRES}},
	{"Elasticsearch search channels", testSearchESSearchChannels, []string{ENGINE_ELASTICSEARCH}},
}

func TestSearchChannelStore(t *testing.T, s store.Store, testEngine *SearchTestEngine) {
	runTestSearch(t, s, testEngine, searchChannelStoreTests)
}

func testSearchDatabaseChannelAutocompleteInTeamForSearch(t *testing.T, s store.Store) {
	u1 := &model.User{}
	u1.Email = makeEmail()
	u1.Username = "user1" + model.NewId()
	u1.Nickname = model.NewId()
	_, err := s.User().Save(u1)
	require.Nil(t, err)

	u2 := &model.User{}
	u2.Email = makeEmail()
	u2.Username = "user2" + model.NewId()
	u2.Nickname = model.NewId()
	_, err = s.User().Save(u2)
	require.Nil(t, err)

	u3 := &model.User{}
	u3.Email = makeEmail()
	u3.Username = "user3" + model.NewId()
	u3.Nickname = model.NewId()
	_, err = s.User().Save(u3)
	require.Nil(t, err)

	u4 := &model.User{}
	u4.Email = makeEmail()
	u4.Username = "user4" + model.NewId()
	u4.Nickname = model.NewId()
	_, err = s.User().Save(u4)
	require.Nil(t, err)

	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "ChannelA"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	_, err = s.Channel().Save(&o1, -1)
	require.Nil(t, err)

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = u1.Id
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	_, err = s.Channel().SaveMember(&m1)
	require.Nil(t, err)

	o2 := model.Channel{}
	o2.TeamId = model.NewId()
	o2.DisplayName = "Channel2"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Type = model.CHANNEL_OPEN
	_, err = s.Channel().Save(&o2, -1)
	require.Nil(t, err)

	m2 := model.ChannelMember{}
	m2.ChannelId = o2.Id
	m2.UserId = m1.UserId
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()
	_, err = s.Channel().SaveMember(&m2)
	require.Nil(t, err)

	o3 := model.Channel{}
	o3.TeamId = o1.TeamId
	o3.DisplayName = "ChannelA"
	o3.Name = "zz" + model.NewId() + "b"
	o3.Type = model.CHANNEL_OPEN
	_, err = s.Channel().Save(&o3, -1)
	require.Nil(t, err)

	m3 := model.ChannelMember{}
	m3.ChannelId = o3.Id
	m3.UserId = m1.UserId
	m3.NotifyProps = model.GetDefaultChannelNotifyProps()
	_, err = s.Channel().SaveMember(&m3)
	require.Nil(t, err)

	err = s.Channel().SetDeleteAt(o3.Id, 100, 100)
	require.Nil(t, err, "channel should have been deleted")

	o4 := model.Channel{}
	o4.TeamId = o1.TeamId
	o4.DisplayName = "ChannelA"
	o4.Name = "zz" + model.NewId() + "b"
	o4.Type = model.CHANNEL_PRIVATE
	_, err = s.Channel().Save(&o4, -1)
	require.Nil(t, err)

	m4 := model.ChannelMember{}
	m4.ChannelId = o4.Id
	m4.UserId = m1.UserId
	m4.NotifyProps = model.GetDefaultChannelNotifyProps()
	_, err = s.Channel().SaveMember(&m4)
	require.Nil(t, err)

	o5 := model.Channel{}
	o5.TeamId = o1.TeamId
	o5.DisplayName = "ChannelC"
	o5.Name = "zz" + model.NewId() + "b"
	o5.Type = model.CHANNEL_PRIVATE
	_, err = s.Channel().Save(&o5, -1)
	require.Nil(t, err)

	_, err = s.Channel().CreateDirectChannel(u1, u2)
	require.Nil(t, err)
	_, err = s.Channel().CreateDirectChannel(u2, u3)
	require.Nil(t, err)

	tt := []struct {
		name            string
		term            string
		includeDeleted  bool
		expectedMatches int
	}{
		{"Empty search (list all)", "", false, 4},
		{"Narrow search", "ChannelA", false, 2},
		{"Wide search", "Cha", false, 3},
		{"Direct messages", "user", false, 1},
		{"Wide search with archived channels", "Cha", true, 4},
		{"Narrow with archived channels", "ChannelA", true, 3},
		{"Direct messages with archived channels", "user", true, 1},
		{"Search without results", "blarg", true, 0},
	}

	for _, tc := range tt {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			channels, err := s.Channel().AutocompleteInTeamForSearch(o1.TeamId, m1.UserId, "ChannelA", false)
			require.Nil(t, err)
			require.Len(t, *channels, 2)
		})
	}
}

func testSearchESSearchChannels(t *testing.T, s store.Store) {
	team, err := s.Team().Save(&model.Team{Name: "team", DisplayName: "team", Type: model.TEAM_OPEN})
	require.Nil(t, err)
	channel1, err := s.Channel().Save(&model.Channel{TeamId: team.Id, Name: "channel", DisplayName: "Test One", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)
	channel2, err := s.Channel().Save(&model.Channel{TeamId: team.Id, Name: "channel-second", DisplayName: "Test Two", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)
	channel3, err := s.Channel().Save(&model.Channel{TeamId: team.Id, Name: "channel_third", DisplayName: "Test Three", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)

	testCases := []struct {
		Name     string
		Term     string
		Expected []string
	}{
		{
			Name:     "autocomplete search for all channels by name",
			Term:     "cha",
			Expected: []string{channel1.Id, channel2.Id, channel3.Id},
		},
		{
			Name:     "autocomplete search for one channel by display name",
			Term:     "one",
			Expected: []string{channel1.Id},
		},
		{
			Name:     "autocomplete search for one channel split by -",
			Term:     "seco",
			Expected: []string{channel2.Id},
		},
		{
			Name:     "autocomplete search for one channel split by _",
			Term:     "thir",
			Expected: []string{channel3.Id},
		},
		{
			Name:     "autocomplete search that won't match anything",
			Term:     "nothing",
			Expected: []string{},
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.Name, func(t *testing.T) {
			res, err := s.Channel().AutocompleteInTeam(team.Id, tc.Term, false)
			require.Nil(t, err)
			require.Len(t, tc.Expected, len(*res))

			resIds := make([]string, len(*res))
			for i, channel := range *res {
				resIds[i] = channel.Id
			}
			require.ElementsMatch(t, tc.Expected, resIds)
		})
	}
}
