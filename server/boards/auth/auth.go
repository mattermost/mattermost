// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:generate mockgen -copyright_file=../../copyright.txt -destination=mocks/mockauth_interface.go -package mocks . AuthInterface
package auth

import (
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/boards/model"
	"github.com/mattermost/mattermost-server/v6/boards/services/config"
	"github.com/mattermost/mattermost-server/v6/boards/services/permissions"
	"github.com/mattermost/mattermost-server/v6/boards/services/store"
	"github.com/mattermost/mattermost-server/v6/boards/utils"
)

type AuthInterface interface {
	GetSession(token string) (*model.Session, error)
	IsValidReadToken(boardID string, readToken string) (bool, error)
	DoesUserHaveTeamAccess(userID string, teamID string) bool
}

// Auth authenticates sessions.
type Auth struct {
	config      *config.Configuration
	store       store.Store
	permissions permissions.PermissionsService
}

// New returns a new Auth.
func New(config *config.Configuration, store store.Store, permissions permissions.PermissionsService) *Auth {
	return &Auth{config: config, store: store, permissions: permissions}
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
	if session.UpdateAt < (utils.GetMillis() - utils.SecondsToMillis(a.config.SessionRefreshTime)) {
		_ = a.store.RefreshSession(session)
	}
	return session, nil
}

// IsValidReadToken validates the read token for a board.
func (a *Auth) IsValidReadToken(boardID string, readToken string) (bool, error) {
	sharing, err := a.store.GetSharing(boardID)
	if model.IsErrNotFound(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	if sharing != nil && (sharing.ID == boardID && sharing.Enabled && sharing.Token == readToken) {
		return true, nil
	}

	return false, nil
}

func (a *Auth) DoesUserHaveTeamAccess(userID string, teamID string) bool {
	return a.permissions.HasPermissionToTeam(userID, teamID, model.PermissionViewTeam)
}
