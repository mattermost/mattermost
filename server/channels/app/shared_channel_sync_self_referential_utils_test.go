// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"io"
	"net/http"
	"sync/atomic"
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

// SelfReferentialSyncHandler handles incoming sync messages for self-referential tests.
// It processes the messages, updates cursors, and returns proper responses.
type SelfReferentialSyncHandler struct {
	t                *testing.T
	service          *sharedchannel.Service
	selfCluster      *model.RemoteCluster
	syncMessageCount *int32

	// Callbacks for capturing sync data
	OnIndividualSync func(userId string, messageNumber int32)
	OnBatchSync      func(userIds []string, messageNumber int32)
	OnGlobalUserSync func(userIds []string, messageNumber int32)
}

// NewSelfReferentialSyncHandler creates a new handler for processing sync messages in tests
func NewSelfReferentialSyncHandler(t *testing.T, service *sharedchannel.Service, selfCluster *model.RemoteCluster) *SelfReferentialSyncHandler {
	count := int32(0)
	return &SelfReferentialSyncHandler{
		t:                t,
		service:          service,
		selfCluster:      selfCluster,
		syncMessageCount: &count,
	}
}

// HandleRequest processes incoming HTTP requests for the test server.
// This handler includes common remote cluster endpoints to simulate a real remote cluster:
// - /api/v4/remotecluster/msg: Main sync message endpoint
// - /api/v4/remotecluster/ping: Ping endpoint to maintain online status (prevents offline after 5 minutes)
// - /api/v4/remotecluster/confirm_invite: Invitation confirmation endpoint
func (h *SelfReferentialSyncHandler) HandleRequest(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/api/v4/remotecluster/msg":
		currentCall := atomic.AddInt32(h.syncMessageCount, 1)

		// Read and process the sync message
		body, _ := io.ReadAll(r.Body)

		// The message is wrapped in a RemoteClusterFrame
		var frame model.RemoteClusterFrame

		err := json.Unmarshal(body, &frame)
		if err == nil {
			// Process the message to update cursor
			response := &remotecluster.Response{}
			processErr := h.service.OnReceiveSyncMessageForTesting(frame.Msg, h.selfCluster, response)
			if processErr != nil {
				response.Status = "ERROR"
				response.Err = processErr.Error()
			} else {
				// Success - build a proper sync response
				response.Status = "OK"
				response.Err = ""

				var syncMsg model.SyncMsg
				if unmarshalErr := json.Unmarshal(frame.Msg.Payload, &syncMsg); unmarshalErr == nil {
					syncResp := &model.SyncResponse{}

					// Handle global user sync
					if len(syncMsg.Users) > 0 {
						userIds := make([]string, 0, len(syncMsg.Users))
						for userId := range syncMsg.Users {
							userIds = append(userIds, userId)
							syncResp.UsersSyncd = append(syncResp.UsersSyncd, userId)
						}
						if h.OnGlobalUserSync != nil {
							h.OnGlobalUserSync(userIds, currentCall)
						}
					}

					_ = response.SetPayload(syncResp)
				}
			}

			// Send the proper response
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			respBytes, _ := json.Marshal(response)
			_, _ = w.Write(respBytes)
			return
		}

		writeOKResponse(w)

	case "/api/v4/remotecluster/ping":
		writeOKResponse(w)

	case "/api/v4/remotecluster/confirm_invite":
		writeOKResponse(w)

	default:
		writeOKResponse(w)
	}
}

// GetSyncMessageCount returns the current count of sync messages received
func (h *SelfReferentialSyncHandler) GetSyncMessageCount() int32 {
	return atomic.LoadInt32(h.syncMessageCount)
}

// GetUsersFromSyncMsg extracts user IDs from a sync message
func GetUsersFromSyncMsg(msg model.SyncMsg) []string {
	var userIds []string

	// Extract from users field
	for userId := range msg.Users {
		userIds = append(userIds, userId)
	}

	return userIds
}

// EnsureCleanState ensures a clean test state by removing all shared channels, remote clusters,
// and extra team/channel members. This helps prevent state pollution between tests.
func EnsureCleanState(t *testing.T, th *TestHelper, ss store.Store) {
	t.Helper()

	// Clear all shared channels and remotes from previous tests
	allSharedChannels, _ := ss.SharedChannel().GetAll(0, 1000, model.SharedChannelFilterOpts{})
	for _, sc := range allSharedChannels {
		// Delete all remotes for this channel
		remotes, _ := ss.SharedChannel().GetRemotes(0, 100, model.SharedChannelRemoteFilterOpts{ChannelId: sc.ChannelId})
		for _, remote := range remotes {
			_, _ = ss.SharedChannel().DeleteRemote(remote.Id)
		}
		// Delete the shared channel
		_, _ = ss.SharedChannel().Delete(sc.ChannelId)
	}

	// Delete all remote clusters
	allRemoteClusters, _ := ss.RemoteCluster().GetAll(0, 1000, model.RemoteClusterQueryFilter{})
	for _, rc := range allRemoteClusters {
		_, _ = ss.RemoteCluster().Delete(rc.RemoteId)
	}

	// Remove all channel members from test channels (except the basic team/channel setup)
	channels, _ := ss.Channel().GetAll(th.BasicTeam.Id)
	for _, channel := range channels {
		// Skip direct message and group channels, and skip the default channels
		if channel.Type != model.ChannelTypeDirect && channel.Type != model.ChannelTypeGroup &&
			channel.Id != th.BasicChannel.Id {
			members, _ := ss.Channel().GetMembers(channel.Id, 0, 10000)
			for _, member := range members {
				_ = ss.Channel().RemoveMember(th.Context, channel.Id, member.UserId)
			}
		}
	}

	// Remove all users from teams except the basic test users
	teams, _ := ss.Team().GetAll()
	for _, team := range teams {
		if team.Id == th.BasicTeam.Id {
			members, _ := ss.Team().GetMembers(team.Id, 0, 10000, nil)
			for _, member := range members {
				// Keep only the basic test users
				if member.UserId != th.BasicUser.Id && member.UserId != th.BasicUser2.Id &&
					member.UserId != th.SystemAdminUser.Id {
					_ = ss.Team().RemoveMember(th.Context, team.Id, member.UserId)
				}
			}
		}
	}

	// Get all active users and deactivate non-basic ones
	options := &model.UserGetOptions{
		Page:    0,
		PerPage: 200,
		Active:  true,
	}
	users, _ := ss.User().GetAllProfiles(options)
	for _, user := range users {
		// Keep only the basic test users active
		if user.Id != th.BasicUser.Id && user.Id != th.BasicUser2.Id &&
			user.Id != th.SystemAdminUser.Id {
			// Deactivate the user (soft delete)
			user.DeleteAt = model.GetMillis()
			_, _ = ss.User().Update(th.Context, user, true)
		}
	}

	// Verify cleanup is complete
	require.Eventually(t, func() bool {
		sharedChannels, _ := ss.SharedChannel().GetAll(0, 1000, model.SharedChannelFilterOpts{})
		remoteClusters, _ := ss.RemoteCluster().GetAll(0, 1000, model.RemoteClusterQueryFilter{})
		return len(sharedChannels) == 0 && len(remoteClusters) == 0
	}, 2*time.Second, 100*time.Millisecond, "Failed to clean up shared channels and remote clusters")

	// Reset batch size to default to ensure test isolation
	defaultBatchSize := 20
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.ConnectedWorkspacesSettings.GlobalUserSyncBatchSize = &defaultBatchSize
	})

	// Ensure services are running and ready
	scsInterface := th.App.Srv().GetSharedChannelSyncService()
	if scs, ok := scsInterface.(*sharedchannel.Service); ok {
		require.Eventually(t, func() bool {
			return scs.Active()
		}, 2*time.Second, 100*time.Millisecond, "Shared channel service should be active")
	}

	rcService := th.App.Srv().GetRemoteClusterService()
	if rcService != nil {
		if rc, ok := rcService.(*remotecluster.Service); ok {
			rc.SetActive(true)
		}
		require.Eventually(t, func() bool {
			return rcService.Active()
		}, 2*time.Second, 100*time.Millisecond, "Remote cluster service should be active")
	}
}
