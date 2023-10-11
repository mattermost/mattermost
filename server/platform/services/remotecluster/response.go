// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"encoding/json"
)

// Response represents the bytes replied from a remote server when a message is sent.
type Response struct {
	Status  string          `json:"status"`
	Err     string          `json:"err"`
	Payload json.RawMessage `json:"payload"`
}

// IsSuccess returns true if the response status indicates success.
func (r *Response) IsSuccess() bool {
	return r.Status == ResponseStatusOK
}

// SetPayload serializes an arbitrary struct as a RawMessage.
func (r *Response) SetPayload(v any) error {
	raw, err := json.Marshal(v)
	if err != nil {
		return err
	}
	r.Payload = raw
	return nil
}
