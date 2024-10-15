// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"fmt"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/web"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
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

func userCreatePostPermissionCheckWithApp(c request.CTX, a app.AppIface, userId, channelId string) *model.AppError {
	hasPermission := false
	if a.HasPermissionToChannel(c, userId, channelId, model.PermissionCreatePost) {
		hasPermission = true
	} else if channel, err := a.GetChannel(c, channelId); err == nil {
		// Temporary permission check method until advanced permissions, please do not copy
		if channel.Type == model.ChannelTypeOpen && a.HasPermissionToTeam(c, userId, channel.TeamId, model.PermissionCreatePostPublic) {
			hasPermission = true
		}
	}

	if !hasPermission {
		return model.MakePermissionErrorForUser(userId, []*model.Permission{model.PermissionCreatePost})
	}

	return nil
}

func postHardenedModeCheckWithContext(c *Context, props model.StringInterface) {
	isIntegration := c.AppContext.Session().IsIntegration()

	if appErr := postHardenedModeCheckWithApp(c.App, isIntegration, props); appErr != nil {
		c.Err = appErr
	}
}

func postHardenedModeCheckWithApp(a app.AppIface, isIntegration bool, props model.StringInterface) *model.AppError {
	hardenedModeEnabled := *a.Config().ServiceSettings.ExperimentalEnableHardenedMode
	return postHardenedModeCheck(hardenedModeEnabled, isIntegration, props)
}

func postHardenedModeCheck(hardenedModeEnabled, isIntegration bool, props model.StringInterface) *model.AppError {
	if hardenedModeEnabled {
		if reservedProps := model.ContainsIntegrationsReservedProps(props); len(reservedProps) > 0 && !isIntegration {
			return web.NewInvalidParamDetailedError("props", fmt.Sprintf("Cannot use props reserved for integrations. props: %v", reservedProps))
		}
	}

	return nil
}

func postPriorityCheckWithContext(where string, c *Context, priority *model.PostPriority, rootId string) {
	appErr := postPriorityCheckWithApp(where, c.App, c.AppContext.Session().UserId, priority, rootId)
	if appErr != nil {
		appErr.Where = where
		c.Err = appErr
	}
}

func postPriorityCheckWithApp(where string, a app.AppIface, userId string, priority *model.PostPriority, rootId string) *model.AppError {
	user, appErr := a.GetUser(userId)
	if appErr != nil {
		return appErr
	}

	isPostPriorityEnabled := a.IsPostPriorityEnabled()
	IsPersistentNotificationsEnabled := a.IsPersistentNotificationsEnabled()
	allowPersistentNotificationsForGuests := *a.Config().ServiceSettings.AllowPersistentNotificationsForGuests
	license := a.License()

	appErr = postPriorityCheck(user, priority, rootId, isPostPriorityEnabled, IsPersistentNotificationsEnabled, allowPersistentNotificationsForGuests, license)
	if appErr != nil {
		appErr.Where = where
		return appErr
	}

	return nil
}

func postPriorityCheck(
	user *model.User,
	priority *model.PostPriority,
	rootId string,
	isPostPriorityEnabled,
	isPersistentNotificationsEnabled,
	allowPersistentNotificationsForGuests bool,
	license *model.License,
) *model.AppError {
	if priority == nil {
		return nil
	}

	priorityForbiddenErr := model.NewAppError("", "api.post.post_priority.priority_post_not_allowed_for_user.request_error", nil, "userId="+user.Id, http.StatusForbidden)

	if !isPostPriorityEnabled {
		return priorityForbiddenErr
	}

	if rootId != "" {
		return model.NewAppError("", "api.post.post_priority.priority_post_only_allowed_for_root_post.request_error", nil, "", http.StatusBadRequest)
	}

	if ack := priority.RequestedAck; ack != nil && *ack {
		licenseErr := minimumProfessionalProvidedLicense(license)
		if licenseErr != nil {
			return licenseErr
		}
	}

	if notification := priority.PersistentNotifications; notification != nil && *notification {
		licenseErr := minimumProfessionalProvidedLicense(license)
		if licenseErr != nil {
			return licenseErr
		}
		if !isPersistentNotificationsEnabled {
			return priorityForbiddenErr
		}

		if *priority.Priority != model.PostPriorityUrgent {
			return model.NewAppError("", "api.post.post_priority.urgent_persistent_notification_post.request_error", nil, "", http.StatusBadRequest)
		}

		if !allowPersistentNotificationsForGuests {
			if user.IsGuest() {
				return priorityForbiddenErr
			}
		}
	}

	return nil
}
