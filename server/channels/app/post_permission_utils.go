// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func PostPriorityCheckWithApp(where string, a *App, userId string, priority *model.PostPriority, rootId string) *model.AppError {
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
		licenseErr := model.MinimumProfessionalProvidedLicense(license)
		if licenseErr != nil {
			return licenseErr
		}
	}

	if notification := priority.PersistentNotifications; notification != nil && *notification {
		licenseErr := model.MinimumProfessionalProvidedLicense(license)
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

func PostHardenedModeCheckWithApp(a *App, isIntegration bool, props model.StringInterface) *model.AppError {
	hardenedModeEnabled := *a.Config().ServiceSettings.ExperimentalEnableHardenedMode
	return postHardenedModeCheck(hardenedModeEnabled, isIntegration, props)
}

func postHardenedModeCheck(hardenedModeEnabled, isIntegration bool, props model.StringInterface) *model.AppError {
	if hardenedModeEnabled {
		if reservedProps := model.ContainsIntegrationsReservedProps(props); len(reservedProps) > 0 && !isIntegration {
			return model.NewAppError("", "api.context.invalid_body_param.app_error", map[string]any{"Name": "props"}, fmt.Sprintf("Cannot use props reserved for integrations. props: %v", reservedProps), http.StatusBadRequest)
		}
	}

	return nil
}

func userCreatePostPermissionCheckWithApp(c request.CTX, a *App, userId, channelId string) *model.AppError {
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
