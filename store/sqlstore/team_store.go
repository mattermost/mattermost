// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/gorp"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/utils"
)

const (
	TeamMemberExistsError = "store.sql_team.save_member.exists.app_error"
)

type SqlTeamStore struct {
	*SqlStore

	teamsQuery sq.SelectBuilder
}

type teamMember struct {
	TeamId      string
	UserId      string
	Roles       string
	DeleteAt    int64
	SchemeUser  sql.NullBool
	SchemeAdmin sql.NullBool
	SchemeGuest sql.NullBool
}

func NewTeamMemberFromModel(tm *model.TeamMember) *teamMember {
	return &teamMember{
		TeamId:      tm.TeamId,
		UserId:      tm.UserId,
		Roles:       tm.ExplicitRoles,
		DeleteAt:    tm.DeleteAt,
		SchemeGuest: sql.NullBool{Valid: true, Bool: tm.SchemeGuest},
		SchemeUser:  sql.NullBool{Valid: true, Bool: tm.SchemeUser},
		SchemeAdmin: sql.NullBool{Valid: true, Bool: tm.SchemeAdmin},
	}
}

type teamMemberWithSchemeRoles struct {
	TeamId                     string
	UserId                     string
	Roles                      string
	DeleteAt                   int64
	SchemeGuest                sql.NullBool
	SchemeUser                 sql.NullBool
	SchemeAdmin                sql.NullBool
	TeamSchemeDefaultGuestRole sql.NullString
	TeamSchemeDefaultUserRole  sql.NullString
	TeamSchemeDefaultAdminRole sql.NullString
}

type teamMemberWithSchemeRolesList []teamMemberWithSchemeRoles

func teamMemberSliceColumns() []string {
	return []string{"TeamId", "UserId", "Roles", "DeleteAt", "SchemeUser", "SchemeAdmin", "SchemeGuest"}
}

func teamMemberToSlice(member *model.TeamMember) []interface{} {
	resultSlice := []interface{}{}
	resultSlice = append(resultSlice, member.TeamId)
	resultSlice = append(resultSlice, member.UserId)
	resultSlice = append(resultSlice, member.ExplicitRoles)
	resultSlice = append(resultSlice, member.DeleteAt)
	resultSlice = append(resultSlice, member.SchemeUser)
	resultSlice = append(resultSlice, member.SchemeAdmin)
	resultSlice = append(resultSlice, member.SchemeGuest)
	return resultSlice
}

func wildcardSearchTerm(term string) string {
	return strings.ToLower("%" + term + "%")
}

type rolesInfo struct {
	roles         []string
	explicitRoles []string
	schemeGuest   bool
	schemeUser    bool
	schemeAdmin   bool
}

func getTeamRoles(schemeGuest, schemeUser, schemeAdmin bool, defaultTeamGuestRole, defaultTeamUserRole, defaultTeamAdminRole string, roles []string) rolesInfo {
	result := rolesInfo{
		roles:         []string{},
		explicitRoles: []string{},
		schemeGuest:   schemeGuest,
		schemeUser:    schemeUser,
		schemeAdmin:   schemeAdmin,
	}
	// Identify any scheme derived roles that are in "Roles" field due to not yet being migrated, and exclude
	// them from ExplicitRoles field.
	for _, role := range roles {
		switch role {
		case model.TEAM_GUEST_ROLE_ID:
			result.schemeGuest = true
		case model.TEAM_USER_ROLE_ID:
			result.schemeUser = true
		case model.TEAM_ADMIN_ROLE_ID:
			result.schemeAdmin = true
		default:
			result.explicitRoles = append(result.explicitRoles, role)
			result.roles = append(result.roles, role)
		}
	}

	// Add any scheme derived roles that are not in the Roles field due to being Implicit from the Scheme, and add
	// them to the Roles field for backwards compatibility reasons.
	var schemeImpliedRoles []string
	if result.schemeGuest {
		if defaultTeamGuestRole != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, defaultTeamGuestRole)
		} else {
			schemeImpliedRoles = append(schemeImpliedRoles, model.TEAM_GUEST_ROLE_ID)
		}
	}
	if result.schemeUser {
		if defaultTeamUserRole != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, defaultTeamUserRole)
		} else {
			schemeImpliedRoles = append(schemeImpliedRoles, model.TEAM_USER_ROLE_ID)
		}
	}
	if result.schemeAdmin {
		if defaultTeamAdminRole != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, defaultTeamAdminRole)
		} else {
			schemeImpliedRoles = append(schemeImpliedRoles, model.TEAM_ADMIN_ROLE_ID)
		}
	}
	for _, impliedRole := range schemeImpliedRoles {
		alreadyThere := false
		for _, role := range result.roles {
			if role == impliedRole {
				alreadyThere = true
			}
		}
		if !alreadyThere {
			result.roles = append(result.roles, impliedRole)
		}
	}
	return result
}

func (db teamMemberWithSchemeRoles) ToModel() *model.TeamMember {
	// Identify any scheme derived roles that are in "Roles" field due to not yet being migrated, and exclude
	// them from ExplicitRoles field.
	schemeGuest := db.SchemeGuest.Valid && db.SchemeGuest.Bool
	schemeUser := db.SchemeUser.Valid && db.SchemeUser.Bool
	schemeAdmin := db.SchemeAdmin.Valid && db.SchemeAdmin.Bool

	defaultTeamGuestRole := ""
	if db.TeamSchemeDefaultGuestRole.Valid {
		defaultTeamGuestRole = db.TeamSchemeDefaultGuestRole.String
	}

	defaultTeamUserRole := ""
	if db.TeamSchemeDefaultUserRole.Valid {
		defaultTeamUserRole = db.TeamSchemeDefaultUserRole.String
	}

	defaultTeamAdminRole := ""
	if db.TeamSchemeDefaultAdminRole.Valid {
		defaultTeamAdminRole = db.TeamSchemeDefaultAdminRole.String
	}

	rolesResult := getTeamRoles(schemeGuest, schemeUser, schemeAdmin, defaultTeamGuestRole, defaultTeamUserRole, defaultTeamAdminRole, strings.Fields(db.Roles))

	tm := &model.TeamMember{
		TeamId:        db.TeamId,
		UserId:        db.UserId,
		Roles:         strings.Join(rolesResult.roles, " "),
		DeleteAt:      db.DeleteAt,
		SchemeGuest:   rolesResult.schemeGuest,
		SchemeUser:    rolesResult.schemeUser,
		SchemeAdmin:   rolesResult.schemeAdmin,
		ExplicitRoles: strings.Join(rolesResult.explicitRoles, " "),
	}
	return tm
}

func (db teamMemberWithSchemeRolesList) ToModel() []*model.TeamMember {
	tms := make([]*model.TeamMember, 0)

	for _, tm := range db {
		tms = append(tms, tm.ToModel())
	}

	return tms
}

func newSqlTeamStore(sqlStore *SqlStore) store.TeamStore {
	s := &SqlTeamStore{
		SqlStore: sqlStore,
	}

	s.teamsQuery = s.getQueryBuilder().
		Select("Teams.*").
		From("Teams")

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Team{}, "Teams").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("DisplayName").SetMaxSize(64)
		table.ColMap("Name").SetMaxSize(64).SetUnique(true)
		table.ColMap("Description").SetMaxSize(255)
		table.ColMap("Type").SetMaxSize(255)
		table.ColMap("Email").SetMaxSize(128)
		table.ColMap("CompanyName").SetMaxSize(64)
		table.ColMap("AllowedDomains").SetMaxSize(1000)
		table.ColMap("InviteId").SetMaxSize(32)
		table.ColMap("SchemeId").SetMaxSize(26)

		tablem := db.AddTableWithName(teamMember{}, "TeamMembers").SetKeys(false, "TeamId", "UserId")
		tablem.ColMap("TeamId").SetMaxSize(26)
		tablem.ColMap("UserId").SetMaxSize(26)
		tablem.ColMap("Roles").SetMaxSize(64)
	}

	return s
}

// Save adds the team to the database if a team with the same name does not already
// exist in the database. It returns the team added if the operation is successful.
func (s SqlTeamStore) Save(team *model.Team) (*model.Team, error) {
	if team.Id != "" {
		return nil, store.NewErrInvalidInput("Team", "id", team.Id)
	}

	team.PreSave()

	if err := team.IsValid(); err != nil {
		return nil, err
	}

	if err := s.GetMaster().Insert(team); err != nil {
		if IsUniqueConstraintError(err, []string{"Name", "teams_name_key"}) {
			return nil, store.NewErrInvalidInput("Team", "id", team.Id)
		}
		return nil, errors.Wrapf(err, "failed to save Team with id=%s", team.Id)
	}
	return team, nil
}

// Update updates the details of the team passed as the parameter using the team Id
// if the team exists in the database.
// It returns the updated team if the operation is successful.
func (s SqlTeamStore) Update(team *model.Team) (*model.Team, error) {

	team.PreUpdate()

	if err := team.IsValid(); err != nil {
		return nil, err
	}

	oldResult, err := s.GetMaster().Get(model.Team{}, team.Id)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get Team with id=%s", team.Id)

	}

	if oldResult == nil {
		return nil, store.NewErrInvalidInput("Team", "id", team.Id)
	}

	oldTeam := oldResult.(*model.Team)
	team.CreateAt = oldTeam.CreateAt
	team.UpdateAt = model.GetMillis()

	count, err := s.GetMaster().Update(team)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update Team with id=%s", team.Id)
	}
	if count > 1 {
		return nil, errors.Wrapf(err, "multiple Teams updated with id=%s", team.Id)
	}

	return team, nil
}

// Get returns from the database the team that matches the id provided as parameter.
// If the team doesn't exist it returns a model.AppError with a
// http.StatusNotFound in the StatusCode field.
func (s SqlTeamStore) Get(id string) (*model.Team, error) {
	obj, err := s.GetReplica().Get(model.Team{}, id)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get Team with id=%s", id)
	}
	if obj == nil {
		return nil, store.NewErrNotFound("Team", id)
	}

	return obj.(*model.Team), nil
}

// GetByInviteId returns from the database the team that matches the inviteId provided as parameter.
// If the parameter provided is empty or if there is no match in the database, it returns a model.AppError
// with a http.StatusNotFound in the StatusCode field.
func (s SqlTeamStore) GetByInviteId(inviteId string) (*model.Team, error) {
	team := model.Team{}

	query, args, err := s.teamsQuery.Where(sq.Eq{"InviteId": inviteId}).ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}
	err = s.GetReplica().SelectOne(&team, query, args...)
	if err != nil {
		return nil, store.NewErrNotFound("Team", fmt.Sprintf("inviteId=%s", inviteId))
	}

	if inviteId == "" || team.InviteId != inviteId {
		return nil, store.NewErrNotFound("Team", fmt.Sprintf("inviteId=%s", inviteId))
	}
	return &team, nil
}

// GetByName returns from the database the team that matches the name provided as parameter.
// If there is no match in the database, it returns a model.AppError with a
// http.StatusNotFound in the StatusCode field.
func (s SqlTeamStore) GetByName(name string) (*model.Team, error) {

	team := model.Team{}
	query, args, err := s.teamsQuery.Where(sq.Eq{"Name": name}).ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}
	err = s.GetReplica().SelectOne(&team, query, args...)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Team", fmt.Sprintf("name=%s", name))
		}
		return nil, errors.Wrapf(err, "failed to find Team with name=%s", name)
	}
	return &team, nil
}

func (s SqlTeamStore) GetByNames(names []string) ([]*model.Team, error) {
	uniqueNames := utils.RemoveDuplicatesFromStringArray(names)

	query, args, err := s.teamsQuery.Where(sq.Eq{"Name": uniqueNames}).ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}

	teams := []*model.Team{}
	_, err = s.GetReplica().Select(&teams, query, args...)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Team", fmt.Sprintf("nameIn=%v", names))
		}
		return nil, errors.Wrap(err, "failed to find Teams")
	}
	if len(teams) != len(uniqueNames) {
		return nil, store.NewErrNotFound("Team", fmt.Sprintf("nameIn=%v", names))
	}
	return teams, nil
}

func (s SqlTeamStore) teamSearchQuery(term string, opts *model.TeamSearch, countQuery bool) sq.SelectBuilder {
	var selectStr string
	if countQuery {
		selectStr = "count(*)"
	} else {
		selectStr = "*"
	}

	query := s.getQueryBuilder().
		Select(selectStr).
		From("Teams as t")

	// Don't order or limit if getting count
	if !countQuery {
		query = query.OrderBy("t.DisplayName")

		if opts.IsPaginated() {
			query = query.Limit(uint64(*opts.PerPage)).Offset(uint64(*opts.Page * *opts.PerPage))
		}
	}

	if term != "" {
		term = sanitizeSearchTerm(term, "\\")
		term = wildcardSearchTerm(term)

		operatorKeyword := "ILIKE"
		if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
			operatorKeyword = "LIKE"
		}

		query = query.Where(fmt.Sprintf("(Name %[1]s ? OR DisplayName %[1]s ?)", operatorKeyword), term, term)
	}

	var teamFilters sq.Sqlizer
	var openInviteFilter sq.Sqlizer
	if opts.AllowOpenInvite != nil {
		if *opts.AllowOpenInvite {
			openInviteFilter = sq.Eq{"AllowOpenInvite": true}
		} else {
			openInviteFilter = sq.And{
				sq.Or{
					sq.NotEq{"AllowOpenInvite": true},
					sq.Eq{"AllowOpenInvite": nil},
				},
				sq.Or{
					sq.NotEq{"GroupConstrained": true},
					sq.Eq{"GroupConstrained": nil},
				},
			}
		}

		teamFilters = openInviteFilter
	}

	var groupConstrainedFilter sq.Sqlizer
	if opts.GroupConstrained != nil {
		if *opts.GroupConstrained {
			groupConstrainedFilter = sq.Eq{"GroupConstrained": true}
		} else {
			groupConstrainedFilter = sq.Or{
				sq.NotEq{"GroupConstrained": true},
				sq.Eq{"GroupConstrained": nil},
			}
		}

		if teamFilters == nil {
			teamFilters = groupConstrainedFilter
		} else {
			teamFilters = sq.Or{teamFilters, groupConstrainedFilter}
		}
	}

	query = query.Where(teamFilters)

	return query
}

// SearchAll returns from the database a list of teams that match the Name or DisplayName
// passed as the term search parameter.
func (s SqlTeamStore) SearchAll(term string, opts *model.TeamSearch) ([]*model.Team, error) {
	var teams []*model.Team

	queryString, args, err := s.teamSearchQuery(term, opts, false).ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}

	if _, err = s.GetReplica().Select(&teams, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find Teams with term=%s", term)
	}

	return teams, nil
}

// SearchAllPaged returns a teams list and the total count of teams that matched the search.
func (s SqlTeamStore) SearchAllPaged(term string, opts *model.TeamSearch) ([]*model.Team, int64, error) {
	var teams []*model.Team
	var totalCount int64

	queryString, args, err := s.teamSearchQuery(term, opts, false).ToSql()
	if err != nil {
		return nil, 0, errors.Wrap(err, "team_tosql")
	}
	if _, err = s.GetReplica().Select(&teams, queryString, args...); err != nil {
		return nil, 0, errors.Wrapf(err, "failed to find Teams with term=%s", term)
	}

	queryString, args, err = s.teamSearchQuery(term, opts, true).ToSql()
	if err != nil {
		return nil, 0, errors.Wrap(err, "team_tosql")
	}
	totalCount, err = s.GetReplica().SelectInt(queryString, args...)
	if err != nil {
		return nil, 0, errors.Wrapf(err, "failed to count Teams with term=%s", term)
	}

	return teams, totalCount, nil
}

// SearchOpen returns from the database a list of public teams that match the Name or DisplayName
// passed as the term search parameter.
func (s SqlTeamStore) SearchOpen(term string) ([]*model.Team, error) {
	var teams []*model.Team

	term = sanitizeSearchTerm(term, "\\")
	term = wildcardSearchTerm(term)
	query := s.teamsQuery.Where(sq.Eq{"Type": "O", "AllowOpenInvite": true})
	if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
		query = query.Where(sq.Or{sq.Like{"Name": term}, sq.Like{"DisplayName": term}})
	} else {
		query = query.Where(sq.Or{sq.ILike{"Name": term}, sq.ILike{"DisplayName": term}})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}

	if _, err = s.GetReplica().Select(&teams, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to count Teams with term=%s", term)
	}

	return teams, nil
}

// SearchPrivate returns from the database a list of private teams that match the Name or DisplayName
// passed as the term search parameter.
func (s SqlTeamStore) SearchPrivate(term string) ([]*model.Team, error) {
	var teams []*model.Team

	term = sanitizeSearchTerm(term, "\\")
	term = wildcardSearchTerm(term)
	query := s.teamsQuery.Where(sq.Eq{"Type": "O", "AllowOpenInvite": false})
	if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
		query = query.Where(sq.Or{sq.Like{"Name": term}, sq.Like{"DisplayName": term}})
	} else {
		query = query.Where(sq.Or{sq.ILike{"Name": term}, sq.ILike{"DisplayName": term}})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}

	if _, err = s.GetReplica().Select(&teams, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to count Teams with term=%s", term)
	}
	return teams, nil
}

// GetAll returns all teams
func (s SqlTeamStore) GetAll() ([]*model.Team, error) {
	var teams []*model.Team

	query, args, err := s.teamsQuery.OrderBy("DisplayName").ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}

	_, err = s.GetReplica().Select(&teams, query, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Teams")
	}
	return teams, nil
}

// GetAllPage returns teams, up to a total limit passed as parameter and paginated by offset number passed as parameter.
func (s SqlTeamStore) GetAllPage(offset int, limit int) ([]*model.Team, error) {
	var teams []*model.Team

	query, args, err := s.teamsQuery.
		OrderBy("DisplayName").
		Limit(uint64(limit)).
		Offset(uint64(offset)).ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}
	if _, err = s.GetReplica().Select(&teams, query, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Teams")
	}

	return teams, nil
}

// GetTeamsByUserId returns from the database all teams that userId belongs to.
func (s SqlTeamStore) GetTeamsByUserId(userId string) ([]*model.Team, error) {
	var teams []*model.Team
	query, args, err := s.teamsQuery.
		Join("TeamMembers ON TeamMembers.TeamId = Teams.Id").
		Where(sq.Eq{"TeamMembers.UserId": userId, "TeamMembers.DeleteAt": 0, "Teams.DeleteAt": 0}).ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}

	if _, err = s.GetReplica().Select(&teams, query, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Teams")
	}

	return teams, nil
}

// GetAllPrivateTeamListing returns all private teams.
func (s SqlTeamStore) GetAllPrivateTeamListing() ([]*model.Team, error) {
	query, args, err := s.teamsQuery.Where(sq.Eq{"AllowOpenInvite": false}).
		OrderBy("DisplayName").ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}
	var data []*model.Team
	if _, err = s.GetReplica().Select(&data, query, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Teams")
	}
	return data, nil
}

// GetAllPublicTeamPageListing returns public teams, up to a total limit passed as parameter and paginated by offset number passed as parameter.
func (s SqlTeamStore) GetAllPublicTeamPageListing(offset int, limit int) ([]*model.Team, error) {
	query, args, err := s.teamsQuery.Where(sq.Eq{"AllowOpenInvite": true}).
		OrderBy("DisplayName").
		Limit(uint64(limit)).
		Offset(uint64(offset)).ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}

	var data []*model.Team
	if _, err = s.GetReplica().Select(&data, query, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Teams")
	}

	return data, nil
}

// GetAllPrivateTeamPageListing returns private teams, up to a total limit passed as paramater and paginated by offset number passed as parameter.
func (s SqlTeamStore) GetAllPrivateTeamPageListing(offset int, limit int) ([]*model.Team, error) {
	query, args, err := s.teamsQuery.Where(sq.Eq{"AllowOpenInvite": false}).
		OrderBy("DisplayName").
		Limit(uint64(limit)).
		Offset(uint64(offset)).ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}

	var data []*model.Team
	if _, err = s.GetReplica().Select(&data, query, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Teams")
	}

	return data, nil
}

// GetAllTeamListing returns all public teams.
func (s SqlTeamStore) GetAllTeamListing() ([]*model.Team, error) {
	query, args, err := s.teamsQuery.Where(sq.Eq{"AllowOpenInvite": true}).
		OrderBy("DisplayName").ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}

	var data []*model.Team
	if _, err = s.GetReplica().Select(&data, query, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Teams")
	}

	return data, nil
}

// GetAllTeamPageListing returns public teams, up to a total limit passed as parameter and paginated by offset number passed as parameter.
func (s SqlTeamStore) GetAllTeamPageListing(offset int, limit int) ([]*model.Team, error) {
	query, args, err := s.teamsQuery.Where(sq.Eq{"AllowOpenInvite": true}).
		OrderBy("DisplayName").
		Limit(uint64(limit)).
		Offset(uint64(offset)).ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}

	var teams []*model.Team
	if _, err = s.GetReplica().Select(&teams, query, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Teams")
	}

	return teams, nil
}

// PermanentDelete permanently deletes from the database the team entry that matches the teamId passed as parameter.
// To soft-delete the team you can Update it with the DeleteAt field set to the current millisecond using model.GetMillis()
func (s SqlTeamStore) PermanentDelete(teamId string) error {
	sql, args, err := s.getQueryBuilder().
		Delete("Teams").
		Where(sq.Eq{"Id": teamId}).ToSql()
	if err != nil {
		return errors.Wrap(err, "team_tosql")
	}
	if _, err = s.GetMaster().Exec(sql, args...); err != nil {
		return errors.Wrapf(err, "failed to delete Team with id=%s", teamId)
	}
	return nil
}

// AnalyticsPublicTeamCount returns the number of active public teams.
func (s SqlTeamStore) AnalyticsPublicTeamCount() (int64, error) {
	query, args, err := s.getQueryBuilder().
		Select("COUNT(*) FROM Teams").
		Where(sq.Eq{"DeleteAt": 0, "AllowOpenInvite": true}).ToSql()

	if err != nil {
		return 0, errors.Wrap(err, "team_tosql")
	}

	c, err := s.GetReplica().SelectInt(query, args...)

	if err != nil {
		return int64(0), errors.Wrap(err, "failed to count Teams")
	}

	return c, nil
}

// AnalyticsPrivateTeamCount returns the number of active private teams.
func (s SqlTeamStore) AnalyticsPrivateTeamCount() (int64, error) {
	query, args, err := s.getQueryBuilder().
		Select("COUNT(*) FROM Teams").
		Where(sq.Eq{"DeleteAt": 0, "AllowOpenInvite": false}).ToSql()

	if err != nil {
		return 0, errors.Wrap(err, "team_tosql")
	}
	c, err := s.GetReplica().SelectInt(query, args...)

	if err != nil {
		return int64(0), errors.Wrap(err, "failed to count Teams")
	}

	return c, nil
}

// AnalyticsTeamCount returns the total number of teams including deleted teams if parameter passed is set to 'true'.
func (s SqlTeamStore) AnalyticsTeamCount(includeDeleted bool) (int64, error) {
	query := s.getQueryBuilder().Select("COUNT(*) FROM Teams")
	if !includeDeleted {
		query = query.Where(sq.Eq{"DeleteAt": 0})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "team_tosql")
	}

	c, err := s.GetReplica().SelectInt(queryString, args...)

	if err != nil {
		return int64(0), errors.Wrap(err, "failed to count Teams")
	}

	return c, nil
}

func (s SqlTeamStore) getTeamMembersWithSchemeSelectQuery() sq.SelectBuilder {
	return s.getQueryBuilder().
		Select(
			"TeamMembers.*",
			"TeamScheme.DefaultTeamGuestRole TeamSchemeDefaultGuestRole",
			"TeamScheme.DefaultTeamUserRole TeamSchemeDefaultUserRole",
			"TeamScheme.DefaultTeamAdminRole TeamSchemeDefaultAdminRole",
		).
		From("TeamMembers").
		LeftJoin("Teams ON TeamMembers.TeamId = Teams.Id").
		LeftJoin("Schemes TeamScheme ON Teams.SchemeId = TeamScheme.Id")
}

func (s SqlTeamStore) SaveMultipleMembers(members []*model.TeamMember, maxUsersPerTeam int) ([]*model.TeamMember, error) {
	newTeamMembers := map[string]int{}
	users := map[string]bool{}
	for _, member := range members {
		newTeamMembers[member.TeamId] = 0
	}

	for _, member := range members {
		newTeamMembers[member.TeamId]++
		users[member.UserId] = true

		if err := member.IsValid(); err != nil {
			return nil, err
		}
	}

	teams := []string{}
	for team := range newTeamMembers {
		teams = append(teams, team)
	}

	defaultTeamRolesByTeam := map[string]struct {
		Id    string
		Guest sql.NullString
		User  sql.NullString
		Admin sql.NullString
	}{}

	queryRoles := s.getQueryBuilder().
		Select(
			"Teams.Id as Id",
			"TeamScheme.DefaultTeamGuestRole as Guest",
			"TeamScheme.DefaultTeamUserRole as User",
			"TeamScheme.DefaultTeamAdminRole as Admin",
		).
		From("Teams").
		LeftJoin("Schemes TeamScheme ON Teams.SchemeId = TeamScheme.Id").
		Where(sq.Eq{"Teams.Id": teams})

	sqlRolesQuery, argsRoles, err := queryRoles.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "team_roles_tosql")
	}
	var defaultTeamsRoles []struct {
		Id    string
		Guest sql.NullString
		User  sql.NullString
		Admin sql.NullString
	}
	_, err = s.GetMaster().Select(&defaultTeamsRoles, sqlRolesQuery, argsRoles...)
	if err != nil {
		return nil, errors.Wrap(err, "default_team_roles_select")
	}

	for _, defaultRoles := range defaultTeamsRoles {
		defaultTeamRolesByTeam[defaultRoles.Id] = defaultRoles
	}

	if maxUsersPerTeam >= 0 {
		queryCount := s.getQueryBuilder().
			Select(
				"COUNT(0) as Count, TeamMembers.TeamId as TeamId",
			).
			From("TeamMembers").
			Join("Users ON TeamMembers.UserId = Users.Id").
			Where(sq.Eq{"TeamMembers.TeamId": teams}).
			Where(sq.Eq{"TeamMembers.DeleteAt": 0}).
			Where(sq.Eq{"Users.DeleteAt": 0}).
			GroupBy("TeamMembers.TeamId")

		sqlCountQuery, argsCount, errCount := queryCount.ToSql()
		if errCount != nil {
			return nil, errors.Wrap(err, "member_count_tosql")
		}

		var counters []struct {
			Count  int    `db:"Count"`
			TeamId string `db:"TeamId"`
		}

		_, err = s.GetMaster().Select(&counters, sqlCountQuery, argsCount...)
		if err != nil {
			return nil, errors.Wrap(err, "failed to count users in the teams of the memberships")
		}

		for teamId, newMembers := range newTeamMembers {
			existingMembers := 0
			for _, counter := range counters {
				if counter.TeamId == teamId {
					existingMembers = counter.Count
				}
			}
			if existingMembers+newMembers > maxUsersPerTeam {
				return nil, store.NewErrLimitExceeded("TeamMember", existingMembers+newMembers, "team members limit exceeded")
			}
		}
	}

	query := s.getQueryBuilder().Insert("TeamMembers").Columns(teamMemberSliceColumns()...)
	for _, member := range members {
		query = query.Values(teamMemberToSlice(member)...)
	}

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "insert_members_to_sql")
	}

	if _, err = s.GetMaster().Exec(sql, args...); err != nil {
		if IsUniqueConstraintError(err, []string{"TeamId", "teammembers_pkey", "PRIMARY"}) {
			return nil, store.NewErrConflict("TeamMember", err, "")
		}
		return nil, errors.Wrap(err, "unable_to_save_team_member")
	}

	newMembers := []*model.TeamMember{}
	for _, member := range members {
		s.InvalidateAllTeamIdsForUser(member.UserId)
		defaultTeamGuestRole := defaultTeamRolesByTeam[member.TeamId].Guest.String
		defaultTeamUserRole := defaultTeamRolesByTeam[member.TeamId].User.String
		defaultTeamAdminRole := defaultTeamRolesByTeam[member.TeamId].Admin.String
		rolesResult := getTeamRoles(member.SchemeGuest, member.SchemeUser, member.SchemeAdmin, defaultTeamGuestRole, defaultTeamUserRole, defaultTeamAdminRole, strings.Fields(member.ExplicitRoles))
		newMember := *member
		newMember.SchemeGuest = rolesResult.schemeGuest
		newMember.SchemeUser = rolesResult.schemeUser
		newMember.SchemeAdmin = rolesResult.schemeAdmin
		newMember.Roles = strings.Join(rolesResult.roles, " ")
		newMember.ExplicitRoles = strings.Join(rolesResult.explicitRoles, " ")
		newMembers = append(newMembers, &newMember)
	}

	return newMembers, nil
}

func (s SqlTeamStore) SaveMember(member *model.TeamMember, maxUsersPerTeam int) (*model.TeamMember, error) {
	members, err := s.SaveMultipleMembers([]*model.TeamMember{member}, maxUsersPerTeam)
	if err != nil {
		return nil, err
	}
	return members[0], nil
}

func (s SqlTeamStore) UpdateMultipleMembers(members []*model.TeamMember) ([]*model.TeamMember, error) {
	teams := []string{}
	for _, member := range members {
		member.PreUpdate()

		if err := member.IsValid(); err != nil {
			return nil, err
		}

		if _, err := s.GetMaster().Update(NewTeamMemberFromModel(member)); err != nil {
			return nil, errors.Wrap(err, "failed to update TeamMember")
		}
		teams = append(teams, member.TeamId)
	}

	query := s.getQueryBuilder().
		Select(
			"Teams.Id as Id",
			"TeamScheme.DefaultTeamGuestRole as Guest",
			"TeamScheme.DefaultTeamUserRole as User",
			"TeamScheme.DefaultTeamAdminRole as Admin",
		).
		From("Teams").
		LeftJoin("Schemes TeamScheme ON Teams.SchemeId = TeamScheme.Id").
		Where(sq.Eq{"Teams.Id": teams})

	sqlQuery, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}
	var defaultTeamsRoles []struct {
		Id    string
		Guest sql.NullString
		User  sql.NullString
		Admin sql.NullString
	}
	_, err = s.GetMaster().Select(&defaultTeamsRoles, sqlQuery, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Teams")
	}

	defaultTeamRolesByTeam := map[string]struct {
		Id    string
		Guest sql.NullString
		User  sql.NullString
		Admin sql.NullString
	}{}
	for _, defaultRoles := range defaultTeamsRoles {
		defaultTeamRolesByTeam[defaultRoles.Id] = defaultRoles
	}

	updatedMembers := []*model.TeamMember{}
	for _, member := range members {
		s.InvalidateAllTeamIdsForUser(member.UserId)
		defaultTeamGuestRole := defaultTeamRolesByTeam[member.TeamId].Guest.String
		defaultTeamUserRole := defaultTeamRolesByTeam[member.TeamId].User.String
		defaultTeamAdminRole := defaultTeamRolesByTeam[member.TeamId].Admin.String
		rolesResult := getTeamRoles(member.SchemeGuest, member.SchemeUser, member.SchemeAdmin, defaultTeamGuestRole, defaultTeamUserRole, defaultTeamAdminRole, strings.Fields(member.ExplicitRoles))
		updatedMember := *member
		updatedMember.SchemeGuest = rolesResult.schemeGuest
		updatedMember.SchemeUser = rolesResult.schemeUser
		updatedMember.SchemeAdmin = rolesResult.schemeAdmin
		updatedMember.Roles = strings.Join(rolesResult.roles, " ")
		updatedMember.ExplicitRoles = strings.Join(rolesResult.explicitRoles, " ")
		updatedMembers = append(updatedMembers, &updatedMember)
	}

	return updatedMembers, nil
}

func (s SqlTeamStore) UpdateMember(member *model.TeamMember) (*model.TeamMember, error) {
	members, err := s.UpdateMultipleMembers([]*model.TeamMember{member})
	if err != nil {
		return nil, err
	}
	return members[0], nil
}

// GetMember returns a single member of the team that matches the teamId and userId provided as parameters.
func (s SqlTeamStore) GetMember(ctx context.Context, teamId string, userId string) (*model.TeamMember, error) {
	query := s.getTeamMembersWithSchemeSelectQuery().
		Where(sq.Eq{"TeamMembers.TeamId": teamId}).
		Where(sq.Eq{"TeamMembers.UserId": userId})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}

	var dbMember teamMemberWithSchemeRoles
	err = s.DBFromContext(ctx).SelectOne(&dbMember, queryString, args...)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("TeamMember", fmt.Sprintf("teamId=%s, userId=%s", teamId, userId))
		}
		return nil, errors.Wrapf(err, "failed to find TeamMembers with teamId=%s and userId=%s", teamId, userId)
	}

	return dbMember.ToModel(), nil
}

// GetMembers returns a list of members from the database that matches the teamId passed as parameter and,
// also expects teamMembersGetOptions to be passed as a parameter which allows to further filter what to show in the result.
// TeamMembersGetOptions Model has following options->
// 1. Sort through USERNAME [ if provided, which otherwise defaults to ID ]
// 2. Sort through USERNAME [ if provided, which otherwise defaults to ID ] and exclude deleted members.
// 3. Return all the members but, exclude deleted ones.
// 4. Apply ViewUsersRestrictions to restrict what is visible to the user.
func (s SqlTeamStore) GetMembers(teamId string, offset int, limit int, teamMembersGetOptions *model.TeamMembersGetOptions) ([]*model.TeamMember, error) {
	query := s.getTeamMembersWithSchemeSelectQuery().
		Where(sq.Eq{"TeamMembers.TeamId": teamId}).
		Where(sq.Eq{"TeamMembers.DeleteAt": 0}).
		Limit(uint64(limit)).
		Offset(uint64(offset))

	if teamMembersGetOptions == nil || teamMembersGetOptions.Sort == "" {
		query = query.OrderBy("UserId")
	}

	if teamMembersGetOptions != nil {
		if teamMembersGetOptions.Sort == model.USERNAME || teamMembersGetOptions.ExcludeDeletedUsers {
			query = query.LeftJoin("Users ON TeamMembers.UserId = Users.Id")
		}

		if teamMembersGetOptions.ExcludeDeletedUsers {
			query = query.Where(sq.Eq{"Users.DeleteAt": 0})
		}

		if teamMembersGetOptions.Sort == model.USERNAME {
			query = query.OrderBy(model.USERNAME)
		}

		query = applyTeamMemberViewRestrictionsFilter(query, teamMembersGetOptions.ViewRestrictions)
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}

	var dbMembers teamMemberWithSchemeRolesList
	_, err = s.GetReplica().Select(&dbMembers, queryString, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find TeamMembers with teamId=%s", teamId)
	}

	return dbMembers.ToModel(), nil
}

// GetTotalMemberCount returns the number of all members in a team for the teamId passed as a parameter.
// Expects a restrictions parameter of type ViewUsersRestrictions that defines a set of Teams and Channels that are visible to the caller of the query, and applies restrictions with a filtered result.
func (s SqlTeamStore) GetTotalMemberCount(teamId string, restrictions *model.ViewUsersRestrictions) (int64, error) {
	query := s.getQueryBuilder().
		Select("count(DISTINCT TeamMembers.UserId)").
		From("TeamMembers, Users").
		Where("TeamMembers.DeleteAt = 0").
		Where("TeamMembers.UserId = Users.Id").
		Where(sq.Eq{"TeamMembers.TeamId": teamId})

	query = applyTeamMemberViewRestrictionsFilterForStats(query, restrictions)
	queryString, args, err := query.ToSql()
	if err != nil {
		return int64(0), errors.Wrap(err, "team_tosql")
	}

	count, err := s.GetReplica().SelectInt(queryString, args...)
	if err != nil {
		return int64(0), errors.Wrap(err, "failed to count TeamMembers")
	}
	return count, nil
}

// GetActiveMemberCount returns the number of active members in a team for the teamId passed as a parameter i.e. members with 'DeleteAt = 0'
// Expects a restrictions parameter of type ViewUsersRestrictions that defines a set of Teams and Channels that are visible to the caller of the query, and applies restrictions with a filtered result.
func (s SqlTeamStore) GetActiveMemberCount(teamId string, restrictions *model.ViewUsersRestrictions) (int64, error) {
	query := s.getQueryBuilder().
		Select("count(DISTINCT TeamMembers.UserId)").
		From("TeamMembers, Users").
		Where("TeamMembers.DeleteAt = 0").
		Where("TeamMembers.UserId = Users.Id").
		Where("Users.DeleteAt = 0").
		Where(sq.Eq{"TeamMembers.TeamId": teamId})

	query = applyTeamMemberViewRestrictionsFilterForStats(query, restrictions)
	queryString, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "team_tosql")
	}

	count, err := s.GetReplica().SelectInt(queryString, args...)
	if err != nil {
		return 0, errors.Wrap(err, "failed to count TeamMembers")
	}

	return count, nil
}

// GetMembersByIds returns a list of members from the database that matches the teamId and the list of userIds passed as parameters.
// Expects a restrictions parameter of type ViewUsersRestrictions that defines a set of Teams and Channels that are visible to the caller of the query, and applies restrictions with a filtered result.
func (s SqlTeamStore) GetMembersByIds(teamId string, userIds []string, restrictions *model.ViewUsersRestrictions) ([]*model.TeamMember, error) {
	if len(userIds) == 0 {
		return nil, errors.New("invalid list of user ids")
	}

	query := s.getTeamMembersWithSchemeSelectQuery().
		Where(sq.Eq{"TeamMembers.TeamId": teamId}).
		Where(sq.Eq{"TeamMembers.UserId": userIds}).
		Where(sq.Eq{"TeamMembers.DeleteAt": 0})

	query = applyTeamMemberViewRestrictionsFilter(query, restrictions)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}

	var dbMembers teamMemberWithSchemeRolesList
	if _, err = s.GetReplica().Select(&dbMembers, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find TeamMembers")
	}
	return dbMembers.ToModel(), nil
}

// GetTeamsForUser returns a list of teams that the user is a member of. Expects userId to be passed as a parameter.
func (s SqlTeamStore) GetTeamsForUser(ctx context.Context, userId string) ([]*model.TeamMember, error) {
	query := s.getTeamMembersWithSchemeSelectQuery().
		Where(sq.Eq{"TeamMembers.UserId": userId})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}

	var dbMembers teamMemberWithSchemeRolesList
	_, err = s.SqlStore.DBFromContext(ctx).Select(&dbMembers, queryString, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find TeamMembers with userId=%s", userId)
	}

	return dbMembers.ToModel(), nil
}

// GetTeamsForUserWithPagination returns limited TeamMembers according to the perPage parameter specified.
// It also offsets the records as per the page parameter supplied.
func (s SqlTeamStore) GetTeamsForUserWithPagination(userId string, page, perPage int) ([]*model.TeamMember, error) {
	query := s.getTeamMembersWithSchemeSelectQuery().
		Where(sq.Eq{"TeamMembers.UserId": userId}).
		Limit(uint64(perPage)).
		Offset(uint64(page * perPage))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}

	var dbMembers teamMemberWithSchemeRolesList
	_, err = s.GetReplica().Select(&dbMembers, queryString, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find TeamMembers with userId=%s", userId)
	}

	return dbMembers.ToModel(), nil
}

// GetChannelUnreadsForAllTeams returns unreads msg count, mention counts, and notifyProps
// for all the channels in all the teams except the excluded ones.
func (s SqlTeamStore) GetChannelUnreadsForAllTeams(excludeTeamId, userId string) ([]*model.ChannelUnread, error) {
	query, args, err := s.getQueryBuilder().
		Select("Channels.TeamId TeamId", "Channels.Id ChannelId", "(Channels.TotalMsgCount - ChannelMembers.MsgCount) MsgCount", "(Channels.TotalMsgCountRoot - ChannelMembers.MsgCountRoot) MsgCountRoot", "ChannelMembers.MentionCount MentionCount", "ChannelMembers.MentionCountRoot MentionCountRoot", "ChannelMembers.NotifyProps NotifyProps").
		From("Channels").
		Join("ChannelMembers ON Id = ChannelId").
		Where(sq.Eq{"UserId": userId, "DeleteAt": 0}).
		Where(sq.NotEq{"TeamId": excludeTeamId}).ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}
	var data []*model.ChannelUnread
	_, err = s.GetReplica().Select(&data, query, args...)

	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Channels with userId=%s and teamId!=%s", userId, excludeTeamId)
	}

	return data, nil
}

// GetChannelUnreadsForTeam returns unreads msg count, mention counts and notifyProps for all the channels in a single team.
func (s SqlTeamStore) GetChannelUnreadsForTeam(teamId, userId string) ([]*model.ChannelUnread, error) {
	query, args, err := s.getQueryBuilder().
		Select("Channels.TeamId TeamId", "Channels.Id ChannelId", "(Channels.TotalMsgCount - ChannelMembers.MsgCount) MsgCount", "(Channels.TotalMsgCountRoot - ChannelMembers.MsgCountRoot) MsgCountRoot", "ChannelMembers.MentionCount MentionCount", "ChannelMembers.MentionCountRoot MentionCountRoot", "ChannelMembers.NotifyProps NotifyProps").
		From("Channels").
		Join("ChannelMembers ON Id = ChannelId").
		Where(sq.Eq{"UserId": userId, "TeamId": teamId, "DeleteAt": 0}).ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}

	var channels []*model.ChannelUnread
	_, err = s.GetReplica().Select(&channels, query, args...)

	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Channels with teamId=%s and userId=%s", teamId, userId)
	}
	return channels, nil
}

func (s SqlTeamStore) RemoveMembers(teamId string, userIds []string) error {
	builder := s.getQueryBuilder().
		Delete("TeamMembers").
		Where(sq.Eq{"TeamId": teamId}).
		Where(sq.Eq{"UserId": userIds})

	query, args, err := builder.ToSql()
	if err != nil {
		return errors.Wrap(err, "team_tosql")
	}
	_, err = s.GetMaster().Exec(query, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to delete TeamMembers with teamId=%s and userId in %v", teamId, userIds)
	}
	return nil
}

// RemoveMember remove from the database the team members that match the userId and teamId passed as parameter.
func (s SqlTeamStore) RemoveMember(teamId string, userId string) error {
	return s.RemoveMembers(teamId, []string{userId})
}

// RemoveAllMembersByTeam removes from the database the team members that belong to the teamId passed as parameter.
func (s SqlTeamStore) RemoveAllMembersByTeam(teamId string) error {
	query, args, err := s.getQueryBuilder().
		Delete("TeamMembers").
		Where(sq.Eq{"TeamId": teamId}).ToSql()
	if err != nil {
		return errors.Wrap(err, "team_tosql")
	}

	_, err = s.GetMaster().Exec(query, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to delete TeamMembers with teamId=%s", teamId)
	}
	return nil
}

// RemoveAllMembersByUser removes from the database the team members that match the userId passed as parameter.
func (s SqlTeamStore) RemoveAllMembersByUser(userId string) error {
	query, args, err := s.getQueryBuilder().
		Delete("TeamMembers").
		Where(sq.Eq{"UserId": userId}).ToSql()
	if err != nil {
		return errors.Wrap(err, "team_tosql")
	}
	_, err = s.GetMaster().Exec(query, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to delete TeamMembers with userId=%s", userId)
	}
	return nil
}

// UpdateLastTeamIconUpdate sets the last updated time for the icon based on the parameter passed in teamId. The
// LastTeamIconUpdate and UpdateAt fields are set to the parameter passed in curTime. Returns nil on success and an error
// otherwise.
func (s SqlTeamStore) UpdateLastTeamIconUpdate(teamId string, curTime int64) error {
	query, args, err := s.getQueryBuilder().
		Update("Teams").
		SetMap(sq.Eq{"LastTeamIconUpdate": curTime, "UpdateAt": curTime}).
		Where(sq.Eq{"Id": teamId}).ToSql()
	if err != nil {
		return errors.Wrap(err, "team_tosql")
	}

	if _, err = s.GetMaster().Exec(query, args...); err != nil {
		return errors.Wrap(err, "failed to update Team")
	}
	return nil
}

// GetTeamsByScheme returns from the database all teams that match the schemeId provided as parameter, up to
// a total limit passed as paramater and paginated by offset number passed as parameter.
func (s SqlTeamStore) GetTeamsByScheme(schemeId string, offset int, limit int) ([]*model.Team, error) {
	query, args, err := s.teamsQuery.Where(sq.Eq{"SchemeId": schemeId}).
		OrderBy("DisplayName").
		Limit(uint64(limit)).
		Offset(uint64(offset)).ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}

	var teams []*model.Team
	_, err = s.GetReplica().Select(&teams, query, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Teams with schemeId=%s", schemeId)
	}
	return teams, nil
}

// MigrateTeamMembers performs the Advanced Permissions Phase 2 migration for TeamMember objects. Migration is done
// in batches as a single transaction per batch to ensure consistency but to also minimise execution time to avoid
// causing unnecessary table locks. **THIS FUNCTION SHOULD NOT BE USED FOR ANY OTHER PURPOSE.** Executing this function
// *after* the new Schemes functionality has been used on an installation will have unintended consequences.
func (s SqlTeamStore) MigrateTeamMembers(fromTeamId string, fromUserId string) (map[string]string, error) {
	var transaction *gorp.Transaction
	var err error

	if transaction, err = s.GetMaster().Begin(); err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransaction(transaction)

	var teamMembers []teamMember
	if _, err := transaction.Select(&teamMembers, "SELECT * from TeamMembers WHERE (TeamId, UserId) > (:FromTeamId, :FromUserId) ORDER BY TeamId, UserId LIMIT 100", map[string]interface{}{"FromTeamId": fromTeamId, "FromUserId": fromUserId}); err != nil {
		return nil, errors.Wrap(err, "failed to find TeamMembers")
	}

	if len(teamMembers) == 0 {
		// No more team members in query result means that the migration has finished.
		return nil, nil
	}

	for i := range teamMembers {
		member := teamMembers[i]
		roles := strings.Fields(member.Roles)
		var newRoles []string
		if !member.SchemeAdmin.Valid {
			member.SchemeAdmin = sql.NullBool{Bool: false, Valid: true}
		}
		if !member.SchemeUser.Valid {
			member.SchemeUser = sql.NullBool{Bool: false, Valid: true}
		}
		if !member.SchemeGuest.Valid {
			member.SchemeGuest = sql.NullBool{Bool: false, Valid: true}
		}
		for _, role := range roles {
			if role == model.TEAM_ADMIN_ROLE_ID {
				member.SchemeAdmin = sql.NullBool{Bool: true, Valid: true}
			} else if role == model.TEAM_USER_ROLE_ID {
				member.SchemeUser = sql.NullBool{Bool: true, Valid: true}
			} else if role == model.TEAM_GUEST_ROLE_ID {
				member.SchemeGuest = sql.NullBool{Bool: true, Valid: true}
			} else {
				newRoles = append(newRoles, role)
			}
		}
		member.Roles = strings.Join(newRoles, " ")

		if _, err := transaction.Update(&member); err != nil {
			return nil, errors.Wrap(err, "failed to update TeamMember")
		}

	}

	if err := transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}

	data := make(map[string]string)
	data["TeamId"] = teamMembers[len(teamMembers)-1].TeamId
	data["UserId"] = teamMembers[len(teamMembers)-1].UserId

	return data, nil
}

// ResetAllTeamSchemes Set all Team's SchemeId values to an empty string.
func (s SqlTeamStore) ResetAllTeamSchemes() error {
	if _, err := s.GetMaster().Exec("UPDATE Teams SET SchemeId=''"); err != nil {
		return errors.Wrap(err, "failed to update Teams")
	}
	return nil
}

// ClearCaches method not implemented.
func (s SqlTeamStore) ClearCaches() {}

// InvalidateAllTeamIdsForUser does not execute anything because the store does not handle the cache.
//nolint:unparam
func (s SqlTeamStore) InvalidateAllTeamIdsForUser(userId string) {}

// ClearAllCustomRoleAssignments removes all custom role assignments from TeamMembers.
func (s SqlTeamStore) ClearAllCustomRoleAssignments() error {

	builtInRoles := model.MakeDefaultRoles()
	lastUserId := strings.Repeat("0", 26)
	lastTeamId := strings.Repeat("0", 26)

	for {
		var transaction *gorp.Transaction
		var err error

		if transaction, err = s.GetMaster().Begin(); err != nil {
			return errors.Wrap(err, "begin_transaction")
		}
		defer finalizeTransaction(transaction)

		var teamMembers []*teamMember
		if _, err := transaction.Select(&teamMembers, "SELECT * from TeamMembers WHERE (TeamId, UserId) > (:TeamId, :UserId) ORDER BY TeamId, UserId LIMIT 1000", map[string]interface{}{"TeamId": lastTeamId, "UserId": lastUserId}); err != nil {
			return errors.Wrap(err, "failed to find TeamMembers")
		}

		if len(teamMembers) == 0 {
			break
		}

		for _, member := range teamMembers {
			lastUserId = member.UserId
			lastTeamId = member.TeamId

			var newRoles []string

			for _, role := range strings.Fields(member.Roles) {
				for name := range builtInRoles {
					if name == role {
						newRoles = append(newRoles, role)
						break
					}
				}
			}

			newRolesString := strings.Join(newRoles, " ")
			if newRolesString != member.Roles {
				if _, err := transaction.Exec("UPDATE TeamMembers SET Roles = :Roles WHERE UserId = :UserId AND TeamId = :TeamId", map[string]interface{}{"Roles": newRolesString, "TeamId": member.TeamId, "UserId": member.UserId}); err != nil {
					return errors.Wrap(err, "failed to update TeamMembers")
				}
			}
		}

		if err := transaction.Commit(); err != nil {
			return errors.Wrap(err, "commit_transaction")
		}
	}
	return nil
}

// AnalyticsGetTeamCountForScheme returns the number of active teams that match the schemeId passed as parameter.
func (s SqlTeamStore) AnalyticsGetTeamCountForScheme(schemeId string) (int64, error) {
	query, args, err := s.getQueryBuilder().
		Select("count(*)").
		From("Teams").
		Where(sq.Eq{"SchemeId": schemeId, "DeleteAt": 0}).ToSql()

	if err != nil {
		return 0, errors.Wrap(err, "team_tosql")
	}
	count, err := s.GetReplica().SelectInt(query, args...)
	if err != nil {
		return 0, errors.Wrapf(err, "failed to count Teams with schemdId=%s", schemeId)
	}

	return count, nil
}

// GetAllForExportAfter returns teams for export, up to a total limit passed as paramater where Teams.Id is greater than the afterId passed as parameter.
func (s SqlTeamStore) GetAllForExportAfter(limit int, afterId string) ([]*model.TeamForExport, error) {
	var data []*model.TeamForExport
	query, args, err := s.getQueryBuilder().
		Select("Teams.*", "Schemes.Name as SchemeName").
		From("Teams").
		LeftJoin("Schemes ON Teams.SchemeId = Schemes.Id").
		Where(sq.Gt{"Teams.Id": afterId}).
		OrderBy("Id").
		Limit(uint64(limit)).ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}
	if _, err = s.GetReplica().Select(&data, query, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Teams")
	}

	return data, nil
}

// GetUserTeamIds get the team ids to which the user belongs to. allowFromCache parameter does not have any effect in this Store
//nolint:unparam
func (s SqlTeamStore) GetUserTeamIds(userId string, allowFromCache bool) ([]string, error) {
	var teamIds []string
	query, args, err := s.getQueryBuilder().
		Select("TeamId").
		From("TeamMembers").
		Join("Teams ON TeamMembers.TeamId = Teams.Id").
		Where(sq.Eq{"TeamMembers.UserId": userId, "TeamMembers.DeleteAt": 0, "Teams.DeleteAt": 0}).ToSql()

	if err != nil {
		return []string{}, errors.Wrap(err, "team_tosql")
	}
	_, err = s.GetReplica().Select(&teamIds, query, args...)
	if err != nil {
		return []string{}, errors.Wrapf(err, "failed to find TeamMembers with userId=%s", userId)
	}

	return teamIds, nil
}

// GetTeamMembersForExport gets the various teams for which a user, denoted by userId, is a part of.
func (s SqlTeamStore) GetTeamMembersForExport(userId string) ([]*model.TeamMemberForExport, error) {
	var members []*model.TeamMemberForExport
	query, args, err := s.getQueryBuilder().
		Select("TeamMembers.TeamId", "TeamMembers.UserId", "TeamMembers.Roles", "TeamMembers.DeleteAt",
			"(TeamMembers.SchemeGuest IS NOT NULL AND TeamMembers.SchemeGuest) as SchemeGuest",
			"TeamMembers.SchemeUser", "TeamMembers.SchemeAdmin", "Teams.Name as TeamName").
		From("TeamMembers").
		Join("Teams ON TeamMembers.TeamId = Teams.Id").
		Where(sq.Eq{"TeamMembers.UserId": userId, "Teams.DeleteAt": 0}).ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "team_tosql")
	}
	_, err = s.GetReplica().Select(&members, query, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find TeamMembers with userId=%s", userId)
	}
	return members, nil
}

//UserBelongsToTeams returns true if the user denoted by userId is a member of the teams in the teamIds string array.
func (s SqlTeamStore) UserBelongsToTeams(userId string, teamIds []string) (bool, error) {
	idQuery := sq.Eq{
		"UserId":   userId,
		"TeamId":   teamIds,
		"DeleteAt": 0,
	}

	query, params, err := s.getQueryBuilder().Select("Count(*)").From("TeamMembers").Where(idQuery).ToSql()
	if err != nil {
		return false, errors.Wrap(err, "team_tosql")
	}

	c, err := s.GetReplica().SelectInt(query, params...)
	if err != nil {
		return false, errors.Wrap(err, "failed to count TeamMembers")
	}

	return c > 0, nil
}

// UpdateMembersRole updates all the members of teamID in the userIds string array to be admins and sets all other
// users as not being admin.
func (s SqlTeamStore) UpdateMembersRole(teamID string, userIDs []string) error {
	query, args, err := s.getQueryBuilder().
		Update("TeamMembers").
		Set("SchemeAdmin", sq.Case().When(sq.Eq{"UserId": userIDs}, "true").Else("false")).
		Where(sq.Eq{"TeamId": teamID, "DeleteAt": 0}).
		Where(sq.Or{sq.Eq{"SchemeGuest": false}, sq.Expr("SchemeGuest IS NULL")}).ToSql()
	if err != nil {
		return errors.Wrap(err, "team_tosql")
	}

	if _, err = s.GetMaster().Exec(query, args...); err != nil {
		return errors.Wrap(err, "failed to update TeamMembers")
	}

	return nil
}

func applyTeamMemberViewRestrictionsFilter(query sq.SelectBuilder, restrictions *model.ViewUsersRestrictions) sq.SelectBuilder {
	if restrictions == nil {
		return query
	}

	// If you have no access to teams or channels, return and empty result.
	if restrictions.Teams != nil && len(restrictions.Teams) == 0 && restrictions.Channels != nil && len(restrictions.Channels) == 0 {
		return query.Where("1 = 0")
	}

	teams := make([]interface{}, len(restrictions.Teams))
	for i, v := range restrictions.Teams {
		teams[i] = v
	}
	channels := make([]interface{}, len(restrictions.Channels))
	for i, v := range restrictions.Channels {
		channels[i] = v
	}

	resultQuery := query.Join("Users ru ON (TeamMembers.UserId = ru.Id)")
	if restrictions.Teams != nil && len(restrictions.Teams) > 0 {
		resultQuery = resultQuery.Join(fmt.Sprintf("TeamMembers rtm ON ( rtm.UserId = ru.Id AND rtm.DeleteAt = 0 AND rtm.TeamId IN (%s))", sq.Placeholders(len(teams))), teams...)
	}
	if restrictions.Channels != nil && len(restrictions.Channels) > 0 {
		resultQuery = resultQuery.Join(fmt.Sprintf("ChannelMembers rcm ON ( rcm.UserId = ru.Id AND rcm.ChannelId IN (%s))", sq.Placeholders(len(channels))), channels...)
	}

	return resultQuery.Distinct()
}

func applyTeamMemberViewRestrictionsFilterForStats(query sq.SelectBuilder, restrictions *model.ViewUsersRestrictions) sq.SelectBuilder {
	if restrictions == nil {
		return query
	}

	// If you have no access to teams or channels, return and empty result.
	if restrictions.Teams != nil && len(restrictions.Teams) == 0 && restrictions.Channels != nil && len(restrictions.Channels) == 0 {
		return query.Where("1 = 0")
	}

	teams := make([]interface{}, len(restrictions.Teams))
	for i, v := range restrictions.Teams {
		teams[i] = v
	}
	channels := make([]interface{}, len(restrictions.Channels))
	for i, v := range restrictions.Channels {
		channels[i] = v
	}

	resultQuery := query
	if restrictions.Teams != nil && len(restrictions.Teams) > 0 {
		resultQuery = resultQuery.Join(fmt.Sprintf("TeamMembers rtm ON ( rtm.UserId = Users.Id AND rtm.DeleteAt = 0 AND rtm.TeamId IN (%s))", sq.Placeholders(len(teams))), teams...)
	}
	if restrictions.Channels != nil && len(restrictions.Channels) > 0 {
		resultQuery = resultQuery.Join(fmt.Sprintf("ChannelMembers rcm ON ( rcm.UserId = Users.Id AND rcm.ChannelId IN (%s))", sq.Placeholders(len(channels))), channels...)
	}

	return resultQuery
}

// GroupSyncedTeamCount returns the number of teams that are group constrained.
func (s SqlTeamStore) GroupSyncedTeamCount() (int64, error) {
	builder := s.getQueryBuilder().Select("COUNT(*)").From("Teams").Where(sq.Eq{"GroupConstrained": true, "DeleteAt": 0})

	query, args, err := builder.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "team_tosql")
	}

	count, err := s.GetReplica().SelectInt(query, args...)
	if err != nil {
		return 0, errors.Wrap(err, "failed to count Teams")
	}

	return count, nil
}
