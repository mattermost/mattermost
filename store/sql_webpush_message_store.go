// Copyright (c) 2015 NAVER Corp. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
)

type SqlWebpushMessageStore struct {
	*SqlStore
}

func NewSqlWebpushMessageStore(sqlStore *SqlStore) WebpushMessageStore {
	s := &SqlWebpushMessageStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.WebpushMessage{}, "WebpushMessages").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("Title").SetMaxSize(1024)
		table.ColMap("Message").SetMaxSize(8000)
		table.ColMap("ToUserId").SetMaxSize(26)
		table.ColMap("Url").SetMaxSize(8000)
		table.ColMap("RegistrationId").SetMaxSize(1024)
	}

	return s
}

func (s SqlWebpushMessageStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_webpush_messages_to_user_id", "WebpushMessages", "FromUserId")
	s.CreateIndexIfNotExists("idx_webpush_messages_registration_id", "WebpushMessages", "RegistrationId")
}

func (s SqlWebpushMessageStore) Save(webpushMessage *model.WebpushMessage) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		webpushMessage.Id = model.NewId()

		if err := s.GetMaster().Insert(webpushMessage); err != nil {
			result.Err = model.NewAppError("SqlWebpushMessageStore.Save",
				"We encountered an error saving the webpush message",
				"to_user_id="+webpushMessage.ToUserId+", "+err.Error())
		} else {
			result.Data = webpushMessage
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlWebpushMessageStore) PopByUserId(userId string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var webpush_messages []*model.WebpushMessage

		if transaction, err := s.GetMaster().Begin(); err != nil {
			result.Err = model.NewAppError(
				"SqlWebpushEndpointStore.Save",
				"Unable to open transaction",
				err.Error())
		} else {
			if _, err := transaction.Select(&webpush_messages,
				`SELECT * FROM WebpushMessages WHERE ToUserId = :ToUserId`,
				map[string]interface{}{"ToUserId": userId}); err != nil {
				result.Err = model.NewAppError(
					"SqlWebpushMessageStore.PopByUserId",
					"We encountered an error while finding webpush messages",
					err.Error())
				transaction.Rollback()
			} else if len(webpush_messages) > 0 {
				result.Data = webpush_messages[0]
				if _, err := transaction.Exec(
					`DELETE FROM WebpushMessages WHERE Id = :Id`,
					map[string]interface{}{"Id": webpush_messages[0].Id}); err != nil {
					result.Err = model.NewAppError(
						"SqlWebpushMessageStore.PopByUserId",
						"We encountered an error while deleting webpush messages",
						err.Error())
					transaction.Rollback()
				} else {
					if err := transaction.Commit(); err != nil {
						result.Err = model.NewAppError("SqlWebpushMessageStore.PopByUserId", "Unable to commit transaction", err.Error())
					}
				}
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlWebpushMessageStore) PopAllByUserIdAndRegistrationId(userId string, registrationId string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var webpush_messages []*model.WebpushMessage

		if transaction, err := s.GetMaster().Begin(); err != nil {
			result.Err = model.NewAppError(
				"SqlWebpushEndpointStore.PopAllByUserIdAndRegistrationId",
				"Unable to open transaction",
				err.Error())
		} else {
			if _, err := transaction.Select(&webpush_messages,
				`SELECT * FROM WebpushMessages WHERE ToUserId = :ToUserId AND RegistrationId = :RegistrationId`,
				map[string]interface{}{"ToUserId": userId, "RegistrationId": registrationId}); err != nil {
				result.Err = model.NewAppError(
					"SqlWebpushMessageStore.PopAllByUserIdAndRegistrationId",
					"We encountered an error while finding webpush messages",
					err.Error())
				transaction.Rollback()
			} else {
				result.Data = webpush_messages
				if _, err := transaction.Exec(
					`DELETE FROM WebpushMessages WHERE ToUserId = :ToUserId and RegistrationId = :RegistrationId`,
					map[string]interface{}{"ToUserId": userId, "RegistrationId": registrationId}); err != nil {
					result.Err = model.NewAppError(
						"SqlWebpushMessageStore.PopAllByUserIdAndRegistrationId",
						"We encountered an error while deleting webpush messages",
						err.Error())
					transaction.Rollback()
				} else {
					if err := transaction.Commit(); err != nil {
						result.Err = model.NewAppError("SqlWebpushMessageStore.PopAllByUserIdAndRegistrationId", "Unable to commit transaction", err.Error())
					}
				}
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel

}
