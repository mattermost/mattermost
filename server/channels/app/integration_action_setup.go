// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"
	"maps"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// postActionSetup holds resolved state for one interactive post action before the upstream HTTP call.
type postActionSetup struct {
	upstreamURL          string
	upstreamRequest      *model.PostActionIntegrationRequest
	datasource           string
	retain               map[string]any
	remove               []string
	originalProps        map[string]any
	originalIsPinned     bool
	originalHasReactions bool
	rootPostId           string
	ephemeralInteractive bool
	ephemeralChannelID   string
	ephemeralRootPostID  string
	ephemeralSetUserID   bool
}

func (a *App) resolvePostActionSetup(
	rctx request.CTX,
	postID, actionID, userID string,
	legacyCookie *model.PostActionCookie,
	mmBlocksCookie *model.MmBlocksActionCookie,
	clientQuery map[string]string,
	integrationContext string,
) (*postActionSetup, string, *model.AppError) {
	upstreamRequest := &model.PostActionIntegrationRequest{
		UserId: userID,
		PostId: postID,
	}

	pchan := make(chan store.StoreResult[*model.Post], 1)
	go func() {
		post, err := a.Srv().Store().Post().GetSingle(rctx, postID, false)
		pchan <- store.StoreResult[*model.Post]{Data: post, NErr: err}
		close(pchan)
	}()

	cchan := make(chan store.StoreResult[*model.Channel], 1)
	go func() {
		channel, err := a.Srv().Store().Channel().GetForPost(postID)
		cchan <- store.StoreResult[*model.Channel]{Data: channel, NErr: err}
		close(cchan)
	}()

	postResult := <-pchan
	if postResult.NErr != nil {
		return a.resolvePostActionSetupFromCookies(postID, actionID, legacyCookie, mmBlocksCookie, clientQuery, upstreamRequest, postResult)
	}

	post := postResult.Data
	chResult := <-cchan
	if chResult.NErr != nil {
		return nil, "", model.NewAppError("DoPostActionWithCookie", "app.channel.get_for_post.app_error", nil, "", http.StatusInternalServerError).Wrap(postResult.NErr)
	}

	return a.resolvePostActionSetupFromPost(post, chResult.Data, actionID, clientQuery, integrationContext, upstreamRequest)
}

func (a *App) resolvePostActionSetupFromCookies(
	postID, actionID string,
	legacyCookie *model.PostActionCookie,
	mmBlocksCookie *model.MmBlocksActionCookie,
	clientQuery map[string]string,
	upstreamRequest *model.PostActionIntegrationRequest,
	postResult store.StoreResult[*model.Post],
) (*postActionSetup, string, *model.AppError) {
	if legacyCookie == nil && mmBlocksCookie == nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(postResult.NErr, &nfErr):
			return nil, "", model.NewAppError("DoPostActionWithCookie", "app.post.get.app_error", nil, "", http.StatusNotFound).Wrap(postResult.NErr)
		default:
			return nil, "", model.NewAppError("DoPostActionWithCookie", "app.post.get.app_error", nil, "", http.StatusInternalServerError).Wrap(postResult.NErr)
		}
	}
	if legacyCookie != nil && mmBlocksCookie != nil {
		return nil, "", model.NewAppError("DoPostActionWithCookie", "api.post.do_action.action_integration.app_error", nil, "multiple action cookies set", http.StatusBadRequest)
	}

	var nfPost *store.ErrNotFound
	ephemeral := errors.As(postResult.NErr, &nfPost)

	if legacyCookie != nil {
		return a.setupFromLegacyCookie(postID, legacyCookie, upstreamRequest, ephemeral)
	}
	return a.setupFromMmBlocksCookie(postID, actionID, mmBlocksCookie, clientQuery, upstreamRequest, ephemeral)
}

func (a *App) setupFromLegacyCookie(
	postID string,
	cookie *model.PostActionCookie,
	upstreamRequest *model.PostActionIntegrationRequest,
	ephemeral bool,
) (*postActionSetup, string, *model.AppError) {
	if cookie.Integration == nil {
		return nil, "", model.NewAppError("DoPostActionWithCookie", "api.post.do_action.action_integration.app_error", nil, "no Integration in action cookie", http.StatusBadRequest)
	}
	if postID != cookie.PostId {
		return nil, "", model.NewAppError("DoPostActionWithCookie", "api.post.do_action.action_integration.app_error", nil, "postId doesn't match", http.StatusBadRequest)
	}

	channel, appErr := a.channelForPostAction(cookie.ChannelId)
	if appErr != nil {
		return nil, "", appErr
	}

	fillUpstreamChannel(upstreamRequest, channel, cookie.ChannelId)
	upstreamRequest.Type = cookie.Type
	upstreamRequest.Context = cookie.Integration.Context

	setup := &postActionSetup{
		upstreamURL:          cookie.Integration.URL,
		upstreamRequest:      upstreamRequest,
		datasource:           cookie.DataSource,
		retain:               cookie.RetainProps,
		remove:               cookie.RemoveProps,
		rootPostId:           cookie.RootPostId,
		ephemeralInteractive: ephemeral,
		ephemeralChannelID:   cookie.ChannelId,
		ephemeralRootPostID:  cookie.RootPostId,
		ephemeralSetUserID:   true,
	}
	return setup, "", nil
}

func (a *App) setupFromMmBlocksCookie(
	postID, actionID string,
	cookie *model.MmBlocksActionCookie,
	clientQuery map[string]string,
	upstreamRequest *model.PostActionIntegrationRequest,
	ephemeral bool,
) (*postActionSetup, string, *model.AppError) {
	if cookie.Kind != model.MmBlocksActionCookieKind {
		return nil, "", model.NewAppError("DoPostActionWithCookie", "api.post.do_action.action_integration.app_error", nil, "invalid mm_blocks action cookie", http.StatusBadRequest)
	}
	if postID != cookie.PostId {
		return nil, "", model.NewAppError("DoPostActionWithCookie", "api.post.do_action.action_integration.app_error", nil, "postId doesn't match", http.StatusBadRequest)
	}

	channel, appErr := a.channelForPostAction(cookie.ChannelId)
	if appErr != nil {
		return nil, "", appErr
	}

	mmSpec := cookie.ActionSpec(actionID)
	resolved, err := model.ResolveMmBlocksAction(mmSpec, actionID, clientQuery)
	if appErr := mmBlocksResolveAppError(actionID, err); appErr != nil {
		return nil, "", appErr
	}
	if resolved.OpenURLGoto != "" {
		return nil, resolved.OpenURLGoto, nil
	}

	fillUpstreamChannel(upstreamRequest, channel, cookie.ChannelId)
	upstreamRequest.Type = model.PostActionTypeButton
	upstreamRequest.Context = resolved.Context

	setup := &postActionSetup{
		upstreamURL:          resolved.ExternalURL,
		upstreamRequest:      upstreamRequest,
		retain:               cookie.RetainProps,
		remove:               cookie.RemoveProps,
		rootPostId:           cookie.RootPostId,
		ephemeralInteractive: ephemeral,
		ephemeralChannelID:   cookie.ChannelId,
		ephemeralRootPostID:  cookie.RootPostId,
	}
	return setup, "", nil
}

func (a *App) resolvePostActionSetupFromPost(
	post *model.Post,
	channel *model.Channel,
	actionID string,
	clientQuery map[string]string,
	integrationContext string,
	upstreamRequest *model.PostActionIntegrationRequest,
) (*postActionSetup, string, *model.AppError) {
	fillUpstreamChannel(upstreamRequest, channel, post.ChannelId)

	switch model.NormalizePostActionIntegrationFormat(integrationContext) {
	case model.PostActionIntegrationFormatMmBlock,
		model.PostActionIntegrationFormatBlock,
		model.PostActionIntegrationFormatCard:
		mmSpec := post.GetMmBlocksActionSpec(actionID)
		resolved, err := model.ResolveMmBlocksAction(mmSpec, actionID, clientQuery)
		if appErr := mmBlocksResolveAppError(actionID, err); appErr != nil {
			return nil, "", appErr
		}
		if resolved.OpenURLGoto != "" {
			return nil, resolved.OpenURLGoto, nil
		}

		preserve := post.PostActionPreserveState()
		upstreamRequest.Type = model.PostActionTypeButton
		upstreamRequest.Context = resolved.Context

		return &postActionSetup{
			upstreamURL:          resolved.ExternalURL,
			upstreamRequest:      upstreamRequest,
			retain:               preserve.Retain,
			remove:               preserve.Remove,
			originalProps:        preserve.OriginalProps,
			originalIsPinned:     preserve.OriginalIsPinned,
			originalHasReactions: preserve.OriginalHasReactions,
			rootPostId:           preserve.RootPostId,
		}, "", nil

	case model.PostActionIntegrationFormatAttachment:
		action := post.GetAction(actionID)
		if action == nil || action.Integration == nil {
			return nil, "", model.NewAppError("DoPostActionWithCookie", "api.post.do_action.action_id.app_error", nil, fmt.Sprintf("action=%v", action), http.StatusNotFound)
		}

		preserve := post.PostActionPreserveState()
		upstreamRequest.Type = action.Type
		upstreamRequest.Context = action.Integration.Context

		return &postActionSetup{
			upstreamURL:          action.Integration.URL,
			upstreamRequest:      upstreamRequest,
			datasource:           action.DataSource,
			retain:               preserve.Retain,
			remove:               preserve.Remove,
			originalProps:        preserve.OriginalProps,
			originalIsPinned:     preserve.OriginalIsPinned,
			originalHasReactions: preserve.OriginalHasReactions,
			rootPostId:           preserve.RootPostId,
		}, "", nil
	}

	return nil, "", model.NewAppError("DoPostActionWithCookie", "api.post.do_action.action_id.app_error", nil, fmt.Sprintf("integration_context=%s", integrationContext), http.StatusBadRequest)
}

func fillUpstreamChannel(req *model.PostActionIntegrationRequest, channel *model.Channel, channelID string) {
	req.ChannelId = channelID
	req.ChannelName = channel.Name
	req.TeamId = channel.TeamId
}

func (a *App) channelForPostAction(channelID string) (*model.Channel, *model.AppError) {
	channel, err := a.Srv().Store().Channel().Get(channelID, true)
	if err != nil {
		errCtx := map[string]any{"channel_id": channelID}
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("DoPostActionWithCookie", "app.channel.get.existing.app_error", errCtx, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("DoPostActionWithCookie", "app.channel.get.find.app_error", errCtx, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return channel, nil
}

func mmBlocksResolveAppError(actionID string, err error) *model.AppError {
	if err == nil {
		return nil
	}
	switch {
	case errors.Is(err, model.ErrMmBlocksOpenURLEmpty):
		return model.NewAppError("DoPostActionWithCookie", "api.post.do_action.action_id.app_error", nil, err.Error(), http.StatusNotFound)
	case errors.Is(err, model.ErrMmBlocksActionNotFound):
		return model.NewAppError("DoPostActionWithCookie", "api.post.do_action.action_id.app_error", nil, fmt.Sprintf("mm_blocks action_id=%s", actionID), http.StatusNotFound)
	default:
		return model.NewAppError("DoPostActionWithCookie", "api.post.do_action.action_integration.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
}

func (a *App) applyPostActionUpdate(
	rctx request.CTX,
	setup *postActionSetup,
	postID, userID string,
	update *model.Post,
) *model.AppError {
	update.Id = postID

	if update.GetProps() == nil {
		switch {
		case setup.originalProps != nil:
			update.SetProps(setup.originalProps)
		case setup.ephemeralInteractive && len(setup.retain) > 0:
			props := make(model.StringInterface)
			maps.Copy(props, setup.retain)
			update.SetProps(props)
		default:
			update.SetProps(setup.originalProps)
		}
	} else {
		for key, value := range setup.retain {
			update.AddProp(key, value)
		}
		for _, key := range setup.remove {
			update.DelProp(key)
		}
	}
	update.IsPinned = setup.originalIsPinned
	update.HasReactions = setup.originalHasReactions

	if setup.ephemeralInteractive {
		update.ChannelId = setup.ephemeralChannelID
		if update.RootId == "" && setup.ephemeralRootPostID != "" && setup.ephemeralRootPostID != postID {
			update.RootId = setup.ephemeralRootPostID
		}
		if setup.ephemeralSetUserID && update.UserId == "" {
			update.UserId = userID
		}
		a.UpdateEphemeralPost(rctx, userID, update)
		return nil
	}

	if _, _, appErr := a.UpdatePost(rctx, update, &model.UpdatePostOptions{SafeUpdate: false}); appErr != nil {
		return appErr
	}
	return nil
}
