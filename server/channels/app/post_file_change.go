// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/public/utils"
)

func (a *App) processPostFileChanges(rctx request.CTX, newPost, oldPost *model.Post, updatePostOptions *model.UpdatePostOptions) (model.StringArray, *model.AppError) {
	newFileIDs := model.RemoveDuplicateStrings(newPost.FileIds)
	oldFileIDs := model.RemoveDuplicateStrings(oldPost.FileIds)

	addedFileIDs, removedFileIDs, unchangedFileIDs := utils.FindExclusives(newFileIDs, oldFileIDs)

	if len(addedFileIDs) > 0 {
		if updatePostOptions != nil && updatePostOptions.IsRestorePost {
			err := a.Srv().Store().FileInfo().RestoreForPostByIds(rctx, newPost.Id, addedFileIDs)
			if err != nil {
				return nil, model.NewAppError("app.processPostFileChanges", "app.file_info.undelete_for_post_ids.app_error", map[string]any{"post_id": newPost.Id}, "", 0).Wrap(err)
			}
		} else {
			a.attachNewFilesToPost(rctx, newPost, addedFileIDs, unchangedFileIDs)
		}
	}

	if len(removedFileIDs) > 0 {
		if appErr := a.detachFilesFromPost(rctx, newPost.Id, removedFileIDs); appErr != nil {
			return nil, appErr
		}
	}

	filesChanged := len(addedFileIDs) > 0 || len(removedFileIDs) > 0
	if filesChanged {
		// if files were modified, invalidate the file metadata cache for the post
		// so that the updated file metadata can be returned.
		a.Srv().Store().FileInfo().InvalidateFileInfosForPostCache(newPost.Id, false)
	}

	return newPost.FileIds, nil
}

func (a *App) attachNewFilesToPost(rctx request.CTX, post *model.Post, addedFileIDs, unchangedFileIDs []string) {
	// for newly added files, we need to attach them to the post

	// intentionally using UserID from session instead of post.UserID
	// to support admin attaching files in someone else's post.
	// Admins can edit other's posts, including message, removing existing files,
	// and attaching new files.
	// When an admin uploads new files, they are associated with their user ID. So, when attaching
	// these file to a post, we need to search for their FileInfo entry
	// by the admin's user ID and not the post author's user ID.
	userId := rctx.Session().UserId
	attachedFileIDs := a.attachFileIDsToPost(rctx, post.Id, post.ChannelId, userId, addedFileIDs)
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
