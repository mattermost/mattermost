// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost/server/public/model"
)

// AttributesInterface keeps the attributes of entities, such as users and
// channels, together with the attributes of sessions, so that access control
// can search entities by both in one query. The enterprise implementation is
// an in-process index replicated across the cluster; a simpler one may keep a
// local cache or read the database directly.
//
// It is never a source of record and never decides access: decisions read
// the requesting session and the attribute store as they always have.
//
// Object types are the property field object types, such as
// model.PropertyFieldObjectTypeUser and model.PropertyFieldObjectTypeChannel.
// model.PropertyFieldObjectTypeSession stands for session attributes, which
// belong to users.
type AttributesInterface interface {
	// Start brings the implementation up. Until it returns, every Observe
	// call is a no-op and IsComplete is false.
	Start() error
	// Shutdown stops it and releases what Start acquired.
	Shutdown() error

	// The Observe methods feed changes in. They are called from the request
	// path, from store write hooks and from cluster message handlers, so they
	// must return without waiting on storage or the network. An
	// implementation that cannot keep up may drop an update, and must then
	// report itself incomplete until it has recovered.

	// ObserveAttributesChanged records that the attributes or built-in fields
	// of these entities may have changed, for example after a property value
	// write, so they are reloaded from the database sooner. An implementation
	// also follows changes on its own, so a missed call only delays one.
	ObserveAttributesChanged(objectType string, targetIDs []string)
	// ObserveAllAttributesChanged records a change that can alter every
	// entity of objectType without touching its rows, such as renaming a
	// property field or option.
	ObserveAllAttributesChanged(objectType string)

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

	// IsComplete reports whether this node holds everything it should for
	// objectType, within its staleness bound. While it is false, a search
	// over objectType must not be answered from this implementation.
	IsComplete(objectType string) bool
}
