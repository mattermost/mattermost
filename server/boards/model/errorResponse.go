// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// ErrorResponse is an error response
// swagger:model
type ErrorResponse struct {
	// The error message
	// required: false
	Error string `json:"error"`

	// The error code
	// required: false
	ErrorCode int `json:"errorCode"`
}
