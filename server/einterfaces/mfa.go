// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost-server/server/public/model"
)

type MfaInterface interface {
	GenerateSecret(user *model.User) (string, []byte, *model.AppError)
	Activate(user *model.User, token string) *model.AppError
	Deactivate(userID string) *model.AppError
	ValidateToken(secret, token string) (bool, *model.AppError)
}
