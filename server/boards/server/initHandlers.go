package server

func (s *Server) initHandlers() {
	cfg := s.config
	s.api.MattermostAuth = cfg.AuthMode == MattermostAuthMod
}
