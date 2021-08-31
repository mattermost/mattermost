package auth

import (
	"database/sql"
	"time"

	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/config"
	"github.com/mattermost/focalboard/server/services/store"
	"github.com/pkg/errors"
)

// Auth authenticates sessions.
type Auth struct {
	config *config.Configuration
	store  store.Store
}

// New returns a new Auth.
func New(config *config.Configuration, store store.Store) *Auth {
	return &Auth{config: config, store: store}
}

// GetSession Get a user active session and refresh the session if needed.
func (a *Auth) GetSession(token string) (*model.Session, error) {
	if len(token) < 1 {
		return nil, errors.New("no session token")
	}

	session, err := a.store.GetSession(token, a.config.SessionExpireTime)
	if err != nil {
		return nil, errors.Wrap(err, "unable to get the session for the token")
	}
	if session.UpdateAt < (time.Now().Unix() - a.config.SessionRefreshTime) {
		_ = a.store.RefreshSession(session)
	}
	return session, nil
}

// IsValidReadToken validates the read token for a block.
func (a *Auth) IsValidReadToken(c store.Container, blockID string, readToken string) (bool, error) {
	rootID, err := a.store.GetRootID(c, blockID)
	if err != nil {
		return false, err
	}

	sharing, err := a.store.GetSharing(c, rootID)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	if sharing != nil && (sharing.ID == rootID && sharing.Enabled && sharing.Token == readToken) {
		return true, nil
	}

	return false, nil
}

func (a *Auth) DoesUserHaveWorkspaceAccess(userID string, workspaceID string) bool {
	hasAccess, err := a.store.HasWorkspaceAccess(userID, workspaceID)
	if err != nil {
		return false
	}
	return hasAccess
}
