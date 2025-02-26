// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type SubscribeNewsletterRequest struct {
	Email             string `json:"email"`
	ServerID          string `json:"server_id"`
	SubscribedContent string `json:"subscribed_content"`
}
