// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type SqlCommandStore struct {
	SqlStore
}

func NewSqlCommandStore(sqlStore SqlStore) store.CommandStore {
	s := &SqlCommandStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		tableo := db.AddTableWithName(model.Command{}, "Commands").SetKeys(false, "Id")
		tableo.ColMap("Id").SetMaxSize(26)
		tableo.ColMap("Token").SetMaxSize(26)
		tableo.ColMap("CreatorId").SetMaxSize(26)
		tableo.ColMap("TeamId").SetMaxSize(26)
		tableo.ColMap("Trigger").SetMaxSize(128)
		tableo.ColMap("URL").SetMaxSize(1024)
		tableo.ColMap("Method").SetMaxSize(1)
		tableo.ColMap("Username").SetMaxSize(64)
		tableo.ColMap("IconURL").SetMaxSize(1024)
		tableo.ColMap("AutoCompleteDesc").SetMaxSize(1024)
		tableo.ColMap("AutoCompleteHint").SetMaxSize(1024)
		tableo.ColMap("DisplayName").SetMaxSize(64)
		tableo.ColMap("Description").SetMaxSize(128)
	}

	return s
}

func (s SqlCommandStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_command_team_id", "Commands", "TeamId")
	s.CreateIndexIfNotExists("idx_command_update_at", "Commands", "UpdateAt")
	s.CreateIndexIfNotExists("idx_command_create_at", "Commands", "CreateAt")
	s.CreateIndexIfNotExists("idx_command_delete_at", "Commands", "DeleteAt")
}

func (s SqlCommandStore) Save(command *model.Command) (*model.Command, *model.AppError) {
	if len(command.Id) > 0 {
		return nil, model.NewAppError("SqlCommandStore.Save", "store.sql_command.save.saving_overwrite.app_error", nil, "id="+command.Id, http.StatusBadRequest)
	}

	command.PreSave()
	if err := command.IsValid(); err != nil {
		return nil, err
	}

	if err := s.GetMaster().Insert(command); err != nil {
		return nil, model.NewAppError("SqlCommandStore.Save", "store.sql_command.save.saving.app_error", nil, "id="+command.Id+", "+err.Error(), http.StatusInternalServerError)
	}

	return command, nil
}

func (s SqlCommandStore) Get(id string) (*model.Command, *model.AppError) {
	var command model.Command

	if err := s.GetReplica().SelectOne(&command, "SELECT * FROM Commands WHERE Id = :Id AND DeleteAt = 0", map[string]interface{}{"Id": id}); err != nil {
		return nil, model.NewAppError("SqlCommandStore.Get", "store.sql_command.save.get.app_error", nil, "id="+id+", err="+err.Error(), http.StatusInternalServerError)
	}

	return &command, nil
}

func (s SqlCommandStore) GetByTeam(teamId string) ([]*model.Command, *model.AppError) {
	var commands []*model.Command

	if _, err := s.GetReplica().Select(&commands, "SELECT * FROM Commands WHERE TeamId = :TeamId AND DeleteAt = 0", map[string]interface{}{"TeamId": teamId}); err != nil {
		return nil, model.NewAppError("SqlCommandStore.GetByTeam", "store.sql_command.save.get_team.app_error", nil, "teamId="+teamId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return commands, nil
}

func (s SqlCommandStore) GetByTrigger(teamId string, trigger string) (*model.Command, *model.AppError) {
	var command model.Command

	var query string
	if s.DriverName() == "mysql" {
		query = "SELECT * FROM Commands WHERE TeamId = :TeamId AND `Trigger` = :Trigger AND DeleteAt = 0"
	} else {
		query = "SELECT * FROM Commands WHERE TeamId = :TeamId AND \"trigger\" = :Trigger AND DeleteAt = 0"
	}

	if err := s.GetReplica().SelectOne(&command, query, map[string]interface{}{"TeamId": teamId, "Trigger": trigger}); err != nil {
		return nil, model.NewAppError("SqlCommandStore.GetByTrigger", "store.sql_command.get_by_trigger.app_error", nil, "teamId="+teamId+", trigger="+trigger+", err="+err.Error(), http.StatusInternalServerError)
	}

	return &command, nil
}

func (s SqlCommandStore) Delete(commandId string, time int64) *model.AppError {
	_, err := s.GetMaster().Exec("Update Commands SET DeleteAt = :DeleteAt, UpdateAt = :UpdateAt WHERE Id = :Id", map[string]interface{}{"DeleteAt": time, "UpdateAt": time, "Id": commandId})
	if err != nil {
		return model.NewAppError("SqlCommandStore.Delete", "store.sql_command.save.delete.app_error", nil, "id="+commandId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (s SqlCommandStore) PermanentDeleteByTeam(teamId string) *model.AppError {
	_, err := s.GetMaster().Exec("DELETE FROM Commands WHERE TeamId = :TeamId", map[string]interface{}{"TeamId": teamId})
	if err != nil {
		return model.NewAppError("SqlCommandStore.DeleteByTeam", "store.sql_command.save.delete_perm.app_error", nil, "id="+teamId+", err="+err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (s SqlCommandStore) PermanentDeleteByUser(userId string) *model.AppError {
	_, err := s.GetMaster().Exec("DELETE FROM Commands WHERE CreatorId = :UserId", map[string]interface{}{"UserId": userId})
	if err != nil {
		return model.NewAppError("SqlCommandStore.DeleteByUser", "store.sql_command.save.delete_perm.app_error", nil, "id="+userId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (s SqlCommandStore) Update(cmd *model.Command) (*model.Command, *model.AppError) {
	cmd.UpdateAt = model.GetMillis()

	if err := cmd.IsValid(); err != nil {
		return nil, err
	}

	if _, err := s.GetMaster().Update(cmd); err != nil {
		return nil, model.NewAppError("SqlCommandStore.Update", "store.sql_command.save.update.app_error", nil, "id="+cmd.Id+", "+err.Error(), http.StatusInternalServerError)
	}

	return cmd, nil
}

func (s SqlCommandStore) AnalyticsCommandCount(teamId string) (int64, *model.AppError) {
	query :=
		`SELECT
			COUNT(*)
		FROM
			Commands
		WHERE
			DeleteAt = 0`

	if len(teamId) > 0 {
		query += " AND TeamId = :TeamId"
	}

	c, err := s.GetReplica().SelectInt(query, map[string]interface{}{"TeamId": teamId})
	if err != nil {
		return 0, model.NewAppError("SqlCommandStore.AnalyticsCommandCount", "store.sql_command.analytics_command_count.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return c, nil
}
