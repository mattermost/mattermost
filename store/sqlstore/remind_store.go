// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type SqlRemindStore struct {
	SqlStore
}

func NewSqlRemindStore(sqlStore SqlStore) store.RemindStore {
	s := &SqlRemindStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Reminder{}, "Reminders").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("TeamId").SetMaxSize(64)
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("Target").SetMaxSize(64)
		table.ColMap("Message").SetMaxSize(4096)
		table.ColMap("When").SetMaxSize(128)
		table.ColMap("Completed").SetMaxSize(40)

		table2 := db.AddTableWithName(model.Occurrence{}, "Occurrences").SetKeys(false, "Id")
		table2.ColMap("Id").SetMaxSize(26)
		table2.ColMap("UserId").SetMaxSize(26)
		table2.ColMap("ReminderId").SetMaxSize(26)
		table2.ColMap("Occurrence").SetMaxSize(40)
		table2.ColMap("Snoozed").SetMaxSize(40)
		table2.ColMap("Repeat").SetMaxSize(128)
	}
	return s
}

func (s SqlRemindStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_reminder_user_id", "Reminders", "UserId")
	s.CreateIndexIfNotExists("idx_occurrence_user_id", "Occurrences", "UserId")
	s.CreateIndexIfNotExists("idx_occurrence_occurrence", "Occurrences", "Occurrence")
	s.CreateIndexIfNotExists("idx_occurrence_snoozed", "Occurrences", "Snoozed")
}

func (s SqlRemindStore) SaveReminder(reminder *model.Reminder) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if err := s.GetReplica().SelectOne(&model.Reminder{},"SELECT * FROM Reminders WHERE Id = :Id",map[string]interface{}{"Id": reminder.Id}); err == nil {
			if _, err := s.GetMaster().Update(reminder); err != nil {
				result.Err = model.NewAppError("SqlRemindStore.SaveReminder", "store.sql_remind.save_reminder.saving.app_error", nil, "reminderId="+reminder.Id, http.StatusInternalServerError)
			}
		} else {
			if err := s.GetMaster().Insert(reminder); err != nil {
				result.Err = model.NewAppError("SqlRemindStore.SaveReminder", "store.sql_remind.save_reminder.saving.app_error", nil, "reminderId="+reminder.Id, http.StatusInternalServerError)
			}
		}

	})
}

func (s SqlRemindStore) SaveOccurrence(occurrence *model.Occurrence) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if err := s.GetReplica().SelectOne(&model.Occurrence{},"SELECT * FROM Occurrences WHERE Id = :Id",map[string]interface{}{"Id": occurrence.Id}); err == nil {
			if _, err := s.GetMaster().Update(occurrence); err != nil {
				result.Err = model.NewAppError("SqlRemindStore.SaveOccurrence", "store.sql_remind.save_occurrence.saving.app_error", nil, "occurrenceId="+occurrence.Id, http.StatusInternalServerError)
			}
		} else {
			if err := s.GetMaster().Insert(occurrence); err != nil {
				result.Err = model.NewAppError("SqlRemindStore.SaveOccurrence", "store.sql_remind.save_occurrence.saving.app_error", nil, "occurrenceId="+occurrence.Id, http.StatusInternalServerError)
			}
		}
	})
}

func (s SqlRemindStore) GetByUser(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {

		query := "SELECT * FROM Reminders WHERE UserId = :UserId"
		var reminders model.Reminders
		if _, err := s.GetReplica().Select(
			&reminders,
			query,
			map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlRemindStore.GetByUser", "store.sql_remind.get_by_user.app_error", nil, "UserId="+userId+", "+err.Error(), http.StatusInternalServerError)
			if err == sql.ErrNoRows {
				result.Err.StatusCode = http.StatusNotFound
			}
		} else {
			result.Data = reminders
		}

	})
}

func (s SqlRemindStore) GetByTime(time string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {

		query := "SELECT * FROM Occurrences WHERE Occurrence = :Occurrence or Snoozed = :Occurrence"

		var occurrences model.Occurrences
		if _, err := s.GetReplica().Select(
			&occurrences,
			query,
			map[string]interface{}{"Occurrence": time}); err != nil {
			mlog.Error(err.Error())
			result.Err = model.NewAppError("SqlRemindStore.GetByTime", "store.sql_remind.get_by_time.app_error", nil, "time="+fmt.Sprintf("%v", time)+", "+err.Error(), http.StatusInternalServerError)
		}
		result.Data = occurrences
	})
}

func (s SqlRemindStore) GetReminder(reminderId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {

		query := "SELECT * FROM Reminders WHERE Id = :ReminderId"
		var reminder model.Reminder
		if err := s.GetReplica().SelectOne(
			&reminder,
			query,
			map[string]interface{}{"ReminderId": reminderId}); err != nil {
			result.Err = model.NewAppError("SqlRemindStore.GetReminder", "store.sql_remind.get_reminder.app_error", nil, "Id="+reminderId+", "+err.Error(), http.StatusInternalServerError)
			if err == sql.ErrNoRows {
				result.Err.StatusCode = http.StatusNotFound
			}
		}
		result.Data = reminder
	})
}

func (s SqlRemindStore) GetByReminder(reminderId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {

		query := "SELECT * FROM Occurrences WHERE ReminderId = :ReminderId"
		var occurrences model.Occurrences
		if _, err := s.GetReplica().Select(
			&occurrences,
			query,
			map[string]interface{}{"ReminderId": reminderId}); err != nil {
			result.Err = model.NewAppError("SqlRemindStore.GetByReminder", "store.sql_remind.get_by_reminder.app_error", nil, "Id="+reminderId+", "+err.Error(), http.StatusInternalServerError)
			if err == sql.ErrNoRows {
				result.Err.StatusCode = http.StatusNotFound
			}
		}
		result.Data = occurrences
	})
}

func (s SqlRemindStore) GetOccurrence(occurrenceId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {

		query := "SELECT * FROM Occurrences WHERE Id = :Id"
		var occurrence model.Occurrence
		if err := s.GetReplica().SelectOne(
			&occurrence,
			query,
			map[string]interface{}{"Id": occurrenceId}); err != nil {
			result.Err = model.NewAppError("SqlRemindStore.GetOccurrence", "store.sql_remind.get_by_reminder.app_error", nil, "Id="+occurrenceId+", "+err.Error(), http.StatusInternalServerError)
			if err == sql.ErrNoRows {
				result.Err.StatusCode = http.StatusNotFound
			}
		}
		result.Data = occurrence
	})
}

func (s SqlRemindStore) DeleteForUser(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := s.GetMaster().Exec("DELETE FROM Reminders WHERE UserId = :UserId",
			map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlRemindStore.DeleteForUser", "store.sql_remind.delete_for_user.app_error", nil, "UserId="+userId, http.StatusInternalServerError)
		}
		if _, err := s.GetMaster().Exec("DELETE FROM Occurrences WHERE UserId = :UserId",
			map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlRemindStore.DeleteForUser", "store.sql_remind.delete_for_user.app_error", nil, "UserId="+userId, http.StatusInternalServerError)
		}
	})
}

func (s SqlRemindStore) DeleteByReminder(reminderId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := s.GetMaster().Exec("DELETE FROM Reminders WHERE Id = :Id",
			map[string]interface{}{"Id": reminderId}); err != nil {
			result.Err = model.NewAppError("SqlRemindStore.DeleteByReminder", "store.sql_remind.delete_by_reminder.app_error", nil, "Id="+reminderId, http.StatusInternalServerError)
		}
		if _, err := s.GetMaster().Exec("DELETE FROM Occurrences WHERE ReminderId = :ReminderId",
			map[string]interface{}{"ReminderId": reminderId}); err != nil {
			result.Err = model.NewAppError("SqlRemindStore.DeleteByReminder", "store.sql_remind.delete_by_reminder.app_error", nil, "ReminderId="+reminderId, http.StatusInternalServerError)
		}
	})
}

func (s SqlRemindStore) DeleteForReminder(reminderId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := s.GetMaster().Exec("DELETE FROM Occurrences WHERE ReminderId = :ReminderId",
			map[string]interface{}{"ReminderId": reminderId}); err != nil {
			result.Err = model.NewAppError("SqlRemindStore.DeleteForReminder", "store.sql_remind.delete_for_reminder.app_error", nil, "ReminderId="+reminderId, http.StatusInternalServerError)
		}
	})
}
