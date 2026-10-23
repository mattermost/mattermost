// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

// newBotEventReceiver returns a push receiver. It verifies the signature, answers URL
// verification, and queues each event once.
func newBotEventReceiver(secret string, events chan<- *model.BotEventEnvelope) http.HandlerFunc {
	var mut sync.Mutex
	seen := map[string]bool{}

	return func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
		if err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}

		var verification model.BotEventURLVerification
		if json.Unmarshal(body, &verification) == nil && verification.Type == model.BotEventTypeURLVerification {
			// The secret is not known yet when a subscription is created, so don't check the signature here.
			_ = json.NewEncoder(w).Encode(model.BotEventURLVerificationResponse{Challenge: verification.Challenge})
			return
		}

		err = model.VerifyBotEventSignature(secret, r.Header.Get(model.BotEventHeaderTimestamp), body, r.Header.Get(model.BotEventHeaderSignature), time.Now())
		if err != nil {
			http.Error(w, "invalid signature", http.StatusUnauthorized)
			return
		}

		var event model.BotEventEnvelope
		if err := json.Unmarshal(body, &event); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}

		// Delivery is at least once, so the same event_id can arrive again.
		mut.Lock()
		duplicate := seen[event.EventId]
		seen[event.EventId] = true
		mut.Unlock()

		if !duplicate {
			events <- &event
		}
		w.WriteHeader(http.StatusOK)
	}
}

func ExampleVerifyBotEventSignature() {
	secret := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	events := make(chan *model.BotEventEnvelope, 10)
	server := httptest.NewServer(newBotEventReceiver(secret, events))
	defer server.Close()

	body := []byte(`{"event_id":"event1","type":"post_dm","bot_user_id":"bot1"}`)
	post := func(sent, signed []byte) int {
		timestamp := time.Now().Unix()
		req, _ := http.NewRequest(http.MethodPost, server.URL, bytes.NewReader(sent))
		req.Header.Set(model.BotEventHeaderTimestamp, strconv.FormatInt(timestamp, 10))
		req.Header.Set(model.BotEventHeaderSignature, model.SignBotEventPayload(secret, timestamp, signed))

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			log.Fatal(err)
		}
		defer resp.Body.Close()
		return resp.StatusCode
	}

	fmt.Println(post(body, body))
	fmt.Println(post([]byte(`{"event_id":"event2","type":"post_dm","bot_user_id":"bot1"}`), body))

	resp, err := http.Post(server.URL, "application/json", bytes.NewReader([]byte(`{"type":"url_verification","challenge":"abc123","bot_user_id":"bot1"}`)))
	if err != nil {
		log.Fatal(err)
	}
	defer resp.Body.Close()

	var verified model.BotEventURLVerificationResponse
	if err := json.NewDecoder(resp.Body).Decode(&verified); err != nil {
		log.Fatal(err)
	}
	fmt.Println(verified.Challenge)

	// Output:
	// 200
	// 401
	// abc123
}

func ExampleClient4_GetBotEvents() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_BOT_TOKEN"))

	botUserID := "bot_user_id"
	cursor := ""
	for {
		list, _, err := client.GetBotEvents(context.Background(), botUserID, cursor, 100, 30)
		if err != nil {
			log.Print(err)
			time.Sleep(5 * time.Second)
			continue
		}

		for _, event := range list.Events {
			// Delivery is at least once, so processing must be idempotent.
			fmt.Printf("Event %s of type %s\n", event.EventId, event.Type)
		}

		// Passing the cursor on the next request acknowledges the events, so advance it only after processing.
		cursor = list.NextCursor
	}
}
