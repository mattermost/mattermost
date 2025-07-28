// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"net/http"
	"strings"
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

func (a *App) contentFlaggingGroupId() (string, *model.AppError) {
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

func (a *App) FlagPost(c request.CTX, post *model.Post, reportingUserId string, flagData model.FlagContentRequest) *model.AppError {
	groupId, appErr := a.contentFlaggingGroupId()
	if appErr != nil {
		return appErr
	}

	if appErr := a.canFlagPost(groupId, post.Id); appErr != nil {
		return appErr
	}

	mappedFields, appErr := a.getContentFlaggingMappedFields(groupId)
	if appErr != nil {
		return appErr
	}

	channel, appErr := a.GetChannel(c, post.ChannelId)
	if appErr != nil {
		return appErr
	}

	contentReviewPost, appErr := a.createContentReviewPost(c, channel.TeamId)
	if appErr != nil {
		return appErr
	}

	// TODO: use constant for target type and field names
	// TODO: these need to be on the review post, not the flagged post
	propertyValues := []*model.PropertyValue{
		{
			TargetID:   contentReviewPost.Id,
			TargetType: "post",
			GroupID:    groupId,
			FieldID:    mappedFields["status"].ID,
			Value:      json.RawMessage(`"` + contentFLaggingStatusPending + `"`),
		},
		{
			TargetID:   contentReviewPost.Id,
			TargetType: "post",
			GroupID:    groupId,
			FieldID:    mappedFields["reporting_user_id"].ID,
			Value:      json.RawMessage(fmt.Sprintf(`"%s"`, reportingUserId)),
		},
		{
			TargetID:   contentReviewPost.Id,
			TargetType: "post",
			GroupID:    groupId,
			FieldID:    mappedFields["reporting_reason"].ID,
			Value:      json.RawMessage(fmt.Sprintf(`"%s"`, strings.Trim(flagData.Reason, `"`))),
		},
		{
			TargetID:   contentReviewPost.Id,
			TargetType: "post",
			GroupID:    groupId,
			FieldID:    mappedFields["reporting_comment"].ID,
			Value:      json.RawMessage(fmt.Sprintf(`"%s"`, strings.Trim(flagData.Comment, `"`))),
		},
		{
			TargetID:   contentReviewPost.Id,
			TargetType: "post",
			GroupID:    groupId,
			FieldID:    mappedFields["reporting_time"].ID,
			Value:      json.RawMessage(fmt.Sprintf("%d", model.GetMillis())),
		},
	}

	_, err := a.Srv().propertyService.CreatePropertyValues(propertyValues)
	if err != nil {
		return model.NewAppError("FlagPost", "app.content_flagging.create_property_values.app_error", nil, err.Error(), http.StatusInternalServerError).Wrap(err)
	}

	// TODO: hide the flagged post here

	return nil
}

func (a *App) getPostContentFlaggingProperties(groupID, postId string) ([]*model.PropertyValue, *model.AppError) {
	propertyValues, err := a.Srv().propertyService.SearchPropertyValues(groupID, postId, model.PropertyValueSearchOpts{PerPage: 100})
	if err != nil {
		return nil, model.NewAppError("getPostContentFlaggingProperties", "app.content_flagging.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return propertyValues, nil
}

func (a *App) canFlagPost(groupId, postId string) *model.AppError {
	postPropertyValues, appErr := a.getPostContentFlaggingProperties(groupId, postId)
	if appErr != nil {
		return appErr
	}

	if len(postPropertyValues) == 0 {
		// If no properties exist for the post, we can flag it
		return nil
	}

	// Analyze the value of status property
	groupID, appErr := a.contentFlaggingGroupId()
	if appErr != nil {
		return appErr
	}

	// TODO: replace "status" string with model.contentFlaggingPropertyNameStatus
	statusPropertyField, err := a.Srv().propertyService.GetPropertyFieldByName(groupID, "", "status")
	if err != nil {
		return model.NewAppError("canFlagPost", "app.content_flagging.get_property_field_by_name.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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

	return model.NewAppError("canFlagPost", reason, nil, "", http.StatusBadRequest)
}

func (a *App) getContentFlaggingMappedFields(groupId string) (map[string]*model.PropertyField, *model.AppError) {
	fields, err := a.Srv().propertyService.SearchPropertyFields(groupId, "", model.PropertyFieldSearchOpts{PerPage: 100})
	if err != nil {
		return nil, model.NewAppError("getContentFlaggingMappedFields", "app.content_flagging.search_property_fields.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	mappedFields := map[string]*model.PropertyField{}
	for _, field := range fields {
		mappedFields[field.Name] = field
	}

	return mappedFields, nil
}

func (a *App) createContentReviewPost(c request.CTX, teamId string) (*model.Post, *model.AppError) {
	contentFlaggingChannel, appErr := a.ensureTeamContentFlaggingChannel(c, teamId)
	if appErr != nil {
		return nil, appErr
	}

	bot, appErr := a.GetOrCreateSystemOwnedBot(c, "app.system.content_flagging_bot.bot_displayname")
	if appErr != nil {
		return nil, appErr
	}

	post := &model.Post{
		ChannelId: contentFlaggingChannel.Id,
		Message:   "Content Review",
		UserId:    bot.UserId,
	}

	return a.CreatePost(c, post, contentFlaggingChannel, model.CreatePostFlags{})
}

func (a *App) ensureTeamContentFlaggingChannel(c request.CTX, teamId string) (*model.Channel, *model.AppError) {
	// TODO add lock here

	existingChannel, appErr := a.GetChannelByName(c, "system_flagged_content", teamId, false)
	if appErr != nil && appErr.StatusCode != http.StatusNotFound {
		return nil, appErr
	}

	if existingChannel != nil {
		return existingChannel, nil
	}

	// Since there was no existing channel, we create a new one.

	// TODD add channel banner here
	// TODO add default category here
	channel := &model.Channel{
		TeamId:      teamId,
		Type:        model.ChannelTypePrivate,
		DisplayName: "Flagged Content",
		Name:        "system_flagged_content",
	}
	return a.CreateChannel(c, channel, false)
}
