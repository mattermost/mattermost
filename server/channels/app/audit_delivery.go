// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// AuditPostDelivered emits a single postDelivered audit record for one
// (recipient, post, mechanism) tuple. Errors during emission never
// propagate — audit failure must not fail the user-facing request.
//
// Pass the session user's ID as recipientUserID from API handlers (the
// viewer of the post). Pass the actual recipient's ID in app-layer paths
// (push/email/webhook recipient, fan-out member).
//
// channelID may be empty if not readily available; mechanism must be one of
// the model.AuditMech* string constants.
func (a *App) AuditPostDelivered(rctx request.CTX, recipientUserID, postID, channelID, mechanism string) {
	if recipientUserID == "" || postID == "" {
		return
	}
	rec := a.MakeAuditRecord(rctx, model.AuditEventPostDelivered, model.AuditStatusSuccess)
	rec.Actor.UserId = recipientUserID
	model.AddEventParameterToAuditRec(rec, "mechanism", mechanism)
	model.AddEventParameterToAuditRec(rec, "post_id", postID)
	if channelID != "" {
		model.AddEventParameterToAuditRec(rec, "channel_id", channelID)
	}
	a.LogAuditRec(rctx, rec, nil)
}

// AuditPostDeliveredBulk emits one postDelivered record per post for a
// single recipient. Use for API handler paths that return a PostList
// (channel view, thread view, search, getPostsByIds, flagged, pinned).
func (a *App) AuditPostDeliveredBulk(rctx request.CTX, recipientUserID string, postIDs []string, channelID, mechanism string) {
	if recipientUserID == "" || len(postIDs) == 0 {
		return
	}
	for _, pid := range postIDs {
		a.AuditPostDelivered(rctx, recipientUserID, pid, channelID, mechanism)
	}
}

// AuditPostDeliveredFanOut emits one postDelivered record per recipient
// for a single post. Use for the websocket-broadcast fan-out where the
// same post is delivered to every online channel member.
func (a *App) AuditPostDeliveredFanOut(rctx request.CTX, recipientUserIDs []string, postID, channelID, mechanism string) {
	if postID == "" || len(recipientUserIDs) == 0 {
		return
	}
	for _, uid := range recipientUserIDs {
		a.AuditPostDelivered(rctx, uid, postID, channelID, mechanism)
	}
}

// AuditPostDeliveredPosts is the post-slice variant of AuditPostDeliveredBulk.
// Use when the caller already has a []*model.Post so the call site doesn't
// have to allocate an intermediate []string. If channelID is empty, each
// record uses the post's own ChannelId.
func (a *App) AuditPostDeliveredPosts(rctx request.CTX, recipientUserID string, posts []*model.Post, channelID, mechanism string) {
	if recipientUserID == "" || len(posts) == 0 {
		return
	}
	for _, p := range posts {
		if p == nil || p.Id == "" {
			continue
		}
		cid := channelID
		if cid == "" {
			cid = p.ChannelId
		}
		a.AuditPostDelivered(rctx, recipientUserID, p.Id, cid, mechanism)
	}
}
