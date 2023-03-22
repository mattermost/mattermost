// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

func (s *Server) initHandlers() {
	cfg := s.config
	s.api.MattermostAuth = cfg.AuthMode == MattermostAuthMod
}
