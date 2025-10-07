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
	api.BaseRoutes.ContentFlagging.Handle("/post/{post_id:[A-Za-z0-9]+}/keep", api.APISessionRequired(keepFlaggedPost)).Methods(http.MethodPut)
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

	// A team ID is expected to be specified bny a content reviewer.
	// When specified, we verify that the user is a content reviewer of the team.
	// If the user is indeed a content reviewer, we return the configuration along with some extra fields
	// that only a reviewer should be aware of.
	// If no team ID is specified, we return the configuration as is, without the extra fields.
	// This is the expected usage for non-reviewers.
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

	responseBytes, err := json.Marshal(config)
	if err != nil {
		c.Err = model.NewAppError("getFlaggingConfiguration", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(responseBytes); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
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

	responseBytes, err := json.Marshal(payload)
	if err != nil {
		c.Err = model.NewAppError("getTeamPostFlaggingFeatureStatus", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(responseBytes); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
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

	auditRec := c.MakeAuditRecord(model.AuditEventFlagPost, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	model.AddEventParameterToAuditRec(auditRec, "postId", postId)
	model.AddEventParameterToAuditRec(auditRec, "userId", userId)

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

	auditRec.Success()
	auditRec.AddEventObjectType("post")

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

	responseBytes, err := json.Marshal(mappedFields)
	if err != nil {
		c.Err = model.NewAppError("getContentFlaggingFields", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(responseBytes); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
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
	post, appErr := c.App.GetSinglePost(c.AppContext, postId, true)
	if appErr != nil {
		c.Err = appErr
		return
	}

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

	responseBytes, err := json.Marshal(propertyValues)
	if err != nil {
		c.Err = model.NewAppError("getPostPropertyValues", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(responseBytes); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
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

	auditRec := c.MakeAuditRecord(model.AuditEventGetFlaggedPost, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	model.AddEventParameterToAuditRec(auditRec, "postId", postId)
	model.AddEventParameterToAuditRec(auditRec, "userId", userId)

	post, appErr := c.App.GetSinglePost(c.AppContext, postId, true)
	if appErr != nil {
		c.Err = appErr
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

	// This validates that the post is flagged
	_, appErr = c.App.GetPostContentFlaggingStatusValue(postId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	post = c.App.PreparePostForClientWithEmbedsAndImages(c.AppContext, post, &model.PreparePostForClientOpts{IncludePriority: true, RetainContent: true})
	post, err := c.App.SanitizePostMetadataForUser(c.AppContext, post, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	if err := post.EncodeJSON(w); err != nil {
		c.Err = model.NewAppError("getFlaggedPost", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	auditRec.Success()
}

func removeFlaggedPost(c *Context, w http.ResponseWriter, r *http.Request) {
	actionRequest, userId, post := keepRemoveFlaggedPostChecks(c, r)
	if c.Err != nil {
		c.Err.Where = "removeFlaggedPost"
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventPermanentlyRemoveFlaggedPost, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	model.AddEventParameterToAuditRec(auditRec, "postId", post.Id)
	model.AddEventParameterToAuditRec(auditRec, "userId", userId)

	if appErr := c.App.PermanentDeleteFlaggedPost(c.AppContext, actionRequest, userId, post); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	writeOKResponse(w)
}

func keepFlaggedPost(c *Context, w http.ResponseWriter, r *http.Request) {
	actionRequest, userId, post := keepRemoveFlaggedPostChecks(c, r)
	if c.Err != nil {
		c.Err.Where = "keepFlaggedPost"
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventKeepFlaggedPost, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	model.AddEventParameterToAuditRec(auditRec, "postId", post.Id)
	model.AddEventParameterToAuditRec(auditRec, "userId", userId)

	if appErr := c.App.KeepFlaggedPost(c.AppContext, actionRequest, userId, post); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	writeOKResponse(w)
}

func keepRemoveFlaggedPostChecks(c *Context, r *http.Request) (*model.FlagContentActionRequest, string, *model.Post) {
	requireContentFlaggingEnabled(c)
	if c.Err != nil {
		return nil, "", nil
	}

	c.RequirePostId()
	if c.Err != nil {
		return nil, "", nil
	}

	var actionRequest model.FlagContentActionRequest
	if err := json.NewDecoder(r.Body).Decode(&actionRequest); err != nil {
		c.SetInvalidParamWithErr("flagContentActionRequestBody", err)
		return nil, "", nil
	}

	postId := c.Params.PostId
	userId := c.AppContext.Session().UserId

	post, appErr := c.App.GetSinglePost(c.AppContext, postId, true)
	if appErr != nil {
		c.Err = appErr
		return nil, "", nil
	}

	channel, appErr := c.App.GetChannel(c.AppContext, post.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return nil, "", nil
	}

	isReviewer, appErr := c.App.IsUserTeamContentReviewer(userId, channel.TeamId)
	if appErr != nil {
		c.Err = appErr
		return nil, "", nil
	}

	if !isReviewer {
		c.Err = model.NewAppError("", "api.content_flagging.error.reviewer_only", nil, "", http.StatusForbidden)
		return nil, "", nil
	}

	commentRequired := c.App.Config().ContentFlaggingSettings.AdditionalSettings.ReviewerCommentRequired
	if err := actionRequest.IsValid(*commentRequired); err != nil {
		c.Err = err
		return nil, "", nil
	}

	return &actionRequest, userId, post
}
