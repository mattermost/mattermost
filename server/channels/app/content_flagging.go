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

	POST_PROP_KEY_FLAGGED_POST_ID = "reported_post_id"
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

func (a *App) GetPostContentFlaggingStatusValue(postId string) (*model.PropertyValue, *model.AppError) {
	groupId, appErr := a.ContentFlaggingGroupId()
	if appErr != nil {
		return nil, appErr
	}

	statusPropertyField, err := a.Srv().propertyService.GetPropertyFieldByName(groupId, "", contentFlaggingPropertyNameStatus)
	if err != nil {
		return nil, model.NewAppError("GetPostContentFlaggingStatusValue", "app.content_flagging.get_status_property.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	propertyValues, err := a.Srv().propertyService.SearchPropertyValues(groupId, postId, model.PropertyValueSearchOpts{PerPage: CONTENT_FLAGGING_MAX_PROPERTY_VALUES, FieldID: statusPropertyField.ID})
	if err != nil {
		return nil, model.NewAppError("GetPostContentFlaggingStatusValue", "app.content_flagging.search_status_property.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if len(propertyValues) == 0 {
		return nil, nil
	}

	return propertyValues[0], nil
}

func (a *App) canFlagPost(groupId, postId, userLocal string) *model.AppError {
	status, appErr := a.GetPostContentFlaggingStatusValue(postId)
	if appErr != nil {
		return appErr
	}

	if status == nil {
		return nil
	}

	var reason string
	T := i18n.GetUserTranslations(userLocal)

	switch strings.Trim(string(status.Value), `"`) {
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
		post.AddProp(POST_PROP_KEY_FLAGGED_POST_ID, postId)

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
		if *reviewerSettings.TeamAdminsAsReviewers {
			teamAdminReviewers, appErr := a.getAllUsersInTeamForRoles(teamId, nil, []string{model.TeamAdminRoleId})
			if appErr != nil {
				return nil, appErr
			}
			additionalReviewers = append(additionalReviewers, teamAdminReviewers...)
		}

		if *reviewerSettings.SystemAdminsAsReviewers {
			sysAdminReviewers, appErr := a.getAllUsersInTeamForRoles(teamId, []string{model.SystemAdminRoleId}, nil)
			if appErr != nil {
				return nil, appErr
			}
			additionalReviewers = append(additionalReviewers, sysAdminReviewers...)
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

func (a *App) getAllUsersInTeamForRoles(teamId string, systemRoles, teamRoles []string) ([]*model.User, *model.AppError) {
	var additionalReviewers []*model.User

	options := &model.UserGetOptions{
		InTeamId:  teamId,
		Page:      0,
		PerPage:   100,
		Active:    true,
		Roles:     systemRoles,
		TeamRoles: teamRoles,
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

	return additionalReviewers, nil
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
	// not fetching additional reviewers because if the user exist in common or team
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

func (a *App) PermanentDeleteFlaggedPost(c request.CTX, reviewerId string, post *model.Post) *model.AppError {
	// when a flagged post is removed, the following things need to be done
	// 1. Hard delete corresponding file infos
	// 2. Hard delete file infos associated to post's edit history
	// 3. Hard delete post's edit history
	// 4. Hard delete the files from file storage
	// 5. Hard delete post's priority data
	// 6. Hard delete post's postacknowledgements
	// 7. Hard delete postreminders
	// 8. Scrub the post's content - message, props

	editHistories, appErr := a.GetEditHistoryForPost(post.Id)
	if appErr != nil {
		editHistories = []*model.Post{}

		if appErr.StatusCode != http.StatusNotFound {
			c.Logger().Error("PermanentlyRemoveFlaggedPost: Failed to get edit history for post", mlog.Err(appErr), mlog.String("post_id", post.Id))
		}
	}

	for _, editHistory := range editHistories {
		if filesDeleteAppErr := a.PermanentDeleteFilesByPost(c, editHistory.Id); filesDeleteAppErr != nil {
			c.Logger().Error("PermanentlyRemoveFlaggedPost: Failed to permanently delete files for one of the edit history posts", mlog.Err(filesDeleteAppErr), mlog.String("post_id", editHistory.Id))
		}

		if deletePostAppErr := a.PermanentDeletePost(c, editHistory.Id, reviewerId); deletePostAppErr != nil {
			c.Logger().Error("PermanentlyRemoveFlaggedPost: Failed to permanently delete one of the edit history posts", mlog.Err(deletePostAppErr), mlog.String("post_id", editHistory.Id))
		}
	}

	if filesDeleteAppErr := a.PermanentDeleteFilesByPost(c, post.Id); filesDeleteAppErr != nil {
		c.Logger().Error("PermanentlyRemoveFlaggedPost: Failed to permanently delete files for the post", mlog.Err(filesDeleteAppErr), mlog.String("post_id", post.Id))
	}

	if err := a.DeletePriorityForPost(post.Id); err != nil {
		c.Logger().Error("PermanentlyRemoveFlaggedPost: Failed to delete post priority for the post", mlog.Err(err), mlog.String("post_id", post.Id))
	}

	if err := a.Srv().Store().PostAcknowledgement().DeleteAllForPost(post.Id); err != nil {
		c.Logger().Error("PermanentlyRemoveFlaggedPost: Failed to delete post acknowledgements for the post", mlog.Err(err), mlog.String("post_id", post.Id))
	}

	if err := a.Srv().Store().Post().DeleteAllPostRemindersForPost(post.Id); err != nil {
		c.Logger().Error("PermanentlyRemoveFlaggedPost: Failed to delete post reminders for the post", mlog.Err(err), mlog.String("post_id", post.Id))
	}

	scrubPost(post)
	_, _, err := a.Srv().Store().Post().OverwriteMultiple(c, []*model.Post{post})
	if err != nil {
		return model.NewAppError("PermanentlyRemoveFlaggedPost", "app.content_flagging.update_post.app_error", nil, appErr.Error(), http.StatusInternalServerError).Wrap(appErr)
	}

	return nil
}

func scrubPost(post *model.Post) {
	post.Message = "*Content deleted as part of Content Flagging review process*"
	post.MessageSource = post.Message
	post.Hashtags = ""
	post.Metadata = nil
	post.FileIds = []string{}
	post.SetProps(make(map[string]any))
}
