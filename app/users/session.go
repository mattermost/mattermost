// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package users

import (
	"context"

	"github.com/mattermost/mattermost-server/v6/model"
)

func (us *UserService) GetSessionContext(ctx context.Context, token string) (*model.Session, error) {
	return us.sessionStore.Get(ctx, token)
}

func (us *UserService) GetSessions(userID string) ([]*model.Session, error) {
	return us.sessionStore.GetSessions(userID)
}

func (us *UserService) GetSessionByID(sessionID string) (*model.Session, error) {
	return us.sessionStore.Get(context.Background(), sessionID)
}

// SetSessionExpireInHours sets the session's expiry the specified number of hours
// relative to either the session creation date or the current time, depending
// on the `ExtendSessionOnActivity` config setting.
func (us *UserService) SetSessionExpireInHours(session *model.Session, hours int) {
	if session.CreateAt == 0 || *us.config().ServiceSettings.ExtendSessionLengthWithActivity {
		session.ExpiresAt = model.GetMillis() + (1000 * 60 * 60 * int64(hours))
	} else {
		session.ExpiresAt = session.CreateAt + (1000 * 60 * 60 * int64(hours))
	}
}
