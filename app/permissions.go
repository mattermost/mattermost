// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"

	"github.com/mattermost/mattermost-server/model"
	"github.com/pkg/errors"
)

const permissionsExportBatchSize = 100

func (a *App) ResetPermissionsSystem() *model.AppError {
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

func (a *App) ExportPermissions(w io.Writer) error {

	next := a.SchemeGenerator(permissionsExportBatchSize)
	var schemeBatch []*model.Scheme

	for schemeBatch = next(); len(schemeBatch) > 0; schemeBatch = next() {

		for _, scheme := range schemeBatch {

			roleIDs := []string{
				scheme.DefaultTeamAdminRole,
				scheme.DefaultTeamUserRole,
				scheme.DefaultChannelAdminRole,
				scheme.DefaultChannelUserRole,
			}

			roles := []*model.Role{}
			for _, roleID := range roleIDs {
				if len(roleID) == 0 {
					continue
				}
				role, err := a.GetRole(roleID)
				if err != nil {
					return err
				}
				roles = append(roles, role)
			}

			schemeExport, err := json.Marshal(&model.SchemeConveyor{
				Name:         scheme.Name,
				Description:  scheme.Description,
				Scope:        scheme.Scope,
				TeamAdmin:    scheme.DefaultTeamAdminRole,
				TeamUser:     scheme.DefaultTeamUserRole,
				ChannelAdmin: scheme.DefaultChannelAdminRole,
				ChannelUser:  scheme.DefaultChannelUserRole,
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

	return nil
}

func (a *App) ImportPermissions(jsonl io.Reader) error {
	createdSchemeIDs := []string{}

	scanner := bufio.NewScanner(jsonl)

	for scanner.Scan() {
		var schemeConveyor *model.SchemeConveyor
		err := json.Unmarshal(scanner.Bytes(), &schemeConveyor)
		if err != nil {
			return err
		}

		// Create the new Scheme. The new Roles are created automatically.
		var appErr *model.AppError
		schemeCreated, appErr := a.CreateScheme(schemeConveyor.Scheme())
		if appErr != nil {
			return errors.New(appErr.Message)
		}
		createdSchemeIDs = append(createdSchemeIDs, schemeCreated.Id)

		schemeIn := schemeConveyor.Scheme()
		roleIDTuples := [][]string{
			[]string{schemeCreated.DefaultTeamAdminRole, schemeIn.DefaultTeamAdminRole},
			[]string{schemeCreated.DefaultTeamUserRole, schemeIn.DefaultTeamUserRole},
			[]string{schemeCreated.DefaultChannelAdminRole, schemeIn.DefaultChannelAdminRole},
			[]string{schemeCreated.DefaultChannelUserRole, schemeIn.DefaultChannelUserRole},
		}
		for _, roleIDTuple := range roleIDTuples {
			if len(roleIDTuple[0]) == 0 || len(roleIDTuple[1]) == 0 {
				continue
			}

			err = updateRole(a, schemeConveyor, roleIDTuple[0], roleIDTuple[1])
			if err != nil {
				// Delete the new Schemes. The new Roles are deleted automatically.
				for _, schemeID := range createdSchemeIDs {
					a.DeleteScheme(schemeID)
				}
				return err
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return err
	}

	return nil
}

func updateRole(a *App, sc *model.SchemeConveyor, roleCreatedID, defaultRoleID string) error {
	var err *model.AppError

	roleCreated, err := a.GetRole(roleCreatedID)
	if err != nil {
		return errors.New(err.Message)
	}

	var roleIn *model.Role
	for _, role := range sc.Roles {
		if role.Id == defaultRoleID {
			roleIn = role
			break
		}
	}

	roleCreated.Name = roleIn.Name
	roleCreated.DisplayName = roleIn.DisplayName
	roleCreated.Description = roleIn.Description
	roleCreated.Permissions = roleIn.Permissions

	_, err = a.UpdateRole(roleCreated)
	if err != nil {
		return errors.New(fmt.Sprintf("%v: %v\n", err.Message, err.DetailedError))
	}

	return nil
}
