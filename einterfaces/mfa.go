// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

import (
	"github.com/mattermost/platform/model"
)

type MfaInterface interface {
	GenerateQrCode(user *model.User) ([]byte, *model.AppError)
	Activate(user *model.User, token string) *model.AppError
	Deactivate(userId string) *model.AppError
	ValidateToken(secret, token string) (bool, *model.AppError)
}

var theMfaInterface MfaInterface

func RegisterMfaInterface(newInterface MfaInterface) {
	theMfaInterface = newInterface
}

func GetMfaInterface() MfaInterface {
	return theMfaInterface
}
