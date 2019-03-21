// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
)

const (
	TEAM_MEMBER_EXISTS_ERROR         = "store.sql_team.save_member.exists.app_error"
	ALL_TEAM_IDS_FOR_USER_CACHE_SIZE = model.SESSION_CACHE_SIZE
	ALL_TEAM_IDS_FOR_USER_CACHE_SEC  = 1800 // 30 mins
)

type SqlTeamStore struct {
	SqlStore
	metrics einterfaces.MetricsInterface
}

type teamMember struct {
	TeamId      string
	UserId      string
	Roles       string
	DeleteAt    int64
	SchemeUser  sql.NullBool
	SchemeAdmin sql.NullBool
}

func NewTeamMemberFromModel(tm *model.TeamMember) *teamMember {
	return &teamMember{
		TeamId:      tm.TeamId,
		UserId:      tm.UserId,
		Roles:       tm.ExplicitRoles,
		DeleteAt:    tm.DeleteAt,
		SchemeUser:  sql.NullBool{Valid: true, Bool: tm.SchemeUser},
		SchemeAdmin: sql.NullBool{Valid: true, Bool: tm.SchemeAdmin},
	}
}

type teamMemberWithSchemeRoles struct {
	TeamId                     string
	UserId                     string
	Roles                      string
	DeleteAt                   int64
	SchemeUser                 sql.NullBool
	SchemeAdmin                sql.NullBool
	TeamSchemeDefaultUserRole  sql.NullString
	TeamSchemeDefaultAdminRole sql.NullString
}

type teamMemberWithSchemeRolesList []teamMemberWithSchemeRoles

func (db teamMemberWithSchemeRoles) ToModel() *model.TeamMember {
	var roles []string
	var explicitRoles []string

	// Identify any scheme derived roles that are in "Roles" field due to not yet being migrated, and exclude
	// them from ExplicitRoles field.
	schemeUser := db.SchemeUser.Valid && db.SchemeUser.Bool
	schemeAdmin := db.SchemeAdmin.Valid && db.SchemeAdmin.Bool
	for _, role := range strings.Fields(db.Roles) {
		isImplicit := false
		if role == model.TEAM_USER_ROLE_ID {
			// We have an implicit role via the system scheme. Override the "schemeUser" field to true.
			schemeUser = true
			isImplicit = true
		} else if role == model.TEAM_ADMIN_ROLE_ID {
			// We have an implicit role via the system scheme.
			schemeAdmin = true
			isImplicit = true
		}

		if !isImplicit {
			explicitRoles = append(explicitRoles, role)
		}
		roles = append(roles, role)
	}

	// Add any scheme derived roles that are not in the Roles field due to being Implicit from the Scheme, and add
	// them to the Roles field for backwards compatibility reasons.
	var schemeImpliedRoles []string
	if db.SchemeUser.Valid && db.SchemeUser.Bool {
		if db.TeamSchemeDefaultUserRole.Valid && db.TeamSchemeDefaultUserRole.String != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, db.TeamSchemeDefaultUserRole.String)
		} else {
			schemeImpliedRoles = append(schemeImpliedRoles, model.TEAM_USER_ROLE_ID)
		}
	}
	if db.SchemeAdmin.Valid && db.SchemeAdmin.Bool {
		if db.TeamSchemeDefaultAdminRole.Valid && db.TeamSchemeDefaultAdminRole.String != "" {
			schemeImpliedRoles = append(schemeImpliedRoles, db.TeamSchemeDefaultAdminRole.String)
		} else {
			schemeImpliedRoles = append(schemeImpliedRoles, model.TEAM_ADMIN_ROLE_ID)
		}
	}
	for _, impliedRole := range schemeImpliedRoles {
		alreadyThere := false
		for _, role := range roles {
			if role == impliedRole {
				alreadyThere = true
			}
		}
		if !alreadyThere {
			roles = append(roles, impliedRole)
		}
	}

	tm := &model.TeamMember{
		TeamId:        db.TeamId,
		UserId:        db.UserId,
		Roles:         strings.Join(roles, " "),
		DeleteAt:      db.DeleteAt,
		SchemeUser:    schemeUser,
		SchemeAdmin:   schemeAdmin,
		ExplicitRoles: strings.Join(explicitRoles, " "),
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

func NewSqlTeamStore(sqlStore SqlStore, metrics einterfaces.MetricsInterface) store.TeamStore {
	s := &SqlTeamStore{
		sqlStore,
		metrics,
	}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Team{}, "Teams").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("DisplayName").SetMaxSize(64)
		table.ColMap("Name").SetMaxSize(64).SetUnique(true)
		table.ColMap("Description").SetMaxSize(255)
		table.ColMap("Email").SetMaxSize(128)
		table.ColMap("CompanyName").SetMaxSize(64)
		table.ColMap("AllowedDomains").SetMaxSize(500)
		table.ColMap("InviteId").SetMaxSize(32)

		tablem := db.AddTableWithName(teamMember{}, "TeamMembers").SetKeys(false, "TeamId", "UserId")
		tablem.ColMap("TeamId").SetMaxSize(26)
		tablem.ColMap("UserId").SetMaxSize(26)
		tablem.ColMap("Roles").SetMaxSize(64)
	}

	return s
}

func (s SqlTeamStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_teams_name", "Teams", "Name")
	s.RemoveIndexIfExists("idx_teams_description", "Teams")
	s.CreateIndexIfNotExists("idx_teams_invite_id", "Teams", "InviteId")
	s.CreateIndexIfNotExists("idx_teams_update_at", "Teams", "UpdateAt")
	s.CreateIndexIfNotExists("idx_teams_create_at", "Teams", "CreateAt")
	s.CreateIndexIfNotExists("idx_teams_delete_at", "Teams", "DeleteAt")

	s.CreateIndexIfNotExists("idx_teammembers_team_id", "TeamMembers", "TeamId")
	s.CreateIndexIfNotExists("idx_teammembers_user_id", "TeamMembers", "UserId")
	s.CreateIndexIfNotExists("idx_teammembers_delete_at", "TeamMembers", "DeleteAt")
}

func (s SqlTeamStore) Save(team *model.Team) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if len(team.Id) > 0 {
			result.Err = model.NewAppError("SqlTeamStore.Save",
				"store.sql_team.save.existing.app_error", nil, "id="+team.Id, http.StatusBadRequest)
			return
		}

		team.PreSave()

		if result.Err = team.IsValid(); result.Err != nil {
			return
		}

		if err := s.GetMaster().Insert(team); err != nil {
			if IsUniqueConstraintError(err, []string{"Name", "teams_name_key"}) {
				result.Err = model.NewAppError("SqlTeamStore.Save", "store.sql_team.save.domain_exists.app_error", nil, "id="+team.Id+", "+err.Error(), http.StatusBadRequest)
				return
			}
			result.Err = model.NewAppError("SqlTeamStore.Save", "store.sql_team.save.app_error", nil, "id="+team.Id+", "+err.Error(), http.StatusInternalServerError)
			return
		}
		result.Data = team
	})
}

func (s SqlTeamStore) Update(team *model.Team) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		team.PreUpdate()

		if result.Err = team.IsValid(); result.Err != nil {
			return
		}

		oldResult, err := s.GetMaster().Get(model.Team{}, team.Id)
		if err != nil {
			result.Err = model.NewAppError("SqlTeamStore.Update", "store.sql_team.update.finding.app_error", nil, "id="+team.Id+", "+err.Error(), http.StatusInternalServerError)
			return
		}

		if oldResult == nil {
			result.Err = model.NewAppError("SqlTeamStore.Update", "store.sql_team.update.find.app_error", nil, "id="+team.Id, http.StatusBadRequest)
			return
		}

		oldTeam := oldResult.(*model.Team)
		team.CreateAt = oldTeam.CreateAt
		team.UpdateAt = model.GetMillis()

		count, err := s.GetMaster().Update(team)
		if err != nil {
			result.Err = model.NewAppError("SqlTeamStore.Update", "store.sql_team.update.updating.app_error", nil, "id="+team.Id+", "+err.Error(), http.StatusInternalServerError)
			return
		}
		if count != 1 {
			result.Err = model.NewAppError("SqlTeamStore.Update", "store.sql_team.update.app_error", nil, "id="+team.Id, http.StatusInternalServerError)
			return
		}

		if oldTeam.DeleteAt == 0 && team.DeleteAt != 0 {
			// Invalidate this cache after any team deletion
			allTeamIdsForUserCache.Purge()
		}

		result.Data = team
	})
}

func (s SqlTeamStore) UpdateDisplayName(name string, teamId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := s.GetMaster().Exec("UPDATE Teams SET DisplayName = :Name WHERE Id = :Id", map[string]interface{}{"Name": name, "Id": teamId}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.UpdateName", "store.sql_team.update_display_name.app_error", nil, "team_id="+teamId, http.StatusInternalServerError)
			return
		}

		result.Data = teamId
	})
}

func (s SqlTeamStore) Get(id string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		obj, err := s.GetReplica().Get(model.Team{}, id)
		if err != nil {
			result.Err = model.NewAppError("SqlTeamStore.Get", "store.sql_team.get.finding.app_error", nil, "id="+id+", "+err.Error(), http.StatusInternalServerError)
			return
		}
		if obj == nil {
			result.Err = model.NewAppError("SqlTeamStore.Get", "store.sql_team.get.find.app_error", nil, "id="+id, http.StatusNotFound)
			return
		}

		team := obj.(*model.Team)
		if len(team.InviteId) == 0 {
			team.InviteId = team.Id
		}

		result.Data = team
	})
}

func (s SqlTeamStore) GetByInviteId(inviteId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		team := model.Team{}

		if err := s.GetReplica().SelectOne(&team, "SELECT * FROM Teams WHERE Id = :InviteId OR InviteId = :InviteId", map[string]interface{}{"InviteId": inviteId}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetByInviteId", "store.sql_team.get_by_invite_id.finding.app_error", nil, "inviteId="+inviteId+", "+err.Error(), http.StatusNotFound)
			return
		}

		if len(team.InviteId) == 0 {
			team.InviteId = team.Id
		}

		if len(inviteId) == 0 || team.InviteId != inviteId {
			result.Err = model.NewAppError("SqlTeamStore.GetByInviteId", "store.sql_team.get_by_invite_id.find.app_error", nil, "inviteId="+inviteId, http.StatusNotFound)
			return
		}

		result.Data = &team
	})
}

func (s SqlTeamStore) GetByName(name string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		team := model.Team{}

		if err := s.GetReplica().SelectOne(&team, "SELECT * FROM Teams WHERE Name = :Name", map[string]interface{}{"Name": name}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetByName", "store.sql_team.get_by_name.app_error", nil, "name="+name+", "+err.Error(), http.StatusInternalServerError)
			return
		}

		if len(team.InviteId) == 0 {
			team.InviteId = team.Id
		}

		result.Data = &team
	})
}

func (s SqlTeamStore) SearchByName(name string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var teams []*model.Team

		if _, err := s.GetReplica().Select(&teams, "SELECT * FROM Teams WHERE Name LIKE :Name", map[string]interface{}{"Name": name + "%"}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.SearchByName", "store.sql_team.get_by_name.app_error", nil, "name="+name+", "+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = teams
	})
}

func (s SqlTeamStore) SearchAll(term string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var teams []*model.Team

		if _, err := s.GetReplica().Select(&teams, "SELECT * FROM Teams WHERE Name LIKE :Term OR DisplayName LIKE :Term", map[string]interface{}{"Term": term + "%"}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.SearchAll", "store.sql_team.search_all_team.app_error", nil, "term="+term+", "+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = teams
	})
}

func (s SqlTeamStore) SearchOpen(term string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var teams []*model.Team

		if _, err := s.GetReplica().Select(&teams, "SELECT * FROM Teams WHERE Type = 'O' AND AllowOpenInvite = true AND (Name LIKE :Term OR DisplayName LIKE :Term)", map[string]interface{}{"Term": term + "%"}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.SearchOpen", "store.sql_team.search_open_team.app_error", nil, "term="+term+", "+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = teams
	})
}

func (s SqlTeamStore) SearchPrivate(term string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var teams []*model.Team

		if _, err := s.GetReplica().Select(&teams, "SELECT * FROM Teams WHERE (Type != 'O' OR AllowOpenInvite = false) AND (Name LIKE :Term OR DisplayName LIKE :Term)", map[string]interface{}{"Term": term + "%"}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.SearchPrivate", "store.sql_team.search_private_team.app_error", nil, "term="+term+", "+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = teams
	})
}

func (s SqlTeamStore) GetAll() store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var data []*model.Team
		if _, err := s.GetReplica().Select(&data, "SELECT * FROM Teams ORDER BY DisplayName"); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetAllTeams", "store.sql_team.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		for _, team := range data {
			if len(team.InviteId) == 0 {
				team.InviteId = team.Id
			}
		}

		result.Data = data
	})
}

func (s SqlTeamStore) GetAllPage(offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var data []*model.Team
		if _, err := s.GetReplica().Select(&data, "SELECT * FROM Teams ORDER BY DisplayName LIMIT :Limit OFFSET :Offset", map[string]interface{}{"Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetAllTeams", "store.sql_team.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		for _, team := range data {
			if len(team.InviteId) == 0 {
				team.InviteId = team.Id
			}
		}

		result.Data = data
	})
}

func (s SqlTeamStore) GetTeamsByUserId(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var data []*model.Team
		if _, err := s.GetReplica().Select(&data, "SELECT Teams.* FROM Teams, TeamMembers WHERE TeamMembers.TeamId = Teams.Id AND TeamMembers.UserId = :UserId AND TeamMembers.DeleteAt = 0 AND Teams.DeleteAt = 0", map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetTeamsByUserId", "store.sql_team.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		for _, team := range data {
			if len(team.InviteId) == 0 {
				team.InviteId = team.Id
			}
		}

		result.Data = data
	})
}

func (s SqlTeamStore) GetAllPrivateTeamListing() store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		query := "SELECT * FROM Teams WHERE AllowOpenInvite = 0 ORDER BY DisplayName"

		if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
			query = "SELECT * FROM Teams WHERE AllowOpenInvite = false ORDER BY DisplayName"
		}

		var data []*model.Team
		if _, err := s.GetReplica().Select(&data, query); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetAllPrivateTeamListing", "store.sql_team.get_all_private_team_listing.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		for _, team := range data {
			if len(team.InviteId) == 0 {
				team.InviteId = team.Id
			}
		}

		result.Data = data
	})
}

func (s SqlTeamStore) GetAllPrivateTeamPageListing(offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		query := "SELECT * FROM Teams WHERE AllowOpenInvite = 0 ORDER BY DisplayName LIMIT :Limit OFFSET :Offset"

		if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
			query = "SELECT * FROM Teams WHERE AllowOpenInvite = false ORDER BY DisplayName LIMIT :Limit OFFSET :Offset"
		}

		var data []*model.Team
		if _, err := s.GetReplica().Select(&data, query, map[string]interface{}{"Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetAllPrivateTeamListing", "store.sql_team.get_all_private_team_listing.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		for _, team := range data {
			if len(team.InviteId) == 0 {
				team.InviteId = team.Id
			}
		}

		result.Data = data
	})
}

func (s SqlTeamStore) GetAllTeamListing() store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		query := "SELECT * FROM Teams WHERE AllowOpenInvite = 1 ORDER BY DisplayName"

		if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
			query = "SELECT * FROM Teams WHERE AllowOpenInvite = true ORDER BY DisplayName"
		}

		var data []*model.Team
		if _, err := s.GetReplica().Select(&data, query); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetAllTeamListing", "store.sql_team.get_all_team_listing.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		for _, team := range data {
			if len(team.InviteId) == 0 {
				team.InviteId = team.Id
			}
		}

		result.Data = data
	})
}

func (s SqlTeamStore) GetAllTeamPageListing(offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		query := "SELECT * FROM Teams WHERE AllowOpenInvite = 1 ORDER BY DisplayName LIMIT :Limit OFFSET :Offset"

		if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
			query = "SELECT * FROM Teams WHERE AllowOpenInvite = true ORDER BY DisplayName LIMIT :Limit OFFSET :Offset"
		}

		var data []*model.Team
		if _, err := s.GetReplica().Select(&data, query, map[string]interface{}{"Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetAllTeamListing", "store.sql_team.get_all_team_listing.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		for _, team := range data {
			if len(team.InviteId) == 0 {
				team.InviteId = team.Id
			}
		}

		result.Data = data
	})
}

func (s SqlTeamStore) PermanentDelete(teamId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := s.GetMaster().Exec("DELETE FROM Teams WHERE Id = :TeamId", map[string]interface{}{"TeamId": teamId}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.Delete", "store.sql_team.permanent_delete.app_error", nil, "teamId="+teamId+", "+err.Error(), http.StatusInternalServerError)
			return
		}
	})
}

func (s SqlTeamStore) AnalyticsTeamCount() store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		c, err := s.GetReplica().SelectInt("SELECT COUNT(*) FROM Teams WHERE DeleteAt = 0", map[string]interface{}{})
		if err != nil {
			result.Err = model.NewAppError("SqlTeamStore.AnalyticsTeamCount", "store.sql_team.analytics_team_count.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}
		result.Data = c
	})
}

var TEAM_MEMBERS_WITH_SCHEME_SELECT_QUERY = `
	SELECT
		TeamMembers.*,
		TeamScheme.DefaultTeamUserRole TeamSchemeDefaultUserRole,
		TeamScheme.DefaultTeamAdminRole TeamSchemeDefaultAdminRole
	FROM
		TeamMembers
	LEFT JOIN
		Teams ON TeamMembers.TeamId = Teams.Id
	LEFT JOIN
		Schemes TeamScheme ON Teams.SchemeId = TeamScheme.Id
`

func (s SqlTeamStore) SaveMember(member *model.TeamMember, maxUsersPerTeam int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		defer s.InvalidateAllTeamIdsForUser(member.UserId)
		if result.Err = member.IsValid(); result.Err != nil {
			return
		}

		dbMember := NewTeamMemberFromModel(member)

		if maxUsersPerTeam >= 0 {
			count, err := s.GetMaster().SelectInt(
				`SELECT
					COUNT(0)
				FROM
					TeamMembers
				INNER JOIN
					Users
				ON
					TeamMembers.UserId = Users.Id
				WHERE
					TeamId = :TeamId
					AND TeamMembers.DeleteAt = 0
					AND Users.DeleteAt = 0`, map[string]interface{}{"TeamId": member.TeamId})

			if err != nil {
				result.Err = model.NewAppError("SqlUserStore.Save", "store.sql_user.save.member_count.app_error", nil, "teamId="+member.TeamId+", "+err.Error(), http.StatusInternalServerError)
				return
			}

			if count >= int64(maxUsersPerTeam) {
				result.Err = model.NewAppError("SqlUserStore.Save", "store.sql_user.save.max_accounts.app_error", nil, "teamId="+member.TeamId, http.StatusBadRequest)
				return
			}
		}

		if err := s.GetMaster().Insert(dbMember); err != nil {
			if IsUniqueConstraintError(err, []string{"TeamId", "teammembers_pkey", "PRIMARY"}) {
				result.Err = model.NewAppError("SqlTeamStore.SaveMember", TEAM_MEMBER_EXISTS_ERROR, nil, "team_id="+member.TeamId+", user_id="+member.UserId+", "+err.Error(), http.StatusBadRequest)
				return
			}
			result.Err = model.NewAppError("SqlTeamStore.SaveMember", "store.sql_team.save_member.save.app_error", nil, "team_id="+member.TeamId+", user_id="+member.UserId+", "+err.Error(), http.StatusInternalServerError)
			return
		}

		var retrievedMember teamMemberWithSchemeRoles
		if err := s.GetMaster().SelectOne(&retrievedMember, TEAM_MEMBERS_WITH_SCHEME_SELECT_QUERY+"WHERE TeamMembers.TeamId = :TeamId AND TeamMembers.UserId = :UserId", map[string]interface{}{"TeamId": dbMember.TeamId, "UserId": dbMember.UserId}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlTeamStore.SaveMember", "store.sql_team.get_member.missing.app_error", nil, "team_id="+dbMember.TeamId+"user_id="+dbMember.UserId+","+err.Error(), http.StatusNotFound)
				return
			}
			result.Err = model.NewAppError("SqlTeamStore.SaveMember", "store.sql_team.get_member.app_error", nil, "team_id="+dbMember.TeamId+"user_id="+dbMember.UserId+","+err.Error(), http.StatusInternalServerError)
			return
		}
		result.Data = retrievedMember.ToModel()
	})
}

func (s SqlTeamStore) UpdateMember(member *model.TeamMember) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		member.PreUpdate()

		if result.Err = member.IsValid(); result.Err != nil {
			return
		}

		if _, err := s.GetMaster().Update(NewTeamMemberFromModel(member)); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.UpdateMember", "store.sql_team.save_member.save.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		var retrievedMember teamMemberWithSchemeRoles
		if err := s.GetMaster().SelectOne(&retrievedMember, TEAM_MEMBERS_WITH_SCHEME_SELECT_QUERY+"WHERE TeamMembers.TeamId = :TeamId AND TeamMembers.UserId = :UserId", map[string]interface{}{"TeamId": member.TeamId, "UserId": member.UserId}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlTeamStore.UpdateMember", "store.sql_team.get_member.missing.app_error", nil, "team_id="+member.TeamId+"user_id="+member.UserId+","+err.Error(), http.StatusNotFound)
				return
			}
			result.Err = model.NewAppError("SqlTeamStore.UpdateMember", "store.sql_team.get_member.app_error", nil, "team_id="+member.TeamId+"user_id="+member.UserId+","+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = retrievedMember.ToModel()
	})
}

func (s SqlTeamStore) GetMember(teamId string, userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var dbMember teamMemberWithSchemeRoles
		err := s.GetReplica().SelectOne(&dbMember, TEAM_MEMBERS_WITH_SCHEME_SELECT_QUERY+"WHERE TeamMembers.TeamId = :TeamId AND TeamMembers.UserId = :UserId", map[string]interface{}{"TeamId": teamId, "UserId": userId})
		if err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlTeamStore.GetMember", "store.sql_team.get_member.missing.app_error", nil, "teamId="+teamId+" userId="+userId+" "+err.Error(), http.StatusNotFound)
				return
			}
			result.Err = model.NewAppError("SqlTeamStore.GetMember", "store.sql_team.get_member.app_error", nil, "teamId="+teamId+" userId="+userId+" "+err.Error(), http.StatusInternalServerError)
			return
		}
		result.Data = dbMember.ToModel()
	})
}

func (s SqlTeamStore) GetMembers(teamId string, offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var dbMembers teamMemberWithSchemeRolesList
		_, err := s.GetReplica().Select(&dbMembers, TEAM_MEMBERS_WITH_SCHEME_SELECT_QUERY+"WHERE TeamMembers.TeamId = :TeamId AND TeamMembers.DeleteAt = 0 LIMIT :Limit OFFSET :Offset", map[string]interface{}{"TeamId": teamId, "Limit": limit, "Offset": offset})
		if err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetMembers", "store.sql_team.get_members.app_error", nil, "teamId="+teamId+" "+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = dbMembers.ToModel()
	})
}

func (s SqlTeamStore) GetTotalMemberCount(teamId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		count, err := s.GetReplica().SelectInt(`
			SELECT
				count(*)
			FROM
				TeamMembers,
				Users
			WHERE
				TeamMembers.UserId = Users.Id
				AND TeamMembers.TeamId = :TeamId
				AND TeamMembers.DeleteAt = 0`, map[string]interface{}{"TeamId": teamId})
		if err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetTotalMemberCount", "store.sql_team.get_member_count.app_error", nil, "teamId="+teamId+" "+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = count
	})
}

func (s SqlTeamStore) GetActiveMemberCount(teamId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		count, err := s.GetReplica().SelectInt(`
			SELECT
				count(*)
			FROM
				TeamMembers,
				Users
			WHERE
				TeamMembers.UserId = Users.Id
				AND TeamMembers.TeamId = :TeamId
				AND TeamMembers.DeleteAt = 0
				AND Users.DeleteAt = 0`, map[string]interface{}{"TeamId": teamId})
		if err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetActiveMemberCount", "store.sql_team.get_member_count.app_error", nil, "teamId="+teamId+" "+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = count
	})
}

func (s SqlTeamStore) GetMembersByIds(teamId string, userIds []string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var dbMembers teamMemberWithSchemeRolesList
		props := make(map[string]interface{})
		idQuery := ""

		for index, userId := range userIds {
			if len(idQuery) > 0 {
				idQuery += ", "
			}

			props["userId"+strconv.Itoa(index)] = userId
			idQuery += ":userId" + strconv.Itoa(index)
		}

		props["TeamId"] = teamId

		if _, err := s.GetReplica().Select(&dbMembers, TEAM_MEMBERS_WITH_SCHEME_SELECT_QUERY+"WHERE TeamMembers.TeamId = :TeamId AND TeamMembers.UserId IN ("+idQuery+") AND TeamMembers.DeleteAt = 0", props); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetMembersByIds", "store.sql_team.get_members_by_ids.app_error", nil, "teamId="+teamId+" "+err.Error(), http.StatusInternalServerError)
			return
		}
		result.Data = dbMembers.ToModel()
	})
}

func (s SqlTeamStore) GetTeamsForUser(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var dbMembers teamMemberWithSchemeRolesList
		_, err := s.GetReplica().Select(&dbMembers, TEAM_MEMBERS_WITH_SCHEME_SELECT_QUERY+"WHERE TeamMembers.UserId = :UserId", map[string]interface{}{"UserId": userId})
		if err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetMembers", "store.sql_team.get_members.app_error", nil, "userId="+userId+" "+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = dbMembers.ToModel()
	})
}

func (s SqlTeamStore) GetTeamsForUserWithPagination(userId string, page, perPage int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var dbMembers teamMemberWithSchemeRolesList
		offset := page * perPage
		_, err := s.GetReplica().Select(&dbMembers, TEAM_MEMBERS_WITH_SCHEME_SELECT_QUERY+"WHERE TeamMembers.UserId = :UserId Limit :Limit Offset :Offset", map[string]interface{}{"UserId": userId, "Limit": perPage, "Offset": offset})
		if err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetTeamsForUserWithPagination", "store.sql_team.get_members.app_error", nil, "userId="+userId+" "+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = dbMembers.ToModel()
	})
}

func (s SqlTeamStore) GetChannelUnreadsForAllTeams(excludeTeamId, userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var data []*model.ChannelUnread
		_, err := s.GetReplica().Select(&data,
			`SELECT
				Channels.TeamId TeamId, Channels.Id ChannelId, (Channels.TotalMsgCount - ChannelMembers.MsgCount) MsgCount, ChannelMembers.MentionCount MentionCount, ChannelMembers.NotifyProps NotifyProps
			FROM
				Channels, ChannelMembers
			WHERE
				Id = ChannelId
                AND UserId = :UserId
                AND DeleteAt = 0
                AND TeamId != :TeamId`,
			map[string]interface{}{"UserId": userId, "TeamId": excludeTeamId})

		if err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetChannelUnreadsForAllTeams", "store.sql_team.get_unread.app_error", nil, "userId="+userId+" "+err.Error(), http.StatusInternalServerError)
			return
		}
		result.Data = data
	})
}

func (s SqlTeamStore) GetChannelUnreadsForTeam(teamId, userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var data []*model.ChannelUnread
		_, err := s.GetReplica().Select(&data,
			`SELECT
				Channels.TeamId TeamId, Channels.Id ChannelId, (Channels.TotalMsgCount - ChannelMembers.MsgCount) MsgCount, ChannelMembers.MentionCount MentionCount, ChannelMembers.NotifyProps NotifyProps
			FROM
				Channels, ChannelMembers
			WHERE
				Id = ChannelId
                AND UserId = :UserId
                AND TeamId = :TeamId
                AND DeleteAt = 0`,
			map[string]interface{}{"TeamId": teamId, "UserId": userId})

		if err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetChannelUnreadsForTeam", "store.sql_team.get_unread.app_error", nil, "teamId="+teamId+" "+err.Error(), http.StatusInternalServerError)
			return
		}
		result.Data = data
	})
}

func (s SqlTeamStore) RemoveMember(teamId string, userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		_, err := s.GetMaster().Exec("DELETE FROM TeamMembers WHERE TeamId = :TeamId AND UserId = :UserId", map[string]interface{}{"TeamId": teamId, "UserId": userId})
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.RemoveMember", "store.sql_team.remove_member.app_error", nil, "team_id="+teamId+", user_id="+userId+", "+err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s SqlTeamStore) RemoveAllMembersByTeam(teamId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		_, err := s.GetMaster().Exec("DELETE FROM TeamMembers WHERE TeamId = :TeamId", map[string]interface{}{"TeamId": teamId})
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.RemoveMember", "store.sql_team.remove_member.app_error", nil, "team_id="+teamId+", "+err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s SqlTeamStore) RemoveAllMembersByUser(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		_, err := s.GetMaster().Exec("DELETE FROM TeamMembers WHERE UserId = :UserId", map[string]interface{}{"UserId": userId})
		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.RemoveMember", "store.sql_team.remove_member.app_error", nil, "user_id="+userId+", "+err.Error(), http.StatusInternalServerError)
		}
	})
}

func (us SqlTeamStore) UpdateLastTeamIconUpdate(teamId string, curTime int64) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := us.GetMaster().Exec("UPDATE Teams SET LastTeamIconUpdate = :Time, UpdateAt = :Time WHERE Id = :teamId", map[string]interface{}{"Time": curTime, "teamId": teamId}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.UpdateLastTeamIconUpdate", "store.sql_team.update_last_team_icon_update.app_error", nil, "team_id="+teamId, http.StatusInternalServerError)
			return
		}
		result.Data = teamId
	})
}

func (s SqlTeamStore) GetTeamsByScheme(schemeId string, offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var teams []*model.Team
		_, err := s.GetReplica().Select(&teams, "SELECT * FROM Teams WHERE SchemeId = :SchemeId ORDER BY DisplayName LIMIT :Limit OFFSET :Offset", map[string]interface{}{"SchemeId": schemeId, "Offset": offset, "Limit": limit})
		if err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetTeamsByScheme", "store.sql_team.get_by_scheme.app_error", nil, "schemeId="+schemeId+" "+err.Error(), http.StatusInternalServerError)
			return
		}
		result.Data = teams
	})
}

// This function does the Advanced Permissions Phase 2 migration for TeamMember objects. It performs the migration
// in batches as a single transaction per batch to ensure consistency but to also minimise execution time to avoid
// causing unnecessary table locks. **THIS FUNCTION SHOULD NOT BE USED FOR ANY OTHER PURPOSE.** Executing this function
// *after* the new Schemes functionality has been used on an installation will have unintended consequences.
func (s SqlTeamStore) MigrateTeamMembers(fromTeamId string, fromUserId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var transaction *gorp.Transaction
		var err error

		if transaction, err = s.GetMaster().Begin(); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.MigrateTeamMembers", "store.sql_team.migrate_team_members.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}
		defer finalizeTransaction(transaction)

		var teamMembers []teamMember
		if _, err := transaction.Select(&teamMembers, "SELECT * from TeamMembers WHERE (TeamId, UserId) > (:FromTeamId, :FromUserId) ORDER BY TeamId, UserId LIMIT 100", map[string]interface{}{"FromTeamId": fromTeamId, "FromUserId": fromUserId}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.MigrateTeamMembers", "store.sql_team.migrate_team_members.select.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		if len(teamMembers) == 0 {
			// No more team members in query result means that the migration has finished.
			return
		}

		for _, member := range teamMembers {
			roles := strings.Fields(member.Roles)
			var newRoles []string
			if !member.SchemeAdmin.Valid {
				member.SchemeAdmin = sql.NullBool{Bool: false, Valid: true}
			}
			if !member.SchemeUser.Valid {
				member.SchemeUser = sql.NullBool{Bool: false, Valid: true}
			}
			for _, role := range roles {
				if role == model.TEAM_ADMIN_ROLE_ID {
					member.SchemeAdmin = sql.NullBool{Bool: true, Valid: true}
				} else if role == model.TEAM_USER_ROLE_ID {
					member.SchemeUser = sql.NullBool{Bool: true, Valid: true}
				} else {
					newRoles = append(newRoles, role)
				}
			}
			member.Roles = strings.Join(newRoles, " ")

			if _, err := transaction.Update(&member); err != nil {
				result.Err = model.NewAppError("SqlTeamStore.MigrateTeamMembers", "store.sql_team.migrate_team_members.update.app_error", nil, err.Error(), http.StatusInternalServerError)
				return
			}

		}

		if err := transaction.Commit(); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.MigrateTeamMembers", "store.sql_team.migrate_team_members.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		data := make(map[string]string)
		data["TeamId"] = teamMembers[len(teamMembers)-1].TeamId
		data["UserId"] = teamMembers[len(teamMembers)-1].UserId
		result.Data = data
	})
}

func (s SqlTeamStore) ResetAllTeamSchemes() store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := s.GetMaster().Exec("UPDATE Teams SET SchemeId=''"); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.ResetAllTeamSchemes", "store.sql_team.reset_all_team_schemes.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	})
}

var allTeamIdsForUserCache = utils.NewLru(ALL_TEAM_IDS_FOR_USER_CACHE_SIZE)

func (s SqlTeamStore) ClearCaches() {
	allTeamIdsForUserCache.Purge()
	if s.metrics != nil {
		s.metrics.IncrementMemCacheInvalidationCounter("All Team Ids for User - Purge")
	}
}

func (s SqlTeamStore) InvalidateAllTeamIdsForUser(userId string) {
	allTeamIdsForUserCache.Remove(userId)
	if s.metrics != nil {
		s.metrics.IncrementMemCacheInvalidationCounter("All Team Ids for User - Remove by UserId")
	}
}

func (s SqlTeamStore) ClearAllCustomRoleAssignments() store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		builtInRoles := model.MakeDefaultRoles()
		lastUserId := strings.Repeat("0", 26)
		lastTeamId := strings.Repeat("0", 26)

		for {
			var transaction *gorp.Transaction
			var err error

			if transaction, err = s.GetMaster().Begin(); err != nil {
				result.Err = model.NewAppError("SqlTeamStore.ClearAllCustomRoleAssignments", "store.sql_team.clear_all_custom_role_assignments.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
				return
			}
			defer finalizeTransaction(transaction)

			var teamMembers []*teamMember
			if _, err := transaction.Select(&teamMembers, "SELECT * from TeamMembers WHERE (TeamId, UserId) > (:TeamId, :UserId) ORDER BY TeamId, UserId LIMIT 1000", map[string]interface{}{"TeamId": lastTeamId, "UserId": lastUserId}); err != nil {
				result.Err = model.NewAppError("SqlTeamStore.ClearAllCustomRoleAssignments", "store.sql_team.clear_all_custom_role_assignments.select.app_error", nil, err.Error(), http.StatusInternalServerError)
				return
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
						result.Err = model.NewAppError("SqlTeamStore.ClearAllCustomRoleAssignments", "store.sql_team.clear_all_custom_role_assignments.update.app_error", nil, err.Error(), http.StatusInternalServerError)
						return
					}
				}
			}

			if err := transaction.Commit(); err != nil {
				result.Err = model.NewAppError("SqlTeamStore.ClearAllCustomRoleAssignments", "store.sql_team.clear_all_custom_role_assignments.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
				return
			}
		}
	})
}

func (s SqlTeamStore) AnalyticsGetTeamCountForScheme(schemeId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		count, err := s.GetReplica().SelectInt("SELECT count(*) FROM Teams WHERE SchemeId = :SchemeId AND DeleteAt = 0", map[string]interface{}{"SchemeId": schemeId})
		if err != nil {
			result.Err = model.NewAppError("SqlTeamStore.AnalyticsGetTeamCountForScheme", "store.sql_team.analytics_get_team_count_for_scheme.app_error", nil, "schemeId="+schemeId+" "+err.Error(), http.StatusInternalServerError)
			return
		}
		result.Data = count
	})
}

func (s SqlTeamStore) GetAllForExportAfter(limit int, afterId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var data []*model.TeamForExport
		if _, err := s.GetReplica().Select(&data, `
			SELECT
				Teams.*,
				Schemes.Name as SchemeName
			FROM
				Teams
			LEFT JOIN
				Schemes ON Teams.SchemeId = Schemes.Id
			WHERE
				Teams.Id > :AfterId
			ORDER BY
				Id
			LIMIT
				:Limit`,
			map[string]interface{}{"AfterId": afterId, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetAllTeams", "store.sql_team.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		for _, team := range data {
			if len(team.InviteId) == 0 {
				team.InviteId = team.Id
			}
		}

		result.Data = data
	})
}

func (s SqlTeamStore) GetUserTeamIds(userId string, allowFromCache bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if allowFromCache {
			if cacheItem, ok := allTeamIdsForUserCache.Get(userId); ok {
				if s.metrics != nil {
					s.metrics.IncrementMemCacheHitCounter("All Team Ids for User")
				}
				result.Data = cacheItem.([]string)
				return
			}
		}

		if s.metrics != nil {
			s.metrics.IncrementMemCacheMissCounter("All Team Ids for User")
		}

		var teamIds []string
		_, err := s.GetReplica().Select(&teamIds, `
	SELECT
		TeamId
	FROM
		TeamMembers
	INNER JOIN
		Teams ON TeamMembers.TeamId = Teams.Id
	WHERE
		TeamMembers.UserId = :UserId
		AND TeamMembers.DeleteAt = 0
		AND Teams.DeleteAt = 0`,
			map[string]interface{}{"UserId": userId})
		if err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetUserTeamIds", "store.sql_team.get_user_team_ids.app_error", nil, "userId="+userId+" "+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = teamIds

		if allowFromCache {
			allTeamIdsForUserCache.AddWithExpiresInSecs(userId, teamIds, ALL_TEAM_IDS_FOR_USER_CACHE_SEC)
		}
	})
}

func (s SqlTeamStore) GetTeamMembersForExport(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var members []*model.TeamMemberForExport
		_, err := s.GetReplica().Select(&members, `
	SELECT
		TeamMembers.*,
		Teams.Name as TeamName
	FROM
		TeamMembers
	INNER JOIN
		Teams ON TeamMembers.TeamId = Teams.Id
	WHERE
		TeamMembers.UserId = :UserId
		AND Teams.DeleteAt = 0`,
			map[string]interface{}{"UserId": userId})
		if err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetTeamMembersForExport", "store.sql_team.get_members.app_error", nil, "userId="+userId+" "+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = members
	})
}

func (s SqlTeamStore) UserBelongsToTeams(userId string, teamIds []string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		props := make(map[string]interface{})
		props["UserId"] = userId
		idQuery := ""

		for index, teamId := range teamIds {
			if len(idQuery) > 0 {
				idQuery += ", "
			}

			props["teamId"+strconv.Itoa(index)] = teamId
			idQuery += ":teamId" + strconv.Itoa(index)
		}
		c, err := s.GetReplica().SelectInt("SELECT Count(*) FROM TeamMembers WHERE UserId = :UserId AND TeamId IN ("+idQuery+") AND DeleteAt = 0", props)
		if err != nil {
			result.Err = model.NewAppError("SqlTeamStore.UserBelongsToTeams", "store.sql_team.user_belongs_to_teams.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}
		result.Data = c > 0
	})
}
