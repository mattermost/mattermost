// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/product"
)

// ensure cluster service wrapper implements `product.ClusterService`
var _ product.ClusterService = (*clusterWrapper)(nil)

// clusterWrapper provides an implementation of `product.ClusterService` for use by products.
type clusterWrapper struct {
	srv *Server
}

func (s *clusterWrapper) PublishPluginClusterEvent(productID string, ev model.PluginClusterEvent,
	opts model.PluginClusterEventSendOptions) error {
	if s.srv.Cluster == nil {
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
		s.srv.Cluster.SendClusterMessage(msg)
	} else {
		if err := s.srv.Cluster.SendClusterMessageToNode(opts.TargetId, msg); err != nil {
			return fmt.Errorf("failed to send message to cluster node %q: %w", opts.TargetId, err)
		}
	}

	return nil
}

func (s *clusterWrapper) PublishWebSocketEvent(productID string, event string, payload map[string]any, broadcast *model.WebsocketBroadcast) {
	ev := model.NewWebSocketEvent(fmt.Sprintf("custom_%v_%v", productID, event), "", "", "", nil, "")
	ev = ev.SetBroadcast(broadcast).SetData(payload)
	s.srv.Publish(request.EmptyContext(s.srv.Log()), ev)
}

func (s *clusterWrapper) SetPluginKeyWithOptions(productID string, key string, value []byte, options model.PluginKVSetOptions) (bool, *model.AppError) {
	return s.srv.setPluginKeyWithOptions(request.EmptyContext(s.srv.Log()), productID, key, value, options)
}

func (s *clusterWrapper) KVGet(productID, key string) ([]byte, *model.AppError) {
	return s.srv.getPluginKey(request.EmptyContext(s.srv.Log()), productID, key)
}

func (s *clusterWrapper) KVDelete(productID, key string) *model.AppError {
	return s.srv.deletePluginKey(request.EmptyContext(s.srv.Log()), productID, key)
}

func (s *clusterWrapper) KVList(productID string, page, perPage int) ([]string, *model.AppError) {
	return s.srv.listPluginKeys(request.EmptyContext(s.srv.Log()), productID, page, perPage)
}

// Registers a given function to be called when the cluster leader may have changed. Returns a unique ID for the
// listener which can later be used to remove it. If clustering is not enabled in this build, the callback will never
// be called.
func (s *Server) AddClusterLeaderChangedListener(listener func()) string {
	id := model.NewId()
	s.clusterLeaderListeners.Store(id, listener)
	return id
}

// Removes a listener function by the unique ID returned when AddConfigListener was called
func (s *Server) RemoveClusterLeaderChangedListener(id string) {
	s.clusterLeaderListeners.Delete(id)
}

func (s *Server) InvokeClusterLeaderChangedListeners() {
	s.Log().Info("Cluster leader changed. Invoking ClusterLeaderChanged listeners.")
	// This needs to be run in a separate goroutine otherwise a recursive lock happens
	// because the listener function eventually ends up calling .IsLeader().
	// Fixing this would require the changed event to pass the leader directly, but that
	// requires a lot of work.
	s.Go(func() {
		s.clusterLeaderListeners.Range(func(_, listener any) bool {
			listener.(func())()
			return true
		})
	})
}
