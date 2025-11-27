// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package store

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// PageStore manages page hierarchy operations.
// Pages are stored as Posts with Type="page", but hierarchy-specific
// operations are isolated in this store for better separation of concerns.
type PageStore interface {
	// CreatePage creates a page and its content in a single transaction
	CreatePage(rctx request.CTX, post *model.Post, content, searchText string) (*model.Post, error)

	// GetPage fetches a page by ID
	GetPage(pageID string, includeDeleted bool) (*model.Post, error)

	// DeletePage soft-deletes a page and its content in a single transaction
	DeletePage(pageID string, deleteByID string) error

	// GetPageChildren fetches direct children of a page
	GetPageChildren(postID string, options model.GetPostsOptions) (*model.PostList, error)

	// GetPageDescendants fetches all descendants of a page (entire subtree)
	GetPageDescendants(postID string) (*model.PostList, error)

	// GetPageAncestors fetches all ancestors of a page up to the root
	GetPageAncestors(postID string) (*model.PostList, error)

	// GetChannelPages fetches all pages in a channel
	GetChannelPages(channelID string) (*model.PostList, error)

	// ChangePageParent updates the parent of a page
	ChangePageParent(postID string, newParentID string) error

	// UpdatePageWithContent updates a page's title and/or content and creates edit history
	UpdatePageWithContent(rctx request.CTX, pageID, title, content, searchText string) (*model.Post, error)

	// Update updates a page (following MM pattern - no business logic, just UPDATE)
	// Returns ErrNotFound if page doesn't exist or was deleted
	Update(page *model.Post) (*model.Post, error)

	// GetPageVersionHistory fetches the version history for a page (limited to PostEditHistoryLimit versions)
	GetPageVersionHistory(pageID string) ([]*model.Post, error)
}
