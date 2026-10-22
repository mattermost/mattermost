// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// AppError is a mock of Mattermost's AppError type for testing
type AppError struct {
	Where         string
	Message       string
	DetailedError string
	StatusCode    int
}

func (e *AppError) Error() string {
	return e.Message
}

// NewAppError creates a new AppError
func NewAppError(where string, message string, params map[string]any, details string, status int) *AppError {
	return &AppError{
		Where:         where,
		Message:       message,
		DetailedError: details,
		StatusCode:    status,
	}
}
