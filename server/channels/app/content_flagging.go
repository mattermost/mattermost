// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"maps"
	"net/http"
	"slices"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const (
	CONTENT_FLAGGING_MAX_PROPERTY_FIELDS = 100
	CONTENT_FLAGGING_MAX_PROPERTY_VALUES = 100

	FlaggedPostIdPropKey = "reported_post_id"
)

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

func (a *App) FlagPost(c request.CTX, post *model.Post, teamId, reportingUserId string, flagData model.FlagContentRequest) *model.AppError {
	commentRequired := a.Config().ContentFlaggingSettings.AdditionalSettings.ReporterCommentRequired
	validReasons := a.Config().ContentFlaggingSettings.AdditionalSettings.Reasons
	if appErr := flagData.IsValid(*commentRequired, *validReasons); appErr != nil {
		return appErr
	}

	groupId, appErr := a.ContentFlaggingGroupId()
	if appErr != nil {
		return appErr
	}

	reportingUser, appErr := a.GetUser(reportingUserId)
	if appErr != nil {
		return appErr
	}

	appErr = a.canFlagPost(groupId, post.Id, reportingUser.Locale)
	if appErr != nil {
		return appErr
	}

	mappedFields, appErr := a.GetContentFlaggingMappedFields(groupId)
	if appErr != nil {
		return appErr
	}

	propertyValues := []*model.PropertyValue{
		{
			TargetID:   post.Id,
			TargetType: model.PropertyValueTargetTypePost,
			GroupID:    groupId,
			FieldID:    mappedFields[contentFlaggingPropertyNameStatus].ID,
			Value:      json.RawMessage(fmt.Sprintf(`"%s"`, model.ContentFlaggingStatusPending)),
		},
		{
			TargetID:   post.Id,
			TargetType: model.PropertyValueTargetTypePost,
			GroupID:    groupId,
			FieldID:    mappedFields[contentFlaggingPropertyNameReportingUserID].ID,
			Value:      json.RawMessage(fmt.Sprintf(`"%s"`, reportingUserId)),
		},
		{
			TargetID:   post.Id,
			TargetType: model.PropertyValueTargetTypePost,
			GroupID:    groupId,
			FieldID:    mappedFields[contentFlaggingPropertyNameReportingReason].ID,
			Value:      json.RawMessage(fmt.Sprintf(`"%s"`, flagData.Reason)),
		},
		{
			TargetID:   post.Id,
			TargetType: model.PropertyValueTargetTypePost,
			GroupID:    groupId,
			FieldID:    mappedFields[contentFlaggingPropertyNameReportingComment].ID,
			Value:      json.RawMessage(fmt.Sprintf(`"%s"`, strings.Trim(flagData.Comment, "\""))),
		},
		{
			TargetID:   post.Id,
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
		_, appErr = a.DeletePost(c, post.Id, contentReviewBot.UserId)
		if appErr != nil {
			return model.NewAppError("FlagPost", "app.content_flagging.delete_post.app_error", nil, appErr.Error(), http.StatusInternalServerError).Wrap(appErr)
		}
	}

	go func() {
		appErr = a.createContentReviewPost(c, teamId, post.Id)
		if appErr != nil {
			c.Logger().Error("Failed to create content review post", mlog.Err(appErr), mlog.String("team_id", teamId), mlog.String("post_id", post.Id))
		}
	}()

	return a.sendContentFlaggingConfirmationMessage(c, reportingUserId, post.UserId, post.ChannelId)
}

func (a *App) ContentFlaggingGroupId() (string, *model.AppError) {
	group, err := a.Srv().propertyService.GetPropertyGroup(model.ContentFlaggingGroupName)
	if err != nil {
		return "", model.NewAppError("getContentFlaggingGroupId", "app.content_flagging.get_group.error", nil, err.Error(), http.StatusInternalServerError)
	}
	return group.ID, nil
}

func (a *App) canFlagPost(groupId, postId, userLocal string) *model.AppError {
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
	T := i18n.GetUserTranslations(userLocal)

	switch strings.Trim(string(propertyValues[0].Value), `"`) {
	case model.ContentFlaggingStatusPending, model.ContentFlaggingStatusAssigned:
		reason = T("app.content_flagging.can_flag_post.in_progress")
	case model.ContentFlaggingStatusRetained:
		reason = T("app.content_flagging.can_flag_post.retained")
	case model.ContentFlaggingStatusRemoved:
		reason = T("app.content_flagging.can_flag_post.removed")
	default:
		reason = T("app.content_flagging.can_flag_post.unknown")
	}

	return model.NewAppError("canFlagPost", reason, nil, "", http.StatusBadRequest)
}

func (a *App) GetContentFlaggingMappedFields(groupId string) (map[string]*model.PropertyField, *model.AppError) {
	fields, err := a.Srv().propertyService.SearchPropertyFields(groupId, "", model.PropertyFieldSearchOpts{PerPage: CONTENT_FLAGGING_MAX_PROPERTY_FIELDS})
	if err != nil {
		return nil, model.NewAppError("GetContentFlaggingMappedFields", "app.content_flagging.search_property_fields.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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

	for _, channel := range channels {
		post := &model.Post{
			Message:   "TODO - use mobile specific message here - https://mattermost.atlassian.net/browse/MM-65134",
			UserId:    contentReviewBot.UserId,
			Type:      model.ContentFlaggingPostType,
			ChannelId: channel.Id,
		}
		post.AddProp(FlaggedPostIdPropKey, postId)

		_, appErr := a.CreatePost(c, post, channel, model.CreatePostFlags{})
		if appErr != nil {
			c.Logger().Error("Failed to create content review post in one of the channels", mlog.Err(appErr), mlog.String("channel_id", channel.Id), mlog.String("team_id", teamId))
			continue // Don't stop processing other channels if one fails
		}
	}

	return nil
}

func (a *App) getContentReviewChannels(c request.CTX, teamId, contentReviewBotId string) ([]*model.Channel, *model.AppError) {
	reviewersUserIDs, appErr := a.getReviewersForTeam(teamId, true)
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
	return a.GetOrCreateSystemOwnedBot(c, i18n.T("app.system.content_review_bot.bot_displayname"))
}

func (a *App) getReviewersForTeam(teamId string, includeAdditionalReviewers bool) ([]string, *model.AppError) {
	reviewerUserIDMap := map[string]bool{}

	reviewerSettings := a.Config().ContentFlaggingSettings.ReviewerSettings

	if *reviewerSettings.CommonReviewers {
		for _, userID := range *reviewerSettings.CommonReviewerIds {
			reviewerUserIDMap[userID] = true
		}
	} else {
		// If common reviewers are not enabled, we still need to check if the team has specific reviewers
		teamSettings, exist := (*reviewerSettings.TeamReviewersSetting)[teamId]
		if exist && *teamSettings.Enabled && teamSettings.ReviewerIds != nil {
			for _, userID := range *teamSettings.ReviewerIds {
				reviewerUserIDMap[userID] = true
			}
		}
	}

	if includeAdditionalReviewers {
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
			reviewerUserIDMap[user.Id] = true
		}
	}

	reviewerUserIDs := make([]string, len(reviewerUserIDMap))
	i := 0
	for userID := range maps.Keys(reviewerUserIDMap) {
		reviewerUserIDs[i] = userID
		i++
	}

	return reviewerUserIDs, nil
}

func (a *App) sendContentFlaggingConfirmationMessage(c request.CTX, flaggingUserId, flaggedPostAuthorId, channelID string) *model.AppError {
	flaggedPostAuthor, appErr := a.GetUser(flaggedPostAuthorId)
	if appErr != nil {
		return appErr
	}

	T := i18n.GetUserTranslations(flaggedPostAuthor.Locale)
	post := &model.Post{
		Message:   T("app.content_flagging.flag_post_confirmation.message", map[string]any{"username": flaggedPostAuthor.Username}),
		ChannelId: channelID,
	}

	a.SendEphemeralPost(c, flaggingUserId, post)
	return nil
}

func (a *App) IsUserTeamContentReviewer(userId, teamId string) (bool, *model.AppError) {
	// not fetching additional reviewers as if the user exist in common or team
	// specific reviewers, they are definitely a reviewer, and it saves multiple database calls.
	reviewers, appErr := a.getReviewersForTeam(teamId, false)
	if appErr != nil {
		return false, appErr
	}

	if slices.Contains(reviewers, userId) {
		return true, nil
	}

	// if user is not in common or team specific reviewers, we need to check if they are
	// an additional reviewer.
	reviewers, appErr = a.getReviewersForTeam(teamId, true)
	if appErr != nil {
		return false, appErr
	}

	return slices.Contains(reviewers, userId), nil
}

func (a *App) GetPostContentFlaggingPropertyValues(postId string) ([]*model.PropertyValue, *model.AppError) {
	groupId, appErr := a.ContentFlaggingGroupId()
	if appErr != nil {
		return nil, appErr
	}

	propertyValues, err := a.Srv().propertyService.SearchPropertyValues(groupId, postId, model.PropertyValueSearchOpts{PerPage: CONTENT_FLAGGING_MAX_PROPERTY_VALUES})
	if err != nil {
		return nil, model.NewAppError("GetPostContentFlaggingPropertyValues", "app.content_flagging.search_property_values.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return propertyValues, nil
}
