// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type FlagContentRequest struct {
	TargetId string `json:"target_id"`
	Reason   string `json:"reason"`
	Comment  string `json:"comment,omitempty"`
	UserId   string `json:"-"` // This field is not expected to be sent by client. User ID will be set by the server based on the session.
}
