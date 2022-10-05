// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"archive/zip"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/app/imports"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/mattermost/mattermost-server/v6/testlib"
	"github.com/mattermost/mattermost-server/v6/utils"
	"github.com/mattermost/mattermost-server/v6/utils/fileutils"
)

func TestImportImportScheme(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Mark the phase 2 permissions migration as completed.
	th.App.Srv().Store.System().Save(&model.System{Name: model.MigrationKeyAdvancedPermissionsPhase2, Value: "true"})

	defer func() {
		th.App.Srv().Store.System().PermanentDeleteByName(model.MigrationKeyAdvancedPermissionsPhase2)
	}()

	// Try importing an invalid scheme in dryRun mode.
	data := imports.SchemeImportData{
		Name:  ptrStr(model.NewId()),
		Scope: ptrStr("team"),
		DefaultTeamGuestRole: &imports.RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultTeamUserRole: &imports.RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultTeamAdminRole: &imports.RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultChannelGuestRole: &imports.RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultChannelUserRole: &imports.RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultChannelAdminRole: &imports.RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		Description: ptrStr("description"),
	}

	err := th.App.importScheme(&data, true)
	require.NotNil(t, err, "Should have failed to import.")

	_, nErr := th.App.Srv().Store.Scheme().GetByName(*data.Name)
	require.Error(t, nErr, "Scheme should not have imported.")

	// Try importing a valid scheme in dryRun mode.
	data.DisplayName = ptrStr("display name")

	err = th.App.importScheme(&data, true)
	require.Nil(t, err, "Should have succeeded.")

	_, nErr = th.App.Srv().Store.Scheme().GetByName(*data.Name)
	require.Error(t, nErr, "Scheme should not have imported.")

	// Try importing an invalid scheme.
	data.DisplayName = nil

	err = th.App.importScheme(&data, false)
	require.NotNil(t, err, "Should have failed to import.")

	_, nErr = th.App.Srv().Store.Scheme().GetByName(*data.Name)
	require.Error(t, nErr, "Scheme should not have imported.")

	// Try importing a valid scheme with all params set.
	data.DisplayName = ptrStr("display name")

	err = th.App.importScheme(&data, false)
	require.Nil(t, err, "Should have succeeded.")

	scheme, nErr := th.App.Srv().Store.Scheme().GetByName(*data.Name)
	require.NoError(t, nErr, "Failed to import scheme: %v", err)

	assert.Equal(t, *data.Name, scheme.Name)
	assert.Equal(t, *data.DisplayName, scheme.DisplayName)
	assert.Equal(t, *data.Description, scheme.Description)
	assert.Equal(t, *data.Scope, scheme.Scope)

	role, nErr := th.App.Srv().Store.Role().GetByName(context.Background(), scheme.DefaultTeamAdminRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamAdminRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), scheme.DefaultTeamUserRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamUserRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), scheme.DefaultTeamGuestRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamGuestRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), scheme.DefaultChannelAdminRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelAdminRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), scheme.DefaultChannelUserRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelUserRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), scheme.DefaultChannelGuestRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelGuestRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	// Try modifying all the fields and re-importing.
	data.DisplayName = ptrStr("new display name")
	data.Description = ptrStr("new description")

	err = th.App.importScheme(&data, false)
	require.Nil(t, err, "Should have succeeded: %v", err)

	scheme, nErr = th.App.Srv().Store.Scheme().GetByName(*data.Name)
	require.NoError(t, nErr, "Failed to import scheme: %v", err)

	assert.Equal(t, *data.Name, scheme.Name)
	assert.Equal(t, *data.DisplayName, scheme.DisplayName)
	assert.Equal(t, *data.Description, scheme.Description)
	assert.Equal(t, *data.Scope, scheme.Scope)

	role, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), scheme.DefaultTeamAdminRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamAdminRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), scheme.DefaultTeamUserRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamUserRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), scheme.DefaultTeamGuestRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamGuestRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), scheme.DefaultChannelAdminRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelAdminRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), scheme.DefaultChannelUserRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelUserRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), scheme.DefaultChannelGuestRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelGuestRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	// Try changing the scope of the scheme and reimporting.
	data.Scope = ptrStr("channel")

	err = th.App.importScheme(&data, false)
	require.NotNil(t, err, "Should have failed to import.")

	scheme, nErr = th.App.Srv().Store.Scheme().GetByName(*data.Name)
	require.NoError(t, nErr, "Failed to import scheme: %v", err)

	assert.Equal(t, *data.Name, scheme.Name)
	assert.Equal(t, *data.DisplayName, scheme.DisplayName)
	assert.Equal(t, *data.Description, scheme.Description)
	assert.Equal(t, "team", scheme.Scope)

}

func TestImportImportSchemeWithoutGuestRoles(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Mark the phase 2 permissions migration as completed.
	th.App.Srv().Store.System().Save(&model.System{Name: model.MigrationKeyAdvancedPermissionsPhase2, Value: "true"})

	defer func() {
		th.App.Srv().Store.System().PermanentDeleteByName(model.MigrationKeyAdvancedPermissionsPhase2)
	}()

	// Try importing an invalid scheme in dryRun mode.
	data := imports.SchemeImportData{
		Name:  ptrStr(model.NewId()),
		Scope: ptrStr("team"),
		DefaultTeamUserRole: &imports.RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultTeamAdminRole: &imports.RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultChannelUserRole: &imports.RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultChannelAdminRole: &imports.RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		Description: ptrStr("description"),
	}

	err := th.App.importScheme(&data, true)
	require.NotNil(t, err, "Should have failed to import.")

	_, nErr := th.App.Srv().Store.Scheme().GetByName(*data.Name)
	require.Error(t, nErr, "Scheme should not have imported.")

	// Try importing a valid scheme in dryRun mode.
	data.DisplayName = ptrStr("display name")

	err = th.App.importScheme(&data, true)
	require.Nil(t, err, "Should have succeeded.")

	_, nErr = th.App.Srv().Store.Scheme().GetByName(*data.Name)
	require.Error(t, nErr, "Scheme should not have imported.")

	// Try importing an invalid scheme.
	data.DisplayName = nil

	err = th.App.importScheme(&data, false)
	require.NotNil(t, err, "Should have failed to import.")

	_, nErr = th.App.Srv().Store.Scheme().GetByName(*data.Name)
	require.Error(t, nErr, "Scheme should not have imported.")

	// Try importing a valid scheme with all params set.
	data.DisplayName = ptrStr("display name")

	err = th.App.importScheme(&data, false)
	require.Nil(t, err, "Should have succeeded.")

	scheme, nErr := th.App.Srv().Store.Scheme().GetByName(*data.Name)
	require.NoError(t, nErr, "Failed to import scheme: %v", err)

	assert.Equal(t, *data.Name, scheme.Name)
	assert.Equal(t, *data.DisplayName, scheme.DisplayName)
	assert.Equal(t, *data.Description, scheme.Description)
	assert.Equal(t, *data.Scope, scheme.Scope)

	role, nErr := th.App.Srv().Store.Role().GetByName(context.Background(), scheme.DefaultTeamAdminRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamAdminRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), scheme.DefaultTeamUserRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamUserRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), scheme.DefaultTeamGuestRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamGuestRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), scheme.DefaultChannelAdminRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelAdminRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), scheme.DefaultChannelUserRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelUserRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), scheme.DefaultChannelGuestRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelGuestRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	// Try modifying all the fields and re-importing.
	data.DisplayName = ptrStr("new display name")
	data.Description = ptrStr("new description")

	err = th.App.importScheme(&data, false)
	require.Nil(t, err, "Should have succeeded: %v", err)

	scheme, nErr = th.App.Srv().Store.Scheme().GetByName(*data.Name)
	require.NoError(t, nErr, "Failed to import scheme: %v", err)

	assert.Equal(t, *data.Name, scheme.Name)
	assert.Equal(t, *data.DisplayName, scheme.DisplayName)
	assert.Equal(t, *data.Description, scheme.Description)
	assert.Equal(t, *data.Scope, scheme.Scope)

	role, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), scheme.DefaultTeamAdminRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamAdminRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), scheme.DefaultTeamUserRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamUserRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), scheme.DefaultTeamGuestRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamGuestRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), scheme.DefaultChannelAdminRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelAdminRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), scheme.DefaultChannelUserRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelUserRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), scheme.DefaultChannelGuestRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelGuestRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	// Try changing the scope of the scheme and reimporting.
	data.Scope = ptrStr("channel")

	err = th.App.importScheme(&data, false)
	require.NotNil(t, err, "Should have failed to import.")

	scheme, nErr = th.App.Srv().Store.Scheme().GetByName(*data.Name)
	require.NoError(t, nErr, "Failed to import scheme: %v", err)

	assert.Equal(t, *data.Name, scheme.Name)
	assert.Equal(t, *data.DisplayName, scheme.DisplayName)
	assert.Equal(t, *data.Description, scheme.Description)
	assert.Equal(t, "team", scheme.Scope)
}

func TestImportImportRole(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Try importing an invalid role in dryRun mode.
	rid1 := model.NewId()
	data := imports.RoleImportData{
		Name: &rid1,
	}

	err := th.App.importRole(&data, true, false)
	require.NotNil(t, err, "Should have failed to import.")

	_, nErr := th.App.Srv().Store.Role().GetByName(context.Background(), rid1)
	require.Error(t, nErr, "Should have failed to import.")

	// Try importing the valid role in dryRun mode.
	data.DisplayName = ptrStr("display name")

	err = th.App.importRole(&data, true, false)
	require.Nil(t, err, "Should have succeeded.")

	_, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), rid1)
	require.Error(t, nErr, "Role should not have imported as we are in dry run mode.")

	// Try importing an invalid role.
	data.DisplayName = nil

	err = th.App.importRole(&data, false, false)
	require.NotNil(t, err, "Should have failed to import.")

	_, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), rid1)
	require.Error(t, nErr, "Role should not have imported.")

	// Try importing a valid role with all params set.
	data.DisplayName = ptrStr("display name")
	data.Description = ptrStr("description")
	data.Permissions = &[]string{"invite_user", "add_user_to_team"}

	err = th.App.importRole(&data, false, false)
	require.Nil(t, err, "Should have succeeded.")

	role, nErr := th.App.Srv().Store.Role().GetByName(context.Background(), rid1)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.Name, role.Name)
	assert.Equal(t, *data.DisplayName, role.DisplayName)
	assert.Equal(t, *data.Description, role.Description)
	assert.Equal(t, *data.Permissions, role.Permissions)
	assert.False(t, role.BuiltIn)
	assert.False(t, role.SchemeManaged)

	// Try changing all the params and reimporting.
	data.DisplayName = ptrStr("new display name")
	data.Description = ptrStr("description")
	data.Permissions = &[]string{"use_slash_commands"}

	err = th.App.importRole(&data, false, true)
	require.Nil(t, err, "Should have succeeded. %v", err)

	role, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), rid1)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.Name, role.Name)
	assert.Equal(t, *data.DisplayName, role.DisplayName)
	assert.Equal(t, *data.Description, role.Description)
	assert.Equal(t, *data.Permissions, role.Permissions)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	// Check that re-importing with only required fields doesn't update the others.
	data2 := imports.RoleImportData{
		Name:        &rid1,
		DisplayName: ptrStr("new display name again"),
	}

	err = th.App.importRole(&data2, false, false)
	require.Nil(t, err, "Should have succeeded.")

	role, nErr = th.App.Srv().Store.Role().GetByName(context.Background(), rid1)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data2.Name, role.Name)
	assert.Equal(t, *data2.DisplayName, role.DisplayName)
	assert.Equal(t, *data.Description, role.Description)
	assert.Equal(t, *data.Permissions, role.Permissions)
	assert.False(t, role.BuiltIn)
	assert.False(t, role.SchemeManaged)
}

func TestImportImportTeam(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Mark the phase 2 permissions migration as completed.
	th.App.Srv().Store.System().Save(&model.System{Name: model.MigrationKeyAdvancedPermissionsPhase2, Value: "true"})

	defer func() {
		th.App.Srv().Store.System().PermanentDeleteByName(model.MigrationKeyAdvancedPermissionsPhase2)
	}()

	scheme1 := th.SetupTeamScheme()
	scheme2 := th.SetupTeamScheme()

	// Check how many teams are in the database.
	teamsCount, err := th.App.Srv().Store.Team().AnalyticsTeamCount(nil)
	require.NoError(t, err, "Failed to get team count.")

	data := imports.TeamImportData{
		Name:            ptrStr(model.NewId()),
		DisplayName:     ptrStr("Display Name"),
		Type:            ptrStr("XYZ"),
		Description:     ptrStr("The team description."),
		AllowOpenInvite: ptrBool(true),
		Scheme:          &scheme1.Name,
	}

	// Try importing an invalid team in dryRun mode.
	err = th.App.importTeam(th.Context, &data, true)
	require.Error(t, err, "Should have received an error importing an invalid team.")

	// Do a valid team in dry-run mode.
	data.Type = ptrStr("O")
	appErr := th.App.importTeam(th.Context, &data, true)
	require.Nil(t, appErr, "Received an error validating valid team.")

	// Check that no more teams are in the DB.
	th.CheckTeamCount(t, teamsCount)

	// Do an invalid team in apply mode, check db changes.
	data.Type = ptrStr("XYZ")
	err = th.App.importTeam(th.Context, &data, false)
	require.Error(t, err, "Import should have failed on invalid team.")

	// Check that no more teams are in the DB.
	th.CheckTeamCount(t, teamsCount)

	// Do a valid team in apply mode, check db changes.
	data.Type = ptrStr("O")
	appErr = th.App.importTeam(th.Context, &data, false)
	require.Nil(t, appErr, "Received an error importing valid team: %v", err)

	// Check that one more team is in the DB.
	th.CheckTeamCount(t, teamsCount+1)

	// Get the team and check that all the fields are correct.
	team, appErr := th.App.GetTeamByName(*data.Name)
	require.Nil(t, appErr, "Failed to get team from database.")

	assert.Equal(t, *data.DisplayName, team.DisplayName)
	assert.Equal(t, *data.Type, team.Type)
	assert.Equal(t, *data.Description, team.Description)
	assert.Equal(t, *data.AllowOpenInvite, team.AllowOpenInvite)
	assert.Equal(t, scheme1.Id, *team.SchemeId)

	// Alter all the fields of that team (apart from unique identifier) and import again.
	data.DisplayName = ptrStr("Display Name 2")
	data.Type = ptrStr("P")
	data.Description = ptrStr("The new description")
	data.AllowOpenInvite = ptrBool(false)
	data.Scheme = &scheme2.Name

	// Check that the original number of teams are again in the DB (because this query doesn't include deleted).
	data.Type = ptrStr("O")
	appErr = th.App.importTeam(th.Context, &data, false)
	require.Nil(t, appErr, "Received an error importing updated valid team.")

	th.CheckTeamCount(t, teamsCount+1)

	// Get the team and check that all fields are correct.
	team, appErr = th.App.GetTeamByName(*data.Name)
	require.Nil(t, appErr, "Failed to get team from database.")

	assert.Equal(t, *data.DisplayName, team.DisplayName)
	assert.Equal(t, *data.Type, team.Type)
	assert.Equal(t, *data.Description, team.Description)
	assert.Equal(t, *data.AllowOpenInvite, team.AllowOpenInvite)
	assert.Equal(t, scheme2.Id, *team.SchemeId)
}

func TestImportImportChannel(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Mark the phase 2 permissions migration as completed.
	th.App.Srv().Store.System().Save(&model.System{Name: model.MigrationKeyAdvancedPermissionsPhase2, Value: "true"})

	defer func() {
		th.App.Srv().Store.System().PermanentDeleteByName(model.MigrationKeyAdvancedPermissionsPhase2)
	}()

	scheme1 := th.SetupChannelScheme()
	scheme2 := th.SetupChannelScheme()

	// Import a Team.
	teamName := model.NewRandomTeamName()
	th.App.importTeam(th.Context, &imports.TeamImportData{
		Name:        &teamName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}, false)
	team, err := th.App.GetTeamByName(teamName)
	require.Nil(t, err, "Failed to get team from database.")

	// Check how many channels are in the database.
	channelCount, nErr := th.App.Srv().Store.Channel().AnalyticsTypeCount("", model.ChannelTypeOpen)
	require.NoError(t, nErr, "Failed to get team count.")

	// Do an invalid channel in dry-run mode.
	chanOpen := model.ChannelTypeOpen
	data := imports.ChannelImportData{
		Team:        &teamName,
		DisplayName: ptrStr("Display Name"),
		Type:        &chanOpen,
		Header:      ptrStr("Channel Header"),
		Purpose:     ptrStr("Channel Purpose"),
		Scheme:      &scheme1.Name,
	}
	err = th.App.importChannel(th.Context, &data, true)
	require.NotNil(t, err, "Expected error due to invalid name.")

	// Check that no more channels are in the DB.
	th.CheckChannelsCount(t, channelCount)

	// Do a valid channel with a nonexistent team in dry-run mode.
	data.Name = ptrStr("channelname")
	data.Team = ptrStr(model.NewId())
	err = th.App.importChannel(th.Context, &data, true)
	require.Nil(t, err, "Expected success as cannot validate channel name in dry run mode.")

	// Check that no more channels are in the DB.
	th.CheckChannelsCount(t, channelCount)

	// Do a valid channel in dry-run mode.
	data.Team = &teamName
	err = th.App.importChannel(th.Context, &data, true)
	require.Nil(t, err, "Expected success as valid team.")

	// Check that no more channels are in the DB.
	th.CheckChannelsCount(t, channelCount)

	// Do an invalid channel in apply mode.
	data.Name = nil
	err = th.App.importChannel(th.Context, &data, false)
	require.NotNil(t, err, "Expected error due to invalid name (apply mode).")

	// Check that no more channels are in the DB.
	th.CheckChannelsCount(t, channelCount)

	// Do a valid channel in apply mode with a non-existent team.
	data.Name = ptrStr("channelname")
	data.Team = ptrStr(model.NewId())
	err = th.App.importChannel(th.Context, &data, false)
	require.NotNil(t, err, "Expected error due to non-existent team (apply mode).")

	// Check that no more channels are in the DB.
	th.CheckChannelsCount(t, channelCount)

	// Do a valid channel in apply mode.
	data.Team = &teamName
	err = th.App.importChannel(th.Context, &data, false)
	require.Nil(t, err, "Expected success in apply mode")

	// Check that 1 more channel is in the DB.
	th.CheckChannelsCount(t, channelCount+1)

	// Get the Channel and check all the fields are correct.
	channel, err := th.App.GetChannelByName(th.Context, *data.Name, team.Id, false)
	require.Nil(t, err, "Failed to get channel from database.")

	assert.Equal(t, *data.Name, channel.Name)
	assert.Equal(t, *data.DisplayName, channel.DisplayName)
	assert.Equal(t, *data.Type, channel.Type)
	assert.Equal(t, *data.Header, channel.Header)
	assert.Equal(t, *data.Purpose, channel.Purpose)
	assert.Equal(t, scheme1.Id, *channel.SchemeId)

	// Alter all the fields of that channel.
	cTypePr := model.ChannelTypePrivate
	data.DisplayName = ptrStr("Changed Disp Name")
	data.Type = &cTypePr
	data.Header = ptrStr("New Header")
	data.Purpose = ptrStr("New Purpose")
	data.Scheme = &scheme2.Name
	err = th.App.importChannel(th.Context, &data, false)
	require.Nil(t, err, "Expected success in apply mode")

	// Check channel count the same.
	th.CheckChannelsCount(t, channelCount)

	// Get the Channel and check all the fields are correct.
	channel, err = th.App.GetChannelByName(th.Context, *data.Name, team.Id, false)
	require.Nil(t, err, "Failed to get channel from database.")

	assert.Equal(t, *data.Name, channel.Name)
	assert.Equal(t, *data.DisplayName, channel.DisplayName)
	assert.Equal(t, *data.Type, channel.Type)
	assert.Equal(t, *data.Header, channel.Header)
	assert.Equal(t, *data.Purpose, channel.Purpose)
	assert.Equal(t, scheme2.Id, *channel.SchemeId)
}

func TestImportImportUser(t *testing.T) {
	t.Skip("MM-43341")
	th := Setup(t)
	defer th.TearDown()

	// Check how many users are in the database.
	userCount, err := th.App.Srv().Store.User().Count(model.UserCountOptions{
		IncludeDeleted:     true,
		IncludeBotAccounts: false,
	})
	require.NoError(t, err, "Failed to get user count.")

	// Do an invalid user in dry-run mode.
	data := imports.UserImportData{
		Username: ptrStr(model.NewId()),
	}
	err = th.App.importUser(th.Context, &data, true)
	require.Error(t, err, "Should have failed to import invalid user.")

	// Check that no more users are in the DB.
	userCount2, err := th.App.Srv().Store.User().Count(model.UserCountOptions{
		IncludeDeleted:     true,
		IncludeBotAccounts: false,
	})
	require.NoError(t, err, "Failed to get user count.")
	assert.Equal(t, userCount, userCount2, "Unexpected number of users")

	// Do a valid user in dry-run mode.
	data = imports.UserImportData{
		Username: ptrStr(model.NewId()),
		Email:    ptrStr(model.NewId() + "@example.com"),
	}
	appErr := th.App.importUser(th.Context, &data, true)
	require.Nil(t, appErr, "Should have succeeded to import valid user.")

	// Check that no more users are in the DB.
	userCount3, err := th.App.Srv().Store.User().Count(model.UserCountOptions{
		IncludeDeleted:     true,
		IncludeBotAccounts: false,
	})
	require.NoError(t, err, "Failed to get user count.")
	assert.Equal(t, userCount, userCount3, "Unexpected number of users")

	// Do an invalid user in apply mode.
	data = imports.UserImportData{
		Username: ptrStr(model.NewId()),
	}
	err = th.App.importUser(th.Context, &data, false)
	require.Error(t, err, "Should have failed to import invalid user.")

	// Check that no more users are in the DB.
	userCount4, err := th.App.Srv().Store.User().Count(model.UserCountOptions{
		IncludeDeleted:     true,
		IncludeBotAccounts: false,
	})
	require.NoError(t, err, "Failed to get user count.")
	assert.Equal(t, userCount, userCount4, "Unexpected number of users")

	// Do a valid user in apply mode.
	username := model.NewId()
	testsDir, _ := fileutils.FindDir("tests")
	data = imports.UserImportData{
		ProfileImage: ptrStr(filepath.Join(testsDir, "test.png")),
		Username:     &username,
		Email:        ptrStr(model.NewId() + "@example.com"),
		Nickname:     ptrStr(model.NewId()),
		FirstName:    ptrStr(model.NewId()),
		LastName:     ptrStr(model.NewId()),
		Position:     ptrStr(model.NewId()),
	}
	appErr = th.App.importUser(th.Context, &data, false)
	require.Nil(t, appErr, "Should have succeeded to import valid user.")

	// Check that one more user is in the DB.
	userCount5, err := th.App.Srv().Store.User().Count(model.UserCountOptions{
		IncludeDeleted:     true,
		IncludeBotAccounts: false,
	})
	require.NoError(t, err, "Failed to get user count.")
	assert.Equal(t, userCount+1, userCount5, "Unexpected number of users")

	// Get the user and check all the fields are correct.
	user, err2 := th.App.GetUserByUsername(username)
	require.Nil(t, err2, "Failed to get user from database.")

	userBool := user.Email != *data.Email || user.Nickname != *data.Nickname || user.FirstName != *data.FirstName || user.LastName != *data.LastName || user.Position != *data.Position
	require.False(t, userBool, "User properties do not match Import Data.")

	// Check calculated properties.
	require.Empty(t, user.AuthService, "Expected Auth Service to be empty.")

	require.Empty(t, user.AuthData, "Expected AuthData to be empty.")

	require.NotEmpty(t, user.Password, "Expected password to be set.")

	require.True(t, user.EmailVerified, "Expected EmailVerified to be true.")

	require.Equal(t, user.Locale, *th.App.Config().LocalizationSettings.DefaultClientLocale, "Expected Locale to be the default.")

	require.Equal(t, user.Roles, "system_user", "Expected roles to be system_user")

	// Alter all the fields of that user.
	data.Email = ptrStr(model.NewId() + "@example.com")
	data.ProfileImage = ptrStr(filepath.Join(testsDir, "testgif.gif"))
	data.AuthService = ptrStr("ldap")
	data.AuthData = &username
	data.Nickname = ptrStr(model.NewId())
	data.FirstName = ptrStr(model.NewId())
	data.LastName = ptrStr(model.NewId())
	data.Position = ptrStr(model.NewId())
	data.Roles = ptrStr("system_admin system_user")
	data.Locale = ptrStr("zh_CN")

	appErr = th.App.importUser(th.Context, &data, false)
	require.Nil(t, appErr, "Should have succeeded to update valid user %v", err)

	// Check user count the same.
	userCount6, err := th.App.Srv().Store.User().Count(model.UserCountOptions{
		IncludeDeleted:     true,
		IncludeBotAccounts: false,
	})
	require.NoError(t, err, "Failed to get user count.")
	assert.Equal(t, userCount+1, userCount6, "Unexpected number of users")

	// Get the user and check all the fields are correct.
	user, err2 = th.App.GetUserByUsername(username)
	require.Nil(t, err2, "Failed to get user from database.")

	userBool = user.Email != *data.Email || user.Nickname != *data.Nickname || user.FirstName != *data.FirstName || user.LastName != *data.LastName || user.Position != *data.Position
	require.False(t, userBool, "Updated User properties do not match Import Data.")

	require.Equal(t, "ldap", user.AuthService, "Expected Auth Service to be ldap \"%v\"", user.AuthService)

	require.Equal(t, user.AuthData, data.AuthData, "Expected AuthData to be set.")

	require.Empty(t, user.Password, "Expected password to be empty.")

	require.True(t, user.EmailVerified, "Expected EmailVerified to be true.")

	require.Equal(t, *data.Locale, user.Locale, "Expected Locale to be the set.")

	require.Equal(t, *data.Roles, user.Roles, "Expected roles to be set: %v", user.Roles)

	// Check Password and AuthData together.
	data.Password = ptrStr("PasswordTest")
	appErr = th.App.importUser(th.Context, &data, false)
	require.NotNil(t, appErr, "Should have failed to import invalid user.")

	data.AuthData = nil
	data.AuthService = nil
	appErr = th.App.importUser(th.Context, &data, false)
	require.Nil(t, appErr, "Should have succeeded to update valid user %v", err)

	data.Password = ptrStr("")
	appErr = th.App.importUser(th.Context, &data, false)
	require.NotNil(t, appErr, "Should have failed to import invalid user.")

	data.Password = ptrStr(strings.Repeat("0123456789", 10))
	appErr = th.App.importUser(th.Context, &data, false)
	require.NotNil(t, appErr, "Should have failed to import invalid user.")

	data.Password = ptrStr("TestPassword")

	// Test team and channel memberships
	teamName := model.NewRandomTeamName()
	th.App.importTeam(th.Context, &imports.TeamImportData{
		Name:        &teamName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}, false)
	team, appErr := th.App.GetTeamByName(teamName)
	require.Nil(t, appErr, "Failed to get team from database.")

	channelName := model.NewId()
	chanTypeOpen := model.ChannelTypeOpen
	th.App.importChannel(th.Context, &imports.ChannelImportData{
		Team:        &teamName,
		Name:        &channelName,
		DisplayName: ptrStr("Display Name"),
		Type:        &chanTypeOpen,
	}, false)
	channel, appErr := th.App.GetChannelByName(th.Context, channelName, team.Id, false)
	require.Nil(t, appErr, "Failed to get channel from database.")

	username = model.NewId()
	data = imports.UserImportData{
		Username:  &username,
		Email:     ptrStr(model.NewId() + "@example.com"),
		Nickname:  ptrStr(model.NewId()),
		FirstName: ptrStr(model.NewId()),
		LastName:  ptrStr(model.NewId()),
		Position:  ptrStr(model.NewId()),
	}

	teamMembers, appErr := th.App.GetTeamMembers(team.Id, 0, 1000, nil)
	require.Nil(t, appErr, "Failed to get team member count")
	teamMemberCount := len(teamMembers)

	channelMemberCount, appErr := th.App.GetChannelMemberCount(th.Context, channel.Id)
	require.Nil(t, appErr, "Failed to get channel member count")

	// Test with an invalid team & channel membership in dry-run mode.
	data.Teams = &[]imports.UserTeamImportData{
		{
			Roles: ptrStr("invalid"),
			Channels: &[]imports.UserChannelImportData{
				{
					Roles: ptrStr("invalid"),
				},
			},
		},
	}
	appErr = th.App.importUser(th.Context, &data, true)
	assert.NotNil(t, appErr)

	// Test with an unknown team name & invalid channel membership in dry-run mode.
	data.Teams = &[]imports.UserTeamImportData{
		{
			Name: ptrStr(model.NewId()),
			Channels: &[]imports.UserChannelImportData{
				{
					Roles: ptrStr("invalid"),
				},
			},
		},
	}
	appErr = th.App.importUser(th.Context, &data, true)
	assert.NotNil(t, appErr)

	// Test with a valid team & invalid channel membership in dry-run mode.
	data.Teams = &[]imports.UserTeamImportData{
		{
			Name: &teamName,
			Channels: &[]imports.UserChannelImportData{
				{
					Roles: ptrStr("invalid"),
				},
			},
		},
	}
	appErr = th.App.importUser(th.Context, &data, true)
	assert.NotNil(t, appErr)

	// Test with a valid team & unknown channel name in dry-run mode.
	data.Teams = &[]imports.UserTeamImportData{
		{
			Name: &teamName,
			Channels: &[]imports.UserChannelImportData{
				{
					Name: ptrStr(model.NewId()),
				},
			},
		},
	}
	appErr = th.App.importUser(th.Context, &data, true)
	assert.Nil(t, appErr)

	// Test with a valid team & valid channel name in dry-run mode.
	data.Teams = &[]imports.UserTeamImportData{
		{
			Name: &teamName,
			Channels: &[]imports.UserChannelImportData{
				{
					Name: &channelName,
				},
			},
		},
	}
	appErr = th.App.importUser(th.Context, &data, true)
	assert.Nil(t, appErr)

	// Check no new member objects were created because dry run mode.
	tmc, appErr := th.App.GetTeamMembers(team.Id, 0, 1000, nil)
	require.Nil(t, appErr, "Failed to get Team Member Count")
	require.Len(t, tmc, teamMemberCount, "Number of team members not as expected")

	cmc, appErr := th.App.GetChannelMemberCount(th.Context, channel.Id)
	require.Nil(t, appErr, "Failed to get Channel Member Count")
	require.Equal(t, channelMemberCount, cmc, "Number of channel members not as expected")

	// Test with an invalid team & channel membership in apply mode.
	data.Teams = &[]imports.UserTeamImportData{
		{
			Roles: ptrStr("invalid"),
			Channels: &[]imports.UserChannelImportData{
				{
					Roles: ptrStr("invalid"),
				},
			},
		},
	}
	appErr = th.App.importUser(th.Context, &data, false)
	assert.NotNil(t, appErr)

	// Test with an unknown team name & invalid channel membership in apply mode.
	data.Teams = &[]imports.UserTeamImportData{
		{
			Name: ptrStr(model.NewId()),
			Channels: &[]imports.UserChannelImportData{
				{
					Roles: ptrStr("invalid"),
				},
			},
		},
	}
	appErr = th.App.importUser(th.Context, &data, false)
	assert.NotNil(t, appErr)

	// Test with a valid team & invalid channel membership in apply mode.
	data.Teams = &[]imports.UserTeamImportData{
		{
			Name: &teamName,
			Channels: &[]imports.UserChannelImportData{
				{
					Roles: ptrStr("invalid"),
				},
			},
		},
	}
	appErr = th.App.importUser(th.Context, &data, false)
	assert.NotNil(t, appErr)

	// Check no new member objects were created because all tests should have failed so far.
	tmc, appErr = th.App.GetTeamMembers(team.Id, 0, 1000, nil)
	require.Nil(t, appErr, "Failed to get Team Member Count")
	require.Len(t, tmc, teamMemberCount)

	cmc, appErr = th.App.GetChannelMemberCount(th.Context, channel.Id)
	require.Nil(t, appErr, "Failed to get Channel Member Count")
	require.Equal(t, channelMemberCount, cmc)

	// Test with a valid team & unknown channel name in apply mode.
	data.Teams = &[]imports.UserTeamImportData{
		{
			Name: &teamName,
			Channels: &[]imports.UserChannelImportData{
				{
					Name: ptrStr(model.NewId()),
				},
			},
		},
	}
	appErr = th.App.importUser(th.Context, &data, false)
	assert.NotNil(t, appErr)

	// Check only new team member object created because dry run mode.
	tmc, appErr = th.App.GetTeamMembers(team.Id, 0, 1000, nil)
	require.Nil(t, appErr, "Failed to get Team Member Count")
	require.Len(t, tmc, teamMemberCount+1)

	cmc, appErr = th.App.GetChannelMemberCount(th.Context, channel.Id)
	require.Nil(t, appErr, "Failed to get Channel Member Count")
	require.Equal(t, channelMemberCount, cmc)

	// Check team member properties.
	user, appErr = th.App.GetUserByUsername(username)
	require.Nil(t, appErr, "Failed to get user from database.")

	teamMember, appErr := th.App.GetTeamMember(team.Id, user.Id)
	require.Nil(t, appErr, "Failed to get team member from database.")
	require.Equal(t, "team_user", teamMember.Roles)

	// Test with a valid team & valid channel name in apply mode.
	data.Teams = &[]imports.UserTeamImportData{
		{
			Name: &teamName,
			Channels: &[]imports.UserChannelImportData{
				{
					Name: &channelName,
				},
			},
		},
	}
	appErr = th.App.importUser(th.Context, &data, false)
	assert.Nil(t, appErr)

	// Check only new channel member object created because dry run mode.
	tmc, appErr = th.App.GetTeamMembers(team.Id, 0, 1000, nil)
	require.Nil(t, appErr, "Failed to get Team Member Count")
	require.Len(t, tmc, teamMemberCount+1, "Number of team members not as expected")

	cmc, appErr = th.App.GetChannelMemberCount(th.Context, channel.Id)
	require.Nil(t, appErr, "Failed to get Channel Member Count")
	require.Equal(t, channelMemberCount+1, cmc, "Number of channel members not as expected")

	// Check channel member properties.
	channelMember, appErr := th.App.GetChannelMember(th.Context, channel.Id, user.Id)
	require.Nil(t, appErr, "Failed to get channel member from database.")
	assert.Equal(t, "channel_user", channelMember.Roles)
	assert.Equal(t, "default", channelMember.NotifyProps[model.DesktopNotifyProp])
	assert.Equal(t, "default", channelMember.NotifyProps[model.PushNotifyProp])
	assert.Equal(t, "all", channelMember.NotifyProps[model.MarkUnreadNotifyProp])

	// Test with the properties of the team and channel membership changed.
	data.Teams = &[]imports.UserTeamImportData{
		{
			Name:  &teamName,
			Theme: ptrStr(`{"awayIndicator":"#DBBD4E","buttonBg":"#23A1FF","buttonColor":"#FFFFFF","centerChannelBg":"#ffffff","centerChannelColor":"#333333","codeTheme":"github","image":"/static/files/a4a388b38b32678e83823ef1b3e17766.png","linkColor":"#2389d7","mentionBg":"#2389d7","mentionColor":"#ffffff","mentionHighlightBg":"#fff2bb","mentionHighlightLink":"#2f81b7","newMessageSeparator":"#FF8800","onlineIndicator":"#7DBE00","sidebarBg":"#fafafa","sidebarHeaderBg":"#3481B9","sidebarHeaderTextColor":"#ffffff","sidebarText":"#333333","sidebarTextActiveBorder":"#378FD2","sidebarTextActiveColor":"#111111","sidebarTextHoverBg":"#e6f2fa","sidebarUnreadText":"#333333","type":"Mattermost"}`),
			Roles: ptrStr("team_user team_admin"),
			Channels: &[]imports.UserChannelImportData{
				{
					Name:  &channelName,
					Roles: ptrStr("channel_user channel_admin"),
					NotifyProps: &imports.UserChannelNotifyPropsImportData{
						Desktop:    ptrStr(model.UserNotifyMention),
						Mobile:     ptrStr(model.UserNotifyMention),
						MarkUnread: ptrStr(model.UserNotifyMention),
					},
					Favorite: ptrBool(true),
				},
			},
		},
	}
	appErr = th.App.importUser(th.Context, &data, false)
	assert.Nil(t, appErr)

	// Check both member properties.
	teamMember, appErr = th.App.GetTeamMember(team.Id, user.Id)
	require.Nil(t, appErr, "Failed to get team member from database.")
	require.Equal(t, "team_user team_admin", teamMember.Roles)

	channelMember, appErr = th.App.GetChannelMember(th.Context, channel.Id, user.Id)
	require.Nil(t, appErr, "Failed to get channel member Desktop from database.")
	assert.Equal(t, "channel_user channel_admin", channelMember.Roles)
	assert.Equal(t, model.UserNotifyMention, channelMember.NotifyProps[model.DesktopNotifyProp])
	assert.Equal(t, model.UserNotifyMention, channelMember.NotifyProps[model.PushNotifyProp])
	assert.Equal(t, model.UserNotifyMention, channelMember.NotifyProps[model.MarkUnreadNotifyProp])

	checkPreference(t, th.App, user.Id, model.PreferenceCategoryFavoriteChannel, channel.Id, "true")
	checkPreference(t, th.App, user.Id, model.PreferenceCategoryTheme, team.Id, *(*data.Teams)[0].Theme)

	// No more new member objects.
	tmc, appErr = th.App.GetTeamMembers(team.Id, 0, 1000, nil)
	require.Nil(t, appErr, "Failed to get Team Member Count")
	require.Len(t, tmc, teamMemberCount+1, "Number of team members not as expected")

	cmc, appErr = th.App.GetChannelMemberCount(th.Context, channel.Id)
	require.Nil(t, appErr, "Failed to get Channel Member Count")
	require.Equal(t, channelMemberCount+1, cmc, "Number of channel members not as expected")

	// Add a user with some preferences.
	username = model.NewId()
	data = imports.UserImportData{
		Username:           &username,
		Email:              ptrStr(model.NewId() + "@example.com"),
		Theme:              ptrStr(`{"awayIndicator":"#DCBD4E","buttonBg":"#23A2FF","buttonColor":"#FFFFFF","centerChannelBg":"#ffffff","centerChannelColor":"#333333","codeTheme":"github","image":"/static/files/a4a388b38b32678e83823ef1b3e17766.png","linkColor":"#2389d7","mentionBg":"#2389d7","mentionColor":"#ffffff","mentionHighlightBg":"#fff2bb","mentionHighlightLink":"#2f81b7","newMessageSeparator":"#FF8800","onlineIndicator":"#7DBE00","sidebarBg":"#fafafa","sidebarHeaderBg":"#3481B9","sidebarHeaderTextColor":"#ffffff","sidebarText":"#333333","sidebarTextActiveBorder":"#378FD2","sidebarTextActiveColor":"#111111","sidebarTextHoverBg":"#e6f2fa","sidebarUnreadText":"#333333","type":"Mattermost"}`),
		UseMilitaryTime:    ptrStr("true"),
		CollapsePreviews:   ptrStr("true"),
		MessageDisplay:     ptrStr("compact"),
		ColorizeUsernames:  ptrStr("true"),
		ChannelDisplayMode: ptrStr("centered"),
		TutorialStep:       ptrStr("3"),
		UseMarkdownPreview: ptrStr("true"),
		UseFormatting:      ptrStr("true"),
		ShowUnreadSection:  ptrStr("true"),
		EmailInterval:      ptrStr("immediately"),
	}
	appErr = th.App.importUser(th.Context, &data, false)
	assert.Nil(t, appErr)

	// Check their values.
	user, appErr = th.App.GetUserByUsername(username)
	require.Nil(t, appErr, "Failed to get user from database.")

	checkPreference(t, th.App, user.Id, model.PreferenceCategoryTheme, "", *data.Theme)
	checkPreference(t, th.App, user.Id, model.PreferenceCategoryDisplaySettings, model.PreferenceNameUseMilitaryTime, *data.UseMilitaryTime)
	checkPreference(t, th.App, user.Id, model.PreferenceCategoryDisplaySettings, model.PreferenceNameCollapseSetting, *data.CollapsePreviews)
	checkPreference(t, th.App, user.Id, model.PreferenceCategoryDisplaySettings, model.PreferenceNameMessageDisplay, *data.MessageDisplay)
	checkPreference(t, th.App, user.Id, model.PreferenceCategoryDisplaySettings, model.PreferenceNameColorizeUsernames, *data.ColorizeUsernames)
	checkPreference(t, th.App, user.Id, model.PreferenceCategoryDisplaySettings, model.PreferenceNameChannelDisplayMode, *data.ChannelDisplayMode)
	checkPreference(t, th.App, user.Id, model.PreferenceCategoryTutorialSteps, user.Id, *data.TutorialStep)
	checkPreference(t, th.App, user.Id, model.PreferenceCategoryAdvancedSettings, "feature_enabled_markdown_preview", *data.UseMarkdownPreview)
	checkPreference(t, th.App, user.Id, model.PreferenceCategoryAdvancedSettings, "formatting", *data.UseFormatting)
	checkPreference(t, th.App, user.Id, model.PreferenceCategorySidebarSettings, "show_unread_section", *data.ShowUnreadSection)
	checkPreference(t, th.App, user.Id, model.PreferenceCategoryNotifications, model.PreferenceNameEmailInterval, "30")

	// Change those preferences.
	data = imports.UserImportData{
		Username:           &username,
		Email:              ptrStr(model.NewId() + "@example.com"),
		Theme:              ptrStr(`{"awayIndicator":"#123456","buttonBg":"#23A2FF","buttonColor":"#FFFFFF","centerChannelBg":"#ffffff","centerChannelColor":"#333333","codeTheme":"github","image":"/static/files/a4a388b38b32678e83823ef1b3e17766.png","linkColor":"#2389d7","mentionBg":"#2389d7","mentionColor":"#ffffff","mentionHighlightBg":"#fff2bb","mentionHighlightLink":"#2f81b7","newMessageSeparator":"#FF8800","onlineIndicator":"#7DBE00","sidebarBg":"#fafafa","sidebarHeaderBg":"#3481B9","sidebarHeaderTextColor":"#ffffff","sidebarText":"#333333","sidebarTextActiveBorder":"#378FD2","sidebarTextActiveColor":"#111111","sidebarTextHoverBg":"#e6f2fa","sidebarUnreadText":"#333333","type":"Mattermost"}`),
		UseMilitaryTime:    ptrStr("false"),
		CollapsePreviews:   ptrStr("false"),
		MessageDisplay:     ptrStr("clean"),
		ColorizeUsernames:  ptrStr("false"),
		ChannelDisplayMode: ptrStr("full"),
		TutorialStep:       ptrStr("2"),
		EmailInterval:      ptrStr("hour"),
	}
	appErr = th.App.importUser(th.Context, &data, false)
	assert.Nil(t, appErr)

	// Check their values again.
	checkPreference(t, th.App, user.Id, model.PreferenceCategoryTheme, "", *data.Theme)
	checkPreference(t, th.App, user.Id, model.PreferenceCategoryDisplaySettings, model.PreferenceNameUseMilitaryTime, *data.UseMilitaryTime)
	checkPreference(t, th.App, user.Id, model.PreferenceCategoryDisplaySettings, model.PreferenceNameCollapseSetting, *data.CollapsePreviews)
	checkPreference(t, th.App, user.Id, model.PreferenceCategoryDisplaySettings, model.PreferenceNameMessageDisplay, *data.MessageDisplay)
	checkPreference(t, th.App, user.Id, model.PreferenceCategoryDisplaySettings, model.PreferenceNameColorizeUsernames, *data.ColorizeUsernames)
	checkPreference(t, th.App, user.Id, model.PreferenceCategoryDisplaySettings, model.PreferenceNameChannelDisplayMode, *data.ChannelDisplayMode)
	checkPreference(t, th.App, user.Id, model.PreferenceCategoryTutorialSteps, user.Id, *data.TutorialStep)
	checkPreference(t, th.App, user.Id, model.PreferenceCategoryNotifications, model.PreferenceNameEmailInterval, "3600")

	// Set Notify Without mention keys
	data.NotifyProps = &imports.UserNotifyPropsImportData{
		Desktop:          ptrStr(model.UserNotifyAll),
		DesktopSound:     ptrStr("true"),
		Email:            ptrStr("true"),
		Mobile:           ptrStr(model.UserNotifyAll),
		MobilePushStatus: ptrStr(model.StatusOnline),
		ChannelTrigger:   ptrStr("true"),
		CommentsTrigger:  ptrStr(model.CommentsNotifyRoot),
	}
	appErr = th.App.importUser(th.Context, &data, false)
	assert.Nil(t, appErr)

	user, appErr = th.App.GetUserByUsername(username)
	require.Nil(t, appErr, "Failed to get user from database.")

	checkNotifyProp(t, user, model.DesktopNotifyProp, model.UserNotifyAll)
	checkNotifyProp(t, user, model.DesktopSoundNotifyProp, "true")
	checkNotifyProp(t, user, model.EmailNotifyProp, "true")
	checkNotifyProp(t, user, model.PushNotifyProp, model.UserNotifyAll)
	checkNotifyProp(t, user, model.PushStatusNotifyProp, model.StatusOnline)
	checkNotifyProp(t, user, model.ChannelMentionsNotifyProp, "true")
	checkNotifyProp(t, user, model.CommentsNotifyProp, model.CommentsNotifyRoot)
	checkNotifyProp(t, user, model.MentionKeysNotifyProp, "")

	// Set Notify Props with Mention keys
	data.NotifyProps = &imports.UserNotifyPropsImportData{
		Desktop:          ptrStr(model.UserNotifyAll),
		DesktopSound:     ptrStr("true"),
		Email:            ptrStr("true"),
		Mobile:           ptrStr(model.UserNotifyAll),
		MobilePushStatus: ptrStr(model.StatusOnline),
		ChannelTrigger:   ptrStr("true"),
		CommentsTrigger:  ptrStr(model.CommentsNotifyRoot),
		MentionKeys:      ptrStr("valid,misc"),
	}
	appErr = th.App.importUser(th.Context, &data, false)
	assert.Nil(t, appErr)

	user, appErr = th.App.GetUserByUsername(username)
	require.Nil(t, appErr, "Failed to get user from database.")

	checkNotifyProp(t, user, model.DesktopNotifyProp, model.UserNotifyAll)
	checkNotifyProp(t, user, model.DesktopSoundNotifyProp, "true")
	checkNotifyProp(t, user, model.EmailNotifyProp, "true")
	checkNotifyProp(t, user, model.PushNotifyProp, model.UserNotifyAll)
	checkNotifyProp(t, user, model.PushStatusNotifyProp, model.StatusOnline)
	checkNotifyProp(t, user, model.ChannelMentionsNotifyProp, "true")
	checkNotifyProp(t, user, model.CommentsNotifyProp, model.CommentsNotifyRoot)
	checkNotifyProp(t, user, model.MentionKeysNotifyProp, "valid,misc")

	// Change Notify Props with mention keys
	data.NotifyProps = &imports.UserNotifyPropsImportData{
		Desktop:          ptrStr(model.UserNotifyMention),
		DesktopSound:     ptrStr("false"),
		Email:            ptrStr("false"),
		Mobile:           ptrStr(model.UserNotifyNone),
		MobilePushStatus: ptrStr(model.StatusAway),
		ChannelTrigger:   ptrStr("false"),
		CommentsTrigger:  ptrStr(model.CommentsNotifyAny),
		MentionKeys:      ptrStr("misc"),
	}
	appErr = th.App.importUser(th.Context, &data, false)
	assert.Nil(t, appErr)

	user, appErr = th.App.GetUserByUsername(username)
	require.Nil(t, appErr, "Failed to get user from database.")

	checkNotifyProp(t, user, model.DesktopNotifyProp, model.UserNotifyMention)
	checkNotifyProp(t, user, model.DesktopSoundNotifyProp, "false")
	checkNotifyProp(t, user, model.EmailNotifyProp, "false")
	checkNotifyProp(t, user, model.PushNotifyProp, model.UserNotifyNone)
	checkNotifyProp(t, user, model.PushStatusNotifyProp, model.StatusAway)
	checkNotifyProp(t, user, model.ChannelMentionsNotifyProp, "false")
	checkNotifyProp(t, user, model.CommentsNotifyProp, model.CommentsNotifyAny)
	checkNotifyProp(t, user, model.MentionKeysNotifyProp, "misc")

	// Change Notify Props without mention keys
	data.NotifyProps = &imports.UserNotifyPropsImportData{
		Desktop:          ptrStr(model.UserNotifyMention),
		DesktopSound:     ptrStr("false"),
		Email:            ptrStr("false"),
		Mobile:           ptrStr(model.UserNotifyNone),
		MobilePushStatus: ptrStr(model.StatusAway),
		ChannelTrigger:   ptrStr("false"),
		CommentsTrigger:  ptrStr(model.CommentsNotifyAny),
	}
	appErr = th.App.importUser(th.Context, &data, false)
	assert.Nil(t, appErr)

	user, appErr = th.App.GetUserByUsername(username)
	require.Nil(t, appErr, "Failed to get user from database.")

	checkNotifyProp(t, user, model.DesktopNotifyProp, model.UserNotifyMention)
	checkNotifyProp(t, user, model.DesktopSoundNotifyProp, "false")
	checkNotifyProp(t, user, model.EmailNotifyProp, "false")
	checkNotifyProp(t, user, model.PushNotifyProp, model.UserNotifyNone)
	checkNotifyProp(t, user, model.PushStatusNotifyProp, model.StatusAway)
	checkNotifyProp(t, user, model.ChannelMentionsNotifyProp, "false")
	checkNotifyProp(t, user, model.CommentsNotifyProp, model.CommentsNotifyAny)
	checkNotifyProp(t, user, model.MentionKeysNotifyProp, "misc")

	// Check Notify Props get set on *create* user.
	username = model.NewId()
	data = imports.UserImportData{
		Username: &username,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}
	data.NotifyProps = &imports.UserNotifyPropsImportData{
		Desktop:          ptrStr(model.UserNotifyMention),
		DesktopSound:     ptrStr("false"),
		Email:            ptrStr("false"),
		Mobile:           ptrStr(model.UserNotifyNone),
		MobilePushStatus: ptrStr(model.StatusAway),
		ChannelTrigger:   ptrStr("false"),
		CommentsTrigger:  ptrStr(model.CommentsNotifyAny),
		MentionKeys:      ptrStr("misc"),
	}

	appErr = th.App.importUser(th.Context, &data, false)
	assert.Nil(t, appErr)

	user, appErr = th.App.GetUserByUsername(username)
	require.Nil(t, appErr, "Failed to get user from database.")

	checkNotifyProp(t, user, model.DesktopNotifyProp, model.UserNotifyMention)
	checkNotifyProp(t, user, model.DesktopSoundNotifyProp, "false")
	checkNotifyProp(t, user, model.EmailNotifyProp, "false")
	checkNotifyProp(t, user, model.PushNotifyProp, model.UserNotifyNone)
	checkNotifyProp(t, user, model.PushStatusNotifyProp, model.StatusAway)
	checkNotifyProp(t, user, model.ChannelMentionsNotifyProp, "false")
	checkNotifyProp(t, user, model.CommentsNotifyProp, model.CommentsNotifyAny)
	checkNotifyProp(t, user, model.MentionKeysNotifyProp, "misc")

	// Test importing a user with roles set to a team and a channel which are affected by an override scheme.
	// The import subsystem should translate `channel_admin/channel_user/team_admin/team_user`
	// to the appropriate scheme-managed-role booleans.

	// Mark the phase 2 permissions migration as completed.
	th.App.Srv().Store.System().Save(&model.System{Name: model.MigrationKeyAdvancedPermissionsPhase2, Value: "true"})

	defer func() {
		th.App.Srv().Store.System().PermanentDeleteByName(model.MigrationKeyAdvancedPermissionsPhase2)
	}()

	teamSchemeData := &imports.SchemeImportData{
		Name:        ptrStr(model.NewId()),
		DisplayName: ptrStr(model.NewId()),
		Scope:       ptrStr("team"),
		DefaultTeamGuestRole: &imports.RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultTeamUserRole: &imports.RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultTeamAdminRole: &imports.RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultChannelGuestRole: &imports.RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultChannelUserRole: &imports.RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultChannelAdminRole: &imports.RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		Description: ptrStr("description"),
	}

	appErr = th.App.importScheme(teamSchemeData, false)
	assert.Nil(t, appErr)

	teamScheme, nErr := th.App.Srv().Store.Scheme().GetByName(*teamSchemeData.Name)
	require.NoError(t, nErr, "Failed to import scheme")

	teamData := &imports.TeamImportData{
		Name:            ptrStr(NewTestId()),
		DisplayName:     ptrStr("Display Name"),
		Type:            ptrStr("O"),
		Description:     ptrStr("The team description."),
		AllowOpenInvite: ptrBool(true),
		Scheme:          &teamScheme.Name,
	}
	appErr = th.App.importTeam(th.Context, teamData, false)
	assert.Nil(t, appErr)
	team, appErr = th.App.GetTeamByName(teamName)
	require.Nil(t, appErr, "Failed to get team from database.")

	channelData := &imports.ChannelImportData{
		Team:        &teamName,
		Name:        ptrStr(NewTestId()),
		DisplayName: ptrStr("Display Name"),
		Type:        &chanTypeOpen,
		Header:      ptrStr("Channel Header"),
		Purpose:     ptrStr("Channel Purpose"),
	}
	appErr = th.App.importChannel(th.Context, channelData, false)
	assert.Nil(t, appErr)
	channel, appErr = th.App.GetChannelByName(th.Context, *channelData.Name, team.Id, false)
	require.Nil(t, appErr, "Failed to get channel from database")

	// Test with a valid team & valid channel name in apply mode.
	userData := &imports.UserImportData{
		Username: &username,
		Email:    ptrStr(model.NewId() + "@example.com"),
		Teams: &[]imports.UserTeamImportData{
			{
				Name:  &team.Name,
				Roles: ptrStr("team_user team_admin"),
				Channels: &[]imports.UserChannelImportData{
					{
						Name:  &channel.Name,
						Roles: ptrStr("channel_admin channel_user"),
					},
				},
			},
		},
	}
	appErr = th.App.importUser(th.Context, userData, false)
	assert.Nil(t, appErr)

	user, appErr = th.App.GetUserByUsername(*userData.Username)
	require.Nil(t, appErr, "Failed to get user from database.")

	teamMember, appErr = th.App.GetTeamMember(team.Id, user.Id)
	require.Nil(t, appErr, "Failed to get the team member")

	assert.True(t, teamMember.SchemeAdmin)
	assert.True(t, teamMember.SchemeUser)
	assert.False(t, teamMember.SchemeGuest)
	assert.Equal(t, "", teamMember.ExplicitRoles)

	channelMember, appErr = th.App.GetChannelMember(th.Context, channel.Id, user.Id)
	require.Nil(t, appErr, "Failed to get the channel member")

	assert.True(t, channelMember.SchemeAdmin)
	assert.True(t, channelMember.SchemeUser)
	assert.False(t, channelMember.SchemeGuest)
	assert.Equal(t, "", channelMember.ExplicitRoles)

	// Test importing deleted user with a valid team & valid channel name in apply mode.
	username = model.NewId()
	deleteAt := model.GetMillis()
	deletedUserData := &imports.UserImportData{
		Username: &username,
		DeleteAt: &deleteAt,
		Email:    ptrStr(model.NewId() + "@example.com"),
		Teams: &[]imports.UserTeamImportData{
			{
				Name:  &team.Name,
				Roles: ptrStr("team_user"),
				Channels: &[]imports.UserChannelImportData{
					{
						Name:  &channel.Name,
						Roles: ptrStr("channel_user"),
					},
				},
			},
		},
	}
	appErr = th.App.importUser(th.Context, deletedUserData, false)
	assert.Nil(t, appErr)

	user, appErr = th.App.GetUserByUsername(*deletedUserData.Username)
	require.Nil(t, appErr, "Failed to get user from database.")

	teamMember, appErr = th.App.GetTeamMember(team.Id, user.Id)
	require.Nil(t, appErr, "Failed to get the team member")

	assert.False(t, teamMember.SchemeAdmin)
	assert.True(t, teamMember.SchemeUser)
	assert.False(t, teamMember.SchemeGuest)
	assert.Equal(t, "", teamMember.ExplicitRoles)

	channelMember, appErr = th.App.GetChannelMember(th.Context, channel.Id, user.Id)
	require.Nil(t, appErr, "Failed to get the channel member")

	assert.False(t, teamMember.SchemeAdmin)
	assert.True(t, channelMember.SchemeUser)
	assert.False(t, teamMember.SchemeGuest)
	assert.Equal(t, "", channelMember.ExplicitRoles)

	// Test importing deleted guest with a valid team & valid channel name in apply mode.
	username = model.NewId()
	deleteAt = model.GetMillis()
	deletedGuestData := &imports.UserImportData{
		Username: &username,
		DeleteAt: &deleteAt,
		Email:    ptrStr(model.NewId() + "@example.com"),
		Teams: &[]imports.UserTeamImportData{
			{
				Name:  &team.Name,
				Roles: ptrStr("team_guest"),
				Channels: &[]imports.UserChannelImportData{
					{
						Name:  &channel.Name,
						Roles: ptrStr("channel_guest"),
					},
				},
			},
		},
	}
	appErr = th.App.importUser(th.Context, deletedGuestData, false)
	assert.Nil(t, appErr)

	user, appErr = th.App.GetUserByUsername(*deletedGuestData.Username)
	require.Nil(t, appErr, "Failed to get user from database.")

	teamMember, appErr = th.App.GetTeamMember(team.Id, user.Id)
	require.Nil(t, appErr, "Failed to get the team member")

	assert.False(t, teamMember.SchemeAdmin)
	assert.False(t, teamMember.SchemeUser)
	assert.True(t, teamMember.SchemeGuest)
	assert.Equal(t, "", teamMember.ExplicitRoles)

	channelMember, appErr = th.App.GetChannelMember(th.Context, channel.Id, user.Id)
	require.Nil(t, appErr, "Failed to get the channel member")

	assert.False(t, teamMember.SchemeAdmin)
	assert.False(t, channelMember.SchemeUser)
	assert.True(t, teamMember.SchemeGuest)
	assert.Equal(t, "", channelMember.ExplicitRoles)
}

func TestImportUserTeams(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	team2 := th.CreateTeam()
	channel2 := th.CreateChannel(th.Context, th.BasicTeam)
	channel3 := th.CreateChannel(th.Context, team2)
	customRole := th.CreateRole("test_custom_role")
	sampleTheme := "{\"test\":\"#abcdef\"}"

	tt := []struct {
		name                  string
		data                  *[]imports.UserTeamImportData
		expectedError         bool
		expectedUserTeams     int
		expectedUserChannels  int
		expectedExplicitRoles string
		expectedRoles         string
		expectedTheme         string
	}{
		{
			name: "Not existing team should fail",
			data: &[]imports.UserTeamImportData{
				{
					Name: model.NewString("not-existing-team-name"),
				},
			},
			expectedError: true,
		},
		{
			name:                 "nil data shouldn't do anything",
			expectedError:        false,
			expectedUserTeams:    0,
			expectedUserChannels: 0,
		},
		{
			name: "Should fail if one of the roles doesn't exists",
			data: &[]imports.UserTeamImportData{
				{
					Name:  &th.BasicTeam.Name,
					Roles: model.NewString("not-existing-role"),
				},
			},
			expectedError:         true,
			expectedUserTeams:     1,
			expectedUserChannels:  0,
			expectedExplicitRoles: "",
			expectedRoles:         "team_user",
		},
		{
			name: "Should success to import explicit role",
			data: &[]imports.UserTeamImportData{
				{
					Name:  &th.BasicTeam.Name,
					Roles: &customRole.Name,
				},
			},
			expectedError:         false,
			expectedUserTeams:     1,
			expectedUserChannels:  1,
			expectedExplicitRoles: customRole.Name,
			expectedRoles:         customRole.Name + " team_user",
		},
		{
			name: "Should success to import admin role",
			data: &[]imports.UserTeamImportData{
				{
					Name:  &th.BasicTeam.Name,
					Roles: model.NewString(model.TeamAdminRoleId),
				},
			},
			expectedError:         false,
			expectedUserTeams:     1,
			expectedUserChannels:  1,
			expectedExplicitRoles: "",
			expectedRoles:         "team_user team_admin",
		},
		{
			name: "Should success to import with theme",
			data: &[]imports.UserTeamImportData{
				{
					Name:  &th.BasicTeam.Name,
					Theme: &sampleTheme,
				},
			},
			expectedError:         false,
			expectedUserTeams:     1,
			expectedUserChannels:  1,
			expectedExplicitRoles: "",
			expectedRoles:         "team_user",
			expectedTheme:         sampleTheme,
		},
		{
			name: "Team without channels must add the default channel",
			data: &[]imports.UserTeamImportData{
				{
					Name: &th.BasicTeam.Name,
				},
			},
			expectedError:         false,
			expectedUserTeams:     1,
			expectedUserChannels:  1,
			expectedExplicitRoles: "",
			expectedRoles:         "team_user",
		},
		{
			name: "Team with default channel must add only the default channel",
			data: &[]imports.UserTeamImportData{
				{
					Name: &th.BasicTeam.Name,
					Channels: &[]imports.UserChannelImportData{
						{
							Name: ptrStr(model.DefaultChannelName),
						},
					},
				},
			},
			expectedError:         false,
			expectedUserTeams:     1,
			expectedUserChannels:  1,
			expectedExplicitRoles: "",
			expectedRoles:         "team_user",
		},
		{
			name: "Team with non default channel must add default channel and the other channel",
			data: &[]imports.UserTeamImportData{
				{
					Name: &th.BasicTeam.Name,
					Channels: &[]imports.UserChannelImportData{
						{
							Name: &th.BasicChannel.Name,
						},
					},
				},
			},
			expectedError:         false,
			expectedUserTeams:     1,
			expectedUserChannels:  2,
			expectedExplicitRoles: "",
			expectedRoles:         "team_user",
		},
		{
			name: "Multiple teams with multiple channels each",
			data: &[]imports.UserTeamImportData{
				{
					Name: &th.BasicTeam.Name,
					Channels: &[]imports.UserChannelImportData{
						{
							Name: &th.BasicChannel.Name,
						},
						{
							Name: &channel2.Name,
						},
					},
				},
				{
					Name: &team2.Name,
					Channels: &[]imports.UserChannelImportData{
						{
							Name: &channel3.Name,
						},
						{
							Name: model.NewString("town-square"),
						},
					},
				},
			},
			expectedError:        false,
			expectedUserTeams:    2,
			expectedUserChannels: 5,
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			user := th.CreateUser()

			// Two times import must end with the same results
			for x := 0; x < 2; x++ {
				err := th.App.importUserTeams(th.Context, user, tc.data)
				if tc.expectedError {
					require.NotNil(t, err)
				} else {
					require.Nil(t, err)
				}
				teamMembers, nErr := th.App.Srv().Store.Team().GetTeamsForUser(context.Background(), user.Id, "", true)
				require.NoError(t, nErr)
				require.Len(t, teamMembers, tc.expectedUserTeams)
				if tc.expectedUserTeams == 1 {
					require.Equal(t, tc.expectedExplicitRoles, teamMembers[0].ExplicitRoles, "Not matching expected explicit roles")
					require.Equal(t, tc.expectedRoles, teamMembers[0].Roles, "not matching expected roles")
					if tc.expectedTheme != "" {
						pref, prefErr := th.App.Srv().Store.Preference().Get(user.Id, model.PreferenceCategoryTheme, teamMembers[0].TeamId)
						require.NoError(t, prefErr)
						require.Equal(t, tc.expectedTheme, pref.Value)
					}
				}

				totalMembers := 0
				for _, teamMember := range teamMembers {
					channelMembers, err := th.App.Srv().Store.Channel().GetMembersForUser(teamMember.TeamId, user.Id)
					require.NoError(t, err)
					totalMembers += len(channelMembers)
				}
				require.Equal(t, tc.expectedUserChannels, totalMembers)
			}
		})
	}

	t.Run("Should fail if the MaxUserPerTeam is reached", func(t *testing.T) {
		user := th.CreateUser()
		data := &[]imports.UserTeamImportData{
			{
				Name: &th.BasicTeam.Name,
			},
		}
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.MaxUsersPerTeam = 1 })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.MaxUsersPerTeam = 100 })
		err := th.App.importUserTeams(th.Context, user, data)
		require.NotNil(t, err)
	})
}

func TestImportUserChannels(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	channel2 := th.CreateChannel(th.Context, th.BasicTeam)
	customRole := th.CreateRole("test_custom_role")
	sampleNotifyProps := imports.UserChannelNotifyPropsImportData{
		Desktop:    model.NewString("all"),
		Mobile:     model.NewString("none"),
		MarkUnread: model.NewString("all"),
	}

	tt := []struct {
		name                  string
		data                  *[]imports.UserChannelImportData
		expectedError         bool
		expectedUserChannels  int
		expectedExplicitRoles string
		expectedRoles         string
		expectedNotifyProps   *imports.UserChannelNotifyPropsImportData
	}{
		{
			name: "Not existing channel should fail",
			data: &[]imports.UserChannelImportData{
				{
					Name: model.NewString("not-existing-channel-name"),
				},
			},
			expectedError: true,
		},
		{
			name:                 "nil data shouldn't do anything",
			expectedError:        false,
			expectedUserChannels: 0,
		},
		{
			name: "Should fail if one of the roles doesn't exists",
			data: &[]imports.UserChannelImportData{
				{
					Name:  &th.BasicChannel.Name,
					Roles: model.NewString("not-existing-role"),
				},
			},
			expectedError:         true,
			expectedUserChannels:  1,
			expectedExplicitRoles: "",
			expectedRoles:         "channel_user",
		},
		{
			name: "Should success to import explicit role",
			data: &[]imports.UserChannelImportData{
				{
					Name:  &th.BasicChannel.Name,
					Roles: &customRole.Name,
				},
			},
			expectedError:         false,
			expectedUserChannels:  1,
			expectedExplicitRoles: customRole.Name,
			expectedRoles:         customRole.Name + " channel_user",
		},
		{
			name: "Should success to import admin role",
			data: &[]imports.UserChannelImportData{
				{
					Name:  &th.BasicChannel.Name,
					Roles: model.NewString(model.ChannelAdminRoleId),
				},
			},
			expectedError:         false,
			expectedUserChannels:  1,
			expectedExplicitRoles: "",
			expectedRoles:         "channel_user channel_admin",
		},
		{
			name: "Should success to import with notifyProps",
			data: &[]imports.UserChannelImportData{
				{
					Name:        &th.BasicChannel.Name,
					NotifyProps: &sampleNotifyProps,
				},
			},
			expectedError:         false,
			expectedUserChannels:  1,
			expectedExplicitRoles: "",
			expectedRoles:         "channel_user",
			expectedNotifyProps:   &sampleNotifyProps,
		},
		{
			name: "Should import properly multiple channels",
			data: &[]imports.UserChannelImportData{
				{
					Name: &th.BasicChannel.Name,
				},
				{
					Name: &channel2.Name,
				},
			},
			expectedError:        false,
			expectedUserChannels: 2,
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			user := th.CreateUser()
			_, _, err := th.App.ch.srv.teamService.JoinUserToTeam(th.BasicTeam, user)
			require.NoError(t, err)

			// Two times import must end with the same results
			for x := 0; x < 2; x++ {
				appErr := th.App.importUserChannels(th.Context, user, th.BasicTeam, tc.data)
				if tc.expectedError {
					require.NotNil(t, appErr)
				} else {
					require.Nil(t, appErr)
				}
				channelMembers, err := th.App.Srv().Store.Channel().GetMembersForUser(th.BasicTeam.Id, user.Id)
				require.NoError(t, err)
				require.Len(t, channelMembers, tc.expectedUserChannels)
				if tc.expectedUserChannels == 1 {
					channelMember := channelMembers[0]
					require.Equal(t, tc.expectedExplicitRoles, channelMember.ExplicitRoles, "Not matching expected explicit roles")
					require.Equal(t, tc.expectedRoles, channelMember.Roles, "not matching expected roles")
					if tc.expectedNotifyProps != nil {
						require.Equal(t, *tc.expectedNotifyProps.Desktop, channelMember.NotifyProps[model.DesktopNotifyProp])
						require.Equal(t, *tc.expectedNotifyProps.Mobile, channelMember.NotifyProps[model.PushNotifyProp])
						require.Equal(t, *tc.expectedNotifyProps.MarkUnread, channelMember.NotifyProps[model.MarkUnreadNotifyProp])
					}
				}
			}
		})
	}
}

func TestImportUserDefaultNotifyProps(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Create a valid new user with some, but not all, notify props populated.
	username := model.NewId()
	data := imports.UserImportData{
		Username: &username,
		Email:    ptrStr(model.NewId() + "@example.com"),
		NotifyProps: &imports.UserNotifyPropsImportData{
			Email:       ptrStr("false"),
			MentionKeys: ptrStr(""),
		},
	}
	require.Nil(t, th.App.importUser(th.Context, &data, false))

	user, err := th.App.GetUserByUsername(username)
	require.Nil(t, err)

	// Check the value of the notify prop we specified explicitly in the import data.
	val, ok := user.NotifyProps[model.EmailNotifyProp]
	assert.True(t, ok)
	assert.Equal(t, "false", val)

	// Check all the other notify props are set to their default values.
	comparisonUser := model.User{Username: user.Username}
	comparisonUser.SetDefaultNotifications()

	for key, expectedValue := range comparisonUser.NotifyProps {
		if key == model.EmailNotifyProp {
			continue
		}

		val, ok := user.NotifyProps[key]
		assert.True(t, ok)
		assert.Equal(t, expectedValue, val)
	}
}

func TestImportimportMultiplePostLines(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Create a Team.
	teamName := model.NewRandomTeamName()
	th.App.importTeam(th.Context, &imports.TeamImportData{
		Name:        &teamName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}, false)
	team, err := th.App.GetTeamByName(teamName)
	require.Nil(t, err, "Failed to get team from database.")

	// Create a Channel.
	channelName := NewTestId()
	chanTypeOpen := model.ChannelTypeOpen
	th.App.importChannel(th.Context, &imports.ChannelImportData{
		Team:        &teamName,
		Name:        &channelName,
		DisplayName: ptrStr("Display Name"),
		Type:        &chanTypeOpen,
	}, false)
	channel, err := th.App.GetChannelByName(th.Context, channelName, team.Id, false)
	require.Nil(t, err, "Failed to get channel from database.")

	// Create a user.
	username := model.NewId()
	th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}, false)
	user, err := th.App.GetUserByUsername(username)
	require.Nil(t, err, "Failed to get user from database.")

	// Count the number of posts in the testing team.
	initialPostCount, nErr := th.App.Srv().Store.Post().AnalyticsPostCount(&model.PostCountOptions{TeamId: team.Id})
	require.NoError(t, nErr)

	// Try adding an invalid post in dry run mode.
	data := imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			Post: &imports.PostImportData{
				Team:    &teamName,
				Channel: &channelName,
				User:    &username,
			},
		},
		LineNumber: 25,
	}
	errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, true)
	assert.NotNil(t, err)
	assert.Equal(t, data.LineNumber, errLine)
	AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)

	// Try adding a valid post in dry run mode.
	data = imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			Post: &imports.PostImportData{
				Team:     &teamName,
				Channel:  &channelName,
				User:     &username,
				Message:  ptrStr("Hello"),
				CreateAt: ptrInt64(model.GetMillis()),
			},
		},
		LineNumber: 1,
	}
	errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, true)
	assert.Nil(t, err)
	assert.Equal(t, 0, errLine)
	AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)

	// Try adding an invalid post in apply mode.
	data = imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			Post: &imports.PostImportData{
				Team:     &teamName,
				Channel:  &channelName,
				User:     &username,
				CreateAt: ptrInt64(model.GetMillis()),
			},
		},
		LineNumber: 35,
	}
	errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
	assert.NotNil(t, err)
	assert.Equal(t, data.LineNumber, errLine)
	AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)

	// Try adding a valid post with invalid team in apply mode.
	data = imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			Post: &imports.PostImportData{
				Team:     ptrStr(NewTestId()),
				Channel:  &channelName,
				User:     &username,
				Message:  ptrStr("Message"),
				CreateAt: ptrInt64(model.GetMillis()),
			},
		},
		LineNumber: 10,
	}
	errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
	assert.NotNil(t, err)
	// Batch will fail when searching for teams, so no specific line
	// is associated with the error
	assert.Equal(t, 0, errLine)
	AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)

	// Try adding a valid post with invalid channel in apply mode.
	data = imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			Post: &imports.PostImportData{
				Team:     &teamName,
				Channel:  ptrStr(NewTestId()),
				User:     &username,
				Message:  ptrStr("Message"),
				CreateAt: ptrInt64(model.GetMillis()),
			},
		},
		LineNumber: 7,
	}
	errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
	assert.NotNil(t, err)
	// Batch will fail when searching for channels, so no specific
	// line is associated with the error
	assert.Equal(t, 0, errLine)
	AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)

	// Try adding a valid post with invalid user in apply mode.
	data = imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			Post: &imports.PostImportData{
				Team:     &teamName,
				Channel:  &channelName,
				User:     ptrStr(model.NewId()),
				Message:  ptrStr("Message"),
				CreateAt: ptrInt64(model.GetMillis()),
			},
		},
		LineNumber: 2,
	}
	errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
	assert.NotNil(t, err)
	// Batch will fail when searching for users, so no specific line
	// is associated with the error
	assert.Equal(t, 0, errLine)
	AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)

	// Try adding a valid post in apply mode.
	time := model.GetMillis()
	data = imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			Post: &imports.PostImportData{
				Team:     &teamName,
				Channel:  &channelName,
				User:     &username,
				Message:  ptrStr("Message"),
				CreateAt: &time,
			},
		},
		LineNumber: 1,
	}
	errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
	assert.Nil(t, err)
	assert.Equal(t, 0, errLine)
	AssertAllPostsCount(t, th.App, initialPostCount, 1, team.Id)

	// Check the post values.
	posts, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(channel.Id, time)
	require.NoError(t, nErr)

	require.Len(t, posts, 1, "Unexpected number of posts found.")

	post := posts[0]
	postBool := post.Message != *data.Post.Message || post.CreateAt != *data.Post.CreateAt || post.UserId != user.Id
	require.False(t, postBool, "Post properties not as expected")

	// Update the post.
	data = imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			Post: &imports.PostImportData{
				Team:     &teamName,
				Channel:  &channelName,
				User:     &username,
				Message:  ptrStr("Message"),
				CreateAt: &time,
			},
		},
		LineNumber: 1,
	}
	errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
	assert.Nil(t, err)
	assert.Equal(t, 0, errLine)
	AssertAllPostsCount(t, th.App, initialPostCount, 1, team.Id)

	// Check the post values.
	posts, nErr = th.App.Srv().Store.Post().GetPostsCreatedAt(channel.Id, time)
	require.NoError(t, nErr)

	require.Len(t, posts, 1, "Unexpected number of posts found.")

	post = posts[0]
	postBool = post.Message != *data.Post.Message || post.CreateAt != *data.Post.CreateAt || post.UserId != user.Id
	require.False(t, postBool, "Post properties not as expected")

	// Save the post with a different time.
	newTime := time + 1
	data = imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			Post: &imports.PostImportData{
				Team:     &teamName,
				Channel:  &channelName,
				User:     &username,
				Message:  ptrStr("Message"),
				CreateAt: &newTime,
			},
		},
		LineNumber: 1,
	}
	errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
	assert.Nil(t, err)
	assert.Equal(t, 0, errLine)
	AssertAllPostsCount(t, th.App, initialPostCount, 2, team.Id)

	// Save the post with a different message.
	data = imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			Post: &imports.PostImportData{
				Team:     &teamName,
				Channel:  &channelName,
				User:     &username,
				Message:  ptrStr("Message 2"),
				CreateAt: &time,
			},
		},
		LineNumber: 1,
	}
	errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
	assert.Nil(t, err)
	assert.Equal(t, 0, errLine)
	AssertAllPostsCount(t, th.App, initialPostCount, 3, team.Id)

	// Test with hashtags
	hashtagTime := time + 2
	data = imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			Post: &imports.PostImportData{
				Team:     &teamName,
				Channel:  &channelName,
				User:     &username,
				Message:  ptrStr("Message 2 #hashtagmashupcity"),
				CreateAt: &hashtagTime,
			},
		},
		LineNumber: 1,
	}
	errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
	assert.Nil(t, err)
	assert.Equal(t, 0, errLine)
	AssertAllPostsCount(t, th.App, initialPostCount, 4, team.Id)

	posts, nErr = th.App.Srv().Store.Post().GetPostsCreatedAt(channel.Id, hashtagTime)
	require.NoError(t, nErr)

	require.Len(t, posts, 1, "Unexpected number of posts found.")

	post = posts[0]
	postBool = post.Message != *data.Post.Message || post.CreateAt != *data.Post.CreateAt || post.UserId != user.Id
	require.False(t, postBool, "Post properties not as expected")

	require.Equal(t, "#hashtagmashupcity", post.Hashtags, "Hashtags not as expected: %s", post.Hashtags)

	// Post with flags.
	username2 := model.NewId()
	th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username2,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}, false)
	user2, err := th.App.GetUserByUsername(username2)
	require.Nil(t, err, "Failed to get user from database.")

	flagsTime := hashtagTime + 1
	data = imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			Post: &imports.PostImportData{
				Team:     &teamName,
				Channel:  &channelName,
				User:     &username,
				Message:  ptrStr("Message with Favorites"),
				CreateAt: &flagsTime,
				FlaggedBy: &[]string{
					username,
					username2,
				},
			},
		},
		LineNumber: 1,
	}

	errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
	assert.Nil(t, err, "Expected success.")
	assert.Equal(t, 0, errLine)

	AssertAllPostsCount(t, th.App, initialPostCount, 5, team.Id)

	// Check the post values.
	posts, nErr = th.App.Srv().Store.Post().GetPostsCreatedAt(channel.Id, flagsTime)
	require.NoError(t, nErr)

	require.Len(t, posts, 1, "Unexpected number of posts found.")

	post = posts[0]
	postBool = post.Message != *data.Post.Message || post.CreateAt != *data.Post.CreateAt || post.UserId != user.Id
	require.False(t, postBool, "Post properties not as expected")

	checkPreference(t, th.App, user.Id, model.PreferenceCategoryFlaggedPost, post.Id, "true")
	checkPreference(t, th.App, user2.Id, model.PreferenceCategoryFlaggedPost, post.Id, "true")

	// Post with reaction.
	reactionPostTime := hashtagTime + 2
	reactionTime := hashtagTime + 3
	data = imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			Post: &imports.PostImportData{
				Team:     &teamName,
				Channel:  &channelName,
				User:     &username,
				Message:  ptrStr("Message with reaction"),
				CreateAt: &reactionPostTime,
				Reactions: &[]imports.ReactionImportData{{
					User:      &user2.Username,
					EmojiName: ptrStr("+1"),
					CreateAt:  &reactionTime,
				}},
			},
		},
		LineNumber: 1,
	}
	errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
	assert.Nil(t, err, "Expected success.")
	assert.Equal(t, 0, errLine)

	AssertAllPostsCount(t, th.App, initialPostCount, 6, team.Id)

	// Check the post values.
	posts, nErr = th.App.Srv().Store.Post().GetPostsCreatedAt(channel.Id, reactionPostTime)
	require.NoError(t, nErr)

	require.Len(t, posts, 1, "Unexpected number of posts found.")

	post = posts[0]
	postBool = post.Message != *data.Post.Message || post.CreateAt != *data.Post.CreateAt || post.UserId != user.Id || !post.HasReactions
	require.False(t, postBool, "Post properties not as expected")

	reactions, nErr := th.App.Srv().Store.Reaction().GetForPost(post.Id, false)
	require.NoError(t, nErr, "Can't get reaction")

	require.Len(t, reactions, 1, "Invalid number of reactions")

	// Post with reply.
	replyPostTime := hashtagTime + 4
	replyTime := hashtagTime + 5
	data = imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			Post: &imports.PostImportData{
				Team:     &teamName,
				Channel:  &channelName,
				User:     &username,
				Message:  ptrStr("Message with reply"),
				CreateAt: &replyPostTime,
				Replies: &[]imports.ReplyImportData{{
					User:     &user2.Username,
					Message:  ptrStr("Message reply"),
					CreateAt: &replyTime,
				}},
			},
		},
		LineNumber: 1,
	}
	errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
	assert.Nil(t, err, "Expected success.")
	assert.Equal(t, 0, errLine)

	AssertAllPostsCount(t, th.App, initialPostCount, 8, team.Id)

	// Check the post values.
	posts, nErr = th.App.Srv().Store.Post().GetPostsCreatedAt(channel.Id, replyPostTime)
	require.NoError(t, nErr)

	require.Len(t, posts, 1, "Unexpected number of posts found.")

	post = posts[0]
	postBool = post.Message != *data.Post.Message || post.CreateAt != *data.Post.CreateAt || post.UserId != user.Id
	require.False(t, postBool, "Post properties not as expected")

	// Check the reply values.
	replies, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(channel.Id, replyTime)
	require.NoError(t, nErr)

	require.Len(t, replies, 1, "Unexpected number of posts found.")

	reply := replies[0]
	replyBool := reply.Message != *(*data.Post.Replies)[0].Message || reply.CreateAt != *(*data.Post.Replies)[0].CreateAt || reply.UserId != user2.Id
	require.False(t, replyBool, "Post properties not as expected")

	require.Equal(t, post.Id, reply.RootId, "Unexpected reply RootId")

	// Update post with replies.
	data = imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			Post: &imports.PostImportData{
				Team:     &teamName,
				Channel:  &channelName,
				User:     &user2.Username,
				Message:  ptrStr("Message with reply"),
				CreateAt: &replyPostTime,
				Replies: &[]imports.ReplyImportData{{
					User:     &username,
					Message:  ptrStr("Message reply"),
					CreateAt: &replyTime,
				}},
			},
		},
		LineNumber: 1,
	}
	errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
	assert.Nil(t, err, "Expected success.")
	assert.Equal(t, 0, errLine)

	AssertAllPostsCount(t, th.App, initialPostCount, 8, team.Id)

	// Create new post with replies based on the previous one.
	data = imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			Post: &imports.PostImportData{
				Team:     &teamName,
				Channel:  &channelName,
				User:     &user2.Username,
				Message:  ptrStr("Message with reply 2"),
				CreateAt: &replyPostTime,
				Replies: &[]imports.ReplyImportData{{
					User:     &username,
					Message:  ptrStr("Message reply"),
					CreateAt: &replyTime,
				}},
			},
		},
		LineNumber: 1,
	}
	errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
	assert.Nil(t, err, "Expected success.")
	assert.Equal(t, 0, errLine)

	AssertAllPostsCount(t, th.App, initialPostCount, 10, team.Id)

	// Create new reply for existing post with replies.
	data = imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			Post: &imports.PostImportData{
				Team:     &teamName,
				Channel:  &channelName,
				User:     &user2.Username,
				Message:  ptrStr("Message with reply"),
				CreateAt: &replyPostTime,
				Replies: &[]imports.ReplyImportData{{
					User:     &username,
					Message:  ptrStr("Message reply 2"),
					CreateAt: &replyTime,
				}},
			},
		},
		LineNumber: 1,
	}
	errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
	assert.Nil(t, err, "Expected success.")
	assert.Equal(t, 0, errLine)

	AssertAllPostsCount(t, th.App, initialPostCount, 11, team.Id)

	// Create new reply with type and edit_at for existing post with replies.

	// Post with reply.
	editedReplyPostTime := hashtagTime + 6
	editedReplyTime := hashtagTime + 7
	editedReplyEditTime := hashtagTime + 8

	data = imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			Post: &imports.PostImportData{
				Team:     &teamName,
				Channel:  &channelName,
				User:     &user2.Username,
				Message:  ptrStr("Message with reply"),
				CreateAt: &editedReplyPostTime,
				Replies: &[]imports.ReplyImportData{{
					User:     &username,
					Type:     ptrStr(model.PostTypeSystemGeneric),
					Message:  ptrStr("Message reply 3"),
					CreateAt: &editedReplyTime,
					EditAt:   &editedReplyEditTime,
				}},
			},
		},
		LineNumber: 1,
	}
	errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
	assert.Nil(t, err, "Expected success.")
	assert.Equal(t, 0, errLine)

	AssertAllPostsCount(t, th.App, initialPostCount, 13, team.Id)

	// Check the reply values.
	replies, nErr = th.App.Srv().Store.Post().GetPostsCreatedAt(channel.Id, editedReplyTime)
	assert.NoError(t, nErr, "Expected success.")
	reply = replies[0]
	importReply := (*data.Post.Replies)[0]
	replyBool = reply.Type != *importReply.Type || reply.Message != *importReply.Message || reply.CreateAt != *importReply.CreateAt || reply.EditAt != *importReply.EditAt || reply.UserId != user.Id
	require.False(t, replyBool, "Post properties not as expected")

	// Create another Team.
	teamName2 := model.NewRandomTeamName()
	th.App.importTeam(th.Context, &imports.TeamImportData{
		Name:        &teamName2,
		DisplayName: ptrStr("Display Name 2"),
		Type:        ptrStr("O"),
	}, false)
	team2, err := th.App.GetTeamByName(teamName2)
	require.Nil(t, err, "Failed to get team from database.")

	// Create another Channel for the another team.
	th.App.importChannel(th.Context, &imports.ChannelImportData{
		Team:        &teamName2,
		Name:        &channelName,
		DisplayName: ptrStr("Display Name"),
		Type:        &chanTypeOpen,
	}, false)
	_, err = th.App.GetChannelByName(th.Context, channelName, team2.Id, false)
	require.Nil(t, err, "Failed to get channel from database.")

	// Count the number of posts in the team2.
	initialPostCountForTeam2, nErr := th.App.Srv().Store.Post().AnalyticsPostCount(&model.PostCountOptions{TeamId: team2.Id})
	require.NoError(t, nErr)

	// Try adding two valid posts in apply mode.
	data = imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			Post: &imports.PostImportData{
				Team:     &teamName,
				Channel:  &channelName,
				User:     &username,
				Message:  ptrStr("another message"),
				CreateAt: &time,
			},
		},
		LineNumber: 1,
	}
	data2 := imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			Post: &imports.PostImportData{
				Team:     &teamName2,
				Channel:  &channelName,
				User:     &username,
				Message:  ptrStr("another message"),
				CreateAt: &time,
			},
		},
		LineNumber: 1,
	}
	errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data, data2}, false)
	assert.Nil(t, err)
	assert.Equal(t, 0, errLine)

	// Create a pinned message.
	data = imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			Post: &imports.PostImportData{
				Team:     &teamName,
				Channel:  &channelName,
				User:     &user2.Username,
				Message:  ptrStr("Pinned Message"),
				CreateAt: ptrInt64(model.GetMillis()),
				IsPinned: ptrBool(true),
			},
		},
		LineNumber: 1,
	}
	errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
	require.Nil(t, err)
	require.Equal(t, 0, errLine)

	resultPosts, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(channel.Id, *data.Post.CreateAt)
	require.NoError(t, nErr, "Expected success.")
	// Should be one post only created at this time.
	require.Equal(t, 1, len(resultPosts))
	resultPost := resultPosts[0]
	require.True(t, resultPost.IsPinned, "This post should be pinned.")

	// Posts should be added to the right team
	AssertAllPostsCount(t, th.App, initialPostCountForTeam2, 1, team2.Id)
	AssertAllPostsCount(t, th.App, initialPostCount, 15, team.Id)
}

func TestImportImportPost(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Create a Team.
	teamName := model.NewRandomTeamName()
	th.App.importTeam(th.Context, &imports.TeamImportData{
		Name:        &teamName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}, false)
	team, appErr := th.App.GetTeamByName(teamName)
	require.Nil(t, appErr, "Failed to get team from database.")

	// Create a Channel.
	channelName := NewTestId()
	chanTypeOpen := model.ChannelTypeOpen
	th.App.importChannel(th.Context, &imports.ChannelImportData{
		Team:        &teamName,
		Name:        &channelName,
		DisplayName: ptrStr("Display Name"),
		Type:        &chanTypeOpen,
	}, false)
	channel, appErr := th.App.GetChannelByName(th.Context, channelName, team.Id, false)
	require.Nil(t, appErr, "Failed to get channel from database.")

	// Create a user.
	username := model.NewId()
	th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}, false)
	user, appErr := th.App.GetUserByUsername(username)
	require.Nil(t, appErr, "Failed to get user from database.")

	username2 := model.NewId()
	th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username2,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}, false)
	user2, appErr := th.App.GetUserByUsername(username2)
	require.Nil(t, appErr, "Failed to get user from database.")

	// Count the number of posts in the testing team.
	initialPostCount, nErr := th.App.Srv().Store.Post().AnalyticsPostCount(&model.PostCountOptions{TeamId: team.Id})
	require.NoError(t, nErr)

	time := model.GetMillis()
	hashtagTime := time + 2
	replyPostTime := hashtagTime + 4
	replyTime := hashtagTime + 5
	posttypeTime := hashtagTime + 6
	editatCreateTime := hashtagTime + 7
	editatEditTime := hashtagTime + 8

	t.Run("Try adding an invalid post in dry run mode", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:    &teamName,
					Channel: &channelName,
					User:    &username,
				},
			},
			LineNumber: 12,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, true)
		assert.NotNil(t, err)
		assert.Equal(t, data.LineNumber, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)
	})

	t.Run("Try adding a valid post in dry run mode", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username,
					Message:  ptrStr("Hello"),
					CreateAt: ptrInt64(model.GetMillis()),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, true)
		assert.Nil(t, err)
		assert.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)
	})

	t.Run("Try adding an invalid post in apply mode", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username,
					CreateAt: ptrInt64(model.GetMillis()),
				},
			},
			LineNumber: 2,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		assert.NotNil(t, err)
		assert.Equal(t, data.LineNumber, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)
	})

	t.Run("Try adding a valid post with invalid team in apply mode", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     ptrStr(NewTestId()),
					Channel:  &channelName,
					User:     &username,
					Message:  ptrStr("Message"),
					CreateAt: ptrInt64(model.GetMillis()),
				},
			},
			LineNumber: 7,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		assert.NotNil(t, err)
		assert.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)
	})

	t.Run("Try adding a valid post with invalid channel in apply mode", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  ptrStr(NewTestId()),
					User:     &username,
					Message:  ptrStr("Message"),
					CreateAt: ptrInt64(model.GetMillis()),
				},
			},
			LineNumber: 8,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		assert.NotNil(t, err)
		assert.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)
	})

	t.Run("Try adding a valid post with invalid user in apply mode", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     ptrStr(model.NewId()),
					Message:  ptrStr("Message"),
					CreateAt: ptrInt64(model.GetMillis()),
				},
			},
			LineNumber: 9,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		assert.NotNil(t, err)
		assert.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)
	})

	t.Run("Try adding a valid post in apply mode", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username,
					Message:  ptrStr("Message"),
					CreateAt: &time,
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		assert.Nil(t, err)
		assert.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 1, team.Id)

		// Check the post values.
		posts, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(channel.Id, time)
		require.NoError(t, nErr)

		require.Len(t, posts, 1, "Unexpected number of posts found.")

		post := posts[0]
		postBool := post.Message != *data.Post.Message || post.CreateAt != *data.Post.CreateAt || post.UserId != user.Id
		require.False(t, postBool, "Post properties not as expected")
	})

	t.Run("Update the post", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username2,
					Message:  ptrStr("Message"),
					CreateAt: &time,
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		assert.Nil(t, err)
		assert.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 1, team.Id)

		// Check the post values.
		posts, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(channel.Id, time)
		require.NoError(t, nErr)

		require.Len(t, posts, 1, "Unexpected number of posts found.")

		post := posts[0]
		postBool := post.Message != *data.Post.Message || post.CreateAt != *data.Post.CreateAt || post.UserId != user2.Id
		require.False(t, postBool, "Post properties not as expected")
	})

	t.Run("Save the post with a different time", func(t *testing.T) {
		newTime := time + 1
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username,
					Message:  ptrStr("Message"),
					CreateAt: &newTime,
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		assert.Nil(t, err)
		assert.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 2, team.Id)
	})

	t.Run("Save the post with a different message", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username,
					Message:  ptrStr("Message 2"),
					CreateAt: &time,
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		assert.Nil(t, err)
		assert.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 3, team.Id)
	})

	t.Run("Test with hashtag", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username,
					Message:  ptrStr("Message 2 #hashtagmashupcity"),
					CreateAt: &hashtagTime,
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		assert.Nil(t, err)
		assert.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 4, team.Id)

		posts, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(channel.Id, hashtagTime)
		require.NoError(t, nErr)

		require.Len(t, posts, 1, "Unexpected number of posts found.")

		post := posts[0]
		postBool := post.Message != *data.Post.Message || post.CreateAt != *data.Post.CreateAt || post.UserId != user.Id
		require.False(t, postBool, "Post properties not as expected")

		require.Equal(t, "#hashtagmashupcity", post.Hashtags, "Hashtags not as expected: %s", post.Hashtags)
	})

	t.Run("Post with flags", func(t *testing.T) {
		flagsTime := hashtagTime + 1
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username,
					Message:  ptrStr("Message with Favorites"),
					CreateAt: &flagsTime,
					FlaggedBy: &[]string{
						username,
						username2,
					},
				},
			},
			LineNumber: 1,
		}

		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 5, team.Id)

		// Check the post values.
		posts, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(channel.Id, flagsTime)
		require.NoError(t, nErr)

		require.Len(t, posts, 1, "Unexpected number of posts found.")

		post := posts[0]
		postBool := post.Message != *data.Post.Message || post.CreateAt != *data.Post.CreateAt || post.UserId != user.Id
		require.False(t, postBool, "Post properties not as expected")

		checkPreference(t, th.App, user.Id, model.PreferenceCategoryFlaggedPost, post.Id, "true")
		checkPreference(t, th.App, user2.Id, model.PreferenceCategoryFlaggedPost, post.Id, "true")
	})

	t.Run("Post with reaction", func(t *testing.T) {
		reactionPostTime := hashtagTime + 2
		reactionTime := hashtagTime + 3
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username,
					Message:  ptrStr("Message with reaction"),
					CreateAt: &reactionPostTime,
					Reactions: &[]imports.ReactionImportData{{
						User:      &user2.Username,
						EmojiName: ptrStr("+1"),
						CreateAt:  &reactionTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 6, team.Id)

		// Check the post values.
		posts, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(channel.Id, reactionPostTime)
		require.NoError(t, nErr)

		require.Len(t, posts, 1, "Unexpected number of posts found.")

		post := posts[0]
		postBool := post.Message != *data.Post.Message || post.CreateAt != *data.Post.CreateAt || post.UserId != user.Id || !post.HasReactions
		require.False(t, postBool, "Post properties not as expected")

		reactions, nErr := th.App.Srv().Store.Reaction().GetForPost(post.Id, false)
		require.NoError(t, nErr, "Can't get reaction")

		require.Len(t, reactions, 1, "Invalid number of reactions")
	})

	t.Run("Post with reply", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username,
					Message:  ptrStr("Message with reply"),
					CreateAt: &replyPostTime,
					Replies: &[]imports.ReplyImportData{{
						User:     &user2.Username,
						Message:  ptrStr("Message reply"),
						CreateAt: &replyTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 8, team.Id)

		// Check the post values.
		posts, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(channel.Id, replyPostTime)
		require.NoError(t, nErr)

		require.Len(t, posts, 1, "Unexpected number of posts found.")

		post := posts[0]
		postBool := post.Message != *data.Post.Message || post.CreateAt != *data.Post.CreateAt || post.UserId != user.Id
		require.False(t, postBool, "Post properties not as expected")

		// Check the reply values.
		replies, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(channel.Id, replyTime)
		require.NoError(t, nErr)

		require.Len(t, replies, 1, "Unexpected number of posts found.")

		reply := replies[0]
		replyBool := reply.Message != *(*data.Post.Replies)[0].Message || reply.CreateAt != *(*data.Post.Replies)[0].CreateAt || reply.UserId != user2.Id
		require.False(t, replyBool, "Post properties not as expected")

		require.Equal(t, post.Id, reply.RootId, "Unexpected reply RootId")
	})

	t.Run("Update post with replies", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &user2.Username,
					Message:  ptrStr("Message with reply"),
					CreateAt: &replyPostTime,
					Replies: &[]imports.ReplyImportData{{
						User:     &username,
						Message:  ptrStr("Message reply"),
						CreateAt: &replyTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 8, team.Id)
	})

	t.Run("Create new post with replies based on the previous one", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &user2.Username,
					Message:  ptrStr("Message with reply 2"),
					CreateAt: &replyPostTime,
					Replies: &[]imports.ReplyImportData{{
						User:     &username,
						Message:  ptrStr("Message reply"),
						CreateAt: &replyTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 10, team.Id)
	})

	t.Run("Create new reply for existing post with replies", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &user2.Username,
					Message:  ptrStr("Message with reply"),
					CreateAt: &replyPostTime,
					Replies: &[]imports.ReplyImportData{{
						User:     &username,
						Message:  ptrStr("Message reply 2"),
						CreateAt: &replyTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 11, team.Id)
	})

	t.Run("Post with Type", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username,
					Type:     ptrStr(model.PostTypeSystemGeneric),
					Message:  ptrStr("Message with Type"),
					CreateAt: &posttypeTime,
				},
			},
			LineNumber: 1,
		}

		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 12, team.Id)

		// Check the post values.
		posts, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(channel.Id, posttypeTime)
		require.NoError(t, nErr)

		require.Len(t, posts, 1, "Unexpected number of posts found.")

		post := posts[0]
		postBool := post.Message != *data.Post.Message || post.CreateAt != *data.Post.CreateAt || post.UserId != user.Id || post.Type != *data.Post.Type
		require.False(t, postBool, "Post properties not as expected")
	})

	t.Run("Post with EditAt", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username,
					Message:  ptrStr("Message with Type"),
					CreateAt: &editatCreateTime,
					EditAt:   &editatEditTime,
				},
			},
			LineNumber: 1,
		}

		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 13, team.Id)

		// Check the post values.
		posts, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(channel.Id, editatCreateTime)
		require.NoError(t, nErr)

		require.Len(t, posts, 1, "Unexpected number of posts found.")

		post := posts[0]
		postBool := post.Message != *data.Post.Message || post.CreateAt != *data.Post.CreateAt || post.UserId != user.Id || post.EditAt != *data.Post.EditAt
		require.False(t, postBool, "Post properties not as expected")
	})

	t.Run("Reply CreateAt before parent post CreateAt", func(t *testing.T) {
		now := model.GetMillis()
		before := now - 10
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &user2.Username,
					Message:  ptrStr("Message with reply"),
					CreateAt: &now,
					Replies: &[]imports.ReplyImportData{{
						User:     &username,
						Message:  ptrStr("Message reply 2"),
						CreateAt: &before,
					}},
				},
			},
			LineNumber: 1,
		}

		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		posts, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(channel.Id, now)
		require.NoError(t, nErr)
		require.Len(t, posts, 2, "Unexpected number of posts found.")
		require.NoError(t, th.TestLogger.Flush())
		testlib.AssertLog(t, th.LogBuffer, mlog.LvlWarn.Name, "Reply CreateAt is before parent post CreateAt, setting it to parent post CreateAt")

		rootPost := posts[0]
		replyPost := posts[1]
		if rootPost.RootId != "" {
			replyPost = posts[0]
			rootPost = posts[1]
		}
		require.Equal(t, rootPost.Id, replyPost.RootId)
		require.Equal(t, now, replyPost.CreateAt)
	})
}

func TestImportImportDirectChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Check how many channels are in the database.
	directChannelCount, err := th.App.Srv().Store.Channel().AnalyticsTypeCount("", model.ChannelTypeDirect)
	require.NoError(t, err, "Failed to get direct channel count.")

	groupChannelCount, err := th.App.Srv().Store.Channel().AnalyticsTypeCount("", model.ChannelTypeGroup)
	require.NoError(t, err, "Failed to get group channel count.")

	// Do an invalid channel in dry-run mode.
	data := imports.DirectChannelImportData{
		Members: &[]string{
			model.NewId(),
		},
		Header: ptrStr("Channel Header"),
	}
	err = th.App.importDirectChannel(th.Context, &data, true)
	require.Error(t, err)

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.ChannelTypeDirect, directChannelCount)
	AssertChannelCount(t, th.App, model.ChannelTypeGroup, groupChannelCount)

	// Do a valid DIRECT channel with a nonexistent member in dry-run mode.
	data.Members = &[]string{
		model.NewId(),
		model.NewId(),
	}
	appErr := th.App.importDirectChannel(th.Context, &data, true)
	require.Nil(t, appErr)

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.ChannelTypeDirect, directChannelCount)
	AssertChannelCount(t, th.App, model.ChannelTypeGroup, groupChannelCount)

	// Do a valid GROUP channel with a nonexistent member in dry-run mode.
	data.Members = &[]string{
		model.NewId(),
		model.NewId(),
		model.NewId(),
	}
	appErr = th.App.importDirectChannel(th.Context, &data, true)
	require.Nil(t, appErr)

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.ChannelTypeDirect, directChannelCount)
	AssertChannelCount(t, th.App, model.ChannelTypeGroup, groupChannelCount)

	// Do an invalid channel in apply mode.
	data.Members = &[]string{
		model.NewId(),
	}
	err = th.App.importDirectChannel(th.Context, &data, false)
	require.Error(t, err)

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.ChannelTypeDirect, directChannelCount)
	AssertChannelCount(t, th.App, model.ChannelTypeGroup, groupChannelCount)

	// Do a valid DIRECT channel.
	data.Members = &[]string{
		th.BasicUser.Username,
		th.BasicUser2.Username,
	}
	appErr = th.App.importDirectChannel(th.Context, &data, false)
	require.Nil(t, appErr)

	// Check that one more DIRECT channel is in the DB.
	AssertChannelCount(t, th.App, model.ChannelTypeDirect, directChannelCount+1)
	AssertChannelCount(t, th.App, model.ChannelTypeGroup, groupChannelCount)

	// Do the same DIRECT channel again.
	appErr = th.App.importDirectChannel(th.Context, &data, false)
	require.Nil(t, appErr)

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.ChannelTypeDirect, directChannelCount+1)
	AssertChannelCount(t, th.App, model.ChannelTypeGroup, groupChannelCount)

	// Update the channel's HEADER
	data.Header = ptrStr("New Channel Header 2")
	appErr = th.App.importDirectChannel(th.Context, &data, false)
	require.Nil(t, appErr)

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.ChannelTypeDirect, directChannelCount+1)
	AssertChannelCount(t, th.App, model.ChannelTypeGroup, groupChannelCount)

	// Get the channel to check that the header was updated.
	channel, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, th.BasicUser2.Id)
	require.Nil(t, appErr)
	require.Equal(t, channel.Header, *data.Header)

	// Do a GROUP channel with an extra invalid member.
	user3 := th.CreateUser()
	data.Members = &[]string{
		th.BasicUser.Username,
		th.BasicUser2.Username,
		user3.Username,
		model.NewId(),
	}
	appErr = th.App.importDirectChannel(th.Context, &data, false)
	require.NotNil(t, appErr)

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.ChannelTypeDirect, directChannelCount+1)
	AssertChannelCount(t, th.App, model.ChannelTypeGroup, groupChannelCount)

	// Do a valid GROUP channel.
	data.Members = &[]string{
		th.BasicUser.Username,
		th.BasicUser2.Username,
		user3.Username,
	}
	appErr = th.App.importDirectChannel(th.Context, &data, false)
	require.Nil(t, appErr)

	// Check that one more GROUP channel is in the DB.
	AssertChannelCount(t, th.App, model.ChannelTypeDirect, directChannelCount+1)
	AssertChannelCount(t, th.App, model.ChannelTypeGroup, groupChannelCount+1)

	// Do the same DIRECT channel again.
	appErr = th.App.importDirectChannel(th.Context, &data, false)
	require.Nil(t, appErr)

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.ChannelTypeDirect, directChannelCount+1)
	AssertChannelCount(t, th.App, model.ChannelTypeGroup, groupChannelCount+1)

	// Update the channel's HEADER
	data.Header = ptrStr("New Channel Header 3")
	appErr = th.App.importDirectChannel(th.Context, &data, false)
	require.Nil(t, appErr)

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.ChannelTypeDirect, directChannelCount+1)
	AssertChannelCount(t, th.App, model.ChannelTypeGroup, groupChannelCount+1)

	// Get the channel to check that the header was updated.
	userIDs := []string{
		th.BasicUser.Id,
		th.BasicUser2.Id,
		user3.Id,
	}
	channel, appErr = th.App.createGroupChannel(th.Context, userIDs)
	require.Equal(t, appErr.Id, store.ChannelExistsError)
	require.Equal(t, channel.Header, *data.Header)

	// Import a channel with some favorites.
	data.Members = &[]string{
		th.BasicUser.Username,
		th.BasicUser2.Username,
	}
	data.FavoritedBy = &[]string{
		th.BasicUser.Username,
		th.BasicUser2.Username,
	}
	appErr = th.App.importDirectChannel(th.Context, &data, false)
	require.Nil(t, appErr)

	channel, appErr = th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, th.BasicUser2.Id)
	require.Nil(t, appErr)
	checkPreference(t, th.App, th.BasicUser.Id, model.PreferenceCategoryFavoriteChannel, channel.Id, "true")
	checkPreference(t, th.App, th.BasicUser2.Id, model.PreferenceCategoryFavoriteChannel, channel.Id, "true")
}

func TestImportImportDirectPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Create the DIRECT channel.
	channelData := imports.DirectChannelImportData{
		Members: &[]string{
			th.BasicUser.Username,
			th.BasicUser2.Username,
		},
	}
	appErr := th.App.importDirectChannel(th.Context, &channelData, false)
	require.Nil(t, appErr)

	// Get the channel.
	var directChannel *model.Channel
	channel, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, th.BasicUser2.Id)
	require.Nil(t, appErr)
	require.NotEmpty(t, channel)
	directChannel = channel

	// Get the number of posts in the system.
	result, err := th.App.Srv().Store.Post().AnalyticsPostCount(&model.PostCountOptions{})
	require.NoError(t, err)
	initialPostCount := result
	initialDate := model.GetMillis()
	posttypeDate := initialDate + 3
	editatCreateDate := initialDate + 4
	editatEditDate := initialDate + 5

	t.Run("Try adding an invalid post in dry run mode", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
					},
					User:     ptrStr(th.BasicUser.Username),
					CreateAt: ptrInt64(model.GetMillis()),
				},
			},
			LineNumber: 7,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, true)
		require.NotNil(t, err)
		require.Equal(t, data.LineNumber, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 0, "")
	})

	t.Run("Try adding a valid post in dry run mode", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
					},
					User:     ptrStr(th.BasicUser.Username),
					Message:  ptrStr("Message"),
					CreateAt: ptrInt64(model.GetMillis()),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, true)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 0, "")
	})

	t.Run("Try adding an invalid post in apply mode", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						model.NewId(),
					},
					User:     ptrStr(th.BasicUser.Username),
					Message:  ptrStr("Message"),
					CreateAt: ptrInt64(model.GetMillis()),
				},
			},
			LineNumber: 9,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.NotNil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 0, "")
	})

	t.Run("Try adding a valid post in apply mode", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
					},
					User:     ptrStr(th.BasicUser.Username),
					Message:  ptrStr("Message"),
					CreateAt: ptrInt64(initialDate),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 1, "")

		// Check the post values.
		posts, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(directChannel.Id, *data.DirectPost.CreateAt)
		require.NoError(t, nErr)
		require.Len(t, posts, 1)

		post := posts[0]
		require.Equal(t, post.Message, *data.DirectPost.Message)
		require.Equal(t, post.CreateAt, *data.DirectPost.CreateAt)
		require.Equal(t, post.UserId, th.BasicUser.Id)
	})

	t.Run("Import the post again", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
					},
					User:     ptrStr(th.BasicUser.Username),
					Message:  ptrStr("Message"),
					CreateAt: ptrInt64(initialDate),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 1, "")

		// Check the post values.
		posts, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(directChannel.Id, *data.DirectPost.CreateAt)
		require.NoError(t, nErr)
		require.Len(t, posts, 1)

		post := posts[0]
		require.Equal(t, post.Message, *data.DirectPost.Message)
		require.Equal(t, post.CreateAt, *data.DirectPost.CreateAt)
		require.Equal(t, post.UserId, th.BasicUser.Id)
	})

	t.Run("Save the post with a different time", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
					},
					User:     ptrStr(th.BasicUser.Username),
					Message:  ptrStr("Message"),
					CreateAt: ptrInt64(initialDate + 1),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 2, "")
	})

	t.Run("Save the post with a different message", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
					},
					User:     ptrStr(th.BasicUser.Username),
					Message:  ptrStr("Message 2"),
					CreateAt: ptrInt64(initialDate + 1),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 3, "")
	})

	t.Run("Test with hashtag", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
					},
					User:     ptrStr(th.BasicUser.Username),
					Message:  ptrStr("Message 2 #hashtagmashupcity"),
					CreateAt: ptrInt64(initialDate + 2),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 4, "")

		posts, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(directChannel.Id, *data.DirectPost.CreateAt)
		require.NoError(t, nErr)
		require.Len(t, posts, 1)

		post := posts[0]
		require.Equal(t, post.Message, *data.DirectPost.Message)
		require.Equal(t, post.CreateAt, *data.DirectPost.CreateAt)
		require.Equal(t, post.UserId, th.BasicUser.Id)
		require.Equal(t, post.Hashtags, "#hashtagmashupcity")
	})

	t.Run("Test with some flags", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
					},
					FlaggedBy: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
					},
					User:     ptrStr(th.BasicUser.Username),
					Message:  ptrStr("Message"),
					CreateAt: ptrInt64(model.GetMillis()),
				},
			},
			LineNumber: 1,
		}

		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 5, "")

		// Check the post values.
		posts, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(directChannel.Id, *data.DirectPost.CreateAt)
		require.NoError(t, nErr)
		require.Len(t, posts, 1)

		post := posts[0]
		checkPreference(t, th.App, th.BasicUser.Id, model.PreferenceCategoryFlaggedPost, post.Id, "true")
		checkPreference(t, th.App, th.BasicUser2.Id, model.PreferenceCategoryFlaggedPost, post.Id, "true")
	})

	t.Run("Test with Type", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
					},
					User:     ptrStr(th.BasicUser.Username),
					Type:     ptrStr(model.PostTypeSystemGeneric),
					Message:  ptrStr("Message with Type"),
					CreateAt: ptrInt64(posttypeDate),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 6, "")

		posts, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(directChannel.Id, *data.DirectPost.CreateAt)
		require.NoError(t, nErr)
		require.Len(t, posts, 1)

		post := posts[0]
		assert.Equal(t, post.Type, *data.DirectPost.Type)
		assert.Equal(t, post.Message, *data.DirectPost.Message)
		assert.Equal(t, post.CreateAt, *data.DirectPost.CreateAt)
		assert.Equal(t, post.UserId, th.BasicUser.Id)
	})

	t.Run("Test with EditAt", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
					},
					User:     ptrStr(th.BasicUser.Username),
					Message:  ptrStr("Message with EditAt"),
					CreateAt: ptrInt64(editatCreateDate),
					EditAt:   ptrInt64(editatEditDate),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 7, "")

		posts, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(directChannel.Id, *data.DirectPost.CreateAt)
		require.NoError(t, nErr)
		require.Len(t, posts, 1)

		post := posts[0]
		assert.Equal(t, post.Message, *data.DirectPost.Message)
		assert.Equal(t, post.CreateAt, *data.DirectPost.CreateAt)
		assert.Equal(t, post.EditAt, *data.DirectPost.EditAt)
		assert.Equal(t, post.UserId, th.BasicUser.Id)
	})

	t.Run("Test with IsPinned", func(t *testing.T) {
		pinnedValue := true
		creationTime := model.GetMillis()
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
					},
					User:     ptrStr(th.BasicUser.Username),
					Message:  ptrStr("Message with EditAt"),
					CreateAt: &creationTime,
					IsPinned: &pinnedValue,
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 8, "")

		posts, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(directChannel.Id, *data.DirectPost.CreateAt)
		require.NoError(t, nErr)
		require.Len(t, posts, 1)

		post := posts[0]
		require.True(t, post.IsPinned)
	})

	// ------------------ Group Channel -------------------------

	// Create the GROUP channel.
	user3 := th.CreateUser()
	channelData = imports.DirectChannelImportData{
		Members: &[]string{
			th.BasicUser.Username,
			th.BasicUser2.Username,
			user3.Username,
		},
	}
	appErr = th.App.importDirectChannel(th.Context, &channelData, false)
	require.Nil(t, appErr)

	// Get the channel.
	var groupChannel *model.Channel
	userIDs := []string{
		th.BasicUser.Id,
		th.BasicUser2.Id,
		user3.Id,
	}
	channel, appErr = th.App.createGroupChannel(th.Context, userIDs)
	require.Equal(t, appErr.Id, store.ChannelExistsError)
	groupChannel = channel

	// Get the number of posts in the system.
	result, nErr := th.App.Srv().Store.Post().AnalyticsPostCount(&model.PostCountOptions{})
	require.NoError(t, nErr)
	initialPostCount = result

	t.Run("Try adding an invalid post in dry run mode", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
						user3.Username,
					},
					User:     ptrStr(th.BasicUser.Username),
					CreateAt: ptrInt64(model.GetMillis()),
				},
			},
			LineNumber: 4,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, true)
		require.NotNil(t, err)
		require.Equal(t, data.LineNumber, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 0, "")
	})

	t.Run("Try adding a valid post in dry run mode", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
						user3.Username,
					},
					User:     ptrStr(th.BasicUser.Username),
					Message:  ptrStr("Message"),
					CreateAt: ptrInt64(model.GetMillis()),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, true)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 0, "")
	})

	t.Run("Try adding an invalid post in apply mode", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
						user3.Username,
						model.NewId(),
					},
					User:     ptrStr(th.BasicUser.Username),
					Message:  ptrStr("Message"),
					CreateAt: ptrInt64(model.GetMillis()),
				},
			},
			LineNumber: 8,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.NotNil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 0, "")
	})

	t.Run("Try adding a valid post in apply mode", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
						user3.Username,
					},
					User:     ptrStr(th.BasicUser.Username),
					Message:  ptrStr("Message"),
					CreateAt: ptrInt64(initialDate + 10),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 1, "")

		// Check the post values.
		posts, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(groupChannel.Id, *data.DirectPost.CreateAt)
		require.NoError(t, nErr)
		require.Len(t, posts, 1)

		post := posts[0]
		require.Equal(t, post.Message, *data.DirectPost.Message)
		require.Equal(t, post.CreateAt, *data.DirectPost.CreateAt)
		require.Equal(t, post.UserId, th.BasicUser.Id)
	})

	t.Run("Import the post again", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
						user3.Username,
					},
					User:     ptrStr(th.BasicUser.Username),
					Message:  ptrStr("Message"),
					CreateAt: ptrInt64(initialDate + 10),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 1, "")

		// Check the post values.
		posts, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(groupChannel.Id, *data.DirectPost.CreateAt)
		require.NoError(t, nErr)
		require.Len(t, posts, 1)

		post := posts[0]
		require.Equal(t, post.Message, *data.DirectPost.Message)
		require.Equal(t, post.CreateAt, *data.DirectPost.CreateAt)
		require.Equal(t, post.UserId, th.BasicUser.Id)
	})

	t.Run("Save the post with a different time", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
						user3.Username,
					},
					User:     ptrStr(th.BasicUser.Username),
					Message:  ptrStr("Message"),
					CreateAt: ptrInt64(initialDate + 11),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 2, "")
	})

	t.Run("Save the post with a different message", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
						user3.Username,
					},
					User:     ptrStr(th.BasicUser.Username),
					Message:  ptrStr("Message 2"),
					CreateAt: ptrInt64(initialDate + 11),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 3, "")
	})

	t.Run("Test with hashtag", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
						user3.Username,
					},
					User:     ptrStr(th.BasicUser.Username),
					Message:  ptrStr("Message 2 #hashtagmashupcity"),
					CreateAt: ptrInt64(initialDate + 12),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 4, "")

		posts, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(groupChannel.Id, *data.DirectPost.CreateAt)
		require.NoError(t, nErr)
		require.Len(t, posts, 1)

		post := posts[0]
		require.Equal(t, post.Message, *data.DirectPost.Message)
		require.Equal(t, post.CreateAt, *data.DirectPost.CreateAt)
		require.Equal(t, post.UserId, th.BasicUser.Id)
		require.Equal(t, post.Hashtags, "#hashtagmashupcity")
	})

	t.Run("Test with some flags", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
						user3.Username,
					},
					FlaggedBy: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
					},
					User:     ptrStr(th.BasicUser.Username),
					Message:  ptrStr("Message"),
					CreateAt: ptrInt64(model.GetMillis()),
				},
			},
			LineNumber: 1,
		}

		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 5, "")

		// Check the post values.
		posts, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(groupChannel.Id, *data.DirectPost.CreateAt)
		require.NoError(t, nErr)
		require.Len(t, posts, 1)

		post := posts[0]
		checkPreference(t, th.App, th.BasicUser.Id, model.PreferenceCategoryFlaggedPost, post.Id, "true")
		checkPreference(t, th.App, th.BasicUser2.Id, model.PreferenceCategoryFlaggedPost, post.Id, "true")
	})

	t.Run("Post with reaction", func(t *testing.T) {
		reactionPostTime := ptrInt64(initialDate + 22)
		reactionTime := ptrInt64(initialDate + 23)
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
						user3.Username,
					},
					User:     ptrStr(th.BasicUser.Username),
					Message:  ptrStr("Message with reaction"),
					CreateAt: reactionPostTime,
					Reactions: &[]imports.ReactionImportData{{
						User:      ptrStr(th.BasicUser2.Username),
						EmojiName: ptrStr("+1"),
						CreateAt:  reactionTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 6, "")

		// Check the post values.
		posts, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(groupChannel.Id, *data.DirectPost.CreateAt)
		require.NoError(t, nErr)

		require.Len(t, posts, 1, "Unexpected number of posts found.")

		post := posts[0]
		postBool := post.Message != *data.DirectPost.Message || post.CreateAt != *data.DirectPost.CreateAt || post.UserId != th.BasicUser.Id || !post.HasReactions
		require.False(t, postBool, "Post properties not as expected")

		reactions, nErr := th.App.Srv().Store.Reaction().GetForPost(post.Id, false)
		require.NoError(t, nErr, "Can't get reaction")

		require.Len(t, reactions, 1, "Invalid number of reactions")
	})

	t.Run("Post with reply", func(t *testing.T) {
		replyPostTime := ptrInt64(initialDate + 25)
		replyTime := ptrInt64(initialDate + 26)
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
						user3.Username,
					},
					User:     ptrStr(th.BasicUser.Username),
					Message:  ptrStr("Message with reply"),
					CreateAt: replyPostTime,
					Replies: &[]imports.ReplyImportData{{
						User:     ptrStr(th.BasicUser2.Username),
						Message:  ptrStr("Message reply"),
						CreateAt: replyTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 8, "")

		// Check the post values.
		posts, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(groupChannel.Id, *data.DirectPost.CreateAt)
		require.NoError(t, nErr)

		require.Len(t, posts, 1, "Unexpected number of posts found.")

		post := posts[0]
		postBool := post.Message != *data.DirectPost.Message || post.CreateAt != *data.DirectPost.CreateAt || post.UserId != th.BasicUser.Id
		require.False(t, postBool, "Post properties not as expected")

		// Check the reply values.
		replies, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(channel.Id, *replyTime)
		require.NoError(t, nErr)

		require.Len(t, replies, 1, "Unexpected number of posts found.")

		reply := replies[0]
		replyBool := reply.Message != *(*data.DirectPost.Replies)[0].Message || reply.CreateAt != *(*data.DirectPost.Replies)[0].CreateAt || reply.UserId != th.BasicUser2.Id
		require.False(t, replyBool, "Post properties not as expected")

		require.Equal(t, post.Id, reply.RootId, "Unexpected reply RootId")
	})

	t.Run("Update post with replies", func(t *testing.T) {
		replyPostTime := ptrInt64(initialDate + 25)
		replyTime := ptrInt64(initialDate + 26)
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
						user3.Username,
					},
					User:     ptrStr(th.BasicUser2.Username),
					Message:  ptrStr("Message with reply"),
					CreateAt: replyPostTime,
					Replies: &[]imports.ReplyImportData{{
						User:     ptrStr(th.BasicUser.Username),
						Message:  ptrStr("Message reply"),
						CreateAt: replyTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 8, "")
	})

	t.Run("Create new post with replies based on the previous one", func(t *testing.T) {
		replyPostTime := ptrInt64(initialDate + 27)
		replyTime := ptrInt64(initialDate + 28)
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
						user3.Username,
					},
					User:     ptrStr(th.BasicUser2.Username),
					Message:  ptrStr("Message with reply 2"),
					CreateAt: replyPostTime,
					Replies: &[]imports.ReplyImportData{{
						User:     ptrStr(th.BasicUser.Username),
						Message:  ptrStr("Message reply"),
						CreateAt: replyTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 10, "")
	})

	t.Run("Post with reply having non-empty type and edit_at", func(t *testing.T) {
		replyPostTime := ptrInt64(initialDate + 29)
		replyTime := ptrInt64(initialDate + 30)
		replyEditTime := ptrInt64(initialDate + 31)
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
						user3.Username,
					},
					User:     ptrStr(th.BasicUser2.Username),
					Message:  ptrStr("Message with reply"),
					CreateAt: replyPostTime,
					Replies: &[]imports.ReplyImportData{{
						User:     ptrStr(th.BasicUser.Username),
						Type:     ptrStr(model.PostTypeSystemGeneric),
						Message:  ptrStr("Message reply 2"),
						CreateAt: replyTime,
						EditAt:   replyEditTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 12, "")

		// Check the reply values.
		replies, nErr := th.App.Srv().Store.Post().GetPostsCreatedAt(channel.Id, *replyTime)
		require.NoError(t, nErr)

		require.Len(t, replies, 1, "Unexpected number of posts found.")

		reply := replies[0]
		importReply := (*data.DirectPost.Replies)[0]
		replyBool := reply.Type != *importReply.Type || reply.Message != *importReply.Message || reply.CreateAt != *importReply.CreateAt || reply.EditAt != *importReply.EditAt || reply.UserId != th.BasicUser.Id
		require.False(t, replyBool, "Post properties not as expected")
	})
}

func TestImportImportEmoji(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = true })

	testsDir, _ := fileutils.FindDir("tests")
	testImage := filepath.Join(testsDir, "test.png")

	data := imports.EmojiImportData{Name: ptrStr(model.NewId())}
	appErr := th.App.importEmoji(&data, true)
	assert.NotNil(t, appErr, "Invalid emoji should have failed dry run")

	emoji, nErr := th.App.Srv().Store.Emoji().GetByName(context.Background(), *data.Name, true)
	assert.Nil(t, emoji, "Emoji should not have been imported")
	assert.Error(t, nErr)

	data.Image = ptrStr(testImage)
	appErr = th.App.importEmoji(&data, true)
	assert.Nil(t, appErr, "Valid emoji should have passed dry run")

	data = imports.EmojiImportData{Name: ptrStr(model.NewId())}
	appErr = th.App.importEmoji(&data, false)
	assert.NotNil(t, appErr, "Invalid emoji should have failed apply mode")

	data.Image = ptrStr("non-existent-file")
	appErr = th.App.importEmoji(&data, false)
	assert.NotNil(t, appErr, "Emoji with bad image file should have failed apply mode")

	data.Image = ptrStr(testImage)
	appErr = th.App.importEmoji(&data, false)
	assert.Nil(t, appErr, "Valid emoji should have succeeded apply mode")

	emoji, nErr = th.App.Srv().Store.Emoji().GetByName(context.Background(), *data.Name, true)
	assert.NotNil(t, emoji, "Emoji should have been imported")
	assert.NoError(t, nErr, "Emoji should have been imported without any error")

	appErr = th.App.importEmoji(&data, false)
	assert.Nil(t, appErr, "Second run should have succeeded apply mode")

	data = imports.EmojiImportData{Name: ptrStr("smiley"), Image: ptrStr(testImage)}
	appErr = th.App.importEmoji(&data, false)
	assert.Nil(t, appErr, "System emoji should not fail")

	largeImage := filepath.Join(testsDir, "large_image_file.jpg")
	data = imports.EmojiImportData{Name: ptrStr(model.NewId()), Image: ptrStr(largeImage)}
	appErr = th.App.importEmoji(&data, false)
	require.NotNil(t, appErr)
	require.ErrorIs(t, appErr.Unwrap(), utils.SizeLimitExceeded)
}

func TestImportAttachment(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	testsDir, _ := fileutils.FindDir("tests")
	testImage := filepath.Join(testsDir, "test.png")
	invalidPath := "some-invalid-path"

	userID := model.NewId()
	data := imports.AttachmentImportData{Path: &testImage}
	_, err := th.App.importAttachment(th.Context, &data, &model.Post{UserId: userID, ChannelId: "some-channel"}, "some-team")
	assert.Nil(t, err, "sample run without errors")

	attachments := GetAttachments(userID, th, t)
	assert.Len(t, attachments, 1)

	data = imports.AttachmentImportData{Path: &invalidPath}
	_, err = th.App.importAttachment(th.Context, &data, &model.Post{UserId: model.NewId(), ChannelId: "some-channel"}, "some-team")
	assert.NotNil(t, err, "should have failed when opening the file")
	assert.Equal(t, err.Id, "app.import.attachment.bad_file.error")
}

func TestImportPostAndRepliesWithAttachments(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Create a Team.
	teamName := model.NewRandomTeamName()
	th.App.importTeam(th.Context, &imports.TeamImportData{
		Name:        &teamName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}, false)
	team, appErr := th.App.GetTeamByName(teamName)
	require.Nil(t, appErr, "Failed to get team from database.")

	// Create a Channel.
	channelName := NewTestId()
	chanTypeOpen := model.ChannelTypeOpen
	th.App.importChannel(th.Context, &imports.ChannelImportData{
		Team:        &teamName,
		Name:        &channelName,
		DisplayName: ptrStr("Display Name"),
		Type:        &chanTypeOpen,
	}, false)
	_, appErr = th.App.GetChannelByName(th.Context, channelName, team.Id, false)
	require.Nil(t, appErr, "Failed to get channel from database.")

	// Create a user3.
	username := model.NewId()
	th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}, false)
	user3, appErr := th.App.GetUserByUsername(username)
	require.Nil(t, appErr, "Failed to get user3 from database.")
	require.NotNil(t, user3)

	username2 := model.NewId()
	th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username2,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}, false)
	user2, appErr := th.App.GetUserByUsername(username2)
	require.Nil(t, appErr, "Failed to get user3 from database.")

	// Create direct post users.
	username3 := model.NewId()
	th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username3,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}, false)
	user3, appErr = th.App.GetUserByUsername(username3)
	require.Nil(t, appErr, "Failed to get user3 from database.")

	username4 := model.NewId()
	th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username4,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}, false)

	user4, appErr := th.App.GetUserByUsername(username4)
	require.Nil(t, appErr, "Failed to get user3 from database.")

	// Post with attachments
	time := model.GetMillis()
	attachmentsPostTime := time
	attachmentsReplyTime := time + 1
	testsDir, _ := fileutils.FindDir("tests")
	testImage := filepath.Join(testsDir, "test.png")
	testMarkDown := filepath.Join(testsDir, "test-attachments.md")
	data := imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			Post: &imports.PostImportData{
				Team:        &teamName,
				Channel:     &channelName,
				User:        &username3,
				Message:     ptrStr("Message with reply"),
				CreateAt:    &attachmentsPostTime,
				Attachments: &[]imports.AttachmentImportData{{Path: &testImage}, {Path: &testMarkDown}},
				Replies: &[]imports.ReplyImportData{{
					User:        &user4.Username,
					Message:     ptrStr("Message reply"),
					CreateAt:    &attachmentsReplyTime,
					Attachments: &[]imports.AttachmentImportData{{Path: &testImage}},
				}},
			},
		},
		LineNumber: 19,
	}

	t.Run("import with attachment", func(t *testing.T) {
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)

		attachments := GetAttachments(user3.Id, th, t)
		require.Len(t, attachments, 2)
		assert.Contains(t, attachments[0].Path, team.Id)
		assert.Contains(t, attachments[1].Path, team.Id)
		AssertFileIdsInPost(attachments, th, t)

		attachments = GetAttachments(user4.Id, th, t)
		require.Len(t, attachments, 1)
		assert.Contains(t, attachments[0].Path, team.Id)
		AssertFileIdsInPost(attachments, th, t)
	})

	t.Run("import existing post with new attachment", func(t *testing.T) {
		data.Post.Attachments = &[]imports.AttachmentImportData{{Path: &testImage}}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)

		attachments := GetAttachments(user3.Id, th, t)
		require.Len(t, attachments, 1)
		assert.Contains(t, attachments[0].Path, team.Id)
		AssertFileIdsInPost(attachments, th, t)

		attachments = GetAttachments(user4.Id, th, t)
		require.Len(t, attachments, 1)
		assert.Contains(t, attachments[0].Path, team.Id)
		AssertFileIdsInPost(attachments, th, t)
	})

	t.Run("Reply with Attachments in Direct Post", func(t *testing.T) {
		directImportData := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						user3.Username,
						user2.Username,
					},
					User:     &user3.Username,
					Message:  ptrStr("Message with Replies"),
					CreateAt: ptrInt64(model.GetMillis()),
					Replies: &[]imports.ReplyImportData{{
						User:        &user2.Username,
						Message:     ptrStr("Message reply with attachment"),
						CreateAt:    ptrInt64(model.GetMillis()),
						Attachments: &[]imports.AttachmentImportData{{Path: &testImage}},
					}},
				},
			},
			LineNumber: 7,
		}

		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{directImportData}, false)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		attachments := GetAttachments(user2.Id, th, t)
		require.Len(t, attachments, 1)
		assert.Contains(t, attachments[0].Path, "noteam")
		AssertFileIdsInPost(attachments, th, t)
	})
}

func TestImportDirectPostWithAttachments(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	testsDir, _ := fileutils.FindDir("tests")
	testImage := filepath.Join(testsDir, "test.png")
	testImage2 := filepath.Join(testsDir, "test.svg")
	// create a temp file with same name as original but with a different first byte
	tmpFolder, _ := os.MkdirTemp("", "imgFake")
	testImageFake := filepath.Join(tmpFolder, "test.png")
	fakeFileData, _ := os.ReadFile(testImage)
	fakeFileData[0] = 0
	_ = os.WriteFile(testImageFake, fakeFileData, 0644)
	defer os.RemoveAll(tmpFolder)

	// Create a user.
	username := model.NewId()
	th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}, false)
	user1, appErr := th.App.GetUserByUsername(username)
	require.Nil(t, appErr, "Failed to get user1 from database.")

	username2 := model.NewId()
	th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username2,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}, false)

	user2, appErr := th.App.GetUserByUsername(username2)
	require.Nil(t, appErr, "Failed to get user2 from database.")

	directImportData := imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			DirectPost: &imports.DirectPostImportData{
				ChannelMembers: &[]string{
					user1.Username,
					user2.Username,
				},
				User:        &user1.Username,
				Message:     ptrStr("Direct message"),
				CreateAt:    ptrInt64(model.GetMillis()),
				Attachments: &[]imports.AttachmentImportData{{Path: &testImage}},
			},
		},
		LineNumber: 3,
	}

	t.Run("Regular import of attachment", func(t *testing.T) {
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{directImportData}, false)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		attachments := GetAttachments(user1.Id, th, t)
		require.Len(t, attachments, 1)
		assert.Contains(t, attachments[0].Path, "noteam")
		AssertFileIdsInPost(attachments, th, t)
	})

	t.Run("Attempt to import again with same file entirely, should NOT add an attachment", func(t *testing.T) {
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{directImportData}, false)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		attachments := GetAttachments(user1.Id, th, t)
		require.Len(t, attachments, 1)
	})

	t.Run("Attempt to import again with same name and size but different content, SHOULD add an attachment", func(t *testing.T) {
		directImportDataFake := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						user1.Username,
						user2.Username,
					},
					User:        &user1.Username,
					Message:     ptrStr("Direct message"),
					CreateAt:    ptrInt64(model.GetMillis()),
					Attachments: &[]imports.AttachmentImportData{{Path: &testImageFake}},
				},
			},
			LineNumber: 2,
		}

		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{directImportDataFake}, false)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		attachments := GetAttachments(user1.Id, th, t)
		require.Len(t, attachments, 2)
	})

	t.Run("Attempt to import again with same data, SHOULD add an attachment, since it's different name", func(t *testing.T) {
		directImportData2 := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						user1.Username,
						user2.Username,
					},
					User:        &user1.Username,
					Message:     ptrStr("Direct message"),
					CreateAt:    ptrInt64(model.GetMillis()),
					Attachments: &[]imports.AttachmentImportData{{Path: &testImage2}},
				},
			},
			LineNumber: 2,
		}

		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{directImportData2}, false)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		attachments := GetAttachments(user1.Id, th, t)
		require.Len(t, attachments, 3)
	})
}

func TestZippedImportPostAndRepliesWithAttachments(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Create a Team.
	teamName := model.NewRandomTeamName()
	th.App.importTeam(th.Context, &imports.TeamImportData{
		Name:        &teamName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}, false)
	team, appErr := th.App.GetTeamByName(teamName)
	require.Nil(t, appErr, "Failed to get team from database.")

	// Create a Channel.
	channelName := NewTestId()
	chanTypeOpen := model.ChannelTypeOpen
	th.App.importChannel(th.Context, &imports.ChannelImportData{
		Team:        &teamName,
		Name:        &channelName,
		DisplayName: ptrStr("Display Name"),
		Type:        &chanTypeOpen,
	}, false)
	_, appErr = th.App.GetChannelByName(th.Context, channelName, team.Id, false)
	require.Nil(t, appErr, "Failed to get channel from database.")

	// Create users
	username2 := model.NewId()
	th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username2,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}, false)
	user2, appErr := th.App.GetUserByUsername(username2)
	require.Nil(t, appErr, "Failed to get user3 from database.")

	// Create direct post users.
	username3 := model.NewId()
	th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username3,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}, false)
	user3, appErr := th.App.GetUserByUsername(username3)
	require.Nil(t, appErr, "Failed to get user3 from database.")

	username4 := model.NewId()
	th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username4,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}, false)

	user4, appErr := th.App.GetUserByUsername(username4)
	require.Nil(t, appErr, "Failed to get user3 from database.")

	// Post with attachments
	time := model.GetMillis()
	attachmentsPostTime := time
	attachmentsReplyTime := time + 1
	testsDir, _ := fileutils.FindDir("tests")
	testImage := filepath.Join(testsDir, "test.png")
	testZipFileName := filepath.Join(testsDir, "import_test.zip")
	testZip, _ := os.Open(testZipFileName)

	fi, err := testZip.Stat()
	require.NoError(t, err, "failed to get file info")
	testZipReader, err := zip.NewReader(testZip, fi.Size())
	require.NoError(t, err, "failed to read test zip")

	require.NotEmpty(t, testZipReader.File)
	imageData := testZipReader.File[0]
	require.NoError(t, err, "failed to copy test Image file into zip")

	testMarkDown := filepath.Join(testsDir, "test-attachments.md")
	data := imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			Post: &imports.PostImportData{
				Team:        &teamName,
				Channel:     &channelName,
				User:        &username3,
				Message:     ptrStr("Message with reply"),
				CreateAt:    &attachmentsPostTime,
				Attachments: &[]imports.AttachmentImportData{{Path: &testImage}, {Path: &testMarkDown}},
				Replies: &[]imports.ReplyImportData{{
					User:        &user4.Username,
					Message:     ptrStr("Message reply"),
					CreateAt:    &attachmentsReplyTime,
					Attachments: &[]imports.AttachmentImportData{{Path: &testImage, Data: imageData}},
				}},
			},
		},
		LineNumber: 19,
	}

	t.Run("import with attachment", func(t *testing.T) {
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)

		attachments := GetAttachments(user3.Id, th, t)
		require.Len(t, attachments, 2)
		assert.Contains(t, attachments[0].Path, team.Id)
		assert.Contains(t, attachments[1].Path, team.Id)
		AssertFileIdsInPost(attachments, th, t)

		attachments = GetAttachments(user4.Id, th, t)
		require.Len(t, attachments, 1)
		assert.Contains(t, attachments[0].Path, team.Id)
		AssertFileIdsInPost(attachments, th, t)
	})

	t.Run("import existing post with new attachment", func(t *testing.T) {
		data.Post.Attachments = &[]imports.AttachmentImportData{{Path: &testImage}}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)

		attachments := GetAttachments(user3.Id, th, t)
		require.Len(t, attachments, 1)
		assert.Contains(t, attachments[0].Path, team.Id)
		AssertFileIdsInPost(attachments, th, t)

		attachments = GetAttachments(user4.Id, th, t)
		require.Len(t, attachments, 1)
		assert.Contains(t, attachments[0].Path, team.Id)
		AssertFileIdsInPost(attachments, th, t)
	})

	t.Run("Reply with Attachments in Direct Post", func(t *testing.T) {
		directImportData := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						user3.Username,
						user2.Username,
					},
					User:     &user3.Username,
					Message:  ptrStr("Message with Replies"),
					CreateAt: ptrInt64(model.GetMillis()),
					Replies: &[]imports.ReplyImportData{{
						User:        &user2.Username,
						Message:     ptrStr("Message reply with attachment"),
						CreateAt:    ptrInt64(model.GetMillis()),
						Attachments: &[]imports.AttachmentImportData{{Path: &testImage}},
					}},
				},
			},
			LineNumber: 7,
		}

		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{directImportData}, false)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		attachments := GetAttachments(user2.Id, th, t)
		require.Len(t, attachments, 1)
		assert.Contains(t, attachments[0].Path, "noteam")
		AssertFileIdsInPost(attachments, th, t)
	})
}
