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

func (a *App) RestorePostVersion(c request.CTX, userID, postID, restoreVersionID string) (*model.Post, *model.AppError) {
	toRestorePostVersion, err := a.Srv().Store().Post().GetSingle(c, restoreVersionID, true)
	if err != nil {
		var statusCode int
		var notFoundErr *store.ErrNotFound
		switch {
		case errors.As(err, &notFoundErr):
			statusCode = http.StatusNotFound
		default:
			statusCode = http.StatusInternalServerError
		}

		return nil, model.NewAppError("RestorePostVersion", "app.post.restore_post_version.get_single.app_error", nil, err.Error(), statusCode)
	}

	// restoreVersionID needs to be an old version of postID
	// this is only a safeguard and this should never happen in practice.
	if toRestorePostVersion.OriginalId != postID {
		return nil, model.NewAppError("RestorePostVersion", "app.post.restore_post_version.not_an_history_item.app_error", nil, "", http.StatusBadRequest)
	}

	// the user needs to be the author of the post
	// this is only a safeguard and this should never happen in practice.
	if toRestorePostVersion.UserId != userID {
		return nil, model.NewAppError("RestorePostVersion", "app.post.restore_post_version.not_allowed.app_error", nil, "", http.StatusForbidden)
	}

	// the old version of post needs to be a deleted post
	if toRestorePostVersion.DeleteAt == 0 {
		return nil, model.NewAppError("RestorePostVersion", "app.post.restore_post_version.not_valid_post_history_item.app_error", nil, "", http.StatusBadRequest)
	}

	postPatch := &model.PostPatch{
		Message: &toRestorePostVersion.Message,
		FileIds: &toRestorePostVersion.FileIds,
	}

	patchPostOptions := &model.UpdatePostOptions{
		IsRestorePost: true,
	}

	return a.PatchPost(c, postID, postPatch, patchPostOptions)
}
