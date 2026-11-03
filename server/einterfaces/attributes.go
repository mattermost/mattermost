// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost/server/public/model"
)

// AttributesInterface keeps user and session attributes together, so that
// access control can search users by both in one query. The enterprise
// implementation is an in-process index replicated across the cluster; a
// simpler one may keep a local cache or read the database directly.
//
// It is never a source of record and never decides access: decisions read
// the requesting session and the attribute store as they always have.
type AttributesInterface interface {
	// Start brings the implementation up. Until it returns, every Observe
	// call is a no-op and IsComplete is false.
	Start() error
	// Shutdown stops it and releases what Start acquired.
	Shutdown() error

	// The Observe methods feed session changes in. They are called from the
	// request path and from cluster message handlers, so they must return
	// without waiting on storage or the network. An implementation that
	// cannot keep up may drop an update, and must then report itself
	// incomplete until it has recovered.

	// ObserveSessionAttributes records attributes this node just refreshed
	// for a session it is serving, timestamped updatedAt in milliseconds.
	ObserveSessionAttributes(session *model.Session, attrs map[string]any, updatedAt int64)
	// ObservePeerSessionAttributes records attributes another node refreshed,
	// as carried by ClusterEventUpdateSessionAttributes.
	ObservePeerSessionAttributes(payload model.SessionAttributesClusterPayload)
	// ObserveSessionRevoked records that a session was revoked.
	ObserveSessionRevoked(sessionID string)
	// ObserveAllSessionsRevoked records that every session was revoked.
	ObserveAllSessionsRevoked()
	// ObserveUserSessionsChanged records that a user's sessions changed, as
	// after ClusterEventClearSessionCacheForUser, so they can be checked
	// against the Sessions table.
	ObserveUserSessionsChanged(userID string)

	// IsComplete reports whether this node holds every session attribute it
	// should. While it is false, a search that depends on session attributes
	// must not be answered from this implementation.
	IsComplete() bool
}
