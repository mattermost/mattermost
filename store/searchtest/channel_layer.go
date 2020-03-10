// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchtest

import (
	"sort"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"

	"github.com/stretchr/testify/require"
)

var searchChannelStoreTests = []searchTest{
	{"Database Channel AutocompleteInTeamForSearch tests", testSearchDatabaseChannelAutocompleteInTeamForSearch, []string{ENGINE_MYSQL, ENGINE_POSTGRES}},
	{"Database Channel SearchInTeam tests", testSearchDatabaseChannelSearchInTeam, []string{ENGINE_MYSQL, ENGINE_POSTGRES}},
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
		t.Run(tc.name, func(t *testing.T) {
			channels, err := s.Channel().AutocompleteInTeamForSearch(o1.TeamId, m1.UserId, "ChannelA", false)
			require.Nil(t, err)
			require.Len(t, *channels, 2)
		})
	}
}

func testSearchDatabaseChannelSearchInTeam(t *testing.T, s store.Store) {
	teamId := model.NewId()
	otherTeamId := model.NewId()

	o1 := model.Channel{
		TeamId:      teamId,
		DisplayName: "ChannelA",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	_, err := s.Channel().Save(&o1, -1)
	require.Nil(t, err)

	o2 := model.Channel{
		TeamId:      otherTeamId,
		DisplayName: "ChannelA",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	_, err = s.Channel().Save(&o2, -1)
	require.Nil(t, err)

	m1 := model.ChannelMember{
		ChannelId:   o1.Id,
		UserId:      model.NewId(),
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	_, err = s.Channel().SaveMember(&m1)
	require.Nil(t, err)

	m2 := model.ChannelMember{
		ChannelId:   o1.Id,
		UserId:      model.NewId(),
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	_, err = s.Channel().SaveMember(&m2)
	require.Nil(t, err)

	m3 := model.ChannelMember{
		ChannelId:   o2.Id,
		UserId:      model.NewId(),
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	_, err = s.Channel().SaveMember(&m3)
	require.Nil(t, err)

	o3 := model.Channel{
		TeamId:      teamId,
		DisplayName: "ChannelA (alternate)",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	_, err = s.Channel().Save(&o3, -1)
	require.Nil(t, err)

	o4 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Channel B",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_PRIVATE,
	}
	_, err = s.Channel().Save(&o4, -1)
	require.Nil(t, err)

	o5 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Channel C",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_PRIVATE,
	}
	_, err = s.Channel().Save(&o5, -1)
	require.Nil(t, err)

	o6 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Off-Topic",
		Name:        "off-topic",
		Type:        model.CHANNEL_OPEN,
	}
	_, err = s.Channel().Save(&o6, -1)
	require.Nil(t, err)

	o7 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Off-Set",
		Name:        "off-set",
		Type:        model.CHANNEL_OPEN,
	}
	_, err = s.Channel().Save(&o7, -1)
	require.Nil(t, err)

	o8 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Off-Limit",
		Name:        "off-limit",
		Type:        model.CHANNEL_PRIVATE,
	}
	_, err = s.Channel().Save(&o8, -1)
	require.Nil(t, err)

	o9 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Town Square",
		Name:        "town-square",
		Type:        model.CHANNEL_OPEN,
	}
	_, err = s.Channel().Save(&o9, -1)
	require.Nil(t, err)

	o10 := model.Channel{
		TeamId:      teamId,
		DisplayName: "The",
		Name:        "the",
		Type:        model.CHANNEL_OPEN,
	}
	_, err = s.Channel().Save(&o10, -1)
	require.Nil(t, err)

	o11 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Native Mobile Apps",
		Name:        "native-mobile-apps",
		Type:        model.CHANNEL_OPEN,
	}
	_, err = s.Channel().Save(&o11, -1)
	require.Nil(t, err)

	o12 := model.Channel{
		TeamId:      teamId,
		DisplayName: "ChannelZ",
		Purpose:     "This can now be searchable!",
		Name:        "with-purpose",
		Type:        model.CHANNEL_OPEN,
	}
	_, err = s.Channel().Save(&o12, -1)
	require.Nil(t, err)

	o13 := model.Channel{
		TeamId:      teamId,
		DisplayName: "ChannelA (deleted)",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
	}
	_, err = s.Channel().Save(&o13, -1)
	require.Nil(t, err)
	o13.DeleteAt = model.GetMillis()
	o13.UpdateAt = o13.DeleteAt
	err = s.Channel().Delete(o13.Id, o13.DeleteAt)
	require.Nil(t, err, "channel should have been deleted")

	testCases := []struct {
		Description     string
		TeamId          string
		Term            string
		IncludeDeleted  bool
		ExpectedResults *model.ChannelList
	}{
		{"ChannelA", teamId, "ChannelA", false, &model.ChannelList{&o1, &o3}},
		{"ChannelA, include deleted", teamId, "ChannelA", true, &model.ChannelList{&o1, &o3, &o13}},
		{"ChannelA, other team", otherTeamId, "ChannelA", false, &model.ChannelList{&o2}},
		{"empty string", teamId, "", false, &model.ChannelList{&o1, &o3, &o12, &o11, &o7, &o6, &o10, &o9}},
		{"no matches", teamId, "blargh", false, &model.ChannelList{}},
		{"prefix", teamId, "off-", false, &model.ChannelList{&o7, &o6}},
		{"full match with dash", teamId, "off-topic", false, &model.ChannelList{&o6}},
		{"town square", teamId, "town square", false, &model.ChannelList{&o9}},
		{"the in name", teamId, "the", false, &model.ChannelList{&o10}},
		{"Mobile", teamId, "Mobile", false, &model.ChannelList{&o11}},
		{"search purpose", teamId, "now searchable", false, &model.ChannelList{&o12}},
		{"pipe ignored", teamId, "town square |", false, &model.ChannelList{&o9}},
	}

	for name, search := range map[string]func(teamId string, term string, includeDeleted bool) (*model.ChannelList, *model.AppError){
		"AutocompleteInTeam": s.Channel().AutocompleteInTeam,
		"SearchInTeam":       s.Channel().SearchInTeam,
	} {
		for _, testCase := range testCases {
			t.Run(testCase.Description, func(t *testing.T) {
				channels, err := search(testCase.TeamId, testCase.Term, testCase.IncludeDeleted)
				require.Nil(t, err)

				// AutoCompleteInTeam doesn't currently sort its output results.
				if name == "AutocompleteInTeam" {
					sort.Sort(ByChannelDisplayName(*channels))
				}

				require.Equal(t, testCase.ExpectedResults, channels)
			})
		}
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
