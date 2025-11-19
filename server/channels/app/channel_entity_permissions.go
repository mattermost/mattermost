// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
)

// getEntityPermissionByChannelType is a helper function that looks up permissions based on channel type.
// It takes a nested map of channel types to operation-specific permissions and returns the appropriate permission.
func getEntityPermissionByChannelType[K comparable](
	channelType model.ChannelType,
	operation K,
	permissionMap map[model.ChannelType]map[K]*model.Permission,
) *model.Permission {
	if operationPerms, ok := permissionMap[channelType]; ok {
		return operationPerms[operation]
	}
	return nil
}
