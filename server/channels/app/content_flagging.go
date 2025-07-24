// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"net/http"
)

// TODO: move these to model package
const (
	contentFLaggingStatusPending  = "pending"
	contentFLaggingStatusAssigned = "assigned"
	contentFLaggingStatusRemoved  = "removed"
	contentFLaggingStatusRetained = "retained"
)

var contentFlaggingGroupId string

func ContentFlaggingEnabledForTeam(config *model.Config, teamId string) bool {
	reviewerSettings := config.ContentFlaggingSettings.ReviewerSettings

	hasCommonReviewers := *reviewerSettings.CommonReviewers
	if hasCommonReviewers {
		return true
	}

	teamSettings, exist := (*reviewerSettings.TeamReviewersSetting)[teamId]
	if !exist || (teamSettings.Enabled != nil && !*teamSettings.Enabled) {
		return false
	}

	if teamSettings.ReviewerIds != nil && len(*teamSettings.ReviewerIds) > 0 {
		return true
	}

	hasAdditionalReviewers := (reviewerSettings.TeamAdminsAsReviewers != nil && *reviewerSettings.TeamAdminsAsReviewers) ||
		(reviewerSettings.SystemAdminsAsReviewers != nil && *reviewerSettings.SystemAdminsAsReviewers)

	return hasAdditionalReviewers
}

func (a *App) ContentFlaggingGroupId() (string, *model.AppError) {
	if contentFlaggingGroupId != "" {
		return contentFlaggingGroupId, nil
	}

	// TODO: use model.ContentFlaggingGroupName once the PR https://github.com/mattermost/mattermost/pull/33395/files is merged
	group, err := a.Srv().propertyService.GetPropertyGroup("content_flagging")
	if err != nil {
		return "", model.NewAppError("getContentFlaggingGroupId", "app.content_flagging.get_group.error", nil, err.Error(), http.StatusInternalServerError)
	}
	contentFlaggingGroupId = group.ID
	return contentFlaggingGroupId, nil
}

func (a *App) FlagPost(postId, flaggingUserId string, flagData model.FlagContentRequest) *model.AppError {
	if appErr := a.CanFlagPost(postId); appErr != nil {
		return appErr
	}

	return nil
}

func (a *App) GetPostContentFlaggingProperties(postId string) ([]*model.PropertyValue, *model.AppError) {
	groupID, appErr := a.ContentFlaggingGroupId()
	if appErr != nil {
		return nil, appErr
	}

	propertyValues, err := a.Srv().propertyService.SearchPropertyValues(groupID, postId, model.PropertyValueSearchOpts{PerPage: 100})
	if err != nil {
		return nil, model.NewAppError("GetPostContentFlaggingProperties", "app.content_flagging.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return propertyValues, nil
}

func (a *App) CanFlagPost(postId string) *model.AppError {
	postPropertyValues, appErr := a.GetPostContentFlaggingProperties(postId)
	if appErr != nil {
		return appErr
	}

	if len(postPropertyValues) == 0 {
		// If no properties exist for the post, we can flag it
		return nil
	}

	// Analyze the value of status property
	groupID, appErr := a.ContentFlaggingGroupId()
	if appErr != nil {
		return appErr
	}

	// TODO: replace "status" string with model.contentFlaggingPropertyNameStatus
	statusPropertyField, err := a.Srv().propertyService.GetPropertyFieldByName(groupID, "", "status")
	if err != nil {
		return model.NewAppError("CanFlagPost", "app.content_flagging.get_property_field_by_name.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	var statusValue *model.PropertyValue
	for _, propertyValue := range postPropertyValues {
		if propertyValue.FieldID == statusPropertyField.ID {
			statusValue = propertyValue
			break
		}
	}

	if statusValue == nil {
		// If no status property exists, we can flag the post
		return nil
	}

	var reason string

	switch string(statusValue.Value) {
	case contentFLaggingStatusPending, contentFLaggingStatusAssigned:
		reason = "app.content_flagging.can_flag_post.in_progress"
	case contentFLaggingStatusRetained:
		reason = "app.content_flagging.can_flag_post.retained"
	case contentFLaggingStatusRemoved:
		reason = "app.content_flagging.can_flag_post.removed"
	default:
		reason = "app.content_flagging.can_flag_post.unknown"
	}

	return model.NewAppError("CanFlagPost", reason, nil, "", http.StatusBadRequest)
}
