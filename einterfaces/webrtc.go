// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

import (
	"github.com/mattermost/platform/model"
)

type WebRTCInterface interface {
	Token(sessionId string) (map[string]string, *model.AppError)
	RevokeToken(sessionId string)
}

var theWebRTCInterface WebRTCInterface

func RegisterWebRTCInterface(newInterface WebRTCInterface) {
	theWebRTCInterface = newInterface
}

func GetWebRTCInterface() WebRTCInterface {
	return theWebRTCInterface
}
