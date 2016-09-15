// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

import (
	"github.com/mattermost/platform/model"
)

type WebrtcInterface interface {
	Token(sessionId string) (map[string]string, *model.AppError)
	RevokeToken(sessionId string)
}

var theWebrtcInterface WebrtcInterface

func RegisterWebrtcInterface(newInterface WebrtcInterface) {
	theWebrtcInterface = newInterface
}

func GetWebrtcInterface() WebrtcInterface {
	return theWebrtcInterface
}
