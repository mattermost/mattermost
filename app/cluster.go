// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v5/model"
)

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
	s.Log.Info("Cluster leader changed. Invoking ClusterLeaderChanged listeners.")
	s.Go(func() {
		s.clusterLeaderListeners.Range(func(_, listener interface{}) bool {
			listener.(func())()
			return true
		})
	})
}
