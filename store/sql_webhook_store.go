// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
)

type SqlWebhookStore struct {
	*SqlStore
}

func NewSqlWebhookStore(sqlStore *SqlStore) WebhookStore {
	s := &SqlWebhookStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.IncomingWebhook{}, "IncomingWebhooks").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("ChannelId").SetMaxSize(26)
		table.ColMap("TeamId").SetMaxSize(26)
	}

	return s
}

func (s SqlWebhookStore) UpgradeSchemaIfNeeded() {
}

func (s SqlWebhookStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_webhook_user_id", "IncomingWebhooks", "UserId")
	s.CreateIndexIfNotExists("idx_webhook_team_id", "IncomingWebhooks", "TeamId")
}

func (s SqlWebhookStore) SaveIncoming(webhook *model.IncomingWebhook) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if len(webhook.Id) > 0 {
			result.Err = model.NewAppError("SqlWebhookStore.SaveIncoming",
				"You cannot overwrite an existing IncomingWebhook", "id="+webhook.Id)
			storeChannel <- result
			close(storeChannel)
			return
		}

		webhook.PreSave()
		if result.Err = webhook.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if err := s.GetMaster().Insert(webhook); err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.SaveIncoming", "We couldn't save the IncomingWebhook", "id="+webhook.Id+", "+err.Error())
		} else {
			result.Data = webhook
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlWebhookStore) GetIncoming(id string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var webhook model.IncomingWebhook

		if err := s.GetReplica().SelectOne(&webhook, "SELECT * FROM IncomingWebhooks WHERE Id = :Id AND DeleteAt = 0", map[string]interface{}{"Id": id}); err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.GetIncoming", "We couldn't get the webhook", "id="+id+", err="+err.Error())
		}

		result.Data = &webhook

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlWebhookStore) DeleteIncoming(webhookId string, time int64) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		_, err := s.GetMaster().Exec("Update IncomingWebhooks SET DeleteAt = :DeleteAt, UpdateAt = :UpdateAt WHERE Id = :Id", map[string]interface{}{"DeleteAt": time, "UpdateAt": time, "Id": webhookId})
		if err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.DeleteIncoming", "We couldn't delete the webhook", "id="+webhookId+", err="+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlWebhookStore) GetIncomingByUser(userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var webhooks []*model.IncomingWebhook

		if _, err := s.GetReplica().Select(&webhooks, "SELECT * FROM IncomingWebhooks WHERE UserId = :UserId AND DeleteAt = 0", map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.GetIncomingByUser", "We couldn't get the webhook", "userId="+userId+", err="+err.Error())
		}

		result.Data = webhooks

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
