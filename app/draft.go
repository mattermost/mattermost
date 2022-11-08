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

	return drafts, nil
}

func (a *App) DeleteDraft(userID, channelID, rootID, connectionID string) (*model.Draft, *model.AppError) {
	if !a.Config().FeatureFlags.GlobalDrafts {
		return nil, model.NewAppError("UpsertDraft", "app.draft.feature_disabled", nil, "", http.StatusNotImplemented)
	}

	draft, nErr := a.Srv().Store().Draft().Get(userID, channelID, rootID)
	if nErr != nil {
		return nil, model.NewAppError("DeleteDraft", "app.draft.get.app_error", nil, nErr.Error(), http.StatusBadRequest)
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

	// if len(draft.FileIds) > 0 {
	// 	a.Srv().Go(func() {
	// 		a.deletePostFiles(post.Id)
	// 	})
	// }

	return draft, nil
}
