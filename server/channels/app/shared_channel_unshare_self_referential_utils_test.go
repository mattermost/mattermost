// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"
	"github.com/mattermost/mattermost/server/v8/platform/services/sharedchannel"
	"github.com/stretchr/testify/require"
)

// writeOKResponse writes a standard OK JSON response in the format expected by remotecluster
func writeOKResponse(w http.ResponseWriter) {
	response := &remotecluster.Response{
		Status: "OK",
		Err:    "",
	}

	// Set empty sync response as payload
	syncResp := &model.SyncResponse{}
	_ = response.SetPayload(syncResp)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	respBytes, _ := json.Marshal(response)
	_, _ = w.Write(respBytes)
}

// SelfReferentialUnshareHandler handles incoming sync messages for unshare self-referential tests.
type SelfReferentialUnshareHandler struct {
	t                *testing.T
	service          *sharedchannel.Service
	selfCluster      *model.RemoteCluster
	SimulateUnshared bool // When true, always return ErrChannelIsNotShared for sync messages
}

// NewSelfReferentialUnshareHandler creates a new handler for processing unshare sync messages in tests
func NewSelfReferentialUnshareHandler(t *testing.T, service *sharedchannel.Service, selfCluster *model.RemoteCluster) *SelfReferentialUnshareHandler {
	return &SelfReferentialUnshareHandler{
		t:           t,
		service:     service,
		selfCluster: selfCluster,
	}
}

// HandleRequest processes incoming HTTP requests for the test server.
func (h *SelfReferentialUnshareHandler) HandleRequest(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/api/v4/remotecluster/msg":
		// Read and process the sync message
		body, _ := io.ReadAll(r.Body)
		h.t.Logf("Handler received sync message, body length: %d", len(body))

		// The message is wrapped in a RemoteClusterFrame
		var frame model.RemoteClusterFrame
		err := json.Unmarshal(body, &frame)
		if err == nil {
			h.t.Logf("Unmarshaled frame, topic: %s", frame.Msg.Topic)
			if frame.Msg.Topic == "sharedchannel_sync" {
				var syncMsg model.SyncMsg
				if unmarshalErr := json.Unmarshal(frame.Msg.Payload, &syncMsg); unmarshalErr == nil {
					h.t.Logf("Processing sync message for channel: %s", syncMsg.ChannelId)
				}
			}

			// Simulate the remote having unshared if configured to do so
			if h.SimulateUnshared && frame.Msg.Topic == "sharedchannel_sync" {
				var syncMsg model.SyncMsg
				if parseErr := json.Unmarshal(frame.Msg.Payload, &syncMsg); parseErr == nil {
					h.t.Logf("Simulating ErrChannelIsNotShared HTTP error for channel: %s", syncMsg.ChannelId)
				} else {
					h.t.Logf("Simulating ErrChannelIsNotShared HTTP error (couldn't parse channel ID)")
				}
				// Return HTTP error instead of JSON error response
				w.WriteHeader(http.StatusBadRequest)
				_, _ = w.Write([]byte("channel is no longer shared"))
				return
			}

			// Process normally using the actual service method
			response := &remotecluster.Response{}
			processErr := h.service.OnReceiveSyncMessageForTesting(frame.Msg, h.selfCluster, response)
			if processErr != nil {
				h.t.Logf("Sync message processing error: %v", processErr)
				response.Status = "ERROR"
				response.Err = processErr.Error()
			} else {
				h.t.Logf("Sync message processed successfully")
				response.Status = "OK"
				response.Err = ""
				syncResp := &model.SyncResponse{}
				_ = response.SetPayload(syncResp)
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			respBytes, _ := json.Marshal(response)
			_, _ = w.Write(respBytes)
			return
		}
		h.t.Logf("Failed to unmarshal frame: %v", err)
		writeOKResponse(w)

	case "/api/v4/remotecluster/ping":
		writeOKResponse(w)

	default:
		writeOKResponse(w)
	}
}

// EnsureCleanUnshareState ensures a clean test state for unshare tests
func EnsureCleanUnshareState(t *testing.T, th *TestHelper, ss store.Store) {
	t.Helper()

	// Clear all shared channels and remotes
	allSharedChannels, _ := ss.SharedChannel().GetAll(0, 1000, model.SharedChannelFilterOpts{})
	for _, sc := range allSharedChannels {
		remotes, _ := ss.SharedChannel().GetRemotes(0, 100, model.SharedChannelRemoteFilterOpts{ChannelId: sc.ChannelId})
		for _, remote := range remotes {
			_, _ = ss.SharedChannel().DeleteRemote(remote.Id)
		}
		_, _ = ss.SharedChannel().Delete(sc.ChannelId)
	}

	// Delete all remote clusters
	allRemoteClusters, _ := ss.RemoteCluster().GetAll(0, 1000, model.RemoteClusterQueryFilter{})
	for _, rc := range allRemoteClusters {
		_, _ = ss.RemoteCluster().Delete(rc.RemoteId)
	}

	// Verify cleanup is complete
	require.Eventually(t, func() bool {
		sharedChannels, _ := ss.SharedChannel().GetAll(0, 1000, model.SharedChannelFilterOpts{})
		remoteClusters, _ := ss.RemoteCluster().GetAll(0, 1000, model.RemoteClusterQueryFilter{})
		return len(sharedChannels) == 0 && len(remoteClusters) == 0
	}, 2*time.Second, 100*time.Millisecond, "Failed to clean up shared channels and remote clusters")

	// Ensure services are running
	scsInterface := th.App.Srv().GetSharedChannelSyncService()
	if scs, ok := scsInterface.(*sharedchannel.Service); ok {
		_ = scs.Start()
		require.Eventually(t, func() bool {
			return scs.Active()
		}, 2*time.Second, 100*time.Millisecond, "Shared channel service should be active")
	}

	rcService := th.App.Srv().GetRemoteClusterService()
	if rcService != nil {
		_ = rcService.Start()
		require.Eventually(t, func() bool {
			return rcService.Active()
		}, 2*time.Second, 100*time.Millisecond, "Remote cluster service should be active")
	}
}
