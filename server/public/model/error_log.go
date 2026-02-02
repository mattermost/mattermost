// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// ErrorLog represents an error captured from client-side JavaScript or server-side API.
type ErrorLog struct {
	Id             string `json:"id"`
	CreateAt       int64  `json:"create_at"`
	Type           string `json:"type"`            // "api" or "js"
	UserId         string `json:"user_id"`
	Username       string `json:"username"`
	Message        string `json:"message"`
	Stack          string `json:"stack"`
	Url            string `json:"url"`
	UserAgent      string `json:"user_agent"`
	StatusCode     int    `json:"status_code,omitempty"`     // For API errors
	Endpoint       string `json:"endpoint,omitempty"`        // For API errors
	Method         string `json:"method,omitempty"`          // For API errors
	ComponentStack string `json:"component_stack,omitempty"` // For React errors
	Extra          string `json:"extra,omitempty"`           // JSON metadata
}

// ErrorLogType constants
const (
	ErrorLogTypeAPI = "api"
	ErrorLogTypeJS  = "js"
)

// ErrorLogReport is the payload sent by clients to report errors.
type ErrorLogReport struct {
	Type           string `json:"type"`
	Message        string `json:"message"`
	Stack          string `json:"stack,omitempty"`
	Url            string `json:"url,omitempty"`
	Line           int    `json:"line,omitempty"`
	Column         int    `json:"column,omitempty"`
	ComponentStack string `json:"component_stack,omitempty"`
	Extra          string `json:"extra,omitempty"`
}

// IsValid validates the ErrorLogReport.
func (r *ErrorLogReport) IsValid() *AppError {
	if r.Type == "" {
		return NewAppError("ErrorLogReport.IsValid", "model.error_log.type.app_error", nil, "", 400)
	}
	if r.Type != ErrorLogTypeAPI && r.Type != ErrorLogTypeJS {
		return NewAppError("ErrorLogReport.IsValid", "model.error_log.type_invalid.app_error", nil, "type="+r.Type, 400)
	}
	if r.Message == "" {
		return NewAppError("ErrorLogReport.IsValid", "model.error_log.message.app_error", nil, "", 400)
	}
	return nil
}
