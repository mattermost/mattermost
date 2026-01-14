// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imports

import "github.com/mattermost/mattermost/server/public/model"

// WikiImportData represents a wiki to be imported.
// Wikis are containers for pages within a channel.
type WikiImportData struct {
	Team        *string `json:"team"`                  // Team name (required)
	Channel     *string `json:"channel"`               // Channel name (required)
	Title       *string `json:"title,omitempty"`       // Wiki title (defaults to channel name + " Wiki")
	Description *string `json:"description,omitempty"` // Wiki description

	// Props for idempotency - must include "import_source_id" for multi-space imports
	Props *model.StringInterface `json:"props,omitempty"`
}

// PageImportData represents a page to be imported.
// Pages are stored as Posts with Type="page" and content in PageContents table.
type PageImportData struct {
	Team    *string `json:"team"`    // Team name (required)
	Channel *string `json:"channel"` // Channel name (required)
	User    *string `json:"user"`    // Username of page creator (required)

	// Page metadata
	Title    *string `json:"title"`               // Page title (required)
	CreateAt *int64  `json:"create_at,omitempty"` // Creation timestamp (defaults to now)

	// Content as TipTap JSON string
	Content *string `json:"content"` // TipTap JSON document (required)

	// Hierarchy - uses import_source_id for parent lookup (not MM IDs)
	ParentImportSourceId *string `json:"parent_import_source_id,omitempty"` // Parent page's import_source_id

	// Props for idempotency and metadata
	Props *model.StringInterface `json:"props,omitempty"` // Must include "import_source_id" for idempotency

	// Attachments
	Attachments *[]AttachmentImportData `json:"attachments,omitempty"`

	// Nested comments (alternative to standalone page_comment lines)
	Comments *[]PageCommentImportData `json:"comments,omitempty"`
}

// PageCommentImportData represents a comment on a page.
// Comments are stored as Posts with Type="page_comment" and RootId pointing to the page.
type PageCommentImportData struct {
	// For standalone comments, reference the page by import_source_id
	PageImportSourceId *string `json:"page_import_source_id,omitempty"` // Page's import_source_id (required for standalone)

	// Comment data
	User     *string `json:"user"`                // Username of commenter (required)
	Content  *string `json:"content"`             // TipTap JSON content (required)
	CreateAt *int64  `json:"create_at,omitempty"` // Creation timestamp

	// Status
	IsResolved *bool `json:"is_resolved,omitempty"` // True if comment was resolved

	// Threading - use import_source_id for parent lookup
	ParentCommentImportSourceId *string `json:"parent_comment_import_source_id,omitempty"` // Parent comment's import_source_id

	// Props for idempotency
	Props *model.StringInterface `json:"props,omitempty"` // Must include "import_source_id" for idempotency
}

// ResolveWikiPlaceholdersImportData triggers post-import placeholder resolution
// for a channel's wiki pages. This should be output after all pages are imported.
type ResolveWikiPlaceholdersImportData struct {
	Team    *string `json:"team"`    // Team name (required)
	Channel *string `json:"channel"` // Channel name (required)
}
