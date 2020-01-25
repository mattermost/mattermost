// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/utils/fileutils"
)

func TestImportImportScheme(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Mark the phase 2 permissions migration as completed.
	th.App.Srv.Store.System().Save(&model.System{Name: model.MIGRATION_KEY_ADVANCED_PERMISSIONS_PHASE_2, Value: "true"})

	defer func() {
		th.App.Srv.Store.System().PermanentDeleteByName(model.MIGRATION_KEY_ADVANCED_PERMISSIONS_PHASE_2)
	}()

	// Try importing an invalid scheme in dryRun mode.
	data := SchemeImportData{
		Name:  ptrStr(model.NewId()),
		Scope: ptrStr("team"),
		DefaultTeamGuestRole: &RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultTeamUserRole: &RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultTeamAdminRole: &RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultChannelGuestRole: &RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultChannelUserRole: &RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultChannelAdminRole: &RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		Description: ptrStr("description"),
	}

	err := th.App.importScheme(&data, true)
	require.NotNil(t, err, "Should have failed to import.")

	_, err = th.App.Srv.Store.Scheme().GetByName(*data.Name)
	require.NotNil(t, err, "Scheme should not have imported.")

	// Try importing a valid scheme in dryRun mode.
	data.DisplayName = ptrStr("display name")

	err = th.App.importScheme(&data, true)
	require.Nil(t, err, "Should have succeeded.")

	_, err = th.App.Srv.Store.Scheme().GetByName(*data.Name)
	require.NotNil(t, err, "Scheme should not have imported.")

	// Try importing an invalid scheme.
	data.DisplayName = nil

	err = th.App.importScheme(&data, false)
	require.NotNil(t, err, "Should have failed to import.")

	_, err = th.App.Srv.Store.Scheme().GetByName(*data.Name)
	require.NotNil(t, err, "Scheme should not have imported.")

	// Try importing a valid scheme with all params set.
	data.DisplayName = ptrStr("display name")

	err = th.App.importScheme(&data, false)
	require.Nil(t, err, "Should have succeeded.")

	scheme, err := th.App.Srv.Store.Scheme().GetByName(*data.Name)
	require.Nil(t, err, "Failed to import scheme: %v", err)

	assert.Equal(t, *data.Name, scheme.Name)
	assert.Equal(t, *data.DisplayName, scheme.DisplayName)
	assert.Equal(t, *data.Description, scheme.Description)
	assert.Equal(t, *data.Scope, scheme.Scope)

	role, err := th.App.Srv.Store.Role().GetByName(scheme.DefaultTeamAdminRole)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamAdminRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv.Store.Role().GetByName(scheme.DefaultTeamUserRole)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamUserRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv.Store.Role().GetByName(scheme.DefaultTeamGuestRole)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamGuestRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv.Store.Role().GetByName(scheme.DefaultChannelAdminRole)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelAdminRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv.Store.Role().GetByName(scheme.DefaultChannelUserRole)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelUserRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv.Store.Role().GetByName(scheme.DefaultChannelGuestRole)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelGuestRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	// Try modifying all the fields and re-importing.
	data.DisplayName = ptrStr("new display name")
	data.Description = ptrStr("new description")

	err = th.App.importScheme(&data, false)
	require.Nil(t, err, "Should have succeeded: %v", err)

	scheme, err = th.App.Srv.Store.Scheme().GetByName(*data.Name)
	require.Nil(t, err, "Failed to import scheme: %v", err)

	assert.Equal(t, *data.Name, scheme.Name)
	assert.Equal(t, *data.DisplayName, scheme.DisplayName)
	assert.Equal(t, *data.Description, scheme.Description)
	assert.Equal(t, *data.Scope, scheme.Scope)

	role, err = th.App.Srv.Store.Role().GetByName(scheme.DefaultTeamAdminRole)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamAdminRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv.Store.Role().GetByName(scheme.DefaultTeamUserRole)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamUserRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv.Store.Role().GetByName(scheme.DefaultTeamGuestRole)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamGuestRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv.Store.Role().GetByName(scheme.DefaultChannelAdminRole)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelAdminRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv.Store.Role().GetByName(scheme.DefaultChannelUserRole)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelUserRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv.Store.Role().GetByName(scheme.DefaultChannelGuestRole)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelGuestRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	// Try changing the scope of the scheme and reimporting.
	data.Scope = ptrStr("channel")

	err = th.App.importScheme(&data, false)
	require.NotNil(t, err, "Should have failed to import.")

	scheme, err = th.App.Srv.Store.Scheme().GetByName(*data.Name)
	require.Nil(t, err, "Failed to import scheme: %v", err)

	assert.Equal(t, *data.Name, scheme.Name)
	assert.Equal(t, *data.DisplayName, scheme.DisplayName)
	assert.Equal(t, *data.Description, scheme.Description)
	assert.Equal(t, "team", scheme.Scope)

}

func TestImportImportSchemeWithoutGuestRoles(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Mark the phase 2 permissions migration as completed.
	th.App.Srv.Store.System().Save(&model.System{Name: model.MIGRATION_KEY_ADVANCED_PERMISSIONS_PHASE_2, Value: "true"})

	defer func() {
		th.App.Srv.Store.System().PermanentDeleteByName(model.MIGRATION_KEY_ADVANCED_PERMISSIONS_PHASE_2)
	}()

	// Try importing an invalid scheme in dryRun mode.
	data := SchemeImportData{
		Name:  ptrStr(model.NewId()),
		Scope: ptrStr("team"),
		DefaultTeamUserRole: &RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultTeamAdminRole: &RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultChannelUserRole: &RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultChannelAdminRole: &RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		Description: ptrStr("description"),
	}

	err := th.App.importScheme(&data, true)
	require.NotNil(t, err, "Should have failed to import.")

	_, err = th.App.Srv.Store.Scheme().GetByName(*data.Name)
	require.NotNil(t, err, "Scheme should not have imported.")

	// Try importing a valid scheme in dryRun mode.
	data.DisplayName = ptrStr("display name")

	err = th.App.importScheme(&data, true)
	require.Nil(t, err, "Should have succeeded.")

	_, err = th.App.Srv.Store.Scheme().GetByName(*data.Name)
	require.NotNil(t, err, "Scheme should not have imported.")

	// Try importing an invalid scheme.
	data.DisplayName = nil

	err = th.App.importScheme(&data, false)
	require.NotNil(t, err, "Should have failed to import.")

	_, err = th.App.Srv.Store.Scheme().GetByName(*data.Name)
	require.NotNil(t, err, "Scheme should not have imported.")

	// Try importing a valid scheme with all params set.
	data.DisplayName = ptrStr("display name")

	err = th.App.importScheme(&data, false)
	require.Nil(t, err, "Should have succeeded.")

	scheme, err := th.App.Srv.Store.Scheme().GetByName(*data.Name)
	require.Nil(t, err, "Failed to import scheme: %v", err)

	assert.Equal(t, *data.Name, scheme.Name)
	assert.Equal(t, *data.DisplayName, scheme.DisplayName)
	assert.Equal(t, *data.Description, scheme.Description)
	assert.Equal(t, *data.Scope, scheme.Scope)

	role, err := th.App.Srv.Store.Role().GetByName(scheme.DefaultTeamAdminRole)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamAdminRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv.Store.Role().GetByName(scheme.DefaultTeamUserRole)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamUserRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv.Store.Role().GetByName(scheme.DefaultTeamGuestRole)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamGuestRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv.Store.Role().GetByName(scheme.DefaultChannelAdminRole)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelAdminRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv.Store.Role().GetByName(scheme.DefaultChannelUserRole)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelUserRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv.Store.Role().GetByName(scheme.DefaultChannelGuestRole)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelGuestRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	// Try modifying all the fields and re-importing.
	data.DisplayName = ptrStr("new display name")
	data.Description = ptrStr("new description")

	err = th.App.importScheme(&data, false)
	require.Nil(t, err, "Should have succeeded: %v", err)

	scheme, err = th.App.Srv.Store.Scheme().GetByName(*data.Name)
	require.Nil(t, err, "Failed to import scheme: %v", err)

	assert.Equal(t, *data.Name, scheme.Name)
	assert.Equal(t, *data.DisplayName, scheme.DisplayName)
	assert.Equal(t, *data.Description, scheme.Description)
	assert.Equal(t, *data.Scope, scheme.Scope)

	role, err = th.App.Srv.Store.Role().GetByName(scheme.DefaultTeamAdminRole)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamAdminRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv.Store.Role().GetByName(scheme.DefaultTeamUserRole)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamUserRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv.Store.Role().GetByName(scheme.DefaultTeamGuestRole)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultTeamGuestRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv.Store.Role().GetByName(scheme.DefaultChannelAdminRole)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelAdminRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv.Store.Role().GetByName(scheme.DefaultChannelUserRole)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelUserRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	role, err = th.App.Srv.Store.Role().GetByName(scheme.DefaultChannelGuestRole)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.DefaultChannelGuestRole.DisplayName, role.DisplayName)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	// Try changing the scope of the scheme and reimporting.
	data.Scope = ptrStr("channel")

	err = th.App.importScheme(&data, false)
	require.NotNil(t, err, "Should have failed to import.")

	scheme, err = th.App.Srv.Store.Scheme().GetByName(*data.Name)
	require.Nil(t, err, "Failed to import scheme: %v", err)

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
	data := RoleImportData{
		Name: &rid1,
	}

	err := th.App.importRole(&data, true, false)
	require.NotNil(t, err, "Should have failed to import.")

	_, err = th.App.Srv.Store.Role().GetByName(rid1)
	require.NotNil(t, err, "Should have failed to import.")

	// Try importing the valid role in dryRun mode.
	data.DisplayName = ptrStr("display name")

	err = th.App.importRole(&data, true, false)
	require.Nil(t, err, "Should have succeeded.")

	_, err = th.App.Srv.Store.Role().GetByName(rid1)
	require.NotNil(t, err, "Role should not have imported as we are in dry run mode.")

	// Try importing an invalid role.
	data.DisplayName = nil

	err = th.App.importRole(&data, false, false)
	require.NotNil(t, err, "Should have failed to import.")

	_, err = th.App.Srv.Store.Role().GetByName(rid1)
	require.NotNil(t, err, "Role should not have imported.")

	// Try importing a valid role with all params set.
	data.DisplayName = ptrStr("display name")
	data.Description = ptrStr("description")
	data.Permissions = &[]string{"invite_user", "add_user_to_team"}

	err = th.App.importRole(&data, false, false)
	require.Nil(t, err, "Should have succeeded.")

	role, err := th.App.Srv.Store.Role().GetByName(rid1)
	require.Nil(t, err, "Should have found the imported role.")

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

	role, err = th.App.Srv.Store.Role().GetByName(rid1)
	require.Nil(t, err, "Should have found the imported role.")

	assert.Equal(t, *data.Name, role.Name)
	assert.Equal(t, *data.DisplayName, role.DisplayName)
	assert.Equal(t, *data.Description, role.Description)
	assert.Equal(t, *data.Permissions, role.Permissions)
	assert.False(t, role.BuiltIn)
	assert.True(t, role.SchemeManaged)

	// Check that re-importing with only required fields doesn't update the others.
	data2 := RoleImportData{
		Name:        &rid1,
		DisplayName: ptrStr("new display name again"),
	}

	err = th.App.importRole(&data2, false, false)
	require.Nil(t, err, "Should have succeeded.")

	role, err = th.App.Srv.Store.Role().GetByName(rid1)
	require.Nil(t, err, "Should have found the imported role.")

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
	th.App.Srv.Store.System().Save(&model.System{Name: model.MIGRATION_KEY_ADVANCED_PERMISSIONS_PHASE_2, Value: "true"})

	defer func() {
		th.App.Srv.Store.System().PermanentDeleteByName(model.MIGRATION_KEY_ADVANCED_PERMISSIONS_PHASE_2)
	}()

	scheme1 := th.SetupTeamScheme()
	scheme2 := th.SetupTeamScheme()

	// Check how many teams are in the database.
	teamsCount, err := th.App.Srv.Store.Team().AnalyticsTeamCount(false)
	require.Nil(t, err, "Failed to get team count.")

	data := TeamImportData{
		Name:            ptrStr(model.NewId()),
		DisplayName:     ptrStr("Display Name"),
		Type:            ptrStr("XYZ"),
		Description:     ptrStr("The team description."),
		AllowOpenInvite: ptrBool(true),
		Scheme:          &scheme1.Name,
	}

	// Try importing an invalid team in dryRun mode.
	err = th.App.importTeam(&data, true)
	require.NotNil(t, err, "Should have received an error importing an invalid team.")

	// Do a valid team in dry-run mode.
	data.Type = ptrStr("O")
	err = th.App.importTeam(&data, true)
	require.Nil(t, err, "Received an error validating valid team.")

	// Check that no more teams are in the DB.
	th.CheckTeamCount(t, teamsCount)

	// Do an invalid team in apply mode, check db changes.
	data.Type = ptrStr("XYZ")
	err = th.App.importTeam(&data, false)
	require.NotNil(t, err, "Import should have failed on invalid team.")

	// Check that no more teams are in the DB.
	th.CheckTeamCount(t, teamsCount)

	// Do a valid team in apply mode, check db changes.
	data.Type = ptrStr("O")
	err = th.App.importTeam(&data, false)
	require.Nil(t, err, "Received an error importing valid team: %v", err)

	// Check that one more team is in the DB.
	th.CheckTeamCount(t, teamsCount+1)

	// Get the team and check that all the fields are correct.
	team, err := th.App.GetTeamByName(*data.Name)
	require.Nil(t, err, "Failed to get team from database.")

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
	err = th.App.importTeam(&data, false)
	require.Nil(t, err, "Received an error importing updated valid team.")

	th.CheckTeamCount(t, teamsCount+1)

	// Get the team and check that all fields are correct.
	team, err = th.App.GetTeamByName(*data.Name)
	require.Nil(t, err, "Failed to get team from database.")

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
	th.App.Srv.Store.System().Save(&model.System{Name: model.MIGRATION_KEY_ADVANCED_PERMISSIONS_PHASE_2, Value: "true"})

	defer func() {
		th.App.Srv.Store.System().PermanentDeleteByName(model.MIGRATION_KEY_ADVANCED_PERMISSIONS_PHASE_2)
	}()

	scheme1 := th.SetupChannelScheme()
	scheme2 := th.SetupChannelScheme()

	// Import a Team.
	teamName := model.NewRandomTeamName()
	th.App.importTeam(&TeamImportData{
		Name:        &teamName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}, false)
	team, err := th.App.GetTeamByName(teamName)
	require.Nil(t, err, "Failed to get team from database.")

	// Check how many channels are in the database.
	channelCount, err := th.App.Srv.Store.Channel().AnalyticsTypeCount("", model.CHANNEL_OPEN)
	require.Nil(t, err, "Failed to get team count.")

	// Do an invalid channel in dry-run mode.
	data := ChannelImportData{
		Team:        &teamName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
		Header:      ptrStr("Channe Header"),
		Purpose:     ptrStr("Channel Purpose"),
		Scheme:      &scheme1.Name,
	}
	err = th.App.importChannel(&data, true)
	require.NotNil(t, err, "Expected error due to invalid name.")

	// Check that no more channels are in the DB.
	th.CheckChannelsCount(t, channelCount)

	// Do a valid channel with a nonexistent team in dry-run mode.
	data.Name = ptrStr("channelname")
	data.Team = ptrStr(model.NewId())
	err = th.App.importChannel(&data, true)
	require.Nil(t, err, "Expected success as cannot validate channel name in dry run mode.")

	// Check that no more channels are in the DB.
	th.CheckChannelsCount(t, channelCount)

	// Do a valid channel in dry-run mode.
	data.Team = &teamName
	err = th.App.importChannel(&data, true)
	require.Nil(t, err, "Expected success as valid team.")

	// Check that no more channels are in the DB.
	th.CheckChannelsCount(t, channelCount)

	// Do an invalid channel in apply mode.
	data.Name = nil
	err = th.App.importChannel(&data, false)
	require.NotNil(t, err, "Expected error due to invalid name (apply mode).")

	// Check that no more channels are in the DB.
	th.CheckChannelsCount(t, channelCount)

	// Do a valid channel in apply mode with a non-existent team.
	data.Name = ptrStr("channelname")
	data.Team = ptrStr(model.NewId())
	err = th.App.importChannel(&data, false)
	require.NotNil(t, err, "Expected error due to non-existent team (apply mode).")

	// Check that no more channels are in the DB.
	th.CheckChannelsCount(t, channelCount)

	// Do a valid channel in apply mode.
	data.Team = &teamName
	err = th.App.importChannel(&data, false)
	require.Nil(t, err, "Expected success in apply mode")

	// Check that 1 more channel is in the DB.
	th.CheckChannelsCount(t, channelCount+1)

	// Get the Channel and check all the fields are correct.
	channel, err := th.App.GetChannelByName(*data.Name, team.Id, false)
	require.Nil(t, err, "Failed to get channel from database.")

	assert.Equal(t, *data.Name, channel.Name)
	assert.Equal(t, *data.DisplayName, channel.DisplayName)
	assert.Equal(t, *data.Type, channel.Type)
	assert.Equal(t, *data.Header, channel.Header)
	assert.Equal(t, *data.Purpose, channel.Purpose)
	assert.Equal(t, scheme1.Id, *channel.SchemeId)

	// Alter all the fields of that channel.
	data.DisplayName = ptrStr("Chaned Disp Name")
	data.Type = ptrStr(model.CHANNEL_PRIVATE)
	data.Header = ptrStr("New Header")
	data.Purpose = ptrStr("New Purpose")
	data.Scheme = &scheme2.Name
	err = th.App.importChannel(&data, false)
	require.Nil(t, err, "Expected success in apply mode")

	// Check channel count the same.
	th.CheckChannelsCount(t, channelCount)

	// Get the Channel and check all the fields are correct.
	channel, err = th.App.GetChannelByName(*data.Name, team.Id, false)
	require.Nil(t, err, "Failed to get channel from database.")

	assert.Equal(t, *data.Name, channel.Name)
	assert.Equal(t, *data.DisplayName, channel.DisplayName)
	assert.Equal(t, *data.Type, channel.Type)
	assert.Equal(t, *data.Header, channel.Header)
	assert.Equal(t, *data.Purpose, channel.Purpose)
	assert.Equal(t, scheme2.Id, *channel.SchemeId)
}

func TestImportImportUser(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Check how many users are in the database.
	userCount, err := th.App.Srv.Store.User().Count(model.UserCountOptions{
		IncludeDeleted:     true,
		IncludeBotAccounts: false,
	})
	require.Nil(t, err, "Failed to get user count.")

	// Do an invalid user in dry-run mode.
	data := UserImportData{
		Username: ptrStr(model.NewId()),
	}
	err = th.App.importUser(&data, true)
	require.NotNil(t, err, "Should have failed to import invalid user.")

	// Check that no more users are in the DB.
	userCount2, err := th.App.Srv.Store.User().Count(model.UserCountOptions{
		IncludeDeleted:     true,
		IncludeBotAccounts: false,
	})
	require.Nil(t, err, "Failed to get user count.")
	assert.Equal(t, userCount, userCount2, "Unexpected number of users")

	// Do a valid user in dry-run mode.
	data = UserImportData{
		Username: ptrStr(model.NewId()),
		Email:    ptrStr(model.NewId() + "@example.com"),
	}
	err = th.App.importUser(&data, true)
	require.Nil(t, err, "Should have succeeded to import valid user.")

	// Check that no more users are in the DB.
	userCount3, err := th.App.Srv.Store.User().Count(model.UserCountOptions{
		IncludeDeleted:     true,
		IncludeBotAccounts: false,
	})
	require.Nil(t, err, "Failed to get user count.")
	assert.Equal(t, userCount, userCount3, "Unexpected number of users")

	// Do an invalid user in apply mode.
	data = UserImportData{
		Username: ptrStr(model.NewId()),
	}
	err = th.App.importUser(&data, false)
	require.NotNil(t, err, "Should have failed to import invalid user.")

	// Check that no more users are in the DB.
	userCount4, err := th.App.Srv.Store.User().Count(model.UserCountOptions{
		IncludeDeleted:     true,
		IncludeBotAccounts: false,
	})
	require.Nil(t, err, "Failed to get user count.")
	assert.Equal(t, userCount, userCount4, "Unexpected number of users")

	// Do a valid user in apply mode.
	username := model.NewId()
	testsDir, _ := fileutils.FindDir("tests")
	data = UserImportData{
		ProfileImage: ptrStr(filepath.Join(testsDir, "test.png")),
		Username:     &username,
		Email:        ptrStr(model.NewId() + "@example.com"),
		Nickname:     ptrStr(model.NewId()),
		FirstName:    ptrStr(model.NewId()),
		LastName:     ptrStr(model.NewId()),
		Position:     ptrStr(model.NewId()),
	}
	err = th.App.importUser(&data, false)
	require.Nil(t, err, "Should have succeeded to import valid user.")

	// Check that one more user is in the DB.
	userCount5, err := th.App.Srv.Store.User().Count(model.UserCountOptions{
		IncludeDeleted:     true,
		IncludeBotAccounts: false,
	})
	require.Nil(t, err, "Failed to get user count.")
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

	err = th.App.importUser(&data, false)
	require.Nil(t, err, "Should have succeeded to update valid user %v", err)

	// Check user count the same.
	userCount6, err := th.App.Srv.Store.User().Count(model.UserCountOptions{
		IncludeDeleted:     true,
		IncludeBotAccounts: false,
	})
	require.Nil(t, err, "Failed to get user count.")
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
	err = th.App.importUser(&data, false)
	require.NotNil(t, err, "Should have failed to import invalid user.")

	data.AuthData = nil
	err = th.App.importUser(&data, false)
	require.Nil(t, err, "Should have succeeded to update valid user %v", err)

	data.Password = ptrStr("")
	err = th.App.importUser(&data, false)
	require.NotNil(t, err, "Should have failed to import invalid user.")

	data.Password = ptrStr(strings.Repeat("0123456789", 10))
	err = th.App.importUser(&data, false)
	require.NotNil(t, err, "Should have failed to import invalid user.")

	data.Password = ptrStr("TestPassword")

	// Test team and channel memberships
	teamName := model.NewRandomTeamName()
	th.App.importTeam(&TeamImportData{
		Name:        &teamName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}, false)
	team, err := th.App.GetTeamByName(teamName)
	require.Nil(t, err, "Failed to get team from database.")

	channelName := model.NewId()
	th.App.importChannel(&ChannelImportData{
		Team:        &teamName,
		Name:        &channelName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}, false)
	channel, err := th.App.GetChannelByName(channelName, team.Id, false)
	require.Nil(t, err, "Failed to get channel from database.")

	username = model.NewId()
	data = UserImportData{
		Username:  &username,
		Email:     ptrStr(model.NewId() + "@example.com"),
		Nickname:  ptrStr(model.NewId()),
		FirstName: ptrStr(model.NewId()),
		LastName:  ptrStr(model.NewId()),
		Position:  ptrStr(model.NewId()),
	}

	teamMembers, err := th.App.GetTeamMembers(team.Id, 0, 1000, nil)
	require.Nil(t, err, "Failed to get team member count")
	teamMemberCount := len(teamMembers)

	channelMemberCount, err := th.App.GetChannelMemberCount(channel.Id)
	require.Nil(t, err, "Failed to get channel member count")

	// Test with an invalid team & channel membership in dry-run mode.
	data.Teams = &[]UserTeamImportData{
		{
			Roles: ptrStr("invalid"),
			Channels: &[]UserChannelImportData{
				{
					Roles: ptrStr("invalid"),
				},
			},
		},
	}
	err = th.App.importUser(&data, true)
	assert.NotNil(t, err)

	// Test with an unknown team name & invalid channel membership in dry-run mode.
	data.Teams = &[]UserTeamImportData{
		{
			Name: ptrStr(model.NewId()),
			Channels: &[]UserChannelImportData{
				{
					Roles: ptrStr("invalid"),
				},
			},
		},
	}
	err = th.App.importUser(&data, true)
	assert.NotNil(t, err)

	// Test with a valid team & invalid channel membership in dry-run mode.
	data.Teams = &[]UserTeamImportData{
		{
			Name: &teamName,
			Channels: &[]UserChannelImportData{
				{
					Roles: ptrStr("invalid"),
				},
			},
		},
	}
	err = th.App.importUser(&data, true)
	assert.NotNil(t, err)

	// Test with a valid team & unknown channel name in dry-run mode.
	data.Teams = &[]UserTeamImportData{
		{
			Name: &teamName,
			Channels: &[]UserChannelImportData{
				{
					Name: ptrStr(model.NewId()),
				},
			},
		},
	}
	err = th.App.importUser(&data, true)
	assert.Nil(t, err)

	// Test with a valid team & valid channel name in dry-run mode.
	data.Teams = &[]UserTeamImportData{
		{
			Name: &teamName,
			Channels: &[]UserChannelImportData{
				{
					Name: &channelName,
				},
			},
		},
	}
	err = th.App.importUser(&data, true)
	assert.Nil(t, err)

	// Check no new member objects were created because dry run mode.
	tmc, err := th.App.GetTeamMembers(team.Id, 0, 1000, nil)
	require.Nil(t, err, "Failed to get Team Member Count")
	require.Len(t, tmc, teamMemberCount, "Number of team members not as expected")

	cmc, err := th.App.GetChannelMemberCount(channel.Id)
	require.Nil(t, err, "Failed to get Channel Member Count")
	require.Equal(t, channelMemberCount, cmc, "Number of channel members not as expected")

	// Test with an invalid team & channel membership in apply mode.
	data.Teams = &[]UserTeamImportData{
		{
			Roles: ptrStr("invalid"),
			Channels: &[]UserChannelImportData{
				{
					Roles: ptrStr("invalid"),
				},
			},
		},
	}
	err = th.App.importUser(&data, false)
	assert.NotNil(t, err)

	// Test with an unknown team name & invalid channel membership in apply mode.
	data.Teams = &[]UserTeamImportData{
		{
			Name: ptrStr(model.NewId()),
			Channels: &[]UserChannelImportData{
				{
					Roles: ptrStr("invalid"),
				},
			},
		},
	}
	err = th.App.importUser(&data, false)
	assert.NotNil(t, err)

	// Test with a valid team & invalid channel membership in apply mode.
	data.Teams = &[]UserTeamImportData{
		{
			Name: &teamName,
			Channels: &[]UserChannelImportData{
				{
					Roles: ptrStr("invalid"),
				},
			},
		},
	}
	err = th.App.importUser(&data, false)
	assert.NotNil(t, err)

	// Check no new member objects were created because all tests should have failed so far.
	tmc, err = th.App.GetTeamMembers(team.Id, 0, 1000, nil)
	require.Nil(t, err, "Failed to get Team Member Count")
	require.Len(t, tmc, teamMemberCount)

	cmc, err = th.App.GetChannelMemberCount(channel.Id)
	require.Nil(t, err, "Failed to get Channel Member Count")
	require.Equal(t, channelMemberCount, cmc)

	// Test with a valid team & unknown channel name in apply mode.
	data.Teams = &[]UserTeamImportData{
		{
			Name: &teamName,
			Channels: &[]UserChannelImportData{
				{
					Name: ptrStr(model.NewId()),
				},
			},
		},
	}
	err = th.App.importUser(&data, false)
	assert.NotNil(t, err)

	// Check only new team member object created because dry run mode.
	tmc, err = th.App.GetTeamMembers(team.Id, 0, 1000, nil)
	require.Nil(t, err, "Failed to get Team Member Count")
	require.Len(t, tmc, teamMemberCount+1)

	cmc, err = th.App.GetChannelMemberCount(channel.Id)
	require.Nil(t, err, "Failed to get Channel Member Count")
	require.Equal(t, channelMemberCount, cmc)

	// Check team member properties.
	user, err = th.App.GetUserByUsername(username)
	require.Nil(t, err, "Failed to get user from database.")

	teamMember, err := th.App.GetTeamMember(team.Id, user.Id)
	require.Nil(t, err, "Failed to get team member from database.")
	require.Equal(t, "team_user", teamMember.Roles)

	// Test with a valid team & valid channel name in apply mode.
	data.Teams = &[]UserTeamImportData{
		{
			Name: &teamName,
			Channels: &[]UserChannelImportData{
				{
					Name: &channelName,
				},
			},
		},
	}
	err = th.App.importUser(&data, false)
	assert.Nil(t, err)

	// Check only new channel member object created because dry run mode.
	tmc, err = th.App.GetTeamMembers(team.Id, 0, 1000, nil)
	require.Nil(t, err, "Failed to get Team Member Count")
	require.Len(t, tmc, teamMemberCount+1, "Number of team members not as expected")

	cmc, err = th.App.GetChannelMemberCount(channel.Id)
	require.Nil(t, err, "Failed to get Channel Member Count")
	require.Equal(t, channelMemberCount+1, cmc, "Number of channel members not as expected")

	// Check channel member properties.
	channelMember, err := th.App.GetChannelMember(channel.Id, user.Id)
	require.Nil(t, err, "Failed to get channel member from database.")
	assert.Equal(t, "channel_user", channelMember.Roles)
	assert.Equal(t, "default", channelMember.NotifyProps[model.DESKTOP_NOTIFY_PROP])
	assert.Equal(t, "default", channelMember.NotifyProps[model.PUSH_NOTIFY_PROP])
	assert.Equal(t, "all", channelMember.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP])

	// Test with the properties of the team and channel membership changed.
	data.Teams = &[]UserTeamImportData{
		{
			Name:  &teamName,
			Theme: ptrStr(`{"awayIndicator":"#DBBD4E","buttonBg":"#23A1FF","buttonColor":"#FFFFFF","centerChannelBg":"#ffffff","centerChannelColor":"#333333","codeTheme":"github","image":"/static/files/a4a388b38b32678e83823ef1b3e17766.png","linkColor":"#2389d7","mentionBg":"#2389d7","mentionColor":"#ffffff","mentionHighlightBg":"#fff2bb","mentionHighlightLink":"#2f81b7","newMessageSeparator":"#FF8800","onlineIndicator":"#7DBE00","sidebarBg":"#fafafa","sidebarHeaderBg":"#3481B9","sidebarHeaderTextColor":"#ffffff","sidebarText":"#333333","sidebarTextActiveBorder":"#378FD2","sidebarTextActiveColor":"#111111","sidebarTextHoverBg":"#e6f2fa","sidebarUnreadText":"#333333","type":"Mattermost"}`),
			Roles: ptrStr("team_user team_admin"),
			Channels: &[]UserChannelImportData{
				{
					Name:  &channelName,
					Roles: ptrStr("channel_user channel_admin"),
					NotifyProps: &UserChannelNotifyPropsImportData{
						Desktop:    ptrStr(model.USER_NOTIFY_MENTION),
						Mobile:     ptrStr(model.USER_NOTIFY_MENTION),
						MarkUnread: ptrStr(model.USER_NOTIFY_MENTION),
					},
					Favorite: ptrBool(true),
				},
			},
		},
	}
	err = th.App.importUser(&data, false)
	assert.Nil(t, err)

	// Check both member properties.
	teamMember, err = th.App.GetTeamMember(team.Id, user.Id)
	require.Nil(t, err, "Failed to get team member from database.")
	require.Equal(t, "team_user team_admin", teamMember.Roles)

	channelMember, err = th.App.GetChannelMember(channel.Id, user.Id)
	require.Nil(t, err, "Failed to get channel member Desktop from database.")
	assert.Equal(t, "channel_user channel_admin", channelMember.Roles)
	assert.Equal(t, model.USER_NOTIFY_MENTION, channelMember.NotifyProps[model.DESKTOP_NOTIFY_PROP])
	assert.Equal(t, model.USER_NOTIFY_MENTION, channelMember.NotifyProps[model.PUSH_NOTIFY_PROP])
	assert.Equal(t, model.USER_NOTIFY_MENTION, channelMember.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP])

	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL, channel.Id, "true")
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_THEME, team.Id, *(*data.Teams)[0].Theme)

	// No more new member objects.
	tmc, err = th.App.GetTeamMembers(team.Id, 0, 1000, nil)
	require.Nil(t, err, "Failed to get Team Member Count")
	require.Len(t, tmc, teamMemberCount+1, "Number of team members not as expected")

	cmc, err = th.App.GetChannelMemberCount(channel.Id)
	require.Nil(t, err, "Failed to get Channel Member Count")
	require.Equal(t, channelMemberCount+1, cmc, "Number of channel members not as expected")

	// Add a user with some preferences.
	username = model.NewId()
	data = UserImportData{
		Username:           &username,
		Email:              ptrStr(model.NewId() + "@example.com"),
		Theme:              ptrStr(`{"awayIndicator":"#DCBD4E","buttonBg":"#23A2FF","buttonColor":"#FFFFFF","centerChannelBg":"#ffffff","centerChannelColor":"#333333","codeTheme":"github","image":"/static/files/a4a388b38b32678e83823ef1b3e17766.png","linkColor":"#2389d7","mentionBg":"#2389d7","mentionColor":"#ffffff","mentionHighlightBg":"#fff2bb","mentionHighlightLink":"#2f81b7","newMessageSeparator":"#FF8800","onlineIndicator":"#7DBE00","sidebarBg":"#fafafa","sidebarHeaderBg":"#3481B9","sidebarHeaderTextColor":"#ffffff","sidebarText":"#333333","sidebarTextActiveBorder":"#378FD2","sidebarTextActiveColor":"#111111","sidebarTextHoverBg":"#e6f2fa","sidebarUnreadText":"#333333","type":"Mattermost"}`),
		UseMilitaryTime:    ptrStr("true"),
		CollapsePreviews:   ptrStr("true"),
		MessageDisplay:     ptrStr("compact"),
		ChannelDisplayMode: ptrStr("centered"),
		TutorialStep:       ptrStr("3"),
		UseMarkdownPreview: ptrStr("true"),
		UseFormatting:      ptrStr("true"),
		ShowUnreadSection:  ptrStr("true"),
		EmailInterval:      ptrStr("immediately"),
	}
	err = th.App.importUser(&data, false)
	assert.Nil(t, err)

	// Check their values.
	user, err = th.App.GetUserByUsername(username)
	require.Nil(t, err, "Failed to get user from database.")

	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_THEME, "", *data.Theme)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, model.PREFERENCE_NAME_USE_MILITARY_TIME, *data.UseMilitaryTime)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, model.PREFERENCE_NAME_COLLAPSE_SETTING, *data.CollapsePreviews)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, model.PREFERENCE_NAME_MESSAGE_DISPLAY, *data.MessageDisplay)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, model.PREFERENCE_NAME_CHANNEL_DISPLAY_MODE, *data.ChannelDisplayMode)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_TUTORIAL_STEPS, user.Id, *data.TutorialStep)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_ADVANCED_SETTINGS, "feature_enabled_markdown_preview", *data.UseMarkdownPreview)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_ADVANCED_SETTINGS, "formatting", *data.UseFormatting)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_SIDEBAR_SETTINGS, "show_unread_section", *data.ShowUnreadSection)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_NOTIFICATIONS, model.PREFERENCE_NAME_EMAIL_INTERVAL, "30")

	// Change those preferences.
	data = UserImportData{
		Username:           &username,
		Email:              ptrStr(model.NewId() + "@example.com"),
		Theme:              ptrStr(`{"awayIndicator":"#123456","buttonBg":"#23A2FF","buttonColor":"#FFFFFF","centerChannelBg":"#ffffff","centerChannelColor":"#333333","codeTheme":"github","image":"/static/files/a4a388b38b32678e83823ef1b3e17766.png","linkColor":"#2389d7","mentionBg":"#2389d7","mentionColor":"#ffffff","mentionHighlightBg":"#fff2bb","mentionHighlightLink":"#2f81b7","newMessageSeparator":"#FF8800","onlineIndicator":"#7DBE00","sidebarBg":"#fafafa","sidebarHeaderBg":"#3481B9","sidebarHeaderTextColor":"#ffffff","sidebarText":"#333333","sidebarTextActiveBorder":"#378FD2","sidebarTextActiveColor":"#111111","sidebarTextHoverBg":"#e6f2fa","sidebarUnreadText":"#333333","type":"Mattermost"}`),
		UseMilitaryTime:    ptrStr("false"),
		CollapsePreviews:   ptrStr("false"),
		MessageDisplay:     ptrStr("clean"),
		ChannelDisplayMode: ptrStr("full"),
		TutorialStep:       ptrStr("2"),
		EmailInterval:      ptrStr("hour"),
	}
	err = th.App.importUser(&data, false)
	assert.Nil(t, err)

	// Check their values again.
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_THEME, "", *data.Theme)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, model.PREFERENCE_NAME_USE_MILITARY_TIME, *data.UseMilitaryTime)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, model.PREFERENCE_NAME_COLLAPSE_SETTING, *data.CollapsePreviews)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, model.PREFERENCE_NAME_MESSAGE_DISPLAY, *data.MessageDisplay)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, model.PREFERENCE_NAME_CHANNEL_DISPLAY_MODE, *data.ChannelDisplayMode)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_TUTORIAL_STEPS, user.Id, *data.TutorialStep)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_NOTIFICATIONS, model.PREFERENCE_NAME_EMAIL_INTERVAL, "3600")

	// Set Notify Without mention keys
	data.NotifyProps = &UserNotifyPropsImportData{
		Desktop:          ptrStr(model.USER_NOTIFY_ALL),
		DesktopSound:     ptrStr("true"),
		Email:            ptrStr("true"),
		Mobile:           ptrStr(model.USER_NOTIFY_ALL),
		MobilePushStatus: ptrStr(model.STATUS_ONLINE),
		ChannelTrigger:   ptrStr("true"),
		CommentsTrigger:  ptrStr(model.COMMENTS_NOTIFY_ROOT),
	}
	err = th.App.importUser(&data, false)
	assert.Nil(t, err)

	user, err = th.App.GetUserByUsername(username)
	require.Nil(t, err, "Failed to get user from database.")

	checkNotifyProp(t, user, model.DESKTOP_NOTIFY_PROP, model.USER_NOTIFY_ALL)
	checkNotifyProp(t, user, model.DESKTOP_SOUND_NOTIFY_PROP, "true")
	checkNotifyProp(t, user, model.EMAIL_NOTIFY_PROP, "true")
	checkNotifyProp(t, user, model.PUSH_NOTIFY_PROP, model.USER_NOTIFY_ALL)
	checkNotifyProp(t, user, model.PUSH_STATUS_NOTIFY_PROP, model.STATUS_ONLINE)
	checkNotifyProp(t, user, model.CHANNEL_MENTIONS_NOTIFY_PROP, "true")
	checkNotifyProp(t, user, model.COMMENTS_NOTIFY_PROP, model.COMMENTS_NOTIFY_ROOT)
	checkNotifyProp(t, user, model.MENTION_KEYS_NOTIFY_PROP, fmt.Sprintf("%s,@%s", username, username))

	// Set Notify Props with Mention keys
	data.NotifyProps = &UserNotifyPropsImportData{
		Desktop:          ptrStr(model.USER_NOTIFY_ALL),
		DesktopSound:     ptrStr("true"),
		Email:            ptrStr("true"),
		Mobile:           ptrStr(model.USER_NOTIFY_ALL),
		MobilePushStatus: ptrStr(model.STATUS_ONLINE),
		ChannelTrigger:   ptrStr("true"),
		CommentsTrigger:  ptrStr(model.COMMENTS_NOTIFY_ROOT),
		MentionKeys:      ptrStr("valid,misc"),
	}
	err = th.App.importUser(&data, false)
	assert.Nil(t, err)

	user, err = th.App.GetUserByUsername(username)
	require.Nil(t, err, "Failed to get user from database.")

	checkNotifyProp(t, user, model.DESKTOP_NOTIFY_PROP, model.USER_NOTIFY_ALL)
	checkNotifyProp(t, user, model.DESKTOP_SOUND_NOTIFY_PROP, "true")
	checkNotifyProp(t, user, model.EMAIL_NOTIFY_PROP, "true")
	checkNotifyProp(t, user, model.PUSH_NOTIFY_PROP, model.USER_NOTIFY_ALL)
	checkNotifyProp(t, user, model.PUSH_STATUS_NOTIFY_PROP, model.STATUS_ONLINE)
	checkNotifyProp(t, user, model.CHANNEL_MENTIONS_NOTIFY_PROP, "true")
	checkNotifyProp(t, user, model.COMMENTS_NOTIFY_PROP, model.COMMENTS_NOTIFY_ROOT)
	checkNotifyProp(t, user, model.MENTION_KEYS_NOTIFY_PROP, "valid,misc")

	// Change Notify Props with mention keys
	data.NotifyProps = &UserNotifyPropsImportData{
		Desktop:          ptrStr(model.USER_NOTIFY_MENTION),
		DesktopSound:     ptrStr("false"),
		Email:            ptrStr("false"),
		Mobile:           ptrStr(model.USER_NOTIFY_NONE),
		MobilePushStatus: ptrStr(model.STATUS_AWAY),
		ChannelTrigger:   ptrStr("false"),
		CommentsTrigger:  ptrStr(model.COMMENTS_NOTIFY_ANY),
		MentionKeys:      ptrStr("misc"),
	}
	err = th.App.importUser(&data, false)
	assert.Nil(t, err)

	user, err = th.App.GetUserByUsername(username)
	require.Nil(t, err, "Failed to get user from database.")

	checkNotifyProp(t, user, model.DESKTOP_NOTIFY_PROP, model.USER_NOTIFY_MENTION)
	checkNotifyProp(t, user, model.DESKTOP_SOUND_NOTIFY_PROP, "false")
	checkNotifyProp(t, user, model.EMAIL_NOTIFY_PROP, "false")
	checkNotifyProp(t, user, model.PUSH_NOTIFY_PROP, model.USER_NOTIFY_NONE)
	checkNotifyProp(t, user, model.PUSH_STATUS_NOTIFY_PROP, model.STATUS_AWAY)
	checkNotifyProp(t, user, model.CHANNEL_MENTIONS_NOTIFY_PROP, "false")
	checkNotifyProp(t, user, model.COMMENTS_NOTIFY_PROP, model.COMMENTS_NOTIFY_ANY)
	checkNotifyProp(t, user, model.MENTION_KEYS_NOTIFY_PROP, "misc")

	// Change Notify Props without mention keys
	data.NotifyProps = &UserNotifyPropsImportData{
		Desktop:          ptrStr(model.USER_NOTIFY_MENTION),
		DesktopSound:     ptrStr("false"),
		Email:            ptrStr("false"),
		Mobile:           ptrStr(model.USER_NOTIFY_NONE),
		MobilePushStatus: ptrStr(model.STATUS_AWAY),
		ChannelTrigger:   ptrStr("false"),
		CommentsTrigger:  ptrStr(model.COMMENTS_NOTIFY_ANY),
	}
	err = th.App.importUser(&data, false)
	assert.Nil(t, err)

	user, err = th.App.GetUserByUsername(username)
	require.Nil(t, err, "Failed to get user from database.")

	checkNotifyProp(t, user, model.DESKTOP_NOTIFY_PROP, model.USER_NOTIFY_MENTION)
	checkNotifyProp(t, user, model.DESKTOP_SOUND_NOTIFY_PROP, "false")
	checkNotifyProp(t, user, model.EMAIL_NOTIFY_PROP, "false")
	checkNotifyProp(t, user, model.PUSH_NOTIFY_PROP, model.USER_NOTIFY_NONE)
	checkNotifyProp(t, user, model.PUSH_STATUS_NOTIFY_PROP, model.STATUS_AWAY)
	checkNotifyProp(t, user, model.CHANNEL_MENTIONS_NOTIFY_PROP, "false")
	checkNotifyProp(t, user, model.COMMENTS_NOTIFY_PROP, model.COMMENTS_NOTIFY_ANY)
	checkNotifyProp(t, user, model.MENTION_KEYS_NOTIFY_PROP, "misc")

	// Check Notify Props get set on *create* user.
	username = model.NewId()
	data = UserImportData{
		Username: &username,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}
	data.NotifyProps = &UserNotifyPropsImportData{
		Desktop:          ptrStr(model.USER_NOTIFY_MENTION),
		DesktopSound:     ptrStr("false"),
		Email:            ptrStr("false"),
		Mobile:           ptrStr(model.USER_NOTIFY_NONE),
		MobilePushStatus: ptrStr(model.STATUS_AWAY),
		ChannelTrigger:   ptrStr("false"),
		CommentsTrigger:  ptrStr(model.COMMENTS_NOTIFY_ANY),
		MentionKeys:      ptrStr("misc"),
	}

	err = th.App.importUser(&data, false)
	assert.Nil(t, err)

	user, err = th.App.GetUserByUsername(username)
	require.Nil(t, err, "Failed to get user from database.")

	checkNotifyProp(t, user, model.DESKTOP_NOTIFY_PROP, model.USER_NOTIFY_MENTION)
	checkNotifyProp(t, user, model.DESKTOP_SOUND_NOTIFY_PROP, "false")
	checkNotifyProp(t, user, model.EMAIL_NOTIFY_PROP, "false")
	checkNotifyProp(t, user, model.PUSH_NOTIFY_PROP, model.USER_NOTIFY_NONE)
	checkNotifyProp(t, user, model.PUSH_STATUS_NOTIFY_PROP, model.STATUS_AWAY)
	checkNotifyProp(t, user, model.CHANNEL_MENTIONS_NOTIFY_PROP, "false")
	checkNotifyProp(t, user, model.COMMENTS_NOTIFY_PROP, model.COMMENTS_NOTIFY_ANY)
	checkNotifyProp(t, user, model.MENTION_KEYS_NOTIFY_PROP, "misc")

	// Test importing a user with roles set to a team and a channel which are affected by an override scheme.
	// The import subsystem should translate `channel_admin/channel_user/team_admin/team_user`
	// to the appropriate scheme-managed-role booleans.

	// Mark the phase 2 permissions migration as completed.
	th.App.Srv.Store.System().Save(&model.System{Name: model.MIGRATION_KEY_ADVANCED_PERMISSIONS_PHASE_2, Value: "true"})

	defer func() {
		th.App.Srv.Store.System().PermanentDeleteByName(model.MIGRATION_KEY_ADVANCED_PERMISSIONS_PHASE_2)
	}()

	teamSchemeData := &SchemeImportData{
		Name:        ptrStr(model.NewId()),
		DisplayName: ptrStr(model.NewId()),
		Scope:       ptrStr("team"),
		DefaultTeamGuestRole: &RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultTeamUserRole: &RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultTeamAdminRole: &RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultChannelGuestRole: &RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultChannelUserRole: &RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		DefaultChannelAdminRole: &RoleImportData{
			Name:        ptrStr(model.NewId()),
			DisplayName: ptrStr(model.NewId()),
		},
		Description: ptrStr("description"),
	}

	err = th.App.importScheme(teamSchemeData, false)
	assert.Nil(t, err)

	teamScheme, err := th.App.Srv.Store.Scheme().GetByName(*teamSchemeData.Name)
	require.Nil(t, err, "Failed to import scheme")

	teamData := &TeamImportData{
		Name:            ptrStr(model.NewId()),
		DisplayName:     ptrStr("Display Name"),
		Type:            ptrStr("O"),
		Description:     ptrStr("The team description."),
		AllowOpenInvite: ptrBool(true),
		Scheme:          &teamScheme.Name,
	}
	err = th.App.importTeam(teamData, false)
	assert.Nil(t, err)
	team, err = th.App.GetTeamByName(teamName)
	require.Nil(t, err, "Failed to get team from database.")

	channelData := &ChannelImportData{
		Team:        &teamName,
		Name:        ptrStr(model.NewId()),
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
		Header:      ptrStr("Channe Header"),
		Purpose:     ptrStr("Channel Purpose"),
	}
	err = th.App.importChannel(channelData, false)
	assert.Nil(t, err)
	channel, err = th.App.GetChannelByName(*channelData.Name, team.Id, false)
	require.Nil(t, err, "Failed to get channel from database")

	// Test with a valid team & valid channel name in apply mode.
	userData := &UserImportData{
		Username: &username,
		Email:    ptrStr(model.NewId() + "@example.com"),
		Teams: &[]UserTeamImportData{
			{
				Name:  &team.Name,
				Roles: ptrStr("team_user team_admin"),
				Channels: &[]UserChannelImportData{
					{
						Name:  &channel.Name,
						Roles: ptrStr("channel_admin channel_user"),
					},
				},
			},
		},
	}
	err = th.App.importUser(userData, false)
	assert.Nil(t, err)

	user, err = th.App.GetUserByUsername(*userData.Username)
	require.Nil(t, err, "Failed to get user from database.")

	teamMember, err = th.App.GetTeamMember(team.Id, user.Id)
	require.Nil(t, err, "Failed to get the team member")

	assert.True(t, teamMember.SchemeAdmin)
	assert.True(t, teamMember.SchemeUser)
	assert.False(t, teamMember.SchemeGuest)
	assert.Equal(t, "", teamMember.ExplicitRoles)

	channelMember, err = th.App.GetChannelMember(channel.Id, user.Id)
	require.Nil(t, err, "Failed to get the channel member")

	assert.True(t, channelMember.SchemeAdmin)
	assert.True(t, channelMember.SchemeUser)
	assert.False(t, channelMember.SchemeGuest)
	assert.Equal(t, "", channelMember.ExplicitRoles)

	// Test importing deleted user with a valid team & valid channel name in apply mode.
	username = model.NewId()
	deleteAt := model.GetMillis()
	deletedUserData := &UserImportData{
		Username: &username,
		DeleteAt: &deleteAt,
		Email:    ptrStr(model.NewId() + "@example.com"),
		Teams: &[]UserTeamImportData{
			{
				Name:  &team.Name,
				Roles: ptrStr("team_user"),
				Channels: &[]UserChannelImportData{
					{
						Name:  &channel.Name,
						Roles: ptrStr("channel_user"),
					},
				},
			},
		},
	}
	err = th.App.importUser(deletedUserData, false)
	assert.Nil(t, err)

	user, err = th.App.GetUserByUsername(*deletedUserData.Username)
	require.Nil(t, err, "Failed to get user from database.")

	teamMember, err = th.App.GetTeamMember(team.Id, user.Id)
	require.Nil(t, err, "Failed to get the team member")

	assert.False(t, teamMember.SchemeAdmin)
	assert.True(t, teamMember.SchemeUser)
	assert.False(t, teamMember.SchemeGuest)
	assert.Equal(t, "", teamMember.ExplicitRoles)

	channelMember, err = th.App.GetChannelMember(channel.Id, user.Id)
	require.Nil(t, err, "Failed to get the channel member")

	assert.False(t, teamMember.SchemeAdmin)
	assert.True(t, channelMember.SchemeUser)
	assert.False(t, teamMember.SchemeGuest)
	assert.Equal(t, "", channelMember.ExplicitRoles)

	// Test importing deleted guest with a valid team & valid channel name in apply mode.
	username = model.NewId()
	deleteAt = model.GetMillis()
	deletedGuestData := &UserImportData{
		Username: &username,
		DeleteAt: &deleteAt,
		Email:    ptrStr(model.NewId() + "@example.com"),
		Teams: &[]UserTeamImportData{
			{
				Name:  &team.Name,
				Roles: ptrStr("team_guest"),
				Channels: &[]UserChannelImportData{
					{
						Name:  &channel.Name,
						Roles: ptrStr("channel_guest"),
					},
				},
			},
		},
	}
	err = th.App.importUser(deletedGuestData, false)
	assert.Nil(t, err)

	user, err = th.App.GetUserByUsername(*deletedGuestData.Username)
	require.Nil(t, err, "Failed to get user from database.")

	teamMember, err = th.App.GetTeamMember(team.Id, user.Id)
	require.Nil(t, err, "Failed to get the team member")

	assert.False(t, teamMember.SchemeAdmin)
	assert.False(t, teamMember.SchemeUser)
	assert.True(t, teamMember.SchemeGuest)
	assert.Equal(t, "", teamMember.ExplicitRoles)

	channelMember, err = th.App.GetChannelMember(channel.Id, user.Id)
	require.Nil(t, err, "Failed to get the channel member")

	assert.False(t, teamMember.SchemeAdmin)
	assert.False(t, channelMember.SchemeUser)
	assert.True(t, teamMember.SchemeGuest)
	assert.Equal(t, "", channelMember.ExplicitRoles)
}

func TestImportUserDefaultNotifyProps(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Create a valid new user with some, but not all, notify props populated.
	username := model.NewId()
	data := UserImportData{
		Username: &username,
		Email:    ptrStr(model.NewId() + "@example.com"),
		NotifyProps: &UserNotifyPropsImportData{
			Email: ptrStr("false"),
		},
	}
	require.Nil(t, th.App.importUser(&data, false))

	user, err := th.App.GetUserByUsername(username)
	require.Nil(t, err)

	// Check the value of the notify prop we specified explicitly in the import data.
	val, ok := user.NotifyProps[model.EMAIL_NOTIFY_PROP]
	assert.True(t, ok)
	assert.Equal(t, "false", val)

	// Check all the other notify props are set to their default values.
	comparisonUser := model.User{Username: user.Username}
	comparisonUser.SetDefaultNotifications()

	for key, expectedValue := range comparisonUser.NotifyProps {
		if key == model.EMAIL_NOTIFY_PROP {
			continue
		}

		val, ok := user.NotifyProps[key]
		assert.True(t, ok)
		assert.Equal(t, expectedValue, val)
	}
}

func TestImportImportPost(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Create a Team.
	teamName := model.NewRandomTeamName()
	th.App.importTeam(&TeamImportData{
		Name:        &teamName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}, false)
	team, err := th.App.GetTeamByName(teamName)
	require.Nil(t, err, "Failed to get team from database.")

	// Create a Channel.
	channelName := model.NewId()
	th.App.importChannel(&ChannelImportData{
		Team:        &teamName,
		Name:        &channelName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}, false)
	channel, err := th.App.GetChannelByName(channelName, team.Id, false)
	require.Nil(t, err, "Failed to get channel from database.")

	// Create a user.
	username := model.NewId()
	th.App.importUser(&UserImportData{
		Username: &username,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}, false)
	user, err := th.App.GetUserByUsername(username)
	require.Nil(t, err, "Failed to get user from database.")

	// Count the number of posts in the testing team.
	initialPostCount, err := th.App.Srv.Store.Post().AnalyticsPostCount(team.Id, false, false)
	require.Nil(t, err)

	// Try adding an invalid post in dry run mode.
	data := &PostImportData{
		Team:    &teamName,
		Channel: &channelName,
		User:    &username,
	}
	err = th.App.importPost(data, true)
	assert.NotNil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)

	// Try adding a valid post in dry run mode.
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &username,
		Message:  ptrStr("Hello"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	err = th.App.importPost(data, true)
	assert.Nil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)

	// Try adding an invalid post in apply mode.
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &username,
		CreateAt: ptrInt64(model.GetMillis()),
	}
	err = th.App.importPost(data, false)
	assert.NotNil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)

	// Try adding a valid post with invalid team in apply mode.
	data = &PostImportData{
		Team:     ptrStr(model.NewId()),
		Channel:  &channelName,
		User:     &username,
		Message:  ptrStr("Message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	err = th.App.importPost(data, false)
	assert.NotNil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)

	// Try adding a valid post with invalid channel in apply mode.
	data = &PostImportData{
		Team:     &teamName,
		Channel:  ptrStr(model.NewId()),
		User:     &username,
		Message:  ptrStr("Message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	err = th.App.importPost(data, false)
	assert.NotNil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)

	// Try adding a valid post with invalid user in apply mode.
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     ptrStr(model.NewId()),
		Message:  ptrStr("Message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	err = th.App.importPost(data, false)
	assert.NotNil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)

	// Try adding a valid post in apply mode.
	time := model.GetMillis()
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &username,
		Message:  ptrStr("Message"),
		CreateAt: &time,
	}
	err = th.App.importPost(data, false)
	assert.Nil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 1, team.Id)

	// Check the post values.
	posts, err := th.App.Srv.Store.Post().GetPostsCreatedAt(channel.Id, time)
	require.Nil(t, err)

	require.Len(t, posts, 1, "Unexpected number of posts found.")

	post := posts[0]
	postBool := post.Message != *data.Message || post.CreateAt != *data.CreateAt || post.UserId != user.Id
	require.False(t, postBool, "Post properties not as expected")

	// Update the post.
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &username,
		Message:  ptrStr("Message"),
		CreateAt: &time,
	}
	err = th.App.importPost(data, false)
	assert.Nil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 1, team.Id)

	// Check the post values.
	posts, err = th.App.Srv.Store.Post().GetPostsCreatedAt(channel.Id, time)
	require.Nil(t, err)

	require.Len(t, posts, 1, "Unexpected number of posts found.")

	post = posts[0]
	postBool = post.Message != *data.Message || post.CreateAt != *data.CreateAt || post.UserId != user.Id
	require.False(t, postBool, "Post properties not as expected")

	// Save the post with a different time.
	newTime := time + 1
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &username,
		Message:  ptrStr("Message"),
		CreateAt: &newTime,
	}
	err = th.App.importPost(data, false)
	assert.Nil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 2, team.Id)

	// Save the post with a different message.
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &username,
		Message:  ptrStr("Message 2"),
		CreateAt: &time,
	}
	err = th.App.importPost(data, false)
	assert.Nil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 3, team.Id)

	// Test with hashtags
	hashtagTime := time + 2
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &username,
		Message:  ptrStr("Message 2 #hashtagmashupcity"),
		CreateAt: &hashtagTime,
	}
	err = th.App.importPost(data, false)
	assert.Nil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 4, team.Id)

	posts, err = th.App.Srv.Store.Post().GetPostsCreatedAt(channel.Id, hashtagTime)
	require.Nil(t, err)

	require.Len(t, posts, 1, "Unexpected number of posts found.")

	post = posts[0]
	postBool = post.Message != *data.Message || post.CreateAt != *data.CreateAt || post.UserId != user.Id
	require.False(t, postBool, "Post properties not as expected")

	require.Equal(t, "#hashtagmashupcity", post.Hashtags, "Hashtags not as expected: %s", post.Hashtags)

	// Post with flags.
	username2 := model.NewId()
	th.App.importUser(&UserImportData{
		Username: &username2,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}, false)
	user2, err := th.App.GetUserByUsername(username2)
	require.Nil(t, err, "Failed to get user from database.")

	flagsTime := hashtagTime + 1
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &username,
		Message:  ptrStr("Message with Favorites"),
		CreateAt: &flagsTime,
		FlaggedBy: &[]string{
			username,
			username2,
		},
	}

	err = th.App.importPost(data, false)
	require.Nil(t, err, "Expected success.")

	AssertAllPostsCount(t, th.App, initialPostCount, 5, team.Id)

	// Check the post values.
	posts, err = th.App.Srv.Store.Post().GetPostsCreatedAt(channel.Id, flagsTime)
	require.Nil(t, err)

	require.Len(t, posts, 1, "Unexpected number of posts found.")

	post = posts[0]
	postBool = post.Message != *data.Message || post.CreateAt != *data.CreateAt || post.UserId != user.Id
	require.False(t, postBool, "Post properties not as expected")

	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_FLAGGED_POST, post.Id, "true")
	checkPreference(t, th.App, user2.Id, model.PREFERENCE_CATEGORY_FLAGGED_POST, post.Id, "true")

	// Post with reaction.
	reactionPostTime := hashtagTime + 2
	reactionTime := hashtagTime + 3
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &username,
		Message:  ptrStr("Message with reaction"),
		CreateAt: &reactionPostTime,
		Reactions: &[]ReactionImportData{{
			User:      &user2.Username,
			EmojiName: ptrStr("+1"),
			CreateAt:  &reactionTime,
		}},
	}
	err = th.App.importPost(data, false)
	require.Nil(t, err, "Expected success.")

	AssertAllPostsCount(t, th.App, initialPostCount, 6, team.Id)

	// Check the post values.
	posts, err = th.App.Srv.Store.Post().GetPostsCreatedAt(channel.Id, reactionPostTime)
	require.Nil(t, err)

	require.Len(t, posts, 1, "Unexpected number of posts found.")

	post = posts[0]
	postBool = post.Message != *data.Message || post.CreateAt != *data.CreateAt || post.UserId != user.Id || !post.HasReactions
	require.False(t, postBool, "Post properties not as expected")

	reactions, err := th.App.Srv.Store.Reaction().GetForPost(post.Id, false)
	require.Nil(t, err, "Can't get reaction")

	require.Len(t, reactions, 1, "Invalid number of reactions")

	// Post with reply.
	replyPostTime := hashtagTime + 4
	replyTime := hashtagTime + 5
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &username,
		Message:  ptrStr("Message with reply"),
		CreateAt: &replyPostTime,
		Replies: &[]ReplyImportData{{
			User:     &user2.Username,
			Message:  ptrStr("Message reply"),
			CreateAt: &replyTime,
		}},
	}
	err = th.App.importPost(data, false)
	require.Nil(t, err, "Expected success.")

	AssertAllPostsCount(t, th.App, initialPostCount, 8, team.Id)

	// Check the post values.
	posts, err = th.App.Srv.Store.Post().GetPostsCreatedAt(channel.Id, replyPostTime)
	require.Nil(t, err)

	require.Len(t, posts, 1, "Unexpected number of posts found.")

	post = posts[0]
	postBool = post.Message != *data.Message || post.CreateAt != *data.CreateAt || post.UserId != user.Id
	require.False(t, postBool, "Post properties not as expected")

	// Check the reply values.
	replies, err := th.App.Srv.Store.Post().GetPostsCreatedAt(channel.Id, replyTime)
	require.Nil(t, err)

	require.Len(t, replies, 1, "Unexpected number of posts found.")

	reply := replies[0]
	replyBool := reply.Message != *(*data.Replies)[0].Message || reply.CreateAt != *(*data.Replies)[0].CreateAt || reply.UserId != user2.Id
	require.False(t, replyBool, "Post properties not as expected")

	require.Equal(t, post.Id, reply.RootId, "Unexpected reply RootId")

	// Update post with replies.
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &user2.Username,
		Message:  ptrStr("Message with reply"),
		CreateAt: &replyPostTime,
		Replies: &[]ReplyImportData{{
			User:     &username,
			Message:  ptrStr("Message reply"),
			CreateAt: &replyTime,
		}},
	}
	err = th.App.importPost(data, false)
	require.Nil(t, err, "Expected success.")

	AssertAllPostsCount(t, th.App, initialPostCount, 8, team.Id)

	// Create new post with replies based on the previous one.
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &user2.Username,
		Message:  ptrStr("Message with reply 2"),
		CreateAt: &replyPostTime,
		Replies: &[]ReplyImportData{{
			User:     &username,
			Message:  ptrStr("Message reply"),
			CreateAt: &replyTime,
		}},
	}
	err = th.App.importPost(data, false)
	require.Nil(t, err, "Expected success.")

	AssertAllPostsCount(t, th.App, initialPostCount, 10, team.Id)

	// Create new reply for existing post with replies.
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &user2.Username,
		Message:  ptrStr("Message with reply"),
		CreateAt: &replyPostTime,
		Replies: &[]ReplyImportData{{
			User:     &username,
			Message:  ptrStr("Message reply 2"),
			CreateAt: &replyTime,
		}},
	}
	err = th.App.importPost(data, false)
	require.Nil(t, err, "Expected success.")

	AssertAllPostsCount(t, th.App, initialPostCount, 11, team.Id)
}

func TestImportImportDirectChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Check how many channels are in the database.
	directChannelCount, err := th.App.Srv.Store.Channel().AnalyticsTypeCount("", model.CHANNEL_DIRECT)
	require.Nil(t, err, "Failed to get direct channel count.")

	groupChannelCount, err := th.App.Srv.Store.Channel().AnalyticsTypeCount("", model.CHANNEL_GROUP)
	require.Nil(t, err, "Failed to get group channel count.")

	// Do an invalid channel in dry-run mode.
	data := DirectChannelImportData{
		Members: &[]string{
			model.NewId(),
		},
		Header: ptrStr("Channel Header"),
	}
	err = th.App.importDirectChannel(&data, true)
	require.NotNil(t, err)

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.CHANNEL_DIRECT, directChannelCount)
	AssertChannelCount(t, th.App, model.CHANNEL_GROUP, groupChannelCount)

	// Do a valid DIRECT channel with a nonexistent member in dry-run mode.
	data.Members = &[]string{
		model.NewId(),
		model.NewId(),
	}
	err = th.App.importDirectChannel(&data, true)
	require.Nil(t, err)

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.CHANNEL_DIRECT, directChannelCount)
	AssertChannelCount(t, th.App, model.CHANNEL_GROUP, groupChannelCount)

	// Do a valid GROUP channel with a nonexistent member in dry-run mode.
	data.Members = &[]string{
		model.NewId(),
		model.NewId(),
		model.NewId(),
	}
	err = th.App.importDirectChannel(&data, true)
	require.Nil(t, err)

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.CHANNEL_DIRECT, directChannelCount)
	AssertChannelCount(t, th.App, model.CHANNEL_GROUP, groupChannelCount)

	// Do an invalid channel in apply mode.
	data.Members = &[]string{
		model.NewId(),
	}
	err = th.App.importDirectChannel(&data, false)
	require.NotNil(t, err)

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.CHANNEL_DIRECT, directChannelCount)
	AssertChannelCount(t, th.App, model.CHANNEL_GROUP, groupChannelCount)

	// Do a valid DIRECT channel.
	data.Members = &[]string{
		th.BasicUser.Username,
		th.BasicUser2.Username,
	}
	err = th.App.importDirectChannel(&data, false)
	require.Nil(t, err)

	// Check that one more DIRECT channel is in the DB.
	AssertChannelCount(t, th.App, model.CHANNEL_DIRECT, directChannelCount+1)
	AssertChannelCount(t, th.App, model.CHANNEL_GROUP, groupChannelCount)

	// Do the same DIRECT channel again.
	err = th.App.importDirectChannel(&data, false)
	require.Nil(t, err)

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.CHANNEL_DIRECT, directChannelCount+1)
	AssertChannelCount(t, th.App, model.CHANNEL_GROUP, groupChannelCount)

	// Update the channel's HEADER
	data.Header = ptrStr("New Channel Header 2")
	err = th.App.importDirectChannel(&data, false)
	require.Nil(t, err)

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.CHANNEL_DIRECT, directChannelCount+1)
	AssertChannelCount(t, th.App, model.CHANNEL_GROUP, groupChannelCount)

	// Get the channel to check that the header was updated.
	channel, err := th.App.GetOrCreateDirectChannel(th.BasicUser.Id, th.BasicUser2.Id)
	require.Nil(t, err)
	require.Equal(t, channel.Header, *data.Header)

	// Do a GROUP channel with an extra invalid member.
	user3 := th.CreateUser()
	data.Members = &[]string{
		th.BasicUser.Username,
		th.BasicUser2.Username,
		user3.Username,
		model.NewId(),
	}
	err = th.App.importDirectChannel(&data, false)
	require.NotNil(t, err)

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.CHANNEL_DIRECT, directChannelCount+1)
	AssertChannelCount(t, th.App, model.CHANNEL_GROUP, groupChannelCount)

	// Do a valid GROUP channel.
	data.Members = &[]string{
		th.BasicUser.Username,
		th.BasicUser2.Username,
		user3.Username,
	}
	err = th.App.importDirectChannel(&data, false)
	require.Nil(t, err)

	// Check that one more GROUP channel is in the DB.
	AssertChannelCount(t, th.App, model.CHANNEL_DIRECT, directChannelCount+1)
	AssertChannelCount(t, th.App, model.CHANNEL_GROUP, groupChannelCount+1)

	// Do the same DIRECT channel again.
	err = th.App.importDirectChannel(&data, false)
	require.Nil(t, err)

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.CHANNEL_DIRECT, directChannelCount+1)
	AssertChannelCount(t, th.App, model.CHANNEL_GROUP, groupChannelCount+1)

	// Update the channel's HEADER
	data.Header = ptrStr("New Channel Header 3")
	err = th.App.importDirectChannel(&data, false)
	require.Nil(t, err)

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.CHANNEL_DIRECT, directChannelCount+1)
	AssertChannelCount(t, th.App, model.CHANNEL_GROUP, groupChannelCount+1)

	// Get the channel to check that the header was updated.
	userIds := []string{
		th.BasicUser.Id,
		th.BasicUser2.Id,
		user3.Id,
	}
	channel, err = th.App.createGroupChannel(userIds, th.BasicUser.Id)
	require.Equal(t, err.Id, store.CHANNEL_EXISTS_ERROR)
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
	err = th.App.importDirectChannel(&data, false)
	require.Nil(t, err)

	channel, err = th.App.GetOrCreateDirectChannel(th.BasicUser.Id, th.BasicUser2.Id)
	require.Nil(t, err)
	checkPreference(t, th.App, th.BasicUser.Id, model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL, channel.Id, "true")
	checkPreference(t, th.App, th.BasicUser2.Id, model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL, channel.Id, "true")
}

func TestImportImportDirectPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Create the DIRECT channel.
	channelData := DirectChannelImportData{
		Members: &[]string{
			th.BasicUser.Username,
			th.BasicUser2.Username,
		},
	}
	err := th.App.importDirectChannel(&channelData, false)
	require.Nil(t, err)

	// Get the channel.
	var directChannel *model.Channel
	channel, err := th.App.GetOrCreateDirectChannel(th.BasicUser.Id, th.BasicUser2.Id)
	require.Nil(t, err)
	require.NotEmpty(t, channel)
	directChannel = channel

	// Get the number of posts in the system.
	result, err := th.App.Srv.Store.Post().AnalyticsPostCount("", false, false)
	require.Nil(t, err)
	initialPostCount := result

	// Try adding an invalid post in dry run mode.
	data := &DirectPostImportData{
		ChannelMembers: &[]string{
			th.BasicUser.Username,
			th.BasicUser2.Username,
		},
		User:     ptrStr(th.BasicUser.Username),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	err = th.App.importDirectPost(data, true)
	require.NotNil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 0, "")

	// Try adding a valid post in dry run mode.
	data = &DirectPostImportData{
		ChannelMembers: &[]string{
			th.BasicUser.Username,
			th.BasicUser2.Username,
		},
		User:     ptrStr(th.BasicUser.Username),
		Message:  ptrStr("Message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	err = th.App.importDirectPost(data, true)
	require.Nil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 0, "")

	// Try adding an invalid post in apply mode.
	data = &DirectPostImportData{
		ChannelMembers: &[]string{
			th.BasicUser.Username,
			model.NewId(),
		},
		User:     ptrStr(th.BasicUser.Username),
		Message:  ptrStr("Message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	err = th.App.importDirectPost(data, false)
	require.NotNil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 0, "")

	// Try adding a valid post in apply mode.
	data = &DirectPostImportData{
		ChannelMembers: &[]string{
			th.BasicUser.Username,
			th.BasicUser2.Username,
		},
		User:     ptrStr(th.BasicUser.Username),
		Message:  ptrStr("Message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	err = th.App.importDirectPost(data, false)
	require.Nil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 1, "")

	// Check the post values.
	posts, err := th.App.Srv.Store.Post().GetPostsCreatedAt(directChannel.Id, *data.CreateAt)
	require.Nil(t, err)
	require.Len(t, posts, 1)

	post := posts[0]
	require.Equal(t, post.Message, *data.Message)
	require.Equal(t, post.CreateAt, *data.CreateAt)
	require.Equal(t, post.UserId, th.BasicUser.Id)

	// Import the post again.
	err = th.App.importDirectPost(data, false)
	require.Nil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 1, "")

	// Check the post values.
	posts, err = th.App.Srv.Store.Post().GetPostsCreatedAt(directChannel.Id, *data.CreateAt)
	require.Nil(t, err)
	require.Len(t, posts, 1)

	post = posts[0]
	require.Equal(t, post.Message, *data.Message)
	require.Equal(t, post.CreateAt, *data.CreateAt)
	require.Equal(t, post.UserId, th.BasicUser.Id)

	// Save the post with a different time.
	data.CreateAt = ptrInt64(*data.CreateAt + 1)
	err = th.App.importDirectPost(data, false)
	require.Nil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 2, "")

	// Save the post with a different message.
	data.Message = ptrStr("Message 2")
	err = th.App.importDirectPost(data, false)
	require.Nil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 3, "")

	// Test with hashtags
	data.Message = ptrStr("Message 2 #hashtagmashupcity")
	data.CreateAt = ptrInt64(*data.CreateAt + 1)
	err = th.App.importDirectPost(data, false)
	require.Nil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 4, "")

	posts, err = th.App.Srv.Store.Post().GetPostsCreatedAt(directChannel.Id, *data.CreateAt)
	require.Nil(t, err)
	require.Len(t, posts, 1)

	post = posts[0]
	require.Equal(t, post.Message, *data.Message)
	require.Equal(t, post.CreateAt, *data.CreateAt)
	require.Equal(t, post.UserId, th.BasicUser.Id)
	require.Equal(t, post.Hashtags, "#hashtagmashupcity")

	// Test with some flags.
	data = &DirectPostImportData{
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
	}

	err = th.App.importDirectPost(data, false)
	require.Nil(t, err)

	// Check the post values.
	posts, err = th.App.Srv.Store.Post().GetPostsCreatedAt(directChannel.Id, *data.CreateAt)
	require.Nil(t, err)
	require.Len(t, posts, 1)

	post = posts[0]
	checkPreference(t, th.App, th.BasicUser.Id, model.PREFERENCE_CATEGORY_FLAGGED_POST, post.Id, "true")
	checkPreference(t, th.App, th.BasicUser2.Id, model.PREFERENCE_CATEGORY_FLAGGED_POST, post.Id, "true")

	// ------------------ Group Channel -------------------------

	// Create the GROUP channel.
	user3 := th.CreateUser()
	channelData = DirectChannelImportData{
		Members: &[]string{
			th.BasicUser.Username,
			th.BasicUser2.Username,
			user3.Username,
		},
	}
	err = th.App.importDirectChannel(&channelData, false)
	require.Nil(t, err)

	// Get the channel.
	var groupChannel *model.Channel
	userIds := []string{
		th.BasicUser.Id,
		th.BasicUser2.Id,
		user3.Id,
	}
	channel, err = th.App.createGroupChannel(userIds, th.BasicUser.Id)
	require.Equal(t, err.Id, store.CHANNEL_EXISTS_ERROR)
	groupChannel = channel

	// Get the number of posts in the system.
	result, err = th.App.Srv.Store.Post().AnalyticsPostCount("", false, false)
	require.Nil(t, err)
	initialPostCount = result

	// Try adding an invalid post in dry run mode.
	data = &DirectPostImportData{
		ChannelMembers: &[]string{
			th.BasicUser.Username,
			th.BasicUser2.Username,
			user3.Username,
		},
		User:     ptrStr(th.BasicUser.Username),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	err = th.App.importDirectPost(data, true)
	require.NotNil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 0, "")

	// Try adding a valid post in dry run mode.
	data = &DirectPostImportData{
		ChannelMembers: &[]string{
			th.BasicUser.Username,
			th.BasicUser2.Username,
			user3.Username,
		},
		User:     ptrStr(th.BasicUser.Username),
		Message:  ptrStr("Message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	err = th.App.importDirectPost(data, true)
	require.Nil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 0, "")

	// Try adding an invalid post in apply mode.
	data = &DirectPostImportData{
		ChannelMembers: &[]string{
			th.BasicUser.Username,
			th.BasicUser2.Username,
			user3.Username,
			model.NewId(),
		},
		User:     ptrStr(th.BasicUser.Username),
		Message:  ptrStr("Message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	err = th.App.importDirectPost(data, false)
	require.NotNil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 0, "")

	// Try adding a valid post in apply mode.
	data = &DirectPostImportData{
		ChannelMembers: &[]string{
			th.BasicUser.Username,
			th.BasicUser2.Username,
			user3.Username,
		},
		User:     ptrStr(th.BasicUser.Username),
		Message:  ptrStr("Message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	err = th.App.importDirectPost(data, false)
	require.Nil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 1, "")

	// Check the post values.
	posts, err = th.App.Srv.Store.Post().GetPostsCreatedAt(groupChannel.Id, *data.CreateAt)
	require.Nil(t, err)
	require.Len(t, posts, 1)

	post = posts[0]
	require.Equal(t, post.Message, *data.Message)
	require.Equal(t, post.CreateAt, *data.CreateAt)
	require.Equal(t, post.UserId, th.BasicUser.Id)

	// Import the post again.
	err = th.App.importDirectPost(data, false)
	require.Nil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 1, "")

	// Check the post values.
	posts, err = th.App.Srv.Store.Post().GetPostsCreatedAt(groupChannel.Id, *data.CreateAt)
	require.Nil(t, err)
	require.Len(t, posts, 1)

	post = posts[0]
	require.Equal(t, post.Message, *data.Message)
	require.Equal(t, post.CreateAt, *data.CreateAt)
	require.Equal(t, post.UserId, th.BasicUser.Id)

	// Save the post with a different time.
	data.CreateAt = ptrInt64(*data.CreateAt + 1)
	err = th.App.importDirectPost(data, false)
	require.Nil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 2, "")

	// Save the post with a different message.
	data.Message = ptrStr("Message 2")
	err = th.App.importDirectPost(data, false)
	require.Nil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 3, "")

	// Test with hashtags
	data.Message = ptrStr("Message 2 #hashtagmashupcity")
	data.CreateAt = ptrInt64(*data.CreateAt + 1)
	err = th.App.importDirectPost(data, false)
	require.Nil(t, err)
	AssertAllPostsCount(t, th.App, initialPostCount, 4, "")

	posts, err = th.App.Srv.Store.Post().GetPostsCreatedAt(groupChannel.Id, *data.CreateAt)
	require.Nil(t, err)
	require.Len(t, posts, 1)

	post = posts[0]
	require.Equal(t, post.Message, *data.Message)
	require.Equal(t, post.CreateAt, *data.CreateAt)
	require.Equal(t, post.UserId, th.BasicUser.Id)
	require.Equal(t, post.Hashtags, "#hashtagmashupcity")

	// Test with some flags.
	data = &DirectPostImportData{
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
	}

	err = th.App.importDirectPost(data, false)
	require.Nil(t, err)

	// Check the post values.
	posts, err = th.App.Srv.Store.Post().GetPostsCreatedAt(groupChannel.Id, *data.CreateAt)
	require.Nil(t, err)
	require.Len(t, posts, 1)

	post = posts[0]
	checkPreference(t, th.App, th.BasicUser.Id, model.PREFERENCE_CATEGORY_FLAGGED_POST, post.Id, "true")
	checkPreference(t, th.App, th.BasicUser2.Id, model.PREFERENCE_CATEGORY_FLAGGED_POST, post.Id, "true")

}

func TestImportImportEmoji(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = true })

	testsDir, _ := fileutils.FindDir("tests")
	testImage := filepath.Join(testsDir, "test.png")

	data := EmojiImportData{Name: ptrStr(model.NewId())}
	err := th.App.importEmoji(&data, true)
	assert.NotNil(t, err, "Invalid emoji should have failed dry run")

	emoji, err := th.App.Srv.Store.Emoji().GetByName(*data.Name, true)
	assert.Nil(t, emoji, "Emoji should not have been imported")
	assert.NotNil(t, err)

	data.Image = ptrStr(testImage)
	err = th.App.importEmoji(&data, true)
	assert.Nil(t, err, "Valid emoji should have passed dry run")

	data = EmojiImportData{Name: ptrStr(model.NewId())}
	err = th.App.importEmoji(&data, false)
	assert.NotNil(t, err, "Invalid emoji should have failed apply mode")

	data.Image = ptrStr("non-existent-file")
	err = th.App.importEmoji(&data, false)
	assert.NotNil(t, err, "Emoji with bad image file should have failed apply mode")

	data.Image = ptrStr(testImage)
	err = th.App.importEmoji(&data, false)
	assert.Nil(t, err, "Valid emoji should have succeeded apply mode")

	emoji, err = th.App.Srv.Store.Emoji().GetByName(*data.Name, true)
	assert.NotNil(t, emoji, "Emoji should have been imported")
	assert.Nil(t, err, "Emoji should have been imported without any error")

	err = th.App.importEmoji(&data, false)
	assert.Nil(t, err, "Second run should have succeeded apply mode")
}

func TestImportAttachment(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	testsDir, _ := fileutils.FindDir("tests")
	testImage := filepath.Join(testsDir, "test.png")
	invalidPath := "some-invalid-path"

	userId := model.NewId()
	data := AttachmentImportData{Path: &testImage}
	_, err := th.App.importAttachment(&data, &model.Post{UserId: userId, ChannelId: "some-channel"}, "some-team", true)
	assert.Nil(t, err, "sample run without errors")

	attachments := GetAttachments(userId, th, t)
	assert.Len(t, attachments, 1)

	data = AttachmentImportData{Path: &invalidPath}
	_, err = th.App.importAttachment(&data, &model.Post{UserId: model.NewId(), ChannelId: "some-channel"}, "some-team", true)
	assert.NotNil(t, err, "should have failed when opening the file")
	assert.Equal(t, err.Id, "app.import.attachment.bad_file.error")
}

func TestImportPostAndRepliesWithAttachments(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Create a Team.
	teamName := model.NewRandomTeamName()
	th.App.importTeam(&TeamImportData{
		Name:        &teamName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}, false)
	team, err := th.App.GetTeamByName(teamName)
	require.Nil(t, err, "Failed to get team from database.")

	// Create a Channel.
	channelName := model.NewId()
	th.App.importChannel(&ChannelImportData{
		Team:        &teamName,
		Name:        &channelName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}, false)
	_, err = th.App.GetChannelByName(channelName, team.Id, false)
	require.Nil(t, err, "Failed to get channel from database.")

	// Create a user3.
	username := model.NewId()
	th.App.importUser(&UserImportData{
		Username: &username,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}, false)
	user3, err := th.App.GetUserByUsername(username)
	require.Nil(t, err, "Failed to get user3 from database.")

	username2 := model.NewId()
	th.App.importUser(&UserImportData{
		Username: &username2,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}, false)
	user4, err := th.App.GetUserByUsername(username2)
	require.Nil(t, err, "Failed to get user3 from database.")

	// Post with attachments.
	time := model.GetMillis()
	attachmentsPostTime := time
	attachmentsReplyTime := time + 1
	testsDir, _ := fileutils.FindDir("tests")
	testImage := filepath.Join(testsDir, "test.png")
	testMarkDown := filepath.Join(testsDir, "test-attachments.md")
	data := &PostImportData{
		Team:        &teamName,
		Channel:     &channelName,
		User:        &username,
		Message:     ptrStr("Message with reply"),
		CreateAt:    &attachmentsPostTime,
		Attachments: &[]AttachmentImportData{{Path: &testImage}, {Path: &testMarkDown}},
		Replies: &[]ReplyImportData{{
			User:        &user4.Username,
			Message:     ptrStr("Message reply"),
			CreateAt:    &attachmentsReplyTime,
			Attachments: &[]AttachmentImportData{{Path: &testImage}},
		}},
	}

	// import with attachments
	err = th.App.importPost(data, false)
	assert.Nil(t, err)

	attachments := GetAttachments(user3.Id, th, t)
	assert.Len(t, attachments, 2)
	assert.Contains(t, attachments[0].Path, team.Id)
	assert.Contains(t, attachments[1].Path, team.Id)
	AssertFileIdsInPost(attachments, th, t)

	// import existing post with new attachments
	data.Attachments = &[]AttachmentImportData{{Path: &testImage}}
	err = th.App.importPost(data, false)
	assert.Nil(t, err)

	attachments = GetAttachments(user3.Id, th, t)
	assert.Len(t, attachments, 1)
	assert.Contains(t, attachments[0].Path, team.Id)
	AssertFileIdsInPost(attachments, th, t)

	attachments = GetAttachments(user4.Id, th, t)
	assert.Len(t, attachments, 1)
	assert.Contains(t, attachments[0].Path, team.Id)
	AssertFileIdsInPost(attachments, th, t)

	// Reply with Attachments in Direct Post

	// Create direct post users.

	username3 := model.NewId()
	th.App.importUser(&UserImportData{
		Username: &username3,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}, false)
	user3, err = th.App.GetUserByUsername(username3)
	require.Nil(t, err, "Failed to get user3 from database.")

	username4 := model.NewId()
	th.App.importUser(&UserImportData{
		Username: &username4,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}, false)

	user4, err = th.App.GetUserByUsername(username4)
	require.Nil(t, err, "Failed to get user3 from database.")

	directImportData := &DirectPostImportData{
		ChannelMembers: &[]string{
			user3.Username,
			user4.Username,
		},
		User:     &user3.Username,
		Message:  ptrStr("Message with Replies"),
		CreateAt: ptrInt64(model.GetMillis()),
		Replies: &[]ReplyImportData{{
			User:        &user4.Username,
			Message:     ptrStr("Message reply with attachment"),
			CreateAt:    ptrInt64(model.GetMillis()),
			Attachments: &[]AttachmentImportData{{Path: &testImage}},
		}},
	}

	err = th.App.importDirectPost(directImportData, false)
	require.Nil(t, err, "Expected success.")

	attachments = GetAttachments(user4.Id, th, t)
	assert.Len(t, attachments, 1)
	assert.Contains(t, attachments[0].Path, "noteam")
	AssertFileIdsInPost(attachments, th, t)
}

func TestImportDirectPostWithAttachments(t *testing.T) {

	th := Setup(t)
	defer th.TearDown()

	testsDir, _ := fileutils.FindDir("tests")
	testImage := filepath.Join(testsDir, "test.png")
	testImage2 := filepath.Join(testsDir, "test.svg")
	// create a temp file with same name as original but with a different first byte
	tmpFolder, _ := ioutil.TempDir("", "imgFake")
	testImageFake := filepath.Join(tmpFolder, "test.png")
	fakeFileData, _ := ioutil.ReadFile(testImage)
	fakeFileData[0] = 0
	_ = ioutil.WriteFile(testImageFake, fakeFileData, 0644)
	defer os.RemoveAll(tmpFolder)

	// Create a user.
	username := model.NewId()
	th.App.importUser(&UserImportData{
		Username: &username,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}, false)
	user1, err := th.App.GetUserByUsername(username)
	require.Nil(t, err, "Failed to get user1 from database.")

	username2 := model.NewId()
	th.App.importUser(&UserImportData{
		Username: &username2,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}, false)

	user2, err := th.App.GetUserByUsername(username2)
	require.Nil(t, err, "Failed to get user2 from database.")

	directImportData := &DirectPostImportData{
		ChannelMembers: &[]string{
			user1.Username,
			user2.Username,
		},
		User:        &user1.Username,
		Message:     ptrStr("Direct message"),
		CreateAt:    ptrInt64(model.GetMillis()),
		Attachments: &[]AttachmentImportData{{Path: &testImage}},
	}

	t.Run("Regular import of attachment", func(t *testing.T) {
		err := th.App.importDirectPost(directImportData, false)
		require.Nil(t, err, "Expected success.")

		attachments := GetAttachments(user1.Id, th, t)
		assert.Len(t, attachments, 1)
		assert.Contains(t, attachments[0].Path, "noteam")
		AssertFileIdsInPost(attachments, th, t)
	})

	t.Run("Attempt to import again with same file entirely, should NOT add an attachment", func(t *testing.T) {
		err := th.App.importDirectPost(directImportData, false)
		require.Nil(t, err, "Expected success.")

		attachments := GetAttachments(user1.Id, th, t)
		assert.Len(t, attachments, 1)
	})

	t.Run("Attempt to import again with same name and size but different content, SHOULD add an attachment", func(t *testing.T) {
		directImportDataFake := &DirectPostImportData{
			ChannelMembers: &[]string{
				user1.Username,
				user2.Username,
			},
			User:        &user1.Username,
			Message:     ptrStr("Direct message"),
			CreateAt:    ptrInt64(model.GetMillis()),
			Attachments: &[]AttachmentImportData{{Path: &testImageFake}},
		}

		err := th.App.importDirectPost(directImportDataFake, false)
		require.Nil(t, err, "Expected success.")

		attachments := GetAttachments(user1.Id, th, t)
		assert.Len(t, attachments, 2)
	})

	t.Run("Attempt to import again with same data, SHOULD add an attachment, since it's different name", func(t *testing.T) {
		directImportData2 := &DirectPostImportData{
			ChannelMembers: &[]string{
				user1.Username,
				user2.Username,
			},
			User:        &user1.Username,
			Message:     ptrStr("Direct message"),
			CreateAt:    ptrInt64(model.GetMillis()),
			Attachments: &[]AttachmentImportData{{Path: &testImage2}},
		}

		err := th.App.importDirectPost(directImportData2, false)
		require.Nil(t, err, "Expected success.")

		attachments := GetAttachments(user1.Id, th, t)
		assert.Len(t, attachments, 3)
	})
}
