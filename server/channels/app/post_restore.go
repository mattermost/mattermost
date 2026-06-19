// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) RestorePostVersion(rctx request.CTX, userID, postID, restoreVersionID string) (*model.Post, bool, *model.AppError) {
	// Check if this is a page restore (page versions live in the Pages table, not Posts).
	if pageVersion, pageErr := a.Srv().Store().Page().GetPage(rctx, restoreVersionID, true); pageErr == nil && pageVersion != nil {
		if pageVersion.OriginalId != postID {
			return nil, false, model.NewAppError("RestorePostVersion", "app.post.restore_post_version.not_an_history_item.app_error", nil, "", http.StatusBadRequest)
		}
		if pageVersion.DeleteAt == 0 {
			return nil, false, model.NewAppError("RestorePostVersion", "app.post.restore_post_version.not_valid_post_history_item.app_error", nil, "", http.StatusBadRequest)
		}
		// API layer has already checked page permissions; no ownership check needed here.
		_, appErr := a.RestorePageVersion(rctx, userID, postID, restoreVersionID, pageVersion)
		if appErr != nil {
			return nil, false, appErr
		}
		// Return a minimal synthetic post so the existing API handler can encode a response.
		return &model.Post{Id: postID}, false, nil
	}

	// Regular post restoration path.
	toRestorePostVersion, err := a.Srv().Store().Post().GetSingle(rctx, restoreVersionID, true)
	if err != nil {
		var statusCode int
		var notFoundErr *store.ErrNotFound
		switch {
		case errors.As(err, &notFoundErr):
			statusCode = http.StatusNotFound
		default:
			statusCode = http.StatusInternalServerError
		}

		return nil, false, model.NewAppError("RestorePostVersion", "app.post.restore_post_version.get_single.app_error", nil, "", statusCode).Wrap(err)
	}

	if toRestorePostVersion.OriginalId != postID {
		return nil, false, model.NewAppError("RestorePostVersion", "app.post.restore_post_version.not_an_history_item.app_error", nil, "", http.StatusBadRequest)
	}

	if toRestorePostVersion.UserId != userID {
		return nil, false, model.NewAppError("RestorePostVersion", "app.post.restore_post_version.not_allowed.app_error", nil, "", http.StatusForbidden)
	}

	if toRestorePostVersion.DeleteAt == 0 {
		return nil, false, model.NewAppError("RestorePostVersion", "app.post.restore_post_version.not_valid_post_history_item.app_error", nil, "", http.StatusBadRequest)
	}

	postPatch := &model.PostPatch{
		Message: &toRestorePostVersion.Message,
		FileIds: &toRestorePostVersion.FileIds,
	}

	patchPostOptions := &model.UpdatePostOptions{
		IsRestorePost: true,
	}

	return a.PatchPost(rctx, postID, postPatch, patchPostOptions)
}
