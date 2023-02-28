// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

// Registers a given function to be called when the cluster leader may have changed. Returns a unique ID for the
// listener which can later be used to remove it. If clustering is not enabled in this build, the callback will never
// be called.
func (s *Server) AddClusterLeaderChangedListener(listener func()) string {
	return s.platform.AddClusterLeaderChangedListener(listener)
}

// Removes a listener function by the unique ID returned when AddConfigListener was called
func (s *Server) RemoveClusterLeaderChangedListener(id string) {
	s.platform.RemoveClusterLeaderChangedListener(id)
}

func (s *Server) InvokeClusterLeaderChangedListeners() {
	s.platform.InvokeClusterLeaderChangedListeners()
}
