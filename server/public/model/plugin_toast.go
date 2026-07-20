// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// SendToastMessageOptions contains options for sending a toast message to a user.
type SendToastMessageOptions struct {
	// Position is the position where the toast should appear.
	// Valid values: "top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"
	// If empty or invalid, defaults to "bottom-right" on the frontend.
	Position string `json:"position,omitempty"`
}
