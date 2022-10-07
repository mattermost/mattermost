// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

func (s *Server) IsLeader() bool {
	return s.platform.IsLeader()
}

func (a *App) IsLeader() bool {
	return a.Srv().IsLeader()
}

func (a *App) GetClusterId() string {

	return a.Srv().Platform().GetClusterId()
}
