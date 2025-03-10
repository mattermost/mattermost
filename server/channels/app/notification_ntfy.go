// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"fmt"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// sendNtfyPush sends a push notification via the ntfy service
func (a *App) sendNtfyPush(msg *model.PushNotification) error {
	// The ntfy server URL is stored with an "ntfy:" prefix, which we need to remove
	ntfyServerURL := strings.TrimPrefix(*a.Config().EmailSettings.PushNotificationServer, "ntfy:")

	// Make sure the URL doesn't have trailing slashes
	ntfyServerURL = strings.TrimRight(ntfyServerURL, "/")

	// The topic is the device ID
	topic := msg.DeviceId

	// Build the URL for the topic
	url := fmt.Sprintf("%s/%s", ntfyServerURL, topic)

	// For ntfy, we'll use the message as the body of the request
	messageBody := msg.Message
	if messageBody == "" {
		messageBody = "New notification"
	}

	// Create HTTP request with message payload
	req, err := http.NewRequest("POST", url, bytes.NewBufferString(messageBody))
	if err != nil {
		return fmt.Errorf("failed to create ntfy request: %w", err)
	}

	if msg.ChannelName != "" {
		req.Header.Set("Title", msg.ChannelName)
	}

	req.Header.Set("Priority", "high")

	// Add tags for certain notification types
	tags := []string{}

	// Handle different message types
	switch msg.Type {
	case model.PushTypeClear:
		// For clear notifications, add a specific tag
		tags = append(tags, "cancel")

		// Include badge count for clear notifications
		if msg.Badge >= 0 {
			req.Header.Set("Badge", fmt.Sprintf("%d", msg.Badge))
		}

	case model.PushTypeUpdateBadge:
		// Update badge count only
		if msg.Badge >= 0 {
			req.Header.Set("Badge", fmt.Sprintf("%d", msg.Badge))
		}

	case model.PushTypeMessage:
		// Regular notification
		if msg.Badge > 0 {
			req.Header.Set("Badge", fmt.Sprintf("%d", msg.Badge))
		}

		// If we're using categories/tags
		if msg.Category != "" {
			tags = append(tags, msg.Category)
		}
	}

	// Join tags if we have any
	if len(tags) > 0 {
		req.Header.Set("Tags", strings.Join(tags, ","))
	}

	// Add click action if available
	if msg.ChannelId != "" {
		// This will open the app to the specific channel
		req.Header.Set("Click", fmt.Sprintf("mattermost://channels/%s", msg.ChannelId))
	}

	// Add any additional custom data as X- headers
	if msg.Version != "" {
		req.Header.Set("X-Version", msg.Version)
	}

	if msg.IsCRTEnabled {
		req.Header.Set("X-CRT-Enabled", "true")
	}

	a.NotificationsLog().Debug("Sending ntfy push notification",
		mlog.String("type", model.NotificationTypePush),
		mlog.String("device_id", msg.DeviceId),
		mlog.String("push_type", msg.Type),
	)

	// Send the request
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send ntfy notification: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("ntfy returned error status: %d", resp.StatusCode)
	}

	a.NotificationsLog().Debug("Sent ntfy push notification successfully",
		mlog.String("type", model.NotificationTypePush),
		mlog.String("device_id", msg.DeviceId),
		mlog.String("push_type", msg.Type),
	)

	return nil
}
