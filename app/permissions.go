// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/model"
)

func (a *App) ResetPermissionsSystem() *model.AppError {
	// Reset all Teams to not have a scheme.
	if result := <-a.Srv.Store.Team().ResetAllTeamSchemes(); result.Err != nil {
		return result.Err
	}

	// Reset all Channels to not have a scheme.
	if result := <-a.Srv.Store.Channel().ResetAllChannelSchemes(); result.Err != nil {
		return result.Err
	}

	// Purge all schemes from the database.
	if result := <-a.Srv.Store.Scheme().PermanentDeleteAll(); result.Err != nil {
		return result.Err
	}

	// Purge all roles from the database.
	if result := <-a.Srv.Store.Role().PermanentDeleteAll(); result.Err != nil {
		return result.Err
	}

	// Remove the "System" table entry that marks the advanced permissions migration as done.
	if result := <-a.Srv.Store.System().PermanentDeleteByName(ADVANCED_PERMISSIONS_MIGRATION_KEY); result.Err != nil {
		return result.Err
	}

	// Now that the permissions system has been reset, re-run the migration to reinitialise it.
	a.DoAdvancedPermissionsMigration()

	return nil
}
