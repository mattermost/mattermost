// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import "github.com/mattermost/mattermost-server/v6/app/request"

func (s *Server) IsLeader(c request.CTX) bool {
	return s.platform.IsLeader(c)
}

func (a *App) IsLeader(c request.CTX) bool {
	return a.Srv().IsLeader(c)
}

func (a *App) GetClusterId() string {

	return a.Srv().Platform().GetClusterId()
}
