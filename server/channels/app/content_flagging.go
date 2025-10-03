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
	"github.com/mattermost/mattermost/server/public/utils"
	"github.com/pkg/errors"
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

func (a *App) FlagPost(rctx request.CTX, post *model.Post, teamId, reportingUserId string, flagData model.FlagContentRequest) *model.AppError {
	commentBytes, err := json.Marshal(flagData.Comment)
	if err != nil {
		return model.NewAppError("FlagPost", "app.content_flagging.flag_post.marshal_comment.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	// Storing marshalled content into RawMessage to ensure proper escaping of special characters and prevent
	// generating unsafe JSON values
	commentJsonValue := json.RawMessage(commentBytes)

	reasonJson, err := json.Marshal(flagData.Reason)
	if err != nil {
		return model.NewAppError("FlagPost", "app.content_flagging.flag_post.marshal_reason.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	// Storing marshalled content into RawMessage to ensure proper escaping of special characters and prevent
	// generating unsafe JSON values
	reasonJsonValue := json.RawMessage(reasonJson)

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
			Value:      reasonJsonValue,
		},
		{
			TargetID:   post.Id,
			TargetType: model.PropertyValueTargetTypePost,
			GroupID:    groupId,
			FieldID:    mappedFields[contentFlaggingPropertyNameReportingComment].ID,
			Value:      commentJsonValue,
		},
		{
			TargetID:   post.Id,
			TargetType: model.PropertyValueTargetTypePost,
			GroupID:    groupId,
			FieldID:    mappedFields[contentFlaggingPropertyNameReportingTime].ID,
			Value:      json.RawMessage(fmt.Sprintf("%d", model.GetMillis())),
		},
	}

	_, err = a.Srv().propertyService.CreatePropertyValues(propertyValues)
	if err != nil {
		return model.NewAppError("FlagPostForContentReview", "app.content_flagging.create_property_values.app_error", nil, err.Error(), http.StatusInternalServerError).Wrap(err)
	}

	contentReviewBot, appErr := a.getContentReviewBot(rctx)
	if appErr != nil {
		return appErr
	}

	if *a.Config().ContentFlaggingSettings.AdditionalSettings.HideFlaggedContent {
		_, appErr = a.DeletePost(rctx, post.Id, contentReviewBot.UserId)
		if appErr != nil {
			return model.NewAppError("FlagPostForContentReview", "app.content_flagging.delete_post.app_error", nil, appErr.Error(), http.StatusInternalServerError).Wrap(appErr)
		}
	}

	a.Srv().Go(func() {
		appErr = a.createContentReviewPost(rctx, post.Id, teamId, reportingUserId, flagData.Reason, post.ChannelId, post.UserId)
		if appErr != nil {
			rctx.Logger().Error("Failed to create content review post", mlog.Err(appErr), mlog.String("team_id", teamId), mlog.String("post_id", post.Id))
		}
	})

	return a.sendContentFlaggingConfirmationMessage(rctx, reportingUserId, post.UserId, post.ChannelId)
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

	searchOptions := model.PropertyValueSearchOpts{TargetIDs: []string{postId}, PerPage: CONTENT_FLAGGING_MAX_PROPERTY_VALUES, FieldID: statusPropertyField.ID}
	propertyValues, err := a.Srv().propertyService.SearchPropertyValues(groupId, searchOptions)
	if err != nil {
		return nil, model.NewAppError("GetPostContentFlaggingStatusValue", "app.content_flagging.search_status_property.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if len(propertyValues) == 0 {
		return nil, model.NewAppError("GetPostContentFlaggingStatusValue", "app.content_flagging.no_status_property.app_error", nil, "", http.StatusNotFound)
	}

	return propertyValues[0], nil
}

func (a *App) canFlagPost(groupId, postId, userLocal string) *model.AppError {
	status, appErr := a.GetPostContentFlaggingStatusValue(postId)
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			return nil
		}
		return appErr
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
	fields, err := a.Srv().propertyService.SearchPropertyFields(groupId, model.PropertyFieldSearchOpts{PerPage: CONTENT_FLAGGING_MAX_PROPERTY_FIELDS})
	if err != nil {
		return nil, model.NewAppError("GetContentFlaggingMappedFields", "app.content_flagging.search_property_fields.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	mappedFields := map[string]*model.PropertyField{}
	for _, field := range fields {
		mappedFields[field.Name] = field
	}

	return mappedFields, nil
}

func (a *App) createContentReviewPost(rctx request.CTX, reportedPostId, teamId, reportingUserId, reportingReason, flaggedPostChannelId, flaggedPostAuthorId string) *model.AppError {
	contentReviewBot, appErr := a.getContentReviewBot(rctx)
	if appErr != nil {
		return appErr
	}

	channels, appErr := a.getContentReviewChannels(rctx, teamId, contentReviewBot.UserId)
	if appErr != nil {
		return appErr
	}

	reportingUser, appErr := a.GetUser(reportingUserId)
	if appErr != nil {
		return appErr
	}

	flaggedPostChannel, appErr := a.GetChannel(rctx, flaggedPostChannelId)
	if appErr != nil {
		return appErr
	}

	flaggedPostTeam, appErr := a.GetTeam(flaggedPostChannel.TeamId)
	if appErr != nil {
		return appErr
	}

	flaggedPostAuthor, appErr := a.GetUser(flaggedPostAuthorId)
	if appErr != nil {
		return appErr
	}

	message := fmt.Sprintf(
		"@%s flagged a message for review.\n\nReason: %s\nChannel: ~%s\nTeam: %s\nPost Author: @%s\n\nOpen on a web browser or the Desktop app to view the full report and take action.",
		reportingUser.Username,
		reportingReason,
		flaggedPostChannel.Name,
		flaggedPostTeam.DisplayName,
		flaggedPostAuthor.Username,
	)

	for _, channel := range channels {
		post := &model.Post{
			Message:   message,
			UserId:    contentReviewBot.UserId,
			Type:      model.ContentFlaggingPostType,
			ChannelId: channel.Id,
		}
		post.AddProp(POST_PROP_KEY_FLAGGED_POST_ID, reportedPostId)
		_, appErr := a.CreatePost(rctx, post, channel, model.CreatePostFlags{})
		if appErr != nil {
			rctx.Logger().Error("Failed to create content review post in one of the channels", mlog.Err(appErr), mlog.String("channel_id", channel.Id), mlog.String("team_id", teamId))
			continue // Don't stop processing other channels if one fails
		}
	}

	return nil
}

func (a *App) getContentReviewChannels(rctx request.CTX, teamId, contentReviewBotId string) ([]*model.Channel, *model.AppError) {
	reviewersUserIDs, appErr := a.getReviewersForTeam(teamId, true)
	if appErr != nil {
		return nil, appErr
	}

	var channels []*model.Channel
	for _, userId := range reviewersUserIDs {
		channel, appErr := a.GetOrCreateDirectChannel(rctx, userId, contentReviewBotId)
		if appErr != nil {
			// Don't stop processing other reviewers if one fails
			rctx.Logger().Error("Failed to get or create direct channel for one of the reviewers and content review bot", mlog.Err(appErr), mlog.String("user_id", userId), mlog.String("bot_id", contentReviewBotId))
		}

		channels = append(channels, channel)
	}

	return channels, nil
}

func (a *App) getContentReviewBot(rctx request.CTX) (*model.Bot, *model.AppError) {
	return a.GetOrCreateSystemOwnedBot(rctx, model.ContentFlaggingBotUsername, i18n.T("app.system.content_review_bot.bot_displayname"))
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

	reviewerUserIDs := make([]string, 0, len(reviewerUserIDMap))
	for userID := range maps.Keys(reviewerUserIDMap) {
		reviewerUserIDs = append(reviewerUserIDs, userID)
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

	fetchFunc := func(page int) ([]*model.User, error) {
		options.Page = page
		users, appErr := a.GetUsersInTeam(options)
		// Checking for error this way instead of directly returning *model.AppError
		// doesn't equate to error == nil (pointer vs non-pointer)
		if appErr != nil {
			return users, errors.New(appErr.Error())
		}

		return users, nil
	}

	additionalReviewers, err := utils.Pager(fetchFunc, options.PerPage)
	if err != nil {
		return nil, model.NewAppError("getReviewersForTeam", "app.content_flagging.get_users_in_team.app_error", nil, err.Error(), http.StatusInternalServerError).Wrap(err)
	}

	return additionalReviewers, nil
}

func (a *App) sendContentFlaggingConfirmationMessage(rctx request.CTX, flaggingUserId, flaggedPostAuthorId, channelID string) *model.AppError {
	flaggedPostAuthor, appErr := a.GetUser(flaggedPostAuthorId)
	if appErr != nil {
		return appErr
	}

	T := i18n.GetUserTranslations(flaggedPostAuthor.Locale)
	post := &model.Post{
		Message:   T("app.content_flagging.flag_post_confirmation.message", map[string]any{"username": flaggedPostAuthor.Username}),
		ChannelId: channelID,
	}

	a.SendEphemeralPost(rctx, flaggingUserId, post)
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

	propertyValues, err := a.Srv().propertyService.SearchPropertyValues(groupId, model.PropertyValueSearchOpts{TargetIDs: []string{postId}, PerPage: CONTENT_FLAGGING_MAX_PROPERTY_VALUES})
	if err != nil {
		return nil, model.NewAppError("GetPostContentFlaggingPropertyValues", "app.content_flagging.search_property_values.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return propertyValues, nil
}

func (a *App) PermanentDeleteFlaggedPost(rctx request.CTX, actionRequest *model.FlagContentActionRequest, reviewerId string, flaggedPost *model.Post) *model.AppError {
	// when a flagged post is removed, the following things need to be done
	// 1. Hard delete corresponding file infos
	// 2. Hard delete file infos associated to post's edit history
	// 3. Hard delete post's edit history
	// 4. Hard delete the files from file storage
	// 5. Hard delete post's priority data
	// 6. Hard delete post's post acknowledgements
	// 7. Hard delete post reminders
	// 8. Scrub the post's content - message, props

	commentBytes, jsonErr := json.Marshal(actionRequest.Comment)
	if jsonErr != nil {
		return model.NewAppError("PermanentlyRemoveFlaggedPost", "app.content_flagging.permanently_delete.marshal_comment.app_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	// Storing marshalled content into RawMessage to ensure proper escaping of special characters and prevent
	// generating unsafe JSON values
	commentJsonValue := json.RawMessage(commentBytes)

	status, appErr := a.GetPostContentFlaggingStatusValue(flaggedPost.Id)
	if appErr != nil {
		return appErr
	}

	statusValue := strings.Trim(string(status.Value), `"`)
	if statusValue != model.ContentFlaggingStatusPending && statusValue != model.ContentFlaggingStatusAssigned {
		return model.NewAppError("removeFlaggedPost", "api.content_flagging.error.post_not_in_progress", nil, "", http.StatusBadRequest)
	}

	editHistories, appErr := a.GetEditHistoryForPost(flaggedPost.Id)
	if appErr != nil {
		//editHistories = []*model.Post{}

		if appErr.StatusCode != http.StatusNotFound {
			rctx.Logger().Error("PermanentlyRemoveFlaggedPost: Failed to get edit history for flaggedPost", mlog.Err(appErr), mlog.String("post_id", flaggedPost.Id))
		}
	}

	for _, editHistory := range editHistories {
		if filesDeleteAppErr := a.PermanentDeleteFilesByPost(rctx, editHistory.Id); filesDeleteAppErr != nil {
			rctx.Logger().Error("PermanentlyRemoveFlaggedPost: Failed to permanently delete files for one of the edit history posts", mlog.Err(filesDeleteAppErr), mlog.String("post_id", editHistory.Id))
		}

		if deletePostAppErr := a.PermanentDeletePost(rctx, editHistory.Id, reviewerId); deletePostAppErr != nil {
			rctx.Logger().Error("PermanentlyRemoveFlaggedPost: Failed to permanently delete one of the edit history posts", mlog.Err(deletePostAppErr), mlog.String("post_id", editHistory.Id))
		}
	}

	if filesDeleteAppErr := a.PermanentDeleteFilesByPost(rctx, flaggedPost.Id); filesDeleteAppErr != nil {
		rctx.Logger().Error("PermanentlyRemoveFlaggedPost: Failed to permanently delete files for the flaggedPost", mlog.Err(filesDeleteAppErr), mlog.String("post_id", flaggedPost.Id))
	}

	if err := a.DeletePriorityForPost(flaggedPost.Id); err != nil {
		rctx.Logger().Error("PermanentlyRemoveFlaggedPost: Failed to delete flaggedPost priority for the flaggedPost", mlog.Err(err), mlog.String("post_id", flaggedPost.Id))
	}

	if err := a.Srv().Store().PostAcknowledgement().DeleteAllForPost(flaggedPost.Id); err != nil {
		rctx.Logger().Error("PermanentlyRemoveFlaggedPost: Failed to delete flaggedPost acknowledgements for the flaggedPost", mlog.Err(err), mlog.String("post_id", flaggedPost.Id))
	}

	if err := a.Srv().Store().Post().DeleteAllPostRemindersForPost(flaggedPost.Id); err != nil {
		rctx.Logger().Error("PermanentlyRemoveFlaggedPost: Failed to delete flaggedPost reminders for the flaggedPost", mlog.Err(err), mlog.String("post_id", flaggedPost.Id))
	}

	scrubPost(flaggedPost)
	_, err := a.Srv().Store().Post().Overwrite(rctx, flaggedPost)
	if err != nil {
		return model.NewAppError("PermanentlyRemoveFlaggedPost", "app.content_flagging.permanently_delete.app_error", nil, err.Error(), http.StatusInternalServerError).Wrap(err)
	}

	groupId, appErr := a.ContentFlaggingGroupId()
	if appErr != nil {
		return appErr
	}

	mappedFields, appErr := a.GetContentFlaggingMappedFields(groupId)
	if appErr != nil {
		return appErr
	}

	propertyValues := []*model.PropertyValue{
		{
			TargetID:   flaggedPost.Id,
			TargetType: model.PropertyValueTargetTypePost,
			GroupID:    groupId,
			FieldID:    mappedFields[contentFlaggingPropertyNameActorUserID].ID,
			Value:      json.RawMessage(fmt.Sprintf(`"%s"`, reviewerId)),
		},
		{
			TargetID:   flaggedPost.Id,
			TargetType: model.PropertyValueTargetTypePost,
			GroupID:    groupId,
			FieldID:    mappedFields[contentFlaggingPropertyNameActorComment].ID,
			Value:      commentJsonValue,
		},
		{
			TargetID:   flaggedPost.Id,
			TargetType: model.PropertyValueTargetTypePost,
			GroupID:    groupId,
			FieldID:    mappedFields[contentFlaggingPropertyNameActionTime].ID,
			Value:      json.RawMessage(fmt.Sprintf("%d", model.GetMillis())),
		},
	}

	_, err = a.Srv().propertyService.CreatePropertyValues(propertyValues)
	if err != nil {
		return model.NewAppError("PermanentlyRemoveFlaggedPost", "app.content_flagging.create_property_values.app_error", nil, err.Error(), http.StatusInternalServerError).Wrap(err)
	}

	status.Value = json.RawMessage(fmt.Sprintf(`"%s"`, model.ContentFlaggingStatusRemoved))
	_, err = a.Srv().propertyService.UpdatePropertyValue(groupId, status)
	if err != nil {
		return model.NewAppError("PermanentlyRemoveFlaggedPost", "app.content_flagging.permanently_delete.update_property_value.app_error", nil, err.Error(), http.StatusInternalServerError).Wrap(err)
	}

	a.Srv().Go(func() {
		channel, appErr := a.GetChannel(rctx, flaggedPost.ChannelId)
		if appErr != nil {
			rctx.Logger().Error("Failed to get channel for flagged post while publishing report change after permanently removing flagged post", mlog.Err(appErr), mlog.String("post_id", flaggedPost.Id), mlog.String("channel_id", flaggedPost.ChannelId))
			return
		}

		propertyValues = append(propertyValues, status)
		if err := a.publishContentFlaggingReportUpdateEvent(flaggedPost.Id, channel.TeamId, propertyValues); err != nil {
			rctx.Logger().Error("Failed to publish report change after permanently removing flagged post", mlog.Err(err), mlog.String("post_id", flaggedPost.Id))
		}
	})

	return nil
}

func (a *App) KeepFlaggedPost(rctx request.CTX, actionRequest *model.FlagContentActionRequest, reviewerId string, flaggedPost *model.Post) *model.AppError {
	// for keeping a flagged flaggedPost we need to-
	// 1. Undelete the flaggedPost if it was deleted, that's it

	status, appErr := a.GetPostContentFlaggingStatusValue(flaggedPost.Id)
	if appErr != nil {
		return appErr
	}

	statusValue := strings.Trim(string(status.Value), `"`)
	if statusValue != model.ContentFlaggingStatusPending && statusValue != model.ContentFlaggingStatusAssigned {
		return model.NewAppError("removeFlaggedPost", "api.content_flagging.error.post_not_in_progress", nil, "", http.StatusBadRequest)
	}

	if flaggedPost.DeleteAt > 0 {
		flaggedPost.DeleteAt = 0
		flaggedPost.UpdateAt = model.GetMillis()
		flaggedPost.PreCommit()
		_, err := a.Srv().Store().Post().Overwrite(rctx, flaggedPost)
		if err != nil {
			return model.NewAppError("KeepFlaggedPost", "app.content_flagging.keep_post.undelete.app_error", nil, err.Error(), http.StatusInternalServerError).Wrap(err)
		}

		err = a.Srv().Store().FileInfo().RestoreForPostByIds(rctx, flaggedPost.Id, flaggedPost.FileIds)
		if err != nil {
			return model.NewAppError("KeepFlaggedPost", "app.content_flagging.restore_file_info.app_error", nil, err.Error(), http.StatusInternalServerError).Wrap(err)
		}
	}

	groupId, appErr := a.ContentFlaggingGroupId()
	if appErr != nil {
		return appErr
	}

	mappedFields, appErr := a.GetContentFlaggingMappedFields(groupId)
	if appErr != nil {
		return appErr
	}

	commentBytes, err := json.Marshal(actionRequest.Comment)
	if err != nil {
		return model.NewAppError("KeepFlaggedPost", "app.content_flagging.keep_flag_post.marshal_comment.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	// Storing marshalled content into RawMessage to ensure proper escaping of special characters and prevent
	// generating unsafe JSON values
	commentJsonValue := json.RawMessage(commentBytes)

	propertyValues := []*model.PropertyValue{
		{
			TargetID:   flaggedPost.Id,
			TargetType: model.PropertyValueTargetTypePost,
			GroupID:    groupId,
			FieldID:    mappedFields[contentFlaggingPropertyNameActorUserID].ID,
			Value:      json.RawMessage(fmt.Sprintf(`"%s"`, reviewerId)),
		},
		{
			TargetID:   flaggedPost.Id,
			TargetType: model.PropertyValueTargetTypePost,
			GroupID:    groupId,
			FieldID:    mappedFields[contentFlaggingPropertyNameActorComment].ID,
			Value:      commentJsonValue,
		},
		{
			TargetID:   flaggedPost.Id,
			TargetType: model.PropertyValueTargetTypePost,
			GroupID:    groupId,
			FieldID:    mappedFields[contentFlaggingPropertyNameActionTime].ID,
			Value:      json.RawMessage(fmt.Sprintf("%d", model.GetMillis())),
		},
	}

	_, err = a.Srv().propertyService.CreatePropertyValues(propertyValues)
	if err != nil {
		return model.NewAppError("PermanentlyRemoveFlaggedPost", "app.content_flagging.create_property_values.app_error", nil, err.Error(), http.StatusInternalServerError).Wrap(err)
	}

	status.Value = json.RawMessage(fmt.Sprintf(`"%s"`, model.ContentFlaggingStatusRetained))
	_, err = a.Srv().propertyService.UpdatePropertyValue(groupId, status)
	if err != nil {
		return model.NewAppError("PermanentlyRemoveFlaggedPost", "app.content_flagging.keep_post.status_update.app_error", nil, err.Error(), http.StatusInternalServerError).Wrap(err)
	}

	a.Srv().Go(func() {
		channel, getChannelErr := a.GetChannel(rctx, flaggedPost.ChannelId)
		if getChannelErr != nil {
			rctx.Logger().Error("Failed to get channel for flagged post while publishing report change after permanently removing flagged post", mlog.Err(getChannelErr), mlog.String("post_id", flaggedPost.Id), mlog.String("channel_id", flaggedPost.ChannelId))
			return
		}

		propertyValues = append(propertyValues, status)
		if err := a.publishContentFlaggingReportUpdateEvent(flaggedPost.Id, channel.TeamId, propertyValues); err != nil {
			rctx.Logger().Error("Failed to publish report change after permanently removing flagged flaggedPost", mlog.Err(err), mlog.String("post_id", flaggedPost.Id))
		}
	})

	message := model.NewWebSocketEvent(model.WebsocketEventPostEdited, "", flaggedPost.ChannelId, "", nil, "")
	appErr = a.publishWebsocketEventForPost(rctx, flaggedPost, message)
	if appErr != nil {
		rctx.Logger().Error("Failed to publish websocket event for post edit while keeping flagged post", mlog.Err(appErr), mlog.String("post_id", flaggedPost.Id))
	}
	a.invalidateCacheForChannelPosts(flaggedPost.ChannelId)

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

func (a *App) publishContentFlaggingReportUpdateEvent(targetId, teamId string, propertyValues []*model.PropertyValue) *model.AppError {
	reviewersUserIDs, appErr := a.getReviewersForTeam(teamId, true)
	if appErr != nil {
		return appErr
	}

	bytes, err := json.Marshal(propertyValues)
	if err != nil {
		return model.NewAppError("publishContentFlaggingReportUpdateEvent", "app.content_flagging.marshal_property_values.app_error", nil, err.Error(), http.StatusInternalServerError).Wrap(err)
	}

	for _, userId := range reviewersUserIDs {
		message := model.NewWebSocketEvent(model.WebsocketContentFlaggingReportValueUpdated, "", "", userId, nil, "")
		message.Add("property_values", string(bytes))
		message.Add("target_id", targetId)
		a.Publish(message)
	}

	return nil
}
