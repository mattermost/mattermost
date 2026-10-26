// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"slices"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// testChannelStoreGetChannelIDsInSessionScope checks that the SQL scope query
// agrees with model.SessionScopeAllowsChannel for every kind of team the
// open-team grant has to tell apart.
func testChannelStoreGetChannelIDsInSessionScope(t *testing.T, rctx request.CTX, ss store.Store) {
	savePolicy := func(t *testing.T, id, policyType string) {
		version := model.AccessControlPolicyVersionV0_2
		if policyType == model.AccessControlPolicyTypeTeam {
			version = model.AccessControlPolicyVersionV0_3
		}
		_, err := ss.AccessControlPolicy().Save(rctx, &model.AccessControlPolicy{
			ID:      id,
			Type:    policyType,
			Version: version,
			Rules: []model.AccessControlPolicyRule{{
				Actions:    []string{model.AccessControlPolicyActionMembership},
				Expression: `user.properties.program == "engineering"`,
			}},
		})
		require.NoError(t, err)
		t.Cleanup(func() { _ = ss.AccessControlPolicy().Delete(rctx, id) })
	}

	saveTeam := func(t *testing.T, mutate func(*model.Team)) *model.Team {
		team := &model.Team{
			DisplayName:     "Scope",
			Name:            NewTestID(),
			Email:           MakeEmail(),
			Type:            model.TeamOpen,
			AllowOpenInvite: true,
		}
		if mutate != nil {
			mutate(team)
		}
		team, err := ss.Team().Save(team)
		require.NoError(t, err)
		t.Cleanup(func() { _ = ss.Team().PermanentDelete(team.Id) })
		return team
	}

	saveChannel := func(t *testing.T, teamID string, channelType model.ChannelType) *model.Channel {
		channel, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "Scope " + NewTestID(),
			Name:        NewTestID(),
			Type:        channelType,
		}, -1)
		require.NoError(t, err)
		t.Cleanup(func() { _ = ss.Channel().PermanentDelete(rctx, channel.Id) })
		return channel
	}

	open := saveTeam(t, nil)
	teams := []*model.Team{
		open,
		saveTeam(t, func(team *model.Team) { team.AllowOpenInvite = false; team.Type = model.TeamInvite }),
		saveTeam(t, func(team *model.Team) { team.GroupConstrained = model.NewPointer(true) }),
		saveTeam(t, func(team *model.Team) { team.AllowedDomains = "example.com" }),
	}
	deleted := saveTeam(t, nil)
	deleted.DeleteAt = model.GetMillis()
	_, err := ss.Team().Update(deleted)
	require.NoError(t, err)
	policyTeam := saveTeam(t, nil)
	savePolicy(t, policyTeam.Id, model.AccessControlPolicyTypeTeam)
	teams = append(teams, deleted, policyTeam)

	var channelIDs []string
	for _, team := range teams {
		channelIDs = append(channelIDs, saveChannel(t, team.Id, model.ChannelTypeOpen).Id, saveChannel(t, team.Id, model.ChannelTypePrivate).Id)
	}
	archived := saveChannel(t, open.Id, model.ChannelTypeOpen)
	err = ss.Channel().Delete(archived.Id, model.GetMillis())
	require.NoError(t, err)
	policyChannel := saveChannel(t, open.Id, model.ChannelTypeOpen)
	savePolicy(t, policyChannel.Id, model.AccessControlPolicyTypeChannel)
	channelIDs = append(channelIDs, archived.Id, policyChannel.Id)

	for name, resources := range map[string]model.SessionScopeResources{
		"open-team grant":      {OpenTeamPublicChannels: true},
		"every channel listed": {ChannelIDs: channelIDs},
		"listed and open-team": {ChannelIDs: channelIDs[:3], OpenTeamPublicChannels: true},
		"empty scope":          {},
	} {
		t.Run(name, func(t *testing.T) {
			scope := &model.SessionScope{Resources: resources}
			var want, wantOnOpen, wantPublic []string
			for _, id := range channelIDs {
				channel, err := ss.Channel().Get(id, false)
				require.NoError(t, err)
				team, err := ss.Team().Get(channel.TeamId)
				require.NoError(t, err)
				if model.SessionScopeAllowsChannel(scope, channel, team, false) {
					want = append(want, id)
					if channel.TeamId == open.Id {
						wantOnOpen = append(wantOnOpen, id)
					}
					if channel.Type == model.ChannelTypeOpen {
						wantPublic = append(wantPublic, id)
					}
				}
			}

			onlyOurs := func(ids []string) []string {
				return slices.DeleteFunc(ids, func(id string) bool { return !slices.Contains(channelIDs, id) })
			}

			got, err := ss.Channel().GetChannelIDsInSessionScope("", &resources, false)
			require.NoError(t, err)
			assert.ElementsMatch(t, want, onlyOurs(got))

			got, err = ss.Channel().GetChannelIDsInSessionScope(open.Id, &resources, false)
			require.NoError(t, err)
			assert.ElementsMatch(t, wantOnOpen, got, "limited to the team")

			got, err = ss.Channel().GetChannelIDsInSessionScope("", &resources, true)
			require.NoError(t, err)
			assert.ElementsMatch(t, wantPublic, onlyOurs(got), "public channels only")
		})
	}
}
