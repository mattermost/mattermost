package pluginapi

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
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

// Create creates a new user session.
//
// Minimum server version: 6.2
func (s *SessionService) Create(session *model.Session) (*model.Session, error) {
	session, appErr := s.api.CreateSession(session)

	return session, normalizeAppErr(appErr)
}

// ExtendSessionExpiry extends the duration of an existing session.
//
// Minimum server version: 6.2
func (s *SessionService) ExtendExpiry(sessionID string, newExpiry int64) error {
	return normalizeAppErr(s.api.ExtendSessionExpiry(sessionID, newExpiry))
}

// RevokeSession revokes an existing user session.
//
// Minimum server version: 6.2
func (s *SessionService) Revoke(sessionID string) error {
	return normalizeAppErr(s.api.RevokeSession(sessionID))
}
