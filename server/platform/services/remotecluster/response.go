// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

// MaxRemoteResponseSize is the number of bytes read from a remote server's reply to an outbound
// request. The replies are a status response, a FileInfo or a ping response, all far smaller.
const MaxRemoteResponseSize = 1024 * 1024

// sendRemoteRequest sends req to a remote server and returns the body of its reply, read with
// readRemoteResponse. A failure to send the request or to read the reply wraps errRemoteUnreachable,
// and a reply longer than MaxRemoteResponseSize wraps errRemoteResponseTooLarge. A non-200 status is
// an error, returned with the body when it was read in full.
//
// The nil Idempotency-Key marks req as replayable, so the transport resends it on a new connection
// when a reused one is dropped before any reply byte arrives. A nil value is not sent.
func (rcs *Service) sendRemoteRequest(req *http.Request) ([]byte, error) {
	req.Header["Idempotency-Key"] = nil

	resp, err := rcs.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", errRemoteUnreachable, err)
	}
	defer resp.Body.Close()

	body, err := readRemoteResponse(resp.Body)
	if err != nil && !errors.Is(err, errRemoteResponseTooLarge) {
		return nil, fmt.Errorf("%w: %w", errRemoteUnreachable, err)
	}
	if resp.StatusCode != http.StatusOK {
		statusErr := fmt.Errorf("unexpected response: %d - %s", resp.StatusCode, resp.Status)
		if err != nil {
			return nil, fmt.Errorf("%w: %w", statusErr, err)
		}
		return body, statusErr
	}
	if err != nil {
		return nil, err
	}
	return body, nil
}

// readRemoteResponse returns the body of a remote server's reply, provided it is no longer than
// MaxRemoteResponseSize. A longer body is reported as errRemoteResponseTooLarge instead of being
// returned clipped, so callers decode either a complete reply or nothing.
func readRemoteResponse(body io.Reader) ([]byte, error) {
	buf, err := io.ReadAll(utils.NewLimitedReaderWithError(body, MaxRemoteResponseSize))
	if errors.Is(err, utils.ErrSizeLimitExceeded) {
		return nil, fmt.Errorf("%w: body longer than %d bytes", errRemoteResponseTooLarge, MaxRemoteResponseSize)
	}
	if err != nil {
		return nil, err
	}
	return buf, nil
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
