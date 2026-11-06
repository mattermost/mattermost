// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestAccessDecisionBroadcasterBatches(t *testing.T) {
	sent := make(chan *accessDecisionInvalidation, 10)
	b := newAccessDecisionBroadcaster(func(inv *accessDecisionInvalidation) { sent <- inv })
	b.delay = 20 * time.Millisecond
	b.maxIDs = 4

	userID, sessionID, channelID := model.NewId(), model.NewId(), model.NewId()
	b.enqueue(&accessDecisionInvalidation{Users: []string{userID}})
	b.enqueue(&accessDecisionInvalidation{Users: []string{userID}, Sessions: []string{sessionID}})
	b.enqueue(&accessDecisionInvalidation{UserResources: [][2]string{{userID, channelID}}})

	select {
	case inv := <-sent:
		assert.False(t, inv.Global)
		assert.Equal(t, []string{userID}, inv.Users, "duplicates are coalesced")
		assert.Equal(t, []string{sessionID}, inv.Sessions)
		assert.Equal(t, [][2]string{{userID, channelID}}, inv.UserResources)
	case <-time.After(time.Second):
		t.Fatal("batch was not flushed after the delay")
	}

	// Reaching maxIDs flushes immediately.
	b.delay = time.Hour
	b.enqueue(&accessDecisionInvalidation{Resources: []string{model.NewId(), model.NewId(), model.NewId(), model.NewId()}})
	select {
	case inv := <-sent:
		assert.Len(t, inv.Resources, 4)
	default:
		t.Fatal("a full batch must be sent without waiting")
	}

	// A global invalidation supersedes the IDs queued with it.
	b.enqueue(&accessDecisionInvalidation{Users: []string{userID}})
	b.enqueue(&accessDecisionInvalidation{Global: true})
	b.flush()
	inv := <-sent
	assert.True(t, inv.Global)
	assert.Empty(t, inv.Users)

	b.flush()
	select {
	case <-sent:
		t.Fatal("nothing pending, nothing sent")
	default:
	}
}
