// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const auditDeliveryChunkSize = 1000

func (a *App) AuditRecord(ctx context.Context, userID, postID string, mechanism int16) {
	if !model.SafeDereference(a.Config().AuditStorageSettings.Enable) {
		return
	}
	if userID == "" || postID == "" {
		return
	}
	if err := a.Srv().Store().AuditStorage().Mark(ctx, userID, postID, mechanism); err != nil {
		a.Log().Error("audit_storage: Mark failed",
			mlog.String("user_id", userID),
			mlog.String("post_id", postID),
			mlog.Err(err))
	}
}

func (a *App) AuditRecordBulk(userID string, postIDs []string, mechanism int16) {
	if !model.SafeDereference(a.Config().AuditStorageSettings.Enable) {
		return
	}
	if userID == "" || len(postIDs) == 0 {
		return
	}
	chunk := make([]string, 0, min(len(postIDs), auditDeliveryChunkSize))
	for _, id := range postIDs {
		if id == "" {
			continue
		}
		chunk = append(chunk, id)
		if len(chunk) < auditDeliveryChunkSize {
			continue
		}
		a.markBulkSameUserChunk(userID, chunk, mechanism)
		chunk = chunk[:0]
	}
	if len(chunk) > 0 {
		a.markBulkSameUserChunk(userID, chunk, mechanism)
	}
}

func (a *App) AuditRecordBulkPosts(userID string, posts []*model.Post, mechanism int16) {
	if !model.SafeDereference(a.Config().AuditStorageSettings.Enable) {
		return
	}
	if userID == "" || len(posts) == 0 {
		return
	}
	chunk := make([]string, 0, min(len(posts), auditDeliveryChunkSize))
	for _, p := range posts {
		if p == nil || p.Id == "" {
			continue
		}
		chunk = append(chunk, p.Id)
		if len(chunk) < auditDeliveryChunkSize {
			continue
		}
		a.markBulkSameUserChunk(userID, chunk, mechanism)
		chunk = chunk[:0]
	}
	if len(chunk) > 0 {
		a.markBulkSameUserChunk(userID, chunk, mechanism)
	}
}

func (a *App) AuditRecordBulkMany(userIDs []string, postID string, mechanism int16) {
	if !model.SafeDereference(a.Config().AuditStorageSettings.Enable) {
		return
	}
	if postID == "" || len(userIDs) == 0 {
		return
	}
	chunk := make([]string, 0, min(len(userIDs), auditDeliveryChunkSize))
	for _, id := range userIDs {
		if id == "" {
			continue
		}
		chunk = append(chunk, id)
		if len(chunk) < auditDeliveryChunkSize {
			continue
		}
		a.markBulkSamePostChunk(chunk, postID, mechanism)
		chunk = chunk[:0]
	}
	if len(chunk) > 0 {
		a.markBulkSamePostChunk(chunk, postID, mechanism)
	}
}

func (a *App) AuditRecordBulkManyFromUserMap(userMap map[string]*model.User, postID string, mechanism int16) {
	if !model.SafeDereference(a.Config().AuditStorageSettings.Enable) {
		return
	}
	if postID == "" || len(userMap) == 0 {
		return
	}
	chunk := make([]string, 0, min(len(userMap), auditDeliveryChunkSize))
	for uid := range userMap {
		if uid == "" {
			continue
		}
		chunk = append(chunk, uid)
		if len(chunk) < auditDeliveryChunkSize {
			continue
		}
		a.markBulkSamePostChunk(chunk, postID, mechanism)
		chunk = chunk[:0]
	}
	if len(chunk) > 0 {
		a.markBulkSamePostChunk(chunk, postID, mechanism)
	}
}

func (a *App) markBulkSameUserChunk(userID string, chunk []string, mechanism int16) {
	if err := a.Srv().Store().AuditStorage().MarkBulkSameUser(context.Background(), userID, chunk, mechanism); err != nil {
		a.Log().Error("audit_storage: MarkBulkSameUser failed",
			mlog.String("user_id", userID),
			mlog.Int("post_count", len(chunk)),
			mlog.Err(err))
	}
}

func (a *App) markBulkSamePostChunk(chunk []string, postID string, mechanism int16) {
	if err := a.Srv().Store().AuditStorage().MarkBulkSamePost(context.Background(), chunk, postID, mechanism); err != nil {
		a.Log().Error("audit_storage: MarkBulkSamePost failed",
			mlog.String("post_id", postID),
			mlog.Int("user_count", len(chunk)),
			mlog.Err(err))
	}
}
