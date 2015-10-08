// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	l4g "code.google.com/p/log4go"
	"fmt"
	"github.com/anachronistic/apns"
	"github.com/mattermost/platform/model"
)

func FireAndForgetSendAppleNotify(deviceId string, message string, badge int) {
	go func() {
		if err := SendAppleNotify(deviceId, message, badge); err != nil {
			l4g.Error(fmt.Sprintf("%v %v", err.Message, err.DetailedError))
		}
	}()
}

func SendAppleNotify(deviceId string, message string, badge int) *model.AppError {
	payload := apns.NewPayload()
	payload.Alert = message
	payload.Badge = 1

	pn := apns.NewPushNotification()
	pn.DeviceToken = deviceId
	pn.AddPayload(payload)
	client := apns.BareClient(Cfg.EmailSettings.ApplePushServer, Cfg.EmailSettings.ApplePushCertPublic, Cfg.EmailSettings.ApplePushCertPrivate)
	resp := client.Send(pn)

	if resp.Error != nil {
		return model.NewAppError("", "Could not send apple push notification", fmt.Sprintf("id=%v err=%v", deviceId, resp.Error))
	} else {
		return nil
	}
}
