// Copyright (c) 2016 NAVER Corp. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
)

type SqlWebpushEndpointStore struct {
	*SqlStore
}

func NewSqlWebpushEndpointStore(sqlStore *SqlStore) WebpushEndpointStore {
	s := &SqlWebpushEndpointStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.WebpushEndpoint{}, "WebpushEndpoints").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("Endpoint").SetMaxSize(8000)
	}

	return s
}

func (s SqlWebpushEndpointStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_webpush_endpoints_create_at", "WebpushEndpoints", "CreateAt")
	s.CreateIndexIfNotExists("idx_webpush_endpoints_user_id", "WebpushEndpoints", "UserId")
	s.CreateIndexIfNotExists("idx_webpush_endpoints_end_point", "WebpushEndpoints", "Endpoint")
}

func (s SqlWebpushEndpointStore) Save(webpushEndpoint *model.WebpushEndpoint) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if transaction, err := s.GetMaster().Begin(); err != nil {
			result.Err = model.NewAppError("SqlWebpushEndpointStore.Save", "Unable to open transaction", err.Error())
		} else {
			if count, err := transaction.SelectInt(
				"SELECT COUNT(0) FROM WebpushEndpoints WHERE UserId = :UserId and Endpoint = :Endpoint",
				map[string]interface{}{
					"UserId":   webpushEndpoint.UserId,
					"Endpoint": webpushEndpoint.Endpoint}); err != nil {

				result.Err = model.NewAppError(
					"SqlWebpushEndpointStore.Save",
					"Failed to get webpush endpoint count",
					"user_id="+webpushEndpoint.UserId+" endpoint="+webpushEndpoint.Endpoint+", "+err.Error())
				transaction.Rollback()
			} else if count > 0 {
				result.Err = model.NewAppError(
					"SqlWebpushEndpointStore.Save",
					"The endpoint already exists.",
					"user_id="+webpushEndpoint.UserId+" endpoint="+webpushEndpoint.Endpoint)
				transaction.Rollback()
			} else {
				webpushEndpoint.Id = model.NewId()
				webpushEndpoint.CreateAt = model.GetMillis()

				if err := transaction.Insert(webpushEndpoint); err != nil {
					result.Err = model.NewAppError(
						"SqlWebpushEndpointStore.Save",
						"We encountered an error saving the webpush endpoint",
						"user_id="+webpushEndpoint.UserId+" endpoint="+webpushEndpoint.Endpoint+", "+err.Error())
					transaction.Rollback()
				} else {
					if err := transaction.Commit(); err != nil {
						result.Err = model.NewAppError("SqlWebpushEndpointStore.Save", "Unable to commit transaction", err.Error())
					}
				}
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlWebpushEndpointStore) GetByUserId(userId string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var webpush_endpoints []*model.WebpushEndpoint

		if _, err := s.GetReplica().Select(&webpush_endpoints,
			`SELECT * FROM WebpushEndpoints WHERE UserId = :UserId`,
			map[string]interface{}{"UserId": userId}); err != nil {

			result.Err = model.NewAppError(
				"SqlWebpushEndpointStore.GetByUserId",
				"We encountered an error while finding webpush endpoints",
				err.Error())
		} else {
			result.Data = webpush_endpoints
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlWebpushEndpointStore) GetByUserIdAndEndpoint(userId string, endpoint string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var webpush_endpoints []*model.WebpushEndpoint

		if _, err := s.GetReplica().Select(&webpush_endpoints,
			"SELECT * FROM WebpushEndpoints WHERE UserId = :UserId and Endpoint = :Endpoint",
			map[string]interface{}{"UserId": userId, "Endpoint": endpoint}); err != nil {

			result.Err = model.NewAppError(
				"SqlWebpushEndpointStore.GetByUserIdAndEndpoint",
				"Failed to get webpush endpoint count",
				"user_id="+userId+" endpoint="+endpoint+", "+err.Error())
		} else {
			result.Data = webpush_endpoints
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel

}

func (s SqlWebpushEndpointStore) DeleteByUser(userId string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := s.GetMaster().Exec("DELETE FROM WebpushEndpoints WHERE UserId = :userId",
			map[string]interface{}{"userId": userId}); err != nil {
			result.Err = model.NewAppError("SqlWebpushEndpointStore.Delete", "We encountered an error deleting the webpush endpoints", "user_id="+userId)
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlWebpushEndpointStore) Delete(id string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := s.GetMaster().Exec(
			"DELETE FROM WebpushEndpoints WHERE Id = :Id",
			map[string]interface{}{"Id": id}); err != nil {

			result.Err = model.NewAppError(
				"SqlWebpushEndpointStore.Delete",
				"We couldn't delete the webpush endpoint",
				"id="+id+", "+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
