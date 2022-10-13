// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package suite

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
)

func TestRestrictedViewMembers(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	user1 := th.CreateUser()
	user1.Nickname = "test user1"
	user1.Username = "test-user-1"
	th.Suite.UpdateUser(th.Context, user1, false)
	user2 := th.CreateUser()
	user2.Username = "test-user-2"
	user2.Nickname = "test user2"
	th.Suite.UpdateUser(th.Context, user2, false)
	user3 := th.CreateUser()
	user3.Username = "test-user-3"
	user3.Nickname = "test user3"
	th.Suite.UpdateUser(th.Context, user3, false)
	user4 := th.CreateUser()
	user4.Username = "test-user-4"
	user4.Nickname = "test user4"
	th.Suite.UpdateUser(th.Context, user4, false)
	user5 := th.CreateUser()
	user5.Username = "test-user-5"
	user5.Nickname = "test user5"
	th.Suite.UpdateUser(th.Context, user5, false)

	// user1 is member of all the channels and teams because is the creator
	th.BasicUser = user1

	team1 := th.CreateTeam()
	team2 := th.CreateTeam()

	channel1 := th.CreateChannel(th.Context, team1)
	channel2 := th.CreateChannel(th.Context, team1)
	channel3 := th.CreateChannel(th.Context, team2)

	th.LinkUserToTeam(user1, team1)
	th.LinkUserToTeam(user2, team1)
	th.LinkUserToTeam(user3, team2)
	th.LinkUserToTeam(user4, team1)
	th.LinkUserToTeam(user4, team2)

	th.AddUserToChannel(user1, channel1)
	th.AddUserToChannel(user2, channel2)
	th.AddUserToChannel(user3, channel3)
	th.AddUserToChannel(user4, channel1)
	th.AddUserToChannel(user4, channel3)

	th.Suite.SetStatusOnline(user1.Id, true)
	th.Suite.SetStatusOnline(user2.Id, true)
	th.Suite.SetStatusOnline(user3.Id, true)
	th.Suite.SetStatusOnline(user4.Id, true)
	th.Suite.SetStatusOnline(user5.Id, true)

	t.Run("SearchUsers", func(t *testing.T) {
		testCases := []struct {
			Name            string
			Restrictions    *model.ViewUsersRestrictions
			Search          model.UserSearch
			ExpectedResults []string
		}{
			{
				"without restrictions team1",
				nil,
				model.UserSearch{Term: "test", TeamId: team1.Id},
				[]string{user1.Id, user2.Id, user4.Id},
			},
			{
				"without restrictions team2",
				nil,
				model.UserSearch{Term: "test", TeamId: team2.Id},
				[]string{user3.Id, user4.Id},
			},
			{
				"with team restrictions with valid team",
				&model.ViewUsersRestrictions{
					Teams: []string{team1.Id},
				},
				model.UserSearch{Term: "test", TeamId: team1.Id},
				[]string{user1.Id, user2.Id, user4.Id},
			},
			{
				"with team restrictions with invalid team",
				&model.ViewUsersRestrictions{
					Teams: []string{team1.Id},
				},
				model.UserSearch{Term: "test", TeamId: team2.Id},
				[]string{user4.Id},
			},
			{
				"with channel restrictions with valid team",
				&model.ViewUsersRestrictions{
					Channels: []string{channel1.Id},
				},
				model.UserSearch{Term: "test", TeamId: team1.Id},
				[]string{user1.Id, user4.Id},
			},
			{
				"with channel restrictions with invalid team",
				&model.ViewUsersRestrictions{
					Channels: []string{channel1.Id},
				},
				model.UserSearch{Term: "test", TeamId: team2.Id},
				[]string{user4.Id},
			},
			{
				"with restricting everything",
				&model.ViewUsersRestrictions{
					Channels: []string{},
					Teams:    []string{},
				},
				model.UserSearch{Term: "test", TeamId: team1.Id},
				[]string{},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				options := model.UserSearchOptions{Limit: 100, ViewRestrictions: tc.Restrictions}
				results, err := th.Suite.SearchUsers(&tc.Search, &options)
				require.Nil(t, err)
				ids := []string{}
				for _, result := range results {
					ids = append(ids, result.Id)
				}
				assert.ElementsMatch(t, tc.ExpectedResults, ids)
			})
		}
	})

	t.Run("SearchUsersInTeam", func(t *testing.T) {
		testCases := []struct {
			Name            string
			Restrictions    *model.ViewUsersRestrictions
			TeamId          string
			ExpectedResults []string
		}{
			{
				"without restrictions team1",
				nil,
				team1.Id,
				[]string{user1.Id, user2.Id, user4.Id},
			},
			{
				"without restrictions team2",
				nil,
				team2.Id,
				[]string{user3.Id, user4.Id},
			},
			{
				"with team restrictions with valid team",
				&model.ViewUsersRestrictions{
					Teams: []string{team1.Id},
				},
				team1.Id,
				[]string{user1.Id, user2.Id, user4.Id},
			},
			{
				"with team restrictions with invalid team",
				&model.ViewUsersRestrictions{
					Teams: []string{team1.Id},
				},
				team2.Id,
				[]string{user4.Id},
			},
			{
				"with channel restrictions with valid team",
				&model.ViewUsersRestrictions{
					Channels: []string{channel1.Id},
				},
				team1.Id,
				[]string{user1.Id, user4.Id},
			},
			{
				"with channel restrictions with invalid team",
				&model.ViewUsersRestrictions{
					Channels: []string{channel1.Id},
				},
				team2.Id,
				[]string{user4.Id},
			},
			{
				"with restricting everything",
				&model.ViewUsersRestrictions{
					Channels: []string{},
					Teams:    []string{},
				},
				team1.Id,
				[]string{},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				options := model.UserSearchOptions{Limit: 100, ViewRestrictions: tc.Restrictions}
				results, err := th.Suite.SearchUsersInTeam(tc.TeamId, "test", &options)
				require.Nil(t, err)
				ids := []string{}
				for _, result := range results {
					ids = append(ids, result.Id)
				}
				assert.ElementsMatch(t, tc.ExpectedResults, ids)
			})
		}
	})

	t.Run("AutocompleteUsersInTeam", func(t *testing.T) {
		testCases := []struct {
			Name            string
			Restrictions    *model.ViewUsersRestrictions
			TeamId          string
			ExpectedResults []string
		}{
			{
				"without restrictions team1",
				nil,
				team1.Id,
				[]string{user1.Id, user2.Id, user4.Id},
			},
			{
				"without restrictions team2",
				nil,
				team2.Id,
				[]string{user3.Id, user4.Id},
			},
			{
				"with team restrictions with valid team",
				&model.ViewUsersRestrictions{
					Teams: []string{team1.Id},
				},
				team1.Id,
				[]string{user1.Id, user2.Id, user4.Id},
			},
			{
				"with team restrictions with invalid team",
				&model.ViewUsersRestrictions{
					Teams: []string{team1.Id},
				},
				team2.Id,
				[]string{user4.Id},
			},
			{
				"with channel restrictions with valid team",
				&model.ViewUsersRestrictions{
					Channels: []string{channel1.Id},
				},
				team1.Id,
				[]string{user1.Id, user4.Id},
			},
			{
				"with channel restrictions with invalid team",
				&model.ViewUsersRestrictions{
					Channels: []string{channel1.Id},
				},
				team2.Id,
				[]string{user4.Id},
			},
			{
				"with restricting everything",
				&model.ViewUsersRestrictions{
					Channels: []string{},
					Teams:    []string{},
				},
				team1.Id,
				[]string{},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				options := model.UserSearchOptions{Limit: 100, ViewRestrictions: tc.Restrictions}
				results, err := th.Suite.AutocompleteUsersInTeam(tc.TeamId, "tes", &options)
				require.Nil(t, err)
				ids := []string{}
				for _, result := range results.InTeam {
					ids = append(ids, result.Id)
				}
				assert.ElementsMatch(t, tc.ExpectedResults, ids)
			})
		}
	})

	t.Run("AutocompleteUsersInChannel", func(t *testing.T) {
		testCases := []struct {
			Name            string
			Restrictions    *model.ViewUsersRestrictions
			TeamId          string
			ChannelId       string
			ExpectedResults []string
		}{
			{
				"without restrictions channel1",
				nil,
				team1.Id,
				channel1.Id,
				[]string{user1.Id, user4.Id},
			},
			{
				"without restrictions channel3",
				nil,
				team2.Id,
				channel3.Id,
				[]string{user1.Id, user3.Id, user4.Id},
			},
			{
				"with team restrictions with valid team",
				&model.ViewUsersRestrictions{
					Teams: []string{team1.Id},
				},
				team1.Id,
				channel1.Id,
				[]string{user1.Id, user4.Id},
			},
			{
				"with team restrictions with invalid team",
				&model.ViewUsersRestrictions{
					Teams: []string{team1.Id},
				},
				team2.Id,
				channel3.Id,
				[]string{user1.Id, user4.Id},
			},
			{
				"with channel restrictions with valid team",
				&model.ViewUsersRestrictions{
					Channels: []string{channel1.Id},
				},
				team1.Id,
				channel1.Id,
				[]string{user1.Id, user4.Id},
			},
			{
				"with channel restrictions with invalid team",
				&model.ViewUsersRestrictions{
					Channels: []string{channel1.Id},
				},
				team2.Id,
				channel3.Id,
				[]string{user1.Id, user4.Id},
			},
			{
				"with restricting everything",
				&model.ViewUsersRestrictions{
					Channels: []string{},
					Teams:    []string{},
				},
				team1.Id,
				channel1.Id,
				[]string{},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				options := model.UserSearchOptions{Limit: 100, ViewRestrictions: tc.Restrictions}
				results, err := th.Suite.AutocompleteUsersInChannel(tc.TeamId, tc.ChannelId, "tes", &options)
				require.Nil(t, err)
				ids := []string{}
				for _, result := range results.InChannel {
					ids = append(ids, result.Id)
				}
				assert.ElementsMatch(t, tc.ExpectedResults, ids)
			})
		}
	})

	t.Run("GetNewUsersForTeam", func(t *testing.T) {
		testCases := []struct {
			Name            string
			Restrictions    *model.ViewUsersRestrictions
			TeamId          string
			ExpectedResults []string
		}{
			{
				"without restrictions team1",
				nil,
				team1.Id,
				[]string{user2.Id, user4.Id},
			},
			{
				"without restrictions team2",
				nil,
				team2.Id,
				[]string{user3.Id, user4.Id},
			},
			{
				"with team restrictions with valid team",
				&model.ViewUsersRestrictions{
					Teams: []string{team1.Id},
				},
				team1.Id,
				[]string{user2.Id, user4.Id},
			},
			{
				"with team restrictions with invalid team",
				&model.ViewUsersRestrictions{
					Teams: []string{team1.Id},
				},
				team2.Id,
				[]string{user4.Id},
			},
			{
				"with channel restrictions with valid team",
				&model.ViewUsersRestrictions{
					Channels: []string{channel1.Id},
				},
				team1.Id,
				[]string{user1.Id, user4.Id},
			},
			{
				"with channel restrictions with invalid team",
				&model.ViewUsersRestrictions{
					Channels: []string{channel1.Id},
				},
				team2.Id,
				[]string{user4.Id},
			},
			{
				"with restricting everything",
				&model.ViewUsersRestrictions{
					Channels: []string{},
					Teams:    []string{},
				},
				team1.Id,
				[]string{},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				results, err := th.Suite.GetNewUsersForTeamPage(tc.TeamId, 0, 2, false, tc.Restrictions)
				require.Nil(t, err)
				ids := []string{}
				for _, result := range results {
					ids = append(ids, result.Id)
				}
				assert.ElementsMatch(t, tc.ExpectedResults, ids)
			})
		}
	})

	t.Run("GetRecentlyActiveUsersForTeamPage", func(t *testing.T) {
		testCases := []struct {
			Name            string
			Restrictions    *model.ViewUsersRestrictions
			TeamId          string
			ExpectedResults []string
		}{
			{
				"without restrictions team1",
				nil,
				team1.Id,
				[]string{user1.Id, user2.Id, user4.Id},
			},
			{
				"without restrictions team2",
				nil,
				team2.Id,
				[]string{user3.Id, user4.Id},
			},
			{
				"with team restrictions with valid team",
				&model.ViewUsersRestrictions{
					Teams: []string{team1.Id},
				},
				team1.Id,
				[]string{user1.Id, user2.Id, user4.Id},
			},
			{
				"with team restrictions with invalid team",
				&model.ViewUsersRestrictions{
					Teams: []string{team1.Id},
				},
				team2.Id,
				[]string{user4.Id},
			},
			{
				"with channel restrictions with valid team",
				&model.ViewUsersRestrictions{
					Channels: []string{channel1.Id},
				},
				team1.Id,
				[]string{user1.Id, user4.Id},
			},
			{
				"with channel restrictions with invalid team",
				&model.ViewUsersRestrictions{
					Channels: []string{channel1.Id},
				},
				team2.Id,
				[]string{user4.Id},
			},
			{
				"with restricting everything",
				&model.ViewUsersRestrictions{
					Channels: []string{},
					Teams:    []string{},
				},
				team1.Id,
				[]string{},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				results, err := th.Suite.GetRecentlyActiveUsersForTeamPage(tc.TeamId, 0, 3, false, tc.Restrictions)
				require.Nil(t, err)
				ids := []string{}
				for _, result := range results {
					ids = append(ids, result.Id)
				}
				assert.ElementsMatch(t, tc.ExpectedResults, ids)

				results, err = th.Suite.GetRecentlyActiveUsersForTeamPage(tc.TeamId, 0, 1, false, tc.Restrictions)
				require.Nil(t, err)
				if len(tc.ExpectedResults) > 1 {
					assert.Len(t, results, 1)
				} else {
					assert.Len(t, results, len(tc.ExpectedResults))
				}
			})
		}
	})

	t.Run("GetUsers", func(t *testing.T) {
		testCases := []struct {
			Name            string
			Restrictions    *model.ViewUsersRestrictions
			ExpectedResults []string
		}{
			{
				"without restrictions",
				nil,
				[]string{user1.Id, user2.Id, user3.Id, user4.Id, user5.Id},
			},
			{
				"with team restrictions",
				&model.ViewUsersRestrictions{
					Teams: []string{team1.Id},
				},
				[]string{user1.Id, user2.Id, user4.Id},
			},
			{
				"with channel restrictions",
				&model.ViewUsersRestrictions{
					Channels: []string{channel1.Id},
				},
				[]string{user1.Id, user4.Id},
			},
			{
				"with restricting everything",
				&model.ViewUsersRestrictions{
					Channels: []string{},
					Teams:    []string{},
				},
				[]string{},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				options := model.UserGetOptions{Page: 0, PerPage: 100, ViewRestrictions: tc.Restrictions}
				results, err := th.Suite.GetUsersFromProfiles(&options)
				require.Nil(t, err)
				ids := []string{}
				for _, result := range results {
					ids = append(ids, result.Id)
				}
				assert.ElementsMatch(t, tc.ExpectedResults, ids)
			})
		}
	})

	t.Run("GetUsersWithoutTeam", func(t *testing.T) {
		testCases := []struct {
			Name            string
			Restrictions    *model.ViewUsersRestrictions
			ExpectedResults []string
		}{
			{
				"without restrictions",
				nil,
				[]string{user5.Id},
			},
			{
				"with team restrictions",
				&model.ViewUsersRestrictions{
					Teams: []string{team1.Id},
				},
				[]string{},
			},
			{
				"with channel restrictions",
				&model.ViewUsersRestrictions{
					Channels: []string{channel1.Id},
				},
				[]string{},
			},
			{
				"with restricting everything",
				&model.ViewUsersRestrictions{
					Channels: []string{},
					Teams:    []string{},
				},
				[]string{},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				results, err := th.Suite.GetUsersWithoutTeam(&model.UserGetOptions{Page: 0, PerPage: 100, ViewRestrictions: tc.Restrictions})
				require.Nil(t, err)
				ids := []string{}
				for _, result := range results {
					ids = append(ids, result.Id)
				}
				assert.ElementsMatch(t, tc.ExpectedResults, ids)
			})
		}
	})

	t.Run("GetUsersNotInTeam", func(t *testing.T) {
		testCases := []struct {
			Name            string
			Restrictions    *model.ViewUsersRestrictions
			TeamId          string
			ExpectedResults []string
		}{
			{
				"without restrictions team1",
				nil,
				team1.Id,
				[]string{user3.Id, user5.Id},
			},
			{
				"without restrictions team2",
				nil,
				team2.Id,
				[]string{user1.Id, user2.Id, user5.Id},
			},
			{
				"with team restrictions with valid team",
				&model.ViewUsersRestrictions{
					Teams: []string{team1.Id},
				},
				team2.Id,
				[]string{user1.Id, user2.Id},
			},
			{
				"with team restrictions with invalid team",
				&model.ViewUsersRestrictions{
					Teams: []string{team1.Id},
				},
				team1.Id,
				[]string{},
			},
			{
				"with channel restrictions with valid team",
				&model.ViewUsersRestrictions{
					Channels: []string{channel1.Id},
				},
				team2.Id,
				[]string{user1.Id},
			},
			{
				"with channel restrictions with invalid team",
				&model.ViewUsersRestrictions{
					Channels: []string{channel1.Id},
				},
				team1.Id,
				[]string{},
			},
			{
				"with restricting everything",
				&model.ViewUsersRestrictions{
					Channels: []string{},
					Teams:    []string{},
				},
				team2.Id,
				[]string{},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				results, err := th.Suite.GetUsersNotInTeam(tc.TeamId, false, 0, 100, tc.Restrictions)
				require.Nil(t, err)
				ids := []string{}
				for _, result := range results {
					ids = append(ids, result.Id)
				}
				assert.ElementsMatch(t, tc.ExpectedResults, ids)
			})
		}
	})

	t.Run("GetUsersNotInChannel", func(t *testing.T) {
		testCases := []struct {
			Name            string
			Restrictions    *model.ViewUsersRestrictions
			TeamId          string
			ChannelId       string
			ExpectedResults []string
		}{
			{
				"without restrictions channel1",
				nil,
				team1.Id,
				channel1.Id,
				[]string{user2.Id},
			},
			{
				"without restrictions channel2",
				nil,
				team1.Id,
				channel2.Id,
				[]string{user4.Id},
			},
			{
				"with team restrictions with valid team",
				&model.ViewUsersRestrictions{
					Teams: []string{team1.Id},
				},
				team1.Id,
				channel1.Id,
				[]string{user2.Id},
			},
			{
				"with team restrictions with invalid team",
				&model.ViewUsersRestrictions{
					Teams: []string{team2.Id},
				},
				team1.Id,
				channel1.Id,
				[]string{},
			},
			{
				"with channel restrictions with valid team",
				&model.ViewUsersRestrictions{
					Channels: []string{channel2.Id},
				},
				team1.Id,
				channel1.Id,
				[]string{user2.Id},
			},
			{
				"with channel restrictions with invalid team",
				&model.ViewUsersRestrictions{
					Channels: []string{channel2.Id},
				},
				team1.Id,
				channel2.Id,
				[]string{},
			},
			{
				"with restricting everything",
				&model.ViewUsersRestrictions{
					Channels: []string{},
					Teams:    []string{},
				},
				team1.Id,
				channel1.Id,
				[]string{},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				results, err := th.Suite.GetUsersNotInChannel(tc.TeamId, tc.ChannelId, false, 0, 100, tc.Restrictions)
				require.Nil(t, err)
				ids := []string{}
				for _, result := range results {
					ids = append(ids, result.Id)
				}
				assert.ElementsMatch(t, tc.ExpectedResults, ids)
			})
		}
	})

	t.Run("GetUsersByIds", func(t *testing.T) {
		testCases := []struct {
			Name            string
			Restrictions    *model.ViewUsersRestrictions
			UserIds         []string
			ExpectedResults []string
		}{
			{
				"without restrictions",
				nil,
				[]string{user1.Id, user2.Id, user3.Id},
				[]string{user1.Id, user2.Id, user3.Id},
			},
			{
				"with team restrictions",
				&model.ViewUsersRestrictions{
					Teams: []string{team1.Id},
				},
				[]string{user1.Id, user2.Id, user3.Id},
				[]string{user1.Id, user2.Id},
			},
			{
				"with channel restrictions",
				&model.ViewUsersRestrictions{
					Channels: []string{channel1.Id},
				},
				[]string{user1.Id, user2.Id, user3.Id},
				[]string{user1.Id},
			},
			{
				"with restricting everything",
				&model.ViewUsersRestrictions{
					Channels: []string{},
					Teams:    []string{},
				},
				[]string{user1.Id, user2.Id, user3.Id},
				[]string{},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				results, err := th.Suite.GetUsersByIds(tc.UserIds, &store.UserGetByIdsOpts{
					IsAdmin:          false,
					ViewRestrictions: tc.Restrictions,
				})
				require.Nil(t, err)
				ids := []string{}
				for _, result := range results {
					ids = append(ids, result.Id)
				}
				assert.ElementsMatch(t, tc.ExpectedResults, ids)
			})
		}
	})

	t.Run("GetUsersByUsernames", func(t *testing.T) {
		testCases := []struct {
			Name            string
			Restrictions    *model.ViewUsersRestrictions
			Usernames       []string
			ExpectedResults []string
		}{
			{
				"without restrictions",
				nil,
				[]string{user1.Username, user2.Username, user3.Username},
				[]string{user1.Id, user2.Id, user3.Id},
			},
			{
				"with team restrictions",
				&model.ViewUsersRestrictions{
					Teams: []string{team1.Id},
				},
				[]string{user1.Username, user2.Username, user3.Username},
				[]string{user1.Id, user2.Id},
			},
			{
				"with channel restrictions",
				&model.ViewUsersRestrictions{
					Channels: []string{channel1.Id},
				},
				[]string{user1.Username, user2.Username, user3.Username},
				[]string{user1.Id},
			},
			{
				"with restricting everything",
				&model.ViewUsersRestrictions{
					Channels: []string{},
					Teams:    []string{},
				},
				[]string{user1.Username, user2.Username, user3.Username},
				[]string{},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				results, err := th.Suite.GetUsersByUsernames(tc.Usernames, false, tc.Restrictions)
				require.Nil(t, err)
				ids := []string{}
				for _, result := range results {
					ids = append(ids, result.Id)
				}
				assert.ElementsMatch(t, tc.ExpectedResults, ids)
			})
		}
	})

	t.Run("GetTotalUsersStats", func(t *testing.T) {
		testCases := []struct {
			Name           string
			Restrictions   *model.ViewUsersRestrictions
			ExpectedResult int64
		}{
			{
				"without restrictions",
				nil,
				5,
			},
			{
				"with team restrictions",
				&model.ViewUsersRestrictions{
					Teams: []string{team1.Id},
				},
				3,
			},
			{
				"with channel restrictions",
				&model.ViewUsersRestrictions{
					Channels: []string{channel1.Id},
				},
				2,
			},
			{
				"with restricting everything",
				&model.ViewUsersRestrictions{
					Channels: []string{},
					Teams:    []string{},
				},
				0,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				result, err := th.Suite.GetTotalUsersStats(tc.Restrictions)
				require.Nil(t, err)
				assert.Equal(t, tc.ExpectedResult, result.TotalUsersCount)
			})
		}
	})

	t.Run("GetTeamMembers", func(t *testing.T) {
		testCases := []struct {
			Name            string
			Restrictions    *model.ViewUsersRestrictions
			TeamId          string
			ExpectedResults []string
		}{
			{
				"without restrictions team1",
				nil,
				team1.Id,
				[]string{user1.Id, user2.Id, user4.Id},
			},
			{
				"without restrictions team2",
				nil,
				team2.Id,
				[]string{user3.Id, user4.Id},
			},
			{
				"with team restrictions with valid team",
				&model.ViewUsersRestrictions{
					Teams: []string{team1.Id},
				},
				team1.Id,
				[]string{user1.Id, user2.Id, user4.Id},
			},
			{
				"with team restrictions with invalid team",
				&model.ViewUsersRestrictions{
					Teams: []string{team1.Id},
				},
				team2.Id,
				[]string{user4.Id},
			},
			{
				"with channel restrictions with valid team",
				&model.ViewUsersRestrictions{
					Channels: []string{channel1.Id},
				},
				team1.Id,
				[]string{user1.Id, user4.Id},
			},
			{
				"with channel restrictions with invalid team",
				&model.ViewUsersRestrictions{
					Channels: []string{channel1.Id},
				},
				team2.Id,
				[]string{user4.Id},
			},
			{
				"with restricting everything",
				&model.ViewUsersRestrictions{
					Channels: []string{},
					Teams:    []string{},
				},
				team1.Id,
				[]string{},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				getTeamMemberOptions := &model.TeamMembersGetOptions{
					ViewRestrictions: tc.Restrictions,
				}
				results, err := th.Suite.GetTeamMembers(tc.TeamId, 0, 100, getTeamMemberOptions)
				require.Nil(t, err)
				ids := []string{}
				for _, result := range results {
					ids = append(ids, result.UserId)
				}
				assert.ElementsMatch(t, tc.ExpectedResults, ids)
			})
		}
	})

	t.Run("GetTeamMembersByIds", func(t *testing.T) {
		testCases := []struct {
			Name            string
			Restrictions    *model.ViewUsersRestrictions
			TeamId          string
			UserIds         []string
			ExpectedResults []string
		}{
			{
				"without restrictions team1",
				nil,
				team1.Id,
				[]string{user1.Id, user2.Id, user3.Id},
				[]string{user1.Id, user2.Id},
			},
			{
				"without restrictions team2",
				nil,
				team2.Id,
				[]string{user1.Id, user2.Id, user3.Id},
				[]string{user3.Id},
			},
			{
				"with team restrictions with valid team",
				&model.ViewUsersRestrictions{
					Teams: []string{team1.Id},
				},
				team1.Id,
				[]string{user1.Id, user2.Id, user3.Id},
				[]string{user1.Id, user2.Id},
			},
			{
				"with team restrictions with invalid team",
				&model.ViewUsersRestrictions{
					Teams: []string{team1.Id},
				},
				team2.Id,
				[]string{user2.Id, user4.Id},
				[]string{user4.Id},
			},
			{
				"with channel restrictions with valid team",
				&model.ViewUsersRestrictions{
					Channels: []string{channel1.Id},
				},
				team1.Id,
				[]string{user2.Id, user4.Id},
				[]string{user4.Id},
			},
			{
				"with channel restrictions with invalid team",
				&model.ViewUsersRestrictions{
					Channels: []string{channel1.Id},
				},
				team2.Id,
				[]string{user2.Id, user4.Id},
				[]string{user4.Id},
			},
			{
				"with restricting everything",
				&model.ViewUsersRestrictions{
					Channels: []string{},
					Teams:    []string{},
				},
				team1.Id,
				[]string{user1.Id, user2.Id, user2.Id, user4.Id},
				[]string{},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				results, err := th.Suite.GetTeamMembersByIds(tc.TeamId, tc.UserIds, tc.Restrictions)
				require.Nil(t, err)
				ids := []string{}
				for _, result := range results {
					ids = append(ids, result.UserId)
				}
				assert.ElementsMatch(t, tc.ExpectedResults, ids)
			})
		}
	})
}
