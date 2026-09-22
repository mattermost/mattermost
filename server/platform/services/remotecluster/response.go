// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"encoding/json"
	"fmt"
	"io"
)

// MaxRemoteResponseSize is the number of bytes read from a remote server's reply to an outbound
// request. The replies are a status response, a FileInfo or a ping response, all far smaller.
const MaxRemoteResponseSize = 1024 * 1024

// readRemoteResponse returns the body of a remote server's reply, provided it is no longer than
// MaxRemoteResponseSize. A longer body is reported as an error instead of being returned clipped,
// so callers decode either a complete reply or nothing.
func readRemoteResponse(body io.Reader) ([]byte, error) {
	// Read one byte past the maximum so a body of exactly MaxRemoteResponseSize can be
	// distinguished from a longer one.
	buf, err := io.ReadAll(io.LimitReader(body, MaxRemoteResponseSize+1))
	if err != nil {
		return nil, err
	}
	if len(buf) > MaxRemoteResponseSize {
		return nil, fmt.Errorf("response body longer than %d bytes", MaxRemoteResponseSize)
	}
	return buf, nil
}

// drainRemoteResponse reads and discards up to MaxRemoteResponseSize bytes of a remote server's
// reply, allowing the HTTP connection to be reused. It is for callers that make no use of the body.
func drainRemoteResponse(body io.Reader) error {
	_, err := io.Copy(io.Discard, io.LimitReader(body, MaxRemoteResponseSize))
	return err
}

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
