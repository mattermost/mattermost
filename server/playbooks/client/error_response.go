// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"encoding/json"
	"errors"
	"fmt"
)

// ErrorResponse is an error from an API request.
type ErrorResponse struct {
	// Method is the HTTP verb used in the API request.
	Method string
	// URL is the HTTP endpoint used in the API request.
	URL string
	// StatusCode is the HTTP status code returned by the API.
	StatusCode int

	// Err is the error parsed from the API response.
	Err error `json:"error"`
}

func (e *ErrorResponse) UnmarshalJSON(data []byte) error {
	type Alias ErrorResponse
	temp := &struct {
		Err string `json:"error"`
		*Alias
	}{
		Alias: (*Alias)(e),
	}

	// Try to extract a structured error from the body, otherwise fall back to using
	// the whole body as the error message.
	if err := json.Unmarshal(data, &temp); err != nil || temp.Err == "" {
		e.Err = errors.New(string(data))
	} else {
		e.Err = errors.New(temp.Err)
	}
	return nil
}

// Unwrap exposes the underlying error of an ErrorResponse.
func (r *ErrorResponse) Unwrap() error {
	return r.Err
}

// Error describes the error from the API request.
func (r *ErrorResponse) Error() string {
	return fmt.Sprintf("%s %s [%d]: %v", r.Method, r.URL, r.StatusCode, r.Err)
}
