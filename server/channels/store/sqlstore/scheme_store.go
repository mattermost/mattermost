// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const (
	SchemeRoleDisplayNameTeamAdmin = "Team Admin Role for Scheme"
	SchemeRoleDisplayNameTeamUser  = "Team User Role for Scheme"
	SchemeRoleDisplayNameTeamGuest = "Team Guest Role for Scheme"

	SchemeRoleDisplayNameChannelAdmin = "Channel Admin Role for Scheme"
	SchemeRoleDisplayNameChannelUser  = "Channel User Role for Scheme"
	SchemeRoleDisplayNameChannelGuest = "Channel Guest Role for Scheme"

	SchemeRoleDisplayNamePlaybookAdmin  = "Playbook Admin Role for Scheme"
	SchemeRoleDisplayNamePlaybookMember = "Playbook Member Role for Scheme"

	SchemeRoleDisplayNameRunAdmin  = "Run Admin Role for Scheme"
	SchemeRoleDisplayNameRunMember = "Run Member Role for Scheme"
)

type SqlSchemeStore struct {
	*SqlStore
	schemeSelectQuery sq.SelectBuilder
}

func newSqlSchemeStore(sqlStore *SqlStore) store.SchemeStore {
	s := &SqlSchemeStore{
		SqlStore: sqlStore,
	}

	s.schemeSelectQuery = s.getQueryBuilder().
		Select(
			"Id", "Name", "DisplayName", "Description", "Scope",
			"DefaultTeamAdminRole", "DefaultTeamUserRole", "DefaultTeamGuestRole",
			"DefaultChannelAdminRole", "DefaultChannelUserRole", "DefaultChannelGuestRole",
			"CreateAt", "UpdateAt", "DeleteAt",
			"DefaultPlaybookAdminRole", "DefaultPlaybookMemberRole",
			"DefaultRunAdminRole", "DefaultRunMemberRole",
		).
		From("Schemes")

	return s
}

func (s *SqlSchemeStore) Save(scheme *model.Scheme) (_ *model.Scheme, err error) {
	if scheme.Id == "" {
		transaction, terr := s.GetMaster().Beginx()
		if terr != nil {
			return nil, errors.Wrap(terr, "begin_transaction")
		}
		defer finalizeTransactionX(transaction, &terr)

		newScheme, terr := s.createScheme(scheme, transaction)
		if terr != nil {
			return nil, terr
		}
		if terr = transaction.Commit(); terr != nil {
			return nil, errors.Wrap(terr, "commit_transaction")
		}
		return newScheme, nil
	}

	if !scheme.IsValid() {
		return nil, store.NewErrInvalidInput("Scheme", "<any>", fmt.Sprintf("%v", scheme))
	}

	scheme.UpdateAt = model.GetMillis()

	res, err := s.GetMaster().NamedExec(`UPDATE Schemes
		SET UpdateAt=:UpdateAt, CreateAt=:CreateAt, DeleteAt=:DeleteAt, Name=:Name, DisplayName=:DisplayName, Description=:Description, Scope=:Scope,
		 DefaultTeamAdminRole=:DefaultTeamAdminRole, DefaultTeamUserRole=:DefaultTeamUserRole, DefaultTeamGuestRole=:DefaultTeamGuestRole,
		 DefaultChannelAdminRole=:DefaultChannelAdminRole, DefaultChannelUserRole=:DefaultChannelUserRole, DefaultChannelGuestRole=:DefaultChannelGuestRole,
		 DefaultPlaybookMemberRole=:DefaultPlaybookMemberRole, DefaultPlaybookAdminRole=:DefaultPlaybookAdminRole, DefaultRunMemberRole=:DefaultRunMemberRole, DefaultRunAdminRole=:DefaultRunAdminRole
		 WHERE Id=:Id`, scheme)
	if err != nil {
		return nil, errors.Wrap(err, "failed to update Scheme")
	}

	rowsChanged, err := res.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "error while getting rows_affected")
	}
	if rowsChanged != 1 {
		return nil, errors.New("no record to update")
	}

	return scheme, nil
}

func (s *SqlSchemeStore) createScheme(scheme *model.Scheme, transaction *sqlxTxWrapper) (*model.Scheme, error) {
	// Fetch the default system scheme roles to populate default permissions.
	defaultRoleNames := []string{
		model.TeamAdminRoleId,
		model.TeamUserRoleId,
		model.TeamGuestRoleId,
		model.ChannelAdminRoleId,
		model.ChannelUserRoleId,
		model.ChannelGuestRoleId,
		model.PlaybookAdminRoleId,
		model.PlaybookMemberRoleId,
		model.RunAdminRoleId,
		model.RunMemberRoleId,
	}
	defaultRoles := make(map[string]*model.Role)
	roles, err := s.SqlStore.Role().GetByNames(defaultRoleNames)
	if err != nil {
		return nil, err
	}

	for _, role := range roles {
		defaultRoles[role.Name] = role
	}

	if len(defaultRoles) != len(defaultRoleNames) {
		return nil, errors.New("createScheme: unable to retrieve default scheme roles")
	}

	// Create the appropriate default roles for the scheme.
	if scheme.Scope == model.SchemeScopeTeam {
		// Team Admin Role
		teamAdminRole := &model.Role{
			Name:          model.NewId(),
			DisplayName:   fmt.Sprintf("%s %s", SchemeRoleDisplayNameTeamAdmin, scheme.Name),
			Permissions:   defaultRoles[model.TeamAdminRoleId].Permissions,
			SchemeManaged: true,
		}

		savedRole, err := s.SqlStore.Role().(*SqlRoleStore).createRole(teamAdminRole, transaction)
		if err != nil {
			return nil, err
		}
		scheme.DefaultTeamAdminRole = savedRole.Name

		// Team User Role
		teamUserRole := &model.Role{
			Name:          model.NewId(),
			DisplayName:   fmt.Sprintf("%s %s", SchemeRoleDisplayNameTeamUser, scheme.Name),
			Permissions:   defaultRoles[model.TeamUserRoleId].Permissions,
			SchemeManaged: true,
		}

		savedRole, err = s.SqlStore.Role().(*SqlRoleStore).createRole(teamUserRole, transaction)
		if err != nil {
			return nil, err
		}
		scheme.DefaultTeamUserRole = savedRole.Name

		// Team Guest Role
		teamGuestRole := &model.Role{
			Name:          model.NewId(),
			DisplayName:   fmt.Sprintf("%s %s", SchemeRoleDisplayNameTeamGuest, scheme.Name),
			Permissions:   defaultRoles[model.TeamGuestRoleId].Permissions,
			SchemeManaged: true,
		}

		savedRole, err = s.SqlStore.Role().(*SqlRoleStore).createRole(teamGuestRole, transaction)
		if err != nil {
			return nil, err
		}
		scheme.DefaultTeamGuestRole = savedRole.Name

		// playbook admin role
		playbookAdminRole := &model.Role{
			Name:          model.NewId(),
			DisplayName:   fmt.Sprintf("%s %s", SchemeRoleDisplayNamePlaybookAdmin, scheme.Name),
			Permissions:   defaultRoles[model.PlaybookAdminRoleId].Permissions,
			SchemeManaged: true,
		}
		savedRole, err = s.SqlStore.Role().(*SqlRoleStore).createRole(playbookAdminRole, transaction)
		if err != nil {
			return nil, err
		}
		scheme.DefaultPlaybookAdminRole = savedRole.Name

		// playbook member role
		playbookMemberRole := &model.Role{
			Name:          model.NewId(),
			DisplayName:   fmt.Sprintf("%s %s", SchemeRoleDisplayNamePlaybookMember, scheme.Name),
			Permissions:   defaultRoles[model.PlaybookMemberRoleId].Permissions,
			SchemeManaged: true,
		}
		savedRole, err = s.SqlStore.Role().(*SqlRoleStore).createRole(playbookMemberRole, transaction)
		if err != nil {
			return nil, err
		}
		scheme.DefaultPlaybookMemberRole = savedRole.Name

		// run admin role
		runAdminRole := &model.Role{
			Name:          model.NewId(),
			DisplayName:   fmt.Sprintf("%s %s", SchemeRoleDisplayNameRunAdmin, scheme.Name),
			Permissions:   defaultRoles[model.RunAdminRoleId].Permissions,
			SchemeManaged: true,
		}
		savedRole, err = s.SqlStore.Role().(*SqlRoleStore).createRole(runAdminRole, transaction)
		if err != nil {
			return nil, err
		}
		scheme.DefaultRunAdminRole = savedRole.Name

		// run member role
		runMemberRole := &model.Role{
			Name:          model.NewId(),
			DisplayName:   fmt.Sprintf("%s %s", SchemeRoleDisplayNameRunMember, scheme.Name),
			Permissions:   defaultRoles[model.RunMemberRoleId].Permissions,
			SchemeManaged: true,
		}
		savedRole, err = s.SqlStore.Role().(*SqlRoleStore).createRole(runMemberRole, transaction)
		if err != nil {
			return nil, err
		}
		scheme.DefaultRunMemberRole = savedRole.Name
	}

	if scheme.Scope == model.SchemeScopeTeam || scheme.Scope == model.SchemeScopeChannel {
		// Channel Admin Role
		channelAdminRole := &model.Role{
			Name:          model.NewId(),
			DisplayName:   fmt.Sprintf("Channel Admin Role for Scheme %s", scheme.Name),
			Permissions:   defaultRoles[model.ChannelAdminRoleId].Permissions,
			SchemeManaged: true,
		}

		if scheme.Scope == model.SchemeScopeChannel {
			channelAdminRole.Permissions = []string{}
		}

		savedRole, err := s.SqlStore.Role().(*SqlRoleStore).createRole(channelAdminRole, transaction)
		if err != nil {
			return nil, err
		}
		scheme.DefaultChannelAdminRole = savedRole.Name

		// Channel User Role
		channelUserRole := &model.Role{
			Name:          model.NewId(),
			DisplayName:   fmt.Sprintf("Channel User Role for Scheme %s", scheme.Name),
			Permissions:   defaultRoles[model.ChannelUserRoleId].Permissions,
			SchemeManaged: true,
		}

		if scheme.Scope == model.SchemeScopeChannel {
			channelUserRole.Permissions = filterModerated(channelUserRole.Permissions)
		}

		savedRole, err = s.SqlStore.Role().(*SqlRoleStore).createRole(channelUserRole, transaction)
		if err != nil {
			return nil, err
		}
		scheme.DefaultChannelUserRole = savedRole.Name

		// Channel Guest Role
		channelGuestRole := &model.Role{
			Name:          model.NewId(),
			DisplayName:   fmt.Sprintf("Channel Guest Role for Scheme %s", scheme.Name),
			Permissions:   defaultRoles[model.ChannelGuestRoleId].Permissions,
			SchemeManaged: true,
		}

		if scheme.Scope == model.SchemeScopeChannel {
			channelGuestRole.Permissions = filterModerated(channelGuestRole.Permissions)
		}

		savedRole, err = s.SqlStore.Role().(*SqlRoleStore).createRole(channelGuestRole, transaction)
		if err != nil {
			return nil, err
		}
		scheme.DefaultChannelGuestRole = savedRole.Name
	}

	scheme.Id = model.NewId()
	if scheme.Name == "" {
		scheme.Name = model.NewId()
	}
	scheme.CreateAt = model.GetMillis()
	scheme.UpdateAt = scheme.CreateAt

	// Validate the scheme
	if !scheme.IsValidForCreate() {
		return nil, store.NewErrInvalidInput("Scheme", "<any>", fmt.Sprintf("%v", scheme))
	}

	if _, err := transaction.NamedExec(`INSERT INTO Schemes
	(Id, Name, DisplayName, Description, Scope, DefaultTeamAdminRole, DefaultTeamUserRole, DefaultTeamGuestRole, DefaultChannelAdminRole, DefaultChannelUserRole, DefaultChannelGuestRole, CreateAt, UpdateAt, DeleteAt, DefaultPlaybookAdminRole, DefaultPlaybookMemberRole, DefaultRunAdminRole, DefaultRunMemberRole)
		VALUES
		(:Id, :Name, :DisplayName, :Description, :Scope, :DefaultTeamAdminRole, :DefaultTeamUserRole, :DefaultTeamGuestRole, :DefaultChannelAdminRole, :DefaultChannelUserRole, :DefaultChannelGuestRole, :CreateAt, :UpdateAt, :DeleteAt, :DefaultPlaybookAdminRole, :DefaultPlaybookMemberRole, :DefaultRunAdminRole, :DefaultRunMemberRole)`, scheme); err != nil {
		return nil, errors.Wrap(err, "failed to save Scheme")
	}

	return scheme, nil
}

func filterModerated(permissions []string) []string {
	filteredPermissions := []string{}
	for _, perm := range permissions {
		if _, ok := model.ChannelModeratedPermissionsMap[perm]; ok {
			filteredPermissions = append(filteredPermissions, perm)
		}
	}
	return filteredPermissions
}

func (s *SqlSchemeStore) Get(schemeId string) (*model.Scheme, error) {
	var scheme model.Scheme
	query := s.schemeSelectQuery.Where(sq.Eq{"Id": schemeId})
	if err := s.GetReplica().GetBuilder(&scheme, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Scheme", fmt.Sprintf("schemeId=%s", schemeId))
		}
		return nil, errors.Wrapf(err, "failed to get Scheme with schemeId=%s", schemeId)
	}
	return &scheme, nil
}

func (s *SqlSchemeStore) GetByName(schemeName string) (*model.Scheme, error) {
	var scheme model.Scheme
	query := s.schemeSelectQuery.Where(sq.Eq{"Name": schemeName})
	if err := s.GetReplica().GetBuilder(&scheme, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Scheme", fmt.Sprintf("schemeName=%s", schemeName))
		}
		return nil, errors.Wrapf(err, "failed to get Scheme with schemeName=%s", schemeName)
	}
	return &scheme, nil
}

func (s *SqlSchemeStore) Delete(schemeId string) (*model.Scheme, error) {
	scheme := model.Scheme{}
	query := s.schemeSelectQuery.Where(sq.Eq{"Id": schemeId})
	if err := s.GetMaster().GetBuilder(&scheme, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Scheme", fmt.Sprintf("schemeId=%s", schemeId))
		}
		return nil, errors.Wrapf(err, "failed to get Scheme with schemeId=%s", schemeId)
	}

	// Update any teams or channels using this scheme to the default scheme.
	if scheme.Scope == model.SchemeScopeTeam {
		if _, err := s.GetMaster().Exec(`UPDATE Teams SET SchemeId = '' WHERE SchemeId = ?`, schemeId); err != nil {
			return nil, errors.Wrapf(err, "failed to update Teams with schemeId=%s", schemeId)
		}

		s.Team().ClearCaches()
	} else if scheme.Scope == model.SchemeScopeChannel {
		if _, err := s.GetMaster().Exec(`UPDATE Channels SET SchemeId = '' WHERE SchemeId = ?`, schemeId); err != nil {
			return nil, errors.Wrapf(err, "failed to update Channels with schemeId=%s", schemeId)
		}
	}

	// Blow away the channel caches.
	s.Channel().ClearCaches()

	// Delete the roles belonging to the scheme.
	roleNames := []string{scheme.DefaultChannelGuestRole, scheme.DefaultChannelUserRole, scheme.DefaultChannelAdminRole}
	if scheme.Scope == model.SchemeScopeTeam {
		roleNames = append(roleNames, scheme.DefaultTeamGuestRole, scheme.DefaultTeamUserRole, scheme.DefaultTeamAdminRole)
	}
	if scheme.Scope == model.SchemeScopePlaybook {
		roleNames = append(roleNames, scheme.DefaultPlaybookAdminRole, scheme.DefaultPlaybookMemberRole)
	}

	if scheme.Scope == model.SchemeScopeRun {
		roleNames = append(roleNames, scheme.DefaultRunAdminRole, scheme.DefaultRunMemberRole)
	}

	time := model.GetMillis()

	updateQuery, args, err := s.getQueryBuilder().
		Update("Roles").
		Where(sq.Eq{"Name": roleNames}).
		Set("UpdateAt", time).
		Set("DeleteAt", time).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "status_tosql")
	}

	if _, err = s.GetMaster().Exec(updateQuery, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to update Roles with name in (%s)", roleNames)
	}

	// Delete the scheme itself.
	scheme.UpdateAt = time
	scheme.DeleteAt = time

	res, err := s.GetMaster().NamedExec(`UPDATE Schemes
		SET UpdateAt=:UpdateAt, DeleteAt=:DeleteAt, CreateAt=:CreateAt, Name=:Name, DisplayName=:DisplayName, Description=:Description, Scope=:Scope,
		 DefaultTeamAdminRole=:DefaultTeamAdminRole, DefaultTeamUserRole=:DefaultTeamUserRole, DefaultTeamGuestRole=:DefaultTeamGuestRole,
		 DefaultChannelAdminRole=:DefaultChannelAdminRole, DefaultChannelUserRole=:DefaultChannelUserRole, DefaultChannelGuestRole=:DefaultChannelGuestRole
		 WHERE Id=:Id`, &scheme)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update Scheme with schemeId=%s", schemeId)
	}

	rowsChanged, err := res.RowsAffected()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get RowsAffected while updating scheme with schemeId=%s", schemeId)
	}
	if rowsChanged != 1 {
		return nil, errors.New("no record to update")
	}
	return &scheme, nil
}

func (s *SqlSchemeStore) GetAllPage(scope string, offset int, limit int) ([]*model.Scheme, error) {
	schemes := []*model.Scheme{}

	query := s.getQueryBuilder().
		Select("*").
		From("Schemes").
		Where(sq.Eq{"DeleteAt": 0}).
		OrderBy("CreateAt DESC").
		Limit(uint64(limit)).
		Offset(uint64(offset))

	if scope != "" {
		query = query.Where(sq.Eq{"Scope": scope})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "status_tosql")
	}

	if err := s.GetReplica().Select(&schemes, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to get Schemes")
	}

	return schemes, nil
}

func (s *SqlSchemeStore) PermanentDeleteAll() error {
	if _, err := s.GetMaster().Exec("DELETE from Schemes"); err != nil {
		return errors.Wrap(err, "failed to delete Schemes")
	}

	return nil
}

func (s *SqlSchemeStore) CountByScope(scope string) (int64, error) {
	var count int64
	err := s.GetReplica().Get(&count, `SELECT count(*) FROM Schemes WHERE Scope = ? AND DeleteAt = 0`, scope)
	if err != nil {
		return 0, errors.Wrap(err, "failed to count Schemes by scope")
	}
	return count, nil
}

func (s *SqlSchemeStore) CountWithoutPermission(schemeScope, permissionID string, roleScope model.RoleScope, roleType model.RoleType) (int64, error) {
	joinCol := fmt.Sprintf("Default%s%sRole", roleScope, roleType)
	query := fmt.Sprintf(`
		SELECT
			count(*)
		FROM Schemes
			JOIN Roles ON Roles.Name = Schemes.%s
		WHERE
			Schemes.DeleteAt = 0 AND
			Schemes.Scope = '%s' AND
			Roles.Permissions NOT LIKE '%%%s%%'
	`, joinCol, schemeScope, permissionID)

	var count int64
	err := s.GetReplica().Get(&count, query)
	if err != nil {
		return 0, errors.Wrap(err, "failed to count Schemes without permission")
	}
	return count, nil
}
