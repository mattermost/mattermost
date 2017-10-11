// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package nosqlstore

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type WebhookStore struct {
	driver           Driver
	incomingWebhooks ObjectStore
	outgoingWebhooks ObjectStore
}

func NewWebhookStore(driver Driver) (*WebhookStore, error) {
	s := &WebhookStore{
		driver: driver,
		incomingWebhooks: driver.ObjectStore("incoming_webhooks", json.Marshal, func(b []byte) (interface{}, error) {
			var wh model.IncomingWebhook
			return &wh, json.Unmarshal(b, &wh)
		}),
		outgoingWebhooks: driver.ObjectStore("outgoing_webhooks", json.Marshal, func(b []byte) (interface{}, error) {
			var wh model.OutgoingWebhook
			return &wh, json.Unmarshal(b, &wh)
		}),
	}

	for name, f := range map[string]func(wh *model.IncomingWebhook) ([]byte, []byte){
		"delete_at": func(wh *model.IncomingWebhook) ([]byte, []byte) { return Encode(wh.DeleteAt), []byte(wh.Id) },
		"user_id":   func(wh *model.IncomingWebhook) ([]byte, []byte) { return []byte(wh.UserId), Encode(wh.DeleteAt, wh.Id) },
		"channel_id": func(wh *model.IncomingWebhook) ([]byte, []byte) {
			return []byte(wh.ChannelId), Encode(wh.DeleteAt, wh.Id)
		},
		"team_id": func(wh *model.IncomingWebhook) ([]byte, []byte) { return []byte(wh.TeamId), Encode(wh.DeleteAt, wh.Id) },
	} {
		f := f
		if err := s.incomingWebhooks.AddIndex(name, func(obj interface{}) ([]byte, []byte) {
			return f(obj.(*model.IncomingWebhook))
		}); err != nil {
			return nil, err
		}
	}

	for name, f := range map[string]func(wh *model.OutgoingWebhook) ([]byte, []byte){
		"delete_at": func(wh *model.OutgoingWebhook) ([]byte, []byte) { return Encode(wh.DeleteAt), []byte(wh.Id) },
		"user_id": func(wh *model.OutgoingWebhook) ([]byte, []byte) {
			return []byte(wh.CreatorId), Encode(wh.DeleteAt, wh.Id)
		},
		"channel_id": func(wh *model.OutgoingWebhook) ([]byte, []byte) {
			return []byte(wh.ChannelId), Encode(wh.DeleteAt, wh.Id)
		},
		"team_id": func(wh *model.OutgoingWebhook) ([]byte, []byte) { return []byte(wh.TeamId), Encode(wh.DeleteAt, wh.Id) },
	} {
		f := f
		if err := s.outgoingWebhooks.AddIndex(name, func(obj interface{}) ([]byte, []byte) {
			return f(obj.(*model.OutgoingWebhook))
		}); err != nil {
			return nil, err
		}
	}
	return s, nil
}

func (s WebhookStore) InvalidateWebhookCache(webhookId string) {}

func (s WebhookStore) SaveIncoming(webhook *model.IncomingWebhook) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if len(webhook.Id) > 0 {
			result.Err = model.NewAppError("WebhookStore.SaveIncoming", "store.sql_webhooks.save_incoming.existing.app_error", nil, "id="+webhook.Id, http.StatusBadRequest)
			return
		}

		webhook.PreSave()
		if result.Err = webhook.IsValid(); result.Err != nil {
			return
		}

		if err := s.incomingWebhooks.Upsert(webhook.Id, webhook); err != nil {
			result.Err = model.NewAppError("WebhookStore.SaveIncoming", "store.sql_webhooks.save_incoming.app_error", nil, "id="+webhook.Id+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = webhook
		}
	})
}

func (s WebhookStore) UpdateIncoming(hook *model.IncomingWebhook) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		hook.UpdateAt = model.GetMillis()

		if err := s.incomingWebhooks.Upsert(hook.Id, hook); err != nil {
			result.Err = model.NewAppError("WebhookStore.UpdateIncoming", "store.sql_webhooks.update_incoming.app_error", nil, "id="+hook.Id+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = hook
		}
	})
}

func (s WebhookStore) GetIncoming(id string, allowFromCache bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var webhook model.IncomingWebhook

		err := s.incomingWebhooks.Get(id, &webhook)
		if err == ErrNotFound || webhook.DeleteAt > 0 {
			result.Err = model.NewAppError("WebhookStore.GetIncoming", "store.sql_webhooks.get_incoming.app_error", nil, "id="+id, http.StatusNotFound)
		} else if err != nil {
			result.Err = model.NewAppError("WebhookStore.GetIncoming", "store.sql_webhooks.get_incoming.app_error", nil, "id="+id+", err="+err.Error(), http.StatusInternalServerError)
		}

		result.Data = &webhook
	})
}

func (s WebhookStore) DeleteIncoming(id string, time int64) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var webhook model.IncomingWebhook
		if err := s.incomingWebhooks.Get(id, &webhook); err != nil {
			result.Err = model.NewAppError("WebhookStore.DeleteIncoming", "store.sql_webhooks.delete_incoming.app_error", nil, "id="+id+", err="+err.Error(), http.StatusInternalServerError)
		} else {
			webhook.DeleteAt = time
			if err = s.incomingWebhooks.Upsert(id, &webhook); err != nil {
				result.Err = model.NewAppError("WebhookStore.DeleteIncoming", "store.sql_webhooks.delete_incoming.app_error", nil, "id="+id+", err="+err.Error(), http.StatusInternalServerError)
			}
		}
	})
}

func (s WebhookStore) PermanentDeleteIncomingByUser(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var webhooks []*model.IncomingWebhook
		if err := s.incomingWebhooks.Lookup("user_id", []byte(userId), nil, &webhooks); err != nil {
			result.Err = model.NewAppError("WebhookStore.DeleteIncomingByUser", "store.sql_webhooks.permanent_delete_incoming_by_user.app_error", nil, "id="+userId+", err="+err.Error(), http.StatusInternalServerError)
		} else {
			for _, webhook := range webhooks {
				if err := s.incomingWebhooks.Delete(webhook.Id); err != nil {
					result.Err = model.NewAppError("WebhookStore.DeleteIncomingByUser", "store.sql_webhooks.permanent_delete_incoming_by_user.app_error", nil, "id="+userId+", err="+err.Error(), http.StatusInternalServerError)
					break
				}
			}
		}
	})
}

func (s WebhookStore) PermanentDeleteIncomingByChannel(channelId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var webhooks []*model.IncomingWebhook
		if err := s.incomingWebhooks.Lookup("channel_id", []byte(channelId), nil, &webhooks); err != nil {
			result.Err = model.NewAppError("WebhookStore.DeleteIncomingByChannel", "store.sql_webhooks.permanent_delete_incoming_by_channel.app_error", nil, "id="+channelId+", err="+err.Error(), http.StatusInternalServerError)
		} else {
			for _, webhook := range webhooks {
				if err := s.incomingWebhooks.Delete(webhook.Id); err != nil {
					result.Err = model.NewAppError("WebhookStore.DeleteIncomingByChannel", "store.sql_webhooks.permanent_delete_incoming_by_channel.app_error", nil, "id="+channelId+", err="+err.Error(), http.StatusInternalServerError)
					break
				}
			}
		}
	})
}

func (s WebhookStore) GetIncomingList(offset, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var webhooks []*model.IncomingWebhook
		if err := s.incomingWebhooks.Lookup("delete_at", Encode(0), RangeSubset(offset, limit), &webhooks); err != nil {
			result.Err = model.NewAppError("WebhookStore.GetIncomingList", "store.sql_webhooks.get_incoming_by_user.app_error", nil, "err="+err.Error(), http.StatusInternalServerError)
		}
		result.Data = webhooks
	})
}

func (s WebhookStore) GetIncomingByTeam(teamId string, offset, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var webhooks []*model.IncomingWebhook
		if err := s.incomingWebhooks.Lookup("team_id", []byte(teamId), RangeLessThan(Encode(1)).Subset(offset, limit), &webhooks); err != nil {
			result.Err = model.NewAppError("WebhookStore.GetIncomingByUser", "store.sql_webhooks.get_incoming_by_user.app_error", nil, "teamId="+teamId+", err="+err.Error(), http.StatusInternalServerError)
		}
		result.Data = webhooks
	})
}

func (s WebhookStore) GetIncomingByChannel(channelId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var webhooks []*model.IncomingWebhook
		if err := s.incomingWebhooks.Lookup("channel_id", []byte(channelId), RangeLessThan(Encode(1)), &webhooks); err != nil {
			result.Err = model.NewAppError("WebhookStore.GetIncomingByChannel", "store.sql_webhooks.get_incoming_by_channel.app_error", nil, "channelId="+channelId+", err="+err.Error(), http.StatusInternalServerError)
		}
		result.Data = webhooks
	})
}

func (s WebhookStore) SaveOutgoing(webhook *model.OutgoingWebhook) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if len(webhook.Id) > 0 {
			result.Err = model.NewAppError("WebhookStore.SaveOutgoing", "store.sql_webhooks.save_outgoing.override.app_error", nil, "id="+webhook.Id, http.StatusBadRequest)
			return
		}

		webhook.PreSave()
		if result.Err = webhook.IsValid(); result.Err != nil {
			return
		}

		if err := s.outgoingWebhooks.Upsert(webhook.Id, webhook); err != nil {
			result.Err = model.NewAppError("WebhookStore.SaveOutgoing", "store.sql_webhooks.save_outgoing.app_error", nil, "id="+webhook.Id+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = webhook
		}
	})
}

func (s WebhookStore) GetOutgoing(id string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var webhook model.OutgoingWebhook

		err := s.outgoingWebhooks.Get(id, &webhook)
		if err == ErrNotFound || webhook.DeleteAt > 0 {
			result.Err = model.NewAppError("WebhookStore.GetOutgoing", "store.sql_webhooks.get_outgoing.app_error", nil, "id="+id, http.StatusNotFound)
		} else if err != nil {
			result.Err = model.NewAppError("WebhookStore.GetOutgoing", "store.sql_webhooks.get_outgoing.app_error", nil, "id="+id+", err="+err.Error(), http.StatusInternalServerError)
		}

		result.Data = &webhook
	})
}

func (s WebhookStore) GetOutgoingList(offset, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var webhooks []*model.OutgoingWebhook
		if err := s.outgoingWebhooks.Lookup("delete_at", Encode(0), RangeSubset(offset, limit), &webhooks); err != nil {
			result.Err = model.NewAppError("WebhookStore.GetOutgoingList", "store.sql_webhooks.get_outgoing_by_channel.app_error", nil, "err="+err.Error(), http.StatusInternalServerError)
		}
		result.Data = webhooks
	})
}

func (s WebhookStore) GetOutgoingByChannel(channelId string, offset, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var webhooks []*model.OutgoingWebhook
		if err := s.outgoingWebhooks.Lookup("channel_id", []byte(channelId), RangeLessThan(Encode(1)).Subset(offset, limit), &webhooks); err != nil {
			result.Err = model.NewAppError("WebhookStore.GetOutgoingByChannel", "store.sql_webhooks.get_outgoing_by_channel.app_error", nil, "channelId="+channelId+", err="+err.Error(), http.StatusInternalServerError)
		}
		result.Data = webhooks
	})
}

func (s WebhookStore) GetOutgoingByTeam(teamId string, offset, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var webhooks []*model.OutgoingWebhook
		if err := s.outgoingWebhooks.Lookup("team_id", []byte(teamId), RangeLessThan(Encode(1)).Subset(offset, limit), &webhooks); err != nil {
			result.Err = model.NewAppError("WebhookStore.GetOutgoingByTeam", "store.sql_webhooks.get_outgoing_by_team.app_error", nil, "teamId="+teamId+", err="+err.Error(), http.StatusInternalServerError)
		}
		result.Data = webhooks
	})
}

func (s WebhookStore) DeleteOutgoing(webhookId string, time int64) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var webhook model.OutgoingWebhook
		if err := s.outgoingWebhooks.Get(webhookId, &webhook); err != nil {
			result.Err = model.NewAppError("WebhookStore.DeleteOutgoing", "store.sql_webhooks.delete_outgoing.app_error", nil, "id="+webhookId+", err="+err.Error(), http.StatusInternalServerError)
		} else {
			webhook.DeleteAt = time
			if err = s.outgoingWebhooks.Upsert(webhookId, &webhook); err != nil {
				result.Err = model.NewAppError("WebhookStore.DeleteOutgoing", "store.sql_webhooks.delete_outgoing.app_error", nil, "id="+webhookId+", err="+err.Error(), http.StatusInternalServerError)
			}
		}
	})
}

func (s WebhookStore) PermanentDeleteOutgoingByUser(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var webhooks []*model.OutgoingWebhook
		if err := s.outgoingWebhooks.Lookup("user_id", []byte(userId), nil, &webhooks); err != nil {
			result.Err = model.NewAppError("WebhookStore.DeleteOutgoingByUser", "store.sql_webhooks.permanent_delete_outgoing_by_user.app_error", nil, "id="+userId+", err="+err.Error(), http.StatusInternalServerError)
		} else {
			for _, webhook := range webhooks {
				if err := s.outgoingWebhooks.Delete(webhook.Id); err != nil {
					result.Err = model.NewAppError("WebhookStore.DeleteOutgoingByUser", "store.sql_webhooks.permanent_delete_outgoing_by_user.app_error", nil, "id="+userId+", err="+err.Error(), http.StatusInternalServerError)
					break
				}
			}
		}
	})
}

func (s WebhookStore) PermanentDeleteOutgoingByChannel(channelId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var webhooks []*model.OutgoingWebhook
		if err := s.outgoingWebhooks.Lookup("channel_id", []byte(channelId), nil, &webhooks); err != nil {
			result.Err = model.NewAppError("WebhookStore.DeleteOutgoingByChannel", "store.sql_webhooks.permanent_delete_outgoing_by_channel.app_error", nil, "id="+channelId+", err="+err.Error(), http.StatusInternalServerError)
		} else {
			for _, webhook := range webhooks {
				if err := s.outgoingWebhooks.Delete(webhook.Id); err != nil {
					result.Err = model.NewAppError("WebhookStore.DeleteOutgoingByChannel", "store.sql_webhooks.permanent_delete_outgoing_by_channel.app_error", nil, "id="+channelId+", err="+err.Error(), http.StatusInternalServerError)
					break
				}
			}
		}
	})
}

func (s WebhookStore) UpdateOutgoing(hook *model.OutgoingWebhook) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		hook.UpdateAt = model.GetMillis()

		if err := s.outgoingWebhooks.Upsert(hook.Id, hook); err != nil {
			result.Err = model.NewAppError("WebhookStore.UpdateOutgoing", "store.sql_webhooks.update_outgoing.app_error", nil, "id="+hook.Id+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = hook
		}
	})
}

func (s WebhookStore) AnalyticsIncomingCount(teamId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if teamId == "" {
			if count, err := s.incomingWebhooks.Count("delete_at", Encode(0), nil); err != nil {
				result.Err = model.NewAppError("WebhookStore.AnalyticsIncomingCount", "store.sql_webhooks.analytics_incoming_count.app_error", nil, "team_id="+teamId+", err="+err.Error(), http.StatusInternalServerError)
			} else {
				result.Data = int64(count)
			}
		} else if count, err := s.incomingWebhooks.Count("team_id", []byte(teamId), RangeLessThan(Encode(1))); err != nil {
			result.Err = model.NewAppError("WebhookStore.AnalyticsIncomingCount", "store.sql_webhooks.analytics_incoming_count.app_error", nil, "team_id="+teamId+", err="+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = int64(count)
		}
	})
}

func (s WebhookStore) AnalyticsOutgoingCount(teamId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if teamId == "" {
			if count, err := s.outgoingWebhooks.Count("delete_at", Encode(0), nil); err != nil {
				result.Err = model.NewAppError("WebhookStore.AnalyticsOutgoingCount", "store.sql_webhooks.analytics_outgoing_count.app_error", nil, "team_id="+teamId+", err="+err.Error(), http.StatusInternalServerError)
			} else {
				result.Data = int64(count)
			}
		} else if count, err := s.outgoingWebhooks.Count("team_id", []byte(teamId), RangeLessThan(Encode(1))); err != nil {
			result.Err = model.NewAppError("WebhookStore.AnalyticsOutgoingCount", "store.sql_webhooks.analytics_outgoing_count.app_error", nil, "team_id="+teamId+", err="+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = int64(count)
		}
	})
}
