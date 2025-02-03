// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (a *App) GetDraft(userID, channelID, rootID string) (*model.Draft, *model.AppError) {
	if !*a.Config().ServiceSettings.AllowSyncedDrafts {
		return nil, model.NewAppError("GetDraft", "app.draft.feature_disabled", nil, "", http.StatusNotImplemented)
	}

	draft, err := a.Srv().Store().Draft().Get(userID, channelID, rootID, false)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetDraft", "app.draft.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetDraft", "app.draft.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return draft, nil
}

func (a *App) UpsertDraft(c request.CTX, draft *model.Draft, connectionID string) (*model.Draft, *model.AppError) {
	if !*a.Config().ServiceSettings.AllowSyncedDrafts {
		return nil, model.NewAppError("CreateDraft", "app.draft.feature_disabled", nil, "", http.StatusNotImplemented)
	}

	// Check that channel exists and has not been deleted
	channel, errCh := a.Srv().Store().Channel().Get(draft.ChannelId, true)
	if errCh != nil {
		err := model.NewAppError("CreateDraft", "api.context.invalid_param.app_error", map[string]any{"Name": "draft.channel_id"}, "", http.StatusBadRequest).Wrap(errCh)
		return nil, err
	}

	if channel.DeleteAt != 0 {
		err := model.NewAppError("CreateDraft", "api.draft.create_draft.can_not_draft_to_deleted.error", nil, "", http.StatusBadRequest)
		return nil, err
	}

	_, nErr := a.Srv().Store().User().Get(context.Background(), draft.UserId)
	if nErr != nil {
		return nil, model.NewAppError("CreateDraft", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	// If the draft is empty, just delete it
	if draft.Message == "" {
		deleteErr := a.Srv().Store().Draft().Delete(draft.UserId, draft.ChannelId, draft.RootId)
		if deleteErr != nil {
			return nil, model.NewAppError("CreateDraft", "app.draft.save.app_error", nil, "", http.StatusInternalServerError).Wrap(deleteErr)
		}
		return nil, nil
	}

	dt, nErr := a.Srv().Store().Draft().Upsert(draft)
	if nErr != nil {
		return nil, model.NewAppError("CreateDraft", "app.draft.save.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	dt = a.prepareDraftWithFileInfos(c, draft.UserId, dt)

	message := model.NewWebSocketEvent(model.WebsocketEventDraftCreated, "", dt.ChannelId, dt.UserId, nil, connectionID)
	draftJSON, jsonErr := json.Marshal(dt)
	if jsonErr != nil {
		c.Logger().Warn("Failed to encode draft to JSON", mlog.Err(jsonErr))
	}
	message.Add("draft", string(draftJSON))
	a.Publish(message)

	return dt, nil
}

func (a *App) GetDraftsForUser(rctx request.CTX, userID, teamID string) ([]*model.Draft, *model.AppError) {
	if !*a.Config().ServiceSettings.AllowSyncedDrafts {
		return nil, model.NewAppError("GetDraftsForUser", "app.draft.feature_disabled", nil, "", http.StatusNotImplemented)
	}

	drafts, err := a.Srv().Store().Draft().GetDraftsForUser(userID, teamID)

	if err != nil {
		return nil, model.NewAppError("GetDraftsForUser", "app.draft.get_drafts.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, draft := range drafts {
		a.prepareDraftWithFileInfos(rctx, userID, draft)
	}
	return drafts, nil
}

func (a *App) prepareDraftWithFileInfos(rctx request.CTX, userID string, draft *model.Draft) *model.Draft {
	if fileInfos, err := a.getFileInfosForDraft(rctx, draft); err != nil {
		rctx.Logger().Error("Failed to get files for a user's drafts", mlog.String("user_id", userID), mlog.Err(err))
	} else {
		draft.Metadata = &model.PostMetadata{}
		draft.Metadata.Files = fileInfos
	}

	return draft
}

func (a *App) getFileInfosForDraft(rctx request.CTX, draft *model.Draft) ([]*model.FileInfo, *model.AppError) {
	if len(draft.FileIds) == 0 {
		return nil, nil
	}

	allFileInfos, err := a.Srv().Store().FileInfo().GetByIds(draft.FileIds, false, true)
	if err != nil {
		return nil, model.NewAppError("GetFileInfosForDraft", "app.draft.get_for_draft.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	fileInfos := []*model.FileInfo{}
	for _, fileInfo := range allFileInfos {
		if fileInfo.PostId == "" && fileInfo.CreatorId == draft.UserId {
			fileInfos = append(fileInfos, fileInfo)
		} else {
			rctx.Logger().Debug("Invalid file id in draft", mlog.String("file_id", fileInfo.Id), mlog.String("user_id", draft.UserId))
		}
	}

	if len(fileInfos) == 0 {
		return nil, nil
	}

	a.generateMiniPreviewForInfos(rctx, fileInfos)

	return fileInfos, nil
}

func (a *App) DeleteDraft(rctx request.CTX, draft *model.Draft, connectionID string) *model.AppError {
	if !*a.Config().ServiceSettings.AllowSyncedDrafts {
		return model.NewAppError("DeleteDraft", "app.draft.feature_disabled", nil, "", http.StatusNotImplemented)
	}

	if err := a.Srv().Store().Draft().Delete(draft.UserId, draft.ChannelId, draft.RootId); err != nil {
		return model.NewAppError("DeleteDraft", "app.draft.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	draftJSON, jsonErr := json.Marshal(draft)
	if jsonErr != nil {
		rctx.Logger().Warn("Failed to encode draft to JSON")
	}

	message := model.NewWebSocketEvent(model.WebsocketEventDraftDeleted, "", draft.ChannelId, draft.UserId, nil, connectionID)
	message.Add("draft", string(draftJSON))
	a.Publish(message)

	return nil
}
