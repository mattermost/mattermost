// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost-server/server/v7/channels/app/request"
	"github.com/mattermost/mattermost-server/server/v7/channels/store"
	"github.com/mattermost/mattermost-server/server/v7/model"
	"github.com/mattermost/mattermost-server/server/v7/platform/shared/mlog"
)

func (a *App) GetDraft(userID, channelID, rootID string) (*model.Draft, *model.AppError) {
	if !a.Config().FeatureFlags.GlobalDrafts || !*a.Config().ServiceSettings.AllowSyncedDrafts {
		return nil, model.NewAppError("GetDraft", "app.draft.feature_disabled", nil, "", http.StatusNotImplemented)
	}

	draft, err := a.Srv().Store().Draft().Get(userID, channelID, rootID, false)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetDraft", "app.draft.get.app_error", nil, err.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("GetDraft", "app.draft.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return draft, nil
}

func (a *App) UpsertDraft(c *request.Context, draft *model.Draft, connectionID string) (*model.Draft, *model.AppError) {
	if !a.Config().FeatureFlags.GlobalDrafts || !*a.Config().ServiceSettings.AllowSyncedDrafts {
		return nil, model.NewAppError("UpsertDraft", "app.draft.feature_disabled", nil, "", http.StatusNotImplemented)
	}

	dt, dErr := a.Srv().Store().Draft().Get(draft.UserId, draft.ChannelId, draft.RootId, true)
	var notFoundErr *store.ErrNotFound
	if dErr != nil && !errors.As(dErr, &notFoundErr) {
		return nil, model.NewAppError("UpsertDraft", "app.select_error", nil, dErr.Error(), http.StatusInternalServerError)
	}

	var err *model.AppError
	if dt == nil {
		dt, err = a.CreateDraft(c, draft, connectionID)
		if err != nil {
			return nil, err
		}
	} else {
		dt, err = a.UpdateDraft(c, draft, connectionID)
		if err != nil {
			return nil, err
		}
	}

	return dt, nil
}

func (a *App) CreateDraft(c *request.Context, draft *model.Draft, connectionID string) (*model.Draft, *model.AppError) {
	if !a.Config().FeatureFlags.GlobalDrafts || !*a.Config().ServiceSettings.AllowSyncedDrafts {
		return nil, model.NewAppError("CreateDraft", "app.draft.feature_disabled", nil, "", http.StatusNotImplemented)
	}

	// Check that channel exists and has not been deleted
	channel, errCh := a.Srv().Store().Channel().Get(draft.ChannelId, true)
	if errCh != nil {
		err := model.NewAppError("CreateDraft", "api.context.invalid_param.app_error", map[string]interface{}{"Name": "draft.channel_id"}, errCh.Error(), http.StatusBadRequest)
		return nil, err
	}

	if channel.DeleteAt != 0 {
		err := model.NewAppError("CreateDraft", "api.draft.create_draft.can_not_draft_to_deleted.error", nil, "", http.StatusBadRequest)
		return nil, err
	}

	_, nErr := a.Srv().Store().User().Get(context.Background(), draft.UserId)
	if nErr != nil {
		return nil, model.NewAppError("CreateDraft", "app.user.get.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}

	dt, nErr := a.Srv().Store().Draft().Save(draft)
	if nErr != nil {
		return nil, model.NewAppError("CreateDraft", "app.draft.save.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}

	dt = a.prepareDraftWithFileInfos(draft.UserId, dt)

	message := model.NewWebSocketEvent(model.WebsocketEventDraftCreated, "", dt.ChannelId, dt.UserId, nil, connectionID)
	draftJSON, jsonErr := json.Marshal(dt)
	if jsonErr != nil {
		mlog.Warn("Failed to encode draft to JSON", mlog.Err(jsonErr))
	}
	message.Add("draft", string(draftJSON))
	a.Publish(message)

	return dt, nil
}

func (a *App) UpdateDraft(c *request.Context, draft *model.Draft, connectionID string) (*model.Draft, *model.AppError) {
	if !a.Config().FeatureFlags.GlobalDrafts {
		return nil, model.NewAppError("UpsertDraft", "app.draft.feature_disabled", nil, "", http.StatusNotImplemented)
	}

	// Check that channel exists and has not been deleted
	channel, errCh := a.Srv().Store().Channel().Get(draft.ChannelId, true)
	if errCh != nil {
		err := model.NewAppError("UpdateDraft", "api.context.invalid_param.app_error", map[string]interface{}{"Name": "draft.channel_id"}, errCh.Error(), http.StatusBadRequest)
		return nil, err
	}

	if channel.DeleteAt != 0 {
		err := model.NewAppError("UpdateDraft", "api.draft.create_draft.can_not_draft_to_deleted.error", nil, "", http.StatusBadRequest)
		return nil, err
	}

	_, nErr := a.Srv().Store().User().Get(context.Background(), draft.UserId)
	if nErr != nil {
		return nil, model.NewAppError("UpdateDraft", "app.user.get.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}

	dt, nErr := a.Srv().Store().Draft().Update(draft)
	if nErr != nil {
		return nil, model.NewAppError("UpdateDraft", "app.draft.update.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}

	dt = a.prepareDraftWithFileInfos(draft.UserId, dt)

	message := model.NewWebSocketEvent(model.WebsocketEventDraftUpdated, "", draft.ChannelId, draft.UserId, nil, connectionID)
	draftJSON, jsonErr := json.Marshal(dt)
	if jsonErr != nil {
		mlog.Warn("Failed to encode draft to JSON", mlog.Err(jsonErr))
	}
	message.Add("draft", string(draftJSON))
	a.Publish(message)

	return dt, nil
}

func (a *App) GetDraftsForUser(userID, teamID string) ([]*model.Draft, *model.AppError) {
	if !a.Config().FeatureFlags.GlobalDrafts || !*a.Config().ServiceSettings.AllowSyncedDrafts {
		return nil, model.NewAppError("GetDraftsForUser", "app.draft.feature_disabled", nil, "", http.StatusNotImplemented)
	}

	drafts, err := a.Srv().Store().Draft().GetDraftsForUser(userID, teamID)

	if err != nil {
		return nil, model.NewAppError("GetDraftsForUser", "app.draft.get_drafts.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, draft := range drafts {
		a.prepareDraftWithFileInfos(userID, draft)
	}
	return drafts, nil
}

func (a *App) prepareDraftWithFileInfos(userID string, draft *model.Draft) *model.Draft {
	if fileInfos, err := a.getFileInfosForDraft(draft); err != nil {
		mlog.Error("Failed to get files for a user's drafts", mlog.String("user_id", userID), mlog.Err(err))
	} else {
		draft.Metadata = &model.PostMetadata{}
		draft.Metadata.Files = fileInfos
	}

	return draft
}

func (a *App) getFileInfosForDraft(draft *model.Draft) ([]*model.FileInfo, *model.AppError) {
	if len(draft.FileIds) == 0 {
		return nil, nil
	}

	fileInfos, err := a.Srv().Store().FileInfo().GetByIds(draft.FileIds)
	if err != nil {
		return nil, model.NewAppError("GetFileInfosForDraft", "app.draft.get_for_draft.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.generateMiniPreviewForInfos(fileInfos)

	return fileInfos, nil
}

func (a *App) DeleteDraft(userID, channelID, rootID, connectionID string) (*model.Draft, *model.AppError) {
	if !a.Config().FeatureFlags.GlobalDrafts || !*a.Config().ServiceSettings.AllowSyncedDrafts {
		return nil, model.NewAppError("DeleteDraft", "app.draft.feature_disabled", nil, "", http.StatusNotImplemented)
	}

	draft, nErr := a.Srv().Store().Draft().Get(userID, channelID, rootID, false)
	if nErr != nil {
		return nil, model.NewAppError("DeleteDraft", "app.draft.get.app_error", nil, nErr.Error(), http.StatusBadRequest)
	}

	if err := a.Srv().Store().Draft().Delete(userID, channelID, rootID); err != nil {
		return nil, model.NewAppError("DeleteDraft", "app.draft.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	draftJSON, jsonErr := json.Marshal(draft)
	if jsonErr != nil {
		mlog.Warn("Failed to encode draft to JSON")
	}

	message := model.NewWebSocketEvent(model.WebsocketEventDraftDeleted, "", draft.ChannelId, draft.UserId, nil, connectionID)
	message.Add("draft", string(draftJSON))
	a.Publish(message)

	return draft, nil
}
