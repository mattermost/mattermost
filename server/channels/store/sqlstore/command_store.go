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

type SqlCommandStore struct {
	*SqlStore

	commandsQuery sq.SelectBuilder
}

func newSqlCommandStore(sqlStore *SqlStore) store.CommandStore {
	s := &SqlCommandStore{SqlStore: sqlStore}

	s.commandsQuery = s.getQueryBuilder().
		Select("*").
		From("Commands")
	return s
}

func (s SqlCommandStore) Save(command *model.Command) (*model.Command, error) {
	if command.Id != "" {
		return nil, store.NewErrInvalidInput("Command", "CommandId", command.Id)
	}

	command.PreSave()
	if err := command.IsValid(); err != nil {
		return nil, err
	}

	// Trigger is a keyword
	trigger := s.toReserveCase("trigger")

	if _, err := s.GetMasterX().NamedExec(`INSERT INTO Commands (Id, Token, CreateAt,
		UpdateAt, DeleteAt, CreatorId, TeamId, `+trigger+`, Method, Username,
		IconURL, AutoComplete, AutoCompleteDesc, AutoCompleteHint, DisplayName, Description,
		URL, PluginId)
	VALUES (:Id, :Token, :CreateAt, :UpdateAt, :DeleteAt, :CreatorId, :TeamId, :Trigger, :Method,
		:Username, :IconURL, :AutoComplete, :AutoCompleteDesc, :AutoCompleteHint, :DisplayName,
		:Description, :URL, :PluginId)`, command); err != nil {
		return nil, errors.Wrapf(err, "insert: command_id=%s", command.Id)
	}

	return command, nil
}

func (s SqlCommandStore) Get(id string) (*model.Command, error) {
	var command model.Command

	query, args, err := s.commandsQuery.
		Where(sq.Eq{"Id": id, "DeleteAt": 0}).ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "commands_tosql")
	}
	if err = s.GetReplicaX().Get(&command, query, args...); err == sql.ErrNoRows {
		return nil, store.NewErrNotFound("Command", id)
	} else if err != nil {
		return nil, errors.Wrapf(err, "selectone: command_id=%s", id)
	}

	return &command, nil
}

func (s SqlCommandStore) GetByTeam(teamId string) ([]*model.Command, error) {
	commands := []*model.Command{}

	sql, args, err := s.commandsQuery.
		Where(sq.Eq{"TeamId": teamId, "DeleteAt": 0}).ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "commands_tosql")
	}
	if err := s.GetReplicaX().Select(&commands, sql, args...); err != nil {
		return nil, errors.Wrapf(err, "select: team_id=%s", teamId)
	}

	return commands, nil
}

func (s SqlCommandStore) GetByTrigger(teamId string, trigger string) (*model.Command, error) {
	var command model.Command
	var triggerStr string
	if s.DriverName() == "mysql" {
		triggerStr = "`Trigger`"
	} else {
		triggerStr = "\"trigger\""
	}

	query, args, err := s.commandsQuery.
		Where(sq.Eq{"TeamId": teamId, "DeleteAt": 0, triggerStr: trigger}).ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "commands_tosql")
	}

	if err := s.GetReplicaX().Get(&command, query, args...); err == sql.ErrNoRows {
		errorId := "teamId=" + teamId + ", trigger=" + trigger
		return nil, store.NewErrNotFound("Command", errorId)
	} else if err != nil {
		return nil, errors.Wrapf(err, "selectone: team_id=%s, trigger=%s", teamId, trigger)
	}

	return &command, nil
}

func (s SqlCommandStore) Delete(commandId string, time int64) error {
	sql, args, err := s.getQueryBuilder().
		Update("Commands").
		SetMap(sq.Eq{"DeleteAt": time, "UpdateAt": time}).
		Where(sq.Eq{"Id": commandId}).ToSql()
	if err != nil {
		return errors.Wrapf(err, "commands_tosql")
	}

	_, err = s.GetMasterX().Exec(sql, args...)
	if err != nil {
		errors.Wrapf(err, "delete: command_id=%s", commandId)
	}

	return nil
}

func (s SqlCommandStore) PermanentDeleteByTeam(teamId string) error {
	sql, args, err := s.getQueryBuilder().
		Delete("Commands").
		Where(sq.Eq{"TeamId": teamId}).ToSql()
	if err != nil {
		return errors.Wrapf(err, "commands_tosql")
	}
	_, err = s.GetMasterX().Exec(sql, args...)
	if err != nil {
		return errors.Wrapf(err, "delete: team_id=%s", teamId)
	}
	return nil
}

func (s SqlCommandStore) PermanentDeleteByUser(userId string) error {
	sql, args, err := s.getQueryBuilder().
		Delete("Commands").
		Where(sq.Eq{"CreatorId": userId}).ToSql()
	if err != nil {
		return errors.Wrapf(err, "commands_tosql")
	}
	_, err = s.GetMasterX().Exec(sql, args...)
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

	query := s.getQueryBuilder().
		Update("Commands").
		Set("Token", cmd.Token).
		Set("CreateAt", cmd.CreateAt).
		Set("UpdateAt", cmd.UpdateAt).
		Set("CreatorId", cmd.CreatorId).
		Set("TeamId", cmd.TeamId).
		Set("Method", cmd.Method).
		Set("Username", cmd.Username).
		Set("IconURL", cmd.IconURL).
		Set("AutoComplete", cmd.AutoComplete).
		Set("AutoCompleteDesc", cmd.AutoCompleteDesc).
		Set("AutoCompleteHint", cmd.AutoCompleteHint).
		Set("DisplayName", cmd.DisplayName).
		Set("Description", cmd.Description).
		Set("URL", cmd.URL).
		Set("PluginId", cmd.PluginId).
		Where(sq.Eq{"Id": cmd.Id})

	// Trigger is a keyword
	query = query.Set(s.toReserveCase("trigger"), cmd.Trigger)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "commands_tosql")
	}

	res, err := s.GetMasterX().Exec(queryString, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to update commands")
	}
	count, err := res.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "error while getting rows_affected")
	}
	if count > 1 {
		return nil, fmt.Errorf("unexpected count while updating commands: count=%d, Id=%s", count, cmd.Id)
	}
	return cmd, nil
}

func (s SqlCommandStore) AnalyticsCommandCount(teamId string) (int64, error) {
	query := s.getQueryBuilder().
		Select("COUNT(*)").
		From("Commands").
		Where(sq.Eq{"DeleteAt": 0})

	if teamId != "" {
		query = query.Where(sq.Eq{"TeamId": teamId})
	}

	sql, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrapf(err, "commands_tosql")
	}

	var c int64
	err = s.GetReplicaX().Get(&c, sql, args...)
	if err != nil {
		return 0, errors.Wrapf(err, "unable to count the commands: team_id=%s", teamId)
	}
	return c, nil
}
