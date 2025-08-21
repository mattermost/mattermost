// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const (
	CONTENT_FLAGGING_MAX_PROPERTY_FIELDS = 100
	CONTENT_FLAGGING_MAX_PROPERTY_VALUES = 100
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

func (a *App) FlagPost(c request.CTX, postId, teamId, reportingUserId string, flagData model.FlagContentRequest) *model.AppError {
	commentRequired := a.Config().ContentFlaggingSettings.AdditionalSettings.ReporterCommentRequired
	validReasons := a.Config().ContentFlaggingSettings.AdditionalSettings.Reasons
	if appErr := flagData.IsValid(*commentRequired, *validReasons); appErr != nil {
		return appErr
	}

	groupId, appErr := a.contentFlaggingGroupId()
	if appErr != nil {
		return appErr
	}

	appErr = a.canFlagPost(groupId, postId)
	if appErr != nil {
		return appErr
	}

	mappedFields, appErr := a.getContentFlaggingMappedFields(groupId)
	if appErr != nil {
		return appErr
	}

	propertyValues := []*model.PropertyValue{
		{
			TargetID:   postId,
			TargetType: model.PropertyValueTargetTypePost,
			GroupID:    groupId,
			FieldID:    mappedFields[contentFlaggingPropertyNameStatus].ID,
			Value:      json.RawMessage(fmt.Sprintf(`"%s"`, model.ContentFlaggingStatusPending)),
		},
		{
			TargetID:   postId,
			TargetType: model.PropertyValueTargetTypePost,
			GroupID:    groupId,
			FieldID:    mappedFields[contentFlaggingPropertyNameReportingUserID].ID,
			Value:      json.RawMessage(fmt.Sprintf(`"%s"`, reportingUserId)),
		},
		{
			TargetID:   postId,
			TargetType: model.PropertyValueTargetTypePost,
			GroupID:    groupId,
			FieldID:    mappedFields[contentFlaggingPropertyNameReportingReason].ID,
			Value:      json.RawMessage(fmt.Sprintf(`"%s"`, flagData.Reason)),
		},
		{
			TargetID:   postId,
			TargetType: model.PropertyValueTargetTypePost,
			GroupID:    groupId,
			FieldID:    mappedFields[contentFlaggingPropertyNameReportingComment].ID,
			Value:      json.RawMessage(fmt.Sprintf(`"%s"`, flagData.Comment)),
		},
		{
			TargetID:   postId,
			TargetType: model.PropertyValueTargetTypePost,
			GroupID:    groupId,
			FieldID:    mappedFields[contentFlaggingPropertyNameReportingTime].ID,
			Value:      json.RawMessage(fmt.Sprintf("%d", model.GetMillis())),
		},
	}

	_, err := a.Srv().propertyService.CreatePropertyValues(propertyValues)
	if err != nil {
		return model.NewAppError("FlagPost", "app.content_flagging.create_property_values.app_error", nil, err.Error(), http.StatusInternalServerError).Wrap(err)
	}

	contentReviewBot, appErr := a.getContentReviewBot(c)
	if appErr != nil {
		return appErr
	}

	if *a.Config().ContentFlaggingSettings.AdditionalSettings.HideFlaggedContent {
		_, appErr = a.DeletePost(c, postId, contentReviewBot.UserId)
		if appErr != nil {
			return model.NewAppError("FlagPost", "app.content_flagging.delete_post.app_error", nil, appErr.Error(), http.StatusInternalServerError).Wrap(appErr)
		}
	}

	appErr = a.createContentReviewPost(c, teamId, postId)
	if appErr != nil {
		return appErr
	}

	return nil
}

func (a *App) contentFlaggingGroupId() (string, *model.AppError) {
	if contentFlaggingGroupId != "" {
		return contentFlaggingGroupId, nil
	}

	group, err := a.Srv().propertyService.GetPropertyGroup(model.ContentFlaggingGroupName)
	if err != nil {
		return "", model.NewAppError("getContentFlaggingGroupId", "app.content_flagging.get_group.error", nil, err.Error(), http.StatusInternalServerError)
	}
	contentFlaggingGroupId = group.ID
	return contentFlaggingGroupId, nil
}

func (a *App) canFlagPost(groupId, postId string) *model.AppError {
	statusPropertyField, err := a.Srv().propertyService.GetPropertyFieldByName(groupId, "", contentFlaggingPropertyNameStatus)
	if err != nil {
		return model.NewAppError("canFlagPost", "app.content_flagging.get_status_property.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	propertyValues, err := a.Srv().propertyService.SearchPropertyValues(groupId, postId, model.PropertyValueSearchOpts{PerPage: CONTENT_FLAGGING_MAX_PROPERTY_VALUES, FieldID: statusPropertyField.ID})
	if err != nil {
		return model.NewAppError("canFlagPost", "app.content_flagging.search_status_property.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if len(propertyValues) == 0 {
		// If no status property exist for the post, we can flag it
		return nil
	}

	var reason string

	switch strings.Trim(string(propertyValues[0].Value), `"`) {
	case model.ContentFlaggingStatusPending, model.ContentFlaggingStatusAssigned:
		reason = "app.content_flagging.can_flag_post.in_progress"
	case model.ContentFlaggingStatusRetained:
		reason = "app.content_flagging.can_flag_post.retained"
	case model.ContentFlaggingStatusRemoved:
		reason = "app.content_flagging.can_flag_post.removed"
	default:
		reason = "app.content_flagging.can_flag_post.unknown"
	}

	return model.NewAppError("canFlagPost", reason, nil, "", http.StatusBadRequest)
}

func (a *App) getContentFlaggingMappedFields(groupId string) (map[string]*model.PropertyField, *model.AppError) {
	fields, err := a.Srv().propertyService.SearchPropertyFields(groupId, "", model.PropertyFieldSearchOpts{PerPage: CONTENT_FLAGGING_MAX_PROPERTY_FIELDS})
	if err != nil {
		return nil, model.NewAppError("getContentFlaggingMappedFields", "app.content_flagging.search_property_fields.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	mappedFields := map[string]*model.PropertyField{}
	for _, field := range fields {
		mappedFields[field.Name] = field
	}

	return mappedFields, nil
}

func (a *App) createContentReviewPost(c request.CTX, teamId, postId string) *model.AppError {
	contentReviewBot, appErr := a.getContentReviewBot(c)
	if appErr != nil {
		return appErr
	}

	channels, appErr := a.getContentReviewChannels(c, teamId, contentReviewBot.UserId)
	if appErr != nil {
		return appErr
	}

	post := &model.Post{
		Message: fmt.Sprintf("A new content review has been created for team %s and post %s. Please check the flagged content.", teamId, postId),
		UserId:  contentReviewBot.UserId,
		Type:    "custom_spillage_report",
	}

	for _, channel := range channels {
		post.ChannelId = channel.Id
		_, appErr := a.CreatePost(c, post, channel, model.CreatePostFlags{})
		if appErr != nil {
			c.Logger().Error("Failed to create content review post in one of the channels", mlog.Err(appErr), mlog.String("channel_id", channel.Id), mlog.String("team_id", teamId))
			continue // Don't stop processing other channels if one fails
		}
	}

	return nil
}

func (a *App) getContentReviewChannels(c request.CTX, teamId, contentReviewBotId string) ([]*model.Channel, *model.AppError) {
	reviewersUserIDs, appErr := a.getReviewersForTeam(teamId)
	if appErr != nil {
		return nil, appErr
	}

	var channels []*model.Channel
	for _, userId := range reviewersUserIDs {
		channel, appErr := a.GetOrCreateDirectChannel(c, userId, contentReviewBotId)
		if appErr != nil {
			// Don't stop processing other reviewers if one fails
			c.Logger().Error("Failed to get or create direct channel for one of the reviewers and content review bot", mlog.Err(appErr), mlog.String("user_id", userId), mlog.String("bot_id", contentReviewBotId))
		}

		channels = append(channels, channel)
	}

	return channels, nil
}

func (a *App) getContentReviewBot(c request.CTX) (*model.Bot, *model.AppError) {
	return a.GetOrCreateSystemOwnedBot(c, "app.system.content_review_bot.bot_displayname")
}

func (a *App) getReviewersForTeam(teamId string) ([]string, *model.AppError) {
	var reviewerUserIDs []string

	reviewerSettings := a.Config().ContentFlaggingSettings.ReviewerSettings

	if *reviewerSettings.CommonReviewers {
		reviewerUserIDs = append(reviewerUserIDs, *reviewerSettings.CommonReviewerIds...)
	} else {
		// If common reviewers are not enabled, we still need to check if the team has specific reviewers
		teamSettings, exist := (*reviewerSettings.TeamReviewersSetting)[teamId]
		if exist && teamSettings.ReviewerIds != nil {
			reviewerUserIDs = append(reviewerUserIDs, *teamSettings.ReviewerIds...)
		}
	}

	var additionalReviewers []*model.User
	// Additional reviewers
	if *reviewerSettings.TeamAdminsAsReviewers {
		options := &model.UserGetOptions{
			InTeamId:  teamId,
			Page:      0,
			PerPage:   100,
			Active:    true,
			TeamRoles: []string{model.TeamAdminRoleId},
		}

		for {
			page, appErr := a.GetUsersInTeam(options)
			if appErr != nil {
				return nil, model.NewAppError("getReviewersForTeam", "app.content_flagging.get_users_in_team.app_error", nil, appErr.Error(), http.StatusInternalServerError).Wrap(appErr)
			}

			additionalReviewers = append(additionalReviewers, page...)
			if len(page) < options.PerPage {
				break
			}
			options.Page++
		}
	}

	if *reviewerSettings.SystemAdminsAsReviewers {
		options := &model.UserGetOptions{
			InTeamId: teamId,
			Page:     0,
			PerPage:  100,
			Active:   true,
			Roles:    []string{model.SystemAdminRoleId},
		}

		for {
			page, appErr := a.GetUsersInTeam(options)
			if appErr != nil {
				return nil, model.NewAppError("getReviewersForTeam", "app.content_flagging.get_users_in_team.app_error", nil, appErr.Error(), http.StatusInternalServerError).Wrap(appErr)
			}

			additionalReviewers = append(additionalReviewers, page...)
			if len(page) < options.PerPage {
				break
			}
			options.Page++
		}
	}

	for _, user := range additionalReviewers {
		reviewerUserIDs = append(reviewerUserIDs, user.Id)
	}

	return reviewerUserIDs, nil
}
