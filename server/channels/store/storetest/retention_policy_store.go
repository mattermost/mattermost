// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"sort"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestRetentionPolicyStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("Save", func(t *testing.T) { testRetentionPolicyStoreSave(t, rctx, ss, s) })
	t.Run("Patch", func(t *testing.T) { testRetentionPolicyStorePatch(t, rctx, ss, s) })
	t.Run("Get", func(t *testing.T) { testRetentionPolicyStoreGet(t, rctx, ss, s) })
	t.Run("GetCount", func(t *testing.T) { testRetentionPolicyStoreGetCount(t, rctx, ss, s) })
	t.Run("Delete", func(t *testing.T) { testRetentionPolicyStoreDelete(t, rctx, ss, s) })
	t.Run("GetChannels", func(t *testing.T) { testRetentionPolicyStoreGetChannels(t, rctx, ss, s) })
	t.Run("AddChannels", func(t *testing.T) { testRetentionPolicyStoreAddChannels(t, rctx, ss, s) })
	t.Run("RemoveChannels", func(t *testing.T) { testRetentionPolicyStoreRemoveChannels(t, rctx, ss, s) })
	t.Run("GetTeams", func(t *testing.T) { testRetentionPolicyStoreGetTeams(t, rctx, ss, s) })
	t.Run("AddTeams", func(t *testing.T) { testRetentionPolicyStoreAddTeams(t, rctx, ss, s) })
	t.Run("RemoveTeams", func(t *testing.T) { testRetentionPolicyStoreRemoveTeams(t, rctx, ss, s) })
	t.Run("RemoveOrphanedRows", func(t *testing.T) { testRetentionPolicyStoreRemoveOrphanedRows(t, rctx, ss, s) })
	t.Run("GetPoliciesForUser", func(t *testing.T) { testRetentionPolicyStoreGetPoliciesForUser(t, rctx, ss, s) })
}

func getRetentionPolicyWithTeamAndChannelIds(t *testing.T, ss store.Store, policyID string) *model.RetentionPolicyWithTeamAndChannelIDs {
	policyWithCounts, err := ss.RetentionPolicy().Get(policyID)
	require.NoError(t, err)
	policyWithIds := model.RetentionPolicyWithTeamAndChannelIDs{
		RetentionPolicy: model.RetentionPolicy{
			ID:               policyID,
			DisplayName:      policyWithCounts.DisplayName,
			PostDurationDays: policyWithCounts.PostDurationDays,
		},
		ChannelIDs: make([]string, int(policyWithCounts.ChannelCount)),
		TeamIDs:    make([]string, int(policyWithCounts.TeamCount)),
	}
	channels, err := ss.RetentionPolicy().GetChannels(policyID, 0, 1000)
	require.NoError(t, err)
	for i, channel := range channels {
		policyWithIds.ChannelIDs[i] = channel.Id
	}
	teams, err := ss.RetentionPolicy().GetTeams(policyID, 0, 1000)
	require.NoError(t, err)
	for i, team := range teams {
		policyWithIds.TeamIDs[i] = team.Id
	}
	return &policyWithIds
}

func CheckRetentionPolicyWithTeamAndChannelIdsAreEqual(t *testing.T, p1, p2 *model.RetentionPolicyWithTeamAndChannelIDs) {
	require.Equal(t, p1.ID, p2.ID)
	require.Equal(t, p1.DisplayName, p2.DisplayName)
	require.Equal(t, p1.PostDurationDays, p2.PostDurationDays)
	require.Equal(t, len(p1.ChannelIDs), len(p2.ChannelIDs))
	if p1.ChannelIDs == nil || p2.ChannelIDs == nil {
		require.Equal(t, p1.ChannelIDs, p2.ChannelIDs)
	} else {
		sort.Strings(p1.ChannelIDs)
		sort.Strings(p2.ChannelIDs)
	}
	for i := range p1.ChannelIDs {
		require.Equal(t, p1.ChannelIDs[i], p2.ChannelIDs[i])
	}
	if p1.TeamIDs == nil || p2.TeamIDs == nil {
		require.Equal(t, p1.TeamIDs, p2.TeamIDs)
	} else {
		sort.Strings(p1.TeamIDs)
		sort.Strings(p2.TeamIDs)
	}
	require.Equal(t, len(p1.TeamIDs), len(p2.TeamIDs))
	for i := range p1.TeamIDs {
		require.Equal(t, p1.TeamIDs[i], p2.TeamIDs[i])
	}
}

func CheckRetentionPolicyWithTeamAndChannelCountsAreEqual(t *testing.T, p1, p2 *model.RetentionPolicyWithTeamAndChannelCounts) {
	require.Equal(t, p1.ID, p2.ID)
	require.Equal(t, p1.DisplayName, p2.DisplayName)
	require.Equal(t, p1.PostDurationDays, p2.PostDurationDays)
	require.Equal(t, p1.ChannelCount, p2.ChannelCount)
	require.Equal(t, p1.TeamCount, p2.TeamCount)
}

func checkRetentionPolicyLikeThisExists(t *testing.T, ss store.Store, expected *model.RetentionPolicyWithTeamAndChannelIDs) {
	retrieved := getRetentionPolicyWithTeamAndChannelIds(t, ss, expected.ID)
	CheckRetentionPolicyWithTeamAndChannelIdsAreEqual(t, expected, retrieved)
}

func copyRetentionPolicyWithTeamAndChannelIds(policy *model.RetentionPolicyWithTeamAndChannelIDs) *model.RetentionPolicyWithTeamAndChannelIDs {
	cpy := &model.RetentionPolicyWithTeamAndChannelIDs{
		RetentionPolicy: policy.RetentionPolicy,
		ChannelIDs:      make([]string, len(policy.ChannelIDs)),
		TeamIDs:         make([]string, len(policy.TeamIDs)),
	}
	copy(cpy.ChannelIDs, policy.ChannelIDs)
	copy(cpy.TeamIDs, policy.TeamIDs)
	return cpy
}

func createChannelsForRetentionPolicy(rctx request.CTX, t *testing.T, ss store.Store, teamId string, numChannels int) (channelIDs []string) {
	channelIDs = make([]string, numChannels)
	for i := range channelIDs {
		name := "channel" + model.NewId()
		channel := &model.Channel{
			TeamId:      teamId,
			DisplayName: "Channel " + name,
			Name:        name,
			Type:        model.ChannelTypeOpen,
		}
		channel, err := ss.Channel().Save(rctx, channel, -1)
		require.NoError(t, err)
		channelIDs[i] = channel.Id
	}
	return
}

func createTeamsForRetentionPolicy(t *testing.T, ss store.Store, numTeams int) (teamIDs []string) {
	teamIDs = make([]string, numTeams)
	for i := range teamIDs {
		name := "team" + model.NewId()
		team := &model.Team{
			DisplayName: "Team " + name,
			Name:        name,
			Type:        model.TeamOpen,
		}
		team, err := ss.Team().Save(team)
		require.NoError(t, err)
		teamIDs[i] = team.Id
	}
	return
}

func createTeamsAndChannelsForRetentionPolicy(t *testing.T, rctx request.CTX, ss store.Store) (teamIDs, channelIDs []string) {
	teamIDs = createTeamsForRetentionPolicy(t, ss, 2)
	channels1 := createChannelsForRetentionPolicy(rctx, t, ss, teamIDs[0], 1)
	channels2 := createChannelsForRetentionPolicy(rctx, t, ss, teamIDs[1], 2)
	channelIDs = append(channels1, channels2...)
	return
}

func cleanupRetentionPolicyTest(s SqlStore) {
	// Manually clear tables until testlib can handle cleanups
	tables := []string{"RetentionPolicies", "RetentionPoliciesChannels", "RetentionPoliciesTeams"}
	for _, table := range tables {
		if _, err := s.GetMaster().Exec("DELETE FROM " + table); err != nil {
			panic(err)
		}
	}
}

func deleteTeamsAndChannels(rctx request.CTX, ss store.Store, teamIDs, channelIDs []string) {
	for _, teamID := range teamIDs {
		if err := ss.Team().PermanentDelete(teamID); err != nil {
			panic(err)
		}
	}
	for _, channelID := range channelIDs {
		if err := ss.Channel().PermanentDelete(rctx, channelID); err != nil {
			panic(err)
		}
	}
}

func createRetentionPolicyWithTeamAndChannelIds(displayName string, teamIDs, channelIDs []string) *model.RetentionPolicyWithTeamAndChannelIDs {
	return &model.RetentionPolicyWithTeamAndChannelIDs{
		RetentionPolicy: model.RetentionPolicy{
			DisplayName:      displayName,
			PostDurationDays: model.NewPointer(int64(30)),
		},
		TeamIDs:    teamIDs,
		ChannelIDs: channelIDs,
	}
}

// saveRetentionPolicyWithTeamAndChannelIds creates a model.RetentionPolicyWithTeamAndChannelIds struct using
// the display name, team IDs, and channel IDs. The new policy ID will be assigned to the struct and returned.
// The team IDs and channel IDs are kept the same.
func saveRetentionPolicyWithTeamAndChannelIds(t *testing.T, ss store.Store, displayName string, teamIDs, channelIDs []string) *model.RetentionPolicyWithTeamAndChannelIDs {
	proposal := createRetentionPolicyWithTeamAndChannelIds(displayName, teamIDs, channelIDs)
	policyWithCounts, err := ss.RetentionPolicy().Save(proposal)
	require.NoError(t, err)
	proposal.ID = policyWithCounts.ID
	return proposal
}

func restoreRetentionPolicy(t *testing.T, ss store.Store, policy *model.RetentionPolicyWithTeamAndChannelIDs) {
	_, err := ss.RetentionPolicy().Patch(policy)
	require.NoError(t, err)
	checkRetentionPolicyLikeThisExists(t, ss, policy)
}

func testRetentionPolicyStoreSave(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	defer cleanupRetentionPolicyTest(s)

	t.Run("teams and channels are nil", func(t *testing.T) {
		policy := saveRetentionPolicyWithTeamAndChannelIds(t, ss, "Policy 1", nil, nil)
		policy.ChannelIDs = []string{}
		policy.TeamIDs = []string{}
		checkRetentionPolicyLikeThisExists(t, ss, policy)
	})
	t.Run("teams and channels are empty", func(t *testing.T) {
		policy := saveRetentionPolicyWithTeamAndChannelIds(t, ss, "Policy 2", []string{}, []string{})
		checkRetentionPolicyLikeThisExists(t, ss, policy)
	})
	t.Run("some teams and channels are specified", func(t *testing.T) {
		teamIDs, channelIDs := createTeamsAndChannelsForRetentionPolicy(t, rctx, ss)
		defer deleteTeamsAndChannels(rctx, ss, teamIDs, channelIDs)
		policy := saveRetentionPolicyWithTeamAndChannelIds(t, ss, "Policy 3", teamIDs, channelIDs)
		checkRetentionPolicyLikeThisExists(t, ss, policy)
	})
	t.Run("team specified does not exist", func(t *testing.T) {
		policy := createRetentionPolicyWithTeamAndChannelIds("Policy 4", []string{"no_such_team"}, []string{})
		_, err := ss.RetentionPolicy().Save(policy)
		require.Error(t, err)
	})
	t.Run("channel specified does not exist", func(t *testing.T) {
		policy := createRetentionPolicyWithTeamAndChannelIds("Policy 5", []string{}, []string{"no_such_channel"})
		_, err := ss.RetentionPolicy().Save(policy)
		require.Error(t, err)
	})
}

func testRetentionPolicyStorePatch(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamIDs, channelIDs := createTeamsAndChannelsForRetentionPolicy(t, rctx, ss)
	policy := saveRetentionPolicyWithTeamAndChannelIds(t, ss, "Policy 1", teamIDs, channelIDs)

	defer deleteTeamsAndChannels(rctx, ss, teamIDs, channelIDs)
	defer cleanupRetentionPolicyTest(s)

	t.Run("modify DisplayName", func(t *testing.T) {
		patch := &model.RetentionPolicyWithTeamAndChannelIDs{
			RetentionPolicy: model.RetentionPolicy{
				ID:          policy.ID,
				DisplayName: "something new",
			},
		}
		_, err := ss.RetentionPolicy().Patch(patch)
		require.NoError(t, err)
		expected := copyRetentionPolicyWithTeamAndChannelIds(policy)
		expected.DisplayName = patch.DisplayName
		checkRetentionPolicyLikeThisExists(t, ss, expected)
		restoreRetentionPolicy(t, ss, policy)
	})
	t.Run("modify PostDuration", func(t *testing.T) {
		patch := &model.RetentionPolicyWithTeamAndChannelIDs{
			RetentionPolicy: model.RetentionPolicy{
				ID:               policy.ID,
				PostDurationDays: model.NewPointer(int64(10000)),
			},
		}
		_, err := ss.RetentionPolicy().Patch(patch)
		require.NoError(t, err)
		expected := copyRetentionPolicyWithTeamAndChannelIds(policy)
		expected.PostDurationDays = patch.PostDurationDays
		checkRetentionPolicyLikeThisExists(t, ss, expected)

		// Store a negative value (= infinity)
		patch.PostDurationDays = model.NewPointer(int64(-1))
		_, err = ss.RetentionPolicy().Patch(patch)
		require.NoError(t, err)
		expected = copyRetentionPolicyWithTeamAndChannelIds(policy)
		expected.PostDurationDays = patch.PostDurationDays
		checkRetentionPolicyLikeThisExists(t, ss, expected)

		restoreRetentionPolicy(t, ss, policy)
	})
	t.Run("clear TeamIds", func(t *testing.T) {
		patch := &model.RetentionPolicyWithTeamAndChannelIDs{
			RetentionPolicy: model.RetentionPolicy{
				ID: policy.ID,
			},
			TeamIDs: make([]string, 0),
		}
		_, err := ss.RetentionPolicy().Patch(patch)
		require.NoError(t, err)
		expected := copyRetentionPolicyWithTeamAndChannelIds(policy)
		expected.TeamIDs = make([]string, 0)
		checkRetentionPolicyLikeThisExists(t, ss, expected)
		restoreRetentionPolicy(t, ss, policy)
	})
	t.Run("add team which does not exist", func(t *testing.T) {
		patch := &model.RetentionPolicyWithTeamAndChannelIDs{
			RetentionPolicy: model.RetentionPolicy{
				ID: policy.ID,
			},
			TeamIDs: []string{"no_such_team"},
		}
		_, err := ss.RetentionPolicy().Patch(patch)
		require.Error(t, err)
	})
	t.Run("clear ChannelIds", func(t *testing.T) {
		patch := &model.RetentionPolicyWithTeamAndChannelIDs{
			RetentionPolicy: model.RetentionPolicy{
				ID: policy.ID,
			},
			ChannelIDs: make([]string, 0),
		}
		_, err := ss.RetentionPolicy().Patch(patch)
		require.NoError(t, err)
		expected := copyRetentionPolicyWithTeamAndChannelIds(policy)
		expected.ChannelIDs = make([]string, 0)
		checkRetentionPolicyLikeThisExists(t, ss, expected)
		restoreRetentionPolicy(t, ss, policy)
	})
	t.Run("add channel which does not exist", func(t *testing.T) {
		patch := &model.RetentionPolicyWithTeamAndChannelIDs{
			RetentionPolicy: model.RetentionPolicy{
				ID: policy.ID,
			},
			ChannelIDs: []string{"no_such_channel"},
		}
		_, err := ss.RetentionPolicy().Patch(patch)
		require.Error(t, err)
	})
}

func testRetentionPolicyStoreGet(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("get none", func(t *testing.T) {
		retrievedPolicies, err := ss.RetentionPolicy().GetAll(0, 10)
		require.NoError(t, err)
		require.NotNil(t, retrievedPolicies)
		require.Equal(t, 0, len(retrievedPolicies))
	})

	// create multiple policies
	policiesWithCounts := make([]*model.RetentionPolicyWithTeamAndChannelCounts, 0)
	for i := 0; i < 3; i++ {
		teamIDs, channelIDs := createTeamsAndChannelsForRetentionPolicy(t, rctx, ss)
		defer deleteTeamsAndChannels(rctx, ss, teamIDs, channelIDs)
		policyWithIds := createRetentionPolicyWithTeamAndChannelIds(
			"Policy "+strconv.Itoa(i+1), teamIDs, channelIDs)
		policyWithCounts, err := ss.RetentionPolicy().Save(policyWithIds)
		require.NoError(t, err)
		policiesWithCounts = append(policiesWithCounts, policyWithCounts)
	}
	defer cleanupRetentionPolicyTest(s)

	t.Run("get all", func(t *testing.T) {
		retrievedPolicies, err := ss.RetentionPolicy().GetAll(0, 60)
		require.NoError(t, err)
		require.Equal(t, len(policiesWithCounts), len(retrievedPolicies))
		for i := range policiesWithCounts {
			CheckRetentionPolicyWithTeamAndChannelCountsAreEqual(t, policiesWithCounts[i], retrievedPolicies[i])
		}
	})
	t.Run("get all with limit", func(t *testing.T) {
		for i := range policiesWithCounts {
			retrievedPolicies, err := ss.RetentionPolicy().GetAll(i, 1)
			require.NoError(t, err)
			require.Equal(t, 1, len(retrievedPolicies))
			CheckRetentionPolicyWithTeamAndChannelCountsAreEqual(t, policiesWithCounts[i], retrievedPolicies[0])
		}
	})
	t.Run("get all with same display name", func(t *testing.T) {
		for i := 0; i < 5; i++ {
			teamIDs, channelIDs := createTeamsAndChannelsForRetentionPolicy(t, rctx, ss)
			defer deleteTeamsAndChannels(rctx, ss, teamIDs, channelIDs)
			proposal := createRetentionPolicyWithTeamAndChannelIds(
				"Policy Name", teamIDs, channelIDs)
			_, err := ss.RetentionPolicy().Save(proposal)
			require.NoError(t, err)
		}
		policies, err := ss.RetentionPolicy().GetAll(0, 60)
		require.NoError(t, err)
		for i := 1; i < len(policies); i++ {
			require.True(t,
				policies[i-1].DisplayName < policies[i].DisplayName ||
					(policies[i-1].DisplayName == policies[i].DisplayName &&
						policies[i-1].ID < policies[i].ID),
				"policies with the same display name should be sorted by ID")
		}
	})
}

func testRetentionPolicyStoreGetCount(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	defer cleanupRetentionPolicyTest(s)

	t.Run("no policies", func(t *testing.T) {
		count, err := ss.RetentionPolicy().GetCount()
		require.NoError(t, err)
		require.Equal(t, int64(0), count)
	})
	t.Run("some policies", func(t *testing.T) {
		for i := 0; i < 2; i++ {
			saveRetentionPolicyWithTeamAndChannelIds(t, ss, "Policy "+strconv.Itoa(i), nil, nil)
		}
		count, err := ss.RetentionPolicy().GetCount()
		require.NoError(t, err)
		require.Equal(t, int64(2), count)
	})
}

func testRetentionPolicyStoreDelete(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamIDs, channelIDs := createTeamsAndChannelsForRetentionPolicy(t, rctx, ss)
	policy := saveRetentionPolicyWithTeamAndChannelIds(t, ss, "Policy 1", teamIDs, channelIDs)

	defer deleteTeamsAndChannels(rctx, ss, teamIDs, channelIDs)
	defer cleanupRetentionPolicyTest(s)

	t.Run("delete policy", func(t *testing.T) {
		err := ss.RetentionPolicy().Delete(policy.ID)
		require.NoError(t, err)
		policies, err := ss.RetentionPolicy().GetAll(0, 1)
		require.NoError(t, err)
		require.Empty(t, policies)
	})
}

func testRetentionPolicyStoreGetChannels(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	defer cleanupRetentionPolicyTest(s)

	t.Run("no channels", func(t *testing.T) {
		policy := saveRetentionPolicyWithTeamAndChannelIds(t, ss, "Policy 1", nil, nil)
		channels, err := ss.RetentionPolicy().GetChannels(policy.ID, 0, 1)
		require.NoError(t, err)
		require.Len(t, channels, 0)
	})
	t.Run("some channels", func(t *testing.T) {
		teamIDs, channelIDs := createTeamsAndChannelsForRetentionPolicy(t, rctx, ss)
		defer deleteTeamsAndChannels(rctx, ss, teamIDs, channelIDs)
		policy := saveRetentionPolicyWithTeamAndChannelIds(t, ss, "Policy 2", teamIDs, channelIDs)
		channels, err := ss.RetentionPolicy().GetChannels(policy.ID, 0, len(channelIDs))
		require.NoError(t, err)
		require.Len(t, channels, len(channelIDs))
		sort.Strings(channelIDs)
		sort.Slice(channels, func(i, j int) bool {
			return channels[i].Id < channels[j].Id
		})
		for i := range channelIDs {
			require.Equal(t, channelIDs[i], channels[i].Id)
		}
	})
}

func testRetentionPolicyStoreAddChannels(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamIDs, channelIDs := createTeamsAndChannelsForRetentionPolicy(t, rctx, ss)
	policy := saveRetentionPolicyWithTeamAndChannelIds(t, ss, "Policy 1", teamIDs, channelIDs)

	defer deleteTeamsAndChannels(rctx, ss, teamIDs, channelIDs)
	defer cleanupRetentionPolicyTest(s)

	t.Run("add empty array", func(t *testing.T) {
		err := ss.RetentionPolicy().AddChannels(policy.ID, []string{})
		require.NoError(t, err)
		checkRetentionPolicyLikeThisExists(t, ss, policy)
	})
	t.Run("add new channels", func(t *testing.T) {
		channelIDs := createChannelsForRetentionPolicy(rctx, t, ss, teamIDs[0], 2)
		defer deleteTeamsAndChannels(rctx, ss, nil, channelIDs)
		err := ss.RetentionPolicy().AddChannels(policy.ID, channelIDs)
		require.NoError(t, err)
		// verify that the channels were actually added
		copy := copyRetentionPolicyWithTeamAndChannelIds(policy) //nolint:revive
		copy.ChannelIDs = append(copy.ChannelIDs, channelIDs...)
		checkRetentionPolicyLikeThisExists(t, ss, copy)
		restoreRetentionPolicy(t, ss, policy)
	})
	t.Run("add channel which does not exist", func(t *testing.T) {
		err := ss.RetentionPolicy().AddChannels(policy.ID, []string{"no_such_channel"})
		require.Error(t, err)
	})
	t.Run("add channel to policy which does not exist", func(t *testing.T) {
		channelIDs := createChannelsForRetentionPolicy(rctx, t, ss, teamIDs[0], 1)
		defer deleteTeamsAndChannels(rctx, ss, nil, channelIDs)
		err := ss.RetentionPolicy().AddChannels("no_such_policy", channelIDs)
		require.Error(t, err)
	})
}

func testRetentionPolicyStoreRemoveChannels(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamIDs, channelIDs := createTeamsAndChannelsForRetentionPolicy(t, rctx, ss)
	policy := saveRetentionPolicyWithTeamAndChannelIds(t, ss, "Policy 1", teamIDs, channelIDs)

	defer deleteTeamsAndChannels(rctx, ss, teamIDs, channelIDs)
	defer cleanupRetentionPolicyTest(s)

	t.Run("remove empty array", func(t *testing.T) {
		err := ss.RetentionPolicy().RemoveChannels(policy.ID, []string{})
		require.NoError(t, err)
		checkRetentionPolicyLikeThisExists(t, ss, policy)
	})
	t.Run("remove existing channel", func(t *testing.T) {
		channelID := channelIDs[0]
		err := ss.RetentionPolicy().RemoveChannels(policy.ID, []string{channelID})
		require.NoError(t, err)
		// verify that the channel was actually removed
		copy := copyRetentionPolicyWithTeamAndChannelIds(policy) //nolint:revive
		copy.ChannelIDs = make([]string, 0)
		for _, oldChannelID := range policy.ChannelIDs {
			if oldChannelID != channelID {
				copy.ChannelIDs = append(copy.ChannelIDs, oldChannelID)
			}
		}
		checkRetentionPolicyLikeThisExists(t, ss, copy)
		restoreRetentionPolicy(t, ss, policy)
	})
	t.Run("remove channel which does not exist", func(t *testing.T) {
		err := ss.RetentionPolicy().RemoveChannels(policy.ID, []string{"no_such_channel"})
		require.NoError(t, err)
		// verify that the policy did not change
		checkRetentionPolicyLikeThisExists(t, ss, policy)
	})
}

func testRetentionPolicyStoreGetTeams(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	defer cleanupRetentionPolicyTest(s)

	t.Run("no teams", func(t *testing.T) {
		policy := saveRetentionPolicyWithTeamAndChannelIds(t, ss, "Policy 1", nil, nil)
		teams, err := ss.RetentionPolicy().GetTeams(policy.ID, 0, 1)
		require.NoError(t, err)
		require.Len(t, teams, 0)
	})
	t.Run("some teams", func(t *testing.T) {
		teamIDs, channelIDs := createTeamsAndChannelsForRetentionPolicy(t, rctx, ss)
		defer deleteTeamsAndChannels(rctx, ss, teamIDs, channelIDs)
		policy := saveRetentionPolicyWithTeamAndChannelIds(t, ss, "Policy 2", teamIDs, channelIDs)
		teams, err := ss.RetentionPolicy().GetTeams(policy.ID, 0, len(teamIDs))
		require.NoError(t, err)
		require.Len(t, teams, len(teamIDs))
		sort.Strings(teamIDs)
		sort.Slice(teams, func(i, j int) bool {
			return teams[i].Id < teams[j].Id
		})
		for i := range teamIDs {
			require.Equal(t, teamIDs[i], teams[i].Id)
		}
	})
}

func testRetentionPolicyStoreAddTeams(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamIDs, channelIDs := createTeamsAndChannelsForRetentionPolicy(t, rctx, ss)
	policy := saveRetentionPolicyWithTeamAndChannelIds(t, ss, "Policy 1", teamIDs, channelIDs)

	defer deleteTeamsAndChannels(rctx, ss, teamIDs, channelIDs)
	defer cleanupRetentionPolicyTest(s)

	t.Run("add empty array", func(t *testing.T) {
		err := ss.RetentionPolicy().AddTeams(policy.ID, []string{})
		require.NoError(t, err)
		checkRetentionPolicyLikeThisExists(t, ss, policy)
	})
	t.Run("add new teams", func(t *testing.T) {
		teamIDs := createTeamsForRetentionPolicy(t, ss, 2)
		defer deleteTeamsAndChannels(rctx, ss, teamIDs, nil)
		err := ss.RetentionPolicy().AddTeams(policy.ID, teamIDs)
		require.NoError(t, err)
		// verify that the teams were actually added
		copy := copyRetentionPolicyWithTeamAndChannelIds(policy) //nolint:revive
		copy.TeamIDs = append(copy.TeamIDs, teamIDs...)
		checkRetentionPolicyLikeThisExists(t, ss, copy)
		restoreRetentionPolicy(t, ss, policy)
	})
	t.Run("add team which does not exist", func(t *testing.T) {
		err := ss.RetentionPolicy().AddTeams(policy.ID, []string{"no_such_team"})
		require.Error(t, err)
	})
	t.Run("add team to policy which does not exist", func(t *testing.T) {
		teamIDs := createTeamsForRetentionPolicy(t, ss, 1)
		defer deleteTeamsAndChannels(rctx, ss, teamIDs, nil)
		err := ss.RetentionPolicy().AddTeams("no_such_policy", teamIDs)
		require.Error(t, err)
	})
}

func testRetentionPolicyStoreRemoveTeams(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamIDs, channelIDs := createTeamsAndChannelsForRetentionPolicy(t, rctx, ss)
	policy := saveRetentionPolicyWithTeamAndChannelIds(t, ss, "Policy 1", teamIDs, channelIDs)

	defer deleteTeamsAndChannels(rctx, ss, teamIDs, channelIDs)
	defer cleanupRetentionPolicyTest(s)

	t.Run("remove empty array", func(t *testing.T) {
		err := ss.RetentionPolicy().RemoveTeams(policy.ID, []string{})
		require.NoError(t, err)
		checkRetentionPolicyLikeThisExists(t, ss, policy)
	})
	t.Run("remove existing team", func(t *testing.T) {
		teamID := teamIDs[0]
		err := ss.RetentionPolicy().RemoveTeams(policy.ID, []string{teamID})
		require.NoError(t, err)
		// verify that the team was actually removed
		copy := copyRetentionPolicyWithTeamAndChannelIds(policy) //nolint:revive
		copy.TeamIDs = make([]string, 0)
		for _, oldTeamID := range policy.TeamIDs {
			if oldTeamID != teamID {
				copy.TeamIDs = append(copy.TeamIDs, oldTeamID)
			}
		}
		checkRetentionPolicyLikeThisExists(t, ss, copy)
		restoreRetentionPolicy(t, ss, policy)
	})
	t.Run("remove team which does not exist", func(t *testing.T) {
		err := ss.RetentionPolicy().RemoveTeams(policy.ID, []string{"no_such_team"})
		require.NoError(t, err)
		// verify that the policy did not change
		checkRetentionPolicyLikeThisExists(t, ss, policy)
	})
}

func testRetentionPolicyStoreGetPoliciesForUser(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamIDs, channelIDs := createTeamsAndChannelsForRetentionPolicy(t, rctx, ss)
	saveRetentionPolicyWithTeamAndChannelIds(t, ss, "Policy 1", teamIDs, channelIDs)

	defer deleteTeamsAndChannels(rctx, ss, teamIDs, channelIDs)
	defer cleanupRetentionPolicyTest(s)

	user, userSaveErr := ss.User().Save(rctx, &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	})
	require.NoError(t, userSaveErr)

	t.Run("user has no relevant policies", func(t *testing.T) {
		// Teams
		teamPolicies, err := ss.RetentionPolicy().GetTeamPoliciesForUser(user.Id, 0, 100)
		require.NoError(t, err)
		require.Empty(t, teamPolicies)
		count, err := ss.RetentionPolicy().GetTeamPoliciesCountForUser(user.Id)
		require.NoError(t, err)
		require.Equal(t, int64(0), count)
		// Channels
		channelPolicies, err := ss.RetentionPolicy().GetChannelPoliciesForUser(user.Id, 0, 100)
		require.NoError(t, err)
		require.Empty(t, channelPolicies)
		count, err = ss.RetentionPolicy().GetChannelPoliciesCountForUser(user.Id)
		require.NoError(t, err)
		require.Equal(t, int64(0), count)
	})

	t.Run("user has relevant policies", func(t *testing.T) {
		for _, teamID := range teamIDs {
			_, err := ss.Team().SaveMember(rctx, &model.TeamMember{TeamId: teamID, UserId: user.Id}, -1)
			require.NoError(t, err)
		}
		for _, channelID := range channelIDs {
			_, err := ss.Channel().SaveMember(rctx, &model.ChannelMember{ChannelId: channelID, UserId: user.Id, NotifyProps: model.GetDefaultChannelNotifyProps()})
			require.NoError(t, err)
		}
		// Teams
		teamPolicies, err := ss.RetentionPolicy().GetTeamPoliciesForUser(user.Id, 0, 100)
		require.NoError(t, err)
		require.Len(t, teamPolicies, len(teamIDs))
		count, err := ss.RetentionPolicy().GetTeamPoliciesCountForUser(user.Id)
		require.NoError(t, err)
		require.Equal(t, int64(len(teamIDs)), count)
		// Channels
		channelPolicies, err := ss.RetentionPolicy().GetChannelPoliciesForUser(user.Id, 0, 100)
		require.NoError(t, err)
		require.Len(t, channelPolicies, len(channelIDs))
		count, err = ss.RetentionPolicy().GetChannelPoliciesCountForUser(user.Id)
		require.NoError(t, err)
		require.Equal(t, int64(len(channelIDs)), count)
	})
}

func testRetentionPolicyStoreRemoveOrphanedRows(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	teamID := createTeamsForRetentionPolicy(t, ss, 1)[0]
	channelID := createChannelsForRetentionPolicy(rctx, t, ss, teamID, 1)[0]
	policy := saveRetentionPolicyWithTeamAndChannelIds(t, ss, "Policy 1",
		[]string{teamID}, []string{channelID})

	err := ss.Channel().PermanentDelete(rctx, channelID)
	require.NoError(t, err)
	err = ss.Team().PermanentDelete(teamID)
	require.NoError(t, err)
	_, err = ss.RetentionPolicy().DeleteOrphanedRows(1000)
	require.NoError(t, err)

	policy.ChannelIDs = make([]string, 0)
	policy.TeamIDs = make([]string, 0)
	checkRetentionPolicyLikeThisExists(t, ss, policy)
}
