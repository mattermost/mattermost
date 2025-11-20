// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

func userCreatePostPermissionCheckWithContext(c *Context, channelId string) {
	hasPermission := false
	if c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channelId, model.PermissionCreatePost) {
		hasPermission = true
	} else if channel, err := c.App.GetChannel(c.AppContext, channelId); err == nil {
		// Temporary permission check method until advanced permissions, please do not copy
		if channel.Type == model.ChannelTypeOpen && c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionCreatePostPublic) {
			hasPermission = true
		}
	}

	if !hasPermission {
		c.SetPermissionError(model.PermissionCreatePost)
		return
	}
}

func postHardenedModeCheckWithContext(where string, c *Context, props model.StringInterface) {
	isIntegration := c.AppContext.Session().IsIntegration()

	if appErr := app.PostHardenedModeCheckWithApp(c.App, isIntegration, props); appErr != nil {
		appErr.Where = where
		c.Err = appErr
	}
}

func postPriorityCheckWithContext(where string, c *Context, priority *model.PostPriority, rootId string) {
	appErr := app.PostPriorityCheckWithApp(where, c.App, c.AppContext.Session().UserId, priority, rootId)
	if appErr != nil {
		appErr.Where = where
		c.Err = appErr
	}
}

// checkUploadFilePermissionForNewFiles checks if the user has upload_file permission
// when adding new files to a post. It only checks permission if there are new files
// being added (not just keeping existing ones). This prevents users from bypassing
// channel-level permissions by uploading files in one team/channel and attaching
// them to posts in another where they lack permission.
func checkUploadFilePermissionForNewFiles(c *Context, newFileIds []string, originalPost *model.Post) {
	if len(newFileIds) == 0 {
		return
	}

	originalFileIDsMap := make(map[string]bool, len(originalPost.FileIds))
	for _, fileID := range originalPost.FileIds {
		originalFileIDsMap[fileID] = true
	}

	hasNewFiles := false
	for _, fileID := range newFileIds {
		if !originalFileIDsMap[fileID] {
			hasNewFiles = true
			break
		}
	}

	if hasNewFiles {
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), originalPost.ChannelId, model.PermissionUploadFile) {
			c.SetPermissionError(model.PermissionUploadFile)
			return
		}
	}
}
