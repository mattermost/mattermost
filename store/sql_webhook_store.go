// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
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

		tableo := db.AddTableWithName(model.OutgoingWebhook{}, "OutgoingWebhooks").SetKeys(false, "Id")
		tableo.ColMap("Id").SetMaxSize(26)
		tableo.ColMap("Token").SetMaxSize(26)
		tableo.ColMap("CreatorId").SetMaxSize(26)
		tableo.ColMap("ChannelId").SetMaxSize(26)
		tableo.ColMap("TeamId").SetMaxSize(26)
		tableo.ColMap("TriggerWords").SetMaxSize(1024)
		tableo.ColMap("CallbackURLs").SetMaxSize(1024)
	}

	return s
}

func (s SqlWebhookStore) UpgradeSchemaIfNeeded() {
}

func (s SqlWebhookStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_incoming_webhook_user_id", "IncomingWebhooks", "UserId")
	s.CreateIndexIfNotExists("idx_incoming_webhook_team_id", "IncomingWebhooks", "TeamId")
	s.CreateIndexIfNotExists("idx_outgoing_webhook_channel_id", "OutgoingWebhooks", "ChannelId")

	s.CreatePatternIndexIfNotExists("idx_outgoing_webhook_trigger_txt", "OutgoingWebhooks", "TriggerWords")
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

func (s SqlWebhookStore) SaveOutgoing(webhook *model.OutgoingWebhook) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if len(webhook.Id) > 0 {
			result.Err = model.NewAppError("SqlWebhookStore.SaveOutgoing",
				"You cannot overwrite an existing OutgoingWebhook", "id="+webhook.Id)
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
			result.Err = model.NewAppError("SqlWebhookStore.SaveOutgoing", "We couldn't save the OutgoingWebhook", "id="+webhook.Id+", "+err.Error())
		} else {
			result.Data = webhook
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlWebhookStore) GetOutgoing(id string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var webhook model.OutgoingWebhook

		if err := s.GetReplica().SelectOne(&webhook, "SELECT * FROM OutgoingWebhooks WHERE Id = :Id AND DeleteAt = 0", map[string]interface{}{"Id": id}); err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.GetOutgoing", "We couldn't get the webhook", "id="+id+", err="+err.Error())
		}

		result.Data = &webhook

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlWebhookStore) GetOutgoingByCreator(userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var webhooks []*model.OutgoingWebhook

		if _, err := s.GetReplica().Select(&webhooks, "SELECT * FROM OutgoingWebhooks WHERE CreatorId = :UserId AND DeleteAt = 0", map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.GetOutgoingByCreator", "We couldn't get the webhooks", "userId="+userId+", err="+err.Error())
		}

		result.Data = webhooks

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlWebhookStore) GetOutgoingByChannel(channelId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var webhooks []*model.OutgoingWebhook

		if _, err := s.GetReplica().Select(&webhooks, "SELECT * FROM OutgoingWebhooks WHERE ChannelId = :ChannelId AND DeleteAt = 0", map[string]interface{}{"ChannelId": channelId}); err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.GetOutgoingByChannel", "We couldn't get the webhooks", "channelId="+channelId+", err="+err.Error())
		}

		result.Data = webhooks

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlWebhookStore) GetOutgoingByTriggerWord(teamId, channelId, triggerWord string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var webhooks []*model.OutgoingWebhook

		var err error

		if utils.Cfg.SqlSettings.DriverName == "postgres" {

			searchQuery := `SELECT
				    *
				FROM
				    OutgoingWebhooks
				WHERE
				    DeleteAt = 0
				    AND TeamId = $1
				    AND TriggerWords LIKE '%' || $2 || '%'`

			if len(channelId) != 0 {
				searchQuery += " AND (ChannelId = $3 OR ChannelId = '')"
				_, err = s.GetReplica().Select(&webhooks, searchQuery, teamId, triggerWord, channelId)
			} else {
				searchQuery += " AND ChannelId = ''"
				_, err = s.GetReplica().Select(&webhooks, searchQuery, teamId, triggerWord)
			}

		} else if utils.Cfg.SqlSettings.DriverName == "mysql" {
			searchQuery := `SELECT
				    *
				FROM
				    OutgoingWebhooks
				WHERE
				    DeleteAt = 0
				    AND TeamId = ?
				    AND MATCH (TriggerWords) AGAINST (? IN BOOLEAN MODE)`

			triggerWord = "+" + triggerWord

			if len(channelId) != 0 {
				searchQuery += " AND (ChannelId = ? OR ChannelId = '')"
				_, err = s.GetReplica().Select(&webhooks, searchQuery, teamId, triggerWord, channelId)
			} else {
				searchQuery += " AND ChannelId = ''"
				_, err = s.GetReplica().Select(&webhooks, searchQuery, teamId, triggerWord)
			}
		}

		if err != nil {
			result.Err = model.NewAppError("SqlPostStore.GetOutgoingByTriggerWord", "We encounted an error while getting the outgoing webhooks by trigger word", "teamId="+teamId+", channelId="+channelId+", triggerWord="+triggerWord+", err="+err.Error())
		}

		result.Data = webhooks

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlWebhookStore) DeleteOutgoing(webhookId string, time int64) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		_, err := s.GetMaster().Exec("Update OutgoingWebhooks SET DeleteAt = :DeleteAt, UpdateAt = :UpdateAt WHERE Id = :Id", map[string]interface{}{"DeleteAt": time, "UpdateAt": time, "Id": webhookId})
		if err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.DeleteOutgoing", "We couldn't delete the webhook", "id="+webhookId+", err="+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlWebhookStore) UpdateOutgoing(hook *model.OutgoingWebhook) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		hook.UpdateAt = model.GetMillis()

		if _, err := s.GetMaster().Update(hook); err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.UpdateOutgoing", "We couldn't update the webhook", "id="+hook.Id+", "+err.Error())
		} else {
			result.Data = hook
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
