// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

const permissionsExportBatchSize = 100
const systemSchemeName = "00000000-0000-0000-0000-000000000000" // Prevents collisions with user-created schemes.

func (a *App) ResetPermissionsSystem() *model.AppError {
	// Reset all Teams to not have a scheme.
	if err := a.Srv.Store.Team().ResetAllTeamSchemes(); err != nil {
		return err
	}

	// Reset all Channels to not have a scheme.
	if err := a.Srv.Store.Channel().ResetAllChannelSchemes(); err != nil {
		return err
	}

	// Reset all Custom Role assignments to Users.
	if err := a.Srv.Store.User().ClearAllCustomRoleAssignments(); err != nil {
		return err
	}

	// Reset all Custom Role assignments to TeamMembers.
	if err := a.Srv.Store.Team().ClearAllCustomRoleAssignments(); err != nil {
		return err
	}

	// Reset all Custom Role assignments to ChannelMembers.
	if err := a.Srv.Store.Channel().ClearAllCustomRoleAssignments(); err != nil {
		return err
	}

	// Purge all schemes from the database.
	if err := a.Srv.Store.Scheme().PermanentDeleteAll(); err != nil {
		return err
	}

	// Purge all roles from the database.
	if err := a.Srv.Store.Role().PermanentDeleteAll(); err != nil {
		return err
	}

	// Remove the "System" table entry that marks the advanced permissions migration as done.
	if _, err := a.Srv.Store.System().PermanentDeleteByName(ADVANCED_PERMISSIONS_MIGRATION_KEY); err != nil {
		return err
	}

	// Now that the permissions system has been reset, re-run the migration to reinitialise it.
	a.DoAppMigrations()

	return nil
}

func (a *App) ExportPermissions(w io.Writer) error {

	next := a.SchemesIterator(permissionsExportBatchSize)
	var schemeBatch []*model.Scheme

	for schemeBatch = next(); len(schemeBatch) > 0; schemeBatch = next() {

		for _, scheme := range schemeBatch {

			roleNames := []string{
				scheme.DefaultTeamAdminRole,
				scheme.DefaultTeamUserRole,
				scheme.DefaultTeamGuestRole,
				scheme.DefaultChannelAdminRole,
				scheme.DefaultChannelUserRole,
				scheme.DefaultChannelGuestRole,
			}

			roles := []*model.Role{}
			for _, roleName := range roleNames {
				if len(roleName) == 0 {
					continue
				}
				role, err := a.GetRoleByName(roleName)
				if err != nil {
					return err
				}
				roles = append(roles, role)
			}

			schemeExport, err := json.Marshal(&model.SchemeConveyor{
				Name:         scheme.Name,
				DisplayName:  scheme.DisplayName,
				Description:  scheme.Description,
				Scope:        scheme.Scope,
				TeamAdmin:    scheme.DefaultTeamAdminRole,
				TeamUser:     scheme.DefaultTeamUserRole,
				TeamGuest:    scheme.DefaultTeamGuestRole,
				ChannelAdmin: scheme.DefaultChannelAdminRole,
				ChannelUser:  scheme.DefaultChannelUserRole,
				ChannelGuest: scheme.DefaultChannelGuestRole,
				Roles:        roles,
			})
			if err != nil {
				return err
			}

			schemeExport = append(schemeExport, []byte("\n")...)

			_, err = w.Write(schemeExport)
			if err != nil {
				return err
			}
		}

	}

	defaultRoleNames := []string{}
	for _, dr := range model.MakeDefaultRoles() {
		defaultRoleNames = append(defaultRoleNames, dr.Name)
	}

	roles, appErr := a.GetRolesByNames(defaultRoleNames)
	if appErr != nil {
		return errors.New(appErr.Message)
	}

	schemeExport, err := json.Marshal(&model.SchemeConveyor{
		Name:  systemSchemeName,
		Roles: roles,
	})
	if err != nil {
		return err
	}

	schemeExport = append(schemeExport, []byte("\n")...)

	_, err = w.Write(schemeExport)
	return err
}

func (a *App) ImportPermissions(jsonl io.Reader) error {
	createdSchemeIDs := []string{}

	scanner := bufio.NewScanner(jsonl)

	for scanner.Scan() {
		var schemeConveyor *model.SchemeConveyor
		err := json.Unmarshal(scanner.Bytes(), &schemeConveyor)
		if err != nil {
			rollback(a, createdSchemeIDs)
			return err
		}

		if schemeConveyor.Name == systemSchemeName {
			for _, roleIn := range schemeConveyor.Roles {
				dbRole, err := a.GetRoleByName(roleIn.Name)
				if err != nil {
					rollback(a, createdSchemeIDs)
					return errors.New(err.Message)
				}
				_, err = a.PatchRole(dbRole, &model.RolePatch{
					Permissions: &roleIn.Permissions,
				})
				if err != nil {
					rollback(a, createdSchemeIDs)
					return err
				}
			}
			continue
		}

		// Create the new Scheme. The new Roles are created automatically.
		var appErr *model.AppError
		schemeCreated, appErr := a.CreateScheme(schemeConveyor.Scheme())
		if appErr != nil {
			rollback(a, createdSchemeIDs)
			return errors.New(appErr.Message)
		}
		createdSchemeIDs = append(createdSchemeIDs, schemeCreated.Id)

		schemeIn := schemeConveyor.Scheme()
		roleNameTuples := [][]string{
			{schemeCreated.DefaultTeamAdminRole, schemeIn.DefaultTeamAdminRole},
			{schemeCreated.DefaultTeamUserRole, schemeIn.DefaultTeamUserRole},
			{schemeCreated.DefaultTeamGuestRole, schemeIn.DefaultTeamGuestRole},
			{schemeCreated.DefaultChannelAdminRole, schemeIn.DefaultChannelAdminRole},
			{schemeCreated.DefaultChannelUserRole, schemeIn.DefaultChannelUserRole},
			{schemeCreated.DefaultChannelGuestRole, schemeIn.DefaultChannelGuestRole},
		}
		for _, roleNameTuple := range roleNameTuples {
			if len(roleNameTuple[0]) == 0 || len(roleNameTuple[1]) == 0 {
				continue
			}

			err = updateRole(a, schemeConveyor, roleNameTuple[0], roleNameTuple[1])
			if err != nil {
				// Delete the new Schemes. The new Roles are deleted automatically.
				rollback(a, createdSchemeIDs)
				return err
			}
		}
	}

	if err := scanner.Err(); err != nil {
		rollback(a, createdSchemeIDs)
		return err
	}

	return nil
}

func rollback(a *App, createdSchemeIDs []string) {
	for _, schemeID := range createdSchemeIDs {
		a.DeleteScheme(schemeID)
	}
}

func updateRole(a *App, sc *model.SchemeConveyor, roleCreatedName, defaultRoleName string) error {
	var err *model.AppError

	roleCreated, err := a.GetRoleByName(roleCreatedName)
	if err != nil {
		return errors.New(err.Message)
	}

	var roleIn *model.Role
	for _, role := range sc.Roles {
		if role.Name == defaultRoleName {
			roleIn = role
			break
		}
	}

	roleCreated.DisplayName = roleIn.DisplayName
	roleCreated.Description = roleIn.Description
	roleCreated.Permissions = roleIn.Permissions

	_, err = a.UpdateRole(roleCreated)
	if err != nil {
		return errors.New(fmt.Sprintf("%v: %v\n", err.Message, err.DetailedError))
	}

	return nil
}
