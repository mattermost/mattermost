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
		if !model.MinimumProfessionalLicense(license) {
			return model.NewAppError("", "license_error.feature_unavailable", nil, "feature is not available for the current license", http.StatusNotImplemented)
		}
	}

	if notification := priority.PersistentNotifications; notification != nil && *notification {
		if !model.MinimumProfessionalLicense(license) {
			return model.NewAppError("", "license_error.feature_unavailable", nil, "feature is not available for the current license", http.StatusNotImplemented)
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

func userCreatePostPermissionCheckWithApp(rctx request.CTX, a *App, userId, channelId string) *model.AppError {
	hasPermission := false
	if ok, _ := a.HasPermissionToChannel(rctx, userId, channelId, model.PermissionCreatePost); ok {
		hasPermission = true
	} else if channel, err := a.GetChannel(rctx, channelId); err == nil {
		// Temporary permission check method until advanced permissions, please do not copy
		if channel.Type == model.ChannelTypeOpen && a.HasPermissionToTeam(rctx, userId, channel.TeamId, model.PermissionCreatePostPublic) {
			hasPermission = true
		}
	}

	if !hasPermission {
		return model.MakePermissionErrorForUser(userId, []*model.Permission{model.PermissionCreatePost})
	}

	return nil
}

// PostBurnOnReadCheckWithApp validates whether a burn-on-read post can be created
// based on channel type and participants. This is called from the API layer before
// post creation to enforce burn-on-read restrictions.
func PostBurnOnReadCheckWithApp(where string, a *App, rctx request.CTX, userId, channelId, postType string, channel *model.Channel) *model.AppError {
	// Only validate if this is a burn-on-read post
	if postType != model.PostTypeBurnOnRead {
		return nil
	}

	// Get channel if not provided
	if channel == nil {
		ch, err := a.GetChannel(rctx, channelId)
		if err != nil {
			return model.NewAppError(where, "api.post.fill_in_post_props.burn_on_read.channel.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		channel = ch
	}

	// Burn-on-read is not allowed in self-DMs or DMs with bots (including AI agents, plugins)
	if channel.Type == model.ChannelTypeDirect {
		// Check if it's a self-DM by comparing the channel name with the expected self-DM name
		selfDMName := model.GetDMNameFromIds(userId, userId)
		if channel.Name == selfDMName {
			return model.NewAppError(where, "api.post.fill_in_post_props.burn_on_read.self_dm.app_error", nil, "", http.StatusBadRequest)
		}

		// Check if the DM is with a bot (AI agents, plugins, etc.)
		otherUserId := channel.GetOtherUserIdForDM(userId)
		if otherUserId != "" && otherUserId != userId {
			otherUser, err := a.GetUser(otherUserId)
			if err != nil {
				// Data integrity issue: can't validate the other user (e.g., deleted user, DB error)
				// Block the burn-on-read post as we can't ensure it's valid
				return model.NewAppError(where, "api.post.fill_in_post_props.burn_on_read.user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			if otherUser.IsBot {
				return model.NewAppError(where, "api.post.fill_in_post_props.burn_on_read.bot_dm.app_error", nil, "", http.StatusBadRequest)
			}
		}
	}

	return nil
}
