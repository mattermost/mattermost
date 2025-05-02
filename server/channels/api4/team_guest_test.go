// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestGetTeamAsGuest(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })

	guest, guestClient := th.CreateGuestAndClient(t)

	publicTeamNotAMember := &model.Team{
		DisplayName:     "Public Team (guest is not a member)",
		Name:            GenerateTestTeamName(),
		Email:           th.GenerateTestEmail(),
		Type:            model.TeamOpen,
		AllowOpenInvite: true,
	}
	publicTeamNotAMember, _, err := th.SystemAdminClient.CreateTeam(context.Background(), publicTeamNotAMember)
	require.NoError(t, err)

	publicTeamIsAMember := &model.Team{
		DisplayName:     "Public Team (guest is a member)",
		Name:            GenerateTestTeamName(),
		Email:           th.GenerateTestEmail(),
		Type:            model.TeamOpen,
		AllowOpenInvite: true,
	}
	publicTeamIsAMember, _, err = th.SystemAdminClient.CreateTeam(context.Background(), publicTeamIsAMember)
	require.NoError(t, err)

	_, _, err = th.SystemAdminClient.AddTeamMember(context.Background(), publicTeamIsAMember.Id, guest.Id)
	require.NoError(t, err)

	privateTeamNotAMember := &model.Team{
		DisplayName:     "Private Team (guest is not a member)",
		Name:            GenerateTestTeamName(),
		Email:           th.GenerateTestEmail(),
		Type:            model.TeamInvite,
		AllowOpenInvite: false,
	}
	privateTeamNotAMember, _, err = th.SystemAdminClient.CreateTeam(context.Background(), privateTeamNotAMember)
	require.NoError(t, err)

	privateTeamIsAMember := &model.Team{
		DisplayName:     "Private Team (guest is not a member)",
		Name:            GenerateTestTeamName(),
		Email:           th.GenerateTestEmail(),
		Type:            model.TeamInvite,
		AllowOpenInvite: false,
	}
	privateTeamIsAMember, _, err = th.SystemAdminClient.CreateTeam(context.Background(), privateTeamIsAMember)
	require.NoError(t, err)

	_, _, err = th.SystemAdminClient.AddTeamMember(context.Background(), privateTeamIsAMember.Id, guest.Id)
	require.NoError(t, err)

	t.Run("guest cannot view public team they are not a member of", func(t *testing.T) {
		team, resp, err := guestClient.GetTeam(context.Background(), publicTeamNotAMember.Id, "")
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
		assert.Nil(t, team)
	})

	t.Run("guest can view public team they are a member of", func(t *testing.T) {
		team, resp, err := guestClient.GetTeam(context.Background(), publicTeamIsAMember.Id, "")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Equal(t, publicTeamIsAMember.Id, team.Id)
	})

	t.Run("guest can not view private team they are not a member of", func(t *testing.T) {
		team, resp, err := guestClient.GetTeam(context.Background(), privateTeamNotAMember.Id, "")
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
		assert.Nil(t, team)
	})

	t.Run("guest can view private team they are a member of", func(t *testing.T) {
		team, resp, err := guestClient.GetTeam(context.Background(), privateTeamIsAMember.Id, "")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Equal(t, privateTeamIsAMember.Id, team.Id)
	})
}
