// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package testlib

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
)

// BotEventRequest is a request received by a BotEventReceiver.
type BotEventRequest struct {
	Header  http.Header
	Body    []byte
	EventID string
}

// BotEventReceiver is a push callback endpoint for tests. It echoes URL verification
// challenges itself and passes every other request to the handler, whose return value
// is the response status.
type BotEventReceiver struct {
	Server *httptest.Server

	mu            sync.Mutex
	events        []BotEventRequest
	verifications []BotEventRequest
	inFlight      map[string]int // by bot id
	maxInFlight   int
}

func NewBotEventReceiver(t testing.TB, handler func(r *http.Request, body []byte) int) *BotEventReceiver {
	t.Helper()

	rcv := &BotEventReceiver{inFlight: map[string]int{}}
	rcv.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		req := BotEventRequest{Header: r.Header.Clone(), Body: body, EventID: r.Header.Get(model.BotEventHeaderEventId)}

		var verification model.BotEventURLVerification
		if json.Unmarshal(body, &verification) == nil && verification.Type == model.BotEventTypeURLVerification {
			rcv.mu.Lock()
			rcv.verifications = append(rcv.verifications, req)
			rcv.mu.Unlock()
			_ = json.NewEncoder(w).Encode(model.BotEventURLVerificationResponse{Challenge: verification.Challenge})
			return
		}

		rcv.mu.Lock()
		rcv.events = append(rcv.events, req)
		botID := r.Header.Get(model.BotEventHeaderBotId)
		rcv.inFlight[botID]++
		rcv.maxInFlight = max(rcv.maxInFlight, rcv.inFlight[botID])
		rcv.mu.Unlock()
		defer func() {
			rcv.mu.Lock()
			rcv.inFlight[botID]--
			rcv.mu.Unlock()
		}()

		status := http.StatusOK
		if handler != nil {
			status = handler(r, body)
		}
		w.WriteHeader(status)
	}))
	t.Cleanup(rcv.Server.Close)
	return rcv
}

func (r *BotEventReceiver) URL() string {
	return r.Server.URL
}

// Events returns the event requests in arrival order.
func (r *BotEventReceiver) Events() []BotEventRequest {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]BotEventRequest(nil), r.events...)
}

func (r *BotEventReceiver) Verifications() []BotEventRequest {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]BotEventRequest(nil), r.verifications...)
}

// EventIDs returns the ids of the received event requests in arrival order.
func (r *BotEventReceiver) EventIDs() []string {
	events := r.Events()
	ids := make([]string, len(events))
	for i, e := range events {
		ids[i] = e.EventID
	}
	return ids
}

// MaxInFlight is the highest number of event requests for one bot that were being handled at once.
func (r *BotEventReceiver) MaxInFlight() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.maxInFlight
}
