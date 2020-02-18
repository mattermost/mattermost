// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchtest

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

var searchUserStoreTests = []searchTest{
	{"Database User Search tests", testSearchDatabaseUserSearch, []string{ENGINE_MYSQL, ENGINE_POSTGRES}},
	{"Database User SearchNotInChannel tests", testSearchDatabaseUserSearchNotInChannel, []string{ENGINE_MYSQL, ENGINE_POSTGRES}},
	{"Database User SearchInChannel tests", testSearchDatabaseUserSearchInChannel, []string{ENGINE_MYSQL, ENGINE_POSTGRES}},
	{"Database User SearchNotInTeam tests", testSearchDatabaseUserSearchNotInTeam, []string{ENGINE_MYSQL, ENGINE_POSTGRES}},
	{"Database User SearchWithoutTeam tests", testSearchDatabaseUserSearchWithoutTeam, []string{ENGINE_MYSQL, ENGINE_POSTGRES}},
	{"Elasticsearch search users in channel", testSearchESSearchUsersInChannel, []string{ENGINE_ELASTICSEARCH}},
	{"Elasticsearch search users in team", testSearchESSearchUsersInTeam, []string{ENGINE_ELASTICSEARCH}},
}

func TestSearchUserStore(t *testing.T, s store.Store, testEngine *SearchTestEngine) {
	runTestSearch(t, s, testEngine, searchUserStoreTests)
}

func testSearchDatabaseUserSearch(t *testing.T, s store.Store) {
	u1 := &model.User{
		Username:  "jimbo1" + model.NewId(),
		FirstName: "Tim",
		LastName:  "Bill",
		Nickname:  "Rob",
		Email:     "harold" + model.NewId() + "@simulator.amazonses.com",
		Roles:     "system_user system_admin",
	}
	_, err := s.User().Save(u1)
	require.Nil(t, err)
	defer func() { require.Nil(t, s.User().PermanentDelete(u1.Id)) }()

	u2 := &model.User{
		Username: "jim-bobby" + model.NewId(),
		Email:    makeEmail(),
		Roles:    "system_user",
	}
	_, err = s.User().Save(u2)
	require.Nil(t, err)
	defer func() { require.Nil(t, s.User().PermanentDelete(u2.Id)) }()

	u3 := &model.User{
		Username: "jimbo3" + model.NewId(),
		Email:    makeEmail(),
		DeleteAt: 1,
		Roles:    "system_admin",
	}
	_, err = s.User().Save(u3)
	require.Nil(t, err)
	defer func() { require.Nil(t, s.User().PermanentDelete(u3.Id)) }()
	_, err = s.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.Nil(t, err)
	u3.IsBot = true
	defer func() { require.Nil(t, s.Bot().PermanentDelete(u3.Id)) }()

	u5 := &model.User{
		Username:  "yu" + model.NewId(),
		FirstName: "En",
		LastName:  "Yu",
		Nickname:  "enyu",
		Email:     makeEmail(),
	}
	_, err = s.User().Save(u5)
	require.Nil(t, err)
	defer func() { require.Nil(t, s.User().PermanentDelete(u5.Id)) }()

	u6 := &model.User{
		Username:  "underscore" + model.NewId(),
		FirstName: "Du_",
		LastName:  "_DE",
		Nickname:  "lodash",
		Email:     makeEmail(),
	}
	_, err = s.User().Save(u6)
	require.Nil(t, err)
	defer func() { require.Nil(t, s.User().PermanentDelete(u6.Id)) }()

	team, err := s.Team().Save(&model.Team{Name: "t1", DisplayName: "t1", Type: model.TEAM_OPEN})
	require.Nil(t, err)
	channel, err := s.Channel().Save(&model.Channel{TeamId: team.Id, Name: "c1", DisplayName: "c1", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)

	_, err = s.Team().SaveMember(&model.TeamMember{TeamId: team.Id, UserId: u1.Id}, -1)
	require.Nil(t, err)
	_, err = s.Channel().SaveMember(&model.ChannelMember{ChannelId: channel.Id, UserId: u1.Id, NotifyProps: model.GetDefaultChannelNotifyProps()})
	require.Nil(t, err)
	_, err = s.Team().SaveMember(&model.TeamMember{TeamId: team.Id, UserId: u2.Id}, -1)
	require.Nil(t, err)
	_, err = s.Channel().SaveMember(&model.ChannelMember{ChannelId: channel.Id, UserId: u2.Id, NotifyProps: model.GetDefaultChannelNotifyProps()})
	require.Nil(t, err)
	_, err = s.Team().SaveMember(&model.TeamMember{TeamId: team.Id, UserId: u3.Id}, -1)
	require.Nil(t, err)
	_, err = s.Channel().SaveMember(&model.ChannelMember{ChannelId: channel.Id, UserId: u3.Id, NotifyProps: model.GetDefaultChannelNotifyProps()})
	require.Nil(t, err)
	_, err = s.Team().SaveMember(&model.TeamMember{TeamId: team.Id, UserId: u5.Id}, -1)
	require.Nil(t, err)
	_, err = s.Channel().SaveMember(&model.ChannelMember{ChannelId: channel.Id, UserId: u5.Id, NotifyProps: model.GetDefaultChannelNotifyProps()})
	require.Nil(t, err)
	_, err = s.Team().SaveMember(&model.TeamMember{TeamId: team.Id, UserId: u6.Id}, -1)
	require.Nil(t, err)
	_, err = s.Channel().SaveMember(&model.ChannelMember{ChannelId: channel.Id, UserId: u6.Id, NotifyProps: model.GetDefaultChannelNotifyProps()})
	require.Nil(t, err)

	// The users returned from the database will have AuthData as an empty string.
	nilAuthData := new(string)
	*nilAuthData = ""

	u1.AuthData = nilAuthData
	u2.AuthData = nilAuthData
	u3.AuthData = nilAuthData
	u5.AuthData = nilAuthData
	u6.AuthData = nilAuthData

	testCases := []struct {
		Description string
		TeamId      string
		Term        string
		Options     *model.UserSearchOptions
		Expected    []*model.User
	}{
		{
			"search jimb",
			team.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u1},
		},
		{
			"search en",
			team.Id,
			"en",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u5},
		},
		{
			"search email",
			team.Id,
			u1.Email,
			&model.UserSearchOptions{
				AllowEmails:    true,
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u1},
		},
		{
			"search maps * to space",
			team.Id,
			"jimb*",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u1},
		},
		{
			"should not return spurious matches",
			team.Id,
			"harol",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{},
		},
		{
			"% should be escaped",
			team.Id,
			"h%",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{},
		},
		{
			"_ should be escaped",
			team.Id,
			"h_",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{},
		},
		{
			"_ should be escaped (2)",
			team.Id,
			"Du_",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u6},
		},
		{
			"_ should be escaped (2)",
			team.Id,
			"_dE",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u6},
		},
		{
			"search jimb, allowing inactive",
			team.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u1, u3},
		},
		{
			"search jimb, no team id",
			"",
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u1},
		},
		{
			"search jim-bobb, no team id",
			"",
			"jim-bobb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u2},
		},

		{
			"search harol, search all fields",
			team.Id,
			"harol",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowEmails:    true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u1},
		},
		{
			"search Tim, search all fields",
			team.Id,
			"Tim",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowEmails:    true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u1},
		},
		{
			"search Tim, don't search full names",
			team.Id,
			"Tim",
			&model.UserSearchOptions{
				AllowFullNames: false,
				AllowEmails:    true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{},
		},
		{
			"search Bill, search all fields",
			team.Id,
			"Bill",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowEmails:    true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u1},
		},
		{
			"search Rob, search all fields",
			team.Id,
			"Rob",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowEmails:    true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u1},
		},
		{
			"leading @ should be ignored",
			team.Id,
			"@jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u1},
		},
		{
			"search jim-bobby with system_user roles",
			team.Id,
			"jim-bobby",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
				Role:           "system_user",
			},
			[]*model.User{u2},
		},
		{
			"search jim with system_admin roles",
			team.Id,
			"jim",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
				Role:           "system_admin",
			},
			[]*model.User{u1},
		},
		{
			"search ji with system_user roles",
			team.Id,
			"ji",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
				Role:           "system_user",
			},
			[]*model.User{u1, u2},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			users, err := s.User().Search(testCase.TeamId, testCase.Term, testCase.Options)
			require.Nil(t, err)
			assertUsersMatchInAnyOrder(t, testCase.Expected, users)
		})
	}

	t.Run("search empty string", func(t *testing.T) {
		searchOptions := &model.UserSearchOptions{
			AllowFullNames: true,
			Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
		}

		users, err := s.User().Search(team.Id, "", searchOptions)
		require.Nil(t, err)
		assert.Len(t, users, 4)
		// Don't assert contents, since Postgres' default collation order is left up to
		// the operating system, and jimbo1 might sort before or after jim-bo.
		// assertUsers(t, []*model.User{u2, u1, u6, u5}, r1.Data.([]*model.User))
	})

	t.Run("search empty string, limit 2", func(t *testing.T) {
		searchOptions := &model.UserSearchOptions{
			AllowFullNames: true,
			Limit:          2,
		}

		users, err := s.User().Search(team.Id, "", searchOptions)
		require.Nil(t, err)
		assert.Len(t, users, 2)
		// Don't assert contents, since Postgres' default collation order is left up to
		// the operating system, and jimbo1 might sort before or after jim-bo.
		// assertUsers(t, []*model.User{u2, u1, u6, u5}, r1.Data.([]*model.User))
	})
}

func testSearchDatabaseUserSearchNotInChannel(t *testing.T, s store.Store) {
	u1 := &model.User{
		Username:  "jimbo1" + model.NewId(),
		FirstName: "Tim",
		LastName:  "Bill",
		Nickname:  "Rob",
		Email:     "harold" + model.NewId() + "@simulator.amazonses.com",
	}
	_, err := s.User().Save(u1)
	require.Nil(t, err)
	defer func() { require.Nil(t, s.User().PermanentDelete(u1.Id)) }()

	u2 := &model.User{
		Username: "jim2-bobby" + model.NewId(),
		Email:    makeEmail(),
	}
	_, err = s.User().Save(u2)
	require.Nil(t, err)
	defer func() { require.Nil(t, s.User().PermanentDelete(u2.Id)) }()

	u3 := &model.User{
		Username: "jimbo3" + model.NewId(),
		Email:    makeEmail(),
		DeleteAt: 1,
	}
	_, err = s.User().Save(u3)
	require.Nil(t, err)
	defer func() { require.Nil(t, s.User().PermanentDelete(u3.Id)) }()
	_, err = s.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.Nil(t, err)
	u3.IsBot = true
	defer func() { require.Nil(t, s.Bot().PermanentDelete(u3.Id)) }()

	tid := model.NewId()
	_, err = s.Team().SaveMember(&model.TeamMember{TeamId: tid, UserId: u1.Id}, -1)
	require.Nil(t, err)
	_, err = s.Team().SaveMember(&model.TeamMember{TeamId: tid, UserId: u2.Id}, -1)
	require.Nil(t, err)
	_, err = s.Team().SaveMember(&model.TeamMember{TeamId: tid, UserId: u3.Id}, -1)
	require.Nil(t, err)

	// The users returned from the database will have AuthData as an empty string.
	nilAuthData := new(string)
	*nilAuthData = ""

	u1.AuthData = nilAuthData
	u2.AuthData = nilAuthData
	u3.AuthData = nilAuthData

	ch1 := model.Channel{
		TeamId:      tid,
		DisplayName: "NameName",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	c1, err := s.Channel().Save(&ch1, -1)
	require.Nil(t, err)

	ch2 := model.Channel{
		TeamId:      tid,
		DisplayName: "NameName",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	c2, err := s.Channel().Save(&ch2, -1)
	require.Nil(t, err)

	_, err = s.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c2.Id,
		UserId:      u1.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.Nil(t, err)
	_, err = s.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u3.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.Nil(t, err)
	_, err = s.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c2.Id,
		UserId:      u2.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.Nil(t, err)

	testCases := []struct {
		Description string
		TeamId      string
		ChannelId   string
		Term        string
		Options     *model.UserSearchOptions
		Expected    []*model.User
	}{
		{
			"search jimb, channel 1",
			tid,
			c1.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u1},
		},
		{
			"search jimb, allow inactive, channel 1",
			tid,
			c1.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u1},
		},
		{
			"search jimb, channel 1, no team id",
			"",
			c1.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u1},
		},
		{
			"search jimb, channel 1, junk team id",
			"junk",
			c1.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{},
		},
		{
			"search jimb, channel 2",
			tid,
			c2.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{},
		},
		{
			"search jimb, allow inactive, channel 2",
			tid,
			c2.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u3},
		},
		{
			"search jimb, channel 2, no team id",
			"",
			c2.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{},
		},
		{
			"search jimb, channel 2, junk team id",
			"junk",
			c2.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{},
		},
		{
			"search jim, channel 1",
			tid,
			c1.Id,
			"jim",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u2, u1},
		},
		{
			"search jim, channel 1, limit 1",
			tid,
			c1.Id,
			"jim",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          1,
			},
			[]*model.User{u2},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			users, err := s.User().SearchNotInChannel(
				testCase.TeamId,
				testCase.ChannelId,
				testCase.Term,
				testCase.Options,
			)
			require.Nil(t, err)
			assertUsers(t, testCase.Expected, users)
		})
	}
}

func testSearchDatabaseUserSearchInChannel(t *testing.T, s store.Store) {
	u1 := &model.User{
		Username:  "jimbo1" + model.NewId(),
		FirstName: "Tim",
		LastName:  "Bill",
		Nickname:  "Rob",
		Email:     "harold" + model.NewId() + "@simulator.amazonses.com",
	}
	_, err := s.User().Save(u1)
	require.Nil(t, err)
	defer func() { require.Nil(t, s.User().PermanentDelete(u1.Id)) }()

	u2 := &model.User{
		Username: "jim-bobby" + model.NewId(),
		Email:    makeEmail(),
	}
	_, err = s.User().Save(u2)
	require.Nil(t, err)
	defer func() { require.Nil(t, s.User().PermanentDelete(u2.Id)) }()

	u3 := &model.User{
		Username: "jimbo3" + model.NewId(),
		Email:    makeEmail(),
		DeleteAt: 1,
	}
	_, err = s.User().Save(u3)
	require.Nil(t, err)
	defer func() { require.Nil(t, s.User().PermanentDelete(u3.Id)) }()
	_, err = s.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.Nil(t, err)
	u3.IsBot = true
	defer func() { require.Nil(t, s.Bot().PermanentDelete(u3.Id)) }()

	tid := model.NewId()
	_, err = s.Team().SaveMember(&model.TeamMember{TeamId: tid, UserId: u1.Id}, -1)
	require.Nil(t, err)
	_, err = s.Team().SaveMember(&model.TeamMember{TeamId: tid, UserId: u2.Id}, -1)
	require.Nil(t, err)
	_, err = s.Team().SaveMember(&model.TeamMember{TeamId: tid, UserId: u3.Id}, -1)
	require.Nil(t, err)

	// The users returned from the database will have AuthData as an empty string.
	nilAuthData := new(string)
	*nilAuthData = ""

	u1.AuthData = nilAuthData
	u2.AuthData = nilAuthData
	u3.AuthData = nilAuthData

	ch1 := model.Channel{
		TeamId:      tid,
		DisplayName: "NameName",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	c1, err := s.Channel().Save(&ch1, -1)
	require.Nil(t, err)

	ch2 := model.Channel{
		TeamId:      tid,
		DisplayName: "NameName",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	c2, err := s.Channel().Save(&ch2, -1)
	require.Nil(t, err)

	_, err = s.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u1.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.Nil(t, err)
	_, err = s.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c2.Id,
		UserId:      u2.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.Nil(t, err)
	_, err = s.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u3.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.Nil(t, err)

	testCases := []struct {
		Description string
		ChannelId   string
		Term        string
		Options     *model.UserSearchOptions
		Expected    []*model.User
	}{
		{
			"search jimb, channel 1",
			c1.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u1},
		},
		{
			"search jimb, allow inactive, channel 1",
			c1.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u1, u3},
		},
		{
			"search jimb, allow inactive, channel 1, limit 1",
			c1.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          1,
			},
			[]*model.User{u1},
		},
		{
			"search jimb, channel 2",
			c2.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{},
		},
		{
			"search jimb, allow inactive, channel 2",
			c2.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			users, err := s.User().SearchInChannel(
				testCase.ChannelId,
				testCase.Term,
				testCase.Options,
			)
			require.Nil(t, err)
			assertUsers(t, testCase.Expected, users)
		})
	}
}

func testSearchDatabaseUserSearchNotInTeam(t *testing.T, s store.Store) {
	u1 := &model.User{
		Username:  "jimbo1" + model.NewId(),
		FirstName: "Tim",
		LastName:  "Bill",
		Nickname:  "Rob",
		Email:     "harold" + model.NewId() + "@simulator.amazonses.com",
	}
	_, err := s.User().Save(u1)
	require.Nil(t, err)
	defer func() { require.Nil(t, s.User().PermanentDelete(u1.Id)) }()

	u2 := &model.User{
		Username: "jim-bobby" + model.NewId(),
		Email:    makeEmail(),
	}
	_, err = s.User().Save(u2)
	require.Nil(t, err)
	defer func() { require.Nil(t, s.User().PermanentDelete(u2.Id)) }()

	u3 := &model.User{
		Username: "jimbo3" + model.NewId(),
		Email:    makeEmail(),
		DeleteAt: 1,
	}
	_, err = s.User().Save(u3)
	require.Nil(t, err)
	defer func() { require.Nil(t, s.User().PermanentDelete(u3.Id)) }()
	_, err = s.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.Nil(t, err)
	u3.IsBot = true
	defer func() { require.Nil(t, s.Bot().PermanentDelete(u3.Id)) }()

	u4 := &model.User{
		Username: "simon" + model.NewId(),
		Email:    makeEmail(),
		DeleteAt: 0,
	}
	_, err = s.User().Save(u4)
	require.Nil(t, err)
	defer func() { require.Nil(t, s.User().PermanentDelete(u4.Id)) }()

	u5 := &model.User{
		Username:  "yu" + model.NewId(),
		FirstName: "En",
		LastName:  "Yu",
		Nickname:  "enyu",
		Email:     makeEmail(),
	}
	_, err = s.User().Save(u5)
	require.Nil(t, err)
	defer func() { require.Nil(t, s.User().PermanentDelete(u5.Id)) }()

	u6 := &model.User{
		Username:  "underscore" + model.NewId(),
		FirstName: "Du_",
		LastName:  "_DE",
		Nickname:  "lodash",
		Email:     makeEmail(),
	}
	_, err = s.User().Save(u6)
	require.Nil(t, err)
	defer func() { require.Nil(t, s.User().PermanentDelete(u6.Id)) }()

	teamId1 := model.NewId()
	_, err = s.Team().SaveMember(&model.TeamMember{TeamId: teamId1, UserId: u1.Id}, -1)
	require.Nil(t, err)
	_, err = s.Team().SaveMember(&model.TeamMember{TeamId: teamId1, UserId: u2.Id}, -1)
	require.Nil(t, err)
	_, err = s.Team().SaveMember(&model.TeamMember{TeamId: teamId1, UserId: u3.Id}, -1)
	require.Nil(t, err)
	// u4 is not in team 1
	_, err = s.Team().SaveMember(&model.TeamMember{TeamId: teamId1, UserId: u5.Id}, -1)
	require.Nil(t, err)
	_, err = s.Team().SaveMember(&model.TeamMember{TeamId: teamId1, UserId: u6.Id}, -1)
	require.Nil(t, err)

	teamId2 := model.NewId()
	_, err = s.Team().SaveMember(&model.TeamMember{TeamId: teamId2, UserId: u4.Id}, -1)
	require.Nil(t, err)

	// The users returned from the database will have AuthData as an empty string.
	nilAuthData := new(string)
	*nilAuthData = ""

	u1.AuthData = nilAuthData
	u2.AuthData = nilAuthData
	u3.AuthData = nilAuthData
	u4.AuthData = nilAuthData
	u5.AuthData = nilAuthData
	u6.AuthData = nilAuthData

	testCases := []struct {
		Description string
		TeamId      string
		Term        string
		Options     *model.UserSearchOptions
		Expected    []*model.User
	}{
		{
			"search simo, team 1",
			teamId1,
			"simo",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u4},
		},

		{
			"search jimb, team 1",
			teamId1,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{},
		},
		{
			"search jimb, allow inactive, team 1",
			teamId1,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{},
		},
		{
			"search simo, team 2",
			teamId2,
			"simo",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{},
		},
		{
			"search jimb, team2",
			teamId2,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u1},
		},
		{
			"search jimb, allow inactive, team 2",
			teamId2,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u1, u3},
		},
		{
			"search jimb, allow inactive, team 2, limit 1",
			teamId2,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          1,
			},
			[]*model.User{u1},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			users, err := s.User().SearchNotInTeam(
				testCase.TeamId,
				testCase.Term,
				testCase.Options,
			)
			require.Nil(t, err)
			assertUsers(t, testCase.Expected, users)
		})
	}
}

func testSearchDatabaseUserSearchWithoutTeam(t *testing.T, s store.Store) {
	u1 := &model.User{
		Username:  "jimbo1" + model.NewId(),
		FirstName: "Tim",
		LastName:  "Bill",
		Nickname:  "Rob",
		Email:     "harold" + model.NewId() + "@simulator.amazonses.com",
	}
	_, err := s.User().Save(u1)
	require.Nil(t, err)
	defer func() { require.Nil(t, s.User().PermanentDelete(u1.Id)) }()

	u2 := &model.User{
		Username: "jim2-bobby" + model.NewId(),
		Email:    makeEmail(),
	}
	_, err = s.User().Save(u2)
	require.Nil(t, err)
	defer func() { require.Nil(t, s.User().PermanentDelete(u2.Id)) }()

	u3 := &model.User{
		Username: "jimbo3" + model.NewId(),
		Email:    makeEmail(),
		DeleteAt: 1,
	}
	_, err = s.User().Save(u3)
	require.Nil(t, err)
	defer func() { require.Nil(t, s.User().PermanentDelete(u3.Id)) }()
	_, err = s.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.Nil(t, err)
	u3.IsBot = true
	defer func() { require.Nil(t, s.Bot().PermanentDelete(u3.Id)) }()

	tid := model.NewId()
	_, err = s.Team().SaveMember(&model.TeamMember{TeamId: tid, UserId: u3.Id}, -1)
	require.Nil(t, err)

	// The users returned from the database will have AuthData as an empty string.
	nilAuthData := new(string)
	*nilAuthData = ""

	u1.AuthData = nilAuthData
	u2.AuthData = nilAuthData
	u3.AuthData = nilAuthData

	testCases := []struct {
		Description string
		Term        string
		Options     *model.UserSearchOptions
		Expected    []*model.User
	}{
		{
			"empty string",
			"",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u2, u1},
		},
		{
			"jim",
			"jim",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u2, u1},
		},
		{
			"PLT-8354",
			"* ",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
			},
			[]*model.User{u2, u1},
		},
		{
			"jim, limit 1",
			"jim",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          1,
			},
			[]*model.User{u2},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			users, err := s.User().SearchWithoutTeam(
				testCase.Term,
				testCase.Options,
			)
			require.Nil(t, err)
			assertUsers(t, testCase.Expected, users)
		})
	}
}

func testSearchESSearchUsersInChannel(t *testing.T, s store.Store) {
	// Create and index some users
	// Channels for team 1
	team1, err := s.Team().Save(&model.Team{Name: "team1", DisplayName: "team1", Type: model.TEAM_OPEN})
	require.Nil(t, err)
	defer func() { require.Nil(t, s.Team().PermanentDelete(team1.Id)) }()
	channel1, err := s.Channel().Save(&model.Channel{TeamId: team1.Id, Name: "channel", DisplayName: "Test One", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)
	channel2, err := s.Channel().Save(&model.Channel{TeamId: team1.Id, Name: "channel-second", DisplayName: "Test Two", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)

	// Channels for team 2
	team2, err := s.Team().Save(&model.Team{Name: "team2", DisplayName: "team2", Type: model.TEAM_OPEN})
	require.Nil(t, err)
	defer func() { require.Nil(t, s.Team().PermanentDelete(team2.Id)) }()
	channel3, err := s.Channel().Save(&model.Channel{TeamId: team2.Id, Name: "channel_third", DisplayName: "Test Three", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)

	// Users in team 1
	user1, err := s.User().Save(createUser("test.one", "userone", "User", "One"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user1, []string{team1.Id}, []string{channel1.Id, channel2.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user1.Id)) }()

	user2, err := s.User().Save(createUser("test.two", "usertwo", "User", "Special Two"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user2, []string{team1.Id}, []string{channel1.Id, channel2.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user2.Id)) }()

	user3, err := s.User().Save(createUser("test.three", "userthree", "User", "Special Three"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user3, []string{team1.Id}, []string{channel2.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user3.Id)) }()

	// Users in team 2
	user4, err := s.User().Save(createUser("test.four", "userfour", "User", "Four"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user4, []string{team2.Id}, []string{channel3.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user4.Id)) }()

	user5, err := s.User().Save(createUser("test.five_split", "userfive", "User", "Five"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user5, []string{team2.Id}, []string{channel3.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user5.Id)) }()

	// Given the default search options
	options := &model.UserSearchOptions{
		AllowFullNames: true,
		Limit:          100,
	}

	testCases := []struct {
		Name             string
		Team             string
		Channel          string
		ViewRestrictions *model.ViewUsersRestrictions
		Term             string
		InChannel        []string
		OutOfChannel     []string
	}{
		{
			Name:             "All users in channel1",
			Team:             team1.Id,
			Channel:          channel1.Id,
			ViewRestrictions: nil,
			Term:             "",
			InChannel:        []string{user1.Id, user2.Id},
			OutOfChannel:     []string{user3.Id},
		},
		{
			Name:             "All users in channel1 with channel restrictions",
			Team:             team1.Id,
			Channel:          channel1.Id,
			ViewRestrictions: &model.ViewUsersRestrictions{Channels: []string{channel1.Id}},
			Term:             "",
			InChannel:        []string{user1.Id, user2.Id},
			OutOfChannel:     []string{},
		},
		{
			Name:             "All users in channel1 with channel all channels restricted",
			Team:             team1.Id,
			Channel:          channel1.Id,
			ViewRestrictions: &model.ViewUsersRestrictions{Channels: []string{}},
			Term:             "",
			InChannel:        []string{},
			OutOfChannel:     []string{},
		},
		{
			Name:             "All users in channel2",
			Team:             team1.Id,
			Channel:          channel2.Id,
			ViewRestrictions: nil,
			Term:             "",
			InChannel:        []string{user1.Id, user2.Id, user3.Id},
			OutOfChannel:     []string{},
		},
		{
			Name:             "All users in channel3",
			Team:             team2.Id,
			Channel:          channel3.Id,
			ViewRestrictions: nil,
			Term:             "",
			InChannel:        []string{user4.Id, user5.Id},
			OutOfChannel:     []string{},
		},
		{
			Name:             "All users in channel1 with term \"spe\"",
			Team:             team1.Id,
			Channel:          channel1.Id,
			ViewRestrictions: nil,
			Term:             "spe",
			InChannel:        []string{user2.Id},
			OutOfChannel:     []string{user3.Id},
		},
		{
			Name:             "All users in channel1 with term \"spe\" with channel restrictions",
			Team:             team1.Id,
			Channel:          channel1.Id,
			ViewRestrictions: &model.ViewUsersRestrictions{Channels: []string{channel1.Id}},
			Term:             "spe",
			InChannel:        []string{user2.Id},
			OutOfChannel:     []string{},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			options.ViewRestrictions = tc.ViewRestrictions
			res, err := s.User().AutocompleteUsersInChannel(tc.Team, tc.Channel, tc.Term, options)
			require.Nil(t, err)

			require.Len(t, res.InChannel, len(tc.InChannel))
			inChannelIds := make([]string, len(res.InChannel))
			for i, user := range res.InChannel {
				inChannelIds[i] = user.Id
			}
			assert.ElementsMatch(t, tc.InChannel, inChannelIds)

			require.Len(t, res.OutOfChannel, len(tc.OutOfChannel))
			outOfChannelIds := make([]string, len(res.OutOfChannel))
			for i, user := range res.OutOfChannel {
				outOfChannelIds[i] = user.Id
			}
			assert.ElementsMatch(t, tc.OutOfChannel, outOfChannelIds)
		})
	}
}

func testSearchESSearchUsersInTeam(t *testing.T, s store.Store) {
	// Create and index some users
	// Channels for team 1
	team1, err := s.Team().Save(&model.Team{Name: "team1", DisplayName: "team1", Type: model.TEAM_OPEN})
	require.Nil(t, err)
	defer require.Nil(t, s.Team().PermanentDelete(team1.Id))
	channel1, err := s.Channel().Save(&model.Channel{TeamId: team1.Id, Name: "channel", DisplayName: "Test One", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)
	channel2, err := s.Channel().Save(&model.Channel{TeamId: team1.Id, Name: "channel-second", DisplayName: "Test Two", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)

	// Channels for team 2
	team2, err := s.Team().Save(&model.Team{Name: "team2", DisplayName: "team2", Type: model.TEAM_OPEN})
	require.Nil(t, err)
	defer require.Nil(t, s.Team().PermanentDelete(team2.Id))
	channel3, err := s.Channel().Save(&model.Channel{TeamId: team2.Id, Name: "channel_third", DisplayName: "Test Three", Type: model.CHANNEL_OPEN}, -1)
	require.Nil(t, err)

	// Users in team 1
	user1, err := s.User().Save(createUser("test.one.split", "userone", "User", "One"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user1, []string{team1.Id}, []string{channel1.Id, channel2.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user1.Id)) }()

	user2, err := s.User().Save(createUser("test.two", "usertwo", "User", "Special Two"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user2, []string{team1.Id}, []string{channel1.Id, channel2.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user2.Id)) }()

	user3, err := s.User().Save(createUser("test.three", "userthree", "User", "Special Three"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user3, []string{team1.Id}, []string{channel2.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user3.Id)) }()

	// Users in team 2
	user4, err := s.User().Save(createUser("test.four-slash", "userfour", "User", "Four"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user4, []string{team2.Id}, []string{channel3.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user4.Id)) }()

	user5, err := s.User().Save(createUser("test.five.split", "userfive", "User", "Five"))
	require.Nil(t, err)
	require.Nil(t, addUserToTeamsAndChannels(s, user5, []string{team2.Id}, []string{channel3.Id}))
	defer func() { require.Nil(t, s.User().PermanentDelete(user5.Id)) }()

	// Given the default search options
	options := &model.UserSearchOptions{
		AllowFullNames: true,
		Limit:          100,
	}

	testCases := []struct {
		Name             string
		Team             string
		ViewRestrictions *model.ViewUsersRestrictions
		Term             string
		Result           []string
	}{
		{
			Name:             "All users in team1",
			Team:             team1.Id,
			ViewRestrictions: nil,
			Term:             "",
			Result:           []string{user1.Id, user2.Id, user3.Id},
		},
		{
			Name:             "All users in team1 with term \"spe\"",
			Team:             team1.Id,
			ViewRestrictions: nil,
			Term:             "spe",
			Result:           []string{user2.Id, user3.Id},
		},
		{
			Name:             "All users in team1 with term \"spe\" and channel restrictions",
			Team:             team1.Id,
			ViewRestrictions: &model.ViewUsersRestrictions{Channels: []string{channel1.Id}},
			Term:             "spe",
			Result:           []string{user2.Id},
		},
		{
			Name:             "All users in team1 with term \"spe\" and all channels restricted",
			Team:             team1.Id,
			ViewRestrictions: &model.ViewUsersRestrictions{Channels: []string{}},
			Term:             "spe",
			Result:           []string{},
		},
		{
			Name:             "All users in team2",
			Team:             team2.Id,
			ViewRestrictions: nil,
			Term:             "",
			Result:           []string{user4.Id, user5.Id},
		},
		{
			Name:             "All users in team2 with term FiV",
			Team:             team2.Id,
			ViewRestrictions: nil,
			Term:             "FiV",
			Result:           []string{user5.Id},
		},
		{
			Name:             "All users in team2 by split part of the username with a dot",
			Team:             team2.Id,
			ViewRestrictions: &model.ViewUsersRestrictions{Channels: []string{channel3.Id}},
			Term:             "split",
			Result:           []string{user5.Id},
		},
		{
			Name:             "All users in team2 by split part of the username with a slash",
			Team:             team2.Id,
			ViewRestrictions: &model.ViewUsersRestrictions{Channels: []string{channel3.Id}},
			Term:             "slash",
			Result:           []string{user4.Id},
		},
		{
			Name:             "All users in team2 by split part of the username with a -slash",
			Team:             team2.Id,
			ViewRestrictions: &model.ViewUsersRestrictions{Channels: []string{channel3.Id}},
			Term:             "-slash",
			Result:           []string{user4.Id},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			options.ViewRestrictions = tc.ViewRestrictions
			res, err := s.User().Search(tc.Team, tc.Term, options)
			require.Nil(t, err)
			require.Len(t, tc.Result, len(res))

			userIds := make([]string, len(res))
			for i, user := range res {
				userIds[i] = user.Id
			}
			assert.ElementsMatch(t, userIds, tc.Result)
		})
	}
}
