// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:generate go run ./generator/generate_default_roles_permissions.go -out ../../../e2e-tests/cypress/tests/support/api/default_roles_permissions.js

package app

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app/permissions"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// Type aliases so existing tests and internal callers continue to compile
// without changes.
type permissionTransformation = permissions.PermissionTransformation
type permissionsMap = permissions.PermissionsMap

// Condition-function aliases used by tests.
var (
	isExactRole         = permissions.IsExactRole
	isRole              = permissions.IsRole
	isNotRole           = permissions.IsNotRole
	permissionExists    = permissions.PermissionExists
	permissionNotExists = permissions.PermissionNotExists
	onOtherRole         = permissions.OnOtherRole
	permissionOr        = permissions.PermissionOr
	permissionAnd       = permissions.PermissionAnd
	applyPermissionsMap = permissions.ApplyPermissionsMap
)

// Migration-function aliases used by tests.
var (
	getRestoreManageOAuthPermissionMigration = permissions.GetRestoreManageOAuthPermissionMigration
	getAddManageAgentPermissionsMigration    = permissions.GetAddManageAgentPermissionsMigration
)

// migrationEntry pairs a migration key with its migration function.
type migrationEntry = permissions.Entry

// getPermissionsMigrationEntries returns the ordered list of permission migrations.
// getAllTeamSchemes is passed in for migrations that need to query team schemes from
// the database; all other migrations are purely static.
func getPermissionsMigrationEntries(getAllTeamSchemes func() []*model.Scheme) []migrationEntry {
	return permissions.DefaultMigrationEntries(getAllTeamSchemes)
}

func (s *Server) doPermissionsMigration(key string, migrationMap permissionsMap, roles []*model.Role) *model.AppError {
	if _, err := s.Store().System().GetByName(key); err == nil {
		return nil
	}

	roleMap := make(map[string]map[string]bool)
	for _, role := range roles {
		roleMap[role.Name] = make(map[string]bool)
		for _, permission := range role.Permissions {
			roleMap[role.Name][permission] = true
		}
	}

	for _, role := range roles {
		role.Permissions = applyPermissionsMap(role, roleMap, migrationMap)
		if _, err := s.Store().Role().Save(role); err != nil {
			var invErr *store.ErrInvalidInput
			switch {
			case errors.As(err, &invErr):
				return model.NewAppError("doPermissionsMigration", "app.role.save.invalid_role.app_error", nil, "", http.StatusBadRequest).Wrap(err)
			default:
				return model.NewAppError("doPermissionsMigration", "app.role.save.insert.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}
	}

	if err := s.Store().System().SaveOrUpdate(&model.System{Name: key, Value: "true"}); err != nil {
		return model.NewAppError("doPermissionsMigration", "app.system.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

// DoPermissionsMigrations executes all the permissions migrations needed by the current version.
func (a *App) DoPermissionsMigrations() error {
	return a.Srv().doPermissionsMigrations()
}

func (s *Server) doPermissionsMigrations() error {
	a := New(ServerConnector(s.Channels()))
	getAllTeamSchemes := func() []*model.Scheme {
		var all []*model.Scheme
		next := a.SchemesIterator(model.SchemeScopeTeam, 100)
		for batch := next(); len(batch) > 0; batch = next() {
			all = append(all, batch...)
		}
		return all
	}
	migrations := getPermissionsMigrationEntries(getAllTeamSchemes)

	roles, err := s.Store().Role().GetAll()
	if err != nil {
		return err
	}

	for _, migration := range migrations {
		migMap, err := migration.Migration()
		if err != nil {
			return err
		}
		if err := s.doPermissionsMigration(migration.Key, migMap, roles); err != nil {
			mlog.Error("Failed to run permissions migration", mlog.String("key", migration.Key), mlog.Err(err))
			return err
		}
	}
	return nil
}
