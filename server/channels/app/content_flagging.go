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

	CONTENT_FLAGGING_REVIEWER_SEARCH_INDIVIDUAL_LIMIT = 50
)

func (a *App) ContentFlaggingEnabledForTeam(teamId string) (bool, *model.AppError) {
	reviewerIDs, appErr := a.GetContentFlaggingConfigReviewerIDs()
	if appErr != nil {
		return false, appErr
	}

	reviewerSettings := a.Config().ContentFlaggingSettings.ReviewerSettings
	commonReviewersEnabled := reviewerSettings.CommonReviewers != nil && *reviewerSettings.CommonReviewers

	hasAdditionalReviewers := (reviewerSettings.TeamAdminsAsReviewers != nil && *reviewerSettings.TeamAdminsAsReviewers) ||
		(reviewerSettings.SystemAdminsAsReviewers != nil && *reviewerSettings.SystemAdminsAsReviewers)

	if commonReviewersEnabled {
		if len(reviewerIDs.CommonReviewerIds) > 0 || hasAdditionalReviewers {
			return true, nil
		}

		return false, nil
	}

	teamSettings, exist := (reviewerIDs.TeamReviewersSetting)[teamId]
	if !exist {
		return false, nil
	}

	enabledForTeam := teamSettings.Enabled != nil && *teamSettings.Enabled
	if !enabledForTeam {
		return false, nil
	}

	hasTeamReviewers := len(teamSettings.ReviewerIds) > 0
	if hasTeamReviewers || hasAdditionalReviewers {
		return true, nil
	}

	return false, nil
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
		{
			TargetID:   post.Id,
			TargetType: model.PropertyValueTargetTypePost,
			GroupID:    groupId,
			FieldID:    mappedFields[contentFlaggingPropertyManageByContentFlagging].ID,
			Value:      json.RawMessage("true"),
		},
	}

	_, err = a.Srv().propertyService.CreatePropertyValues(propertyValues)
	if err != nil {
		return model.NewAppError("FlagPost", "app.content_flagging.create_property_values.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if *a.Config().ContentFlaggingSettings.AdditionalSettings.HideFlaggedContent {
		appErr = a.setContentFlaggingPropertiesForThreadReplies(post, groupId, mappedFields[contentFlaggingPropertyManageByContentFlagging].ID)
		if appErr != nil {
			return appErr
		}
	}

	contentReviewBot, appErr := a.getContentReviewBot(rctx)
	if appErr != nil {
		return appErr
	}

	if *a.Config().ContentFlaggingSettings.AdditionalSettings.HideFlaggedContent {
		_, appErr = a.DeletePost(rctx, post.Id, contentReviewBot.UserId)
		if appErr != nil {
			return appErr
		}
	}

	flaggedPostIdField, ok := mappedFields[contentFlaggingPropertyNameFlaggedPostId]
	if !ok {
		return model.NewAppError("FlagPost", "app.content_flagging.missing_flagged_post_id_field.app_error", nil, "", http.StatusInternalServerError)
	}

	a.Srv().Go(func() {
		appErr = a.createContentReviewPost(rctx, post.Id, teamId, reportingUserId, flagData.Reason, post.ChannelId, post.UserId, flaggedPostIdField.ID, groupId)
		if appErr != nil {
			rctx.Logger().Error("Failed to create content review post", mlog.Err(appErr), mlog.String("team_id", teamId), mlog.String("post_id", post.Id))
		}
	})

	a.Srv().Go(func() {
		if appErr := a.sendFlagPostNotification(rctx, post); appErr != nil {
			rctx.Logger().Error("Failed to send flag post notification", mlog.Err(appErr), mlog.String("post_id", post.Id))
		}
	})

	return a.sendContentFlaggingConfirmationMessage(rctx, reportingUserId, post.UserId, post.ChannelId)
}

func (a *App) setContentFlaggingPropertiesForThreadReplies(post *model.Post, contentFlaggingGroupId, contentFlaggingManagedFieldId string) *model.AppError {
	if post.RootId != "" {
		// Post is a reply, not a root post
		return nil
	}

	replies, err := a.Srv().Store().Post().GetPostsByThread(post.Id, 0)
	if err != nil {
		return model.NewAppError("setContentFlaggingPropertiesForThreadReplies", "app.content_flagging.get_thread_replies.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	propertyValues := make([]*model.PropertyValue, 0, len(replies))
	for _, reply := range replies {
		propertyValues = append(propertyValues, &model.PropertyValue{
			TargetID:   reply.Id,
			TargetType: model.PropertyValueTargetTypePost,
			GroupID:    contentFlaggingGroupId,
			FieldID:    contentFlaggingManagedFieldId,
			Value:      json.RawMessage("true"),
		})
	}

	_, err = a.Srv().propertyService.CreatePropertyValues(propertyValues)
	if err != nil {
		return model.NewAppError("setContentFlaggingPropertiesForThreadReplies", "app.content_flagging.set_thread_replies_properties.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) ContentFlaggingGroupId() (string, *model.AppError) {
	group, err := a.Srv().propertyService.GetPropertyGroup(model.ContentFlaggingGroupName)
	if err != nil {
		return "", model.NewAppError("getContentFlaggingGroupId", "app.content_flagging.get_group.error", nil, "", http.StatusInternalServerError)
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

func (a *App) createContentReviewPost(rctx request.CTX, flaggedPostId, teamId, reportingUserId, reportingReason, flaggedPostChannelId, flaggedPostAuthorId, flaggedPostIdFieldId, contentFlaggingGroupId string) *model.AppError {
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
		post.AddProp(POST_PROP_KEY_FLAGGED_POST_ID, flaggedPostId)
		createdPost, appErr := a.CreatePost(rctx, post, channel, model.CreatePostFlags{})
		if appErr != nil {
			rctx.Logger().Error("Failed to create content review post in one of the channels", mlog.Err(appErr), mlog.String("channel_id", channel.Id), mlog.String("team_id", teamId))
			continue // Don't stop processing other channels if one fails
		}

		propertyValue := &model.PropertyValue{
			TargetID:   createdPost.Id,
			TargetType: model.PropertyValueTargetTypePost,
			GroupID:    contentFlaggingGroupId,
			FieldID:    flaggedPostIdFieldId,
			Value:      json.RawMessage(fmt.Sprintf(`"%s"`, flaggedPostId)),
		}
		_, err := a.Srv().propertyService.CreatePropertyValue(propertyValue)
		if err != nil {
			rctx.Logger().Error("Failed to create content review post property value in one of the channels", mlog.Err(err), mlog.String("channel_id", channel.Id), mlog.String("team_id", teamId), mlog.String("post_id", createdPost.Id))
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
	reviewerIDs, appErr := a.GetContentFlaggingConfigReviewerIDs()
	if appErr != nil {
		return nil, appErr
	}

	reviewerUserIDMap := map[string]bool{}

	reviewerSettings := a.Config().ContentFlaggingSettings.ReviewerSettings
	if *reviewerSettings.CommonReviewers {
		for _, userID := range reviewerIDs.CommonReviewerIds {
			reviewerUserIDMap[userID] = true
		}
	} else {
		// If common reviewers are not enabled, we still need to check if the team has specific reviewers
		teamSettings, exist := reviewerIDs.TeamReviewersSetting[teamId]
		if exist && *teamSettings.Enabled && teamSettings.ReviewerIds != nil {
			for _, userID := range teamSettings.ReviewerIds {
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
		return nil, model.NewAppError("getAllUsersInTeamForRoles", "app.content_flagging.get_users_in_team.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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
		return model.NewAppError("PermanentlyRemoveFlaggedPost", "api.content_flagging.error.post_not_in_progress", nil, "", http.StatusBadRequest)
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
		return model.NewAppError("PermanentlyRemoveFlaggedPost", "app.content_flagging.permanently_delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	contentReviewBot, appErr := a.getContentReviewBot(rctx)
	if appErr != nil {
		return appErr
	}

	// If the post is not already deleted, delete it now.
	// This handles the case when "Hide message from channel while it is being reviewed" setting is set to false when the post was flagged.
	if flaggedPost.DeleteAt == 0 {
		// DeletePost is called to care of WebSocket events, cache invalidation, search index removal,
		// persistent notification removal and other cleanup tasks that need to happen on post deletion.
		_, appErr = a.DeletePost(rctx, flaggedPost.Id, contentReviewBot.UserId)
		if appErr != nil {
			return appErr
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
		return model.NewAppError("PermanentlyRemoveFlaggedPost", "app.content_flagging.create_property_values.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	status.Value = json.RawMessage(fmt.Sprintf(`"%s"`, model.ContentFlaggingStatusRemoved))
	_, err = a.Srv().propertyService.UpdatePropertyValue(groupId, status)
	if err != nil {
		return model.NewAppError("PermanentlyRemoveFlaggedPost", "app.content_flagging.permanently_delete.update_property_value.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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

	a.Srv().Go(func() {
		a.sendFlaggedPostRemovalNotification(rctx, flaggedPost, reviewerId, actionRequest.Comment, groupId)
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
		return model.NewAppError("KeepFlaggedPost", "api.content_flagging.error.post_not_in_progress", nil, "", http.StatusBadRequest)
	}

	groupId, appErr := a.ContentFlaggingGroupId()
	if appErr != nil {
		return appErr
	}

	mappedFields, appErr := a.GetContentFlaggingMappedFields(groupId)
	if appErr != nil {
		return appErr
	}

	if flaggedPost.DeleteAt > 0 {
		statusField, ok := mappedFields[contentFlaggingPropertyNameStatus]
		if !ok {
			return model.NewAppError("KeepFlaggedPost", "app.content_flagging.missing_status_field.app_error", nil, "", http.StatusInternalServerError)
		}

		contentFlaggingManagedField, ok := mappedFields[contentFlaggingPropertyManageByContentFlagging]
		if !ok {
			return model.NewAppError("KeepFlaggedPost", "app.content_flagging.missing_manage_by_field.app_error", nil, "", http.StatusInternalServerError)
		}

		// Restore the post, its replies, and all associated files
		if err := a.Srv().Store().Post().RestoreContentFlaggedPost(flaggedPost, statusField.ID, contentFlaggingManagedField.ID); err != nil {
			return model.NewAppError("KeepFlaggedPost", "app.content_flagging.keep_post.undelete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
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
		return model.NewAppError("KeepFlaggedPost", "app.content_flagging.create_property_values.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	status.Value = json.RawMessage(fmt.Sprintf(`"%s"`, model.ContentFlaggingStatusRetained))
	_, err = a.Srv().propertyService.UpdatePropertyValue(groupId, status)
	if err != nil {
		return model.NewAppError("KeepFlaggedPost", "app.content_flagging.keep_post.status_update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Also need to remove the content flagging managed field value from root post and its replies (if any)

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

	a.Srv().Go(func() {
		a.sendKeepFlaggedPostNotification(rctx, flaggedPost, reviewerId, actionRequest.Comment, groupId)
	})

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
		return model.NewAppError("publishContentFlaggingReportUpdateEvent", "app.content_flagging.marshal_property_values.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, userId := range reviewersUserIDs {
		message := model.NewWebSocketEvent(model.WebsocketContentFlaggingReportValueUpdated, "", "", userId, nil, "")
		message.Add("property_values", string(bytes))
		message.Add("target_id", targetId)
		a.Publish(message)
	}

	return nil
}

func (a *App) SaveContentFlaggingConfig(config model.ContentFlaggingSettingsRequest) *model.AppError {
	err := a.Srv().Store().ContentFlagging().SaveReviewerSettings(config.ReviewerSettings.ReviewerIDsSettings)
	if err != nil {
		return model.NewAppError("SaveContentFlaggingConfig", "app.content_flagging.save_reviewer_settings.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.UpdateConfig(func(cfg *model.Config) {
		cfg.ContentFlaggingSettings = model.ContentFlaggingSettings{}
		cfg.ContentFlaggingSettings.EnableContentFlagging = config.EnableContentFlagging
		cfg.ContentFlaggingSettings.NotificationSettings = config.NotificationSettings
		cfg.ContentFlaggingSettings.AdditionalSettings = config.AdditionalSettings
		cfg.ContentFlaggingSettings.ReviewerSettings = &model.ReviewerSettings{
			CommonReviewers:         config.ReviewerSettings.CommonReviewers,
			SystemAdminsAsReviewers: config.ReviewerSettings.SystemAdminsAsReviewers,
			TeamAdminsAsReviewers:   config.ReviewerSettings.TeamAdminsAsReviewers,
		}
	})

	a.clearContentFlaggingConfigCache()
	return nil
}

func (a *App) clearContentFlaggingConfigCache() {
	a.Srv().Store().ContentFlagging().ClearCaches()
	if cluster := a.Cluster(); cluster != nil && *a.Config().ClusterSettings.Enable {
		cluster.SendClusterMessage(&model.ClusterMessage{
			Event:    model.ClusterEventInvalidateCacheForContentFlagging,
			SendType: model.ClusterSendReliable,
			Data:     nil,
		})
	}
}

func (a *App) GetContentFlaggingConfigReviewerIDs() (*model.ReviewerIDsSettings, *model.AppError) {
	reviewerSettings, err := a.Srv().Store().ContentFlagging().GetReviewerSettings()
	if err != nil {
		return nil, model.NewAppError("GetContentFlaggingConfigReviewerIDs", "app.content_flagging.get_reviewer_settings.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return reviewerSettings, nil
}

func (a *App) SearchReviewers(rctx request.CTX, term string, teamId string) ([]*model.User, *model.AppError) {
	reviewerSettings := a.Config().ContentFlaggingSettings.ReviewerSettings

	reviewers := map[string]*model.User{}

	if reviewerSettings.CommonReviewers != nil && *reviewerSettings.CommonReviewers {
		commonReviewers, err := a.Srv().Store().User().SearchCommonContentFlaggingReviewers(term)
		if err != nil {
			return nil, model.NewAppError("SearchReviewers", "app.content_flagging.search_common_reviewers.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		for _, user := range commonReviewers {
			reviewers[user.Id] = user
		}
	} else {
		teamReviewers, err := a.Srv().Store().User().SearchTeamContentFlaggingReviewers(teamId, term)
		if err != nil {
			return nil, model.NewAppError("SearchReviewers", "app.content_flagging.search_team_reviewers.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		for _, user := range teamReviewers {
			reviewers[user.Id] = user
		}
	}

	if reviewerSettings.SystemAdminsAsReviewers != nil && *reviewerSettings.SystemAdminsAsReviewers {
		systemAdminReviewers, err := a.Srv().Store().User().Search(rctx, teamId, term, &model.UserSearchOptions{
			AllowInactive:  false,
			Role:           model.SystemAdminRoleId,
			AllowEmails:    false,
			AllowFullNames: true,
			Limit:          CONTENT_FLAGGING_REVIEWER_SEARCH_INDIVIDUAL_LIMIT,
		})
		if err != nil {
			return nil, model.NewAppError("SearchReviewers", "app.content_flagging.search_sysadmin_reviewers.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		for _, user := range systemAdminReviewers {
			reviewers[user.Id] = user
		}
	}

	if reviewerSettings.TeamAdminsAsReviewers != nil && *reviewerSettings.TeamAdminsAsReviewers {
		teamAdminReviewers, err := a.Srv().Store().User().Search(rctx, teamId, term, &model.UserSearchOptions{
			AllowInactive:  false,
			TeamRoles:      []string{model.TeamAdminRoleId},
			AllowEmails:    false,
			AllowFullNames: true,
			Limit:          CONTENT_FLAGGING_REVIEWER_SEARCH_INDIVIDUAL_LIMIT,
		})
		if err != nil {
			return nil, model.NewAppError("SearchReviewers", "app.content_flagging.search_team_admin_reviewers.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		for _, user := range teamAdminReviewers {
			reviewers[user.Id] = user
		}
	}

	reviewersList := make([]*model.User, 0, len(reviewers))
	for _, user := range reviewers {
		a.SanitizeProfile(user, false)
		reviewersList = append(reviewersList, user)
	}

	return reviewersList, nil
}

func (a *App) AssignFlaggedPostReviewer(rctx request.CTX, flaggedPostId, flaggedPostTeamId, reviewerId, assigneeId string) *model.AppError {
	statusPropertyValue, appErr := a.GetPostContentFlaggingStatusValue(flaggedPostId)
	if appErr != nil {
		return appErr
	}

	status := strings.Trim(string(statusPropertyValue.Value), `"`)

	groupId, appErr := a.ContentFlaggingGroupId()
	if appErr != nil {
		return appErr
	}

	mappedFields, appErr := a.GetContentFlaggingMappedFields(groupId)
	if appErr != nil {
		return appErr
	}

	if _, ok := mappedFields[contentFlaggingPropertyNameReviewerUserID]; !ok {
		return model.NewAppError("AssignFlaggedPostReviewer", "app.content_flagging.assign_reviewer.no_reviewer_field.app_error", nil, "", http.StatusInternalServerError)
	}

	assigneePropertyValue := &model.PropertyValue{
		TargetID:   flaggedPostId,
		TargetType: model.PropertyValueTargetTypePost,
		GroupID:    groupId,
		FieldID:    mappedFields[contentFlaggingPropertyNameReviewerUserID].ID,
		Value:      json.RawMessage(fmt.Sprintf(`"%s"`, reviewerId)),
	}

	assigneePropertyValue, err := a.Srv().propertyService.UpsertPropertyValue(assigneePropertyValue)
	if err != nil {
		return model.NewAppError("AssignFlaggedPostReviewer", "app.content_flagging.assign_reviewer.upsert_property_value.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if status == model.ContentFlaggingStatusPending {
		statusPropertyValue.Value = json.RawMessage(fmt.Sprintf(`"%s"`, model.ContentFlaggingStatusAssigned))
		statusPropertyValue, err = a.Srv().propertyService.UpdatePropertyValue(groupId, statusPropertyValue)
		if err != nil {
			return model.NewAppError("AssignFlaggedPostReviewer", "app.content_flagging.assign_reviewer.update_status_property_value.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	a.Srv().Go(func() {
		_, postErr := a.postAssignReviewerMessage(rctx, groupId, flaggedPostId, reviewerId, assigneeId)
		if postErr != nil {
			rctx.Logger().Error("Failed to post assign reviewer message", mlog.Err(postErr), mlog.String("flagged_post_id", flaggedPostId), mlog.String("reviewer_id", reviewerId), mlog.String("assignee_id", assigneeId))
		}
	})

	a.Srv().Go(func() {
		updateEventAppErr := a.publishContentFlaggingReportUpdateEvent(flaggedPostId, flaggedPostTeamId, []*model.PropertyValue{assigneePropertyValue, statusPropertyValue})
		if updateEventAppErr != nil {
			rctx.Logger().Error("Failed to publish report change after assigning reviewer", mlog.Err(updateEventAppErr), mlog.String("flagged_post_id", flaggedPostId), mlog.String("reviewer_id", reviewerId), mlog.String("assignee_id", assigneeId))
		}
	})

	return nil
}

func (a *App) postAssignReviewerMessage(rctx request.CTX, contentFlaggingGroupId, flaggedPostId, reviewerId, assignedById string) ([]*model.Post, *model.AppError) {
	notificationSettings := a.Config().ContentFlaggingSettings.NotificationSettings
	if notificationSettings == nil {
		return nil, nil
	}

	if !slices.Contains(notificationSettings.EventTargetMapping[model.EventAssigned], model.TargetReviewers) {
		return nil, nil
	}

	reviewerUser, appErr := a.GetUser(reviewerId)
	if appErr != nil {
		return nil, appErr
	}

	var assignedByUser *model.User
	if reviewerId == assignedById {
		assignedByUser = reviewerUser
	} else {
		assignedByUser, appErr = a.GetUser(assignedById)
		if appErr != nil {
			return nil, appErr
		}
	}

	message := fmt.Sprintf("@%s was assigned as a reviewer by @%s", reviewerUser.Username, assignedByUser.Username)
	return a.postReviewerMessage(rctx, message, contentFlaggingGroupId, flaggedPostId)
}

func (a *App) postDeletePostReviewerMessage(rctx request.CTX, flaggedPostId, actorUserId, comment, contentFlaggingGroupId string) ([]*model.Post, *model.AppError) {
	actorUser, appErr := a.GetUser(actorUserId)
	if appErr != nil {
		return nil, appErr
	}

	message := fmt.Sprintf("The flagged message was removed by @%s", actorUser.Username)
	if comment != "" {
		message = fmt.Sprintf("%s\n\nWith comment:\n\n> %s", message, comment)
	}

	return a.postReviewerMessage(rctx, message, contentFlaggingGroupId, flaggedPostId)
}

func (a *App) postKeepPostReviewerMessage(rctx request.CTX, flaggedPostId, actorUserId, comment, contentFlaggingGroupId string) ([]*model.Post, *model.AppError) {
	actorUser, appErr := a.GetUser(actorUserId)
	if appErr != nil {
		return nil, appErr
	}

	message := fmt.Sprintf("The flagged message was retained by @%s", actorUser.Username)
	if comment != "" {
		message = fmt.Sprintf("%s\n\nWith comment:\n\n> %s", message, comment)
	}

	return a.postReviewerMessage(rctx, message, contentFlaggingGroupId, flaggedPostId)
}

func (a *App) getReporterUserId(flaggedPostId, contentFlaggingGroupId string) (string, *model.AppError) {
	mappedFields, appErr := a.GetContentFlaggingMappedFields(contentFlaggingGroupId)
	if appErr != nil {
		return "", appErr
	}

	reporterUserIdField, ok := mappedFields[contentFlaggingPropertyNameReportingUserID]
	if !ok {
		return "", model.NewAppError("getReporterUserId", "app.content_flagging.missing_reporting_user_id_field.app_error", nil, "", http.StatusInternalServerError)
	}

	propertyValues, appErr := a.GetPostContentFlaggingPropertyValues(flaggedPostId)
	if appErr != nil {
		return "", appErr
	}

	var reporterPropertyValue *model.PropertyValue
	for _, pv := range propertyValues {
		if pv.FieldID == reporterUserIdField.ID {
			reporterPropertyValue = pv
			break
		}
	}

	if reporterPropertyValue == nil {
		return "", model.NewAppError("getReporterUserId", "app.content_flagging.missing_reporting_user_id_property_value.app_error", nil, "", http.StatusInternalServerError)
	}

	reporterUserId := strings.Trim(string(reporterPropertyValue.Value), `"`)
	return reporterUserId, nil
}

func (a *App) postContentReviewBotMessage(rctx request.CTX, flaggedPost *model.Post, messageTemplate string, flaggedPostAuthorUserId string) (*model.Post, *model.AppError) {
	channel, appErr := a.GetChannel(rctx, flaggedPost.ChannelId)
	if appErr != nil {
		return nil, appErr
	}

	contentReviewBot, appErr := a.getContentReviewBot(rctx)
	if appErr != nil {
		return nil, appErr
	}

	dmChannel, appErr := a.GetOrCreateDirectChannel(rctx, flaggedPostAuthorUserId, contentReviewBot.UserId)
	if appErr != nil {
		return nil, appErr
	}

	post := &model.Post{
		Message:   fmt.Sprintf(messageTemplate, flaggedPost.Id, channel.DisplayName),
		UserId:    contentReviewBot.UserId,
		ChannelId: dmChannel.Id,
	}

	return a.CreatePost(rctx, post, dmChannel, model.CreatePostFlags{})
}

func (a *App) postMessageToReporter(rctx request.CTX, contentFlaggingGroupId string, flaggedPost *model.Post, messageTemplate string) (*model.Post, *model.AppError) {
	userId, appErr := a.getReporterUserId(flaggedPost.Id, contentFlaggingGroupId)
	if appErr != nil {
		return nil, appErr
	}

	return a.postContentReviewBotMessage(rctx, flaggedPost, messageTemplate, userId)
}

func (a *App) postReviewerMessage(rctx request.CTX, message, contentFlaggingGroupId, flaggedPostId string) ([]*model.Post, *model.AppError) {
	mappedFields, appErr := a.GetContentFlaggingMappedFields(contentFlaggingGroupId)
	if appErr != nil {
		return nil, appErr
	}

	flaggedPostIdField, ok := mappedFields[contentFlaggingPropertyNameFlaggedPostId]
	if !ok {
		return nil, model.NewAppError("postReviewerMessage", "app.content_flagging.missing_flagged_post_id_field.app_error", nil, "", http.StatusInternalServerError)
	}

	postIds, appErr := a.getReviewerPostsForFlaggedPost(contentFlaggingGroupId, flaggedPostId, flaggedPostIdField.ID)
	if appErr != nil {
		return nil, appErr
	}

	contentReviewBot, appErr := a.getContentReviewBot(rctx)
	if appErr != nil {
		return nil, appErr
	}

	createdPosts := make([]*model.Post, 0, len(postIds))
	for _, postId := range postIds {
		reviewerPost, appErr := a.GetSinglePost(rctx, postId, false)
		if appErr != nil {
			rctx.Logger().Error("Failed to get reviewer post while posting assign reviewer message", mlog.Err(appErr), mlog.String("post_id", postId))
			continue
		}

		channel, appErr := a.GetChannel(rctx, reviewerPost.ChannelId)
		if appErr != nil {
			rctx.Logger().Error("Failed to get channel for reviewer post while posting assign reviewer message", mlog.Err(appErr), mlog.String("post_id", postId), mlog.String("channel_id", reviewerPost.ChannelId))
			continue
		}

		post := &model.Post{
			Message:   message,
			UserId:    contentReviewBot.UserId,
			ChannelId: reviewerPost.ChannelId,
			RootId:    postId,
		}

		createdPost, appErr := a.CreatePost(rctx, post, channel, model.CreatePostFlags{})
		if appErr != nil {
			rctx.Logger().Error("Failed to create assign reviewer post in one of the channels", mlog.Err(appErr), mlog.String("channel_id", channel.Id), mlog.String("post_id", postId))
			continue
		}
		createdPosts = append(createdPosts, createdPost)
	}

	return createdPosts, nil
}

func (a *App) getReviewerPostsForFlaggedPost(contentFlaggingGroupId, flaggedPostId, flaggedPostIdFieldId string) ([]string, *model.AppError) {
	searchOptions := model.PropertyValueSearchOpts{
		TargetType: model.PropertyValueTargetTypePost,
		Value:      json.RawMessage(fmt.Sprintf(`"%s"`, flaggedPostId)),
		FieldID:    flaggedPostIdFieldId,
		PerPage:    100,
		Cursor:     model.PropertyValueSearchCursor{},
	}

	var propertyValues []*model.PropertyValue

	for {
		batch, err := a.Srv().propertyService.SearchPropertyValues(contentFlaggingGroupId, searchOptions)
		if err != nil {
			return nil, model.NewAppError("getReviewerPostsForFlaggedPost", "app.content_flagging.search_reviewer_posts.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		propertyValues = append(propertyValues, batch...)

		if len(batch) < searchOptions.PerPage {
			break
		}

		searchOptions.Cursor.PropertyValueID = propertyValues[len(propertyValues)-1].ID
		searchOptions.Cursor.CreateAt = propertyValues[len(propertyValues)-1].CreateAt
	}

	reviewerPostIds := make([]string, 0, len(propertyValues))
	for _, pv := range propertyValues {
		reviewerPostIds = append(reviewerPostIds, pv.TargetID)
	}

	return reviewerPostIds, nil
}

func (a *App) sendFlagPostNotification(rctx request.CTX, flaggedPost *model.Post) *model.AppError {
	notificationSettings := a.Config().ContentFlaggingSettings.NotificationSettings
	flagPostNotifications := notificationSettings.EventTargetMapping[model.EventFlagged]
	if flagPostNotifications == nil {
		return nil
	}

	if !slices.Contains(flagPostNotifications, model.TargetAuthor) {
		return nil
	}

	channel, appErr := a.GetChannel(rctx, flaggedPost.ChannelId)
	if appErr != nil {
		return appErr
	}

	contentReviewBot, appErr := a.getContentReviewBot(rctx)
	if appErr != nil {
		return appErr
	}

	dmChannel, appErr := a.GetOrCreateDirectChannel(rctx, flaggedPost.UserId, contentReviewBot.UserId)
	if appErr != nil {
		return appErr
	}

	post := &model.Post{
		Message:   fmt.Sprintf("Your post having ID `%s` in the channel `%s` has been flagged for review.", flaggedPost.Id, channel.DisplayName),
		UserId:    contentReviewBot.UserId,
		ChannelId: dmChannel.Id,
	}

	_, appErr = a.CreatePost(rctx, post, dmChannel, model.CreatePostFlags{})
	return appErr
}

// sendFlaggedPostRemovalNotification handles the notifications when flagged post is removed for all audiences - reviewers, author, and reporter as per configuration
func (a *App) sendFlaggedPostRemovalNotification(rctx request.CTX, flaggedPost *model.Post, actorUserId, comment, contentFlaggingGroupId string) []*model.Post {
	notificationSettings := a.Config().ContentFlaggingSettings.NotificationSettings
	deletePostNotifications := notificationSettings.EventTargetMapping[model.EventContentRemoved]
	if deletePostNotifications == nil {
		return nil
	}

	var createdPosts []*model.Post

	if slices.Contains(deletePostNotifications, model.TargetReviewers) {
		posts, appErr := a.postDeletePostReviewerMessage(rctx, flaggedPost.Id, actorUserId, comment, contentFlaggingGroupId)
		if appErr != nil {
			rctx.Logger().Error("Failed to post delete post reviewer message after permanently removing flagged post", mlog.Err(appErr), mlog.String("post_id", flaggedPost.Id))
		} else {
			createdPosts = posts
		}
	}

	if slices.Contains(deletePostNotifications, model.TargetAuthor) {
		template := "Your post having ID `%s` in the channel `%s` which was flagged for review has been permanently removed by a reviewer."
		post, appErr := a.postContentReviewBotMessage(rctx, flaggedPost, template, flaggedPost.UserId)
		if appErr != nil {
			rctx.Logger().Error("Failed to post delete post author message after permanently removing flagged post", mlog.Err(appErr), mlog.String("post_id", flaggedPost.Id))
		} else {
			createdPosts = append(createdPosts, post)
		}
	}

	if slices.Contains(deletePostNotifications, model.TargetReporter) {
		template := "The post having ID `%s` in the channel `%s` which you flagged for review has been permanently removed by a reviewer."
		post, appErr := a.postMessageToReporter(rctx, contentFlaggingGroupId, flaggedPost, template)
		if appErr != nil {
			rctx.Logger().Error("Failed to post delete post reporter message after permanently removing flagged post", mlog.Err(appErr), mlog.String("post_id", flaggedPost.Id))
		} else {
			createdPosts = append(createdPosts, post)
		}
	}

	return createdPosts
}

// sendKeepFlaggedPostNotification handles the notifications when flagged post is retained for all audiences - reviewers, author, and reporter as per configuration
func (a *App) sendKeepFlaggedPostNotification(rctx request.CTX, flaggedPost *model.Post, actorUserId, comment, contentFlaggingGroupId string) []*model.Post {
	notificationSettings := a.Config().ContentFlaggingSettings.NotificationSettings
	keepPostNotifications := notificationSettings.EventTargetMapping[model.EventContentDismissed]
	if keepPostNotifications == nil {
		return nil
	}

	var createdPosts []*model.Post

	if slices.Contains(keepPostNotifications, model.TargetReviewers) {
		posts, appErr := a.postKeepPostReviewerMessage(rctx, flaggedPost.Id, actorUserId, comment, contentFlaggingGroupId)
		if appErr != nil {
			rctx.Logger().Error("Failed to post retain post reviewer message after restoring flagged post", mlog.Err(appErr), mlog.String("post_id", flaggedPost.Id))
		} else {
			createdPosts = posts
		}
	}

	if slices.Contains(keepPostNotifications, model.TargetAuthor) {
		template := "Your post having ID `%s` in the channel `%s` which was flagged for review has been restored by a reviewer."
		post, appErr := a.postContentReviewBotMessage(rctx, flaggedPost, template, flaggedPost.UserId)
		if appErr != nil {
			rctx.Logger().Error("Failed to post retain post author message after restoring flagged post", mlog.Err(appErr), mlog.String("post_id", flaggedPost.Id))
		} else {
			createdPosts = append(createdPosts, post)
		}
	}

	if slices.Contains(keepPostNotifications, model.TargetReporter) {
		template := "The post having ID `%s` in the channel `%s` which you flagged for review has been restored by a reviewer."
		post, appErr := a.postMessageToReporter(rctx, contentFlaggingGroupId, flaggedPost, template)
		if appErr != nil {
			rctx.Logger().Error("Failed to post retain post reporter message after restoring flagged post", mlog.Err(appErr), mlog.String("post_id", flaggedPost.Id))
		} else {
			createdPosts = append(createdPosts, post)
		}
	}

	return createdPosts
}
