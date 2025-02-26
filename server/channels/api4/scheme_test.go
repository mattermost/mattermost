// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestCreateScheme(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicense("custom_permissions_schemes"))

	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)

	// Basic test of creating a team scheme.
	scheme1 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SchemeScopeTeam,
	}

	s1, _, err := th.SystemAdminClient.CreateScheme(context.Background(), scheme1)
	require.NoError(t, err)

	assert.Equal(t, s1.DisplayName, scheme1.DisplayName)
	assert.Equal(t, s1.Name, scheme1.Name)
	assert.Equal(t, s1.Description, scheme1.Description)
	assert.NotZero(t, s1.CreateAt)
	assert.Equal(t, s1.CreateAt, s1.UpdateAt)
	assert.Zero(t, s1.DeleteAt)
	assert.Equal(t, s1.Scope, scheme1.Scope)
	assert.NotZero(t, len(s1.DefaultTeamAdminRole))
	assert.NotZero(t, len(s1.DefaultTeamUserRole))
	assert.NotZero(t, len(s1.DefaultTeamGuestRole))
	assert.NotZero(t, len(s1.DefaultChannelAdminRole))
	assert.NotZero(t, len(s1.DefaultChannelUserRole))
	assert.NotZero(t, len(s1.DefaultChannelGuestRole))

	// Check the default roles have been created.
	_, _, err = th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultTeamAdminRole)
	require.NoError(t, err)
	_, _, err = th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultTeamUserRole)
	require.NoError(t, err)
	_, _, err = th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultChannelAdminRole)
	require.NoError(t, err)
	_, _, err = th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultChannelUserRole)
	require.NoError(t, err)

	_, _, err = th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultTeamGuestRole)
	require.NoError(t, err)
	_, _, err = th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultTeamGuestRole)
	require.NoError(t, err)
	_, _, err = th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultChannelGuestRole)
	require.NoError(t, err)

	// Basic Test of a Channel scheme.
	scheme2 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SchemeScopeChannel,
	}

	s2, _, err := th.SystemAdminClient.CreateScheme(context.Background(), scheme2)
	require.NoError(t, err)

	assert.Equal(t, s2.DisplayName, scheme2.DisplayName)
	assert.Equal(t, s2.Name, scheme2.Name)
	assert.Equal(t, s2.Description, scheme2.Description)
	assert.NotZero(t, s2.CreateAt)
	assert.Equal(t, s2.CreateAt, s2.UpdateAt)
	assert.Zero(t, s2.DeleteAt)
	assert.Equal(t, s2.Scope, scheme2.Scope)
	assert.Zero(t, len(s2.DefaultTeamAdminRole))
	assert.Zero(t, len(s2.DefaultTeamUserRole))
	assert.Zero(t, len(s2.DefaultTeamGuestRole))
	assert.NotZero(t, len(s2.DefaultChannelAdminRole))
	assert.NotZero(t, len(s2.DefaultChannelUserRole))
	assert.NotZero(t, len(s2.DefaultChannelGuestRole))

	// Check the default roles have been created.
	_, _, err = th.SystemAdminClient.GetRoleByName(context.Background(), s2.DefaultChannelAdminRole)
	require.NoError(t, err)
	_, _, err = th.SystemAdminClient.GetRoleByName(context.Background(), s2.DefaultChannelUserRole)
	require.NoError(t, err)
	_, _, err = th.SystemAdminClient.GetRoleByName(context.Background(), s2.DefaultChannelGuestRole)
	require.NoError(t, err)

	// Try and create a scheme with an invalid scope.
	scheme3 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.NewId(),
	}

	_, r3, _ := th.SystemAdminClient.CreateScheme(context.Background(), scheme3)
	CheckBadRequestStatus(t, r3)

	// Try and create a scheme with an invalid display name.
	scheme4 := &model.Scheme{
		DisplayName: strings.Repeat(model.NewId(), 100),
		Name:        "Name",
		Description: model.NewId(),
		Scope:       model.NewId(),
	}
	_, r4, _ := th.SystemAdminClient.CreateScheme(context.Background(), scheme4)
	CheckBadRequestStatus(t, r4)

	// Try and create a scheme with an invalid name.
	scheme8 := &model.Scheme{
		DisplayName: "DisplayName",
		Name:        strings.Repeat(model.NewId(), 100),
		Description: model.NewId(),
		Scope:       model.NewId(),
	}
	_, r8, _ := th.SystemAdminClient.CreateScheme(context.Background(), scheme8)
	CheckBadRequestStatus(t, r8)

	// Try and create a scheme without the appropriate permissions.
	scheme5 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SchemeScopeTeam,
	}
	_, r5, err := th.Client.CreateScheme(context.Background(), scheme5)
	require.Error(t, err)
	CheckForbiddenStatus(t, r5)

	// Try and create a scheme without a license.
	th.App.Srv().SetLicense(nil)
	scheme6 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SchemeScopeTeam,
	}
	_, r6, _ := th.SystemAdminClient.CreateScheme(context.Background(), scheme6)
	CheckNotImplementedStatus(t, r6)

	// Create scheme with a Professional SKU license but no explicit 'custom_permissions_schemes' license feature.
	lic := &model.License{
		Features: &model.Features{
			CustomPermissionsSchemes: model.NewPointer(false),
		},
		Customer: &model.Customer{
			Name:  "TestName",
			Email: "test@example.com",
		},
		SkuName:      "SKU NAME",
		SkuShortName: model.LicenseShortSkuProfessional,
		StartsAt:     model.GetMillis() - 1000,
		ExpiresAt:    model.GetMillis() + 100000,
	}
	th.App.Srv().SetLicense(lic)
	scheme6b := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SchemeScopeTeam,
	}
	_, resp, err := th.SystemAdminClient.CreateScheme(context.Background(), scheme6b)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	err = th.App.SetPhase2PermissionsMigrationStatus(false)
	require.NoError(t, err)

	th.LoginSystemAdmin()
	th.App.Srv().SetLicense(model.NewTestLicense("custom_permissions_schemes"))

	scheme7 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SchemeScopeTeam,
	}
	_, r7, _ := th.SystemAdminClient.CreateScheme(context.Background(), scheme7)
	CheckNotImplementedStatus(t, r7)
}

func TestGetScheme(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicense("custom_permissions_schemes"))

	// Basic test of creating a team scheme.
	scheme1 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SchemeScopeTeam,
	}

	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)

	s1, _, err := th.SystemAdminClient.CreateScheme(context.Background(), scheme1)
	require.NoError(t, err)

	assert.Equal(t, s1.DisplayName, scheme1.DisplayName)
	assert.Equal(t, s1.Name, scheme1.Name)
	assert.Equal(t, s1.Description, scheme1.Description)
	assert.NotZero(t, s1.CreateAt)
	assert.Equal(t, s1.CreateAt, s1.UpdateAt)
	assert.Zero(t, s1.DeleteAt)
	assert.Equal(t, s1.Scope, scheme1.Scope)
	assert.NotZero(t, len(s1.DefaultTeamAdminRole))
	assert.NotZero(t, len(s1.DefaultTeamUserRole))
	assert.NotZero(t, len(s1.DefaultTeamGuestRole))
	assert.NotZero(t, len(s1.DefaultChannelAdminRole))
	assert.NotZero(t, len(s1.DefaultChannelUserRole))
	assert.NotZero(t, len(s1.DefaultChannelGuestRole))

	s2, _, err := th.SystemAdminClient.GetScheme(context.Background(), s1.Id)
	require.NoError(t, err)

	assert.Equal(t, s1, s2)

	_, r3, _ := th.SystemAdminClient.GetScheme(context.Background(), model.NewId())
	CheckNotFoundStatus(t, r3)

	_, r4, _ := th.SystemAdminClient.GetScheme(context.Background(), "12345")
	CheckBadRequestStatus(t, r4)

	_, err = th.SystemAdminClient.Logout(context.Background())
	require.NoError(t, err)
	_, r5, _ := th.SystemAdminClient.GetScheme(context.Background(), s1.Id)
	CheckUnauthorizedStatus(t, r5)

	_, _, err = th.SystemAdminClient.Login(context.Background(), th.SystemAdminUser.Username, th.SystemAdminUser.Password)
	require.NoError(t, err)
	th.App.Srv().SetLicense(nil)
	_, _, err = th.SystemAdminClient.GetScheme(context.Background(), s1.Id)
	require.NoError(t, err)

	_, r7, err := th.Client.GetScheme(context.Background(), s1.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, r7)

	err = th.App.SetPhase2PermissionsMigrationStatus(false)
	require.NoError(t, err)

	_, r8, _ := th.SystemAdminClient.GetScheme(context.Background(), s1.Id)
	CheckNotImplementedStatus(t, r8)
}

func TestGetSchemes(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicense("custom_permissions_schemes"))

	scheme1 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SchemeScopeTeam,
	}

	scheme2 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SchemeScopeChannel,
	}

	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)

	_, _, err = th.SystemAdminClient.CreateScheme(context.Background(), scheme1)
	require.NoError(t, err)
	_, _, err = th.SystemAdminClient.CreateScheme(context.Background(), scheme2)
	require.NoError(t, err)

	l3, _, err := th.SystemAdminClient.GetSchemes(context.Background(), "", 0, 100)
	require.NoError(t, err)

	assert.NotZero(t, len(l3))

	l4, _, err := th.SystemAdminClient.GetSchemes(context.Background(), "team", 0, 100)
	require.NoError(t, err)

	for _, s := range l4 {
		assert.Equal(t, "team", s.Scope)
	}

	l5, _, err := th.SystemAdminClient.GetSchemes(context.Background(), "channel", 0, 100)
	require.NoError(t, err)

	for _, s := range l5 {
		assert.Equal(t, "channel", s.Scope)
	}

	_, r6, _ := th.SystemAdminClient.GetSchemes(context.Background(), "asdf", 0, 100)
	CheckBadRequestStatus(t, r6)

	_, err = th.Client.Logout(context.Background())
	require.NoError(t, err)
	_, r7, _ := th.Client.GetSchemes(context.Background(), "", 0, 100)
	CheckUnauthorizedStatus(t, r7)

	_, _, err = th.Client.Login(context.Background(), th.BasicUser.Username, th.BasicUser.Password)
	require.NoError(t, err)
	_, r8, err := th.Client.GetSchemes(context.Background(), "", 0, 100)
	require.Error(t, err)
	CheckForbiddenStatus(t, r8)

	err = th.App.SetPhase2PermissionsMigrationStatus(false)
	require.NoError(t, err)

	_, r9, _ := th.SystemAdminClient.GetSchemes(context.Background(), "", 0, 100)
	CheckNotImplementedStatus(t, r9)
}

func TestGetTeamsForScheme(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicense("custom_permissions_schemes"))

	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)

	scheme1 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SchemeScopeTeam,
	}
	scheme1, _, err = th.SystemAdminClient.CreateScheme(context.Background(), scheme1)
	require.NoError(t, err)

	team1 := &model.Team{
		Name:        GenerateTestUsername(),
		DisplayName: "A Test Team",
		Type:        model.TeamOpen,
	}

	team1, err = th.App.Srv().Store().Team().Save(team1)
	require.NoError(t, err)

	l2, _, err := th.SystemAdminClient.GetTeamsForScheme(context.Background(), scheme1.Id, 0, 100)
	require.NoError(t, err)
	assert.Zero(t, len(l2))

	team1.SchemeId = &scheme1.Id
	team1, err = th.App.Srv().Store().Team().Update(team1)
	assert.NoError(t, err)

	l3, _, err := th.SystemAdminClient.GetTeamsForScheme(context.Background(), scheme1.Id, 0, 100)
	require.NoError(t, err)
	assert.Len(t, l3, 1)
	assert.Equal(t, team1.Id, l3[0].Id)

	team2 := &model.Team{
		Name:        GenerateTestUsername(),
		DisplayName: "B Test Team",
		Type:        model.TeamOpen,
		SchemeId:    &scheme1.Id,
	}
	team2, err = th.App.Srv().Store().Team().Save(team2)
	require.NoError(t, err)

	l4, _, err := th.SystemAdminClient.GetTeamsForScheme(context.Background(), scheme1.Id, 0, 100)
	require.NoError(t, err)
	assert.Len(t, l4, 2)
	assert.Equal(t, team1.Id, l4[0].Id)
	assert.Equal(t, team2.Id, l4[1].Id)

	l5, _, err := th.SystemAdminClient.GetTeamsForScheme(context.Background(), scheme1.Id, 1, 1)
	require.NoError(t, err)
	assert.Len(t, l5, 1)
	assert.Equal(t, team2.Id, l5[0].Id)

	// Check various error cases.
	_, ri1, _ := th.SystemAdminClient.GetTeamsForScheme(context.Background(), model.NewId(), 0, 100)
	CheckNotFoundStatus(t, ri1)

	_, ri2, _ := th.SystemAdminClient.GetTeamsForScheme(context.Background(), "", 0, 100)
	CheckBadRequestStatus(t, ri2)

	_, err = th.Client.Logout(context.Background())
	require.NoError(t, err)
	_, ri3, _ := th.Client.GetTeamsForScheme(context.Background(), model.NewId(), 0, 100)
	CheckUnauthorizedStatus(t, ri3)

	_, _, err = th.Client.Login(context.Background(), th.BasicUser.Username, th.BasicUser.Password)
	require.NoError(t, err)
	_, ri4, err := th.Client.GetTeamsForScheme(context.Background(), model.NewId(), 0, 100)
	require.Error(t, err)
	CheckForbiddenStatus(t, ri4)

	scheme2 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SchemeScopeChannel,
	}
	scheme2, _, err = th.SystemAdminClient.CreateScheme(context.Background(), scheme2)
	require.NoError(t, err)

	_, ri5, _ := th.SystemAdminClient.GetTeamsForScheme(context.Background(), scheme2.Id, 0, 100)
	CheckBadRequestStatus(t, ri5)

	err = th.App.SetPhase2PermissionsMigrationStatus(false)
	require.NoError(t, err)

	_, ri6, _ := th.SystemAdminClient.GetTeamsForScheme(context.Background(), scheme1.Id, 0, 100)
	CheckNotImplementedStatus(t, ri6)
}

func TestGetChannelsForScheme(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicense("custom_permissions_schemes"))

	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)

	scheme1 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SchemeScopeChannel,
	}
	scheme1, _, err = th.SystemAdminClient.CreateScheme(context.Background(), scheme1)
	require.NoError(t, err)

	channel1 := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "A Name",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}

	channel1, errCh := th.App.Srv().Store().Channel().Save(th.Context, channel1, 1000000)
	assert.NoError(t, errCh)

	l2, _, err := th.SystemAdminClient.GetChannelsForScheme(context.Background(), scheme1.Id, 0, 100)
	require.NoError(t, err)
	assert.Zero(t, len(l2))

	channel1.SchemeId = &scheme1.Id
	channel1, err = th.App.Srv().Store().Channel().Update(th.Context, channel1)
	assert.NoError(t, err)

	l3, _, err := th.SystemAdminClient.GetChannelsForScheme(context.Background(), scheme1.Id, 0, 100)
	require.NoError(t, err)
	assert.Len(t, l3, 1)
	assert.Equal(t, channel1.Id, l3[0].Id)

	channel2 := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "B Name",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
		SchemeId:    &scheme1.Id,
	}
	channel2, err = th.App.Srv().Store().Channel().Save(th.Context, channel2, 1000000)
	assert.NoError(t, err)

	l4, _, err := th.SystemAdminClient.GetChannelsForScheme(context.Background(), scheme1.Id, 0, 100)
	require.NoError(t, err)
	assert.Len(t, l4, 2)
	assert.Equal(t, channel1.Id, l4[0].Id)
	assert.Equal(t, channel2.Id, l4[1].Id)

	l5, _, err := th.SystemAdminClient.GetChannelsForScheme(context.Background(), scheme1.Id, 1, 1)
	require.NoError(t, err)
	assert.Len(t, l5, 1)
	assert.Equal(t, channel2.Id, l5[0].Id)

	// Check various error cases.
	_, ri1, _ := th.SystemAdminClient.GetChannelsForScheme(context.Background(), model.NewId(), 0, 100)
	CheckNotFoundStatus(t, ri1)

	_, ri2, _ := th.SystemAdminClient.GetChannelsForScheme(context.Background(), "", 0, 100)
	CheckBadRequestStatus(t, ri2)

	_, err = th.Client.Logout(context.Background())
	require.NoError(t, err)
	_, ri3, _ := th.Client.GetChannelsForScheme(context.Background(), model.NewId(), 0, 100)
	CheckUnauthorizedStatus(t, ri3)

	_, _, err = th.Client.Login(context.Background(), th.BasicUser.Username, th.BasicUser.Password)
	require.NoError(t, err)
	_, ri4, err := th.Client.GetChannelsForScheme(context.Background(), model.NewId(), 0, 100)
	require.Error(t, err)
	CheckForbiddenStatus(t, ri4)

	scheme2 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SchemeScopeTeam,
	}
	scheme2, _, err = th.SystemAdminClient.CreateScheme(context.Background(), scheme2)
	require.NoError(t, err)

	_, ri5, _ := th.SystemAdminClient.GetChannelsForScheme(context.Background(), scheme2.Id, 0, 100)
	CheckBadRequestStatus(t, ri5)

	err = th.App.SetPhase2PermissionsMigrationStatus(false)
	require.NoError(t, err)

	_, ri6, _ := th.SystemAdminClient.GetChannelsForScheme(context.Background(), scheme1.Id, 0, 100)
	CheckNotImplementedStatus(t, ri6)
}

func TestPatchScheme(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicense("custom_permissions_schemes"))

	err := th.App.SetPhase2PermissionsMigrationStatus(true)
	require.NoError(t, err)

	// Basic test of creating a team scheme.
	scheme1 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SchemeScopeTeam,
	}

	s1, _, err := th.SystemAdminClient.CreateScheme(context.Background(), scheme1)
	require.NoError(t, err)

	assert.Equal(t, s1.DisplayName, scheme1.DisplayName)
	assert.Equal(t, s1.Name, scheme1.Name)
	assert.Equal(t, s1.Description, scheme1.Description)
	assert.NotZero(t, s1.CreateAt)
	assert.Equal(t, s1.CreateAt, s1.UpdateAt)
	assert.Zero(t, s1.DeleteAt)
	assert.Equal(t, s1.Scope, scheme1.Scope)
	assert.NotZero(t, len(s1.DefaultTeamAdminRole))
	assert.NotZero(t, len(s1.DefaultTeamUserRole))
	assert.NotZero(t, len(s1.DefaultTeamGuestRole))
	assert.NotZero(t, len(s1.DefaultChannelAdminRole))
	assert.NotZero(t, len(s1.DefaultChannelUserRole))
	assert.NotZero(t, len(s1.DefaultChannelGuestRole))

	s2, _, err := th.SystemAdminClient.GetScheme(context.Background(), s1.Id)
	require.NoError(t, err)

	assert.Equal(t, s1, s2)

	// Test with a valid patch.
	schemePatch := &model.SchemePatch{
		DisplayName: new(string),
		Name:        new(string),
		Description: new(string),
	}
	*schemePatch.DisplayName = model.NewId()
	*schemePatch.Name = model.NewId()
	*schemePatch.Description = model.NewId()

	s3, _, err := th.SystemAdminClient.PatchScheme(context.Background(), s2.Id, schemePatch)
	require.NoError(t, err)
	assert.Equal(t, s3.Id, s2.Id)
	assert.Equal(t, s3.DisplayName, *schemePatch.DisplayName)
	assert.Equal(t, s3.Name, *schemePatch.Name)
	assert.Equal(t, s3.Description, *schemePatch.Description)

	s4, _, err := th.SystemAdminClient.GetScheme(context.Background(), s3.Id)
	require.NoError(t, err)
	assert.Equal(t, s3, s4)

	// Test with a partial patch.
	*schemePatch.Name = model.NewId()
	*schemePatch.DisplayName = model.NewId()
	schemePatch.Description = nil

	s5, _, err := th.SystemAdminClient.PatchScheme(context.Background(), s4.Id, schemePatch)
	require.NoError(t, err)
	assert.Equal(t, s5.Id, s4.Id)
	assert.Equal(t, s5.DisplayName, *schemePatch.DisplayName)
	assert.Equal(t, s5.Name, *schemePatch.Name)
	assert.Equal(t, s5.Description, s4.Description)

	s6, _, err := th.SystemAdminClient.GetScheme(context.Background(), s5.Id)
	require.NoError(t, err)
	assert.Equal(t, s5, s6)

	// Test with invalid patch.
	*schemePatch.Name = strings.Repeat(model.NewId(), 20)
	_, r7, _ := th.SystemAdminClient.PatchScheme(context.Background(), s6.Id, schemePatch)
	CheckBadRequestStatus(t, r7)

	// Test with unknown ID.
	*schemePatch.Name = model.NewId()
	_, r8, _ := th.SystemAdminClient.PatchScheme(context.Background(), model.NewId(), schemePatch)
	CheckNotFoundStatus(t, r8)

	// Test with invalid ID.
	_, r9, _ := th.SystemAdminClient.PatchScheme(context.Background(), "12345", schemePatch)
	CheckBadRequestStatus(t, r9)

	// Test without required permissions.
	_, r10, err := th.Client.PatchScheme(context.Background(), s6.Id, schemePatch)
	require.Error(t, err)
	CheckForbiddenStatus(t, r10)

	// Test without license.
	th.App.Srv().SetLicense(nil)
	_, r11, _ := th.SystemAdminClient.PatchScheme(context.Background(), s6.Id, schemePatch)
	CheckNotImplementedStatus(t, r11)

	// Patch scheme with a Professional SKU license but no explicit 'custom_permissions_schemes' license feature.
	lic := &model.License{
		Features: &model.Features{
			CustomPermissionsSchemes: model.NewPointer(false),
		},
		Customer: &model.Customer{
			Name:  "TestName",
			Email: "test@example.com",
		},
		SkuName:      "SKU NAME",
		SkuShortName: model.LicenseShortSkuProfessional,
		StartsAt:     model.GetMillis() - 1000,
		ExpiresAt:    model.GetMillis() + 100000,
	}
	th.App.Srv().SetLicense(lic)
	_, _, err = th.SystemAdminClient.PatchScheme(context.Background(), s6.Id, schemePatch)
	require.NoError(t, err)

	err = th.App.SetPhase2PermissionsMigrationStatus(false)
	require.NoError(t, err)

	th.LoginSystemAdmin()
	th.App.Srv().SetLicense(model.NewTestLicense("custom_permissions_schemes"))

	_, r12, _ := th.SystemAdminClient.PatchScheme(context.Background(), s6.Id, schemePatch)
	CheckNotImplementedStatus(t, r12)
}

func TestDeleteScheme(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t.Run("ValidTeamScheme", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicense("custom_permissions_schemes"))

		err := th.App.SetPhase2PermissionsMigrationStatus(true)
		require.NoError(t, err)

		// Create a team scheme.
		scheme1 := &model.Scheme{
			DisplayName: model.NewId(),
			Name:        model.NewId(),
			Description: model.NewId(),
			Scope:       model.SchemeScopeTeam,
		}

		s1, _, err := th.SystemAdminClient.CreateScheme(context.Background(), scheme1)
		require.NoError(t, err)

		// Retrieve the roles and check they are not deleted.
		role1, _, err := th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultTeamAdminRole)
		require.NoError(t, err)
		role2, _, err := th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultTeamUserRole)
		require.NoError(t, err)
		role3, _, err := th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultChannelAdminRole)
		require.NoError(t, err)
		role4, _, err := th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultChannelUserRole)
		require.NoError(t, err)
		role5, _, err := th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultTeamGuestRole)
		require.NoError(t, err)
		role6, _, err := th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultChannelGuestRole)
		require.NoError(t, err)

		assert.Zero(t, role1.DeleteAt)
		assert.Zero(t, role2.DeleteAt)
		assert.Zero(t, role3.DeleteAt)
		assert.Zero(t, role4.DeleteAt)
		assert.Zero(t, role5.DeleteAt)
		assert.Zero(t, role6.DeleteAt)

		// Make sure this scheme is in use by a team.
		team, err := th.App.Srv().Store().Team().Save(&model.Team{
			Name:        "zz" + model.NewId(),
			DisplayName: model.NewId(),
			Email:       model.NewId() + "@nowhere.com",
			Type:        model.TeamOpen,
			SchemeId:    &s1.Id,
		})
		require.NoError(t, err)

		// Delete the Scheme.
		_, err = th.SystemAdminClient.DeleteScheme(context.Background(), s1.Id)
		require.NoError(t, err)

		// Check the roles were deleted.
		role1, _, err = th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultTeamAdminRole)
		require.NoError(t, err)
		role2, _, err = th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultTeamUserRole)
		require.NoError(t, err)
		role3, _, err = th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultChannelAdminRole)
		require.NoError(t, err)
		role4, _, err = th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultChannelUserRole)
		require.NoError(t, err)
		role5, _, err = th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultTeamGuestRole)
		require.NoError(t, err)
		role6, _, err = th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultChannelGuestRole)
		require.NoError(t, err)

		assert.NotZero(t, role1.DeleteAt)
		assert.NotZero(t, role2.DeleteAt)
		assert.NotZero(t, role3.DeleteAt)
		assert.NotZero(t, role4.DeleteAt)
		assert.NotZero(t, role5.DeleteAt)
		assert.NotZero(t, role6.DeleteAt)

		// Check the team now uses the default scheme
		c2, _, err := th.SystemAdminClient.GetTeam(context.Background(), team.Id, "")
		require.NoError(t, err)
		assert.Equal(t, "", *c2.SchemeId)
	})

	t.Run("ValidChannelScheme", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicense("custom_permissions_schemes"))

		err := th.App.SetPhase2PermissionsMigrationStatus(true)
		require.NoError(t, err)

		// Create a channel scheme.
		scheme1 := &model.Scheme{
			DisplayName: model.NewId(),
			Name:        model.NewId(),
			Description: model.NewId(),
			Scope:       model.SchemeScopeChannel,
		}

		s1, _, err := th.SystemAdminClient.CreateScheme(context.Background(), scheme1)
		require.NoError(t, err)

		// Retrieve the roles and check they are not deleted.
		role3, _, err := th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultChannelAdminRole)
		require.NoError(t, err)
		role4, _, err := th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultChannelUserRole)
		require.NoError(t, err)
		role6, _, err := th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultChannelGuestRole)
		require.NoError(t, err)

		assert.Zero(t, role3.DeleteAt)
		assert.Zero(t, role4.DeleteAt)
		assert.Zero(t, role6.DeleteAt)

		// Make sure this scheme is in use by a team.
		channel, err := th.App.Srv().Store().Channel().Save(th.Context, &model.Channel{
			TeamId:      model.NewId(),
			DisplayName: model.NewId(),
			Name:        model.NewId(),
			Type:        model.ChannelTypeOpen,
			SchemeId:    &s1.Id,
		}, -1)
		assert.NoError(t, err)

		// Delete the Scheme.
		_, err = th.SystemAdminClient.DeleteScheme(context.Background(), s1.Id)
		require.NoError(t, err)

		// Check the roles were deleted.
		role3, _, err = th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultChannelAdminRole)
		require.NoError(t, err)
		role4, _, err = th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultChannelUserRole)
		require.NoError(t, err)
		role6, _, err = th.SystemAdminClient.GetRoleByName(context.Background(), s1.DefaultChannelGuestRole)
		require.NoError(t, err)

		assert.NotZero(t, role3.DeleteAt)
		assert.NotZero(t, role4.DeleteAt)
		assert.NotZero(t, role6.DeleteAt)

		// Check the channel now uses the default scheme
		c2, _, err := th.SystemAdminClient.GetChannelByName(context.Background(), channel.Name, channel.TeamId, "")
		require.NoError(t, err)
		assert.Equal(t, "", *c2.SchemeId)
	})

	t.Run("FailureCases", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicense("custom_permissions_schemes"))

		err := th.App.SetPhase2PermissionsMigrationStatus(true)
		require.NoError(t, err)

		scheme1 := &model.Scheme{
			DisplayName: model.NewId(),
			Name:        model.NewId(),
			Description: model.NewId(),
			Scope:       model.SchemeScopeChannel,
		}

		s1, _, err := th.SystemAdminClient.CreateScheme(context.Background(), scheme1)
		require.NoError(t, err)

		scheme2 := &model.Scheme{
			DisplayName: model.NewId(),
			Name:        model.NewId(),
			Description: model.NewId(),
			Scope:       model.SchemeScopeChannel,
		}
		s2, _, err := th.SystemAdminClient.CreateScheme(context.Background(), scheme2)
		require.NoError(t, err)

		// Test with unknown ID.
		r2, err := th.SystemAdminClient.DeleteScheme(context.Background(), model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, r2)

		// Test with invalid ID.
		r3, err := th.SystemAdminClient.DeleteScheme(context.Background(), "12345")
		require.Error(t, err)
		CheckBadRequestStatus(t, r3)

		// Test without required permissions.
		r4, err := th.Client.DeleteScheme(context.Background(), s1.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, r4)

		// Test without license.
		th.App.Srv().SetLicense(nil)
		r5, err := th.SystemAdminClient.DeleteScheme(context.Background(), s1.Id)
		require.Error(t, err)
		CheckNotImplementedStatus(t, r5)

		// Delete scheme with a Professional SKU license but no explicit 'custom_permissions_schemes' license feature.
		lic := &model.License{
			Features: &model.Features{
				CustomPermissionsSchemes: model.NewPointer(false),
			},
			Customer: &model.Customer{
				Name:  "TestName",
				Email: "test@example.com",
			},
			SkuName:      "SKU NAME",
			SkuShortName: model.LicenseShortSkuProfessional,
			StartsAt:     model.GetMillis() - 1000,
			ExpiresAt:    model.GetMillis() + 100000,
		}
		th.App.Srv().SetLicense(lic)
		_, err = th.SystemAdminClient.DeleteScheme(context.Background(), s2.Id)
		require.NoError(t, err)

		err = th.App.SetPhase2PermissionsMigrationStatus(false)
		require.NoError(t, err)

		th.App.Srv().SetLicense(model.NewTestLicense("custom_permissions_schemes"))

		r6, err := th.SystemAdminClient.DeleteScheme(context.Background(), s1.Id)
		require.Error(t, err)
		CheckNotImplementedStatus(t, r6)
	})
}

func TestUpdateTeamSchemeWithTeamMembers(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("Correctly invalidates team member cache", func(t *testing.T) {
		err := th.App.SetPhase2PermissionsMigrationStatus(true)
		require.NoError(t, err)

		team := th.CreateTeam()
		_, _, appErr := th.App.AddUserToTeam(th.Context, team.Id, th.BasicUser.Id, th.SystemAdminUser.Id)
		require.Nil(t, appErr)

		teamScheme := th.SetupTeamScheme()

		teamUserRole, appErr := th.App.GetRoleByName(context.Background(), teamScheme.DefaultTeamUserRole)
		require.Nil(t, appErr)
		teamUserRole.Permissions = []string{}
		_, appErr = th.App.UpdateRole(teamUserRole)
		require.Nil(t, appErr)

		th.LoginBasic()

		_, _, err = th.Client.CreateChannel(context.Background(), &model.Channel{DisplayName: "Test API Name", Name: GenerateTestChannelName(), Type: model.ChannelTypeOpen, TeamId: team.Id})
		require.NoError(t, err)

		team.SchemeId = &teamScheme.Id
		team, appErr = th.App.UpdateTeamScheme(team)
		require.Nil(t, appErr)

		_, _, err = th.Client.CreateChannel(context.Background(), &model.Channel{DisplayName: "Test API Name", Name: GenerateTestChannelName(), Type: model.ChannelTypeOpen, TeamId: team.Id})
		require.Error(t, err)
	})
}
