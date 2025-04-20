// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"archive/zip"
	"context"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app/imports"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

func TestImportImportScheme(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Mark the phase 2 permissions migration as completed.
	err := th.App.Srv().Store().System().Save(&model.System{Name: model.MigrationKeyAdvancedPermissionsPhase2, Value: "true"})
	require.NoError(t, err, "Failed to save system value.")

	defer func() {
		_, err = th.App.Srv().Store().System().PermanentDeleteByName(model.MigrationKeyAdvancedPermissionsPhase2)
		require.NoError(t, err, "Failed to delete system value.")
	}()

	// Try importing an invalid scheme in dryRun mode.
	data := imports.SchemeImportData{
		Name:  model.NewPointer(model.NewId()),
		Scope: model.NewPointer("team"),
		DefaultTeamGuestRole: &imports.RoleImportData{
			Name:        model.NewPointer(model.NewId()),
			DisplayName: model.NewPointer(model.NewId()),
		},
		DefaultTeamUserRole: &imports.RoleImportData{
			Name:        model.NewPointer(model.NewId()),
			DisplayName: model.NewPointer(model.NewId()),
		},
		DefaultTeamAdminRole: &imports.RoleImportData{
			Name:        model.NewPointer(model.NewId()),
			DisplayName: model.NewPointer(model.NewId()),
		},
		DefaultChannelGuestRole: &imports.RoleImportData{
			Name:        model.NewPointer(model.NewId()),
			DisplayName: model.NewPointer(model.NewId()),
		},
		DefaultChannelUserRole: &imports.RoleImportData{
			Name:        model.NewPointer(model.NewId()),
			DisplayName: model.NewPointer(model.NewId()),
		},
		DefaultChannelAdminRole: &imports.RoleImportData{
			Name:        model.NewPointer(model.NewId()),
			DisplayName: model.NewPointer(model.NewId()),
		},
		Description: model.NewPointer("description"),
	}

	appErr := th.App.importScheme(th.Context, &data, true)
	require.NotNil(t, appErr, "Should have failed to import.")

	_, err = th.App.Srv().Store().Scheme().GetByName(*data.Name)
	require.Error(t, err, "Scheme should not have imported.")

	// Try importing a valid scheme in dryRun mode.
	data.DisplayName = model.NewPointer("display name")

	appErr = th.App.importScheme(th.Context, &data, true)
	require.Nil(t, appErr, "Should have succeeded.")

	_, err = th.App.Srv().Store().Scheme().GetByName(*data.Name)
	require.Error(t, err, "Scheme should not have imported.")

	// Try importing an invalid scheme.
	data.DisplayName = nil

	appErr = th.App.importScheme(th.Context, &data, false)
	require.NotNil(t, appErr, "Should have failed to import.")

	_, err = th.App.Srv().Store().Scheme().GetByName(*data.Name)
	require.Error(t, err, "Scheme should not have imported.")

	// Try importing a valid scheme with all params set.
	data.DisplayName = model.NewPointer("display name")

	appErr = th.App.importScheme(th.Context, &data, false)
	require.Nil(t, appErr, "Should have succeeded.")

	scheme, nErr := th.App.Srv().Store().Scheme().GetByName(*data.Name)
	require.NoError(t, nErr, "Failed to import scheme: %v", err)

	assert.Equal(t, *data.Name, scheme.Name)
	assert.Equal(t, *data.DisplayName, scheme.DisplayName)
	assert.Equal(t, *data.Description, scheme.Description)
	assert.Equal(t, *data.Scope, scheme.Scope)

	role, nErr := th.App.Srv().Store().Role().GetByName(context.Background(), scheme.DefaultTeamAdminRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamAdminRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store().Role().GetByName(context.Background(), scheme.DefaultTeamUserRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamUserRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store().Role().GetByName(context.Background(), scheme.DefaultTeamGuestRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamGuestRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store().Role().GetByName(context.Background(), scheme.DefaultChannelAdminRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelAdminRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store().Role().GetByName(context.Background(), scheme.DefaultChannelUserRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelUserRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store().Role().GetByName(context.Background(), scheme.DefaultChannelGuestRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelGuestRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	// Try modifying all the fields and re-importing.
	data.DisplayName = model.NewPointer("new display name")
	data.Description = model.NewPointer("new description")

	appErr = th.App.importScheme(th.Context, &data, false)
	require.Nil(t, appErr, "Should have succeeded: %v", err)

	scheme, nErr = th.App.Srv().Store().Scheme().GetByName(*data.Name)
	require.NoError(t, nErr, "Failed to import scheme: %v", err)

	assert.Equal(t, *data.Name, scheme.Name)
	assert.Equal(t, *data.DisplayName, scheme.DisplayName)
	assert.Equal(t, *data.Description, scheme.Description)
	assert.Equal(t, *data.Scope, scheme.Scope)

	role, nErr = th.App.Srv().Store().Role().GetByName(context.Background(), scheme.DefaultTeamAdminRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamAdminRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store().Role().GetByName(context.Background(), scheme.DefaultTeamUserRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamUserRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store().Role().GetByName(context.Background(), scheme.DefaultTeamGuestRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamGuestRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store().Role().GetByName(context.Background(), scheme.DefaultChannelAdminRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelAdminRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store().Role().GetByName(context.Background(), scheme.DefaultChannelUserRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelUserRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, nErr = th.App.Srv().Store().Role().GetByName(context.Background(), scheme.DefaultChannelGuestRole)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelGuestRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	// Try changing the scope of the scheme and reimporting.
	data.Scope = model.NewPointer("channel")

	appErr = th.App.importScheme(th.Context, &data, false)
	require.NotNil(t, appErr, "Should have failed to import.")

	scheme, nErr = th.App.Srv().Store().Scheme().GetByName(*data.Name)
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
	err := th.App.Srv().Store().System().Save(&model.System{Name: model.MigrationKeyAdvancedPermissionsPhase2, Value: "true"})
	require.NoError(t, err, "Failed to save system value.")

	defer func() {
		_, err = th.App.Srv().Store().System().PermanentDeleteByName(model.MigrationKeyAdvancedPermissionsPhase2)
		require.NoError(t, err, "Failed to delete system value.")
	}()

	// Try importing an invalid scheme in dryRun mode.
	data := imports.SchemeImportData{
		Name:  model.NewPointer(model.NewId()),
		Scope: model.NewPointer("team"),
		DefaultTeamUserRole: &imports.RoleImportData{
			Name:        model.NewPointer(model.NewId()),
			DisplayName: model.NewPointer(model.NewId()),
		},
		DefaultTeamAdminRole: &imports.RoleImportData{
			Name:        model.NewPointer(model.NewId()),
			DisplayName: model.NewPointer(model.NewId()),
		},
		DefaultChannelUserRole: &imports.RoleImportData{
			Name:        model.NewPointer(model.NewId()),
			DisplayName: model.NewPointer(model.NewId()),
		},
		DefaultChannelAdminRole: &imports.RoleImportData{
			Name:        model.NewPointer(model.NewId()),
			DisplayName: model.NewPointer(model.NewId()),
		},
		Description: model.NewPointer("description"),
	}

	appErr := th.App.importScheme(th.Context, &data, true)
	require.NotNil(t, appErr, "Should have failed to import.")

	_, err = th.App.Srv().Store().Scheme().GetByName(*data.Name)
	require.Error(t, err, "Scheme should not have imported.")

	// Try importing a valid scheme in dryRun mode.
	data.DisplayName = model.NewPointer("display name")

	appErr = th.App.importScheme(th.Context, &data, true)
	require.Nil(t, appErr, "Should have succeeded.")

	_, err = th.App.Srv().Store().Scheme().GetByName(*data.Name)
	require.Error(t, err, "Scheme should not have imported.")

	// Try importing an invalid scheme.
	data.DisplayName = nil

	appErr = th.App.importScheme(th.Context, &data, false)
	require.NotNil(t, appErr, "Should have failed to import.")

	_, err = th.App.Srv().Store().Scheme().GetByName(*data.Name)
	require.Error(t, err, "Scheme should not have imported.")

	// Try importing a valid scheme with all params set.
	data.DisplayName = model.NewPointer("display name")

	appErr = th.App.importScheme(th.Context, &data, false)
	require.Nil(t, appErr, "Should have succeeded.")

	scheme, err := th.App.Srv().Store().Scheme().GetByName(*data.Name)
	require.NoError(t, err, "Failed to import scheme: %v", err)

	assert.Equal(t, *data.Name, scheme.Name)
	assert.Equal(t, *data.DisplayName, scheme.DisplayName)
	assert.Equal(t, *data.Description, scheme.Description)
	assert.Equal(t, *data.Scope, scheme.Scope)

	role, err := th.App.Srv().Store().Role().GetByName(context.Background(), scheme.DefaultTeamAdminRole)
	require.NoError(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamAdminRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv().Store().Role().GetByName(context.Background(), scheme.DefaultTeamUserRole)
	require.NoError(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamUserRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv().Store().Role().GetByName(context.Background(), scheme.DefaultTeamGuestRole)
	require.NoError(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamGuestRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv().Store().Role().GetByName(context.Background(), scheme.DefaultChannelAdminRole)
	require.NoError(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelAdminRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv().Store().Role().GetByName(context.Background(), scheme.DefaultChannelUserRole)
	require.NoError(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelUserRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv().Store().Role().GetByName(context.Background(), scheme.DefaultChannelGuestRole)
	require.NoError(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelGuestRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	// Try modifying all the fields and re-importing.
	data.DisplayName = model.NewPointer("new display name")
	data.Description = model.NewPointer("new description")

	appErr = th.App.importScheme(th.Context, &data, false)
	require.Nil(t, appErr, "Should have succeeded: %v", err)

	scheme, err = th.App.Srv().Store().Scheme().GetByName(*data.Name)
	require.NoError(t, err, "Failed to import scheme: %v", err)

	assert.Equal(t, *data.Name, scheme.Name)
	assert.Equal(t, *data.DisplayName, scheme.DisplayName)
	assert.Equal(t, *data.Description, scheme.Description)
	assert.Equal(t, *data.Scope, scheme.Scope)

	role, err = th.App.Srv().Store().Role().GetByName(context.Background(), scheme.DefaultTeamAdminRole)
	require.NoError(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamAdminRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv().Store().Role().GetByName(context.Background(), scheme.DefaultTeamUserRole)
	require.NoError(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamUserRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv().Store().Role().GetByName(context.Background(), scheme.DefaultTeamGuestRole)
	require.NoError(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamGuestRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv().Store().Role().GetByName(context.Background(), scheme.DefaultChannelAdminRole)
	require.NoError(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelAdminRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv().Store().Role().GetByName(context.Background(), scheme.DefaultChannelUserRole)
	require.NoError(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelUserRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv().Store().Role().GetByName(context.Background(), scheme.DefaultChannelGuestRole)
	require.NoError(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelGuestRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	// Try changing the scope of the scheme and reimporting.
	data.Scope = model.NewPointer("channel")

	appErr = th.App.importScheme(th.Context, &data, false)
	require.NotNil(t, appErr, "Should have failed to import.")

	scheme, err = th.App.Srv().Store().Scheme().GetByName(*data.Name)
	require.NoError(t, err, "Failed to import scheme: %v", err)

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

	appErr := th.App.importRole(th.Context, &data, true)
	require.NotNil(t, appErr, "Should have failed to import.")

	_, nErr := th.App.Srv().Store().Role().GetByName(context.Background(), rid1)
	require.Error(t, nErr, "Should have failed to import.")

	// Try importing the valid role in dryRun mode.
	data.DisplayName = model.NewPointer("display name")

	appErr = th.App.importRole(th.Context, &data, true)
	require.Nil(t, appErr, "Should have succeeded.")

	_, nErr = th.App.Srv().Store().Role().GetByName(context.Background(), rid1)
	require.Error(t, nErr, "Role should not have imported as we are in dry run mode.")

	// Try importing an invalid role.
	data.DisplayName = nil

	appErr = th.App.importRole(th.Context, &data, false)
	require.NotNil(t, appErr, "Should have failed to import.")

	_, nErr = th.App.Srv().Store().Role().GetByName(context.Background(), rid1)
	require.Error(t, nErr, "Role should not have imported.")

	// Try importing a valid role with all params set.
	data.DisplayName = model.NewPointer("display name")
	data.Description = model.NewPointer("description")
	data.Permissions = &[]string{"invite_user", "add_user_to_team"}

	appErr = th.App.importRole(th.Context, &data, false)
	require.Nil(t, appErr, "Should have succeeded.")

	role, nErr := th.App.Srv().Store().Role().GetByName(context.Background(), rid1)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data.Name, role.Name)
	assert.Equal(t, *data.DisplayName, role.DisplayName)
	assert.Equal(t, *data.Description, role.Description)
	assert.Equal(t, *data.Permissions, role.Permissions)
	assert.False(t, role.BuiltIn)
	assert.False(t, role.SchemeManaged)

	// Try changing all the params and reimporting.
	data.DisplayName = model.NewPointer("new display name")
	data.Description = model.NewPointer("description")
	data.Permissions = &[]string{"manage_slash_commands"}
	data.SchemeManaged = model.NewPointer(true)

	appErr = th.App.importRole(th.Context, &data, false)
	require.Nil(t, appErr, "Should have succeeded. %v", appErr)

	role, nErr = th.App.Srv().Store().Role().GetByName(context.Background(), rid1)
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
		DisplayName: model.NewPointer("new display name again"),
	}

	appErr = th.App.importRole(th.Context, &data2, false)
	require.Nil(t, appErr, "Should have succeeded.")

	role, nErr = th.App.Srv().Store().Role().GetByName(context.Background(), rid1)
	require.NoError(t, nErr, "Should have found the imported role.")

	assert.Equal(t, *data2.Name, role.Name)
	assert.Equal(t, *data2.DisplayName, role.DisplayName)
	assert.Equal(t, *data.Description, role.Description)
	assert.Equal(t, *data.Permissions, role.Permissions)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)
}

func TestImportImportTeam(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Mark the phase 2 permissions migration as completed.
	err := th.App.Srv().Store().System().Save(&model.System{Name: model.MigrationKeyAdvancedPermissionsPhase2, Value: "true"})
	require.NoError(t, err, "Failed to save system value.")

	defer func() {
		_, err = th.App.Srv().Store().System().PermanentDeleteByName(model.MigrationKeyAdvancedPermissionsPhase2)
		require.NoError(t, err, "Failed to delete system value.")
	}()

	scheme1 := th.SetupTeamScheme()
	scheme2 := th.SetupTeamScheme()

	// Check how many teams are in the database.
	teamsCount, err := th.App.Srv().Store().Team().AnalyticsTeamCount(nil)
	require.NoError(t, err, "Failed to get team count.")

	// we also assert that the team name can be upper case
	// Note there are no reserved team names starting with `Z`, making this flake-free.
	teamName := "Z" + model.NewId()
	sanitizedTeamName := strings.ToLower(teamName)

	data := imports.TeamImportData{
		Name:            model.NewPointer(teamName),
		DisplayName:     model.NewPointer("Display Name"),
		Type:            model.NewPointer("XYZ"),
		Description:     model.NewPointer("The team description."),
		AllowOpenInvite: model.NewPointer(true),
		Scheme:          &scheme1.Name,
	}

	// Try importing an invalid team in dryRun mode.
	err = th.App.importTeam(th.Context, &data, true)
	require.Error(t, err, "Should have received an error importing an invalid team.")

	// Do a valid team in dry-run mode.
	data.Type = model.NewPointer("O")
	appErr := th.App.importTeam(th.Context, &data, true)
	require.Nil(t, appErr, "Received an error validating valid team.")

	// Check that no more teams are in the DB.
	th.CheckTeamCount(t, teamsCount)

	// Do an invalid team in apply mode, check db changes.
	data.Type = model.NewPointer("XYZ")
	err = th.App.importTeam(th.Context, &data, false)
	require.Error(t, err, "Import should have failed on invalid team.")

	// Check that no more teams are in the DB.
	th.CheckTeamCount(t, teamsCount)

	// Do a valid team in apply mode, check db changes.
	data.Type = model.NewPointer("O")
	appErr = th.App.importTeam(th.Context, &data, false)
	require.Nil(t, appErr, "Received an error importing valid team: %v", err)

	// Check that one more team is in the DB.
	th.CheckTeamCount(t, teamsCount+1)

	// Get the team and check that all the fields are correct.
	team, appErr := th.App.GetTeamByName(sanitizedTeamName)
	require.Nil(t, appErr, "Failed to get team from database.")

	assert.Equal(t, *data.DisplayName, team.DisplayName)
	assert.Equal(t, *data.Type, team.Type)
	assert.Equal(t, *data.Description, team.Description)
	assert.Equal(t, *data.AllowOpenInvite, team.AllowOpenInvite)
	assert.Equal(t, scheme1.Id, *team.SchemeId)

	// Alter all the fields of that team (apart from unique identifier) and import again.
	data.DisplayName = model.NewPointer("Display Name 2")
	data.Type = model.NewPointer("P")
	data.Description = model.NewPointer("The new description")
	data.AllowOpenInvite = model.NewPointer(false)
	data.Scheme = &scheme2.Name

	// Check that the original number of teams are again in the DB (because this query doesn't include deleted).
	data.Type = model.NewPointer("O")
	appErr = th.App.importTeam(th.Context, &data, false)
	require.Nil(t, appErr, "Received an error importing updated valid team.")

	th.CheckTeamCount(t, teamsCount+1)

	// Get the team and check that all fields are correct.
	team, appErr = th.App.GetTeamByName(sanitizedTeamName)
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
	err := th.App.Srv().Store().System().Save(&model.System{Name: model.MigrationKeyAdvancedPermissionsPhase2, Value: "true"})
	require.NoError(t, err, "Failed to save system value.")

	defer func() {
		_, err = th.App.Srv().Store().System().PermanentDeleteByName(model.MigrationKeyAdvancedPermissionsPhase2)
		require.NoError(t, err, "Failed to delete system value.")
	}()

	scheme1 := th.SetupChannelScheme()
	scheme2 := th.SetupChannelScheme()

	// Import a Team.
	teamName := model.NewRandomTeamName()
	appErr := th.App.importTeam(th.Context, &imports.TeamImportData{
		Name:        &teamName,
		DisplayName: model.NewPointer("Display Name"),
		Type:        model.NewPointer("O"),
	}, false)
	require.Nil(t, appErr, "Failed to import team.")
	team, appErr := th.App.GetTeamByName(teamName)
	require.Nil(t, appErr, "Failed to get team from database.")

	// Check how many channels are in the database.
	channelCount, nErr := th.App.Srv().Store().Channel().AnalyticsTypeCount("", model.ChannelTypeOpen)
	require.NoError(t, nErr, "Failed to get team count.")

	// Do an invalid channel in dry-run mode.
	chanOpen := model.ChannelTypeOpen
	data := imports.ChannelImportData{
		Team:        &teamName,
		DisplayName: model.NewPointer("Display Name"),
		Type:        &chanOpen,
		Header:      model.NewPointer("Channel Header"),
		Purpose:     model.NewPointer("Channel Purpose"),
		Scheme:      &scheme1.Name,
	}
	appErr = th.App.importChannel(th.Context, &data, true)
	require.NotNil(t, appErr, "Expected error due to invalid name.")

	// Check that no more channels are in the DB.
	th.CheckChannelsCount(t, channelCount)

	// Do a valid channel with a nonexistent team in dry-run mode.
	data.Name = model.NewPointer("channelname")
	data.Team = model.NewPointer(model.NewId())
	appErr = th.App.importChannel(th.Context, &data, true)
	require.Nil(t, appErr, "Expected success as cannot validate channel name in dry run mode.")

	// Check that no more channels are in the DB.
	th.CheckChannelsCount(t, channelCount)

	// Do a valid channel in dry-run mode.
	data.Team = &teamName
	appErr = th.App.importChannel(th.Context, &data, true)
	require.Nil(t, appErr, "Expected success as valid team.")

	// Check that no more channels are in the DB.
	th.CheckChannelsCount(t, channelCount)

	// Do an invalid channel in apply mode.
	data.Name = nil
	appErr = th.App.importChannel(th.Context, &data, false)
	require.NotNil(t, appErr, "Expected error due to invalid name (apply mode).")

	// Check that no more channels are in the DB.
	th.CheckChannelsCount(t, channelCount)

	// Do a valid channel in apply mode with a non-existent team.
	data.Name = model.NewPointer("channelname")
	data.Team = model.NewPointer(model.NewId())
	appErr = th.App.importChannel(th.Context, &data, false)
	require.NotNil(t, appErr, "Expected error due to non-existent team (apply mode).")

	// Check that no more channels are in the DB.
	th.CheckChannelsCount(t, channelCount)

	// Do a valid channel in apply mode.
	data.Team = &teamName

	// we also assert that the channel name can be upper case
	// for the import workflow
	data.Name = model.NewPointer("channelName")
	sanitizedChannelName := strings.ToLower(*data.Name)

	appErr = th.App.importChannel(th.Context, &data, false)
	require.Nil(t, appErr, "Expected success in apply mode")

	// Check that 1 more channel is in the DB.
	th.CheckChannelsCount(t, channelCount+1)

	// Get the Channel and check all the fields are correct.
	channel, appErr := th.App.GetChannelByName(th.Context, sanitizedChannelName, team.Id, false)
	require.Nil(t, appErr, "Failed to get channel from database.")

	assert.Equal(t, sanitizedChannelName, channel.Name)
	assert.Equal(t, *data.DisplayName, channel.DisplayName)
	assert.Equal(t, *data.Type, channel.Type)
	assert.Equal(t, *data.Header, channel.Header)
	assert.Equal(t, *data.Purpose, channel.Purpose)
	assert.Equal(t, scheme1.Id, *channel.SchemeId)

	// Alter all the fields of that channel.
	cTypePr := model.ChannelTypePrivate
	data.DisplayName = model.NewPointer("Changed Disp Name")
	data.Type = &cTypePr
	data.Header = model.NewPointer("New Header")
	data.Purpose = model.NewPointer("New Purpose")
	data.Scheme = &scheme2.Name
	appErr = th.App.importChannel(th.Context, &data, false)
	require.Nil(t, appErr, "Expected success in apply mode")

	// Check channel count the same.
	th.CheckChannelsCount(t, channelCount)

	// Get the Channel and check all the fields are correct.
	channel, appErr = th.App.GetChannelByName(th.Context, sanitizedChannelName, team.Id, false)
	require.Nil(t, appErr, "Failed to get channel from database.")

	assert.Equal(t, sanitizedChannelName, channel.Name)
	assert.Equal(t, *data.DisplayName, channel.DisplayName)
	assert.Equal(t, *data.Type, channel.Type)
	assert.Equal(t, *data.Header, channel.Header)
	assert.Equal(t, *data.Purpose, channel.Purpose)
	assert.Equal(t, scheme2.Id, *channel.SchemeId)

	// Do a valid archived channel.
	now := model.GetMillis()
	data.Name = model.NewPointer("archivedchannel")
	data.DisplayName = model.NewPointer("Archived Channel")
	data.Type = &chanOpen
	data.Header = model.NewPointer("Archived Channel Header")
	data.Purpose = model.NewPointer("Archived Channel Purpose")
	data.Scheme = &scheme1.Name
	data.DeletedAt = &now
	appErr = th.App.importChannel(th.Context, &data, false)
	require.Nil(t, appErr, "Expected success in apply mode")
	aChan, appErr := th.App.GetChannelByName(th.Context, sanitizedChannelName, team.Id, true)
	require.Nil(t, appErr, "Failed to get channel from database.")
	assert.Equal(t, sanitizedChannelName, aChan.Name)
}

func TestImportImportUser(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Check how many users are in the database.
	userCount, cErr := th.App.Srv().Store().User().Count(model.UserCountOptions{
		IncludeDeleted:     true,
		IncludeBotAccounts: false,
	})
	require.NoError(t, cErr, "Failed to get user count.")

	t.Run("import an invalid user in dry-run", func(t *testing.T) {
		data := imports.UserImportData{
			Username: model.NewPointer(model.NewUsername()),
		}
		appErr := th.App.importUser(th.Context, &data, true)
		require.NotNil(t, appErr, "Should have failed to import invalid user.")

		// Check that no more users are in the DB.
		userCountCurrent, err := th.App.Srv().Store().User().Count(model.UserCountOptions{
			IncludeDeleted:     true,
			IncludeBotAccounts: false,
		})
		require.NoError(t, err, "Failed to get user count.")
		assert.Equal(t, userCount, userCountCurrent, "Unexpected number of users")
	})

	t.Run("import a valid user in dry-run", func(t *testing.T) {
		data := imports.UserImportData{
			Username: model.NewPointer(model.NewUsername()),
			Email:    model.NewPointer(model.NewId() + "@example.com"),
		}
		appErr := th.App.importUser(th.Context, &data, true)
		require.Nil(t, appErr, "Should have succeeded to import valid user.")

		// Check that no more users are in the DB.
		userCountCurrent, err := th.App.Srv().Store().User().Count(model.UserCountOptions{
			IncludeDeleted:     true,
			IncludeBotAccounts: false,
		})
		require.NoError(t, err, "Failed to get user count.")
		assert.Equal(t, userCount, userCountCurrent, "Unexpected number of users")
	})

	t.Run("import an invalid user in apply mode", func(t *testing.T) {
		data := imports.UserImportData{
			Username: model.NewPointer(model.NewUsername()),
		}
		appErr := th.App.importUser(th.Context, &data, false)
		require.NotNil(t, appErr, "Should have failed to import invalid user.")

		// Check that no more users are in the DB.
		userCountCurrent, err := th.App.Srv().Store().User().Count(model.UserCountOptions{
			IncludeDeleted:     true,
			IncludeBotAccounts: false,
		})
		require.NoError(t, err, "Failed to get user count.")
		assert.Equal(t, userCount, userCountCurrent, "Unexpected number of users")
	})

	t.Run("import a valid user in apply mode", func(t *testing.T) {
		username := "A" + model.NewUsername()[1:]
		testsDir, _ := fileutils.FindDir("tests")
		data := imports.UserImportData{
			Avatar: imports.Avatar{
				ProfileImage: model.NewPointer(filepath.Join(testsDir, "test.png")),
			},
			Username:  &username,
			Email:     model.NewPointer(model.NewId() + "@example.com"),
			Nickname:  model.NewPointer(model.NewId()),
			FirstName: model.NewPointer(model.NewId()),
			LastName:  model.NewPointer(model.NewId()),
			Position:  model.NewPointer(model.NewId()),
		}
		appErr := th.App.importUser(th.Context, &data, false)
		require.Nil(t, appErr, "Should have succeeded to import valid user.")

		// Check that one more user is in the DB.
		userCountCurrent, err := th.App.Srv().Store().User().Count(model.UserCountOptions{
			IncludeDeleted:     true,
			IncludeBotAccounts: false,
		})
		require.NoError(t, err, "Failed to get user count.")
		userCount++ // Increment the user count.
		assert.Equal(t, userCount, userCountCurrent, "Unexpected number of users")

		// Get the user and check all the fields are correct.
		user, err2 := th.App.GetUserByUsername(username)
		require.Nil(t, err2, "Failed to get user from database.")

		assert.Equal(t, *data.Email, user.Email)
		assert.Equal(t, *data.Nickname, user.Nickname)
		assert.Equal(t, *data.FirstName, user.FirstName)
		assert.Equal(t, *data.LastName, user.LastName)
		assert.Equal(t, *data.Position, user.Position)

		// Check calculated properties.
		require.Equal(t, strings.ToLower(username), user.Username, "Expected Username to be lower case.")
		require.Empty(t, user.AuthService, "Expected Auth Service to be empty.")
		require.Empty(t, user.AuthData, "Expected AuthData to be empty.")
		require.NotEmpty(t, user.Password, "Expected password to be set.")
		require.True(t, user.EmailVerified, "Expected EmailVerified to be true.")
		require.Equal(t, user.Locale, *th.App.Config().LocalizationSettings.DefaultClientLocale, "Expected Locale to be the default.")
		require.Equal(t, user.Roles, "system_user", "Expected roles to be system_user")
	})

	t.Run("import a valid user where there is an existing user", func(t *testing.T) {
		username := model.NewUsername()
		testsDir, _ := fileutils.FindDir("tests")
		data := imports.UserImportData{
			Avatar: imports.Avatar{
				ProfileImage: model.NewPointer(filepath.Join(testsDir, "test.png")),
			},
			Username:  &username,
			Email:     model.NewPointer(model.NewId() + "@example.com"),
			Nickname:  model.NewPointer(model.NewId()),
			FirstName: model.NewPointer(model.NewId()),
			LastName:  model.NewPointer(model.NewId()),
			Position:  model.NewPointer(model.NewId()),
		}
		appErr := th.App.importUser(th.Context, &data, false)
		require.Nil(t, appErr, "Should have succeeded to import valid user.")

		// Check that one more user is in the DB.
		userCountCurrent, err := th.App.Srv().Store().User().Count(model.UserCountOptions{
			IncludeDeleted:     true,
			IncludeBotAccounts: false,
		})
		require.NoError(t, err, "Failed to get user count.")
		userCount++ // Increment the user count.
		assert.Equal(t, userCount, userCountCurrent, "Unexpected number of users")

		// Alter all the fields of that user.
		data.Email = model.NewPointer(model.NewId() + "@example.com")
		data.ProfileImage = model.NewPointer(filepath.Join(testsDir, "testgif.gif"))
		data.AuthService = model.NewPointer("ldap")
		data.AuthData = &username
		data.Nickname = model.NewPointer(model.NewId())
		data.FirstName = model.NewPointer(model.NewId())
		data.LastName = model.NewPointer(model.NewId())
		data.Position = model.NewPointer(model.NewId())
		data.Roles = model.NewPointer("system_admin system_user")
		data.Locale = model.NewPointer("zh_CN")

		appErr = th.App.importUser(th.Context, &data, false)
		require.Nil(t, appErr, "Should have succeeded to update valid user %v", err)

		// Check user count the same.
		userCountCurrent, err = th.App.Srv().Store().User().Count(model.UserCountOptions{
			IncludeDeleted:     true,
			IncludeBotAccounts: false,
		})
		require.NoError(t, err, "Failed to get user count.")
		assert.Equal(t, userCount, userCountCurrent, "Unexpected number of users")

		// Get the user and check all the fields are correct.
		user, err2 := th.App.GetUserByUsername(username)
		require.Nil(t, err2, "Failed to get user from database.")

		assert.Equal(t, *data.Email, user.Email)
		assert.Equal(t, *data.Nickname, user.Nickname)
		assert.Equal(t, *data.FirstName, user.FirstName)
		assert.Equal(t, *data.LastName, user.LastName)
		assert.Equal(t, *data.Position, user.Position)

		require.Equal(t, "ldap", user.AuthService, "Expected Auth Service to be ldap \"%v\"", user.AuthService)
		require.Equal(t, user.AuthData, data.AuthData, "Expected AuthData to be set.")
		require.Empty(t, user.Password, "Expected password to be empty.")
		require.True(t, user.EmailVerified, "Expected EmailVerified to be true.")
		require.Equal(t, *data.Locale, user.Locale, "Expected Locale to be the set.")
		require.Equal(t, *data.Roles, user.Roles, "Expected roles to be set: %v", user.Roles)
	})

	t.Run("import invalid fields", func(t *testing.T) {
		username := model.NewUsername()
		testsDir, _ := fileutils.FindDir("tests")
		data := imports.UserImportData{
			Avatar: imports.Avatar{
				ProfileImage: model.NewPointer(filepath.Join(testsDir, "test.png")),
			},
			Username:    &username,
			Email:       model.NewPointer(model.NewId() + "@example.com"),
			Nickname:    model.NewPointer(model.NewId()),
			FirstName:   model.NewPointer(model.NewId()),
			LastName:    model.NewPointer(model.NewId()),
			Position:    model.NewPointer(model.NewId()),
			AuthData:    &username,
			AuthService: model.NewPointer("ldap"),
		}
		appErr := th.App.importUser(th.Context, &data, false)
		require.Nil(t, appErr, "Should have succeeded to import valid user.")

		// Check that one more user is in the DB.
		userCountCurrent, err := th.App.Srv().Store().User().Count(model.UserCountOptions{
			IncludeDeleted:     true,
			IncludeBotAccounts: false,
		})
		require.NoError(t, err, "Failed to get user count.")
		userCount++ // Increment the user count.
		assert.Equal(t, userCount, userCountCurrent, "Unexpected number of users")

		// Check Password and AuthData together.
		data.Password = model.NewPointer("PasswordTest")
		appErr = th.App.importUser(th.Context, &data, false)
		require.NotNil(t, appErr, "Should have failed to import invalid user.")

		data.AuthData = nil
		data.AuthService = nil
		appErr = th.App.importUser(th.Context, &data, false)
		require.Nil(t, appErr, "Should have succeeded to update valid user %v", err)

		data.Password = model.NewPointer("")
		appErr = th.App.importUser(th.Context, &data, false)
		require.NotNil(t, appErr, "Should have failed to import invalid user.")

		data.Password = model.NewPointer(strings.Repeat("0123456789", 10))
		appErr = th.App.importUser(th.Context, &data, false)
		require.NotNil(t, appErr, "Should have failed to import invalid user.")

		// Check that no more user is in the DB.
		userCountCurrent, err = th.App.Srv().Store().User().Count(model.UserCountOptions{
			IncludeDeleted:     true,
			IncludeBotAccounts: false,
		})
		require.NoError(t, err, "Failed to get user count.")
		assert.Equal(t, userCount, userCountCurrent, "Unexpected number of users")
	})

	t.Run("import with team and channel memberships", func(t *testing.T) {
		teamName := model.NewRandomTeamName()
		tAppErr := th.App.importTeam(th.Context, &imports.TeamImportData{
			Name:        &teamName,
			DisplayName: model.NewPointer("Display Name"),
			Type:        model.NewPointer("O"),
		}, false)
		require.Nil(t, tAppErr, "Failed to import team.")
		team, appErr := th.App.GetTeamByName(teamName)
		require.Nil(t, appErr, "Failed to get team from database.")

		channelName := model.NewId()
		chanTypeOpen := model.ChannelTypeOpen
		appErr = th.App.importChannel(th.Context, &imports.ChannelImportData{
			Team:        &teamName,
			Name:        &channelName,
			DisplayName: model.NewPointer("Display Name"),
			Type:        &chanTypeOpen,
		}, false)
		require.Nil(t, appErr, "Failed to import channel.")
		channel, appErr := th.App.GetChannelByName(th.Context, channelName, team.Id, false)
		require.Nil(t, appErr, "Failed to get channel from database.")

		username := model.NewUsername()
		data := imports.UserImportData{
			Username:  &username,
			Email:     model.NewPointer(model.NewId() + "@example.com"),
			Nickname:  model.NewPointer(model.NewId()),
			FirstName: model.NewPointer(model.NewId()),
			LastName:  model.NewPointer(model.NewId()),
			Position:  model.NewPointer(model.NewId()),
		}

		teamMembers, appErr := th.App.GetTeamMembers(team.Id, 0, 1000, nil)
		require.Nil(t, appErr, "Failed to get team member count")
		teamMemberCount := len(teamMembers)

		channelMemberCount, appErr := th.App.GetChannelMemberCount(th.Context, channel.Id)
		require.Nil(t, appErr, "Failed to get channel member count")

		t.Run("invalid team and channel memberships in dry-run mode", func(t *testing.T) {
			data.Teams = &[]imports.UserTeamImportData{
				{
					Roles: model.NewPointer("invalid"),
					Channels: &[]imports.UserChannelImportData{
						{
							Roles: model.NewPointer("invalid"),
						},
					},
				},
			}
			appErr = th.App.importUser(th.Context, &data, true)
			assert.NotNil(t, appErr)
		})

		t.Run("unknown team name & invalid channel membership in dry-run mode", func(t *testing.T) {
			data.Teams = &[]imports.UserTeamImportData{
				{
					Name: model.NewPointer(model.NewId()),
					Channels: &[]imports.UserChannelImportData{
						{
							Roles: model.NewPointer("invalid"),
						},
					},
				},
			}
			appErr = th.App.importUser(th.Context, &data, true)
			assert.NotNil(t, appErr)
		})

		t.Run("valid team & invalid channel membership in dry-run mode", func(t *testing.T) {
			data.Teams = &[]imports.UserTeamImportData{
				{
					Name: &teamName,
					Channels: &[]imports.UserChannelImportData{
						{
							Roles: model.NewPointer("invalid"),
						},
					},
				},
			}
			appErr = th.App.importUser(th.Context, &data, true)
			assert.NotNil(t, appErr)
		})

		t.Run("valid team & unknown channel name in dry-run mode", func(t *testing.T) {
			data.Teams = &[]imports.UserTeamImportData{
				{
					Name: &teamName,
					Channels: &[]imports.UserChannelImportData{
						{
							Name: model.NewPointer(model.NewId()),
						},
					},
				},
			}
			appErr = th.App.importUser(th.Context, &data, true)
			assert.Nil(t, appErr)
		})

		t.Run("valid team & valid channel name in dry-run mode", func(t *testing.T) {
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
			tmc, appErr2 := th.App.GetTeamMembers(team.Id, 0, 1000, nil)
			require.Nil(t, appErr2, "Failed to get Team Member Count")
			require.Len(t, tmc, teamMemberCount, "Number of team members not as expected")

			cmc, appErr2 := th.App.GetChannelMemberCount(th.Context, channel.Id)
			require.Nil(t, appErr2, "Failed to get Channel Member Count")
			require.Equal(t, channelMemberCount, cmc, "Number of channel members not as expected")
		})

		t.Run("invalid team & channel membership in apply mode", func(t *testing.T) {
			data.Teams = &[]imports.UserTeamImportData{
				{
					Roles: model.NewPointer("invalid"),
					Channels: &[]imports.UserChannelImportData{
						{
							Roles: model.NewPointer("invalid"),
						},
					},
				},
			}
			appErr = th.App.importUser(th.Context, &data, false)
			assert.NotNil(t, appErr)
		})

		t.Run("unknown team name & invalid channel membership in apply mode", func(t *testing.T) {
			data.Teams = &[]imports.UserTeamImportData{
				{
					Name: model.NewPointer(model.NewId()),
					Channels: &[]imports.UserChannelImportData{
						{
							Roles: model.NewPointer("invalid"),
						},
					},
				},
			}
			appErr = th.App.importUser(th.Context, &data, false)
			assert.NotNil(t, appErr)
		})

		t.Run("import with valid team and invalid channel memberships in apply mode", func(t *testing.T) {
			data.Teams = &[]imports.UserTeamImportData{
				{
					Name: &teamName,
					Channels: &[]imports.UserChannelImportData{
						{
							Roles: model.NewPointer("invalid"),
						},
					},
				},
			}
			appErr = th.App.importUser(th.Context, &data, false)
			assert.NotNil(t, appErr)

			// Check no new member objects were created because all tests should have failed so far.
			tmc, appErr2 := th.App.GetTeamMembers(team.Id, 0, 1000, nil)
			require.Nil(t, appErr2, "Failed to get Team Member Count")
			require.Len(t, tmc, teamMemberCount)

			cmc, appErr2 := th.App.GetChannelMemberCount(th.Context, channel.Id)
			require.Nil(t, appErr2, "Failed to get Channel Member Count")
			require.Equal(t, channelMemberCount, cmc)
		})

		t.Run("valid team & unknown channel name in apply mode", func(t *testing.T) {
			data.Teams = &[]imports.UserTeamImportData{
				{
					Name: &teamName,
					Channels: &[]imports.UserChannelImportData{
						{
							Name: model.NewPointer(model.NewId()),
						},
					},
				},
			}
			appErr = th.App.importUser(th.Context, &data, false)
			assert.NotNil(t, appErr)

			// Check only new team member object created because dry run mode.
			tmc, appErr2 := th.App.GetTeamMembers(team.Id, 0, 1000, nil)
			require.Nil(t, appErr2, "Failed to get Team Member Count")
			teamMemberCount++
			require.Len(t, tmc, teamMemberCount)

			cmc, appErr2 := th.App.GetChannelMemberCount(th.Context, channel.Id)
			require.Nil(t, appErr2, "Failed to get Channel Member Count")
			require.Equal(t, channelMemberCount, cmc)

			// Check team member properties.
			user, appErr2 := th.App.GetUserByUsername(username)
			require.Nil(t, appErr2, "Failed to get user from database.")

			teamMember, appErr2 := th.App.GetTeamMember(th.Context, team.Id, user.Id)
			require.Nil(t, appErr2, "Failed to get team member from database.")
			require.Equal(t, "team_user", teamMember.Roles)
		})

		t.Run("valid team & valid channel name in apply mode", func(t *testing.T) {
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

			// convert to a new user
			username = model.NewUsername()
			data.Username = &username
			data.Email = model.NewPointer(model.NewId() + "@example.com")
			appErr2 := th.App.importUser(th.Context, &data, false)
			assert.Nil(t, appErr2)

			// Check only new channel member object created because dry run mode.
			tmc, appErr2 := th.App.GetTeamMembers(team.Id, 0, 1000, nil)
			require.Nil(t, appErr2, "Failed to get Team Member Count")
			teamMemberCount++
			require.Len(t, tmc, teamMemberCount, "Number of team members not as expected")

			cmc, appErr2 := th.App.GetChannelMemberCount(th.Context, channel.Id)
			require.Nil(t, appErr2, "Failed to get Channel Member Count")
			channelMemberCount++
			require.Equal(t, channelMemberCount, cmc, "Number of channel members not as expected")

			user, err2 := th.App.GetUserByUsername(username)
			require.Nil(t, err2, "Failed to get user from database.")

			// Check channel member properties.
			channelMember, appErr2 := th.App.GetChannelMember(th.Context, channel.Id, user.Id)
			require.Nil(t, appErr2, "Failed to get channel member from database.")
			assert.Equal(t, "channel_user", channelMember.Roles)
			assert.Equal(t, "default", channelMember.NotifyProps[model.DesktopNotifyProp])
			assert.Equal(t, "default", channelMember.NotifyProps[model.PushNotifyProp])
			assert.Equal(t, "all", channelMember.NotifyProps[model.MarkUnreadNotifyProp])
		})

		t.Run("test with the properties of the team and channel membership changed", func(t *testing.T) {
			data.Teams = &[]imports.UserTeamImportData{
				{
					Name:  &teamName,
					Theme: model.NewPointer(`{"awayIndicator":"#DBBD4E","buttonBg":"#23A1FF","buttonColor":"#FFFFFF","centerChannelBg":"#ffffff","centerChannelColor":"#333333","codeTheme":"github","image":"/static/files/a4a388b38b32678e83823ef1b3e17766.png","linkColor":"#2389d7","mentionBg":"#2389d7","mentionColor":"#ffffff","mentionHighlightBg":"#fff2bb","mentionHighlightLink":"#2f81b7","newMessageSeparator":"#FF8800","onlineIndicator":"#7DBE00","sidebarBg":"#fafafa","sidebarHeaderBg":"#3481B9","sidebarHeaderTextColor":"#ffffff","sidebarText":"#333333","sidebarTextActiveBorder":"#378FD2","sidebarTextActiveColor":"#111111","sidebarTextHoverBg":"#e6f2fa","sidebarUnreadText":"#333333","type":"Mattermost"}`),
					Roles: model.NewPointer("team_user team_admin"),
					Channels: &[]imports.UserChannelImportData{
						{
							Name:  &channelName,
							Roles: model.NewPointer("channel_user channel_admin"),
							NotifyProps: &imports.UserChannelNotifyPropsImportData{
								Desktop:    model.NewPointer(model.UserNotifyMention),
								Mobile:     model.NewPointer(model.UserNotifyMention),
								MarkUnread: model.NewPointer(model.UserNotifyMention),
							},
							Favorite: model.NewPointer(true),
						},
					},
				},
			}

			// convert to a new user
			username = model.NewUsername()
			data.Username = &username
			data.Email = model.NewPointer(model.NewId() + "@example.com")

			appErr2 := th.App.importUser(th.Context, &data, false)
			assert.Nil(t, appErr2)

			user, err2 := th.App.GetUserByUsername(username)
			require.Nil(t, err2, "Failed to get user from database.")

			// Check both member properties.
			teamMember, appErr2 := th.App.GetTeamMember(th.Context, team.Id, user.Id)
			require.Nil(t, appErr2, "Failed to get team member from database.")
			require.Equal(t, "team_user team_admin", teamMember.Roles)

			channelMember, appErr2 := th.App.GetChannelMember(th.Context, channel.Id, user.Id)
			require.Nil(t, appErr2, "Failed to get channel member Desktop from database.")
			assert.Equal(t, "channel_user channel_admin", channelMember.Roles)
			assert.Equal(t, model.UserNotifyMention, channelMember.NotifyProps[model.DesktopNotifyProp])
			assert.Equal(t, model.UserNotifyMention, channelMember.NotifyProps[model.PushNotifyProp])
			assert.Equal(t, model.UserNotifyMention, channelMember.NotifyProps[model.MarkUnreadNotifyProp])

			checkPreference(t, th.App, user.Id, model.PreferenceCategoryFavoriteChannel, channel.Id, "true")
			checkPreference(t, th.App, user.Id, model.PreferenceCategoryTheme, team.Id, *(*data.Teams)[0].Theme)

			// No more new member objects.
			tmc, appErr2 := th.App.GetTeamMembers(team.Id, 0, 1000, nil)
			require.Nil(t, appErr2, "Failed to get Team Member Count")
			require.Len(t, tmc, teamMemberCount+1, "Number of team members not as expected")

			cmc, appErr2 := th.App.GetChannelMemberCount(th.Context, channel.Id)
			require.Nil(t, appErr2, "Failed to get Channel Member Count")
			require.Equal(t, channelMemberCount+1, cmc, "Number of channel members not as expected")
		})
	})

	t.Run("add a user with some preferences.", func(t *testing.T) {
		teamName := model.NewRandomTeamName()
		appErr2 := th.App.importTeam(th.Context, &imports.TeamImportData{
			Name:        &teamName,
			DisplayName: model.NewPointer("Display Name"),
			Type:        model.NewPointer("O"),
		}, false)
		require.Nil(t, appErr2, "Failed to import team.")

		channelName := model.NewId()
		chanTypeOpen := model.ChannelTypeOpen
		appErr2 = th.App.importChannel(th.Context, &imports.ChannelImportData{
			Team:        &teamName,
			Name:        &channelName,
			DisplayName: model.NewPointer("Display Name"),
			Type:        &chanTypeOpen,
		}, false)
		require.Nil(t, appErr2, "Failed to import channel.")

		username := model.NewUsername()
		data := imports.UserImportData{
			Username:                 &username,
			Email:                    model.NewPointer(model.NewId() + "@example.com"),
			Theme:                    model.NewPointer(`{"awayIndicator":"#DCBD4E","buttonBg":"#23A2FF","buttonColor":"#FFFFFF","centerChannelBg":"#ffffff","centerChannelColor":"#333333","codeTheme":"github","image":"/static/files/a4a388b38b32678e83823ef1b3e17766.png","linkColor":"#2389d7","mentionBg":"#2389d7","mentionColor":"#ffffff","mentionHighlightBg":"#fff2bb","mentionHighlightLink":"#2f81b7","newMessageSeparator":"#FF8800","onlineIndicator":"#7DBE00","sidebarBg":"#fafafa","sidebarHeaderBg":"#3481B9","sidebarHeaderTextColor":"#ffffff","sidebarText":"#333333","sidebarTextActiveBorder":"#378FD2","sidebarTextActiveColor":"#111111","sidebarTextHoverBg":"#e6f2fa","sidebarUnreadText":"#333333","type":"Mattermost"}`),
			UseMilitaryTime:          model.NewPointer("true"),
			CollapsePreviews:         model.NewPointer("true"),
			MessageDisplay:           model.NewPointer("compact"),
			ColorizeUsernames:        model.NewPointer("true"),
			ChannelDisplayMode:       model.NewPointer("centered"),
			TutorialStep:             model.NewPointer("3"),
			UseMarkdownPreview:       model.NewPointer("true"),
			UseFormatting:            model.NewPointer("true"),
			ShowUnreadSection:        model.NewPointer("true"),
			EmailInterval:            model.NewPointer("immediately"),
			NameFormat:               model.NewPointer("full_name"),
			SendOnCtrlEnter:          model.NewPointer("true"),
			CodeBlockCtrlEnter:       model.NewPointer("true"),
			ShowJoinLeave:            model.NewPointer("false"),
			SyncDrafts:               model.NewPointer("false"),
			ShowUnreadScrollPosition: model.NewPointer("start_from_newest"),
			LimitVisibleDmsGms:       model.NewPointer("20"),
		}
		appErr2 = th.App.importUser(th.Context, &data, false)
		assert.Nil(t, appErr2)

		// Check their values.
		user, appErr2 := th.App.GetUserByUsername(username)
		require.Nil(t, appErr2, "Failed to get user from database.")

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
		checkPreference(t, th.App, user.Id, model.PreferenceCategoryDisplaySettings, model.PreferenceNameNameFormat, "full_name")
		checkPreference(t, th.App, user.Id, model.PreferenceCategoryAdvancedSettings, "send_on_ctrl_enter", "true")
		checkPreference(t, th.App, user.Id, model.PreferenceCategoryAdvancedSettings, "code_block_ctrl_enter", "true")
		checkPreference(t, th.App, user.Id, model.PreferenceCategoryAdvancedSettings, "join_leave", "false")
		checkPreference(t, th.App, user.Id, model.PreferenceCategoryAdvancedSettings, "sync_drafts", "false")
		checkPreference(t, th.App, user.Id, model.PreferenceCategoryAdvancedSettings, "unread_scroll_position", "start_from_newest")
		checkPreference(t, th.App, user.Id, model.PreferenceCategorySidebarSettings, model.PreferenceLimitVisibleDmsGms, "20")

		// Change those preferences.
		data = imports.UserImportData{
			Username:           &username,
			Email:              model.NewPointer(model.NewId() + "@example.com"),
			Theme:              model.NewPointer(`{"awayIndicator":"#123456","buttonBg":"#23A2FF","buttonColor":"#FFFFFF","centerChannelBg":"#ffffff","centerChannelColor":"#333333","codeTheme":"github","image":"/static/files/a4a388b38b32678e83823ef1b3e17766.png","linkColor":"#2389d7","mentionBg":"#2389d7","mentionColor":"#ffffff","mentionHighlightBg":"#fff2bb","mentionHighlightLink":"#2f81b7","newMessageSeparator":"#FF8800","onlineIndicator":"#7DBE00","sidebarBg":"#fafafa","sidebarHeaderBg":"#3481B9","sidebarHeaderTextColor":"#ffffff","sidebarText":"#333333","sidebarTextActiveBorder":"#378FD2","sidebarTextActiveColor":"#111111","sidebarTextHoverBg":"#e6f2fa","sidebarUnreadText":"#333333","type":"Mattermost"}`),
			UseMilitaryTime:    model.NewPointer("false"),
			CollapsePreviews:   model.NewPointer("false"),
			MessageDisplay:     model.NewPointer("clean"),
			ColorizeUsernames:  model.NewPointer("false"),
			ChannelDisplayMode: model.NewPointer("full"),
			TutorialStep:       model.NewPointer("2"),
			EmailInterval:      model.NewPointer("hour"),
		}
		appErr2 = th.App.importUser(th.Context, &data, false)
		assert.Nil(t, appErr2)

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
			Desktop:          model.NewPointer(model.UserNotifyAll),
			DesktopSound:     model.NewPointer("true"),
			Email:            model.NewPointer("true"),
			Mobile:           model.NewPointer(model.UserNotifyAll),
			MobilePushStatus: model.NewPointer(model.StatusOnline),
			ChannelTrigger:   model.NewPointer("true"),
			CommentsTrigger:  model.NewPointer(model.CommentsNotifyRoot),
		}
		appErr2 = th.App.importUser(th.Context, &data, false)
		assert.Nil(t, appErr2)

		user, appErr2 = th.App.GetUserByUsername(username)
		require.Nil(t, appErr2, "Failed to get user from database.")

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
			Desktop:          model.NewPointer(model.UserNotifyAll),
			DesktopSound:     model.NewPointer("true"),
			Email:            model.NewPointer("true"),
			Mobile:           model.NewPointer(model.UserNotifyAll),
			MobilePushStatus: model.NewPointer(model.StatusOnline),
			ChannelTrigger:   model.NewPointer("true"),
			CommentsTrigger:  model.NewPointer(model.CommentsNotifyRoot),
			MentionKeys:      model.NewPointer("valid,misc"),
		}
		appErr2 = th.App.importUser(th.Context, &data, false)
		assert.Nil(t, appErr2)

		user, appErr2 = th.App.GetUserByUsername(username)
		require.Nil(t, appErr2, "Failed to get user from database.")

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
			Desktop:          model.NewPointer(model.UserNotifyMention),
			DesktopSound:     model.NewPointer("false"),
			Email:            model.NewPointer("false"),
			Mobile:           model.NewPointer(model.UserNotifyNone),
			MobilePushStatus: model.NewPointer(model.StatusAway),
			ChannelTrigger:   model.NewPointer("false"),
			CommentsTrigger:  model.NewPointer(model.CommentsNotifyAny),
			MentionKeys:      model.NewPointer("misc"),
		}
		appErr2 = th.App.importUser(th.Context, &data, false)
		assert.Nil(t, appErr2)

		user, appErr2 = th.App.GetUserByUsername(username)
		require.Nil(t, appErr2, "Failed to get user from database.")

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
			Desktop:          model.NewPointer(model.UserNotifyMention),
			DesktopSound:     model.NewPointer("false"),
			Email:            model.NewPointer("false"),
			Mobile:           model.NewPointer(model.UserNotifyNone),
			MobilePushStatus: model.NewPointer(model.StatusAway),
			ChannelTrigger:   model.NewPointer("false"),
			CommentsTrigger:  model.NewPointer(model.CommentsNotifyAny),
		}
		appErr2 = th.App.importUser(th.Context, &data, false)
		assert.Nil(t, appErr2)

		user, appErr2 = th.App.GetUserByUsername(username)
		require.Nil(t, appErr2, "Failed to get user from database.")

		checkNotifyProp(t, user, model.DesktopNotifyProp, model.UserNotifyMention)
		checkNotifyProp(t, user, model.DesktopSoundNotifyProp, "false")
		checkNotifyProp(t, user, model.EmailNotifyProp, "false")
		checkNotifyProp(t, user, model.PushNotifyProp, model.UserNotifyNone)
		checkNotifyProp(t, user, model.PushStatusNotifyProp, model.StatusAway)
		checkNotifyProp(t, user, model.ChannelMentionsNotifyProp, "false")
		checkNotifyProp(t, user, model.CommentsNotifyProp, model.CommentsNotifyAny)
		checkNotifyProp(t, user, model.MentionKeysNotifyProp, "misc")

		// Check Notify Props get set on *create* user.
		username = model.NewUsername()
		data = imports.UserImportData{
			Username: &username,
			Email:    model.NewPointer(model.NewId() + "@example.com"),
		}
		data.NotifyProps = &imports.UserNotifyPropsImportData{
			Desktop:          model.NewPointer(model.UserNotifyMention),
			DesktopSound:     model.NewPointer("false"),
			Email:            model.NewPointer("false"),
			Mobile:           model.NewPointer(model.UserNotifyNone),
			MobilePushStatus: model.NewPointer(model.StatusAway),
			ChannelTrigger:   model.NewPointer("false"),
			CommentsTrigger:  model.NewPointer(model.CommentsNotifyAny),
			MentionKeys:      model.NewPointer("misc"),
		}

		appErr2 = th.App.importUser(th.Context, &data, false)
		assert.Nil(t, appErr2)

		user, appErr2 = th.App.GetUserByUsername(username)
		require.Nil(t, appErr2, "Failed to get user from database.")

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
		err := th.App.Srv().Store().System().Save(&model.System{Name: model.MigrationKeyAdvancedPermissionsPhase2, Value: "true"})
		require.NoError(t, err)

		defer func() {
			_, err = th.App.Srv().Store().System().PermanentDeleteByName(model.MigrationKeyAdvancedPermissionsPhase2)
			require.NoError(t, err)
		}()

		teamSchemeData := &imports.SchemeImportData{
			Name:        model.NewPointer(model.NewId()),
			DisplayName: model.NewPointer(model.NewId()),
			Scope:       model.NewPointer("team"),
			DefaultTeamGuestRole: &imports.RoleImportData{
				Name:        model.NewPointer(model.NewId()),
				DisplayName: model.NewPointer(model.NewId()),
			},
			DefaultTeamUserRole: &imports.RoleImportData{
				Name:        model.NewPointer(model.NewId()),
				DisplayName: model.NewPointer(model.NewId()),
			},
			DefaultTeamAdminRole: &imports.RoleImportData{
				Name:        model.NewPointer(model.NewId()),
				DisplayName: model.NewPointer(model.NewId()),
			},
			DefaultChannelGuestRole: &imports.RoleImportData{
				Name:        model.NewPointer(model.NewId()),
				DisplayName: model.NewPointer(model.NewId()),
			},
			DefaultChannelUserRole: &imports.RoleImportData{
				Name:        model.NewPointer(model.NewId()),
				DisplayName: model.NewPointer(model.NewId()),
			},
			DefaultChannelAdminRole: &imports.RoleImportData{
				Name:        model.NewPointer(model.NewId()),
				DisplayName: model.NewPointer(model.NewId()),
			},
			Description: model.NewPointer("description"),
		}

		appErr2 = th.App.importScheme(th.Context, teamSchemeData, false)
		assert.Nil(t, appErr2)

		teamScheme, nErr := th.App.Srv().Store().Scheme().GetByName(*teamSchemeData.Name)
		require.NoError(t, nErr, "Failed to import scheme")

		teamData := &imports.TeamImportData{
			Name:            model.NewPointer(NewTestId()),
			DisplayName:     model.NewPointer("Display Name"),
			Type:            model.NewPointer("O"),
			Description:     model.NewPointer("The team description."),
			AllowOpenInvite: model.NewPointer(true),
			Scheme:          &teamScheme.Name,
		}
		appErr2 = th.App.importTeam(th.Context, teamData, false)
		assert.Nil(t, appErr2)
		team, appErr2 := th.App.GetTeamByName(teamName)
		require.Nil(t, appErr2, "Failed to get team from database.")

		channelData := &imports.ChannelImportData{
			Team:        &teamName,
			Name:        model.NewPointer(NewTestId()),
			DisplayName: model.NewPointer("Display Name"),
			Type:        &chanTypeOpen,
			Header:      model.NewPointer("Channel Header"),
			Purpose:     model.NewPointer("Channel Purpose"),
		}
		appErr2 = th.App.importChannel(th.Context, channelData, false)
		assert.Nil(t, appErr2)
		channel, appErr2 := th.App.GetChannelByName(th.Context, *channelData.Name, team.Id, false)
		require.Nil(t, appErr2, "Failed to get channel from database")

		// Test with a valid team & valid channel name in apply mode.
		userData := &imports.UserImportData{
			Username: &username,
			Email:    model.NewPointer(model.NewId() + "@example.com"),
			Teams: &[]imports.UserTeamImportData{
				{
					Name:  &team.Name,
					Roles: model.NewPointer("team_user team_admin"),
					Channels: &[]imports.UserChannelImportData{
						{
							Name:  &channel.Name,
							Roles: model.NewPointer("channel_admin channel_user"),
						},
					},
				},
			},
		}
		appErr2 = th.App.importUser(th.Context, userData, false)
		assert.Nil(t, appErr2)

		user, appErr2 = th.App.GetUserByUsername(*userData.Username)
		require.Nil(t, appErr2, "Failed to get user from database.")

		teamMember, appErr2 := th.App.GetTeamMember(th.Context, team.Id, user.Id)
		require.Nil(t, appErr2, "Failed to get the team member")

		assert.True(t, teamMember.SchemeAdmin)
		assert.True(t, teamMember.SchemeUser)
		assert.False(t, teamMember.SchemeGuest)
		assert.Equal(t, "", teamMember.ExplicitRoles)

		channelMember, appErr2 := th.App.GetChannelMember(th.Context, channel.Id, user.Id)
		require.Nil(t, appErr2, "Failed to get the channel member")

		assert.True(t, channelMember.SchemeAdmin)
		assert.True(t, channelMember.SchemeUser)
		assert.False(t, channelMember.SchemeGuest)
		assert.Equal(t, "", channelMember.ExplicitRoles)

		// Test importing deleted user with a valid team & valid channel name in apply mode.
		username = model.NewUsername()
		deleteAt := model.GetMillis()
		deletedUserData := &imports.UserImportData{
			Username: &username,
			DeleteAt: &deleteAt,
			Email:    model.NewPointer(model.NewId() + "@example.com"),
			Teams: &[]imports.UserTeamImportData{
				{
					Name:  &team.Name,
					Roles: model.NewPointer("team_user"),
					Channels: &[]imports.UserChannelImportData{
						{
							Name:  &channel.Name,
							Roles: model.NewPointer("channel_user"),
						},
					},
				},
			},
		}
		appErr2 = th.App.importUser(th.Context, deletedUserData, false)
		assert.Nil(t, appErr2)

		user, appErr2 = th.App.GetUserByUsername(*deletedUserData.Username)
		require.Nil(t, appErr2, "Failed to get user from database.")

		teamMember, appErr2 = th.App.GetTeamMember(th.Context, team.Id, user.Id)
		require.Nil(t, appErr2, "Failed to get the team member")

		assert.False(t, teamMember.SchemeAdmin)
		assert.True(t, teamMember.SchemeUser)
		assert.False(t, teamMember.SchemeGuest)
		assert.Equal(t, "", teamMember.ExplicitRoles)

		channelMember, appErr2 = th.App.GetChannelMember(th.Context, channel.Id, user.Id)
		require.Nil(t, appErr2, "Failed to get the channel member")

		assert.False(t, channelMember.SchemeAdmin)
		assert.True(t, channelMember.SchemeUser)
		assert.False(t, channelMember.SchemeGuest)
		assert.Equal(t, "", channelMember.ExplicitRoles)
	})

	t.Run("import deleted guest with a valid team & valid channel name in apply mode", func(t *testing.T) {
		teamData := &imports.TeamImportData{
			Name:            model.NewPointer(model.NewRandomTeamName()),
			DisplayName:     model.NewPointer("Display Name"),
			Type:            model.NewPointer("O"),
			Description:     model.NewPointer("The team description."),
			AllowOpenInvite: model.NewPointer(true),
		}
		appErr := th.App.importTeam(th.Context, teamData, false)
		assert.Nil(t, appErr)

		team, appErr2 := th.App.GetTeamByName(*teamData.Name)
		require.Nil(t, appErr2, "Failed to get team from database.")

		channelData := &imports.ChannelImportData{
			Team:        teamData.Name,
			Name:        model.NewPointer(NewTestId()),
			DisplayName: model.NewPointer("Display Name"),
			Type:        model.NewPointer(model.ChannelTypeOpen),
			Header:      model.NewPointer("Channel Header"),
			Purpose:     model.NewPointer("Channel Purpose"),
		}
		appErr2 = th.App.importChannel(th.Context, channelData, false)
		assert.Nil(t, appErr2)
		channel, appErr2 := th.App.GetChannelByName(th.Context, *channelData.Name, team.Id, false)
		require.Nil(t, appErr2, "Failed to get channel from database")

		username := model.NewUsername()
		deleteAt := model.GetMillis()
		deletedGuestData := &imports.UserImportData{
			Username: &username,
			DeleteAt: &deleteAt,
			Email:    model.NewPointer(model.NewId() + "@example.com"),
			Roles:    model.NewPointer("system_guest"),
			Teams: &[]imports.UserTeamImportData{
				{
					Name:  &team.Name,
					Roles: model.NewPointer("team_guest"),
					Channels: &[]imports.UserChannelImportData{
						{
							Name:  &channel.Name,
							Roles: model.NewPointer("channel_guest"),
						},
					},
				},
			},
		}

		appErr = th.App.importUser(th.Context, deletedGuestData, false)
		assert.Nil(t, appErr)

		user, appErr := th.App.GetUserByUsername(*deletedGuestData.Username)
		require.Nil(t, appErr, "Failed to get user from database.")

		teamMember, appErr := th.App.GetTeamMember(th.Context, team.Id, user.Id)
		require.Nil(t, appErr, "Failed to get the team member")

		assert.False(t, teamMember.SchemeAdmin)
		assert.False(t, teamMember.SchemeUser)
		assert.True(t, teamMember.SchemeGuest)
		assert.Equal(t, "", teamMember.ExplicitRoles)

		channelMember, appErr := th.App.GetChannelMember(th.Context, channel.Id, user.Id)
		require.Nil(t, appErr, "Failed to get the channel member")

		assert.False(t, teamMember.SchemeAdmin)
		assert.False(t, channelMember.SchemeUser)
		assert.True(t, teamMember.SchemeGuest)
		assert.Equal(t, "", channelMember.ExplicitRoles)
	})
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
					Name: model.NewPointer("not-existing-team-name"),
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
			name: "Should fail if one of the roles doesn't exist",
			data: &[]imports.UserTeamImportData{
				{
					Name:  &th.BasicTeam.Name,
					Roles: model.NewPointer("not-existing-role"),
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
					Roles: model.NewPointer(model.TeamAdminRoleId),
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
							Name: model.NewPointer(model.DefaultChannelName),
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
							Name: model.NewPointer("town-square"),
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
				appErr := th.App.importUserTeams(th.Context, user, tc.data)
				if tc.expectedError {
					require.NotNil(t, appErr)
				} else {
					require.Nil(t, appErr)
				}
				teamMembers, nErr := th.App.Srv().Store().Team().GetTeamsForUser(th.Context, user.Id, "", true)
				require.NoError(t, nErr)
				require.Len(t, teamMembers, tc.expectedUserTeams)
				if tc.expectedUserTeams == 1 {
					require.Equal(t, tc.expectedExplicitRoles, teamMembers[0].ExplicitRoles, "Not matching expected explicit roles")
					require.Equal(t, tc.expectedRoles, teamMembers[0].Roles, "not matching expected roles")
					if tc.expectedTheme != "" {
						pref, prefErr := th.App.Srv().Store().Preference().Get(user.Id, model.PreferenceCategoryTheme, teamMembers[0].TeamId)
						require.NoError(t, prefErr)
						require.Equal(t, tc.expectedTheme, pref.Value)
					}
				}

				totalMembers := 0
				for _, teamMember := range teamMembers {
					channelMembers, err := th.App.Srv().Store().Channel().GetMembersForUser(teamMember.TeamId, user.Id)
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
		appErr := th.App.importUserTeams(th.Context, user, data)
		require.NotNil(t, appErr)
	})
}

func TestImportUserChannels(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	channel2 := th.CreateChannel(th.Context, th.BasicTeam)
	customRole := th.CreateRole("test_custom_role")
	sampleNotifyProps := imports.UserChannelNotifyPropsImportData{
		Desktop:    model.NewPointer("all"),
		Mobile:     model.NewPointer("none"),
		MarkUnread: model.NewPointer("all"),
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
					Name: model.NewPointer("not-existing-channel-name"),
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
			name: "Should fail if one of the roles doesn't exist",
			data: &[]imports.UserChannelImportData{
				{
					Name:  &th.BasicChannel.Name,
					Roles: model.NewPointer("not-existing-role"),
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
					Roles: model.NewPointer(model.ChannelAdminRoleId),
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
			_, _, err := th.App.ch.srv.teamService.JoinUserToTeam(th.Context, th.BasicTeam, user)
			require.NoError(t, err)

			// Two times import must end with the same results
			for x := 0; x < 2; x++ {
				appErr := th.App.importUserChannels(th.Context, user, th.BasicTeam, tc.data)
				if tc.expectedError {
					require.NotNil(t, appErr)
				} else {
					require.Nil(t, appErr)
				}
				channelMembers, err := th.App.Srv().Store().Channel().GetMembersForUser(th.BasicTeam.Id, user.Id)
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
	username := model.NewUsername()
	data := imports.UserImportData{
		Username: &username,
		Email:    model.NewPointer(model.NewId() + "@example.com"),
		NotifyProps: &imports.UserNotifyPropsImportData{
			Email:       model.NewPointer("false"),
			MentionKeys: model.NewPointer(""),
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
	appErr := th.App.importTeam(th.Context, &imports.TeamImportData{
		Name:        &teamName,
		DisplayName: model.NewPointer("Display Name"),
		Type:        model.NewPointer("O"),
	}, false)
	require.Nil(t, appErr, "Failed to import team.")
	team, err := th.App.GetTeamByName(teamName)
	require.Nil(t, err, "Failed to get team from database.")

	// Create a Channel.
	channelName := NewTestId()
	chanTypeOpen := model.ChannelTypeOpen
	appErr = th.App.importChannel(th.Context, &imports.ChannelImportData{
		Team:        &teamName,
		Name:        &channelName,
		DisplayName: model.NewPointer("Display Name"),
		Type:        &chanTypeOpen,
	}, false)
	require.Nil(t, appErr, "Failed to import channel.")
	channel, err := th.App.GetChannelByName(th.Context, channelName, team.Id, false)
	require.Nil(t, err, "Failed to get channel from database.")

	// Create a user.
	username := model.NewUsername()
	appErr = th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username,
		Email:    model.NewPointer(model.NewId() + "@example.com"),
	}, false)
	require.Nil(t, appErr, "Failed to import user.")
	user, err := th.App.GetUserByUsername(username)
	require.Nil(t, err, "Failed to get user from database.")

	username2 := model.NewUsername()
	appErr = th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username2,
		Email:    model.NewPointer(model.NewId() + "@example.com"),
	}, false)
	require.Nil(t, appErr, "Failed to import user.")
	user2, err := th.App.GetUserByUsername(username2)
	require.Nil(t, err, "Failed to get user from database.")

	// Count the number of posts in the testing team.
	require.NoError(t, th.App.Srv().Store().Post().RefreshPostStats())
	initialPostCount, nErr := th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{TeamId: team.Id})
	require.NoError(t, nErr)

	createAt := model.GetMillis()
	hashtagTime := createAt + 2
	replyPostTime := hashtagTime + 4
	replyTime := hashtagTime + 5

	var assertionCount int64

	t.Run("invalid post in dry run mode", func(t *testing.T) {
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
		errLine, err2 := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, true, true)
		assert.NotNil(t, err2)
		assert.Equal(t, data.LineNumber, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)
	})

	t.Run("valid post in dry run mode", func(t *testing.T) {
		// Try adding a valid post in dry run mode.
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username,
					Message:  model.NewPointer("Hello"),
					CreateAt: model.NewPointer(model.GetMillis()),
				},
			},
			LineNumber: 1,
		}
		errLine, err2 := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, true, true)
		assert.Nil(t, err2)
		assert.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)
	})

	t.Run("invalid post in apply mode", func(t *testing.T) {
		// Try adding an invalid post in apply mode.
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username,
					CreateAt: model.NewPointer(model.GetMillis()),
				},
			},
			LineNumber: 35,
		}
		errLine, err2 := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		assert.NotNil(t, err2)
		assert.Equal(t, data.LineNumber, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)
	})

	t.Run("valid post with invalid team in apply mode", func(t *testing.T) {
		// Try adding a valid post with invalid team in apply mode.
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     model.NewPointer(NewTestId()),
					Channel:  &channelName,
					User:     &username,
					Message:  model.NewPointer("Message"),
					CreateAt: model.NewPointer(model.GetMillis()),
				},
			},
			LineNumber: 10,
		}
		errLine, err2 := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		assert.NotNil(t, err2)
		// Batch will fail when searching for teams, so no specific line
		// is associated with the error
		assert.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)
	})

	t.Run("valid post with invalid channel in apply mode", func(t *testing.T) {
		// Try adding a valid post with invalid channel in apply mode.
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  model.NewPointer(NewTestId()),
					User:     &username,
					Message:  model.NewPointer("Message"),
					CreateAt: model.NewPointer(model.GetMillis()),
				},
			},
			LineNumber: 7,
		}
		errLine, err2 := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		assert.NotNil(t, err2)
		// Batch will fail when searching for channels, so no specific
		// line is associated with the error
		assert.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)
	})

	t.Run("valid post with invalid user in apply mode", func(t *testing.T) {
		// Try adding a valid post with invalid user in apply mode.
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     model.NewPointer(model.NewId()),
					Message:  model.NewPointer("Message"),
					CreateAt: model.NewPointer(model.GetMillis()),
				},
			},
			LineNumber: 2,
		}
		errLine, err2 := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		assert.NotNil(t, err2)
		// Batch will fail when searching for users, so no specific line
		// is associated with the error
		assert.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)
	})

	t.Run("valid post in apply mode", func(t *testing.T) {
		// Try adding a valid post in apply mode.
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username,
					Message:  model.NewPointer("Message"),
					CreateAt: &createAt,
				},
			},
			LineNumber: 1,
		}
		errLine, err2 := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		assert.Nil(t, err2)
		assert.Equal(t, 0, errLine)
		assertionCount++
		AssertAllPostsCount(t, th.App, initialPostCount, assertionCount, team.Id)

		// Check the post values.
		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, createAt)
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
					Message:  model.NewPointer("Message"),
					CreateAt: &createAt,
				},
			},
			LineNumber: 1,
		}
		errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		assert.Nil(t, err)
		assert.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, assertionCount, team.Id)

		// Check the post values.
		posts, nErr = th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, createAt)
		require.NoError(t, nErr)

		require.Len(t, posts, 1, "Unexpected number of posts found.")

		post = posts[0]
		postBool = post.Message != *data.Post.Message || post.CreateAt != *data.Post.CreateAt || post.UserId != user.Id
		require.False(t, postBool, "Post properties not as expected")
	})

	t.Run("import the post with a different time", func(t *testing.T) {
		// Save the post with a different time.
		newTime := createAt + 1
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username,
					Message:  model.NewPointer("Message"),
					CreateAt: &newTime,
				},
			},
			LineNumber: 1,
		}
		errLine, err2 := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		assert.Nil(t, err2)
		assert.Equal(t, 0, errLine)
		assertionCount++
		AssertAllPostsCount(t, th.App, initialPostCount, assertionCount, team.Id)
	})

	t.Run("import the post with a different message", func(t *testing.T) {
		// Save the post with a different message.
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username,
					Message:  model.NewPointer("Message 2"),
					CreateAt: &createAt,
				},
			},
			LineNumber: 1,
		}
		errLine, err2 := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		assert.Nil(t, err2)
		assert.Equal(t, 0, errLine)
		assertionCount++
		AssertAllPostsCount(t, th.App, initialPostCount, assertionCount, team.Id)
	})

	t.Run("import post with hashtags", func(t *testing.T) {
		// Test with hashtags
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username,
					Message:  model.NewPointer("Message 2 #hashtagmashupcity"),
					CreateAt: &hashtagTime,
				},
			},
			LineNumber: 1,
		}
		errLine, err2 := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		assert.Nil(t, err2)
		assert.Equal(t, 0, errLine)
		assertionCount++
		AssertAllPostsCount(t, th.App, initialPostCount, assertionCount, team.Id)

		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, hashtagTime)
		require.NoError(t, nErr)

		require.Len(t, posts, 1, "Unexpected number of posts found.")

		post := posts[0]
		postBool := post.Message != *data.Post.Message || post.CreateAt != *data.Post.CreateAt || post.UserId != user.Id
		require.False(t, postBool, "Post properties not as expected")

		require.Equal(t, "#hashtagmashupcity", post.Hashtags, "Hashtags not as expected: %s", post.Hashtags)
	})

	t.Run("import post with flags", func(t *testing.T) {
		// Post with flags.
		flagsTime := hashtagTime + 1
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username,
					Message:  model.NewPointer("Message with Favorites"),
					CreateAt: &flagsTime,
					FlaggedBy: &[]string{
						username,
						username2,
					},
				},
			},
			LineNumber: 1,
		}

		errLine, err2 := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		assert.Nil(t, err2, "Expected success.")
		assert.Equal(t, 0, errLine)
		assertionCount++
		AssertAllPostsCount(t, th.App, initialPostCount, assertionCount, team.Id)

		// Check the post values.
		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, flagsTime)
		require.NoError(t, nErr)

		require.Len(t, posts, 1, "Unexpected number of posts found.")

		post := posts[0]
		postBool := post.Message != *data.Post.Message || post.CreateAt != *data.Post.CreateAt || post.UserId != user.Id
		require.False(t, postBool, "Post properties not as expected")

		checkPreference(t, th.App, user.Id, model.PreferenceCategoryFlaggedPost, post.Id, "true")
		checkPreference(t, th.App, user2.Id, model.PreferenceCategoryFlaggedPost, post.Id, "true")
	})

	t.Run("import new post with reactions", func(t *testing.T) {
		// Post with reaction.
		reactionPostTime := hashtagTime + 2
		reactionTime := hashtagTime + 3
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username,
					Message:  model.NewPointer("Message with reactions"),
					CreateAt: &reactionPostTime,
					Reactions: &[]imports.ReactionImportData{{
						User:      &user2.Username,
						EmojiName: model.NewPointer("+1"),
						CreateAt:  &reactionTime,
					}, {
						User:      &user.Username,
						EmojiName: model.NewPointer("+1"),
						CreateAt:  &reactionTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err2 := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		assert.Nil(t, err2, "Expected success.")
		assert.Equal(t, 0, errLine)
		assertionCount++
		AssertAllPostsCount(t, th.App, initialPostCount, assertionCount, team.Id)

		// Check the post values.
		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, reactionPostTime)
		require.NoError(t, nErr)

		require.Len(t, posts, 1, "Unexpected number of posts found.")

		post := posts[0]
		postBool := post.Message != *data.Post.Message || post.CreateAt != *data.Post.CreateAt || post.UserId != user.Id || !post.HasReactions
		require.False(t, postBool, "Post properties not as expected")

		reactions, nErr := th.App.Srv().Store().Reaction().GetForPost(post.Id, false)
		require.NoError(t, nErr, "Can't get reaction")

		require.Len(t, reactions, 2, "Invalid number of reactions")

		// Update post with replies with reactions.
		newReactionTime := reactionTime + 1
		newReplyTime := reactionPostTime + 1
		data = imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username,
					Message:  model.NewPointer("Message with reactions"),
					CreateAt: &reactionPostTime,
					Replies: &[]imports.ReplyImportData{{
						User:     &username,
						Message:  model.NewPointer("Message reply"),
						CreateAt: &newReplyTime,
						Reactions: &[]imports.ReactionImportData{{
							User:      &user2.Username,
							EmojiName: model.NewPointer("+1"),
							CreateAt:  &newReactionTime,
						}},
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		assert.Nil(t, err, "Expected success.")
		assert.Equal(t, 0, errLine)
		// No new post created, only the reply is added.
		assertionCount++
		AssertAllPostsCount(t, th.App, initialPostCount, assertionCount, team.Id)

		// Check the post values.
		posts, nErr = th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, newReplyTime)
		require.NoError(t, nErr)

		require.Len(t, posts, 1, "Unexpected number of posts found.")

		post = posts[0]

		reactions, nErr = th.App.Srv().Store().Reaction().GetForPost(post.Id, false)
		require.NoError(t, nErr, "Can't get reaction")

		require.Len(t, reactions, 1, "Invalid number of reactions")
	})

	t.Run("import post with reactions with new replies", func(t *testing.T) {
		// Post with reaction.
		reactionPostTime := hashtagTime + 11
		reactionTime := hashtagTime + 12
		newReplyTime := reactionPostTime + 1
		newReactionTime := reactionTime + 1
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username,
					Message:  model.NewPointer("Message with reaction"),
					CreateAt: &reactionPostTime,
					Reactions: &[]imports.ReactionImportData{{
						User:      &user2.Username,
						EmojiName: model.NewPointer("+1"),
						CreateAt:  &reactionTime,
					}},
					Replies: &[]imports.ReplyImportData{{
						User:     &username,
						Message:  model.NewPointer("Message reply"),
						CreateAt: &newReplyTime,
						Reactions: &[]imports.ReactionImportData{{
							User:      &user2.Username,
							EmojiName: model.NewPointer("+1"),
							CreateAt:  &newReactionTime,
						}},
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err2 := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		assert.Nil(t, err2, "Expected success.")
		assert.Equal(t, 0, errLine)
		assertionCount += 2
		AssertAllPostsCount(t, th.App, initialPostCount, assertionCount, team.Id)

		// Check the post values.
		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, reactionPostTime)
		require.NoError(t, nErr)

		require.Len(t, posts, 1, "Unexpected number of posts found.")

		post := posts[0]
		postBool := post.Message != *data.Post.Message || post.CreateAt != *data.Post.CreateAt || post.UserId != user.Id || !post.HasReactions
		require.False(t, postBool, "Post properties not as expected")

		reactions, nErr := th.App.Srv().Store().Reaction().GetForPost(post.Id, false)
		require.NoError(t, nErr, "Can't get reaction")

		require.Len(t, reactions, 1, "Invalid number of reactions")

		// Check the post values.
		posts, nErr = th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, newReplyTime)
		require.NoError(t, nErr)

		require.Len(t, posts, 1, "Unexpected number of posts found.")

		post = posts[0]

		reactions, nErr = th.App.Srv().Store().Reaction().GetForPost(post.Id, false)
		require.NoError(t, nErr, "Can't get reaction")

		require.Len(t, reactions, 1, "Invalid number of reactions")
	})

	t.Run("import post with replies", func(t *testing.T) {
		// Post with reply.
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username,
					Message:  model.NewPointer("Message with reply"),
					CreateAt: &replyPostTime,
					Replies: &[]imports.ReplyImportData{{
						User:     &user2.Username,
						Message:  model.NewPointer("Message reply"),
						CreateAt: &replyTime,
						Props:    &model.StringInterface{"key": "value"},
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err2 := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		assert.Nil(t, err2, "Expected success.")
		assert.Equal(t, 0, errLine)
		assertionCount += 2
		AssertAllPostsCount(t, th.App, initialPostCount, assertionCount, team.Id)

		// Check the post values.
		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, replyPostTime)
		require.NoError(t, nErr)

		require.Len(t, posts, 1, "Unexpected number of posts found.")

		post := posts[0]
		postBool := post.Message != *data.Post.Message || post.CreateAt != *data.Post.CreateAt || post.UserId != user.Id
		require.False(t, postBool, "Post properties not as expected")

		// Check the reply values.
		replies, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, replyTime)
		require.NoError(t, nErr)

		require.Len(t, replies, 1, "Unexpected number of posts found.")

		reply := replies[0]
		replyBool := reply.Message != *(*data.Post.Replies)[0].Message || reply.CreateAt != *(*data.Post.Replies)[0].CreateAt || reply.UserId != user2.Id
		require.False(t, replyBool, "Post properties not as expected")

		v := reply.GetProp("key")
		require.NotNil(t, v, "Post prop should exist")
		require.Equal(t, "value", v, "Post props not as expected")

		require.Equal(t, post.Id, reply.RootId, "Unexpected reply RootId")
	})

	t.Run("update post with replies", func(t *testing.T) {
		replyPostTime2 := replyPostTime + 1
		// Create post without replies.
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &user2.Username,
					Message:  model.NewPointer("Message with reply"),
					CreateAt: &replyPostTime2,
				},
			},
			LineNumber: 1,
		}
		errLine, err2 := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		assert.Nil(t, err2, "Expected success.")
		assert.Equal(t, 0, errLine)
		assertionCount++
		AssertAllPostsCount(t, th.App, initialPostCount, assertionCount, team.Id)

		// Update post with replies.
		data = imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &user2.Username,
					Message:  model.NewPointer("Message with reply"),
					CreateAt: &replyPostTime2,
					Replies: &[]imports.ReplyImportData{{
						User:     &username,
						Message:  model.NewPointer("Message reply"),
						CreateAt: &replyTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		assert.Nil(t, err, "Expected success.")
		assert.Equal(t, 0, errLine)
		// No new post created, only the reply is added.
		assertionCount++
		AssertAllPostsCount(t, th.App, initialPostCount, assertionCount, team.Id)

		// Create new post with replies based on the previous one.
		data = imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &user2.Username,
					Message:  model.NewPointer("Message with reply 2"),
					CreateAt: &replyPostTime2,
					Replies: &[]imports.ReplyImportData{{
						User:     &username,
						Message:  model.NewPointer("Message reply"),
						CreateAt: &replyTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		assert.Nil(t, err, "Expected success.")
		assert.Equal(t, 0, errLine)
		assertionCount += 2
		AssertAllPostsCount(t, th.App, initialPostCount, assertionCount, team.Id)

		// Create new reply for existing post with replies.
		data = imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &user2.Username,
					Message:  model.NewPointer("Message with reply"),
					CreateAt: &replyPostTime2,
					Replies: &[]imports.ReplyImportData{{
						User:     &username,
						Message:  model.NewPointer("Message reply 2"),
						CreateAt: &replyTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		assert.Nil(t, err, "Expected success.")
		assert.Equal(t, 0, errLine)
		assertionCount++
		AssertAllPostsCount(t, th.App, initialPostCount, assertionCount, team.Id)

		// Create new reply with type and edit_at for existing post with replies.
		editedReplyPostTime := hashtagTime + 6
		editedReplyTime := hashtagTime + 7
		editedReplyEditTime := hashtagTime + 8

		data = imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &user2.Username,
					Message:  model.NewPointer("Message with reply"),
					CreateAt: &editedReplyPostTime,
					Replies: &[]imports.ReplyImportData{{
						User:     &username,
						Type:     model.NewPointer(model.PostTypeSystemGeneric),
						Message:  model.NewPointer("Message reply 3"),
						CreateAt: &editedReplyTime,
						EditAt:   &editedReplyEditTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		assert.Nil(t, err, "Expected success.")
		assert.Equal(t, 0, errLine)
		assertionCount += 2
		AssertAllPostsCount(t, th.App, initialPostCount, assertionCount, team.Id)

		// Check the reply values.
		replies, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, editedReplyTime)
		assert.NoError(t, nErr, "Expected success.")
		reply := replies[0]
		importReply := (*data.Post.Replies)[0]
		replyBool := reply.Type != *importReply.Type || reply.Message != *importReply.Message || reply.CreateAt != *importReply.CreateAt || reply.EditAt != *importReply.EditAt || reply.UserId != user.Id
		require.False(t, replyBool, "Post properties not as expected")
	})

	t.Run("import post with pinned message", func(t *testing.T) {
		// Create another Team.
		teamName2 := model.NewRandomTeamName()
		appErr := th.App.importTeam(th.Context, &imports.TeamImportData{
			Name:        &teamName2,
			DisplayName: model.NewPointer("Display Name 2"),
			Type:        model.NewPointer("O"),
		}, false)
		require.Nil(t, appErr, "Failed to import team.")
		team2, err2 := th.App.GetTeamByName(teamName2)
		require.Nil(t, err2, "Failed to get team from database.")

		// Create another Channel for the another team.
		appErr = th.App.importChannel(th.Context, &imports.ChannelImportData{
			Team:        &teamName2,
			Name:        &channelName,
			DisplayName: model.NewPointer("Display Name"),
			Type:        &chanTypeOpen,
		}, false)
		require.Nil(t, appErr, "Failed to import channel.")
		_, err = th.App.GetChannelByName(th.Context, channelName, team2.Id, false)
		require.Nil(t, err, "Failed to get channel from database.")

		// Count the number of posts in the team2.
		require.NoError(t, th.App.Srv().Store().Post().RefreshPostStats())
		initialPostCountForTeam2, nErr := th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{TeamId: team2.Id})
		require.NoError(t, nErr)

		// Try adding two valid posts in apply mode.
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username,
					Message:  model.NewPointer("another message"),
					CreateAt: &createAt,
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
					Message:  model.NewPointer("another message"),
					CreateAt: &createAt,
				},
			},
			LineNumber: 1,
		}
		errLine, err2 := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data, data2}, false, true)
		assert.Nil(t, err2)
		assert.Equal(t, 0, errLine)

		// Create a pinned message.
		data = imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &user2.Username,
					Message:  model.NewPointer("Pinned Message"),
					CreateAt: model.NewPointer(model.GetMillis()),
					IsPinned: model.NewPointer(true),
				},
			},
			LineNumber: 1,
		}
		errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)

		resultPosts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, *data.Post.CreateAt)
		require.NoError(t, nErr, "Expected success.")
		// Should be one post only created at this time.
		require.Equal(t, 1, len(resultPosts))
		resultPost := resultPosts[0]
		require.True(t, resultPost.IsPinned, "This post should be pinned.")

		// Posts should be added to the right team
		AssertAllPostsCount(t, th.App, initialPostCountForTeam2, 1, team2.Id)
		assertionCount += 2
		AssertAllPostsCount(t, th.App, initialPostCount, assertionCount, team.Id)
	})

	t.Run("Importing a post with a reply both pinned", func(t *testing.T) {
		// Create a thread.
		importCreate := time.Now().Add(-1 * time.Minute).UnixMilli()
		replyCreate := time.Now().Add(-30 * time.Second).UnixMilli()
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &user.Username,
					Message:  model.NewPointer("Thread Message"),
					CreateAt: model.NewPointer(importCreate),
					IsPinned: model.NewPointer(true),
					Replies: &[]imports.ReplyImportData{{
						User:     &user.Username,
						Message:  model.NewPointer("Reply"),
						CreateAt: model.NewPointer(replyCreate),
						IsPinned: model.NewPointer(true),
					}},
				},
			},
			LineNumber: 1,
		}

		_, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err)

		resultPosts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, importCreate)
		require.NoError(t, nErr)
		require.Equal(t, 1, len(resultPosts))
		require.True(t, resultPosts[0].IsPinned)

		resultPosts, nErr = th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, replyCreate)
		require.NoError(t, nErr)
		require.Equal(t, 1, len(resultPosts))
		require.True(t, resultPosts[0].IsPinned)
	})

	t.Run("Importing a post with a thread", func(t *testing.T) {
		// Create a thread.
		importCreate := time.Now().Add(-1 * time.Minute).UnixMilli()
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &user.Username,
					Message:  model.NewPointer("Thread Message"),
					CreateAt: model.NewPointer(importCreate),
					Replies: &[]imports.ReplyImportData{{
						User:     &user.Username,
						Message:  model.NewPointer("Reply"),
						CreateAt: model.NewPointer(model.GetMillis()),
					}},
					ThreadFollowers: &[]imports.ThreadFollowerImportData{{
						User:       &user.Username,
						LastViewed: model.NewPointer(model.GetMillis()),
					}, {
						User:       &user2.Username,
						LastViewed: model.NewPointer(model.GetMillis()),
					}},
				},
			},
			LineNumber: 1,
		}

		errLine, err2 := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err2)
		require.Equal(t, 0, errLine)

		resultPosts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, importCreate)
		require.NoError(t, nErr)
		require.Equal(t, 1, len(resultPosts))

		followers, nErr := th.App.Srv().Store().Thread().GetThreadFollowers(resultPosts[0].Id, true)
		require.NoError(t, nErr)

		assert.ElementsMatch(t, []string{user.Id, user2.Id}, followers)
	})

	t.Run("Importing a post with a non existent follower", func(t *testing.T) {
		// Create a thread.
		importCreate := time.Now().Add(-1 * time.Minute).UnixMilli()
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &user.Username,
					Message:  model.NewPointer("Thread Message"),
					CreateAt: model.NewPointer(importCreate),
					Replies: &[]imports.ReplyImportData{{
						User:     &user.Username,
						Message:  model.NewPointer("Reply"),
						CreateAt: model.NewPointer(model.GetMillis()),
					}},
					ThreadFollowers: &[]imports.ThreadFollowerImportData{{
						User:       &user.Username,
						LastViewed: model.NewPointer(model.GetMillis()),
					}, {
						User: model.NewPointer("invalid.user"),
					}},
				},
			},
			LineNumber: 1,
		}

		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.NotNil(t, err)
		require.Equal(t, 1, errLine)
	})

	t.Run("Importing a post with a non existent follower", func(t *testing.T) {
		importCreate := time.Now().Add(-1 * time.Minute).UnixMilli()
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &user.Username,
					Message:  model.NewPointer("Thread Message"),
					CreateAt: model.NewPointer(importCreate),
					Replies: &[]imports.ReplyImportData{{
						User:     &user.Username,
						Message:  model.NewPointer("Reply"),
						CreateAt: model.NewPointer(model.GetMillis()),
					}},
					ThreadFollowers: &[]imports.ThreadFollowerImportData{{
						User:       &user.Username,
						LastViewed: model.NewPointer(model.GetMillis()),
					}, {
						User: model.NewPointer("invalid.user"),
					}},
				},
			},
			LineNumber: 1,
		}

		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.NotNil(t, err)
		require.Equal(t, 1, errLine)
	})

	t.Run("Importing a post with new followers", func(t *testing.T) {
		importCreate := time.Now().Add(-5 * time.Minute).UnixMilli()
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &username,
					Message:  model.NewPointer("Hello"),
					CreateAt: model.NewPointer(importCreate),
				},
			},
			LineNumber: 1,
		}

		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)

		resultPosts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, importCreate)
		require.NoError(t, nErr)
		require.Equal(t, 1, len(resultPosts))

		data = imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &user.Username,
					Message:  model.NewPointer("Hello"),
					CreateAt: model.NewPointer(importCreate),
					Replies: &[]imports.ReplyImportData{{
						User:     &user.Username,
						Message:  model.NewPointer("Reply"),
						CreateAt: model.NewPointer(model.GetMillis()),
					}},
					ThreadFollowers: &[]imports.ThreadFollowerImportData{{
						User:       &user.Username,
						LastViewed: model.NewPointer(model.GetMillis()),
					}},
				},
			},
			LineNumber: 1,
		}

		errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)

		followers, nErr := th.App.Srv().Store().Thread().GetThreadFollowers(resultPosts[0].Id, true)
		require.NoError(t, nErr)

		assert.ElementsMatch(t, []string{user.Id}, followers)
	})

	t.Run("Importing a post that someone flagged", func(t *testing.T) {
		// Create a thread.
		importCreate := time.Now().Add(-1 * time.Minute).UnixMilli()
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:      &teamName,
					Channel:   &channelName,
					User:      &user.Username,
					Message:   model.NewPointer("Flagged Message"),
					CreateAt:  model.NewPointer(importCreate),
					FlaggedBy: &[]string{user.Username},
				},
			},
			LineNumber: 1,
		}

		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)

		resultPosts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, importCreate)
		require.NoError(t, nErr)
		require.Equal(t, 1, len(resultPosts))

		pref, nErr := th.App.ch.srv.Store().Preference().GetCategoryAndName(model.PreferenceCategoryFlaggedPost, resultPosts[0].Id)
		require.NoError(t, nErr)

		require.Len(t, pref, 1)
		assert.Equal(t, user.Id, pref[0].UserId)
	})

	t.Run("Importing a post that someone flagged its replies", func(t *testing.T) {
		// Create a thread.
		importCreate := time.Now().Add(-1 * time.Minute).UnixMilli()
		replyCreate := time.Now().Add(-30 * time.Second).UnixMilli()
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  &channelName,
					User:     &user.Username,
					Message:  model.NewPointer("Flagged Message"),
					CreateAt: model.NewPointer(importCreate),
					Replies: &[]imports.ReplyImportData{{
						User:      &user.Username,
						Message:   model.NewPointer("Reply"),
						CreateAt:  model.NewPointer(replyCreate),
						FlaggedBy: &[]string{user2.Username},
					}},
				},
			},
			LineNumber: 1,
		}

		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)

		resultPosts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, replyCreate)
		require.NoError(t, nErr)
		require.Equal(t, 1, len(resultPosts))

		pref, nErr := th.App.ch.srv.Store().Preference().GetCategoryAndName(model.PreferenceCategoryFlaggedPost, resultPosts[0].Id)
		require.NoError(t, nErr)

		require.Len(t, pref, 1)
		assert.Equal(t, user2.Id, pref[0].UserId)
	})
}

func TestImportImportPost(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Create a Team.
	teamName := model.NewRandomTeamName()
	appErr := th.App.importTeam(th.Context, &imports.TeamImportData{
		Name:        &teamName,
		DisplayName: model.NewPointer("Display Name"),
		Type:        model.NewPointer("O"),
	}, false)
	require.Nil(t, appErr, "Failed to import team.")
	team, appErr := th.App.GetTeamByName(teamName)
	require.Nil(t, appErr, "Failed to get team from database.")

	// Create a Channel.
	channelName := NewTestId()
	chanTypeOpen := model.ChannelTypeOpen
	appErr = th.App.importChannel(th.Context, &imports.ChannelImportData{
		Team:        &teamName,
		Name:        &channelName,
		DisplayName: model.NewPointer("Display Name"),
		Type:        &chanTypeOpen,
	}, false)
	require.Nil(t, appErr, "Failed to import channel.")
	channel, appErr := th.App.GetChannelByName(th.Context, channelName, team.Id, false)
	require.Nil(t, appErr, "Failed to get channel from database.")

	// Create a user.
	username := model.NewUsername()
	appErr = th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username,
		Email:    model.NewPointer(model.NewId() + "@example.com"),
	}, false)
	require.Nil(t, appErr, "Failed to import user.")
	user, appErr := th.App.GetUserByUsername(username)
	require.Nil(t, appErr, "Failed to get user from database.")

	username2 := model.NewUsername()
	appErr = th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username2,
		Email:    model.NewPointer(model.NewId() + "@example.com"),
	}, false)
	require.Nil(t, appErr, "Failed to import user.")
	user2, appErr := th.App.GetUserByUsername(username2)
	require.Nil(t, appErr, "Failed to get user from database.")

	// Count the number of posts in the testing team.
	require.NoError(t, th.App.Srv().Store().Post().RefreshPostStats())
	initialPostCount, nErr := th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{TeamId: team.Id})
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
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, true, true)
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
					Message:  model.NewPointer("Hello"),
					CreateAt: model.NewPointer(model.GetMillis()),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, true, true)
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
					CreateAt: model.NewPointer(model.GetMillis()),
				},
			},
			LineNumber: 2,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		assert.NotNil(t, err)
		assert.Equal(t, data.LineNumber, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)
	})

	t.Run("Try adding a valid post with invalid team in apply mode", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     model.NewPointer(NewTestId()),
					Channel:  &channelName,
					User:     &username,
					Message:  model.NewPointer("Message"),
					CreateAt: model.NewPointer(model.GetMillis()),
				},
			},
			LineNumber: 7,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		assert.NotNil(t, err)
		assert.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)
	})

	t.Run("Try adding a valid post with invalid channel in apply mode", func(t *testing.T) {
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				Post: &imports.PostImportData{
					Team:     &teamName,
					Channel:  model.NewPointer(NewTestId()),
					User:     &username,
					Message:  model.NewPointer("Message"),
					CreateAt: model.NewPointer(model.GetMillis()),
				},
			},
			LineNumber: 8,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
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
					User:     model.NewPointer(model.NewId()),
					Message:  model.NewPointer("Message"),
					CreateAt: model.NewPointer(model.GetMillis()),
				},
			},
			LineNumber: 9,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
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
					Message:  model.NewPointer("Message"),
					CreateAt: &time,
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		assert.Nil(t, err)
		assert.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 1, team.Id)

		// Check the post values.
		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, time)
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
					Message:  model.NewPointer("Message"),
					CreateAt: &time,
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		assert.Nil(t, err)
		assert.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 1, team.Id)

		// Check the post values.
		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, time)
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
					Message:  model.NewPointer("Message"),
					CreateAt: &newTime,
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
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
					Message:  model.NewPointer("Message 2"),
					CreateAt: &time,
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
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
					Message:  model.NewPointer("Message 2 #hashtagmashupcity"),
					CreateAt: &hashtagTime,
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		assert.Nil(t, err)
		assert.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 4, team.Id)

		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, hashtagTime)
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
					Message:  model.NewPointer("Message with Favorites"),
					CreateAt: &flagsTime,
					FlaggedBy: &[]string{
						username,
						username2,
					},
				},
			},
			LineNumber: 1,
		}

		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 5, team.Id)

		// Check the post values.
		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, flagsTime)
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
					Message:  model.NewPointer("Message with reaction"),
					CreateAt: &reactionPostTime,
					Reactions: &[]imports.ReactionImportData{{
						User:      &user2.Username,
						EmojiName: model.NewPointer("+1"),
						CreateAt:  &reactionTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 6, team.Id)

		// Check the post values.
		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, reactionPostTime)
		require.NoError(t, nErr)

		require.Len(t, posts, 1, "Unexpected number of posts found.")

		post := posts[0]
		postBool := post.Message != *data.Post.Message || post.CreateAt != *data.Post.CreateAt || post.UserId != user.Id || !post.HasReactions
		require.False(t, postBool, "Post properties not as expected")

		reactions, nErr := th.App.Srv().Store().Reaction().GetForPost(post.Id, false)
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
					Message:  model.NewPointer("Message with reply"),
					CreateAt: &replyPostTime,
					Replies: &[]imports.ReplyImportData{{
						User:     &user2.Username,
						Message:  model.NewPointer("Message reply"),
						CreateAt: &replyTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 8, team.Id)

		// Check the post values.
		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, replyPostTime)
		require.NoError(t, nErr)

		require.Len(t, posts, 1, "Unexpected number of posts found.")

		post := posts[0]
		postBool := post.Message != *data.Post.Message || post.CreateAt != *data.Post.CreateAt || post.UserId != user.Id
		require.False(t, postBool, "Post properties not as expected")

		// Check the reply values.
		replies, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, replyTime)
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
					Message:  model.NewPointer("Message with reply"),
					CreateAt: &replyPostTime,
					Replies: &[]imports.ReplyImportData{{
						User:     &username,
						Message:  model.NewPointer("Message reply"),
						CreateAt: &replyTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
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
					Message:  model.NewPointer("Message with reply 2"),
					CreateAt: &replyPostTime,
					Replies: &[]imports.ReplyImportData{{
						User:     &username,
						Message:  model.NewPointer("Message reply"),
						CreateAt: &replyTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
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
					Message:  model.NewPointer("Message with reply"),
					CreateAt: &replyPostTime,
					Replies: &[]imports.ReplyImportData{{
						User:     &username,
						Message:  model.NewPointer("Message reply 2"),
						CreateAt: &replyTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
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
					Type:     model.NewPointer(model.PostTypeSystemGeneric),
					Message:  model.NewPointer("Message with Type"),
					CreateAt: &posttypeTime,
				},
			},
			LineNumber: 1,
		}

		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 12, team.Id)

		// Check the post values.
		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, posttypeTime)
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
					Message:  model.NewPointer("Message with Type"),
					CreateAt: &editatCreateTime,
					EditAt:   &editatEditTime,
				},
			},
			LineNumber: 1,
		}

		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 13, team.Id)

		// Check the post values.
		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, editatCreateTime)
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
					Message:  model.NewPointer("Message with reply"),
					CreateAt: &now,
					Replies: &[]imports.ReplyImportData{{
						User:     &username,
						Message:  model.NewPointer("Message reply 2"),
						CreateAt: &before,
					}},
				},
			},
			LineNumber: 1,
		}

		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, now)
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
	user3 := th.CreateUser()

	// Check how many channels are in the database.
	directChannelCount, err := th.App.Srv().Store().Channel().AnalyticsTypeCount("", model.ChannelTypeDirect)
	require.NoError(t, err, "Failed to get direct channel count.")

	groupChannelCount, err := th.App.Srv().Store().Channel().AnalyticsTypeCount("", model.ChannelTypeGroup)
	require.NoError(t, err, "Failed to get group channel count.")

	// We need to generate the dataset twice to test the same data with different formats.
	generateDataset := func(data imports.DirectChannelImportData) map[string]imports.DirectChannelImportData {
		members := make([]string, len(data.Participants))
		for i, member := range data.Participants {
			members[i] = *member.Username
		}

		return map[string]imports.DirectChannelImportData{
			"Participants": data,
			"Members": {
				Members: &members,
			},
		}
	}

	t.Run("Invalid channel in dry-run mode", func(t *testing.T) {
		dataset := generateDataset(imports.DirectChannelImportData{
			Participants: []*imports.DirectChannelMemberImportData{
				{
					Username: model.NewPointer(model.NewId()),
				},
			},
			Header: model.NewPointer("Channel Header"),
		})
		for name, data := range dataset {
			t.Run(name, func(t *testing.T) {
				err = th.App.importDirectChannel(th.Context, &data, true)
				require.Error(t, err)

				// Check that no more channels are in the DB.
				AssertChannelCount(t, th.App, model.ChannelTypeDirect, directChannelCount)
				AssertChannelCount(t, th.App, model.ChannelTypeGroup, groupChannelCount)
			})
		}
	})

	t.Run("Valid DIRECT channel with a nonexistent member in dry-run mode", func(t *testing.T) {
		dataset := generateDataset(imports.DirectChannelImportData{
			Participants: []*imports.DirectChannelMemberImportData{
				{
					Username: model.NewPointer(model.NewId()),
				},
				{
					Username: model.NewPointer(model.NewId()),
				},
			},
		})
		for name, data := range dataset {
			t.Run(name, func(t *testing.T) {
				appErr := th.App.importDirectChannel(th.Context, &data, true)
				require.Nil(t, appErr)

				// Check that no more channels are in the DB.
				AssertChannelCount(t, th.App, model.ChannelTypeDirect, directChannelCount)
				AssertChannelCount(t, th.App, model.ChannelTypeGroup, groupChannelCount)
			})
		}
	})

	t.Run("Valid GROUP channel with a nonexistent member in dry-run mode", func(t *testing.T) {
		dataset := generateDataset(imports.DirectChannelImportData{
			Participants: []*imports.DirectChannelMemberImportData{
				{
					Username: model.NewPointer(model.NewId()),
				},
				{
					Username: model.NewPointer(model.NewId()),
				},
				{
					Username: model.NewPointer(model.NewId()),
				},
			},
		})
		for name, data := range dataset {
			t.Run(name, func(t *testing.T) {
				appErr := th.App.importDirectChannel(th.Context, &data, true)
				require.Nil(t, appErr)

				// Check that no more channels are in the DB.
				AssertChannelCount(t, th.App, model.ChannelTypeDirect, directChannelCount)
				AssertChannelCount(t, th.App, model.ChannelTypeGroup, groupChannelCount)
			})
		}
	})

	t.Run("Invalid channel in apply mode", func(t *testing.T) {
		dataset := generateDataset(imports.DirectChannelImportData{
			Participants: []*imports.DirectChannelMemberImportData{
				{
					Username: model.NewPointer(model.NewId()),
				},
			},
		})
		for name, data := range dataset {
			t.Run(name, func(t *testing.T) {
				err = th.App.importDirectChannel(th.Context, &data, false)
				require.Error(t, err)

				// Check that no more channels are in the DB.
				AssertChannelCount(t, th.App, model.ChannelTypeDirect, directChannelCount)
				AssertChannelCount(t, th.App, model.ChannelTypeGroup, groupChannelCount)
			})
		}
	})

	t.Run("Valid DIRECT channel ", func(t *testing.T) {
		dataset := generateDataset(imports.DirectChannelImportData{
			Participants: []*imports.DirectChannelMemberImportData{
				{
					Username: model.NewPointer(th.BasicUser.Username),
				},
				{
					Username: model.NewPointer(th.BasicUser2.Username),
				},
			},
		})
		for name, data := range dataset {
			t.Run(name, func(t *testing.T) {
				appErr := th.App.importDirectChannel(th.Context, &data, false)
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
				data.Header = model.NewPointer("New Channel Header 2")
				appErr = th.App.importDirectChannel(th.Context, &data, false)
				require.Nil(t, appErr)

				// Check that no more channels are in the DB.
				AssertChannelCount(t, th.App, model.ChannelTypeDirect, directChannelCount+1)
				AssertChannelCount(t, th.App, model.ChannelTypeGroup, groupChannelCount)

				// Get the channel to check that the header was updated.
				channel, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, th.BasicUser2.Id)
				require.Nil(t, appErr)
				require.Equal(t, channel.Header, *data.Header)
			})
		}
	})

	t.Run("GROUP channel with an extra invalid member", func(t *testing.T) {
		dataset := generateDataset(imports.DirectChannelImportData{
			Participants: []*imports.DirectChannelMemberImportData{
				{
					Username: model.NewPointer(th.BasicUser.Username),
				},
				{
					Username: model.NewPointer(th.BasicUser2.Username),
				},
				{
					Username: model.NewPointer(user3.Username),
				},
				{
					Username: model.NewPointer(model.NewId()),
				},
			},
		})
		for name, data := range dataset {
			t.Run(name, func(t *testing.T) {
				appErr := th.App.importDirectChannel(th.Context, &data, false)
				require.NotNil(t, appErr)

				// Check that no more channels are in the DB.
				AssertChannelCount(t, th.App, model.ChannelTypeDirect, directChannelCount+1)
				AssertChannelCount(t, th.App, model.ChannelTypeGroup, groupChannelCount)
			})
		}
	})

	t.Run("Valid GROUP channel", func(t *testing.T) {
		dataset := generateDataset(imports.DirectChannelImportData{
			Participants: []*imports.DirectChannelMemberImportData{
				{
					Username: model.NewPointer(th.BasicUser.Username),
				},
				{
					Username: model.NewPointer(th.BasicUser2.Username),
				},
				{
					Username: model.NewPointer(user3.Username),
				},
			},
		})
		for name, data := range dataset {
			t.Run(name, func(t *testing.T) {
				appErr := th.App.importDirectChannel(th.Context, &data, false)
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
				data.Header = model.NewPointer("New Channel Header 3")
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
				channel, appErr := th.App.createGroupChannel(th.Context, userIDs)
				require.Equal(t, appErr.Id, store.ChannelExistsError)
				require.Equal(t, channel.Header, *data.Header)
			})
		}
	})

	t.Run("Import a channel with some favorites", func(t *testing.T) {
		dataset := generateDataset(imports.DirectChannelImportData{
			Participants: []*imports.DirectChannelMemberImportData{
				{
					Username: model.NewPointer(th.BasicUser.Username),
				},
				{
					Username: model.NewPointer(th.BasicUser2.Username),
				},
			},
		})
		for name, data := range dataset {
			t.Run(name, func(t *testing.T) {
				data.FavoritedBy = &[]string{
					th.BasicUser.Username,
					th.BasicUser2.Username,
				}
				appErr := th.App.importDirectChannel(th.Context, &data, false)
				require.Nil(t, appErr)

				channel, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, th.BasicUser2.Id)
				require.Nil(t, appErr)
				checkPreference(t, th.App, th.BasicUser.Id, model.PreferenceCategoryFavoriteChannel, channel.Id, "true")
				checkPreference(t, th.App, th.BasicUser2.Id, model.PreferenceCategoryFavoriteChannel, channel.Id, "true")
			})
		}
	})

	t.Run("Import a DM channel and user last view should be imported", func(t *testing.T) {
		lastView := model.GetMillis()
		data := imports.DirectChannelImportData{
			Participants: []*imports.DirectChannelMemberImportData{
				{
					Username:     model.NewPointer(th.BasicUser.Username),
					LastViewedAt: model.NewPointer(lastView),
				},
				{
					Username: model.NewPointer(th.BasicUser2.Username),
				},
			},
		}

		appErr := th.App.importDirectChannel(th.Context, &data, false)
		require.Nil(t, appErr)

		channel, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, th.BasicUser2.Id)
		require.Nil(t, appErr)

		members, appErr := th.App.GetChannelMembersPage(th.Context, channel.Id, 0, 100)
		require.Nil(t, appErr)
		require.Len(t, members, 2)

		for _, member := range members {
			if member.UserId == th.BasicUser.Id {
				require.Equal(t, member.LastViewedAt, lastView)
			}
		}
	})

	t.Run("Import a DM channel and preserve if the channel was shown to users", func(t *testing.T) {
		data := imports.DirectChannelImportData{
			Participants: []*imports.DirectChannelMemberImportData{
				{
					Username: model.NewPointer(th.BasicUser.Username),
				},
				{
					Username: model.NewPointer(th.BasicUser2.Username),
				},
			},
			ShownBy: &[]string{
				th.BasicUser.Username,
			},
		}

		appErr := th.App.importDirectChannel(th.Context, &data, false)
		require.Nil(t, appErr)

		channel, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, th.BasicUser2.Id)
		require.Nil(t, appErr)

		members, appErr := th.App.GetChannelMembersPage(th.Context, channel.Id, 0, 100)
		require.Nil(t, appErr)
		require.Len(t, members, 2)

		for _, member := range members {
			if member.UserId == th.BasicUser.Id {
				checkPreference(t, th.App, th.BasicUser.Id, model.PreferenceCategoryDirectChannelShow, th.BasicUser2.Id, "true")
			}
		}
	})

	t.Run("Import a GM channel and preserve if the channel was shown to users", func(t *testing.T) {
		data := imports.DirectChannelImportData{
			Participants: []*imports.DirectChannelMemberImportData{
				{
					Username: model.NewPointer(th.BasicUser.Username),
				},
				{
					Username: model.NewPointer(th.BasicUser2.Username),
				},
				{
					Username: model.NewPointer(user3.Username),
				},
			},
			ShownBy: &[]string{
				th.BasicUser.Username,
			},
		}

		appErr := th.App.importDirectChannel(th.Context, &data, false)
		require.Nil(t, appErr)

		channel, appErr := th.App.GetGroupChannel(th.Context, []string{th.BasicUser.Id, th.BasicUser2.Id, user3.Id})
		require.Nil(t, appErr)

		members, appErr := th.App.GetChannelMembersPage(th.Context, channel.Id, 0, 100)
		require.Nil(t, appErr)
		require.Len(t, members, 3)

		for _, member := range members {
			if member.UserId == th.BasicUser.Id {
				checkPreference(t, th.App, th.BasicUser.Id, model.PreferenceCategoryGroupChannelShow, channel.Id, "true")
			}
		}
	})
}

func TestImportImportDirectPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Create the DIRECT channel.
	channelData := imports.DirectChannelImportData{
		Participants: []*imports.DirectChannelMemberImportData{
			{
				Username: model.NewPointer(th.BasicUser.Username),
			},
			{
				Username: model.NewPointer(th.BasicUser2.Username),
			},
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
	require.NoError(t, th.App.Srv().Store().Post().RefreshPostStats())
	result, err := th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{})
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
					User:     model.NewPointer(th.BasicUser.Username),
					CreateAt: model.NewPointer(model.GetMillis()),
				},
			},
			LineNumber: 7,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, true, true)
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
					User:     model.NewPointer(th.BasicUser.Username),
					Message:  model.NewPointer("Message"),
					CreateAt: model.NewPointer(model.GetMillis()),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, true, true)
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
					User:     model.NewPointer(th.BasicUser.Username),
					Message:  model.NewPointer("Message"),
					CreateAt: model.NewPointer(model.GetMillis()),
				},
			},
			LineNumber: 9,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
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
					User:     model.NewPointer(th.BasicUser.Username),
					Message:  model.NewPointer("Message"),
					CreateAt: model.NewPointer(initialDate),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 1, "")

		// Check the post values.
		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(directChannel.Id, *data.DirectPost.CreateAt)
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
					User:     model.NewPointer(th.BasicUser.Username),
					Message:  model.NewPointer("Message"),
					CreateAt: model.NewPointer(initialDate),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 1, "")

		// Check the post values.
		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(directChannel.Id, *data.DirectPost.CreateAt)
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
					User:     model.NewPointer(th.BasicUser.Username),
					Message:  model.NewPointer("Message"),
					CreateAt: model.NewPointer(initialDate + 1),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
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
					User:     model.NewPointer(th.BasicUser.Username),
					Message:  model.NewPointer("Message 2"),
					CreateAt: model.NewPointer(initialDate + 1),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
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
					User:     model.NewPointer(th.BasicUser.Username),
					Message:  model.NewPointer("Message 2 #hashtagmashupcity"),
					CreateAt: model.NewPointer(initialDate + 2),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 4, "")

		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(directChannel.Id, *data.DirectPost.CreateAt)
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
					User:     model.NewPointer(th.BasicUser.Username),
					Message:  model.NewPointer("Message"),
					CreateAt: model.NewPointer(model.GetMillis()),
				},
			},
			LineNumber: 1,
		}

		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 5, "")

		// Check the post values.
		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(directChannel.Id, *data.DirectPost.CreateAt)
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
					User:     model.NewPointer(th.BasicUser.Username),
					Type:     model.NewPointer(model.PostTypeSystemGeneric),
					Message:  model.NewPointer("Message with Type"),
					CreateAt: model.NewPointer(posttypeDate),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 6, "")

		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(directChannel.Id, *data.DirectPost.CreateAt)
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
					User:     model.NewPointer(th.BasicUser.Username),
					Message:  model.NewPointer("Message with EditAt"),
					CreateAt: model.NewPointer(editatCreateDate),
					EditAt:   model.NewPointer(editatEditDate),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 7, "")

		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(directChannel.Id, *data.DirectPost.CreateAt)
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
					User:     model.NewPointer(th.BasicUser.Username),
					Message:  model.NewPointer("Message with EditAt"),
					CreateAt: &creationTime,
					IsPinned: &pinnedValue,
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 8, "")

		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(directChannel.Id, *data.DirectPost.CreateAt)
		require.NoError(t, nErr)
		require.Len(t, posts, 1)

		post := posts[0]
		require.True(t, post.IsPinned)
	})

	t.Run("Importing a direct post with a thread", func(t *testing.T) {
		// Create a thread.
		importCreate := time.Now().Add(-1 * time.Minute).UnixMilli()
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
					},
					User:     model.NewPointer(th.BasicUser.Username),
					Message:  model.NewPointer("Thread Message"),
					CreateAt: model.NewPointer(importCreate),
					Replies: &[]imports.ReplyImportData{{
						User:     model.NewPointer(th.BasicUser.Username),
						Message:  model.NewPointer("Reply"),
						CreateAt: model.NewPointer(model.GetMillis()),
					}},
					ThreadFollowers: &[]imports.ThreadFollowerImportData{{
						User:       model.NewPointer(th.BasicUser.Username),
						LastViewed: model.NewPointer(model.GetMillis()),
					}, {
						User:       model.NewPointer(th.BasicUser2.Username),
						LastViewed: model.NewPointer(model.GetMillis()),
					}},
				},
			},
			LineNumber: 1,
		}

		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)

		resultPosts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, importCreate)
		require.NoError(t, nErr)
		require.Equal(t, 1, len(resultPosts))

		followers, nErr := th.App.Srv().Store().Thread().GetThreadFollowers(resultPosts[0].Id, true)
		require.NoError(t, nErr)

		assert.ElementsMatch(t, []string{th.BasicUser.Id, th.BasicUser2.Id}, followers)
	})

	t.Run("Importing a direct post with new followers", func(t *testing.T) {
		importCreate := time.Now().Add(-5 * time.Minute).UnixMilli()
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
					},
					User:     model.NewPointer(th.BasicUser.Username),
					Message:  model.NewPointer("Hello"),
					CreateAt: model.NewPointer(importCreate),
				},
			},
			LineNumber: 1,
		}

		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)

		resultPosts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, importCreate)
		require.NoError(t, nErr)
		require.Equal(t, 1, len(resultPosts))

		data = imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
					},
					User:     model.NewPointer(th.BasicUser.Username),
					Message:  model.NewPointer("Hello"),
					CreateAt: model.NewPointer(importCreate),
					Replies: &[]imports.ReplyImportData{{
						User:     model.NewPointer(th.BasicUser.Username),
						Message:  model.NewPointer("Reply"),
						CreateAt: model.NewPointer(model.GetMillis()),
					}},
					ThreadFollowers: &[]imports.ThreadFollowerImportData{{
						User:       model.NewPointer(th.BasicUser.Username),
						LastViewed: model.NewPointer(model.GetMillis()),
					}},
				},
			},
			LineNumber: 1,
		}

		errLine, err = th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)

		followers, nErr := th.App.Srv().Store().Thread().GetThreadFollowers(resultPosts[0].Id, true)
		require.NoError(t, nErr)

		assert.ElementsMatch(t, []string{th.BasicUser.Id}, followers)
	})

	// ------------------ Group Channel -------------------------

	// Create the GROUP channel.
	user3 := th.CreateUser()
	channelData = imports.DirectChannelImportData{
		Participants: []*imports.DirectChannelMemberImportData{
			{
				Username: model.NewPointer(th.BasicUser.Username),
			},
			{
				Username: model.NewPointer(th.BasicUser2.Username),
			},
			{
				Username: model.NewPointer(user3.Username),
			},
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
	require.NoError(t, th.App.Srv().Store().Post().RefreshPostStats())
	result, nErr := th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{})
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
					User:     model.NewPointer(th.BasicUser.Username),
					CreateAt: model.NewPointer(model.GetMillis()),
				},
			},
			LineNumber: 4,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, true, true)
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
					User:     model.NewPointer(th.BasicUser.Username),
					Message:  model.NewPointer("Message"),
					CreateAt: model.NewPointer(model.GetMillis()),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, true, true)
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
					User:     model.NewPointer(th.BasicUser.Username),
					Message:  model.NewPointer("Message"),
					CreateAt: model.NewPointer(model.GetMillis()),
				},
			},
			LineNumber: 8,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
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
					User:     model.NewPointer(th.BasicUser.Username),
					Message:  model.NewPointer("Message"),
					CreateAt: model.NewPointer(initialDate + 10),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 1, "")

		// Check the post values.
		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(groupChannel.Id, *data.DirectPost.CreateAt)
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
					User:     model.NewPointer(th.BasicUser.Username),
					Message:  model.NewPointer("Message"),
					CreateAt: model.NewPointer(initialDate + 10),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 1, "")

		// Check the post values.
		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(groupChannel.Id, *data.DirectPost.CreateAt)
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
					User:     model.NewPointer(th.BasicUser.Username),
					Message:  model.NewPointer("Message"),
					CreateAt: model.NewPointer(initialDate + 11),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
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
					User:     model.NewPointer(th.BasicUser.Username),
					Message:  model.NewPointer("Message 2"),
					CreateAt: model.NewPointer(initialDate + 11),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
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
					User:     model.NewPointer(th.BasicUser.Username),
					Message:  model.NewPointer("Message 2 #hashtagmashupcity"),
					CreateAt: model.NewPointer(initialDate + 12),
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)
		AssertAllPostsCount(t, th.App, initialPostCount, 4, "")

		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(groupChannel.Id, *data.DirectPost.CreateAt)
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
					User:     model.NewPointer(th.BasicUser.Username),
					Message:  model.NewPointer("Message"),
					CreateAt: model.NewPointer(model.GetMillis()),
				},
			},
			LineNumber: 1,
		}

		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 5, "")

		// Check the post values.
		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(groupChannel.Id, *data.DirectPost.CreateAt)
		require.NoError(t, nErr)
		require.Len(t, posts, 1)

		post := posts[0]
		checkPreference(t, th.App, th.BasicUser.Id, model.PreferenceCategoryFlaggedPost, post.Id, "true")
		checkPreference(t, th.App, th.BasicUser2.Id, model.PreferenceCategoryFlaggedPost, post.Id, "true")
	})

	t.Run("Post with reaction", func(t *testing.T) {
		reactionPostTime := model.NewPointer(initialDate + 22)
		reactionTime := model.NewPointer(initialDate + 23)
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
						user3.Username,
					},
					User:     model.NewPointer(th.BasicUser.Username),
					Message:  model.NewPointer("Message with reaction"),
					CreateAt: reactionPostTime,
					Reactions: &[]imports.ReactionImportData{{
						User:      model.NewPointer(th.BasicUser2.Username),
						EmojiName: model.NewPointer("+1"),
						CreateAt:  reactionTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 6, "")

		// Check the post values.
		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(groupChannel.Id, *data.DirectPost.CreateAt)
		require.NoError(t, nErr)

		require.Len(t, posts, 1, "Unexpected number of posts found.")

		post := posts[0]
		postBool := post.Message != *data.DirectPost.Message || post.CreateAt != *data.DirectPost.CreateAt || post.UserId != th.BasicUser.Id || !post.HasReactions
		require.False(t, postBool, "Post properties not as expected")

		reactions, nErr := th.App.Srv().Store().Reaction().GetForPost(post.Id, false)
		require.NoError(t, nErr, "Can't get reaction")

		require.Len(t, reactions, 1, "Invalid number of reactions")
	})

	t.Run("Post with reply", func(t *testing.T) {
		replyPostTime := model.NewPointer(initialDate + 25)
		replyTime := model.NewPointer(initialDate + 26)
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
						user3.Username,
					},
					User:     model.NewPointer(th.BasicUser.Username),
					Message:  model.NewPointer("Message with reply"),
					CreateAt: replyPostTime,
					Replies: &[]imports.ReplyImportData{{
						User:     model.NewPointer(th.BasicUser2.Username),
						Message:  model.NewPointer("Message reply"),
						CreateAt: replyTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 8, "")

		// Check the post values.
		posts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(groupChannel.Id, *data.DirectPost.CreateAt)
		require.NoError(t, nErr)

		require.Len(t, posts, 1, "Unexpected number of posts found.")

		post := posts[0]
		postBool := post.Message != *data.DirectPost.Message || post.CreateAt != *data.DirectPost.CreateAt || post.UserId != th.BasicUser.Id
		require.False(t, postBool, "Post properties not as expected")

		// Check the reply values.
		replies, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, *replyTime)
		require.NoError(t, nErr)

		require.Len(t, replies, 1, "Unexpected number of posts found.")

		reply := replies[0]
		replyBool := reply.Message != *(*data.DirectPost.Replies)[0].Message || reply.CreateAt != *(*data.DirectPost.Replies)[0].CreateAt || reply.UserId != th.BasicUser2.Id
		require.False(t, replyBool, "Post properties not as expected")

		require.Equal(t, post.Id, reply.RootId, "Unexpected reply RootId")
	})

	t.Run("Update post with replies", func(t *testing.T) {
		replyPostTime := model.NewPointer(initialDate + 25)
		replyTime := model.NewPointer(initialDate + 26)
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
						user3.Username,
					},
					User:     model.NewPointer(th.BasicUser2.Username),
					Message:  model.NewPointer("Message with reply"),
					CreateAt: replyPostTime,
					Replies: &[]imports.ReplyImportData{{
						User:     model.NewPointer(th.BasicUser.Username),
						Message:  model.NewPointer("Message reply"),
						CreateAt: replyTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 8, "")
	})

	t.Run("Create new post with replies based on the previous one", func(t *testing.T) {
		replyPostTime := model.NewPointer(initialDate + 27)
		replyTime := model.NewPointer(initialDate + 28)
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
						user3.Username,
					},
					User:     model.NewPointer(th.BasicUser2.Username),
					Message:  model.NewPointer("Message with reply 2"),
					CreateAt: replyPostTime,
					Replies: &[]imports.ReplyImportData{{
						User:     model.NewPointer(th.BasicUser.Username),
						Message:  model.NewPointer("Message reply"),
						CreateAt: replyTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 10, "")
	})

	t.Run("Post with reply having non-empty type and edit_at", func(t *testing.T) {
		replyPostTime := model.NewPointer(initialDate + 29)
		replyTime := model.NewPointer(initialDate + 30)
		replyEditTime := model.NewPointer(initialDate + 31)
		data := imports.LineImportWorkerData{
			LineImportData: imports.LineImportData{
				DirectPost: &imports.DirectPostImportData{
					ChannelMembers: &[]string{
						th.BasicUser.Username,
						th.BasicUser2.Username,
						user3.Username,
					},
					User:     model.NewPointer(th.BasicUser2.Username),
					Message:  model.NewPointer("Message with reply"),
					CreateAt: replyPostTime,
					Replies: &[]imports.ReplyImportData{{
						User:     model.NewPointer(th.BasicUser.Username),
						Type:     model.NewPointer(model.PostTypeSystemGeneric),
						Message:  model.NewPointer("Message reply 2"),
						CreateAt: replyTime,
						EditAt:   replyEditTime,
					}},
				},
			},
			LineNumber: 1,
		}
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		AssertAllPostsCount(t, th.App, initialPostCount, 12, "")

		// Check the reply values.
		replies, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, *replyTime)
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

	data := imports.EmojiImportData{Name: model.NewPointer(model.NewId())}
	appErr := th.App.importEmoji(th.Context, &data, true)
	assert.NotNil(t, appErr, "Invalid emoji should have failed dry run")

	emoji, nErr := th.App.Srv().Store().Emoji().GetByName(th.Context, *data.Name, true)
	assert.Nil(t, emoji, "Emoji should not have been imported")
	assert.Error(t, nErr)

	data.Image = model.NewPointer(testImage)
	appErr = th.App.importEmoji(th.Context, &data, true)
	assert.Nil(t, appErr, "Valid emoji should have passed dry run")

	data = imports.EmojiImportData{Name: model.NewPointer(model.NewId())}
	appErr = th.App.importEmoji(th.Context, &data, false)
	assert.NotNil(t, appErr, "Invalid emoji should have failed apply mode")

	data.Image = model.NewPointer("non-existent-file")
	appErr = th.App.importEmoji(th.Context, &data, false)
	assert.NotNil(t, appErr, "Emoji with bad image file should have failed apply mode")

	data.Image = model.NewPointer(testImage)
	appErr = th.App.importEmoji(th.Context, &data, false)
	assert.Nil(t, appErr, "Valid emoji should have succeeded apply mode")

	emoji, nErr = th.App.Srv().Store().Emoji().GetByName(th.Context, *data.Name, true)
	assert.NotNil(t, emoji, "Emoji should have been imported")
	assert.NoError(t, nErr, "Emoji should have been imported without any error")

	appErr = th.App.importEmoji(th.Context, &data, false)
	assert.Nil(t, appErr, "Second run should have succeeded apply mode")

	data = imports.EmojiImportData{Name: model.NewPointer("smiley"), Image: model.NewPointer(testImage)}
	appErr = th.App.importEmoji(th.Context, &data, false)
	assert.Nil(t, appErr, "System emoji should not fail")

	largeImage := filepath.Join(testsDir, "large_image_file.jpg")
	data = imports.EmojiImportData{Name: model.NewPointer(model.NewId()), Image: model.NewPointer(largeImage)}
	appErr = th.App.importEmoji(th.Context, &data, false)
	require.NotNil(t, appErr)
	require.ErrorIs(t, appErr.Unwrap(), utils.ErrSizeLimitExceeded)
}

func TestImportAttachment(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	testsDir, _ := fileutils.FindDir("tests")
	testImage := filepath.Join(testsDir, "test.png")
	invalidPath := "some-invalid-path"

	userID := model.NewId()
	data := imports.AttachmentImportData{Path: &testImage}
	_, err := th.App.importAttachment(th.Context, &data, &model.Post{UserId: userID, ChannelId: "some-channel"}, "some-team", true)
	assert.Nil(t, err, "sample run without errors")

	attachments := GetAttachments(userID, th, t)
	assert.Len(t, attachments, 1)

	data = imports.AttachmentImportData{Path: &invalidPath}
	_, err = th.App.importAttachment(th.Context, &data, &model.Post{UserId: model.NewId(), ChannelId: "some-channel"}, "some-team", true)
	assert.NotNil(t, err, "should have failed when opening the file")
	assert.Equal(t, err.Id, "app.import.attachment.bad_file.error")
}

func TestImportPostAndRepliesWithAttachments(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Create a Team.
	teamName := model.NewRandomTeamName()
	appErr := th.App.importTeam(th.Context, &imports.TeamImportData{
		Name:        &teamName,
		DisplayName: model.NewPointer("Display Name"),
		Type:        model.NewPointer("O"),
	}, false)
	require.Nil(t, appErr, "Failed to import team.")
	team, appErr := th.App.GetTeamByName(teamName)
	require.Nil(t, appErr, "Failed to get team from database.")

	// Create a Channel.
	channelName := NewTestId()
	chanTypeOpen := model.ChannelTypeOpen
	appErr = th.App.importChannel(th.Context, &imports.ChannelImportData{
		Team:        &teamName,
		Name:        &channelName,
		DisplayName: model.NewPointer("Display Name"),
		Type:        &chanTypeOpen,
	}, false)
	require.Nil(t, appErr, "Failed to import channel.")
	_, appErr = th.App.GetChannelByName(th.Context, channelName, team.Id, false)
	require.Nil(t, appErr, "Failed to get channel from database.")

	// Create a user3.
	username := model.NewUsername()
	appErr = th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username,
		Email:    model.NewPointer(model.NewId() + "@example.com"),
	}, false)
	require.Nil(t, appErr, "Failed to import user.")
	user3, appErr := th.App.GetUserByUsername(username)
	require.Nil(t, appErr, "Failed to get user3 from database.")
	require.NotNil(t, user3)

	username2 := model.NewUsername()
	appErr = th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username2,
		Email:    model.NewPointer(model.NewId() + "@example.com"),
	}, false)
	require.Nil(t, appErr, "Failed to import user2.")
	user2, appErr := th.App.GetUserByUsername(username2)
	require.Nil(t, appErr, "Failed to get user2 from database.")

	// Create direct post users.
	username3 := model.NewUsername()
	appErr = th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username3,
		Email:    model.NewPointer(model.NewId() + "@example.com"),
	}, false)
	require.Nil(t, appErr, "Failed to import user3.")
	user3, appErr = th.App.GetUserByUsername(username3)
	require.Nil(t, appErr, "Failed to get user3 from database.")

	username4 := model.NewUsername()
	appErr = th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username4,
		Email:    model.NewPointer(model.NewId() + "@example.com"),
	}, false)
	require.Nil(t, appErr, "Failed to import user4.")

	user4, appErr := th.App.GetUserByUsername(username4)
	require.Nil(t, appErr, "Failed to get user4 from database.")

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
				Message:     model.NewPointer("Message with reply"),
				CreateAt:    &attachmentsPostTime,
				Attachments: &[]imports.AttachmentImportData{{Path: &testImage}, {Path: &testMarkDown}},
				Replies: &[]imports.ReplyImportData{{
					User:        &user4.Username,
					Message:     model.NewPointer("Message reply"),
					CreateAt:    &attachmentsReplyTime,
					Attachments: &[]imports.AttachmentImportData{{Path: &testImage}},
				}},
			},
		},
		LineNumber: 19,
	}

	t.Run("import with attachment", func(t *testing.T) {
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
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
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
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
					Message:  model.NewPointer("Message with Replies"),
					CreateAt: model.NewPointer(model.GetMillis()),
					Replies: &[]imports.ReplyImportData{{
						User:        &user2.Username,
						Message:     model.NewPointer("Message reply with attachment"),
						CreateAt:    model.NewPointer(model.GetMillis()),
						Attachments: &[]imports.AttachmentImportData{{Path: &testImage}},
					}},
				},
			},
			LineNumber: 7,
		}

		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{directImportData}, false, true)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		attachments := GetAttachments(user2.Id, th, t)
		require.Len(t, attachments, 1)
		assert.Contains(t, attachments[0].Path, "noteam")
		AssertFileIdsInPost(attachments, th, t)
	})

	t.Run("import existing post with different attachment's content", func(t *testing.T) {
		tmpDir := os.TempDir()
		filePath := filepath.Join(tmpDir, "test_diff.png")

		t.Run("different size", func(t *testing.T) {
			testImage := filepath.Join(testsDir, "test.png")
			imageData, err := os.ReadFile(testImage)
			require.NoError(t, err)
			err = os.WriteFile(filePath, imageData, 0644)
			require.NoError(t, err)

			data.Post.Attachments = &[]imports.AttachmentImportData{{Path: &filePath}}
			data.Post.Replies = nil
			data.Post.Message = model.NewPointer("new post")
			errLine, appErr := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
			require.Nil(t, appErr)
			require.Equal(t, 0, errLine)

			attachments := GetAttachments(user3.Id, th, t)
			require.Len(t, attachments, 2)
			assert.Contains(t, attachments[1].Path, team.Id)
			AssertFileIdsInPost(attachments[1:], th, t)

			testImage = filepath.Join(testsDir, "test-data-graph.png")
			imageData, err = os.ReadFile(testImage)
			require.NoError(t, err)
			err = os.WriteFile(filePath, imageData, 0644)
			require.NoError(t, err)

			data.Post.Attachments = &[]imports.AttachmentImportData{{Path: &filePath}}
			data.Post.Replies = nil
			errLine, appErr = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
			require.Nil(t, appErr)
			require.Equal(t, 0, errLine)

			attachments2 := GetAttachments(user3.Id, th, t)
			require.NotEqual(t, attachments, attachments2)
			require.Len(t, attachments2, 2)
			assert.Contains(t, attachments2[1].Path, team.Id)
			AssertFileIdsInPost(attachments2[1:], th, t)
		})

		t.Run("same size", func(t *testing.T) {
			imageData, err := os.ReadFile(filepath.Join(testsDir, "test_img_diff_A.png"))
			require.NoError(t, err)
			err = os.WriteFile(filePath, imageData, 0644)
			require.NoError(t, err)

			data.Post.Attachments = &[]imports.AttachmentImportData{{Path: &filePath}}
			data.Post.Replies = nil
			data.Post.Message = model.NewPointer("new post2")
			errLine, appErr := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
			require.Nil(t, appErr)
			require.Equal(t, 0, errLine)

			attachments := GetAttachments(user3.Id, th, t)
			require.Len(t, attachments, 3)
			assert.Contains(t, attachments[2].Path, team.Id)
			AssertFileIdsInPost(attachments[2:], th, t)

			imageData, err = os.ReadFile(filepath.Join(testsDir, "test_img_diff_B.png"))
			require.NoError(t, err)
			err = os.WriteFile(filePath, imageData, 0644)
			require.NoError(t, err)

			data.Post.Attachments = &[]imports.AttachmentImportData{{Path: &filePath}}
			data.Post.Replies = nil
			errLine, appErr = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
			require.Nil(t, appErr)
			require.Equal(t, 0, errLine)

			attachments2 := GetAttachments(user3.Id, th, t)
			require.NotEqual(t, attachments, attachments2)
			require.Len(t, attachments2, 3)
			assert.Contains(t, attachments2[2].Path, team.Id)
			AssertFileIdsInPost(attachments2[2:], th, t)
		})
	})
}

func TestImportDirectPostWithAttachments(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	testsDir, _ := fileutils.FindDir("tests")
	testImage := filepath.Join(testsDir, "test.png")
	testImage2 := filepath.Join(testsDir, "test.svg")
	// create a temp file with same name as original but with a different first byte
	tmpFolder, err := os.MkdirTemp("", "imgFake")
	require.NoError(t, err)
	testImageFake := filepath.Join(tmpFolder, "test.png")
	fakeFileData, err := os.ReadFile(testImage)
	require.NoError(t, err)
	fakeFileData[0] = 0
	err = os.WriteFile(testImageFake, fakeFileData, 0644)
	require.NoError(t, err)
	defer func() {
		err := os.RemoveAll(tmpFolder)
		require.NoError(t, err)
	}()

	// Create a user.
	username := model.NewUsername()
	appErr := th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username,
		Email:    model.NewPointer(model.NewId() + "@example.com"),
	}, false)
	require.Nil(t, appErr, "Failed to import user.")
	user1, appErr := th.App.GetUserByUsername(username)
	require.Nil(t, appErr, "Failed to get user1 from database.")

	username2 := model.NewUsername()
	appErr = th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username2,
		Email:    model.NewPointer(model.NewId() + "@example.com"),
	}, false)
	require.Nil(t, appErr, "Failed to import user2.")
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
				Message:     model.NewPointer("Direct message"),
				CreateAt:    model.NewPointer(model.GetMillis()),
				Attachments: &[]imports.AttachmentImportData{{Path: &testImage}},
			},
		},
		LineNumber: 3,
	}

	t.Run("Regular import of attachment", func(t *testing.T) {
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{directImportData}, false, true)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		attachments := GetAttachments(user1.Id, th, t)
		require.Len(t, attachments, 1)
		assert.Contains(t, attachments[0].Path, "noteam")
		AssertFileIdsInPost(attachments, th, t)
	})

	t.Run("Attempt to import again with same file entirely, should NOT add an attachment", func(t *testing.T) {
		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{directImportData}, false, true)
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
					Message:     model.NewPointer("Direct message"),
					CreateAt:    model.NewPointer(model.GetMillis()),
					Attachments: &[]imports.AttachmentImportData{{Path: &testImageFake}},
				},
			},
			LineNumber: 2,
		}

		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{directImportDataFake}, false, true)
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
					Message:     model.NewPointer("Direct message"),
					CreateAt:    model.NewPointer(model.GetMillis()),
					Attachments: &[]imports.AttachmentImportData{{Path: &testImage2}},
				},
			},
			LineNumber: 2,
		}

		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{directImportData2}, false, true)
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
	appErr := th.App.importTeam(th.Context, &imports.TeamImportData{
		Name:        &teamName,
		DisplayName: model.NewPointer("Display Name"),
		Type:        model.NewPointer("O"),
	}, false)
	require.Nil(t, appErr, "Failed to import team.")
	team, appErr := th.App.GetTeamByName(teamName)
	require.Nil(t, appErr, "Failed to get team from database.")

	// Create a Channel.
	channelName := NewTestId()
	chanTypeOpen := model.ChannelTypeOpen
	appErr = th.App.importChannel(th.Context, &imports.ChannelImportData{
		Team:        &teamName,
		Name:        &channelName,
		DisplayName: model.NewPointer("Display Name"),
		Type:        &chanTypeOpen,
	}, false)
	require.Nil(t, appErr, "Failed to import channel.")
	_, appErr = th.App.GetChannelByName(th.Context, channelName, team.Id, false)
	require.Nil(t, appErr, "Failed to get channel from database.")

	// Create users
	username2 := model.NewUsername()
	appErr = th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username2,
		Email:    model.NewPointer(model.NewId() + "@example.com"),
	}, false)
	require.Nil(t, appErr, "Failed to import user2.")
	user2, appErr := th.App.GetUserByUsername(username2)
	require.Nil(t, appErr, "Failed to get user2 from database.")

	// Create direct post users.
	username3 := model.NewUsername()
	appErr = th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username3,
		Email:    model.NewPointer(model.NewId() + "@example.com"),
	}, false)
	require.Nil(t, appErr, "Failed to import user3.")
	user3, appErr := th.App.GetUserByUsername(username3)
	require.Nil(t, appErr, "Failed to get user3 from database.")

	username4 := model.NewUsername()
	appErr = th.App.importUser(th.Context, &imports.UserImportData{
		Username: &username4,
		Email:    model.NewPointer(model.NewId() + "@example.com"),
	}, false)
	require.Nil(t, appErr, "Failed to import user4.")

	user4, appErr := th.App.GetUserByUsername(username4)
	require.Nil(t, appErr, "Failed to get user4 from database.")

	// Post with attachments
	time := model.GetMillis()
	attachmentsPostTime := time
	attachmentsReplyTime := time + 1
	testsDir, _ := fileutils.FindDir("tests")
	testImage := filepath.Join(testsDir, "test.png")
	testZipFileName := filepath.Join(testsDir, "import_test.zip")
	testZip, err := os.Open(testZipFileName)
	require.NoError(t, err, "failed to open test zip")

	fi, err := testZip.Stat()
	require.NoError(t, err, "failed to get file info")
	testZipReader, err := zip.NewReader(testZip, fi.Size())
	require.NoError(t, err, "failed to read test zip")

	require.NotEmpty(t, testZipReader.File)
	imageData := testZipReader.File[0]

	testMarkDown := filepath.Join(testsDir, "test-attachments.md")
	data := imports.LineImportWorkerData{
		LineImportData: imports.LineImportData{
			Post: &imports.PostImportData{
				Team:        &teamName,
				Channel:     &channelName,
				User:        &username3,
				Message:     model.NewPointer("Message with reply"),
				CreateAt:    &attachmentsPostTime,
				Attachments: &[]imports.AttachmentImportData{{Path: &testImage}, {Path: &testMarkDown}},
				Replies: &[]imports.ReplyImportData{{
					User:        &user4.Username,
					Message:     model.NewPointer("Message reply"),
					CreateAt:    &attachmentsReplyTime,
					Attachments: &[]imports.AttachmentImportData{{Path: &testImage, Data: imageData}},
				}},
			},
		},
		LineNumber: 19,
	}

	t.Run("import with attachment", func(t *testing.T) {
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
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
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
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
					Message:  model.NewPointer("Message with Replies"),
					CreateAt: model.NewPointer(model.GetMillis()),
					Replies: &[]imports.ReplyImportData{{
						User:        &user2.Username,
						Message:     model.NewPointer("Message reply with attachment"),
						CreateAt:    model.NewPointer(model.GetMillis()),
						Attachments: &[]imports.AttachmentImportData{{Path: &testImage}},
					}},
				},
			},
			LineNumber: 7,
		}

		errLine, err := th.App.importMultipleDirectPostLines(th.Context, []imports.LineImportWorkerData{directImportData}, false, true)
		require.Nil(t, err, "Expected success.")
		require.Equal(t, 0, errLine)

		attachments := GetAttachments(user2.Id, th, t)
		require.Len(t, attachments, 1)
		assert.Contains(t, attachments[0].Path, "noteam")
		AssertFileIdsInPost(attachments, th, t)
	})

	t.Run("import existing post with different attachment's content", func(t *testing.T) {
		var fileA, fileB *zip.File
		for _, f := range testZipReader.File {
			if f.Name == "data/test_img_diff_A.png" {
				fileA = f
			} else if f.Name == "data/test_img_diff_B.png" {
				fileB = f
			}
		}

		require.NotNil(t, fileA)
		require.NotNil(t, fileB)

		data.Post.Attachments = &[]imports.AttachmentImportData{{Path: &fileA.Name, Data: fileA}}
		data.Post.Message = model.NewPointer("new post")
		data.Post.Replies = nil
		errLine, err := th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)

		attachments := GetAttachments(user3.Id, th, t)
		require.Len(t, attachments, 2)
		assert.Contains(t, attachments[1].Path, team.Id)
		AssertFileIdsInPost(attachments[1:], th, t)

		fileB.Name = fileA.Name
		data.Post.Attachments = &[]imports.AttachmentImportData{{Path: &fileA.Name, Data: fileB}}
		errLine, err = th.App.importMultiplePostLines(th.Context, []imports.LineImportWorkerData{data}, false, true)
		require.Nil(t, err)
		require.Equal(t, 0, errLine)

		attachments = GetAttachments(user3.Id, th, t)
		require.Len(t, attachments, 2)
		assert.Contains(t, attachments[1].Path, team.Id)
		AssertFileIdsInPost(attachments[1:], th, t)
	})
}

func TestCompareFilesContent(t *testing.T) {
	t.Run("empty", func(t *testing.T) {
		ok, err := compareFilesContent(strings.NewReader(""), strings.NewReader(""), 0)
		require.NoError(t, err)
		require.True(t, ok)
	})

	t.Run("no match", func(t *testing.T) {
		ok, err := compareFilesContent(strings.NewReader("fileA"), strings.NewReader("fileB"), 0)
		require.NoError(t, err)
		require.False(t, ok)
	})

	t.Run("match", func(t *testing.T) {
		ok, err := compareFilesContent(strings.NewReader("fileA"), strings.NewReader("fileA"), 0)
		require.NoError(t, err)
		require.True(t, ok)
	})
}

func BenchmarkCompareFilesContent(b *testing.B) {
	tmpDir := os.TempDir()
	fileAPath := filepath.Join(tmpDir, "fileA")
	fileBPath := filepath.Join(tmpDir, "fileB")

	fileA, err := os.Create(fileAPath)
	require.NoError(b, err)
	defer func() {
		err = fileA.Close()
		require.NoError(b, err)

		err = os.Remove(fileAPath)
		require.NoError(b, err)
	}()

	fileB, err := os.Create(fileBPath)
	require.NoError(b, err)
	defer func() {
		err = fileB.Close()
		require.NoError(b, err)

		err = os.Remove(fileBPath)
		require.NoError(b, err)
	}()

	fileSize := int64(1024 * 1024 * 1024) // 1GB

	err = fileA.Truncate(fileSize)
	require.NoError(b, err)
	err = fileB.Truncate(fileSize)
	require.NoError(b, err)

	bufSizesMap := map[string]int64{
		"32KB":  1024 * 32, // current default of io.Copy
		"128KB": 1024 * 128,
		"1MB":   1024 * 1024,
		"2MB":   1024 * 1024 * 2,
		"4MB":   1024 * 1024 * 4,
		"8MB":   1024 * 1024 * 8,
	}

	fileSizesMap := map[string]int64{
		"512KB": 1024 * 512,
		"1MB":   1024 * 1024,
		"10MB":  1024 * 1024 * 10,
		"100MB": 1024 * 1024 * 100,
		"1GB":   1024 * 1024 * 1000,
	}

	// To force order
	bufSizeLabels := []string{"32KB", "128KB", "1MB", "2MB", "4MB", "8MB"}
	fileSizeLabels := []string{"512KB", "1MB", "10MB", "100MB", "1GB"}

	b.Run("plain", func(b *testing.B) {
		b.Run("local", func(b *testing.B) {
			b.ReportAllocs()
			b.ResetTimer()
			b.StopTimer()

			for i := 0; i < b.N; i++ {
				_, err := fileA.Seek(0, io.SeekStart)
				require.NoError(b, err)
				_, err = fileB.Seek(0, io.SeekStart)
				require.NoError(b, err)

				b.StartTimer()
				ok, err := compareFilesContent(fileA, fileB, 0)
				b.StopTimer()
				require.NoError(b, err)
				require.True(b, ok)
			}
		})

		b.Run("s3", func(b *testing.B) {
			th := SetupConfig(b, func(cfg *model.Config) {
				cfg.FileSettings = model.FileSettings{
					DriverName:                         model.NewPointer(model.ImageDriverS3),
					AmazonS3AccessKeyId:                model.NewPointer(model.MinioAccessKey),
					AmazonS3SecretAccessKey:            model.NewPointer(model.MinioSecretKey),
					AmazonS3Bucket:                     model.NewPointer("comparefilescontentbucket"),
					AmazonS3Endpoint:                   model.NewPointer("localhost:9000"),
					AmazonS3Region:                     model.NewPointer(""),
					AmazonS3PathPrefix:                 model.NewPointer(""),
					AmazonS3SSL:                        model.NewPointer(false),
					AmazonS3RequestTimeoutMilliseconds: model.NewPointer(int64(300 * 1000)),
				}
			})
			defer th.TearDown()

			err := th.App.Srv().FileBackend().(*filestore.S3FileBackend).TestConnection()
			require.NoError(b, err)

			_, err = fileA.Seek(0, io.SeekStart)
			require.NoError(b, err)
			_, err = fileB.Seek(0, io.SeekStart)
			require.NoError(b, err)

			_, appErr := th.App.WriteFile(fileA, "compareFileA")
			require.Nil(b, appErr)
			defer func() {
				err = th.App.RemoveFile("compareFileA")
				require.NoError(b, err)
			}()

			_, appErr = th.App.WriteFile(fileB, "compareFileB")
			require.Nil(b, appErr)
			defer func() {
				appErr = th.App.RemoveFile("compareFileB")
				require.Nil(b, appErr)
			}()

			rdA, appErr := th.App.FileReader("compareFileA")
			require.Nil(b, appErr)
			defer func() {
				err = rdA.Close()
				require.NoError(b, err)
			}()

			rdB, appErr := th.App.FileReader("compareFileB")
			require.Nil(b, appErr)
			defer func() {
				err = rdB.Close()
				require.NoError(b, err)
			}()

			b.ResetTimer()

			for _, fileSizeLabel := range fileSizeLabels {
				fileSize := fileSizesMap[fileSizeLabel]
				for _, bufSizeLabel := range bufSizeLabels {
					bufSize := bufSizesMap[bufSizeLabel]
					b.Run("bufSize-fileSize"+fileSizeLabel+"-bufSize"+bufSizeLabel, func(b *testing.B) {
						b.ReportAllocs()
						b.StopTimer()
						for i := 0; i < b.N; i++ {
							_, err := rdA.Seek(0, io.SeekStart)
							require.NoError(b, err)
							_, err = rdB.Seek(0, io.SeekStart)
							require.NoError(b, err)

							b.StartTimer()
							ok, err := compareFilesContent(&io.LimitedReader{
								R: rdA,
								N: fileSize,
							}, &io.LimitedReader{
								R: rdB,
								N: fileSize,
							}, bufSize)
							b.StopTimer()
							require.NoError(b, err)
							require.True(b, ok)
						}
					})
				}
			}
		})
	})

	b.Run("zip", func(b *testing.B) {
		zipFilePath := filepath.Join(tmpDir, "compareFiles.zip")
		zipFile, err := os.Create(zipFilePath)
		require.NoError(b, err)
		defer func() {
			err = zipFile.Close()
			require.NoError(b, err)

			err = os.Remove(zipFilePath)
			require.NoError(b, err)
		}()

		zipWr := zip.NewWriter(zipFile)

		fileAZipWr, err := zipWr.CreateHeader(&zip.FileHeader{
			Name:   "compareFileA",
			Method: zip.Store,
		})
		require.NoError(b, err)
		_, err = io.Copy(fileAZipWr, fileA)
		require.NoError(b, err)

		fileBZipWr, err := zipWr.CreateHeader(&zip.FileHeader{
			Name:   "compareFileB",
			Method: zip.Store,
		})
		require.NoError(b, err)
		_, err = io.Copy(fileBZipWr, fileB)
		require.NoError(b, err)

		err = zipWr.Close()
		require.NoError(b, err)

		info, err := zipFile.Stat()
		require.NoError(b, err)

		zipFileSize := info.Size()

		b.Run("local", func(b *testing.B) {
			b.ResetTimer()

			for _, label := range bufSizeLabels {
				bufSize := bufSizesMap[label]
				b.Run("bufSize-"+label, func(b *testing.B) {
					b.ReportAllocs()
					b.StopTimer()
					for i := 0; i < b.N; i++ {
						_, err := zipFile.Seek(0, io.SeekStart)
						require.NoError(b, err)
						zipRd, err := zip.NewReader(zipFile, zipFileSize)
						require.NoError(b, err)

						zipFileA, err := zipRd.Open("compareFileA")
						require.NoError(b, err)

						zipFileB, err := zipRd.Open("compareFileB")
						require.NoError(b, err)

						b.StartTimer()
						ok, err := compareFilesContent(zipFileA, zipFileB, bufSize)
						b.StopTimer()
						require.NoError(b, err)
						require.True(b, ok)
					}
				})
			}
		})

		b.Run("s3", func(b *testing.B) {
			th := SetupConfig(b, func(cfg *model.Config) {
				cfg.FileSettings = model.FileSettings{
					DriverName:                         model.NewPointer(model.ImageDriverS3),
					AmazonS3AccessKeyId:                model.NewPointer(model.MinioAccessKey),
					AmazonS3SecretAccessKey:            model.NewPointer(model.MinioSecretKey),
					AmazonS3Bucket:                     model.NewPointer("comparefilescontentbucket"),
					AmazonS3Endpoint:                   model.NewPointer("localhost:9000"),
					AmazonS3Region:                     model.NewPointer(""),
					AmazonS3PathPrefix:                 model.NewPointer(""),
					AmazonS3SSL:                        model.NewPointer(false),
					AmazonS3RequestTimeoutMilliseconds: model.NewPointer(int64(300 * 1000)),
				}
			})
			defer th.TearDown()

			err := th.App.Srv().FileBackend().(*filestore.S3FileBackend).TestConnection()
			require.NoError(b, err)

			_, appErr := th.App.WriteFile(zipFile, "compareFiles.zip")
			require.Nil(b, appErr)
			defer func() {
				appErr = th.App.RemoveFile("compareFiles.zip")
				require.Nil(b, appErr)
			}()

			zipFileRd, appErr := th.App.FileReader("compareFiles.zip")
			require.Nil(b, appErr)
			defer func() {
				err = zipFileRd.Close()
				require.NoError(b, err)
			}()

			b.ResetTimer()

			for _, fileSizeLabel := range fileSizeLabels {
				fileSize := fileSizesMap[fileSizeLabel]
				for _, bufSizeLabel := range bufSizeLabels {
					bufSize := bufSizesMap[bufSizeLabel]
					b.Run("bufSize-fileSize"+fileSizeLabel+"-bufSize"+bufSizeLabel, func(b *testing.B) {
						b.ReportAllocs()
						b.StopTimer()
						for i := 0; i < b.N; i++ {
							_, err := zipFileRd.Seek(0, io.SeekStart)
							require.NoError(b, err)
							zipRd, err := zip.NewReader(zipFileRd.(io.ReaderAt), zipFileSize)
							require.NoError(b, err)

							zipFileA, err := zipRd.Open("compareFileA")
							require.NoError(b, err)

							zipFileB, err := zipRd.Open("compareFileB")
							require.NoError(b, err)

							b.StartTimer()
							ok, err := compareFilesContent(&io.LimitedReader{
								R: zipFileA,
								N: fileSize,
							}, &io.LimitedReader{
								R: zipFileB,
								N: fileSize,
							}, bufSize)
							b.StopTimer()
							require.NoError(b, err)
							require.True(b, ok)
						}
					})
				}
			}
		})
	})
}
