// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlRoleStore struct {
	*SqlStore
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
	permissions := ""

	for _, permission := range role.Permissions {
		if !permissionsMap[permission] {
			permissions += fmt.Sprintf(" %v", permission)
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
		Permissions:   permissions,
		SchemeManaged: role.SchemeManaged,
		BuiltIn:       role.BuiltIn,
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
	}
}

func newSqlRoleStore(sqlStore *SqlStore) store.RoleStore {
	return &SqlRoleStore{sqlStore}
}

func (s *SqlRoleStore) Save(role *model.Role) (_ *model.Role, err error) {
	// Check the role is valid before proceeding.
	if !role.IsValidWithoutId() {
		return nil, store.NewErrInvalidInput("Role", "<any>", fmt.Sprintf("%v", role))
	}

	if role.Id == "" {
		transaction, terr := s.GetMasterX().Beginx()
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

	res, err := s.GetMasterX().NamedExec(`UPDATE Roles
		SET UpdateAt=:UpdateAt, DeleteAt=:DeleteAt, CreateAt=:CreateAt,  Name=:Name, DisplayName=:DisplayName,
		Description=:Description, Permissions=:Permissions, SchemeManaged=:SchemeManaged, BuiltIn=:BuiltIn
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
	if !role.IsValidWithoutId() {
		return nil, store.NewErrInvalidInput("Role", "<any>", fmt.Sprintf("%v", role))
	}

	dbRole := NewRoleFromModel(role)

	dbRole.Id = model.NewId()
	dbRole.CreateAt = model.GetMillis()
	dbRole.UpdateAt = dbRole.CreateAt

	if _, err := transaction.NamedExec(`INSERT INTO Roles
		(Id, Name, DisplayName, Description, Permissions, CreateAt, UpdateAt, DeleteAt, SchemeManaged, BuiltIn)
		VALUES
		(:Id, :Name, :DisplayName, :Description, :Permissions, :CreateAt, :UpdateAt, :DeleteAt, :SchemeManaged, :BuiltIn)`, dbRole); err != nil {
		return nil, errors.Wrap(err, "failed to save Role")
	}

	return dbRole.ToModel(), nil
}

func (s *SqlRoleStore) Get(roleId string) (*model.Role, error) {
	dbRole := Role{}

	if err := s.GetReplicaX().Get(&dbRole, "SELECT * from Roles WHERE Id = ?", roleId); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Role", roleId)
		}
		return nil, errors.Wrap(err, "failed to get Role")
	}

	return dbRole.ToModel(), nil
}

func (s *SqlRoleStore) GetAll() ([]*model.Role, error) {
	dbRoles := []Role{}

	if err := s.GetReplicaX().Select(&dbRoles, "SELECT * from Roles"); err != nil {
		return nil, errors.Wrap(err, "failed to find Roles")
	}

	roles := []*model.Role{}
	for _, dbRole := range dbRoles {
		roles = append(roles, dbRole.ToModel())
	}
	return roles, nil
}

func (s *SqlRoleStore) GetByName(ctx context.Context, name string) (*model.Role, error) {
	dbRole := Role{}
	if err := s.DBXFromContext(ctx).Get(&dbRole, "SELECT * from Roles WHERE Name = ?", name); err != nil {
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

	query := s.getQueryBuilder().
		Select("Id, Name, DisplayName, Description, CreateAt, UpdateAt, DeleteAt, Permissions, SchemeManaged, BuiltIn").
		From("Roles").
		Where(sq.Eq{"Name": names})
	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "role_tosql")
	}

	rows, err := s.GetReplicaX().DB.Query(queryString, args...)
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
			&role.SchemeManaged, &role.BuiltIn)
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
	if err := s.GetReplicaX().Get(&role, "SELECT * from Roles WHERE Id = ?", roleId); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Role", roleId)
		}
		return nil, errors.Wrapf(err, "failed to get Role with id=%s", roleId)
	}

	time := model.GetMillis()
	role.DeleteAt = time
	role.UpdateAt = time

	res, err := s.GetMasterX().NamedExec(`UPDATE Roles
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
	if _, err := s.GetMasterX().Exec("DELETE FROM Roles"); err != nil {
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
	if err := s.GetReplicaX().Select(&rolesPermissions, query); err != nil {
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
		Select("Roles.*").
		From("Schemes").
		Join("Roles ON Schemes.DefaultChannelGuestRole = Roles.Name OR Schemes.DefaultChannelUserRole = Roles.Name OR Schemes.DefaultChannelAdminRole = Roles.Name").
		Where(sq.Eq{"Schemes.Scope": model.SchemeScopeChannel}).
		Where(sq.Eq{"Roles.DeleteAt": 0}).
		Where(sq.Eq{"Schemes.DeleteAt": 0})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "role_tosql")
	}

	dbRoles := []*Role{}
	if err = s.GetReplicaX().Select(&dbRoles, queryString, args...); err != nil {
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
		Select("ChannelSchemeRoles.*").
		From("Roles AS HigherScopedRoles").
		Join("Schemes AS HigherScopedSchemes ON (HigherScopedRoles.Name = HigherScopedSchemes.DefaultChannelGuestRole OR HigherScopedRoles.Name = HigherScopedSchemes.DefaultChannelUserRole OR HigherScopedRoles.Name = HigherScopedSchemes.DefaultChannelAdminRole)").
		Join("Teams ON Teams.SchemeId = HigherScopedSchemes.Id").
		Join("Channels ON Channels.TeamId = Teams.Id").
		Join("Schemes AS ChannelSchemes ON Channels.SchemeId = ChannelSchemes.Id").
		Join("Roles AS ChannelSchemeRoles ON (ChannelSchemeRoles.Name = ChannelSchemes.DefaultChannelGuestRole OR ChannelSchemeRoles.Name = ChannelSchemes.DefaultChannelUserRole OR ChannelSchemeRoles.Name = ChannelSchemes.DefaultChannelAdminRole)").
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
	if err = s.GetReplicaX().Select(&dbRoles, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Roles")
	}

	roles := []*model.Role{}
	for _, dbRole := range dbRoles {
		roles = append(roles, dbRole.ToModel())
	}

	return roles, nil
}
