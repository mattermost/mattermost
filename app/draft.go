// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

func (a *App) GetDraft(userID, channelID, rootID string) (*model.Draft, *model.AppError) {
	if !a.Config().FeatureFlags.GlobalDrafts {
		return nil, model.NewAppError("UpsertDraft", "app.draft.feature_disabled", nil, "", http.StatusNotImplemented)
	}

	draft, err := a.Srv().Store().Draft().Get(userID, channelID, rootID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetDraft", "app.draft.get.app_error", nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("GetDraft", "app.draft.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return draft, nil
}

func (a *App) UpsertDraft(c *request.Context, draft *model.Draft, connectionID string) (*model.Draft, *model.AppError) {
	if !a.Config().FeatureFlags.GlobalDrafts {
		return nil, model.NewAppError("UpsertDraft", "app.draft.feature_disabled", nil, "", http.StatusNotImplemented)
	}

	dt, dErr := a.Srv().Store().Draft().Get(draft.UserId, draft.ChannelId, draft.RootId)
	var notFoundErr *store.ErrNotFound
	if dErr != nil && !errors.As(dErr, &notFoundErr) {
		return nil, model.NewAppError("UpsertDraft", "app.select_error", nil, dErr.Error(), http.StatusInternalServerError)
	}

	var err *model.AppError
	if dt == nil {
		dt, err = a.CreateDraft(c, draft, connectionID)
		if err != nil {
			var nfErr *store.ErrNotFound
			var appErr *model.AppError
			switch {
			case errors.As(err, &appErr):
				return nil, appErr
			case errors.As(err, &nfErr):
				return nil, model.NewAppError("UpsertDraft", "store.sql_channel.get.existing.app_error", nil, nfErr.Error(), http.StatusNotFound)
			default:
				return nil, model.NewAppError("UpsertDraft", "app.insert_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}
	} else {
		dt, err = a.UpdateDraft(c, draft, connectionID)
		if err != nil {
			var appErr *model.AppError
			switch {
			case errors.As(err, &appErr):
				return nil, appErr
			default:
				return nil, model.NewAppError("UpsertGroupSyncable", "app.update_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}
	}

	return dt, nil
}

func (a *App) CreateDraft(c *request.Context, draft *model.Draft, connectionID string) (*model.Draft, *model.AppError) {
	if !a.Config().FeatureFlags.GlobalDrafts {
		return nil, model.NewAppError("UpsertDraft", "app.draft.feature_disabled", nil, "", http.StatusNotImplemented)
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
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("CreateDraft", MissingAccountError, nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("CreateDraft", "app.user.get.app_error", nil, nErr.Error(), http.StatusInternalServerError)
		}
	}

	dt, nErr := a.Srv().Store().Draft().Save(draft)
	if nErr != nil {
		var appErr *model.AppError
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(nErr, &appErr):
			return nil, appErr
		case errors.As(nErr, &invErr):
			return nil, model.NewAppError("CreateDraft", "app.draft.save.existing.app_error", nil, invErr.Error(), http.StatusBadRequest)
		default:
			return nil, model.NewAppError("CreateDraft", "app.draft.save.app_error", nil, nErr.Error(), http.StatusInternalServerError)
		}
	}

	dt, dErr := a.PrepareDraftWithFileInfos(dt)
	if dErr != nil {
		model.NewAppError("PrepareDraftWithFileInfos", "app.draft.prepare_draft_with_file_infos.app_error", nil, dErr.Error(), http.StatusInternalServerError)
	}

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
		err := model.NewAppError("CreateDraft", "api.context.invalid_param.app_error", map[string]interface{}{"Name": "draft.channel_id"}, errCh.Error(), http.StatusBadRequest)
		return nil, err
	}

	if channel.DeleteAt != 0 {
		err := model.NewAppError("CreateDraft", "api.draft.create_draft.can_not_draft_to_deleted.error", nil, "", http.StatusBadRequest)
		return nil, err
	}

	_, nErr := a.Srv().Store().User().Get(context.Background(), draft.UserId)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("CreateDraft", MissingAccountError, nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("CreateDraft", "app.user.get.app_error", nil, nErr.Error(), http.StatusInternalServerError)
		}
	}

	dt, nErr := a.Srv().Store().Draft().Update(draft)
	if nErr != nil {
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("UpdateDraft", "app.draft.update.app_error", nil, nErr.Error(), http.StatusInternalServerError)
		}
	}

	dt, dErr := a.PrepareDraftWithFileInfos(dt)
	if dErr != nil {
		model.NewAppError("PrepareDraftWithFileInfos", "app.draft.prepare_draft_with_file_infos.app_error", nil, dErr.Error(), http.StatusInternalServerError)
	}

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
	if !a.Config().FeatureFlags.GlobalDrafts {
		return nil, model.NewAppError("UpsertDraft", "app.draft.feature_disabled", nil, "", http.StatusNotImplemented)
	}

	drafts, err := a.Srv().Store().Draft().GetDraftsForUser(userID, teamID)

	if err != nil {
		return nil, model.NewAppError("GetDraftsForUser", "app.draft.get_drafts.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, draft := range drafts {
		a.PrepareDraftWithFileInfos(draft)
	}
	return drafts, nil
}

func (a *App) PrepareDraftWithFileInfos(draft *model.Draft) (*model.Draft, *model.AppError) {
	if fileInfos, err := a.GetFileInfosForDraft(draft); err != nil {
		mlog.Warn("Failed to get files for drafts", mlog.Err(err))
	} else {
		if len(draft.DeletedFileIds) > 0 {
			if dErr := a.Srv().Store().FileInfo().DeleteForDraft(draft.DeletedFileIds); dErr != nil {
				return nil, model.NewAppError("PrepareDraftWithFileInfos", "app.draft.prepare_draft_with_file_infos.app_error", nil, err.Error(), http.StatusInternalServerError)
			}

			draft.DeletedFileIds = nil
		}

		dErr := a.DeleteFileInfos(draft.DeletedFileIds)
		if dErr != nil {
			return nil, dErr
		}

		draft.DeletedFileIds = nil

		draft.Metadata = &model.PostMetadata{}
		draft.Metadata.Files = fileInfos
	}

	return draft, nil
}

func (a *App) GetFileInfosForDraft(draft *model.Draft) ([]*model.FileInfo, *model.AppError) {
	if len(draft.FileIds) == 0 {
		return nil, nil
	}

	fileInfos, err := a.Srv().Store().FileInfo().GetByIds(draft.FileIds)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetFileInfosForDraft", "app.draft.get_files_for_draft.app_error", nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("GetFileInfosForDraft", "app.draft.get_files_for_draft.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	a.generateMiniPreviewForInfos(fileInfos)

	return fileInfos, nil
}

func (a *App) DeleteFileInfos(fileIds model.StringArray) *model.AppError {
	if len(fileIds) > 0 {
		err := a.Srv().Store().FileInfo().DeleteForDraft(fileIds)

		if err != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(err, &nfErr):
				return model.NewAppError("DeleteFileInfosForDraft", "app.draft.delete_for_draft.app_error", nil, nfErr.Error(), http.StatusNotFound)
			default:
				return model.NewAppError("DeleteFileInfosForDraft", "app.draft.delete_for_draft.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}
	}

	return nil
}

func (a *App) DeleteDraft(userID, channelID, rootID, connectionID string) (*model.Draft, *model.AppError) {
	if !a.Config().FeatureFlags.GlobalDrafts {
		return nil, model.NewAppError("UpsertDraft", "app.draft.feature_disabled", nil, "", http.StatusNotImplemented)
	}

	draft, nErr := a.Srv().Store().Draft().Get(userID, channelID, rootID)
	if nErr != nil {
		return nil, model.NewAppError("DeleteDraft", "app.draft.get.app_error", nil, nErr.Error(), http.StatusBadRequest)
	}

	dErr := a.DeleteFileInfos(draft.FileIds)
	if dErr != nil {
		return nil, dErr
	}

	if err := a.Srv().Store().Draft().Delete(userID, channelID, rootID); err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("DeleteDraft", "app.draft.delete.app_error", nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("DeleteDraft", "app.draft.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
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
