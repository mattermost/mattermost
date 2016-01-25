// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
)

type SqlCommandStore struct {
	*SqlStore
}

func NewSqlCommandStore(sqlStore *SqlStore) CommandStore {
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
	}

	return s
}

func (s SqlCommandStore) UpgradeSchemaIfNeeded() {
}

func (s SqlCommandStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_command_team_id", "Commands", "TeamId")
}

func (s SqlCommandStore) Save(command *model.Command) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if len(command.Id) > 0 {
			result.Err = model.NewAppError("SqlCommandStore.Save",
				"You cannot overwrite an existing Command", "id="+command.Id)
			storeChannel <- result
			close(storeChannel)
			return
		}

		command.PreSave()
		if result.Err = command.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if err := s.GetMaster().Insert(command); err != nil {
			result.Err = model.NewAppError("SqlCommandStore.Save", "We couldn't save the Command", "id="+command.Id+", "+err.Error())
		} else {
			result.Data = command
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlCommandStore) Get(id string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var command model.Command

		if err := s.GetReplica().SelectOne(&command, "SELECT * FROM Commands WHERE Id = :Id AND DeleteAt = 0", map[string]interface{}{"Id": id}); err != nil {
			result.Err = model.NewAppError("SqlCommandStore.Get", "We couldn't get the command", "id="+id+", err="+err.Error())
		}

		result.Data = &command

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlCommandStore) GetByTeam(teamId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var commands []*model.Command

		if _, err := s.GetReplica().Select(&commands, "SELECT * FROM Commands WHERE TeamId = :TeamId AND DeleteAt = 0", map[string]interface{}{"TeamId": teamId}); err != nil {
			result.Err = model.NewAppError("SqlCommandStore.GetByTeam", "We couldn't get the commands", "teamId="+teamId+", err="+err.Error())
		}

		result.Data = commands

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlCommandStore) Delete(commandId string, time int64) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		_, err := s.GetMaster().Exec("Update Commands SET DeleteAt = :DeleteAt, UpdateAt = :UpdateAt WHERE Id = :Id", map[string]interface{}{"DeleteAt": time, "UpdateAt": time, "Id": commandId})
		if err != nil {
			result.Err = model.NewAppError("SqlCommandStore.Delete", "We couldn't delete the command", "id="+commandId+", err="+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlCommandStore) PermanentDeleteByUser(userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		_, err := s.GetMaster().Exec("DELETE FROM Commands WHERE CreatorId = :UserId", map[string]interface{}{"UserId": userId})
		if err != nil {
			result.Err = model.NewAppError("SqlCommandStore.DeleteByUser", "We couldn't delete the command", "id="+userId+", err="+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlCommandStore) Update(hook *model.Command) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		hook.UpdateAt = model.GetMillis()

		if _, err := s.GetMaster().Update(hook); err != nil {
			result.Err = model.NewAppError("SqlCommandStore.Update", "We couldn't update the command", "id="+hook.Id+", "+err.Error())
		} else {
			result.Data = hook
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
