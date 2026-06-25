// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

const (
	DeliveryMechUnknown         int16 = 0
	DeliveryMechProduct         int16 = 1 // viewed within the Mattermost product (web/desktop/mobile UI or API)
	DeliveryMechEmail           int16 = 2 // email notification
	DeliveryMechPush            int16 = 3 // push notification
	DeliveryMechOutgoingWebhook int16 = 4 // outgoing webhook payload
	DeliveryMechPlugin          int16 = 5 // delivered to a server plugin
)

const (
	DeliveryTargetUser    = "user"
	DeliveryTargetPlugin  = "plugin"
	DeliveryTargetWebhook = "webhook"
)

type UserPostDelivery struct {
	PostID     string `json:"post_id" db:"post_id"`
	TargetID   string `json:"target_id" db:"target_id"`
	TargetType string `json:"target_type" db:"target_type"`
	Mechanism  int16  `json:"mechanism" db:"mechanism"`
	CreatedAt  int64  `json:"created_at" db:"created_at"`
}
