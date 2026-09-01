// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"strings"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlRoleStore struct {
	*SqlStore

	tableSelectQuery sq.SelectBuilder
}

type Role struct {
	Id            string
	Name          string
	DisplayName   string
	Description   string
	CreateAt      int64
	UpdateAt      int64
	DeleteAt      int64
	Permissions   string
	SchemeManaged bool
	BuiltIn       bool
	SchemeId      *string
}

type channelRolesPermissions struct {
	GuestRoleName                string
	UserRoleName                 string
	AdminRoleName                string
	HigherScopedGuestPermissions string
	HigherScopedUserPermissions  string
	HigherScopedAdminPermissions string
}

func NewRoleFromModel(role *model.Role) *Role {
	permissionsMap := make(map[string]bool)
	var permissions strings.Builder

	for _, permission := range role.Permissions {
		if !permissionsMap[permission] {
			permissions.WriteString(fmt.Sprintf(" %v", permission))
			permissionsMap[permission] = true
		}
	}

	return &Role{
		Id:            role.Id,
		Name:          role.Name,
		DisplayName:   role.DisplayName,
		Description:   role.Description,
		CreateAt:      role.CreateAt,
		UpdateAt:      role.UpdateAt,
		DeleteAt:      role.DeleteAt,
		Permissions:   permissions.String(),
		SchemeManaged: role.SchemeManaged,
		BuiltIn:       role.BuiltIn,
		SchemeId:      role.SchemeId,
	}
}

func (role Role) ToModel() *model.Role {
	return &model.Role{
		Id:            role.Id,
		Name:          role.Name,
		DisplayName:   role.DisplayName,
		Description:   role.Description,
		CreateAt:      role.CreateAt,
		UpdateAt:      role.UpdateAt,
		DeleteAt:      role.DeleteAt,
		Permissions:   strings.Fields(role.Permissions),
		SchemeManaged: role.SchemeManaged,
		BuiltIn:       role.BuiltIn,
		SchemeId:      role.SchemeId,
	}
}

func newSqlRoleStore(sqlStore *SqlStore) store.RoleStore {
	s := SqlRoleStore{
		SqlStore: sqlStore,
	}

	s.tableSelectQuery = s.getQueryBuilder().
		Select("Id", "Name", "DisplayName", "Description", "CreateAt", "UpdateAt", "DeleteAt", "Permissions", "SchemeManaged", "BuiltIn", "SchemeId").
		From("Roles")

	return &s
}

func (s *SqlRoleStore) Save(role *model.Role) (*model.Role, error) {
	return s.save(role, false)
}

// SavePreservingUnknownPermissions behaves like Save but tolerates and persists
// permissions this server build does not recognize. See the RoleStore interface
// and MM-68830 for the downgrade scenario this protects against.
func (s *SqlRoleStore) SavePreservingUnknownPermissions(role *model.Role) (*model.Role, error) {
	return s.save(role, true)
}

// validateForSave validates the role before it is persisted. When
// preserveUnknownPermissions is true, permissions unknown to this server build are
// logged and excluded from the validation (but left untouched on the role so they
// are still persisted), rather than causing the save to fail.
func (s *SqlRoleStore) validateForSave(role *model.Role, preserveUnknownPermissions bool) error {
	roleToValidate := role

	if preserveUnknownPermissions {
		if unknown := role.UnknownPermissions(); len(unknown) > 0 {
			s.Logger().Warn(
				"Preserving role permissions not recognized by this server version (server likely downgraded from a newer release)",
				mlog.String("role", role.Name),
				mlog.Array("permissions", unknown),
			)

			unknownSet := make(map[string]bool, len(unknown))
			for _, permission := range unknown {
				unknownSet[permission] = true
			}
			known := make([]string, 0, len(role.Permissions))
			for _, permission := range role.Permissions {
				if !unknownSet[permission] {
					known = append(known, permission)
				}
			}

			roleCopy := role.Clone()
			roleCopy.Permissions = known
			roleToValidate = roleCopy
		}
	}

	if err := roleToValidate.IsValidWithoutId(); err != nil {
		return store.NewErrInvalidInput("Role", "<any>", err.Error())
	}
	return nil
}

func (s *SqlRoleStore) save(role *model.Role, preserveUnknownPermissions bool) (*model.Role, error) {
	// Check the role is valid before proceeding.
	if err := s.validateForSave(role, preserveUnknownPermissions); err != nil {
		return nil, err
	}

	if role.Id == "" {
		transaction, terr := s.GetMaster().Begin()
		if terr != nil {
			return nil, errors.Wrap(terr, "begin_transaction")
		}
		defer finalizeTransactionX(transaction, &terr)

		createdRole, terr := s.createRole(role, transaction)
		if terr != nil {
			return nil, errors.Wrap(terr, "unable to create Role")
		} else if terr = transaction.Commit(); terr != nil {
			return nil, errors.Wrap(terr, "commit_transaction")
		}
		return createdRole, nil
	}

	dbRole := NewRoleFromModel(role)
	dbRole.UpdateAt = model.GetMillis()

	res, err := s.GetMaster().NamedExec(`UPDATE Roles
		SET UpdateAt=:UpdateAt, DeleteAt=:DeleteAt, CreateAt=:CreateAt, Name=:Name, DisplayName=:DisplayName,
		Description=:Description, Permissions=:Permissions, SchemeManaged=:SchemeManaged, BuiltIn=:BuiltIn,
		SchemeId=:SchemeId
		WHERE Id=:Id`, &dbRole)

	if err != nil {
		return nil, errors.Wrap(err, "failed to update Role")
	}

	rowsChanged, err := res.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "error while getting rows_affected")
	}

	if rowsChanged != 1 {
		return nil, fmt.Errorf("invalid number of updated rows, expected 1 but got %d", rowsChanged)
	}

	return dbRole.ToModel(), nil
}

func (s *SqlRoleStore) createRole(role *model.Role, transaction *sqlxTxWrapper) (*model.Role, error) {
	// Check the role is valid before proceeding.
	if err := role.IsValidWithoutId(); err != nil {
		return nil, store.NewErrInvalidInput("Role", "<any>", err.Error())
	}

	dbRole := NewRoleFromModel(role)

	dbRole.Id = model.NewId()
	dbRole.CreateAt = model.GetMillis()
	dbRole.UpdateAt = dbRole.CreateAt

	if _, err := transaction.NamedExec(`INSERT INTO Roles
		(Id, Name, DisplayName, Description, Permissions, CreateAt, UpdateAt, DeleteAt, SchemeManaged, BuiltIn, SchemeId)
		VALUES
		(:Id, :Name, :DisplayName, :Description, :Permissions, :CreateAt, :UpdateAt, :DeleteAt, :SchemeManaged, :BuiltIn, :SchemeId)`, dbRole); err != nil {
		return nil, errors.Wrap(err, "failed to save Role")
	}

	return dbRole.ToModel(), nil
}

func (s *SqlRoleStore) Get(roleId string) (*model.Role, error) {
	dbRole := Role{}
	query := s.tableSelectQuery.Where(sq.Eq{"Id": roleId})

	if err := s.GetReplica().GetBuilder(&dbRole, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Role", roleId)
		}
		return nil, errors.Wrap(err, "failed to get Role")
	}

	return dbRole.ToModel(), nil
}

func (s *SqlRoleStore) GetAll() ([]*model.Role, error) {
	dbRoles := []Role{}
	query := s.tableSelectQuery

	if err := s.GetReplica().SelectBuilder(&dbRoles, query); err != nil {
		return nil, errors.Wrap(err, "failed to find Roles")
	}

	roles := []*model.Role{}
	for _, dbRole := range dbRoles {
		roles = append(roles, dbRole.ToModel())
	}
	return roles, nil
}

func (s *SqlRoleStore) GetByName(rctx request.CTX, name string) (*model.Role, error) {
	dbRole := Role{}
	query := s.tableSelectQuery.Where(sq.Eq{"Name": name})

	if err := s.DBXFromContext(rctx.Context()).GetBuilder(&dbRole, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Role", fmt.Sprintf("name=%s", name))
		}
		return nil, errors.Wrapf(err, "failed to find Roles with name=%s", name)
	}

	return dbRole.ToModel(), nil
}

func (s *SqlRoleStore) GetByNames(names []string) ([]*model.Role, error) {
	if len(names) == 0 {
		return []*model.Role{}, nil
	}

	query := s.tableSelectQuery.Where(sq.Eq{"Name": names})
	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "role_tosql")
	}

	rows, err := s.GetReplica().Query(queryString, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Roles")
	}

	roles := []*model.Role{}
	defer rows.Close()
	for rows.Next() {
		var role Role
		err = rows.Scan(
			&role.Id, &role.Name, &role.DisplayName, &role.Description,
			&role.CreateAt, &role.UpdateAt, &role.DeleteAt, &role.Permissions,
			&role.SchemeManaged, &role.BuiltIn, &role.SchemeId)
		if err != nil {
			return nil, errors.Wrap(err, "failed to scan values")
		}
		roles = append(roles, role.ToModel())
	}
	if err = rows.Err(); err != nil {
		return nil, errors.Wrap(err, "unable to iterate over rows")
	}

	return roles, nil
}

func (s *SqlRoleStore) Delete(roleId string) (*model.Role, error) {
	// Get the role.
	var role Role
	query := s.tableSelectQuery.Where(sq.Eq{"Id": roleId})

	if err := s.GetReplica().GetBuilder(&role, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Role", roleId)
		}
		return nil, errors.Wrapf(err, "failed to get Role with id=%s", roleId)
	}

	time := model.GetMillis()
	role.DeleteAt = time
	role.UpdateAt = time

	res, err := s.GetMaster().NamedExec(`UPDATE Roles
		SET UpdateAt=:UpdateAt, DeleteAt=:DeleteAt, CreateAt=:CreateAt,  Name=:Name, DisplayName=:DisplayName,
		Description=:Description, Permissions=:Permissions, SchemeManaged=:SchemeManaged, BuiltIn=:BuiltIn
		 WHERE Id=:Id`, &role)

	if err != nil {
		return nil, errors.Wrap(err, "failed to update Role")
	}

	rowsChanged, err := res.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "error while getting rows_affected")
	}

	if rowsChanged != 1 {
		return nil, fmt.Errorf("invalid number of updated rows, expected 1 but got %d", rowsChanged)
	}

	return role.ToModel(), nil
}

func (s *SqlRoleStore) PermanentDeleteAll() error {
	if _, err := s.GetMaster().Exec("DELETE FROM Roles"); err != nil {
		return errors.Wrap(err, "failed to delete Roles")
	}

	return nil
}

func (s *SqlRoleStore) channelHigherScopedPermissionsQuery(roleNames []string) string {
	sqlTmpl := `
		SELECT
			'' AS GuestRoleName,
			RoleSchemes.DefaultChannelUserRole AS UserRoleName,
			RoleSchemes.DefaultChannelAdminRole AS AdminRoleName,
			'' AS HigherScopedGuestPermissions,
			UserRoles.Permissions AS HigherScopedUserPermissions,
			AdminRoles.Permissions AS HigherScopedAdminPermissions
		FROM
			Schemes AS RoleSchemes
			JOIN Channels ON Channels.SchemeId = RoleSchemes.Id
			JOIN Teams ON Teams.Id = Channels.TeamId
			JOIN Schemes ON Schemes.Id = Teams.SchemeId
			RIGHT JOIN Roles AS UserRoles ON UserRoles.Name = Schemes.DefaultChannelUserRole
			RIGHT JOIN Roles AS AdminRoles ON AdminRoles.Name = Schemes.DefaultChannelAdminRole
		WHERE
			RoleSchemes.DefaultChannelUserRole IN ('%[1]s')
			OR RoleSchemes.DefaultChannelAdminRole IN ('%[1]s')

		UNION

		SELECT
			RoleSchemes.DefaultChannelGuestRole AS GuestRoleName,
			'' AS UserRoleName,
			'' AS AdminRoleName,
			GuestRoles.Permissions AS HigherScopedGuestPermissions,
			'' AS HigherScopedUserPermissions,
			'' AS HigherScopedAdminPermissions
		FROM
			Schemes AS RoleSchemes
			JOIN Channels ON Channels.SchemeId = RoleSchemes.Id
			JOIN Teams ON Teams.Id = Channels.TeamId
			JOIN Schemes ON Schemes.Id = Teams.SchemeId
			RIGHT JOIN Roles AS GuestRoles ON GuestRoles.Name = Schemes.DefaultChannelGuestRole
		WHERE
			RoleSchemes.DefaultChannelGuestRole IN ('%[1]s')

		UNION

		SELECT
			Schemes.DefaultChannelGuestRole AS GuestRoleName,
			Schemes.DefaultChannelUserRole AS UserRoleName,
			Schemes.DefaultChannelAdminRole AS AdminRoleName,
			GuestRoles.Permissions AS HigherScopedGuestPermissions,
			UserRoles.Permissions AS HigherScopedUserPermissions,
			AdminRoles.Permissions AS HigherScopedAdminPermissions
		FROM
			Schemes
			JOIN Channels ON Channels.SchemeId = Schemes.Id
			JOIN Teams ON Teams.Id = Channels.TeamId
			JOIN Roles AS GuestRoles ON GuestRoles.Name = '%[2]s'
			JOIN Roles AS UserRoles ON UserRoles.Name = '%[3]s'
			JOIN Roles AS AdminRoles ON AdminRoles.Name = '%[4]s'
		WHERE
			(Schemes.DefaultChannelGuestRole IN ('%[1]s')
			OR Schemes.DefaultChannelUserRole IN ('%[1]s')
			OR Schemes.DefaultChannelAdminRole IN ('%[1]s'))
		AND (Teams.SchemeId = ''
			OR Teams.SchemeId IS NULL)
	`

	// The below three channel role names are referenced by their name value because there is no system scheme
	// record that ships with Mattermost, otherwise the system scheme would be referenced by name and the channel
	// roles would be referenced by their column names.
	return fmt.Sprintf(
		sqlTmpl,
		strings.Join(roleNames, "', '"),
		model.ChannelGuestRoleId,
		model.ChannelUserRoleId,
		model.ChannelAdminRoleId,
	)
}

func (s *SqlRoleStore) ChannelHigherScopedPermissions(roleNames []string) (map[string]*model.RolePermissions, error) {
	query := s.channelHigherScopedPermissionsQuery(roleNames)

	rolesPermissions := []*channelRolesPermissions{}
	if err := s.GetReplica().Select(&rolesPermissions, query); err != nil {
		return nil, errors.Wrap(err, "failed to find RolePermissions")
	}

	roleNameHigherScopedPermissions := map[string]*model.RolePermissions{}

	for _, rp := range rolesPermissions {
		roleNameHigherScopedPermissions[rp.GuestRoleName] = &model.RolePermissions{RoleID: model.ChannelGuestRoleId, Permissions: strings.Split(rp.HigherScopedGuestPermissions, " ")}
		roleNameHigherScopedPermissions[rp.UserRoleName] = &model.RolePermissions{RoleID: model.ChannelUserRoleId, Permissions: strings.Split(rp.HigherScopedUserPermissions, " ")}
		roleNameHigherScopedPermissions[rp.AdminRoleName] = &model.RolePermissions{RoleID: model.ChannelAdminRoleId, Permissions: strings.Split(rp.HigherScopedAdminPermissions, " ")}
	}

	return roleNameHigherScopedPermissions, nil
}

func (s *SqlRoleStore) AllChannelSchemeRoles() ([]*model.Role, error) {
	query := s.getQueryBuilder().
		Select(
			"Roles.Id",
			"Roles.Name",
			"Roles.DisplayName",
			"Roles.Description",
			"Roles.CreateAt",
			"Roles.UpdateAt",
			"Roles.DeleteAt",
			"Roles.Permissions",
			"Roles.SchemeManaged",
			"Roles.BuiltIn",
			"Roles.SchemeId",
		).
		From("Roles").
		Join("Schemes ON Roles.SchemeId = Schemes.Id").
		Where(sq.Eq{"Schemes.Scope": model.SchemeScopeChannel}).
		Where(sq.Eq{"Roles.DeleteAt": 0}).
		Where(sq.Eq{"Schemes.DeleteAt": 0})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "role_tosql")
	}

	dbRoles := []*Role{}
	if err = s.GetReplica().Select(&dbRoles, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Roles")
	}

	roles := []*model.Role{}
	for _, dbRole := range dbRoles {
		roles = append(roles, dbRole.ToModel())
	}

	return roles, nil
}

// ChannelRolesUnderTeamRole finds all of the channel-scheme roles under the team of the given team-scheme role.
func (s *SqlRoleStore) ChannelRolesUnderTeamRole(roleName string) ([]*model.Role, error) {
	query := s.getQueryBuilder().
		Select(
			"ChannelSchemeRoles.Id",
			"ChannelSchemeRoles.Name",
			"ChannelSchemeRoles.DisplayName",
			"ChannelSchemeRoles.Description",
			"ChannelSchemeRoles.CreateAt",
			"ChannelSchemeRoles.UpdateAt",
			"ChannelSchemeRoles.DeleteAt",
			"ChannelSchemeRoles.Permissions",
			"ChannelSchemeRoles.SchemeManaged",
			"ChannelSchemeRoles.BuiltIn",
			"ChannelSchemeRoles.SchemeId",
		).
		From("Roles AS HigherScopedRoles").
		Join("Schemes AS HigherScopedSchemes ON (HigherScopedRoles.Name = HigherScopedSchemes.DefaultChannelGuestRole OR HigherScopedRoles.Name = HigherScopedSchemes.DefaultChannelUserRole OR HigherScopedRoles.Name = HigherScopedSchemes.DefaultChannelAdminRole)").
		Join("Teams ON Teams.SchemeId = HigherScopedSchemes.Id").
		Join("Channels ON Channels.TeamId = Teams.Id").
		Join("Schemes AS ChannelSchemes ON Channels.SchemeId = ChannelSchemes.Id").
		Join("Roles AS ChannelSchemeRoles ON ChannelSchemeRoles.SchemeId = ChannelSchemes.Id").
		Where(sq.Eq{"HigherScopedSchemes.Scope": model.SchemeScopeTeam}).
		Where(sq.Eq{"HigherScopedRoles.Name": roleName}).
		Where(sq.Eq{"HigherScopedRoles.DeleteAt": 0}).
		Where(sq.Eq{"HigherScopedSchemes.DeleteAt": 0}).
		Where(sq.Eq{"Teams.DeleteAt": 0}).
		Where(sq.Eq{"Channels.DeleteAt": 0}).
		Where(sq.Eq{"ChannelSchemes.DeleteAt": 0}).
		Where(sq.Eq{"ChannelSchemeRoles.DeleteAt": 0})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "role_tosql")
	}

	dbRoles := []*Role{}
	if err = s.GetReplica().Select(&dbRoles, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Roles")
	}

	roles := []*model.Role{}
	for _, dbRole := range dbRoles {
		roles = append(roles, dbRole.ToModel())
	}

	return roles, nil
}

type dbPluginPermission struct {
	PluginId        string
	LocalId         string
	PermissionId    string
	Name            string
	Description     string
	Scope           string
	DefaultRoles    string
	Active          bool
	DefaultsApplied bool
	CreateAt        int64
	UpdateAt        int64
}

func (p dbPluginPermission) ToModel() *model.PluginPermission {
	return &model.PluginPermission{
		PluginId:        p.PluginId,
		Id:              p.LocalId,
		PermissionId:    p.PermissionId,
		Name:            p.Name,
		Description:     p.Description,
		Scope:           p.Scope,
		DefaultRoles:    strings.Fields(p.DefaultRoles),
		Active:          p.Active,
		DefaultsApplied: p.DefaultsApplied,
		CreateAt:        p.CreateAt,
		UpdateAt:        p.UpdateAt,
	}
}

func (s *SqlRoleStore) SavePluginPermission(permission *model.PluginPermission) error {
	now := model.GetMillis()
	if permission.CreateAt == 0 {
		permission.CreateAt = now
	}
	permission.UpdateAt = now

	builder := s.getQueryBuilder().
		Insert("PluginPermissions").
		Columns("PluginId", "LocalId", "PermissionId", "Name", "Description", "Scope", "DefaultRoles", "Active", "DefaultsApplied", "CreateAt", "UpdateAt").
		Values(
			permission.PluginId,
			permission.Id,
			permission.PermissionId,
			permission.Name,
			permission.Description,
			permission.Scope,
			strings.Join(permission.DefaultRoles, " "),
			permission.Active,
			permission.DefaultsApplied,
			permission.CreateAt,
			permission.UpdateAt,
		).
		SuffixExpr(sq.Expr("ON CONFLICT (PluginId, LocalId) DO UPDATE SET Name = EXCLUDED.Name, Description = EXCLUDED.Description, Scope = EXCLUDED.Scope, DefaultRoles = EXCLUDED.DefaultRoles, Active = EXCLUDED.Active, UpdateAt = EXCLUDED.UpdateAt"))

	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return errors.Wrapf(err, "failed to save plugin permission plugin=%s id=%s", permission.PluginId, permission.Id)
	}
	return nil
}

func (s *SqlRoleStore) GetPluginPermission(pluginID, localID string) (*model.PluginPermission, error) {
	query := s.getQueryBuilder().
		Select("PluginId", "LocalId", "PermissionId", "Name", "Description", "Scope", "DefaultRoles", "Active", "DefaultsApplied", "CreateAt", "UpdateAt").
		From("PluginPermissions").
		Where(sq.Eq{"PluginId": pluginID, "LocalId": localID})

	var dbPerm dbPluginPermission
	if err := s.GetReplica().GetBuilder(&dbPerm, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("PluginPermission", pluginID+":"+localID)
		}
		return nil, errors.Wrapf(err, "failed to get plugin permission plugin=%s id=%s", pluginID, localID)
	}
	return dbPerm.ToModel(), nil
}

func (s *SqlRoleStore) pluginPermissionsSelect() sq.SelectBuilder {
	return s.getQueryBuilder().
		Select("PluginId", "LocalId", "PermissionId", "Name", "Description", "Scope", "DefaultRoles", "Active", "DefaultsApplied", "CreateAt", "UpdateAt").
		From("PluginPermissions")
}

func (s *SqlRoleStore) GetPluginPermissions() ([]*model.PluginPermission, error) {
	var dbPerms []dbPluginPermission
	if err := s.GetReplica().SelectBuilder(&dbPerms, s.pluginPermissionsSelect()); err != nil {
		return nil, errors.Wrap(err, "failed to get plugin permissions")
	}
	out := make([]*model.PluginPermission, 0, len(dbPerms))
	for _, p := range dbPerms {
		out = append(out, p.ToModel())
	}
	return out, nil
}

func (s *SqlRoleStore) GetPluginPermissionsByPlugin(pluginID string) ([]*model.PluginPermission, error) {
	query := s.pluginPermissionsSelect().Where(sq.Eq{"PluginId": pluginID})
	var dbPerms []dbPluginPermission
	if err := s.GetReplica().SelectBuilder(&dbPerms, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get plugin permissions plugin=%s", pluginID)
	}
	out := make([]*model.PluginPermission, 0, len(dbPerms))
	for _, p := range dbPerms {
		out = append(out, p.ToModel())
	}
	return out, nil
}

func (s *SqlRoleStore) SetPluginPermissionsActive(pluginID string, active bool) error {
	builder := s.getQueryBuilder().
		Update("PluginPermissions").
		Set("Active", active).
		Set("UpdateAt", model.GetMillis()).
		Where(sq.Eq{"PluginId": pluginID})
	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return errors.Wrapf(err, "failed to set plugin permissions active plugin=%s", pluginID)
	}
	return nil
}

func (s *SqlRoleStore) DeletePluginPermissions(pluginID string) error {
	builder := s.getQueryBuilder().
		Delete("PluginPermissions").
		Where(sq.Eq{"PluginId": pluginID})
	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return errors.Wrapf(err, "failed to delete plugin permissions plugin=%s", pluginID)
	}
	return nil
}

func (s *SqlRoleStore) MarkPluginPermissionDefaultsApplied(pluginID, localID string) error {
	builder := s.getQueryBuilder().
		Update("PluginPermissions").
		Set("DefaultsApplied", true).
		Set("UpdateAt", model.GetMillis()).
		Where(sq.Eq{"PluginId": pluginID, "LocalId": localID})
	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return errors.Wrapf(err, "failed to mark plugin permission defaults applied plugin=%s id=%s", pluginID, localID)
	}
	return nil
}

func (s *SqlRoleStore) SavePluginRoleOwnership(ownership *model.PluginRoleOwnership) error {
	if ownership.CreateAt == 0 {
		ownership.CreateAt = model.GetMillis()
	}
	builder := s.getQueryBuilder().
		Insert("PluginRoles").
		Columns("PluginId", "LocalName", "RoleName", "CreateAt").
		Values(ownership.PluginId, ownership.LocalName, ownership.RoleName, ownership.CreateAt).
		SuffixExpr(sq.Expr("ON CONFLICT (PluginId, LocalName) DO NOTHING"))
	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return errors.Wrapf(err, "failed to save plugin role ownership plugin=%s name=%s", ownership.PluginId, ownership.LocalName)
	}
	return nil
}

func (s *SqlRoleStore) GetPluginRoleOwnership(pluginID, localName string) (*model.PluginRoleOwnership, error) {
	query := s.getQueryBuilder().
		Select("PluginId", "LocalName", "RoleName", "CreateAt").
		From("PluginRoles").
		Where(sq.Eq{"PluginId": pluginID, "LocalName": localName})

	var ownership model.PluginRoleOwnership
	if err := s.GetReplica().GetBuilder(&ownership, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("PluginRole", pluginID+":"+localName)
		}
		return nil, errors.Wrapf(err, "failed to get plugin role ownership plugin=%s name=%s", pluginID, localName)
	}
	return &ownership, nil
}

func (s *SqlRoleStore) GetPluginRoleOwnershipsByPlugin(pluginID string) ([]*model.PluginRoleOwnership, error) {
	query := s.getQueryBuilder().
		Select("PluginId", "LocalName", "RoleName", "CreateAt").
		From("PluginRoles").
		Where(sq.Eq{"PluginId": pluginID})

	var ownerships []*model.PluginRoleOwnership
	if err := s.GetReplica().SelectBuilder(&ownerships, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get plugin role ownerships plugin=%s", pluginID)
	}
	return ownerships, nil
}

func (s *SqlRoleStore) DeletePluginRoleOwnerships(pluginID string) error {
	builder := s.getQueryBuilder().
		Delete("PluginRoles").
		Where(sq.Eq{"PluginId": pluginID})
	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return errors.Wrapf(err, "failed to delete plugin role ownerships plugin=%s", pluginID)
	}
	return nil
}
