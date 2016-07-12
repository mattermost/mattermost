// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"database/sql"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

const (
	TEAM_MEMBER_EXISTS_ERROR = "store.sql_team.save_member.exists.app_error"
)

type SqlTeamStore struct {
	*SqlStore
}

func NewSqlTeamStore(sqlStore *SqlStore) TeamStore {
	s := &SqlTeamStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Team{}, "Teams").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("DisplayName").SetMaxSize(64)
		table.ColMap("Name").SetMaxSize(64).SetUnique(true)
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

func (s SqlTeamStore) UpgradeSchemaIfNeeded() {
	s.CreateColumnIfNotExists("TeamMembers", "DeleteAt", "bigint(20)", "bigint", "0")
}

func (s SqlTeamStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_teams_name", "Teams", "Name")
	s.CreateIndexIfNotExists("idx_teams_invite_id", "Teams", "InviteId")

	s.CreateIndexIfNotExists("idx_teammembers_team_id", "TeamMembers", "TeamId")
	s.CreateIndexIfNotExists("idx_teammembers_user_id", "TeamMembers", "UserId")
}

func (s SqlTeamStore) Save(team *model.Team) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if len(team.Id) > 0 {
			result.Err = model.NewLocAppError("SqlTeamStore.Save",
				"store.sql_team.save.existing.app_error", nil, "id="+team.Id)
			storeChannel <- result
			close(storeChannel)
			return
		}

		team.PreSave()

		if result.Err = team.IsValid(*utils.Cfg.TeamSettings.RestrictTeamNames); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if err := s.GetMaster().Insert(team); err != nil {
			if IsUniqueConstraintError(err.Error(), []string{"Name", "teams_name_key"}) {
				result.Err = model.NewLocAppError("SqlTeamStore.Save", "store.sql_team.save.domain_exists.app_error", nil, "id="+team.Id+", "+err.Error())
			} else {
				result.Err = model.NewLocAppError("SqlTeamStore.Save", "store.sql_team.save.app_error", nil, "id="+team.Id+", "+err.Error())
			}
		} else {
			result.Data = team
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlTeamStore) Update(team *model.Team) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		team.PreUpdate()

		if result.Err = team.IsValid(*utils.Cfg.TeamSettings.RestrictTeamNames); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if oldResult, err := s.GetMaster().Get(model.Team{}, team.Id); err != nil {
			result.Err = model.NewLocAppError("SqlTeamStore.Update", "store.sql_team.update.finding.app_error", nil, "id="+team.Id+", "+err.Error())
		} else if oldResult == nil {
			result.Err = model.NewLocAppError("SqlTeamStore.Update", "store.sql_team.update.find.app_error", nil, "id="+team.Id)
		} else {
			oldTeam := oldResult.(*model.Team)
			team.CreateAt = oldTeam.CreateAt
			team.UpdateAt = model.GetMillis()
			team.Name = oldTeam.Name

			if count, err := s.GetMaster().Update(team); err != nil {
				result.Err = model.NewLocAppError("SqlTeamStore.Update", "store.sql_team.update.updating.app_error", nil, "id="+team.Id+", "+err.Error())
			} else if count != 1 {
				result.Err = model.NewLocAppError("SqlTeamStore.Update", "store.sql_team.update.app_error", nil, "id="+team.Id)
			} else {
				result.Data = team
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlTeamStore) UpdateDisplayName(name string, teamId string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := s.GetMaster().Exec("UPDATE Teams SET DisplayName = :Name WHERE Id = :Id", map[string]interface{}{"Name": name, "Id": teamId}); err != nil {
			result.Err = model.NewLocAppError("SqlTeamStore.UpdateName", "store.sql_team.update_display_name.app_error", nil, "team_id="+teamId)
		} else {
			result.Data = teamId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlTeamStore) Get(id string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if obj, err := s.GetReplica().Get(model.Team{}, id); err != nil {
			result.Err = model.NewLocAppError("SqlTeamStore.Get", "store.sql_team.get.finding.app_error", nil, "id="+id+", "+err.Error())
		} else if obj == nil {
			result.Err = model.NewLocAppError("SqlTeamStore.Get", "store.sql_team.get.find.app_error", nil, "id="+id)
		} else {
			team := obj.(*model.Team)
			if len(team.InviteId) == 0 {
				team.InviteId = team.Id
			}

			result.Data = team
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlTeamStore) GetByInviteId(inviteId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		team := model.Team{}

		if err := s.GetReplica().SelectOne(&team, "SELECT * FROM Teams WHERE Id = :InviteId OR InviteId = :InviteId", map[string]interface{}{"InviteId": inviteId}); err != nil {
			result.Err = model.NewLocAppError("SqlTeamStore.GetByInviteId", "store.sql_team.get_by_invite_id.finding.app_error", nil, "inviteId="+inviteId+", "+err.Error())
		}

		if len(team.InviteId) == 0 {
			team.InviteId = team.Id
		}

		if len(inviteId) == 0 || team.InviteId != inviteId {
			result.Err = model.NewLocAppError("SqlTeamStore.GetByInviteId", "store.sql_team.get_by_invite_id.find.app_error", nil, "inviteId="+inviteId)
		}

		result.Data = &team

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlTeamStore) GetByName(name string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		team := model.Team{}

		if err := s.GetReplica().SelectOne(&team, "SELECT * FROM Teams WHERE Name = :Name", map[string]interface{}{"Name": name}); err != nil {
			result.Err = model.NewLocAppError("SqlTeamStore.GetByName", "store.sql_team.get_by_name.app_error", nil, "name="+name+", "+err.Error())
		}

		if len(team.InviteId) == 0 {
			team.InviteId = team.Id
		}

		result.Data = &team

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlTeamStore) GetAll() StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var data []*model.Team
		if _, err := s.GetReplica().Select(&data, "SELECT * FROM Teams"); err != nil {
			result.Err = model.NewLocAppError("SqlTeamStore.GetAllTeams", "store.sql_team.get_all.app_error", nil, err.Error())
		}

		for _, team := range data {
			if len(team.InviteId) == 0 {
				team.InviteId = team.Id
			}
		}

		result.Data = data

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlTeamStore) GetTeamsByUserId(userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var data []*model.Team
		if _, err := s.GetReplica().Select(&data, "SELECT Teams.* FROM Teams, TeamMembers WHERE TeamMembers.TeamId = Teams.Id AND TeamMembers.UserId = :UserId AND TeamMembers.DeleteAt = 0 AND Teams.DeleteAt = 0", map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewLocAppError("SqlTeamStore.GetTeamsByUserId", "store.sql_team.get_all.app_error", nil, err.Error())
		}

		for _, team := range data {
			if len(team.InviteId) == 0 {
				team.InviteId = team.Id
			}
		}

		result.Data = data

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlTeamStore) GetAllTeamListing() StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		query := "SELECT * FROM Teams WHERE AllowOpenInvite = 1"

		if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
			query = "SELECT * FROM Teams WHERE AllowOpenInvite = true"
		}

		var data []*model.Team
		if _, err := s.GetReplica().Select(&data, query); err != nil {
			result.Err = model.NewLocAppError("SqlTeamStore.GetAllTeams", "store.sql_team.get_all_team_listing.app_error", nil, err.Error())
		}

		for _, team := range data {
			if len(team.InviteId) == 0 {
				team.InviteId = team.Id
			}
		}

		result.Data = data

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlTeamStore) PermanentDelete(teamId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := s.GetMaster().Exec("DELETE FROM Teams WHERE Id = :TeamId", map[string]interface{}{"TeamId": teamId}); err != nil {
			result.Err = model.NewLocAppError("SqlTeamStore.Delete", "store.sql_team.permanent_delete.app_error", nil, "teamId="+teamId+", "+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlTeamStore) AnalyticsTeamCount() StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if c, err := s.GetReplica().SelectInt("SELECT COUNT(*) FROM Teams WHERE DeleteAt = 0", map[string]interface{}{}); err != nil {
			result.Err = model.NewLocAppError("SqlTeamStore.AnalyticsTeamCount", "store.sql_team.analytics_team_count.app_error", nil, err.Error())
		} else {
			result.Data = c
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlTeamStore) SaveMember(member *model.TeamMember) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if result.Err = member.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if count, err := s.GetMaster().SelectInt("SELECT COUNT(0) FROM TeamMembers WHERE TeamId = :TeamId", map[string]interface{}{"TeamId": member.TeamId}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.Save", "store.sql_user.save.member_count.app_error", nil, "teamId="+member.TeamId+", "+err.Error())
			storeChannel <- result
			close(storeChannel)
			return
		} else if int(count) > utils.Cfg.TeamSettings.MaxUsersPerTeam {
			result.Err = model.NewLocAppError("SqlUserStore.Save", "store.sql_user.save.max_accounts.app_error", nil, "teamId="+member.TeamId)
			storeChannel <- result
			close(storeChannel)
			return
		}

		if err := s.GetMaster().Insert(member); err != nil {
			if IsUniqueConstraintError(err.Error(), []string{"TeamId", "teammembers_pkey", "PRIMARY"}) {
				result.Err = model.NewLocAppError("SqlTeamStore.SaveMember", TEAM_MEMBER_EXISTS_ERROR, nil, "team_id="+member.TeamId+", user_id="+member.UserId+", "+err.Error())
			} else {
				result.Err = model.NewLocAppError("SqlTeamStore.SaveMember", "store.sql_team.save_member.save.app_error", nil, "team_id="+member.TeamId+", user_id="+member.UserId+", "+err.Error())
			}
		} else {
			result.Data = member
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlTeamStore) UpdateMember(member *model.TeamMember) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if result.Err = member.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if _, err := s.GetMaster().Update(member); err != nil {
			result.Err = model.NewLocAppError("SqlTeamStore.UpdateMember", "store.sql_team.save_member.save.app_error", nil, err.Error())
		} else {
			result.Data = member
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlTeamStore) GetMember(teamId string, userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var member model.TeamMember
		err := s.GetReplica().SelectOne(&member, "SELECT * FROM TeamMembers WHERE TeamId = :TeamId AND UserId = :UserId", map[string]interface{}{"TeamId": teamId, "UserId": userId})
		if err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewLocAppError("SqlTeamStore.GetMember", "store.sql_team.get_member.missing.app_error", nil, "teamId="+teamId+" userId="+userId+" "+err.Error())
			} else {
				result.Err = model.NewLocAppError("SqlTeamStore.GetMember", "store.sql_team.get_member.app_error", nil, "teamId="+teamId+" userId="+userId+" "+err.Error())
			}
		} else {
			result.Data = member
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlTeamStore) GetMembers(teamId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var members []*model.TeamMember
		_, err := s.GetReplica().Select(&members, "SELECT * FROM TeamMembers WHERE TeamId = :TeamId", map[string]interface{}{"TeamId": teamId})
		if err != nil {
			result.Err = model.NewLocAppError("SqlTeamStore.GetMembers", "store.sql_team.get_members.app_error", nil, "teamId="+teamId+" "+err.Error())
		} else {
			result.Data = members
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlTeamStore) GetTeamsForUser(userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var members []*model.TeamMember
		_, err := s.GetReplica().Select(&members, "SELECT * FROM TeamMembers WHERE UserId = :UserId", map[string]interface{}{"UserId": userId})
		if err != nil {
			result.Err = model.NewLocAppError("SqlTeamStore.GetMembers", "store.sql_team.get_members.app_error", nil, "userId="+userId+" "+err.Error())
		} else {
			result.Data = members
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlTeamStore) RemoveMember(teamId string, userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		_, err := s.GetMaster().Exec("DELETE FROM TeamMembers WHERE TeamId = :TeamId AND UserId = :UserId", map[string]interface{}{"TeamId": teamId, "UserId": userId})
		if err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.RemoveMember", "store.sql_team.remove_member.app_error", nil, "team_id="+teamId+", user_id="+userId+", "+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlTeamStore) RemoveAllMembersByTeam(teamId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		_, err := s.GetMaster().Exec("DELETE FROM TeamMembers WHERE TeamId = :TeamId", map[string]interface{}{"TeamId": teamId})
		if err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.RemoveMember", "store.sql_team.remove_member.app_error", nil, "team_id="+teamId+", "+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlTeamStore) RemoveAllMembersByUser(userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		_, err := s.GetMaster().Exec("DELETE FROM TeamMembers WHERE UserId = :UserId", map[string]interface{}{"UserId": userId})
		if err != nil {
			result.Err = model.NewLocAppError("SqlChannelStore.RemoveMember", "store.sql_team.remove_member.app_error", nil, "user_id="+userId+", "+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
