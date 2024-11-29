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

	addedFiles, , unchangedFiles := utils.FindExclusives(newFileIDs, oldFileIDs)
	// TODO handle removed files here
	// TODO: probably need to invalidate posts' file metadata cache here if some files were added or removed - probably via InvalidateFileInfosForPostCache and the in-memory cache

	if len(addedFiles) > 0 {
		a.attachNewFilesToPost(rctx, newPost, addedFiles, unchangedFiles)
	}
	return nil
}

func (a *App) attachNewFilesToPost(rctx request.CTX, post *model.Post, addedFiles, unchangedFiles []string) {
	// for newly added files, we need to attach them to the post
	attachedFileIDs := a.attachFileIDsToPost(rctx, post.Id, post.ChannelId, post.UserId, addedFiles)
	if len(attachedFileIDs) != len(addedFiles) {
		// if not all files could be attached, the final list of files
		// is those that could be attached + the existing, unchanged files
		post.FileIds = append(attachedFileIDs, unchangedFiles...)
	}
}

func (a *App) detachFilesFromPost(rctx request.CTX, post *model.Post, removedFiles []string) {
	a.Srv().Store().FileInfo().
}
