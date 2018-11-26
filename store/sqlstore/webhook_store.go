// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"net/http"

	"database/sql"

	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
)

type SqlWebhookStore struct {
	SqlStore
	metrics einterfaces.MetricsInterface
}

const (
	WEBHOOK_CACHE_SIZE = 25000
	WEBHOOK_CACHE_SEC  = 900 // 15 minutes
)

var webhookCache = utils.NewLru(WEBHOOK_CACHE_SIZE)

func (s SqlWebhookStore) ClearCaches() {
	webhookCache.Purge()

	if s.metrics != nil {
		s.metrics.IncrementMemCacheInvalidationCounter("Webhook - Purge")
	}
}

func NewSqlWebhookStore(sqlStore SqlStore, metrics einterfaces.MetricsInterface) store.WebhookStore {
	s := &SqlWebhookStore{
		SqlStore: sqlStore,
		metrics:  metrics,
	}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.IncomingWebhook{}, "IncomingWebhooks").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("ChannelId").SetMaxSize(26)
		table.ColMap("TeamId").SetMaxSize(26)
		table.ColMap("DisplayName").SetMaxSize(64)
		table.ColMap("Description").SetMaxSize(500)

		tableo := db.AddTableWithName(model.OutgoingWebhook{}, "OutgoingWebhooks").SetKeys(false, "Id")
		tableo.ColMap("Id").SetMaxSize(26)
		tableo.ColMap("Token").SetMaxSize(26)
		tableo.ColMap("CreatorId").SetMaxSize(26)
		tableo.ColMap("ChannelId").SetMaxSize(26)
		tableo.ColMap("TeamId").SetMaxSize(26)
		tableo.ColMap("TriggerWords").SetMaxSize(1024)
		tableo.ColMap("CallbackURLs").SetMaxSize(1024)
		tableo.ColMap("DisplayName").SetMaxSize(64)
		tableo.ColMap("Description").SetMaxSize(500)
		tableo.ColMap("ContentType").SetMaxSize(128)
		tableo.ColMap("TriggerWhen").SetMaxSize(1)
		tableo.ColMap("Username").SetMaxSize(64)
		tableo.ColMap("IconURL").SetMaxSize(1024)
	}

	return s
}

func (s SqlWebhookStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_incoming_webhook_user_id", "IncomingWebhooks", "UserId")
	s.CreateIndexIfNotExists("idx_incoming_webhook_team_id", "IncomingWebhooks", "TeamId")
	s.CreateIndexIfNotExists("idx_outgoing_webhook_team_id", "OutgoingWebhooks", "TeamId")

	s.CreateIndexIfNotExists("idx_incoming_webhook_update_at", "IncomingWebhooks", "UpdateAt")
	s.CreateIndexIfNotExists("idx_incoming_webhook_create_at", "IncomingWebhooks", "CreateAt")
	s.CreateIndexIfNotExists("idx_incoming_webhook_delete_at", "IncomingWebhooks", "DeleteAt")

	s.CreateIndexIfNotExists("idx_outgoing_webhook_update_at", "OutgoingWebhooks", "UpdateAt")
	s.CreateIndexIfNotExists("idx_outgoing_webhook_create_at", "OutgoingWebhooks", "CreateAt")
	s.CreateIndexIfNotExists("idx_outgoing_webhook_delete_at", "OutgoingWebhooks", "DeleteAt")
}

func (s SqlWebhookStore) InvalidateWebhookCache(webhookId string) {
	webhookCache.Remove(webhookId)
	if s.metrics != nil {
		s.metrics.IncrementMemCacheInvalidationCounter("Webhook - Remove by WebhookId")
	}
}

func (s SqlWebhookStore) SaveIncoming(webhook *model.IncomingWebhook) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if len(webhook.Id) > 0 {
			result.Err = model.NewAppError("SqlWebhookStore.SaveIncoming", "store.sql_webhooks.save_incoming.existing.app_error", nil, "id="+webhook.Id, http.StatusBadRequest)
			return
		}

		webhook.PreSave()
		if result.Err = webhook.IsValid(); result.Err != nil {
			return
		}

		if err := s.GetMaster().Insert(webhook); err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.SaveIncoming", "store.sql_webhooks.save_incoming.app_error", nil, "id="+webhook.Id+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = webhook
		}
	})
}

func (s SqlWebhookStore) UpdateIncoming(hook *model.IncomingWebhook) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		hook.UpdateAt = model.GetMillis()

		if _, err := s.GetMaster().Update(hook); err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.UpdateIncoming", "store.sql_webhooks.update_incoming.app_error", nil, "id="+hook.Id+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = hook
		}
	})
}

func (s SqlWebhookStore) GetIncoming(id string, allowFromCache bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if allowFromCache {
			if cacheItem, ok := webhookCache.Get(id); ok {
				if s.metrics != nil {
					s.metrics.IncrementMemCacheHitCounter("Webhook")
				}
				result.Data = cacheItem.(*model.IncomingWebhook)
				return
			} else {
				if s.metrics != nil {
					s.metrics.IncrementMemCacheMissCounter("Webhook")
				}
			}
		}

		var webhook model.IncomingWebhook

		if err := s.GetReplica().SelectOne(&webhook, "SELECT * FROM IncomingWebhooks WHERE Id = :Id AND DeleteAt = 0", map[string]interface{}{"Id": id}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlWebhookStore.GetIncoming", "store.sql_webhooks.get_incoming.app_error", nil, "id="+id+", err="+err.Error(), http.StatusNotFound)
			} else {
				result.Err = model.NewAppError("SqlWebhookStore.GetIncoming", "store.sql_webhooks.get_incoming.app_error", nil, "id="+id+", err="+err.Error(), http.StatusInternalServerError)
			}
		}

		if result.Err == nil {
			webhookCache.AddWithExpiresInSecs(id, &webhook, WEBHOOK_CACHE_SEC)
		}

		result.Data = &webhook
	})
}

func (s SqlWebhookStore) DeleteIncoming(webhookId string, time int64) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		_, err := s.GetMaster().Exec("Update IncomingWebhooks SET DeleteAt = :DeleteAt, UpdateAt = :UpdateAt WHERE Id = :Id", map[string]interface{}{"DeleteAt": time, "UpdateAt": time, "Id": webhookId})
		if err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.DeleteIncoming", "store.sql_webhooks.delete_incoming.app_error", nil, "id="+webhookId+", err="+err.Error(), http.StatusInternalServerError)
		}

		s.InvalidateWebhookCache(webhookId)
	})
}

func (s SqlWebhookStore) PermanentDeleteIncomingByUser(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		_, err := s.GetMaster().Exec("DELETE FROM IncomingWebhooks WHERE UserId = :UserId", map[string]interface{}{"UserId": userId})
		if err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.DeleteIncomingByUser", "store.sql_webhooks.permanent_delete_incoming_by_user.app_error", nil, "id="+userId+", err="+err.Error(), http.StatusInternalServerError)
		}

		s.ClearCaches()
	})
}

func (s SqlWebhookStore) PermanentDeleteIncomingByChannel(channelId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		_, err := s.GetMaster().Exec("DELETE FROM IncomingWebhooks WHERE ChannelId = :ChannelId", map[string]interface{}{"ChannelId": channelId})
		if err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.DeleteIncomingByChannel", "store.sql_webhooks.permanent_delete_incoming_by_channel.app_error", nil, "id="+channelId+", err="+err.Error(), http.StatusInternalServerError)
		}

		s.ClearCaches()
	})
}

func (s SqlWebhookStore) GetIncomingList(offset, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var webhooks []*model.IncomingWebhook

		if _, err := s.GetReplica().Select(&webhooks, "SELECT * FROM IncomingWebhooks WHERE DeleteAt = 0 LIMIT :Limit OFFSET :Offset", map[string]interface{}{"Limit": limit, "Offset": offset}); err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.GetIncomingList", "store.sql_webhooks.get_incoming_by_user.app_error", nil, "err="+err.Error(), http.StatusInternalServerError)
		}

		result.Data = webhooks
	})
}

func (s SqlWebhookStore) GetIncomingByTeam(teamId string, offset, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var webhooks []*model.IncomingWebhook

		if _, err := s.GetReplica().Select(&webhooks, "SELECT * FROM IncomingWebhooks WHERE TeamId = :TeamId AND DeleteAt = 0 LIMIT :Limit OFFSET :Offset", map[string]interface{}{"TeamId": teamId, "Limit": limit, "Offset": offset}); err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.GetIncomingByUser", "store.sql_webhooks.get_incoming_by_user.app_error", nil, "teamId="+teamId+", err="+err.Error(), http.StatusInternalServerError)
		}

		result.Data = webhooks
	})
}

func (s SqlWebhookStore) GetIncomingByChannel(channelId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var webhooks []*model.IncomingWebhook

		if _, err := s.GetReplica().Select(&webhooks, "SELECT * FROM IncomingWebhooks WHERE ChannelId = :ChannelId AND DeleteAt = 0", map[string]interface{}{"ChannelId": channelId}); err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.GetIncomingByChannel", "store.sql_webhooks.get_incoming_by_channel.app_error", nil, "channelId="+channelId+", err="+err.Error(), http.StatusInternalServerError)
		}

		result.Data = webhooks
	})
}

func (s SqlWebhookStore) SaveOutgoing(webhook *model.OutgoingWebhook) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if len(webhook.Id) > 0 {
			result.Err = model.NewAppError("SqlWebhookStore.SaveOutgoing", "store.sql_webhooks.save_outgoing.override.app_error", nil, "id="+webhook.Id, http.StatusBadRequest)
			return
		}

		webhook.PreSave()
		if result.Err = webhook.IsValid(); result.Err != nil {
			return
		}

		if err := s.GetMaster().Insert(webhook); err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.SaveOutgoing", "store.sql_webhooks.save_outgoing.app_error", nil, "id="+webhook.Id+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = webhook
		}
	})
}

func (s SqlWebhookStore) GetOutgoing(id string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var webhook model.OutgoingWebhook

		if err := s.GetReplica().SelectOne(&webhook, "SELECT * FROM OutgoingWebhooks WHERE Id = :Id AND DeleteAt = 0", map[string]interface{}{"Id": id}); err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.GetOutgoing", "store.sql_webhooks.get_outgoing.app_error", nil, "id="+id+", err="+err.Error(), http.StatusInternalServerError)
		}

		result.Data = &webhook
	})
}

func (s SqlWebhookStore) GetOutgoingList(offset, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var webhooks []*model.OutgoingWebhook

		if _, err := s.GetReplica().Select(&webhooks, "SELECT * FROM OutgoingWebhooks WHERE DeleteAt = 0 LIMIT :Limit OFFSET :Offset", map[string]interface{}{"Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.GetOutgoingList", "store.sql_webhooks.get_outgoing_by_channel.app_error", nil, "err="+err.Error(), http.StatusInternalServerError)
		}

		result.Data = webhooks
	})
}

func (s SqlWebhookStore) GetOutgoingByChannel(channelId string, offset, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var webhooks []*model.OutgoingWebhook

		query := ""
		if limit < 0 || offset < 0 {
			query = "SELECT * FROM OutgoingWebhooks WHERE ChannelId = :ChannelId AND DeleteAt = 0"
		} else {
			query = "SELECT * FROM OutgoingWebhooks WHERE ChannelId = :ChannelId AND DeleteAt = 0 LIMIT :Limit OFFSET :Offset"
		}

		if _, err := s.GetReplica().Select(&webhooks, query, map[string]interface{}{"ChannelId": channelId, "Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.GetOutgoingByChannel", "store.sql_webhooks.get_outgoing_by_channel.app_error", nil, "channelId="+channelId+", err="+err.Error(), http.StatusInternalServerError)
		}

		result.Data = webhooks
	})
}

func (s SqlWebhookStore) GetOutgoingByTeam(teamId string, offset, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var webhooks []*model.OutgoingWebhook

		query := ""
		if limit < 0 || offset < 0 {
			query = "SELECT * FROM OutgoingWebhooks WHERE TeamId = :TeamId AND DeleteAt = 0"
		} else {
			query = "SELECT * FROM OutgoingWebhooks WHERE TeamId = :TeamId AND DeleteAt = 0 LIMIT :Limit OFFSET :Offset"
		}

		if _, err := s.GetReplica().Select(&webhooks, query, map[string]interface{}{"TeamId": teamId, "Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.GetOutgoingByTeam", "store.sql_webhooks.get_outgoing_by_team.app_error", nil, "teamId="+teamId+", err="+err.Error(), http.StatusInternalServerError)
		}

		result.Data = webhooks
	})
}

func (s SqlWebhookStore) DeleteOutgoing(webhookId string, time int64) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		_, err := s.GetMaster().Exec("Update OutgoingWebhooks SET DeleteAt = :DeleteAt, UpdateAt = :UpdateAt WHERE Id = :Id", map[string]interface{}{"DeleteAt": time, "UpdateAt": time, "Id": webhookId})
		if err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.DeleteOutgoing", "store.sql_webhooks.delete_outgoing.app_error", nil, "id="+webhookId+", err="+err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s SqlWebhookStore) PermanentDeleteOutgoingByUser(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		_, err := s.GetMaster().Exec("DELETE FROM OutgoingWebhooks WHERE CreatorId = :UserId", map[string]interface{}{"UserId": userId})
		if err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.DeleteOutgoingByUser", "store.sql_webhooks.permanent_delete_outgoing_by_user.app_error", nil, "id="+userId+", err="+err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s SqlWebhookStore) PermanentDeleteOutgoingByChannel(channelId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		_, err := s.GetMaster().Exec("DELETE FROM OutgoingWebhooks WHERE ChannelId = :ChannelId", map[string]interface{}{"ChannelId": channelId})
		if err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.DeleteOutgoingByChannel", "store.sql_webhooks.permanent_delete_outgoing_by_channel.app_error", nil, "id="+channelId+", err="+err.Error(), http.StatusInternalServerError)
		}

		s.ClearCaches()
	})
}

func (s SqlWebhookStore) UpdateOutgoing(hook *model.OutgoingWebhook) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		hook.UpdateAt = model.GetMillis()

		if _, err := s.GetMaster().Update(hook); err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.UpdateOutgoing", "store.sql_webhooks.update_outgoing.app_error", nil, "id="+hook.Id+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = hook
		}
	})
}

func (s SqlWebhookStore) AnalyticsIncomingCount(teamId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		query :=
			`SELECT 
			    COUNT(*)
			FROM
			    IncomingWebhooks
			WHERE
                DeleteAt = 0`

		if len(teamId) > 0 {
			query += " AND TeamId = :TeamId"
		}

		if v, err := s.GetReplica().SelectInt(query, map[string]interface{}{"TeamId": teamId}); err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.AnalyticsIncomingCount", "store.sql_webhooks.analytics_incoming_count.app_error", nil, "team_id="+teamId+", err="+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = v
		}
	})
}

func (s SqlWebhookStore) AnalyticsOutgoingCount(teamId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		query :=
			`SELECT 
			    COUNT(*)
			FROM
			    OutgoingWebhooks
			WHERE
                DeleteAt = 0`

		if len(teamId) > 0 {
			query += " AND TeamId = :TeamId"
		}

		if v, err := s.GetReplica().SelectInt(query, map[string]interface{}{"TeamId": teamId}); err != nil {
			result.Err = model.NewAppError("SqlWebhookStore.AnalyticsOutgoingCount", "store.sql_webhooks.analytics_outgoing_count.app_error", nil, "team_id="+teamId+", err="+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = v
		}
	})
}
