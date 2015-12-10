// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
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
	}

	return s
}

func (s SqlTeamStore) UpgradeSchemaIfNeeded() {
	s.RemoveColumnIfExists("Teams", "AllowValet")
	s.CreateColumnIfNotExists("Teams", "InviteId", "varchar(32)", "varchar(32)", "")
	s.CreateColumnIfNotExists("Teams", "AllowOpenInvite", "tinyint(1)", "boolean", "0")
	s.CreateColumnIfNotExists("Teams", "AllowTeamListing", "tinyint(1)", "boolean", "0")
}

func (s SqlTeamStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_teams_name", "Teams", "Name")
	s.CreateIndexIfNotExists("idx_teams_invite_id", "Teams", "InviteId")
}

func (s SqlTeamStore) Save(team *model.Team, T goi18n.TranslateFunc) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if len(team.Id) > 0 {
			result.Err = model.NewAppError("SqlTeamStore.Save",
				T("Must call update for exisiting team"), "id="+team.Id)
			storeChannel <- result
			close(storeChannel)
			return
		}

		team.PreSave()

		if result.Err = team.IsValid(*utils.Cfg.TeamSettings.RestrictTeamNames, T); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if err := s.GetMaster().Insert(team); err != nil {
			if IsUniqueConstraintError(err.Error(), "Name", "teams_name_key") {
				result.Err = model.NewAppError("SqlTeamStore.Save", T("A team with that domain already exists"), "id="+team.Id+", "+err.Error())
			} else {
				result.Err = model.NewAppError("SqlTeamStore.Save", T("We couldn't save the team"), "id="+team.Id+", "+err.Error())
			}
		} else {
			result.Data = team
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlTeamStore) Update(team *model.Team, T goi18n.TranslateFunc) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		team.PreUpdate()

		if result.Err = team.IsValid(*utils.Cfg.TeamSettings.RestrictTeamNames, T); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if oldResult, err := s.GetMaster().Get(model.Team{}, team.Id); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.Update", T("We encounted an error finding the team"), "id="+team.Id+", "+err.Error())
		} else if oldResult == nil {
			result.Err = model.NewAppError("SqlTeamStore.Update", T("We couldn't find the existing team to update"), "id="+team.Id)
		} else {
			oldTeam := oldResult.(*model.Team)
			team.CreateAt = oldTeam.CreateAt
			team.UpdateAt = model.GetMillis()
			team.Name = oldTeam.Name

			if count, err := s.GetMaster().Update(team); err != nil {
				result.Err = model.NewAppError("SqlTeamStore.Update", T("We encounted an error updating the team"), "id="+team.Id+", "+err.Error())
			} else if count != 1 {
				result.Err = model.NewAppError("SqlTeamStore.Update", T("We couldn't update the team"), "id="+team.Id)
			} else {
				result.Data = team
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlTeamStore) UpdateDisplayName(name string, teamId string, T goi18n.TranslateFunc) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := s.GetMaster().Exec("UPDATE Teams SET DisplayName = :Name WHERE Id = :Id", map[string]interface{}{"Name": name, "Id": teamId}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.UpdateName", T("We couldn't update the team name"), "team_id="+teamId)
		} else {
			result.Data = teamId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlTeamStore) Get(id string, T goi18n.TranslateFunc) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if obj, err := s.GetReplica().Get(model.Team{}, id); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.Get", T("We encounted an error finding the team"), "id="+id+", "+err.Error())
		} else if obj == nil {
			result.Err = model.NewAppError("SqlTeamStore.Get", T("We couldn't find the existing team"), "id="+id)
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

func (s SqlTeamStore) GetByInviteId(inviteId string, T goi18n.TranslateFunc) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		team := model.Team{}

		if err := s.GetReplica().SelectOne(&team, "SELECT * FROM Teams WHERE Id = :InviteId OR InviteId = :InviteId", map[string]interface{}{"InviteId": inviteId}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetByInviteId", "We couldn't find the existing team", "inviteId="+inviteId+", "+err.Error())
		}

		if len(team.InviteId) == 0 {
			team.InviteId = team.Id
		}

		if len(inviteId) == 0 || team.InviteId != inviteId {
			result.Err = model.NewAppError("SqlTeamStore.GetByInviteId", "We couldn't find the existing team", "inviteId="+inviteId)
		}

		result.Data = &team

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlTeamStore) GetByName(name string, T goi18n.TranslateFunc) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		team := model.Team{}

		if err := s.GetReplica().SelectOne(&team, "SELECT * FROM Teams WHERE Name = :Name", map[string]interface{}{"Name": name}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetByName", T("We couldn't find the existing team"), "name="+name+", "+err.Error())
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

func (s SqlTeamStore) GetTeamsForEmail(email string, T goi18n.TranslateFunc) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var data []*model.Team
		if _, err := s.GetReplica().Select(&data, "SELECT Teams.* FROM Teams, Users WHERE Teams.Id = Users.TeamId AND Users.Email = :Email", map[string]interface{}{"Email": email}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetTeamsForEmail", T("We encounted a problem when looking up teams"), "email="+email+", "+err.Error())
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

func (s SqlTeamStore) GetAll(T goi18n.TranslateFunc) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var data []*model.Team
		if _, err := s.GetReplica().Select(&data, "SELECT * FROM Teams"); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetAllTeams", T("We could not get all teams"), err.Error())
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

func (s SqlTeamStore) GetAllTeamListing(T goi18n.TranslateFunc) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		query := "SELECT * FROM Teams WHERE AllowTeamListing = 1"

		if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
			query = "SELECT * FROM Teams WHERE AllowTeamListing = true"
		}

		var data []*model.Team
		if _, err := s.GetReplica().Select(&data, query); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.GetAllTeams", "We could not get all teams", err.Error())
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

func (s SqlTeamStore) PermanentDelete(teamId string, T goi18n.TranslateFunc) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := s.GetMaster().Exec("DELETE FROM Teams WHERE Id = :TeamId", map[string]interface{}{"TeamId": teamId}); err != nil {
			result.Err = model.NewAppError("SqlTeamStore.Delete", "We couldn't delete the existing team", "teamId="+teamId+", "+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
