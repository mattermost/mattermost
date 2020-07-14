// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"net/http"

	sq "github.com/Masterminds/squirrel"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type SqlCommandStore struct {
	SqlStore

	commandsQuery sq.SelectBuilder
}

func newSqlCommandStore(sqlStore SqlStore) store.CommandStore {
	s := &SqlCommandStore{SqlStore: sqlStore}

	s.commandsQuery = s.getQueryBuilder().
		Select("*").
		From("Commands")
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

func (s SqlCommandStore) createIndexesIfNotExists() {
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

	sql, args, err := s.commandsQuery.
		Where(sq.Eq{"Id": id, "DeleteAt": 0}).ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlCommandStore.Get", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	if err = s.GetReplica().SelectOne(&command, sql, args...); err != nil {
		return nil, model.NewAppError("SqlCommandStore.Get", "store.sql_command.save.get.app_error", nil, "id="+id+", err="+err.Error(), http.StatusInternalServerError)
	}

	return &command, nil
}

func (s SqlCommandStore) GetByTeam(teamId string) ([]*model.Command, *model.AppError) {
	var commands []*model.Command
	sql, args, err := s.commandsQuery.
		Where(sq.Eq{"TeamId": teamId, "DeleteAt": 0}).ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlCommandStore.GetByTeam", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	if _, err := s.GetReplica().Select(&commands, sql, args...); err != nil {
		return nil, model.NewAppError("SqlCommandStore.GetByTeam", "store.sql_command.save.get_team.app_error", nil, "teamId="+teamId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return commands, nil
}

func (s SqlCommandStore) GetByTrigger(teamId string, trigger string) (*model.Command, *model.AppError) {
	var command model.Command
	var triggerStr string
	if s.DriverName() == "mysql" {
		triggerStr = "`Trigger`"
	} else {
		triggerStr = "\"trigger\""
	}

	sql, args, err := s.commandsQuery.
		Where(sq.Eq{"TeamId": teamId, "DeleteAt": 0, triggerStr: trigger}).ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlCommandStore.GetByTrigger", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if err := s.GetReplica().SelectOne(&command, sql, args...); err != nil {
		return nil, model.NewAppError("SqlCommandStore.GetByTrigger", "store.sql_command.get_by_trigger.app_error", nil, "teamId="+teamId+", trigger="+trigger+", err="+err.Error(), http.StatusInternalServerError)
	}

	return &command, nil
}

func (s SqlCommandStore) Delete(commandId string, time int64) *model.AppError {
	sql, args, err := s.getQueryBuilder().
		Update("Commands").
		SetMap(sq.Eq{"DeleteAt": time, "UpdateAt": time}).
		Where(sq.Eq{"Id": commandId}).ToSql()
	if err != nil {
		return model.NewAppError("SqlCommandStore.Delete", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	_, err = s.GetMaster().Exec(sql, args...)
	if err != nil {
		return model.NewAppError("SqlCommandStore.Delete", "store.sql_command.save.delete.app_error", nil, "id="+commandId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (s SqlCommandStore) PermanentDeleteByTeam(teamId string) *model.AppError {
	sql, args, err := s.getQueryBuilder().
		Delete("Commands").
		Where(sq.Eq{"TeamId": teamId}).ToSql()
	if err != nil {
		return model.NewAppError("SqlCommandStore.DeleteByTeam", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	_, err = s.GetMaster().Exec(sql, args...)
	if err != nil {
		return model.NewAppError("SqlCommandStore.DeleteByTeam", "store.sql_command.save.delete_perm.app_error", nil, "id="+teamId+", err="+err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (s SqlCommandStore) PermanentDeleteByUser(userId string) *model.AppError {
	sql, args, err := s.getQueryBuilder().
		Delete("Commands").
		Where(sq.Eq{"CreatorId": userId}).ToSql()
	if err != nil {
		return model.NewAppError("SqlCommandStore.DeleteByUser", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	_, err = s.GetMaster().Exec(sql, args...)
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
	query := s.getQueryBuilder().
		Select("COUNT(*)").
		From("Commands").
		Where(sq.Eq{"DeleteAt": 0})

	if len(teamId) > 0 {
		query = query.Where(sq.Eq{"TeamId": teamId})
	}

	sql, args, err := query.ToSql()
	if err != nil {
		return 0, model.NewAppError("SqlCommandStore.AnalyticsCommandCount", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	c, err := s.GetReplica().SelectInt(sql, args...)
	if err != nil {
		return 0, model.NewAppError("SqlCommandStore.AnalyticsCommandCount", "store.sql_command.analytics_command_count.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return c, nil
}
