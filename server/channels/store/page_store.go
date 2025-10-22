// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package store

import "github.com/mattermost/mattermost/server/public/model"

// PageStore manages page hierarchy operations.
// Pages are stored as Posts with Type="page", but hierarchy-specific
// operations are isolated in this store for better separation of concerns.
type PageStore interface {
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

	// GetCommentsForPage fetches comments for a specific page
	GetCommentsForPage(pageID string, options model.GetPostsOptions) (*model.PostList, error)
}
