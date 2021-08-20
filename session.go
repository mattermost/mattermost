package pluginapi

import (
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
)

// SessionService exposes methods to manipulate groups.
type SessionService struct {
	api plugin.API
}

// Get returns the session object for the Session ID
//
// Minimum server version: 5.2
func (s *SessionService) Get(id string) (*model.Session, error) {
	session, appErr := s.api.GetSession(id)

	return session, normalizeAppErr(appErr)
}
