// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"

	"github.com/pkg/errors"
)

type SqlCommandStore struct {
	SqlStore
}

func newSqlCommandStore(sqlStore SqlStore) store.CommandStore {
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

func (s SqlCommandStore) createIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_command_team_id", "Commands", "TeamId")
	s.CreateIndexIfNotExists("idx_command_update_at", "Commands", "UpdateAt")
	s.CreateIndexIfNotExists("idx_command_create_at", "Commands", "CreateAt")
	s.CreateIndexIfNotExists("idx_command_delete_at", "Commands", "DeleteAt")
}

func (s SqlCommandStore) Save(command *model.Command) (*model.Command, error) {
	if len(command.Id) > 0 {
		return nil, store.NewErrInvalidInput("Command", "CommandId", command.Id)
	}

	command.PreSave()
	if err := command.IsValid(); err != nil {
		return nil, err
	}

	if err := s.GetMaster().Insert(command); err != nil {
		return nil, errors.Wrapf(err, "insert: command_id=%s", command.Id)
	}

	return command, nil
}

func (s SqlCommandStore) Get(id string) (*model.Command, error) {
	var command model.Command

	if err := s.GetReplica().SelectOne(&command, "SELECT * FROM Commands WHERE Id = :Id AND DeleteAt = 0", map[string]interface{}{"Id": id}); err == sql.ErrNoRows {
		return nil, store.NewErrNotFound("Command", id)
	} else if err != nil {
		return nil, errors.Wrapf(err, "selectone: command_id=%s", id)
	}

	return &command, nil
}

func (s SqlCommandStore) GetByTeam(teamId string) ([]*model.Command, error) {
	var commands []*model.Command

	if _, err := s.GetReplica().Select(&commands, "SELECT * FROM Commands WHERE TeamId = :TeamId AND DeleteAt = 0", map[string]interface{}{"TeamId": teamId}); err != nil {
		return nil, errors.Wrapf(err, "selectbyteam: team_id=%s", teamId)
	}

	return commands, nil
}

func (s SqlCommandStore) GetByTrigger(teamId string, trigger string) (*model.Command, error) {
	var command model.Command

	var query string
	if s.DriverName() == "mysql" {
		query = "SELECT * FROM Commands WHERE TeamId = :TeamId AND `Trigger` = :Trigger AND DeleteAt = 0"
	} else {
		query = "SELECT * FROM Commands WHERE TeamId = :TeamId AND \"trigger\" = :Trigger AND DeleteAt = 0"
	}

	if err := s.GetReplica().SelectOne(&command, query, map[string]interface{}{"TeamId": teamId, "Trigger": trigger}); err == sql.ErrNoRows {
		return nil, store.NewErrNotFound("Command", trigger)
	} else if err != nil {
		return nil, errors.Wrapf(err, "selectbytrigger: team_id=%s, trigger=%s", teamId, trigger)
	}

	return &command, nil
}

func (s SqlCommandStore) Delete(commandId string, time int64) error {
	_, err := s.GetMaster().Exec("Update Commands SET DeleteAt = :DeleteAt, UpdateAt = :UpdateAt WHERE Id = :Id", map[string]interface{}{"DeleteAt": time, "UpdateAt": time, "Id": commandId})
	if err != nil {
		errors.Wrapf(err, "delete: command_id=%s", commandId)
	}

	return nil
}

func (s SqlCommandStore) PermanentDeleteByTeam(teamId string) error {
	_, err := s.GetMaster().Exec("DELETE FROM Commands WHERE TeamId = :TeamId", map[string]interface{}{"TeamId": teamId})
	if err != nil {
		return errors.Wrapf(err, "delete: team_id=%s", teamId)
	}
	return nil
}

func (s SqlCommandStore) PermanentDeleteByUser(userId string) error {
	_, err := s.GetMaster().Exec("DELETE FROM Commands WHERE CreatorId = :UserId", map[string]interface{}{"UserId": userId})
	if err != nil {
		return errors.Wrapf(err, "delete: user_id=%s", userId)
	}

	return nil
}

func (s SqlCommandStore) Update(cmd *model.Command) (*model.Command, error) {
	cmd.UpdateAt = model.GetMillis()

	if err := cmd.IsValid(); err != nil {
		return nil, err
	}

	if _, err := s.GetMaster().Update(cmd); err != nil {
		return nil, errors.Wrapf(err, "update: command_id=%s", cmd.Id)
	}

	return cmd, nil
}

func (s SqlCommandStore) AnalyticsCommandCount(teamId string) (int64, error) {
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
		return 0, errors.Wrapf(err, "unable to count the commands: team_id=%s", teamId)
	}
	return c, nil
}
