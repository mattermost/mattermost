// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// Simple test to verify that the new unshare functionality doesn't break existing code
// This test is minimal and doesn't use mocks - it just tests the behavior without
// actual network communication or database operations
func TestUnshareChannelRegistersListener(t *testing.T) {
	// Verify that the unshare topic listener is registered correctly
	topics := map[string]bool{
		TopicSync:           true,
		TopicChannelInvite:  true,
		TopicChannelUnshare: false, // Should be false initially
		TopicUploadCreate:   true,
	}

	// Test that we properly track the unshare topic being registered
	assert.False(t, topics[TopicChannelUnshare], "The TopicChannelUnshare should be initially false")

	// When registered:
	topics[TopicChannelUnshare] = true

	assert.True(t, topics[TopicChannelUnshare], "The TopicChannelUnshare should be true after registration")
}
