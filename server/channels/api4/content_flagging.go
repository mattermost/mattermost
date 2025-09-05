// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"slices"

	"github.com/mattermost/mattermost/server/v8/channels/app"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitContentFlagging() {
	if !api.srv.Config().FeatureFlags.ContentFlagging {
		return
	}

	api.BaseRoutes.ContentFlagging.Handle("/flag/config", api.APISessionRequired(getFlaggingConfiguration)).Methods(http.MethodGet)
	api.BaseRoutes.ContentFlagging.Handle("/team/{team_id:[A-Za-z0-9]+}/status", api.APISessionRequired(getTeamPostFlaggingFeatureStatus)).Methods(http.MethodGet)
	api.BaseRoutes.ContentFlagging.Handle("/post/{post_id:[A-Za-z0-9]+}/flag", api.APISessionRequired(flagPost)).Methods(http.MethodPost)
	api.BaseRoutes.ContentFlagging.Handle("/fields", api.APISessionRequired(getContentFlaggingFields)).Methods(http.MethodGet)
	api.BaseRoutes.ContentFlagging.Handle("/post/{post_id:[A-Za-z0-9]+}/field_values", api.APISessionRequired(getPostPropertyValues)).Methods(http.MethodGet)
	api.BaseRoutes.ContentFlagging.Handle("/post/{post_id:[A-Za-z0-9]+}", api.APISessionRequired(getFlaggedPost)).Methods(http.MethodGet)
	api.BaseRoutes.ContentFlagging.Handle("/post/{post_id:[A-Za-z0-9]+}/remove", api.APISessionRequired(removeFlaggedPost)).Methods(http.MethodPut)
}

func requireContentFlaggingEnabled(c *Context) {
	if !model.MinimumEnterpriseAdvancedLicense(c.App.License()) {
		c.Err = model.NewAppError("requireContentFlaggingEnabled", "api.content_flagging.error.license", nil, "", http.StatusNotImplemented)
		return
	}

	contentFlaggingEnabled := c.App.Config().ContentFlaggingSettings.EnableContentFlagging
	if contentFlaggingEnabled == nil || !*contentFlaggingEnabled {
		c.Err = model.NewAppError("requireContentFlaggingEnabled", "api.content_flagging.error.disabled", nil, "", http.StatusNotImplemented)
		return
	}
}

func getFlaggingConfiguration(c *Context, w http.ResponseWriter, r *http.Request) {
	requireContentFlaggingEnabled(c)
	if c.Err != nil {
		return
	}

	teamId := r.URL.Query().Get("team_id")
	asReviewer := false
	if teamId != "" {
		isReviewer, appErr := c.App.IsUserTeamContentReviewer(c.AppContext.Session().UserId, teamId)
		if appErr != nil {
			c.Err = appErr
			return
		}

		if !isReviewer {
			c.Err = model.NewAppError("getFlaggingConfiguration", "api.content_flagging.error.reviewer_only", nil, "", http.StatusForbidden)
			return
		}

		asReviewer = true
	}

	config := getFlaggingConfig(c.App.Config().ContentFlaggingSettings, asReviewer)

	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(config); err != nil {
		mlog.Error("failed to encode content flagging configuration to return API response", mlog.Err(err))
		return
	}
}

func getTeamPostFlaggingFeatureStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	requireContentFlaggingEnabled(c)
	if c.Err != nil {
		return
	}

	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	teamID := c.Params.TeamId
	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamID, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	enabled := app.ContentFlaggingEnabledForTeam(c.App.Config(), teamID)

	payload := map[string]bool{
		"enabled": enabled,
	}
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		mlog.Error("failed to encode content flagging configuration to return API response", mlog.Err(err))
		return
	}
}

func flagPost(c *Context, w http.ResponseWriter, r *http.Request) {
	requireContentFlaggingEnabled(c)
	if c.Err != nil {
		return
	}

	c.RequirePostId()
	if c.Err != nil {
		return
	}

	var flagRequest model.FlagContentRequest
	if err := json.NewDecoder(r.Body).Decode(&flagRequest); err != nil {
		c.SetInvalidParamWithErr("flagPost", err)
		return
	}

	postId := c.Params.PostId
	userId := c.AppContext.Session().UserId

	post, appErr := c.App.GetPostIfAuthorized(c.AppContext, postId, c.AppContext.Session(), false)
	if appErr != nil {
		c.Err = appErr
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, post.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	enabled := app.ContentFlaggingEnabledForTeam(c.App.Config(), channel.TeamId)
	if !enabled {
		c.Err = model.NewAppError("flagPost", "api.content_flagging.error.not_available_on_team", nil, "", http.StatusBadRequest)
		return
	}

	appErr = c.App.FlagPost(c.AppContext, post, channel.TeamId, userId, flagRequest)
	if appErr != nil {
		c.Err = appErr
		return
	}

	writeOKResponse(w)
}

func getFlaggingConfig(contentFlaggingSettings model.ContentFlaggingSettings, asReviewer bool) *model.ContentFlaggingReportingConfig {
	config := &model.ContentFlaggingReportingConfig{
		Reasons:                 contentFlaggingSettings.AdditionalSettings.Reasons,
		ReporterCommentRequired: contentFlaggingSettings.AdditionalSettings.ReporterCommentRequired,
		ReviewerCommentRequired: contentFlaggingSettings.AdditionalSettings.ReviewerCommentRequired,
	}

	if asReviewer {
		config.NotifyReporterOnRemoval = model.NewPointer(slices.Contains(contentFlaggingSettings.NotificationSettings.EventTargetMapping[model.EventContentRemoved], model.TargetReporter))

		config.NotifyReporterOnDismissal = model.NewPointer(slices.Contains(contentFlaggingSettings.NotificationSettings.EventTargetMapping[model.EventContentDismissed], model.TargetReporter))
	}

	return config
}

func getContentFlaggingFields(c *Context, w http.ResponseWriter, r *http.Request) {
	requireContentFlaggingEnabled(c)
	if c.Err != nil {
		return
	}

	groupId, appErr := c.App.ContentFlaggingGroupId()
	if appErr != nil {
		c.Err = appErr
		return
	}

	mappedFields, appErr := c.App.GetContentFlaggingMappedFields(groupId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(mappedFields); err != nil {
		mlog.Error("failed to encode content flagging configuration to return API response", mlog.Err(err))
		return
	}
}

func getPostPropertyValues(c *Context, w http.ResponseWriter, r *http.Request) {
	requireContentFlaggingEnabled(c)
	if c.Err != nil {
		return
	}

	c.RequirePostId()
	if c.Err != nil {
		return
	}

	// The requesting user must be a reviewer of the post's team
	// to be able to fetch the post's Content Flagging property values
	postId := c.Params.PostId
	posts, _, appErr := c.App.GetPostsByIds([]string{postId})
	if appErr != nil {
		c.Err = appErr
		return
	}

	if len(posts) == 0 {
		c.Err = model.NewAppError("getPostPropertyValues", "app.post.get.app_error", nil, "", http.StatusNotFound)
		return
	}

	post := posts[0]
	channel, appErr := c.App.GetChannel(c.AppContext, post.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	userId := c.AppContext.Session().UserId
	isReviewer, appErr := c.App.IsUserTeamContentReviewer(userId, channel.TeamId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if !isReviewer {
		c.Err = model.NewAppError("getPostPropertyValues", "api.content_flagging.error.reviewer_only", nil, "", http.StatusForbidden)
		return
	}

	propertyValues, appErr := c.App.GetPostContentFlaggingPropertyValues(postId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(propertyValues); err != nil {
		mlog.Error("failed to encode content flagging configuration to return API response", mlog.Err(err))
		return
	}
}

func getFlaggedPost(c *Context, w http.ResponseWriter, r *http.Request) {
	requireContentFlaggingEnabled(c)
	if c.Err != nil {
		return
	}

	c.RequirePostId()
	if c.Err != nil {
		return
	}

	// A user can obtain a flagged post if-
	// 1. The post is currently flagged and in any status
	// 2. The user is a reviewer of the post's team

	// check if user is a reviewer of the post's team
	postId := c.Params.PostId
	userId := c.AppContext.Session().UserId

	post, appErr := c.App.GetSinglePost(c.AppContext, postId, true)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if post == nil {
		c.Err = model.NewAppError("getFlaggedPost", "app.post.get.app_error", nil, "", http.StatusNotFound)
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, post.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	isReviewer, appErr := c.App.IsUserTeamContentReviewer(userId, channel.TeamId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if !isReviewer {
		c.Err = model.NewAppError("getFlaggedPost", "api.content_flagging.error.reviewer_only", nil, "", http.StatusForbidden)
		return
	}

	status, appErr := c.App.GetPostContentFlaggingStatusValue(postId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if status == nil {
		c.Err = model.NewAppError("getFlaggedPost", "api.content_flagging.error.post_not_flagged", nil, "", http.StatusNotFound)
		return
	}

	post = c.App.PreparePostForClientWithEmbedsAndImages(c.AppContext, post, &model.PreparePostForClientOpts{IncludePriority: true, RetainContent: true})
	post, err := c.App.SanitizePostMetadataForUser(c.AppContext, post, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	if err := post.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func removeFlaggedPost(c *Context, w http.ResponseWriter, r *http.Request) {
	requireContentFlaggingEnabled(c)
	if c.Err != nil {
		return
	}

	c.RequirePostId()
	if c.Err != nil {
		return
	}

	postId := c.Params.PostId
	userId := c.AppContext.Session().UserId

	post, appErr := c.App.GetSinglePost(c.AppContext, postId, true)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if post == nil {
		c.Err = model.NewAppError("removeFlaggedPost", "app.post.get.app_error", nil, "", http.StatusNotFound)
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, post.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	isReviewer, appErr := c.App.IsUserTeamContentReviewer(userId, channel.TeamId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	status, appErr := c.App.GetPostContentFlaggingStatusValue(postId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if status == nil {
		c.Err = model.NewAppError("getFlaggedPost", "api.content_flagging.error.post_not_flagged", nil, "", http.StatusNotFound)
		return
	}

	if !isReviewer {
		c.Err = model.NewAppError("removeFlaggedPost", "api.content_flagging.error.reviewer_only", nil, "", http.StatusForbidden)
		return
	}

	if appErr := c.App.PermanentDeleteFlaggedPost(c.AppContext, userId, post); appErr != nil {
		c.Err = appErr
		return
	}

	writeOKResponse(w)
}
