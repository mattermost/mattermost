// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

const (
	TEAM_MEMBER_EXISTS_ERROR = "store.sql_team.save_member.exists.app_error"
)

type SqlTeamStore struct {
	SqlStore
}

func NewSqlTeamStore(sqlStore SqlStore) store.TeamStore {
	s := &SqlTeamStore{sqlStore}

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

		tablem := db.AddTableWithName(model.TeamMember{}, "TeamMembers").SetKeys(false, "TeamId", "UserId")
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
			} else {
				result.Err = model.NewAppError("SqlTeamStore.Save", "store.sql_team.save.app_error", nil, "id="+team.Id+", "+err.Error(), http.StatusInternalServerError)
			}
		} else {
			result.Data = team
		}
	})
}

func (s SqlTeamStore) Update(team *model.Team) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		team.PreUpdate()

		if result.Err = team.IsValid(); result.Err != nil {
			return
		}

		if oldResult, err := s.GetMaster().Get(model.Team{}, team.Id); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.Update", "store.sql_team.update.finding.app_error", nil, "id="+team.Id+", "+err.Error(), http.StatusInternalServerError)
		} else if oldResult == nil {
			result.Err = model.NewAppError("SqlTeamStore.Update", "store.sql_team.update.find.app_error", nil, "id="+team.Id, http.StatusBadRequest)
		} else {
			oldTeam := oldResult.(*model.Team)
			team.CreateAt = oldTeam.CreateAt
			team.UpdateAt = model.GetMillis()
			team.Name = oldTeam.Name

			if count, err := s.GetMaster().Update(team); err != nil {
				result.Err = model.NewAppError("SqlTeamStore.Update", "store.sql_team.update.updating.app_error", nil, "id="+team.Id+", "+err.Error(), http.StatusInternalServerError)
			} else if count != 1 {
				result.Err = model.NewAppError("SqlTeamStore.Update", "store.sql_team.update.app_error", nil, "id="+team.Id, http.StatusInternalServerError)
			} else {
				result.Data = team
			}
		}
	})
}

func (s SqlTeamStore) UpdateDisplayName(name string, teamId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := s.GetMaster().Exec("UPDATE Teams SET DisplayName = :Name WHERE Id = :Id", map[string]interface{}{"Name": name, "Id": teamId}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.UpdateName", "store.sql_team.update_display_name.app_error", nil, "team_id="+teamId, http.StatusInternalServerError)
		} else {
			result.Data = teamId
		}
	})
}

func (s SqlTeamStore) Get(id string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if obj, err := s.GetReplica().Get(model.Team{}, id); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.Get", "store.sql_team.get.finding.app_error", nil, "id="+id+", "+err.Error(), http.StatusInternalServerError)
		} else if obj == nil {
			result.Err = model.NewAppError("SqlTeamStore.Get", "store.sql_team.get.find.app_error", nil, "id="+id, http.StatusNotFound)
		} else {
			team := obj.(*model.Team)
			if len(team.InviteId) == 0 {
				team.InviteId = team.Id
			}

			result.Data = team
		}
	})
}

func (s SqlTeamStore) GetByInviteId(inviteId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		team := model.Team{}

		if err := s.GetReplica().SelectOne(&team, "SELECT * FROM Teams WHERE Id = :InviteId OR InviteId = :InviteId", map[string]interface{}{"InviteId": inviteId}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetByInviteId", "store.sql_team.get_by_invite_id.finding.app_error", nil, "inviteId="+inviteId+", "+err.Error(), http.StatusNotFound)
		}

		if len(team.InviteId) == 0 {
			team.InviteId = team.Id
		}

		if len(inviteId) == 0 || team.InviteId != inviteId {
			result.Err = model.NewAppError("SqlTeamStore.GetByInviteId", "store.sql_team.get_by_invite_id.find.app_error", nil, "inviteId="+inviteId, http.StatusNotFound)
		}

		result.Data = &team
	})
}

func (s SqlTeamStore) GetByName(name string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		team := model.Team{}

		if err := s.GetReplica().SelectOne(&team, "SELECT * FROM Teams WHERE Name = :Name", map[string]interface{}{"Name": name}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetByName", "store.sql_team.get_by_name.app_error", nil, "name="+name+", "+err.Error(), http.StatusInternalServerError)
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
		}

		result.Data = teams
	})
}

func (s SqlTeamStore) SearchAll(term string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var teams []*model.Team

		if _, err := s.GetReplica().Select(&teams, "SELECT * FROM Teams WHERE Name LIKE :Term OR DisplayName LIKE :Term", map[string]interface{}{"Term": term + "%"}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.SearchAll", "store.sql_team.search_all_team.app_error", nil, "term="+term+", "+err.Error(), http.StatusInternalServerError)
		}

		result.Data = teams
	})
}

func (s SqlTeamStore) SearchOpen(term string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var teams []*model.Team

		if _, err := s.GetReplica().Select(&teams, "SELECT * FROM Teams WHERE Type = 'O' AND AllowOpenInvite = true AND (Name LIKE :Term OR DisplayName LIKE :Term)", map[string]interface{}{"Term": term + "%"}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.SearchOpen", "store.sql_team.search_open_team.app_error", nil, "term="+term+", "+err.Error(), http.StatusInternalServerError)
		}

		result.Data = teams
	})
}

func (s SqlTeamStore) GetAll() store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var data []*model.Team
		if _, err := s.GetReplica().Select(&data, "SELECT * FROM Teams"); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetAllTeams", "store.sql_team.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
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
		if _, err := s.GetReplica().Select(&data, "SELECT * FROM Teams LIMIT :Limit OFFSET :Offset", map[string]interface{}{"Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetAllTeams", "store.sql_team.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
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
		query := "SELECT * FROM Teams WHERE AllowOpenInvite = 1"

		if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
			query = "SELECT * FROM Teams WHERE AllowOpenInvite = true"
		}

		var data []*model.Team
		if _, err := s.GetReplica().Select(&data, query); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetAllTeamListing", "store.sql_team.get_all_team_listing.app_error", nil, err.Error(), http.StatusInternalServerError)
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
		query := "SELECT * FROM Teams WHERE AllowOpenInvite = 1 LIMIT :Limit OFFSET :Offset"

		if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
			query = "SELECT * FROM Teams WHERE AllowOpenInvite = true LIMIT :Limit OFFSET :Offset"
		}

		var data []*model.Team
		if _, err := s.GetReplica().Select(&data, query, map[string]interface{}{"Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetAllTeamListing", "store.sql_team.get_all_team_listing.app_error", nil, err.Error(), http.StatusInternalServerError)
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
		}
	})
}

func (s SqlTeamStore) AnalyticsTeamCount() store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if c, err := s.GetReplica().SelectInt("SELECT COUNT(*) FROM Teams WHERE DeleteAt = 0", map[string]interface{}{}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.AnalyticsTeamCount", "store.sql_team.analytics_team_count.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = c
		}
	})
}

func (s SqlTeamStore) SaveMember(member *model.TeamMember, maxUsersPerTeam int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if result.Err = member.IsValid(); result.Err != nil {
			return
		}

		if maxUsersPerTeam >= 0 {
			if count, err := s.GetMaster().SelectInt(
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
					AND Users.DeleteAt = 0`, map[string]interface{}{"TeamId": member.TeamId}); err != nil {
				result.Err = model.NewAppError("SqlUserStore.Save", "store.sql_user.save.member_count.app_error", nil, "teamId="+member.TeamId+", "+err.Error(), http.StatusInternalServerError)
				return
			} else if count >= int64(maxUsersPerTeam) {
				result.Err = model.NewAppError("SqlUserStore.Save", "store.sql_user.save.max_accounts.app_error", nil, "teamId="+member.TeamId, http.StatusBadRequest)
				return
			}
		}

		if err := s.GetMaster().Insert(member); err != nil {
			if IsUniqueConstraintError(err, []string{"TeamId", "teammembers_pkey", "PRIMARY"}) {
				result.Err = model.NewAppError("SqlTeamStore.SaveMember", TEAM_MEMBER_EXISTS_ERROR, nil, "team_id="+member.TeamId+", user_id="+member.UserId+", "+err.Error(), http.StatusBadRequest)
			} else {
				result.Err = model.NewAppError("SqlTeamStore.SaveMember", "store.sql_team.save_member.save.app_error", nil, "team_id="+member.TeamId+", user_id="+member.UserId+", "+err.Error(), http.StatusInternalServerError)
			}
		} else {
			result.Data = member
		}
	})
}

func (s SqlTeamStore) UpdateMember(member *model.TeamMember) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		member.PreUpdate()

		if result.Err = member.IsValid(); result.Err != nil {
			return
		}

		if _, err := s.GetMaster().Update(member); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.UpdateMember", "store.sql_team.save_member.save.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = member
		}
	})
}

func (s SqlTeamStore) GetMember(teamId string, userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var member model.TeamMember
		err := s.GetReplica().SelectOne(&member, "SELECT * FROM TeamMembers WHERE TeamId = :TeamId AND UserId = :UserId", map[string]interface{}{"TeamId": teamId, "UserId": userId})
		if err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlTeamStore.GetMember", "store.sql_team.get_member.missing.app_error", nil, "teamId="+teamId+" userId="+userId+" "+err.Error(), http.StatusNotFound)
			} else {
				result.Err = model.NewAppError("SqlTeamStore.GetMember", "store.sql_team.get_member.app_error", nil, "teamId="+teamId+" userId="+userId+" "+err.Error(), http.StatusInternalServerError)
			}
		} else {
			result.Data = &member
		}
	})
}

func (s SqlTeamStore) GetMembers(teamId string, offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var members []*model.TeamMember
		_, err := s.GetReplica().Select(&members, "SELECT * FROM TeamMembers WHERE TeamId = :TeamId AND DeleteAt = 0 LIMIT :Limit OFFSET :Offset", map[string]interface{}{"TeamId": teamId, "Offset": offset, "Limit": limit})
		if err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetMembers", "store.sql_team.get_members.app_error", nil, "teamId="+teamId+" "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = members
		}
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
		} else {
			result.Data = count
		}
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
		} else {
			result.Data = count
		}
	})
}

func (s SqlTeamStore) GetMembersByIds(teamId string, userIds []string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var members []*model.TeamMember
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

		if _, err := s.GetReplica().Select(&members, "SELECT * FROM TeamMembers WHERE TeamId = :TeamId AND UserId IN ("+idQuery+") AND DeleteAt = 0", props); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetMembersByIds", "store.sql_team.get_members_by_ids.app_error", nil, "teamId="+teamId+" "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = members
		}
	})
}

func (s SqlTeamStore) GetTeamsForUser(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var members []*model.TeamMember
		_, err := s.GetReplica().Select(&members, "SELECT * FROM TeamMembers WHERE UserId = :UserId", map[string]interface{}{"UserId": userId})
		if err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetMembers", "store.sql_team.get_members.app_error", nil, "userId="+userId+" "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = members
		}
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
		} else {
			result.Data = data
		}
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
		} else {
			result.Data = data
		}
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
