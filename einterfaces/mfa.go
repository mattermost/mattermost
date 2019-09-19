// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost-server/model"
)

type MfaInterface interface {
	GenerateSecret(user *model.User) (string, []byte, error)
	Activate(user *model.User, token string) error
	Deactivate(userId string) error
	ValidateToken(secret, token string) (bool, error)
}
