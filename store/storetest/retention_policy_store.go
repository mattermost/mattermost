// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"sort"
	"strconv"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/stretchr/testify/require"
)

func TestRetentionPolicyStore(t *testing.T, ss store.Store, s SqlStore) {
	t.Run("Save", func(t *testing.T) { testRetentionPolicyStoreSave(t, ss, s) })
	t.Run("Patch", func(t *testing.T) { testRetentionPolicyStorePatch(t, ss, s) })
	t.Run("Get", func(t *testing.T) { testRetentionPolicyStoreGet(t, ss, s) })
	t.Run("Delete", func(t *testing.T) { testRetentionPolicyStoreDelete(t, ss, s) })
	t.Run("AddChannels", func(t *testing.T) { testRetentionPolicyStoreAddChannels(t, ss, s) })
	t.Run("RemoveChannels", func(t *testing.T) { testRetentionPolicyStoreRemoveChannels(t, ss, s) })
	t.Run("AddTeams", func(t *testing.T) { testRetentionPolicyStoreAddTeams(t, ss, s) })
	t.Run("RemoveTeams", func(t *testing.T) { testRetentionPolicyStoreRemoveTeams(t, ss, s) })
	t.Run("RemoveOrphanedRows", func(t *testing.T) { testRetentionPolicyStoreRemoveOrphanedRows(t, ss, s) })
}

func CheckRetentionPolicyEnrichedAreEqual(t *testing.T, p1, p2 *model.RetentionPolicyWithTeamsAndChannels) {
	require.Equal(t, p1.Id, p2.Id)
	require.Equal(t, p1.DisplayName, p2.DisplayName)
	require.Equal(t, p1.PostDuration, p2.PostDuration)
	require.Equal(t, len(p1.Channels), len(p2.Channels))
	if p1.Channels == nil || p2.Channels == nil {
		require.Equal(t, p1.Channels, p2.Channels)
	} else {
		sort.Slice(p1.Channels, func(i, j int) bool { return p1.Channels[i].Id < p1.Channels[j].Id })
		sort.Slice(p2.Channels, func(i, j int) bool { return p2.Channels[i].Id < p2.Channels[j].Id })
	}
	for i := range p1.Channels {
		require.Equal(t, p1.Channels[i].Id, p2.Channels[i].Id)
		require.Equal(t, p1.Channels[i].DisplayName, p2.Channels[i].DisplayName)
		require.Equal(t, p1.Channels[i].TeamDisplayName, p2.Channels[i].TeamDisplayName)
	}
	if p1.Teams == nil || p2.Teams == nil {
		require.Equal(t, p1.Teams, p2.Teams)
	} else {
		sort.Slice(p1.Teams, func(i, j int) bool { return p1.Teams[i].Id < p1.Teams[j].Id })
		sort.Slice(p2.Teams, func(i, j int) bool { return p2.Teams[i].Id < p2.Teams[j].Id })
	}
	require.Equal(t, len(p1.Teams), len(p2.Teams))
	for i := range p1.Teams {
		require.Equal(t, p1.Teams[i].Id, p2.Teams[i].Id)
		require.Equal(t, p1.Teams[i].DisplayName, p2.Teams[i].DisplayName)
	}
}

func checkRetentionPolicyCountsAreEqual(t *testing.T, p1, p2 *model.RetentionPolicyWithTeamAndChannelCounts) {
	require.Equal(t, p1.Id, p2.Id)
	require.Equal(t, p1.DisplayName, p2.DisplayName)
	require.Equal(t, p1.PostDuration, p2.PostDuration)
	require.Equal(t, p1.TeamCount, p2.TeamCount)
	require.Equal(t, p1.ChannelCount, p2.ChannelCount)
}

func checkRetentionPolicyLikeThisExists(t *testing.T, ss store.Store, policy *model.RetentionPolicyWithTeamsAndChannels) {
	newPolicy, err := ss.RetentionPolicy().Get(policy.Id)
	require.Nil(t, err)
	CheckRetentionPolicyEnrichedAreEqual(t, policy, newPolicy)
}

func createChannelsForRetentionPolicy(t *testing.T, ss store.Store, team model.TeamDisplayInfo,
	numChannels int) []model.ChannelDisplayInfo {
	channels := make([]model.ChannelDisplayInfo, numChannels)
	for i := range channels {
		name := "channel" + model.NewId()
		channel := &model.Channel{
			TeamId:      team.Id,
			DisplayName: "Channel " + name,
			Name:        name,
			Type:        model.CHANNEL_OPEN,
		}
		channel, err := ss.Channel().Save(channel, -1)
		require.Nil(t, err)
		channels[i] = model.ChannelDisplayInfo{
			Id: channel.Id, DisplayName: channel.DisplayName,
			TeamDisplayName: team.DisplayName}
	}
	return channels
}

func createTeamsForRetentionPolicy(t *testing.T, ss store.Store, numTeams int) []model.TeamDisplayInfo {
	teams := make([]model.TeamDisplayInfo, numTeams)
	for i := range teams {
		name := "team" + model.NewId()
		team := &model.Team{
			DisplayName: "Team " + name,
			Name:        name,
			Type:        model.TEAM_OPEN,
		}
		team, err := ss.Team().Save(team)
		require.Nil(t, err)
		teams[i] = model.TeamDisplayInfo{Id: team.Id, DisplayName: team.DisplayName}
	}
	return teams
}

func createTeamsAndChannelsForRetentionPolicy(t *testing.T, ss store.Store) (
	[]model.TeamDisplayInfo, []model.ChannelDisplayInfo,
) {
	teams := createTeamsForRetentionPolicy(t, ss, 2)
	channels1 := createChannelsForRetentionPolicy(t, ss, teams[0], 1)
	channels2 := createChannelsForRetentionPolicy(t, ss, teams[1], 2)
	return teams, append(channels1, channels2...)
}

func cleanupRetentionPolicyTest(s SqlStore) {
	// Manually clear tables until testlib can handle cleanups
	if _, err := s.GetMaster().Exec("DELETE FROM Channels"); err != nil {
		panic(err)
	}
	if _, err := s.GetMaster().Exec("DELETE FROM Teams"); err != nil {
		panic(err)
	}
	if _, err := s.GetMaster().Exec("DELETE FROM RetentionPolicies"); err != nil {
		panic(err)
	}
	if _, err := s.GetMaster().Exec("DELETE FROM RetentionPoliciesChannels"); err != nil {
		panic(err)
	}
	if _, err := s.GetMaster().Exec("DELETE FROM RetentionPoliciesTeams"); err != nil {
		panic(err)
	}
}

func createRetentionPolicyEnriched(displayName string, teams []model.TeamDisplayInfo,
	channels []model.ChannelDisplayInfo) *model.RetentionPolicyWithTeamsAndChannels {
	return &model.RetentionPolicyWithTeamsAndChannels{
		RetentionPolicy: model.RetentionPolicy{
			DisplayName:  displayName,
			PostDuration: 30,
		},
		Teams:    teams,
		Channels: channels,
	}
}

func createRetentionPolicyAppliedFromIds(displayName string, teamIds []string, channelIds []string) *model.RetentionPolicyWithTeamAndChannelIds {
	return &model.RetentionPolicyWithTeamAndChannelIds{
		RetentionPolicy: model.RetentionPolicy{
			DisplayName:  displayName,
			PostDuration: 30,
		},
		TeamIds:    teamIds,
		ChannelIds: channelIds,
	}
}

func createRetentionPolicyAppliedFromDisplayInfo(displayName string, teams []model.TeamDisplayInfo,
	channels []model.ChannelDisplayInfo) *model.RetentionPolicyWithTeamAndChannelIds {
	return retentionPolicyEnrichedToApplied(
		createRetentionPolicyEnriched(displayName, teams, channels))
}

func getChannelIdsFromDisplayInfo(channels []model.ChannelDisplayInfo) []string {
	channelIds := make([]string, len(channels))
	for i, channel := range channels {
		channelIds[i] = channel.Id
	}
	return channelIds
}

func getTeamIdsFromDisplayInfo(teams []model.TeamDisplayInfo) []string {
	teamIds := make([]string, len(teams))
	for i, team := range teams {
		teamIds[i] = team.Id
	}
	return teamIds
}

func retentionPolicyEnrichedToApplied(enriched *model.RetentionPolicyWithTeamsAndChannels) *model.RetentionPolicyWithTeamAndChannelIds {
	return &model.RetentionPolicyWithTeamAndChannelIds{
		RetentionPolicy: enriched.RetentionPolicy,
		TeamIds:         getTeamIdsFromDisplayInfo(enriched.Teams),
		ChannelIds:      getChannelIdsFromDisplayInfo(enriched.Channels),
	}
}

func retentionPolicyEnrichedToCounts(enriched *model.RetentionPolicyWithTeamsAndChannels) *model.RetentionPolicyWithTeamAndChannelCounts {
	return &model.RetentionPolicyWithTeamAndChannelCounts{
		RetentionPolicy: enriched.RetentionPolicy,
		TeamCount:       int64(len(enriched.Teams)),
		ChannelCount:    int64(len(enriched.Channels)),
	}
}

func copyRetentionPolicyEnriched(policy *model.RetentionPolicyWithTeamsAndChannels) *model.RetentionPolicyWithTeamsAndChannels {
	copy := *policy
	copy.Teams = make([]model.TeamDisplayInfo, len(policy.Teams))
	copy.Channels = make([]model.ChannelDisplayInfo, len(policy.Channels))
	for i, team := range policy.Teams {
		copy.Teams[i] = team
	}
	for i, channel := range policy.Channels {
		copy.Channels[i] = channel
	}
	return &copy
}

func restoreRetentionPolicy(t *testing.T, ss store.Store, policy *model.RetentionPolicyWithTeamsAndChannels) {
	patch := retentionPolicyEnrichedToApplied(policy)
	newPolicy, err := ss.RetentionPolicy().Patch(patch)
	require.Nil(t, err)
	CheckRetentionPolicyEnrichedAreEqual(t, policy, newPolicy)
}

func testRetentionPolicyStoreSave(t *testing.T, ss store.Store, s SqlStore) {
	teams, channels := createTeamsAndChannelsForRetentionPolicy(t, ss)
	t.Run("teams and channels are nil", func(t *testing.T) {
		proposal := createRetentionPolicyAppliedFromIds("Proposal 1", nil, nil)
		expected := createRetentionPolicyEnriched(proposal.DisplayName, []model.TeamDisplayInfo{},
			[]model.ChannelDisplayInfo{})
		newPolicy, err := ss.RetentionPolicy().Save(proposal)
		require.Nil(t, err)
		expected.Id = newPolicy.Id
		CheckRetentionPolicyEnrichedAreEqual(t, expected, newPolicy)
	})
	t.Run("teams and channels are empty", func(t *testing.T) {
		proposal := createRetentionPolicyAppliedFromIds("Policy 2", []string{}, []string{})
		expected := createRetentionPolicyEnriched(proposal.DisplayName, []model.TeamDisplayInfo{},
			[]model.ChannelDisplayInfo{})
		newPolicy, err := ss.RetentionPolicy().Save(proposal)
		require.Nil(t, err)
		expected.Id = newPolicy.Id
		CheckRetentionPolicyEnrichedAreEqual(t, expected, newPolicy)
	})
	t.Run("some teams and channels are specified", func(t *testing.T) {
		proposal := createRetentionPolicyAppliedFromDisplayInfo("Policy 3", teams, channels)
		expected := createRetentionPolicyEnriched(proposal.DisplayName, teams, channels)
		newPolicy, err := ss.RetentionPolicy().Save(proposal)
		require.Nil(t, err)
		expected.Id = newPolicy.Id
		CheckRetentionPolicyEnrichedAreEqual(t, expected, newPolicy)
	})
	t.Run("team specified does not exist", func(t *testing.T) {
		policy := createRetentionPolicyAppliedFromIds("Policy 4", []string{"no_such_team"}, []string{})
		_, err := ss.RetentionPolicy().Save(policy)
		require.NotNil(t, err)
	})
	t.Run("channel specified does not exist", func(t *testing.T) {
		policy := createRetentionPolicyAppliedFromIds("Policy 5", []string{}, []string{"no_such_channel"})
		_, err := ss.RetentionPolicy().Save(policy)
		require.NotNil(t, err)
	})
	cleanupRetentionPolicyTest(s)
}

func testRetentionPolicyStorePatch(t *testing.T, ss store.Store, s SqlStore) {
	teams, channels := createTeamsAndChannelsForRetentionPolicy(t, ss)
	proposal := createRetentionPolicyAppliedFromDisplayInfo("Policy 1", teams, channels)
	policy, err := ss.RetentionPolicy().Save(proposal)
	require.Nil(t, err)
	t.Run("modify DisplayName", func(t *testing.T) {
		patch := &model.RetentionPolicyWithTeamAndChannelIds{
			RetentionPolicy: model.RetentionPolicy{
				Id:          policy.Id,
				DisplayName: "something new",
			},
		}
		newPolicy, err := ss.RetentionPolicy().Patch(patch)
		require.Nil(t, err)
		copy := copyRetentionPolicyEnriched(policy)
		copy.DisplayName = patch.DisplayName
		CheckRetentionPolicyEnrichedAreEqual(t, copy, newPolicy)
		restoreRetentionPolicy(t, ss, policy)
	})
	t.Run("modify PostDuration", func(t *testing.T) {
		patch := &model.RetentionPolicyWithTeamAndChannelIds{
			RetentionPolicy: model.RetentionPolicy{
				Id:           policy.Id,
				PostDuration: 10000,
			},
		}
		newPolicy, err := ss.RetentionPolicy().Patch(patch)
		require.Nil(t, err)
		copy := copyRetentionPolicyEnriched(policy)
		copy.PostDuration = patch.PostDuration
		CheckRetentionPolicyEnrichedAreEqual(t, copy, newPolicy)
		restoreRetentionPolicy(t, ss, policy)
	})
	t.Run("clear TeamIds", func(t *testing.T) {
		patch := &model.RetentionPolicyWithTeamAndChannelIds{
			RetentionPolicy: model.RetentionPolicy{
				Id: policy.Id,
			},
			TeamIds: make([]string, 0),
		}
		newPolicy, err := ss.RetentionPolicy().Patch(patch)
		require.Nil(t, err)
		copy := copyRetentionPolicyEnriched(policy)
		copy.Teams = make([]model.TeamDisplayInfo, 0)
		CheckRetentionPolicyEnrichedAreEqual(t, copy, newPolicy)
		restoreRetentionPolicy(t, ss, policy)
	})
	t.Run("add team which does not exist", func(t *testing.T) {
		patch := &model.RetentionPolicyWithTeamAndChannelIds{
			RetentionPolicy: model.RetentionPolicy{
				Id: policy.Id,
			},
			TeamIds: []string{"no_such_team"},
		}
		_, err := ss.RetentionPolicy().Patch(patch)
		require.NotNil(t, err)
	})
	t.Run("clear ChannelIds", func(t *testing.T) {
		patch := &model.RetentionPolicyWithTeamAndChannelIds{
			RetentionPolicy: model.RetentionPolicy{
				Id: policy.Id,
			},
			ChannelIds: make([]string, 0),
		}
		newPolicy, err := ss.RetentionPolicy().Patch(patch)
		require.Nil(t, err)
		copy := copyRetentionPolicyEnriched(policy)
		copy.Channels = make([]model.ChannelDisplayInfo, 0)
		CheckRetentionPolicyEnrichedAreEqual(t, copy, newPolicy)
		restoreRetentionPolicy(t, ss, policy)
	})
	t.Run("add channel which does not exist", func(t *testing.T) {
		patch := &model.RetentionPolicyWithTeamAndChannelIds{
			RetentionPolicy: model.RetentionPolicy{
				Id: policy.Id,
			},
			ChannelIds: []string{"no_such_channel"},
		}
		_, err := ss.RetentionPolicy().Patch(patch)
		require.NotNil(t, err)
	})
	cleanupRetentionPolicyTest(s)
}

func testRetentionPolicyStoreGet(t *testing.T, ss store.Store, s SqlStore) {
	// create multiple policies
	policies := make([]*model.RetentionPolicyWithTeamsAndChannels, 0)
	policyCounts := make([]*model.RetentionPolicyWithTeamAndChannelCounts, 0)
	for i := 0; i < 3; i++ {
		teams, channels := createTeamsAndChannelsForRetentionPolicy(t, ss)
		proposal := createRetentionPolicyAppliedFromDisplayInfo(
			"Policy "+strconv.Itoa(i+1), teams, channels)
		policy, err := ss.RetentionPolicy().Save(proposal)
		require.Nil(t, err)
		policies = append(policies, policy)
		policyCounts = append(policyCounts, retentionPolicyEnrichedToCounts(policy))
	}

	t.Run("get policy by ID", func(t *testing.T) {
		policy := policies[0]
		retrievedPolicy, err := ss.RetentionPolicy().Get(policy.Id)
		require.Nil(t, err)
		CheckRetentionPolicyEnrichedAreEqual(t, policy, retrievedPolicy)
	})
	t.Run("get all", func(t *testing.T) {
		retrievedPolicies, err := ss.RetentionPolicy().GetAll(0, 60)
		require.Nil(t, err)
		require.Equal(t, len(policies), len(retrievedPolicies))
		for i := range policies {
			CheckRetentionPolicyEnrichedAreEqual(t, policies[i], retrievedPolicies[i])
		}
	})
	t.Run("get all with limit", func(t *testing.T) {
		for i := range policies {
			retrievedPolicies, err := ss.RetentionPolicy().GetAll(uint64(i), 1)
			require.Nil(t, err)
			require.Equal(t, 1, len(retrievedPolicies))
			CheckRetentionPolicyEnrichedAreEqual(t, policies[i], retrievedPolicies[0])
		}
	})
	t.Run("get all with counts", func(t *testing.T) {
		retrievedPolicyCounts, err := ss.RetentionPolicy().GetAllWithCounts(0, 60)
		require.Nil(t, err)
		require.Equal(t, len(policyCounts), len(retrievedPolicyCounts))
		for i := range policyCounts {
			checkRetentionPolicyCountsAreEqual(t, policyCounts[i], retrievedPolicyCounts[i])
		}
	})
	t.Run("get all with counts with limit", func(t *testing.T) {
		for i := range policyCounts {
			retrievedPolicyCounts, err := ss.RetentionPolicy().GetAllWithCounts(uint64(i), 1)
			require.Nil(t, err)
			require.Equal(t, 1, len(retrievedPolicyCounts))
			checkRetentionPolicyCountsAreEqual(t, policyCounts[i], retrievedPolicyCounts[0])
		}
	})
	t.Run("get all with same display name", func(t *testing.T) {
		policies := make([]*model.RetentionPolicyWithTeamsAndChannels, 0)
		for i := 0; i < 5; i++ {
			teams, channels := createTeamsAndChannelsForRetentionPolicy(t, ss)
			proposal := createRetentionPolicyAppliedFromDisplayInfo(
				"Policy Name", teams, channels)
			policy, err := ss.RetentionPolicy().Save(proposal)
			require.Nil(t, err)
			policies = append(policies, policy)
		}
		policies, err := ss.RetentionPolicy().GetAll(0, 60)
		require.Nil(t, err)
		for i := 1; i < len(policies); i++ {
			require.True(t,
				policies[i-1].DisplayName < policies[i].DisplayName ||
					(policies[i-1].DisplayName == policies[i].DisplayName &&
						policies[i-1].Id < policies[i].Id),
				"policies with the same display name should be sorted by ID")
		}
	})
	cleanupRetentionPolicyTest(s)
}

func testRetentionPolicyStoreDelete(t *testing.T, ss store.Store, s SqlStore) {
	teams, channels := createTeamsAndChannelsForRetentionPolicy(t, ss)
	proposal := createRetentionPolicyAppliedFromDisplayInfo("Policy 1", teams, channels)
	policy, err := ss.RetentionPolicy().Save(proposal)
	require.Nil(t, err)
	t.Run("delete policy", func(t *testing.T) {
		err := ss.RetentionPolicy().Delete(policy.Id)
		require.Nil(t, err)
		policies, err := ss.RetentionPolicy().GetAll(0, 1)
		require.Nil(t, err)
		require.Empty(t, policies)
	})
	cleanupRetentionPolicyTest(s)
}

func testRetentionPolicyStoreAddChannels(t *testing.T, ss store.Store, s SqlStore) {
	teams, channels := createTeamsAndChannelsForRetentionPolicy(t, ss)
	proposal := createRetentionPolicyAppliedFromDisplayInfo("Policy 1", teams, channels)
	policy, err := ss.RetentionPolicy().Save(proposal)
	require.Nil(t, err)

	t.Run("add empty array", func(t *testing.T) {
		err := ss.RetentionPolicy().AddChannels(policy.Id, []string{})
		require.Nil(t, err)
		checkRetentionPolicyLikeThisExists(t, ss, policy)
	})
	t.Run("add new channels", func(t *testing.T) {
		channels := createChannelsForRetentionPolicy(t, ss, teams[0], 2)
		channelIds := getChannelIdsFromDisplayInfo(channels)
		err := ss.RetentionPolicy().AddChannels(policy.Id, channelIds)
		require.Nil(t, err)
		// verify that the channels were actually added
		copy := copyRetentionPolicyEnriched(policy)
		copy.Channels = append(copy.Channels, channels...)
		checkRetentionPolicyLikeThisExists(t, ss, copy)
		restoreRetentionPolicy(t, ss, policy)
	})
	t.Run("add channel which does not exist", func(t *testing.T) {
		err := ss.RetentionPolicy().AddChannels(policy.Id, []string{"no_such_channel"})
		require.NotNil(t, err)
	})
	t.Run("add channel to policy which does not exist", func(t *testing.T) {
		channels := createChannelsForRetentionPolicy(t, ss, teams[0], 1)
		channelIds := getChannelIdsFromDisplayInfo(channels)
		err := ss.RetentionPolicy().AddChannels("no_such_policy", channelIds)
		require.NotNil(t, err)
	})
	cleanupRetentionPolicyTest(s)
}

func testRetentionPolicyStoreRemoveChannels(t *testing.T, ss store.Store, s SqlStore) {
	teams, channels := createTeamsAndChannelsForRetentionPolicy(t, ss)
	proposal := createRetentionPolicyAppliedFromDisplayInfo("Policy 1", teams, channels)
	policy, err := ss.RetentionPolicy().Save(proposal)
	require.Nil(t, err)
	t.Run("remove empty array", func(t *testing.T) {
		err := ss.RetentionPolicy().RemoveChannels(policy.Id, []string{})
		require.Nil(t, err)
		checkRetentionPolicyLikeThisExists(t, ss, policy)
	})
	t.Run("remove existing channel", func(t *testing.T) {
		channel := channels[0]
		err := ss.RetentionPolicy().RemoveChannels(policy.Id, []string{channel.Id})
		require.Nil(t, err)
		// verify that the channel was actually removed
		copy := copyRetentionPolicyEnriched(policy)
		copy.Channels = make([]model.ChannelDisplayInfo, 0)
		for _, oldChannel := range policy.Channels {
			if oldChannel.Id != channel.Id {
				copy.Channels = append(copy.Channels, oldChannel)
			}
		}
		checkRetentionPolicyLikeThisExists(t, ss, copy)
		restoreRetentionPolicy(t, ss, policy)
	})
	t.Run("remove channel which does not exist", func(t *testing.T) {
		err := ss.RetentionPolicy().RemoveChannels(policy.Id, []string{"no_such_channel"})
		require.Nil(t, err)
		// verify that the policy did not change
		checkRetentionPolicyLikeThisExists(t, ss, policy)
	})
	cleanupRetentionPolicyTest(s)
}

func testRetentionPolicyStoreAddTeams(t *testing.T, ss store.Store, s SqlStore) {
	teams, channels := createTeamsAndChannelsForRetentionPolicy(t, ss)
	proposal := createRetentionPolicyAppliedFromDisplayInfo("Policy 1", teams, channels)
	policy, err := ss.RetentionPolicy().Save(proposal)
	require.Nil(t, err)

	t.Run("add empty array", func(t *testing.T) {
		err := ss.RetentionPolicy().AddTeams(policy.Id, []string{})
		require.Nil(t, err)
		checkRetentionPolicyLikeThisExists(t, ss, policy)
	})
	t.Run("add new teams", func(t *testing.T) {
		teams := createTeamsForRetentionPolicy(t, ss, 2)
		teamIds := getTeamIdsFromDisplayInfo(teams)
		err := ss.RetentionPolicy().AddTeams(policy.Id, teamIds)
		require.Nil(t, err)
		// verify that the teams were actually added
		copy := copyRetentionPolicyEnriched(policy)
		copy.Teams = append(copy.Teams, teams...)
		checkRetentionPolicyLikeThisExists(t, ss, copy)
		restoreRetentionPolicy(t, ss, policy)
	})
	t.Run("add team which does not exist", func(t *testing.T) {
		err := ss.RetentionPolicy().AddTeams(policy.Id, []string{"no_such_team"})
		require.NotNil(t, err)
	})
	t.Run("add team to policy which does not exist", func(t *testing.T) {
		team := createTeamsForRetentionPolicy(t, ss, 1)[0]
		teamIds := []string{team.Id}
		err := ss.RetentionPolicy().AddTeams("no_such_policy", teamIds)
		require.NotNil(t, err)
	})
	cleanupRetentionPolicyTest(s)
}

func testRetentionPolicyStoreRemoveTeams(t *testing.T, ss store.Store, s SqlStore) {
	teams, channels := createTeamsAndChannelsForRetentionPolicy(t, ss)
	proposal := createRetentionPolicyAppliedFromDisplayInfo("Policy 1", teams, channels)
	policy, err := ss.RetentionPolicy().Save(proposal)
	require.Nil(t, err)

	t.Run("remove empty array", func(t *testing.T) {
		err := ss.RetentionPolicy().RemoveTeams(policy.Id, []string{})
		require.Nil(t, err)
		checkRetentionPolicyLikeThisExists(t, ss, policy)
	})
	t.Run("remove existing team", func(t *testing.T) {
		team := teams[0]
		err := ss.RetentionPolicy().RemoveTeams(policy.Id, []string{team.Id})
		require.Nil(t, err)
		// verify that the team was actually removed
		copy := copyRetentionPolicyEnriched(policy)
		copy.Teams = make([]model.TeamDisplayInfo, 0)
		for _, oldTeam := range policy.Teams {
			if oldTeam.Id != team.Id {
				copy.Teams = append(copy.Teams, oldTeam)
			}
		}
		checkRetentionPolicyLikeThisExists(t, ss, copy)
		restoreRetentionPolicy(t, ss, policy)
	})
	t.Run("remove team which does not exist", func(t *testing.T) {
		err := ss.RetentionPolicy().RemoveTeams(policy.Id, []string{"no_such_team"})
		require.Nil(t, err)
		// verify that the policy did not change
		checkRetentionPolicyLikeThisExists(t, ss, policy)
	})
	cleanupRetentionPolicyTest(s)
}

func testRetentionPolicyStoreRemoveOrphanedRows(t *testing.T, ss store.Store, s SqlStore) {
	team := createTeamsForRetentionPolicy(t, ss, 1)[0]
	channel := createChannelsForRetentionPolicy(t, ss, team, 1)[0]
	proposal := createRetentionPolicyAppliedFromDisplayInfo("Policy 1",
		[]model.TeamDisplayInfo{team}, []model.ChannelDisplayInfo{channel})
	policy, err := ss.RetentionPolicy().Save(proposal)
	require.Nil(t, err)

	err = ss.Channel().PermanentDelete(channel.Id)
	require.Nil(t, err)
	err = ss.Team().PermanentDelete(team.Id)
	require.Nil(t, err)
	_, err = ss.RetentionPolicy().RemoveOrphanedRows(1000)
	require.Nil(t, err)

	policy, err = ss.RetentionPolicy().Get(policy.Id)
	require.Nil(t, err)
	require.Len(t, policy.Teams, 0)
	require.Len(t, policy.Channels, 0)
}
