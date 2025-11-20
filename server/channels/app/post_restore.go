// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) RestorePostVersion(rctx request.CTX, userID, postID, restoreVersionID string) (*model.Post, *model.AppError) {
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

		return nil, model.NewAppError("RestorePostVersion", "app.post.restore_post_version.get_single.app_error", nil, "", statusCode).Wrap(err)
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

	// Check if this is a page - pages require special handling for PageContents
	if toRestorePostVersion.Type == model.PostTypePage {
		return a.RestorePageVersion(rctx, userID, postID, restoreVersionID, toRestorePostVersion)
	}

	// Regular post restoration
	postPatch := &model.PostPatch{
		Message: &toRestorePostVersion.Message,
		FileIds: &toRestorePostVersion.FileIds,
	}

	patchPostOptions := &model.UpdatePostOptions{
		IsRestorePost: true,
	}

	return a.PatchPost(rctx, postID, postPatch, patchPostOptions)
}

func (a *App) RestorePageVersion(
	rctx request.CTX,
	userID, pageID, restoreVersionID string,
	toRestorePostVersion *model.Post,
) (*model.Post, *model.AppError) {
	// Step 1: Restore Post metadata (title in Props, FileIds)
	postPatch := &model.PostPatch{
		Props:   &toRestorePostVersion.Props, // Restores title
		FileIds: &toRestorePostVersion.FileIds,
	}

	patchPostOptions := &model.UpdatePostOptions{
		IsRestorePost: true,
	}

	updatedPost, patchErr := a.PatchPost(rctx, pageID, postPatch, patchPostOptions)
	if patchErr != nil {
		return nil, patchErr
	}

	// Step 2: Restore PageContents from historical PageContents table
	// The historical PageContents has PageId = restoreVersionID (historical Post ID)
	historicalContent, storeErr := a.Srv().Store().PageContent().GetWithDeleted(restoreVersionID)
	if storeErr != nil {
		var notFoundErr *store.ErrNotFound
		if errors.As(storeErr, &notFoundErr) {
			// If no historical content exists, log warning but don't fail
			// (metadata still restored successfully)
			rctx.Logger().Warn("Failed to get historical page content - metadata restored but content unchanged",
				mlog.String("page_id", pageID),
				mlog.String("restore_version_id", restoreVersionID))
			return updatedPost, nil
		}
		return nil, model.NewAppError("RestorePageVersion",
			"app.page.restore.get_content.app_error", nil, "",
			http.StatusInternalServerError).Wrap(storeErr)
	}

	// Step 3: Update current PageContents with historical content
	// Use UpdatePageWithContent to ensure proper versioning
	contentJSON, jsonErr := historicalContent.GetDocumentJSON()
	if jsonErr != nil {
		return nil, model.NewAppError("RestorePageVersion",
			"app.page.restore.serialize_content.app_error", nil, "",
			http.StatusInternalServerError).Wrap(jsonErr)
	}

	// UpdatePageWithContent will create a new version automatically
	_, storeErr = a.Srv().Store().Page().UpdatePageWithContent(
		rctx, pageID, "", contentJSON, historicalContent.SearchText)
	if storeErr != nil {
		return nil, model.NewAppError("RestorePageVersion",
			"app.page.restore.update_content.app_error", nil, "",
			http.StatusInternalServerError).Wrap(storeErr)
	}

	return updatedPost, nil
}
