// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/public/utils"
)

func (a *App) processPostFileChanges(rctx request.CTX, newPost, oldPost *model.Post) *model.AppError {
	newFileIDs := model.RemoveDuplicateStrings(newPost.FileIds)
	oldFileIDs := model.RemoveDuplicateStrings(oldPost.FileIds)

	addedFileIDs, removedFileIDs, unchangedFileIDs := utils.FindExclusives(newFileIDs, oldFileIDs)
	// TODO: probably need to invalidate posts' file metadata cache here if some files were added or removed - probably via InvalidateFileInfosForPostCache and the in-memory cache

	if len(addedFileIDs) > 0 {
		a.attachNewFilesToPost(rctx, newPost, addedFileIDs, unchangedFileIDs)
	}

	if len(removedFileIDs) > 0 {
		if appErr := a.detachFilesFromPost(rctx, newPost.Id, removedFileIDs); appErr != nil {
			return appErr
		}
	}

	filesChanged := len(addedFileIDs) > 0 || len(removedFileIDs) > 0
	if filesChanged {
		// if files were modified, invalidate the file metadata cache for the post
		// so that the updated file metadata can be returned.
		a.Srv().Store().FileInfo().InvalidateFileInfosForPostCache(newPost.Id, false)
	}

	return nil
}

func (a *App) attachNewFilesToPost(rctx request.CTX, post *model.Post, addedFileIDs, unchangedFileIDs []string) {
	// for newly added files, we need to attach them to the post
	attachedFileIDs := a.attachFileIDsToPost(rctx, post.Id, post.ChannelId, post.UserId, addedFileIDs)
	if len(attachedFileIDs) != len(addedFileIDs) {
		// if not all files could be attached, the final list of files
		// is those that could be attached + the existing, unchanged files
		post.FileIds = append(attachedFileIDs, unchangedFileIDs...)
	}
}

func (a *App) detachFilesFromPost(rctx request.CTX, postId string, removedFileIDs []string) *model.AppError {
	if err := a.Srv().Store().FileInfo().DeleteForPostByIds(rctx, postId, removedFileIDs); err != nil {
		return model.NewAppError("app.detachFilesFromPost", "app.file_info.delete_for_post_ids.app_error", map[string]any{"post_id": postId}, "", 0).Wrap(err)
	}

	return nil
}
