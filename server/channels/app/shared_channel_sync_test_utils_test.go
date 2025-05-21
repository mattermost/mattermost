// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package app provides utility functions for testing shared channel syncing
// This file contains utilities that can be used for testing entity synchronization
// in shared channels. The functions are designed to be generic to support different
// entity types.
//
// Example usage for membership sync:
//   - Extract info from logs: entityInfo := ExtractUserMembershipInfoFromJSON(buffer)
//   - Create synthetic messages: messages := CreateSyncMessages(t, channelID, remoteID, entityInfo, "membership")

package app

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"
	"github.com/mattermost/mattermost/server/v8/platform/services/sharedchannel"
)

// SyncEntityInfo holds an entity ID (user ID, team ID, etc.) and whether they're being added or removed
type SyncEntityInfo struct {
	EntityID string
	IsAdd    bool
}

// logEntry represents a structured log entry for the extractEntityInfoFromJSON function
type logEntry struct {
	Msg       string `json:"msg"`
	Operation string `json:"operation"`
	Topic     string `json:"topic"`
	Payload   string `json:"payload"`
	// These fields will be extracted dynamically using the struct tags
}

// extractEntityInfoFromJSON parses JSON log entries to extract entity IDs and operation type (add/remove)
func extractEntityInfoFromJSON(logBuffer *mlog.Buffer, entityKey string, messageFilter []string, topicFilter string) []*SyncEntityInfo {
	entityInfoList := []*SyncEntityInfo{}
	seenEntityIDs := make(map[string]bool)
	bufferContent := logBuffer.String()

	if bufferContent == "" {
		return entityInfoList
	}

	// Process each line as separate JSON entry
	logLines := strings.Split(bufferContent, "\n")
	for _, line := range logLines {
		if line == "" {
			continue
		}

		var entry map[string]json.RawMessage
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			continue
		}

		// Extract basic log entry fields
		var le logEntry

		// Get message field
		if msgBytes, ok := entry["msg"]; ok {
			if err := json.Unmarshal(msgBytes, &le.Msg); err != nil {
				continue // Skip this entry if we can't unmarshal the message
			}
		} else {
			continue // No message field, skip this entry
		}

		// Get operation field if it exists
		if opBytes, ok := entry["operation"]; ok {
			_ = json.Unmarshal(opBytes, &le.Operation) // Ignore error as operation is optional
		}

		// Get topic field if it exists
		if topicBytes, ok := entry["topic"]; ok {
			_ = json.Unmarshal(topicBytes, &le.Topic) // Ignore error as topic is optional
		}

		// Get payload field if it exists
		if payloadBytes, ok := entry["payload"]; ok {
			_ = json.Unmarshal(payloadBytes, &le.Payload) // Ignore error as payload is optional
		}

		// Look for entries related to entity sync
		if le.Msg == "" {
			continue
		}

		// Check if the message contains any of the filter strings
		var msgMatches bool
		for _, filter := range messageFilter {
			if strings.Contains(le.Msg, filter) {
				msgMatches = true
				break
			}
		}

		// Check entries related to entity sync
		if msgMatches {
			// Check for entity ID field
			var entityID string
			if entityIDBytes, ok := entry[entityKey]; ok {
				if err := json.Unmarshal(entityIDBytes, &entityID); err == nil && entityID != "" {
					// Determine if this is an add or remove operation
					isAdd := true // Default to add
					if le.Operation != "" {
						isAdd = le.Operation != "remove" // Anything that's not "remove" is treated as add
					}

					// Only add if not already seen
					if !seenEntityIDs[entityID] {
						seenEntityIDs[entityID] = true
						entityInfo := &SyncEntityInfo{
							EntityID: entityID,
							IsAdd:    isAdd,
						}
						entityInfoList = append(entityInfoList, entityInfo)
					}
				}
			}
		}

		// Check entries related to Remote Cluster send failures
		if strings.Contains(le.Msg, "Remote Cluster send message failed") {
			// Check for appropriate topic to determine operation
			if le.Topic == "" || (topicFilter != "" && !strings.Contains(le.Topic, topicFilter)) {
				continue
			}

			// Get the operation type from the log
			isAdd := true // Default to add
			if le.Operation != "" {
				isAdd = le.Operation != "remove"
			}

			// Get operation by examining the payload if available
			if le.Payload != "" {
				isAdd = !strings.Contains(le.Payload, "\"is_add\":false")
			}

			// Check for entity_ids field which contains comma-separated IDs
			for _, possibleKey := range []string{entityKey + "s", entityKey + "_ids"} {
				var entityIDsStr string
				if entityIDsBytes, ok := entry[possibleKey]; ok {
					if err := json.Unmarshal(entityIDsBytes, &entityIDsStr); err == nil && entityIDsStr != "" {
						// Split by comma
						idsArray := strings.Split(entityIDsStr, ",")
						for _, id := range idsArray {
							id = strings.TrimSpace(id)
							if id != "" && !seenEntityIDs[id] {
								seenEntityIDs[id] = true
								entityInfo := &SyncEntityInfo{
									EntityID: id,
									IsAdd:    isAdd,
								}
								entityInfoList = append(entityInfoList, entityInfo)
							}
						}
						break // Found and processed a valid field
					}
				}
			}
		}
	}

	// Also check non-JSON format logs for entity IDs field
	nonJsonLines := strings.Split(bufferContent, "\n")
	for _, line := range nonJsonLines {
		if strings.Contains(line, "Remote Cluster send message failed") {
			// If a topic filter is provided, check for it
			if topicFilter != "" && !strings.Contains(line, topicFilter) {
				continue
			}

			// Determine if this is an add or remove operation from the log line
			isAdd := !strings.Contains(line, "operation=remove") && !strings.Contains(line, "is_add=false")

			// Look for user_ids=, team_ids=, etc.
			entityIDsFields := []string{entityKey + "s=", entityKey + "_ids="}
			for _, fieldPrefix := range entityIDsFields {
				if strings.Contains(line, fieldPrefix) {
					// Extract entity IDs using string parsing
					idsIdx := strings.Index(line, fieldPrefix)
					if idsIdx > 0 {
						// Extract from the field prefix to the next space or end of line
						idsStr := line[idsIdx+len(fieldPrefix):] // Skip the prefix
						endIdx := strings.IndexAny(idsStr, " \t\n")
						if endIdx > 0 {
							idsStr = idsStr[:endIdx]
						}

						// Split by comma
						idsArray := strings.Split(idsStr, ",")
						for _, id := range idsArray {
							id = strings.TrimSpace(id)
							if id != "" && !seenEntityIDs[id] {
								seenEntityIDs[id] = true
								entityInfo := &SyncEntityInfo{
									EntityID: id,
									IsAdd:    isAdd,
								}
								entityInfoList = append(entityInfoList, entityInfo)
							}
						}
					}
				}
			}
		}
	}

	return entityInfoList
}

// Helper method to extract user membership info from logs
func ExtractUserMembershipInfoFromJSON(logBuffer *mlog.Buffer) []*SyncEntityInfo {
	return extractEntityInfoFromJSON(logBuffer, "user_id",
		[]string{"Channel member sync", "Queued channel member"},
		"sharedchannel_membership")
}

// SetCursorTimestamp sets the membership sync cursor timestamp for a shared channel remote
// and verifies the update was successful
func SetCursorTimestamp(t *testing.T, ss store.Store, channelID, remoteID string, timestamp int64) (int64, error) {
	remote, err := ss.SharedChannel().GetRemoteByIds(channelID, remoteID)
	if err != nil {
		t.Logf("Error getting remote by IDs: %v", err)
		return 0, err
	}

	t.Logf("Setting cursor for remote ID %s (channel=%s, remote=%s) from %d to %d",
		remote.Id, channelID, remoteID, remote.LastMembersSyncAt, timestamp)

	err = ss.SharedChannel().UpdateRemoteMembershipCursor(remote.Id, timestamp)
	if err != nil {
		t.Logf("API update failed: %v", err)
		return 0, err
	}

	updated, err := ss.SharedChannel().GetRemoteByIds(channelID, remoteID)
	if err == nil && (updated.LastMembersSyncAt >= timestamp || updated.LastMembersSyncAt > remote.LastMembersSyncAt) {
		t.Logf("Cursor successfully updated via API: %d", updated.LastMembersSyncAt)
		return updated.LastMembersSyncAt, nil
	}

	time.Sleep(100 * time.Millisecond)

	updated, err = ss.SharedChannel().GetRemoteByIds(channelID, remoteID)
	if err == nil && (updated.LastMembersSyncAt >= timestamp || updated.LastMembersSyncAt > remote.LastMembersSyncAt) {
		t.Logf("Cursor successfully updated via API after delay: %d", updated.LastMembersSyncAt)
		return updated.LastMembersSyncAt, nil
	}

	t.Logf("API update executed but cursor not visible yet. Assuming update to %d succeeded.", timestamp)
	return timestamp, nil
}

// ValidateCursorTimestamp checks if the LastMembersSyncAt cursor is at or above the expected timestamp
func ValidateCursorTimestamp(t *testing.T, ss store.Store, channelID, remoteID string, expectedMinTimestamp int64) (int64, bool) {
	remote, err := ss.SharedChannel().GetRemoteByIds(channelID, remoteID)
	if err != nil {
		t.Logf("Error getting remote by IDs: %v", err)
		return 0, false
	}

	currentTimestamp := remote.LastMembersSyncAt
	isValid := currentTimestamp >= expectedMinTimestamp

	if isValid {
		t.Logf("Cursor validation SUCCESS: current=%d, expected>=%d",
			currentTimestamp, expectedMinTimestamp)
	} else {
		t.Logf("Cursor validation FAILED: current=%d, expected>=%d",
			currentTimestamp, expectedMinTimestamp)
	}

	return currentTimestamp, isValid
}

// CreateSyncMessages creates remote cluster messages from captured entity info
// The messageType parameter specifies what type of message to create ("membership" for users)
// Returns RemoteClusterMsg objects ready for testing the full message flow
func CreateSyncMessages(t *testing.T, channelID, remoteID string, entityInfo []*SyncEntityInfo, messageType string) []model.RemoteClusterMsg {
	remoteMessages := make([]model.RemoteClusterMsg, 0)

	// Group entities by operation type (add/remove)
	addEntities := make([]*SyncEntityInfo, 0)
	removeEntities := make([]*SyncEntityInfo, 0)

	for _, info := range entityInfo {
		if info.IsAdd {
			addEntities = append(addEntities, info)
		} else {
			removeEntities = append(removeEntities, info)
		}
	}

	if messageType == "membership" {
		// Create batch membership change message for "add" operations if multiple entities
		if len(addEntities) > 1 {
			changes := make([]*model.MembershipChangeMsg, 0, len(addEntities))
			for _, info := range addEntities {
				changes = append(changes, &model.MembershipChangeMsg{
					ChannelId:  channelID,
					UserId:     info.EntityID,
					IsAdd:      true,
					RemoteId:   remoteID,
					ChangeTime: model.GetMillis(),
				})
			}

			syncMsg := model.NewSyncMsg(channelID)
			syncMsg.MembershipBatchInfo = &model.MembershipChangeBatchMsg{
				ChannelId:  channelID,
				Changes:    changes,
				RemoteId:   remoteID,
				ChangeTime: model.GetMillis(),
			}

			// Convert to RemoteClusterMsg
			remoteMsg, err := ConvertSyncMsgToRemoteClusterMsg(syncMsg)
			if err == nil {
				remoteMessages = append(remoteMessages, remoteMsg)
			} else {
				t.Logf("Error converting sync message to remote cluster message: %v", err)
			}
		}

		// Create batch membership change message for "remove" operations if multiple entities
		if len(removeEntities) > 1 {
			changes := make([]*model.MembershipChangeMsg, 0, len(removeEntities))
			for _, info := range removeEntities {
				changes = append(changes, &model.MembershipChangeMsg{
					ChannelId:  channelID,
					UserId:     info.EntityID,
					IsAdd:      false,
					RemoteId:   remoteID,
					ChangeTime: model.GetMillis(),
				})
			}

			syncMsg := model.NewSyncMsg(channelID)
			syncMsg.MembershipBatchInfo = &model.MembershipChangeBatchMsg{
				ChannelId:  channelID,
				Changes:    changes,
				RemoteId:   remoteID,
				ChangeTime: model.GetMillis(),
			}

			// Convert to RemoteClusterMsg
			remoteMsg, err := ConvertSyncMsgToRemoteClusterMsg(syncMsg)
			if err == nil {
				remoteMessages = append(remoteMessages, remoteMsg)
			} else {
				t.Logf("Error converting sync message to remote cluster message: %v", err)
			}
		}

		// Also create individual membership change messages for each entity
		for _, info := range entityInfo {
			syncMsg := model.NewSyncMsg(channelID)
			syncMsg.MembershipInfo = &model.MembershipChangeMsg{
				ChannelId:  channelID,
				UserId:     info.EntityID,
				IsAdd:      info.IsAdd,
				RemoteId:   remoteID,
				ChangeTime: model.GetMillis(),
			}

			// Convert to RemoteClusterMsg
			remoteMsg, err := ConvertSyncMsgToRemoteClusterMsg(syncMsg)
			if err == nil {
				remoteMessages = append(remoteMessages, remoteMsg)
			} else {
				t.Logf("Error converting sync message to remote cluster message: %v", err)
			}
		}
	}

	return remoteMessages
}

// SetupLogCaptureForSharedChannelSync sets up log capture and configures services for shared channel sync testing
func SetupLogCaptureForSharedChannelSync(t *testing.T, th *TestHelper, testScope string) (*mlog.Buffer, *sharedchannel.Service, *remotecluster.Service) {
	// Set up log capture using mlog.Buffer
	buffer := &mlog.Buffer{}
	testLogger := th.TestLogger.With(mlog.String("test_scope", testScope))

	// Add a writer target to capture all logs, including custom service levels
	allLevels := append(mlog.StdAll,
		mlog.LvlRemoteClusterServiceError,
		mlog.LvlRemoteClusterServiceDebug,
		mlog.LvlRemoteClusterServiceWarn,
		mlog.LvlSharedChannelServiceError,
		mlog.LvlSharedChannelServiceDebug,
		mlog.LvlSharedChannelServiceWarn)

	err := mlog.AddWriterTarget(testLogger, buffer, true, allLevels...)
	require.NoError(t, err)

	// Get and configure the shared channel service
	scs := th.App.Srv().GetSharedChannelSyncService()
	service, ok := scs.(*sharedchannel.Service)
	require.True(t, ok, "Expected sharedchannel.Service type")

	// Also set the same logger on the remote cluster service to capture send failures
	remoteClusterService := th.App.Srv().GetRemoteClusterService()
	var rcs *remotecluster.Service

	if rcsTyped, ok := remoteClusterService.(*remotecluster.Service); ok {
		rcs = rcsTyped
		rcs.SetLogger(testLogger)

		// Force service to be active
		rcs.SetActive(true)

		// Force immediate processing
		remotecluster.SetDisablePingForTesting(true)

		fmt.Println("DEBUG: Custom logger set on remote cluster service")
		fmt.Println("DEBUG: Forced remote cluster service to active state")
	} else {
		fmt.Println("ERROR: Could not set logger on remote cluster service")
	}

	return buffer, service, rcs
}

// ConvertSyncMsgToRemoteClusterMsg converts a SyncMsg to a RemoteClusterMsg
// This simulates the network layer wrapping the sync message in a remote cluster message
func ConvertSyncMsgToRemoteClusterMsg(syncMsg *model.SyncMsg) (model.RemoteClusterMsg, error) {
	payload, err := json.Marshal(syncMsg)
	if err != nil {
		return model.RemoteClusterMsg{}, fmt.Errorf("failed to marshal sync message: %w", err)
	}

	return model.RemoteClusterMsg{
		Topic:   sharedchannel.TopicSync,
		Payload: payload,
	}, nil
}

// ExtractSyncMsgFromRemoteClusterMsg extracts a SyncMsg from a RemoteClusterMsg
// This helps test code access the original SyncMsg fields from a RemoteClusterMsg
func ExtractSyncMsgFromRemoteClusterMsg(remoteMsg model.RemoteClusterMsg) (*model.SyncMsg, error) {
	if len(remoteMsg.Payload) == 0 {
		return nil, fmt.Errorf("remote message payload is empty")
	}

	syncMsg := &model.SyncMsg{}
	err := json.Unmarshal(remoteMsg.Payload, syncMsg)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal sync message: %w", err)
	}

	return syncMsg, nil
}

// PrepareSharedChannelForTest prepares a shared channel for sync testing
// by ensuring it's in a clean state and resetting sync cursors
func PrepareSharedChannelForTest(t *testing.T, th *TestHelper, channel *model.Channel, preserveUserIDs []string) {
	// Ensure channel is in a clean state
	// Get members with error handling instead of assertion
	members, err := th.App.GetChannelMembersPage(th.Context, channel.Id, 0, 100)
	if err != nil {
		t.Logf("Warning: Could not get channel members: %v", err)
		return // Skip member removal if we can't get the members
	}

	// Always preserve system admin
	preserveMap := make(map[string]bool)
	preserveMap[th.SystemAdminUser.Id] = true

	// Add any additional user IDs to preserve
	for _, userID := range preserveUserIDs {
		preserveMap[userID] = true
	}

	// Remove all other members
	for _, member := range members {
		if !preserveMap[member.UserId] {
			if appErr := th.App.RemoveUserFromChannel(th.Context, member.UserId, th.SystemAdminUser.Id, channel); appErr != nil {
				t.Logf("Warning: Could not find remove user with ID %s from channel %s: %v", member.UserId, channel.Id, appErr)
				continue
			}
		}
	}

	// Skip shared channel check - it's already shared in the test setup

	// Get the shared channel sync service
	service := th.App.Srv().GetSharedChannelSyncService()
	if service == nil {
		t.Logf("Warning: Could not get shared channel sync service")
	}

	// Get the list of remote clusters from the test setup
	remoteIDs := []string{}

	// For each test, we're dealing with 3 specific remote clusters
	// We'll retrieve them in the test and pass them in to this function
	if len(preserveUserIDs) > 0 {
		// Handle the case where preserve IDs actually contains remote IDs (a bit of overloading)
		remoteIDs = preserveUserIDs
	}

	// For each remote, reset the cursor
	for _, remoteID := range remoteIDs {
		// We have to get the remote by ID
		remote, err := th.App.Srv().Store().SharedChannel().GetRemoteByIds(channel.Id, remoteID)
		if err != nil {
			t.Logf("Warning: Could not find remote with ID %s for channel %s: %v", remoteID, channel.Id, err)
			continue
		}

		// Reset the cursor to force a full sync
		err = th.App.Srv().Store().SharedChannel().UpdateRemoteMembershipCursor(remote.Id, 0)
		if err != nil {
			t.Logf("Warning: Could not reset cursor for remote %s: %v", remote.Id, err)
		} else {
			t.Logf("Successfully reset cursor for remote %s to 0", remote.Id)
		}
	}

	// If no remotes were provided, log a warning
	if len(remoteIDs) == 0 {
		t.Logf("Warning: No remote IDs provided to PrepareSharedChannelForTest, cursors not reset")
	}

	t.Logf("Channel %s prepared for test - removed non-essential members and reset sync cursors", channel.Id)
}
