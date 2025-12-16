// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
)

// Page is a type-safe wrapper around a Post that is guaranteed to be of type PostTypePage.
// This wrapper guarantees validation happened at construction time.
//
// IMPORTANT: Page does NOT guarantee:
// - Permissions (caller must still check permissions separately)
// - Immutability (underlying Post can be modified via Post())
// - Current state (page could be deleted/modified by another request)
type Page struct {
	post *model.Post
}

// Post returns the underlying model.Post.
// Use this when you need to pass to store methods or APIs that require *model.Post.
func (p *Page) Post() *model.Post {
	return p.post
}

// Id returns the page's ID.
func (p *Page) Id() string {
	return p.post.Id
}

// ChannelId returns the page's channel ID.
func (p *Page) ChannelId() string {
	return p.post.ChannelId
}

// UserId returns the page author's user ID.
func (p *Page) UserId() string {
	return p.post.UserId
}

// PageParentId returns the page's parent page ID (empty for root pages).
func (p *Page) PageParentId() string {
	return p.post.PageParentId
}

// Props returns the page's Props map.
func (p *Page) Props() model.StringInterface {
	return p.post.Props
}

// DeleteAt returns the page's deletion timestamp (0 if not deleted).
func (p *Page) DeleteAt() int64 {
	return p.post.DeleteAt
}

// NewPageFromValidatedPost wraps a *model.Post into a *Page.
// IMPORTANT: This should only be called when the caller has already verified
// that the post is of type PostTypePage (e.g., via IsPagePost check).
// For fetching a page by ID with validation, use GetPage instead.
func NewPageFromValidatedPost(post *model.Post) *Page {
	return &Page{post: post}
}
