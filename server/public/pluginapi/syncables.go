package pluginapi

import (
	"github.com/mattermost/mattermost/server/public/model"
)

// SyncRolesAndMembership updates the SchemeAdmin status and membership of all of the members of the given
// syncable.
//
// @tag Group
// Minimum server version: 9.5
func (c *Client) SyncRolesAndMembership(syncableID string, syncableType model.GroupSyncableType, includeRemovedMembers bool, since int64) {
	c.api.SyncRolesAndMembership(syncableID, syncableType, includeRemovedMembers, since)
}
