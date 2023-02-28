// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/channels/einterfaces"
	"github.com/mattermost/mattermost-server/v6/channels/product"
	"github.com/mattermost/mattermost-server/v6/channels/store"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

// ensure cluster service wrapper implements `product.ClusterService`
var _ product.ClusterService = (*PlatformService)(nil)

// Ensure KV store wrapper implements `product.KVStoreService`
var _ product.KVStoreService = (*PlatformService)(nil)

func (ps *PlatformService) Cluster() einterfaces.ClusterInterface {
	return ps.clusterIFace
}

func (ps *PlatformService) NewClusterDiscoveryService() *ClusterDiscoveryService {
	ds := &ClusterDiscoveryService{
		ClusterDiscovery: model.ClusterDiscovery{},
		platform:         ps,
		stop:             make(chan bool),
	}

	return ds
}

func (ps *PlatformService) IsLeader() bool {
	if ps.License() != nil && *ps.Config().ClusterSettings.Enable && ps.clusterIFace != nil {
		return ps.clusterIFace.IsLeader()
	}

	return true
}

func (ps *PlatformService) SetCluster(impl einterfaces.ClusterInterface) { //nolint:unused
	ps.clusterIFace = impl
}

func (ps *PlatformService) PublishPluginClusterEvent(productID string, ev model.PluginClusterEvent, opts model.PluginClusterEventSendOptions) error {
	if ps.clusterIFace == nil {
		return nil
	}

	msg := &model.ClusterMessage{
		Event:            model.ClusterEventPluginEvent,
		SendType:         opts.SendType,
		WaitForAllToSend: false,
		Props: map[string]string{
			"ProductID": productID,
			"EventID":   ev.Id,
		},
		Data: ev.Data,
	}

	// If TargetId is empty we broadcast to all other cluster nodes.
	if opts.TargetId == "" {
		ps.clusterIFace.SendClusterMessage(msg)
	} else {
		if err := ps.clusterIFace.SendClusterMessageToNode(opts.TargetId, msg); err != nil {
			return fmt.Errorf("failed to send message to cluster node %q: %w", opts.TargetId, err)
		}
	}

	return nil
}

func (ps *PlatformService) PublishWebSocketEvent(productID string, event string, payload map[string]any, broadcast *model.WebsocketBroadcast) {
	ev := model.NewWebSocketEvent(fmt.Sprintf("custom_%v_%v", productID, event), "", "", "", nil, "")
	ev = ev.SetBroadcast(broadcast).SetData(payload)
	ps.Publish(ev)
}

func (ps *PlatformService) SetPluginKeyWithOptions(productID string, key string, value []byte, options model.PluginKVSetOptions) (bool, *model.AppError) {
	if err := options.IsValid(); err != nil {
		mlog.Debug("Failed to set plugin key value with options", mlog.String("plugin_id", productID), mlog.String("key", key), mlog.Err(err))
		return false, err
	}

	updated, err := ps.Store.Plugin().SetWithOptions(productID, key, value, options)
	if err != nil {
		mlog.Error("Failed to set plugin key value with options", mlog.String("plugin_id", productID), mlog.String("key", key), mlog.Err(err))
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return false, appErr
		default:
			return false, model.NewAppError("SetPluginKeyWithOptions", "app.plugin_store.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	// Clean up a previous entry using the hashed key, if it exists.
	if err := ps.Store.Plugin().Delete(productID, getKeyHash(key)); err != nil {
		mlog.Warn("Failed to clean up previously hashed plugin key value", mlog.String("plugin_id", productID), mlog.String("key", key), mlog.Err(err))
	}

	return updated, nil
}

func (ps *PlatformService) KVGet(productID, key string) ([]byte, *model.AppError) {
	if kv, err := ps.Store.Plugin().Get(productID, key); err == nil {
		return kv.Value, nil
	} else if nfErr := new(store.ErrNotFound); !errors.As(err, &nfErr) {
		mlog.Error("Failed to query plugin key value", mlog.String("plugin_id", productID), mlog.String("key", key), mlog.Err(err))
		return nil, model.NewAppError("GetPluginKey", "app.plugin_store.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Lookup using the hashed version of the key for keys written prior to v5.6.
	if kv, err := ps.Store.Plugin().Get(productID, getKeyHash(key)); err == nil {
		return kv.Value, nil
	} else if nfErr := new(store.ErrNotFound); !errors.As(err, &nfErr) {
		mlog.Error("Failed to query plugin key value using hashed key", mlog.String("plugin_id", productID), mlog.String("key", key), mlog.Err(err))
		return nil, model.NewAppError("GetPluginKey", "app.plugin_store.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil, nil
}

func (ps *PlatformService) KVDelete(productID, key string) *model.AppError {
	if err := ps.Store.Plugin().Delete(productID, getKeyHash(key)); err != nil {
		ps.logger.Error("Failed to delete plugin key value", mlog.String("plugin_id", productID), mlog.String("key", key), mlog.Err(err))
		return model.NewAppError("DeletePluginKey", "app.plugin_store.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Also delete the key without hashing
	if err := ps.Store.Plugin().Delete(productID, key); err != nil {
		ps.logger.Error("Failed to delete plugin key value using hashed key", mlog.String("plugin_id", productID), mlog.String("key", key), mlog.Err(err))
		return model.NewAppError("DeletePluginKey", "app.plugin_store.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (ps *PlatformService) KVList(productID string, page, perPage int) ([]string, *model.AppError) {
	data, err := ps.Store.Plugin().List(productID, page*perPage, perPage)
	if err != nil {
		ps.logger.Error("Failed to list plugin key values", mlog.Int("page", page), mlog.Int("perPage", perPage), mlog.Err(err))
		return nil, model.NewAppError("ListPluginKeys", "app.plugin_store.list.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return data, nil
}

// Registers a given function to be called when the cluster leader may have changed. Returns a unique ID for the
// listener which can later be used to remove it. If clustering is not enabled in this build, the callback will never
// be called.
func (ps *PlatformService) AddClusterLeaderChangedListener(listener func()) string {
	id := model.NewId()
	ps.clusterLeaderListeners.Store(id, listener)
	return id
}

// Removes a listener function by the unique ID returned when AddConfigListener was called
func (ps *PlatformService) RemoveClusterLeaderChangedListener(id string) {
	ps.clusterLeaderListeners.Delete(id)
}

func (ps *PlatformService) InvokeClusterLeaderChangedListeners() {
	ps.logger.Info("Cluster leader changed. Invoking ClusterLeaderChanged listeners.")
	// This needs to be run in a separate goroutine otherwise a recursive lock happens
	// because the listener function eventually ends up calling .IsLeader().
	// Fixing this would require the changed event to pass the leader directly, but that
	// requires a lot of work.
	ps.Go(func() {
		ps.clusterLeaderListeners.Range(func(_, listener any) bool {
			listener.(func())()
			return true
		})
	})
}

func (ps *PlatformService) Publish(message *model.WebSocketEvent) {
	if ps.metricsIFace != nil {
		ps.metricsIFace.IncrementWebsocketEvent(message.EventType())
	}

	ps.PublishSkipClusterSend(message)

	if ps.clusterIFace != nil {
		data, err := message.ToJSON()
		if err != nil {
			mlog.Warn("Failed to encode message to JSON", mlog.Err(err))
		}
		cm := &model.ClusterMessage{
			Event:    model.ClusterEventPublish,
			SendType: model.ClusterSendBestEffort,
			Data:     data,
		}

		if message.EventType() == model.WebsocketEventPosted ||
			message.EventType() == model.WebsocketEventPostEdited ||
			message.EventType() == model.WebsocketEventDirectAdded ||
			message.EventType() == model.WebsocketEventGroupAdded ||
			message.EventType() == model.WebsocketEventAddedToTeam ||
			message.GetBroadcast().ReliableClusterSend {
			cm.SendType = model.ClusterSendReliable
		}

		ps.clusterIFace.SendClusterMessage(cm)
	}
}

func (ps *PlatformService) PublishSkipClusterSend(event *model.WebSocketEvent) {
	if event.GetBroadcast().UserId != "" {
		hub := ps.GetHubForUserId(event.GetBroadcast().UserId)
		if hub != nil {
			hub.Broadcast(event)
		}
	} else {
		for _, hub := range ps.hubs {
			hub.Broadcast(event)
		}
	}

	// Notify shared channel sync service
	ps.SharedChannelSyncHandler(event)
}

func (ps *PlatformService) ListPluginKeys(pluginID string, page, perPage int) ([]string, *model.AppError) {
	data, err := ps.Store.Plugin().List(pluginID, page*perPage, perPage)
	if err != nil {
		mlog.Error("Failed to list plugin key values", mlog.Int("page", page), mlog.Int("perPage", perPage), mlog.Err(err))
		return nil, model.NewAppError("ListPluginKeys", "app.plugin_store.list.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return data, nil
}

func (ps *PlatformService) DeletePluginKey(pluginID string, key string) *model.AppError {
	if err := ps.Store.Plugin().Delete(pluginID, getKeyHash(key)); err != nil {
		mlog.Error("Failed to delete plugin key value", mlog.String("plugin_id", pluginID), mlog.String("key", key), mlog.Err(err))
		return model.NewAppError("DeletePluginKey", "app.plugin_store.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Also delete the key without hashing
	if err := ps.Store.Plugin().Delete(pluginID, key); err != nil {
		mlog.Error("Failed to delete plugin key value using hashed key", mlog.String("plugin_id", pluginID), mlog.String("key", key), mlog.Err(err))
		return model.NewAppError("DeletePluginKey", "app.plugin_store.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}
