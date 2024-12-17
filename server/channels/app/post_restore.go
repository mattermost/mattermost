// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"net/http"
)

func (a *App) RestorePostVersion(c request.CTX, userID, postID, restoreVersionID string) (*model.Post, *model.AppError) {
	toRestorePostVersion, err := a.Srv().Store().Post().GetSingle(c, restoreVersionID, true)
	if err != nil {
		return nil, model.NewAppError("RestorePostVersion", "app.post.restore_post_version.get_single.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	// Invalid cases-
	// 1. If the restoreVersionID is not an old version of postId,
	// 2. If the user is not the author of the post,
	// 3. If the restoreVersionID post is not deleted.
	if toRestorePostVersion.OriginalId != postID || toRestorePostVersion.UserId != userID || toRestorePostVersion.DeleteAt == 0 {
		return nil, model.NewAppError("RestorePostVersion", "app.post.restore_post_version.not_allowed.app_error", nil, "", http.StatusForbidden)
	}

	postPatch := &model.PostPatch{
		Message: &toRestorePostVersion.Message,
		FileIds: &toRestorePostVersion.FileIds,
	}

	return a.PatchPost(c, postID, postPatch)
}
