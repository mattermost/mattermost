// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

func postPermissionCheck(c *Context, channelId string) {
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

func postHardenedModeCheck(c *Context, props model.StringInterface) {
	if *c.App.Config().ServiceSettings.ExperimentalEnableHardenedMode {
		if reservedProps := model.ContainsIntegrationsReservedProps(props); len(reservedProps) > 0 && !c.AppContext.Session().IsIntegration() {
			c.SetInvalidParamWithDetails("props", fmt.Sprintf("Cannot use props reserved for integrations. props: %v", reservedProps))
			return
		}
	}
}

func postPriorityCheck(c *Context, priority *model.PostPriority, rootId string) {
	if priority == nil {
		return
	}

	priorityForbiddenErr := model.NewAppError("Api4.createPost", "api.post.post_priority.priority_post_not_allowed_for_user.request_error", nil, "userId="+c.AppContext.Session().UserId, http.StatusForbidden)

	if !c.App.IsPostPriorityEnabled() {
		c.Err = priorityForbiddenErr
		return
	}

	if rootId != "" {
		c.Err = model.NewAppError("Api4.createPost", "api.post.post_priority.priority_post_only_allowed_for_root_post.request_error", nil, "", http.StatusBadRequest)
		return
	}

	if ack := priority.RequestedAck; ack != nil && *ack {
		licenseErr := minimumProfessionalLicense(c)
		if licenseErr != nil {
			c.Err = licenseErr
			return
		}
	}

	if notification := priority.PersistentNotifications; notification != nil && *notification {
		licenseErr := minimumProfessionalLicense(c)
		if licenseErr != nil {
			c.Err = licenseErr
			return
		}
		if !c.App.IsPersistentNotificationsEnabled() {
			c.Err = priorityForbiddenErr
			return
		}

		if *priority.Priority != model.PostPriorityUrgent {
			c.Err = model.NewAppError("Api4.createPost", "api.post.post_priority.urgent_persistent_notification_post.request_error", nil, "", http.StatusBadRequest)
			return
		}

		if !*c.App.Config().ServiceSettings.AllowPersistentNotificationsForGuests {
			user, err := c.App.GetUser(c.AppContext.Session().UserId)
			if err != nil {
				c.Err = err
				return
			}
			if user.IsGuest() {
				c.Err = priorityForbiddenErr
				return
			}
		}
	}
}
