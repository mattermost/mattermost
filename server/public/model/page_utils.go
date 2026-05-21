// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"regexp"
	"strconv"
)

// URL pattern: /:team/wiki/:wikiId/:pageId
var pageUrlPattern = regexp.MustCompile(`^/([^/]+)/wiki/([^/]+)/([^/]+)$`)

// ParsePageUrl extracts teamName, wikiId, and pageId from a page URL
func ParsePageUrl(url string) (teamName, wikiId, pageId string, ok bool) {
	matches := pageUrlPattern.FindStringSubmatch(url)
	if len(matches) != 4 {
		return "", "", "", false
	}
	return matches[1], matches[2], matches[3], true
}

// IsPageUrl checks if a URL is an internal page URL
func IsPageUrl(url string) bool {
	return pageUrlPattern.MatchString(url)
}

// BuildPageUrl constructs a page URL from components
func BuildPageUrl(teamName, wikiId, pageId string) string {
	return fmt.Sprintf("/%s/wiki/%s/%s", teamName, wikiId, pageId)
}

// BuildWikiUrl constructs a wiki root URL from components
func BuildWikiUrl(teamName, wikiId string) string {
	return fmt.Sprintf("/%s/wiki/%s", teamName, wikiId)
}

// Page-specific post props keys.
const (
	PagePropsPageID               = "page_id"
	PagePropsWikiID               = "wiki_id"
	PagePropsParentCommentID      = "parent_comment_id"
	PagePropsPageStatus           = "page_status"
	PagePropsCommentResolved      = "comment_resolved"
	PagePropsResolvedAt           = "resolved_at"
	PagePropsResolvedBy           = "resolved_by"
	PagePropsInlineAnchor         = "inline_anchor"
	PagePropsResolutionReason     = "resolution_reason"
	PagePropsLastModifiedBy       = "last_modified_by"
	PagePropsTitle                        = "title"
	PagePropsPageSortOrder                = "page_sort_order"
	PagePropsReparentedChildrenOnDelete = "reparented_children_on_delete"
	PagePropsReparentedParentOnDelete   = "reparented_parent_on_delete"
	PageResolutionReasonManual    = "manual"
	PageDuplicateTitlePrefix      = "Copy of "
	DraftPropsPageParentID        = "page_parent_id"
	DraftPropsHasPublishedVersion = "has_published_version"
	DraftPropsOriginalPageEditAt  = "original_page_edit_at"

	PageCommentTypeInline = "inline"
)

func (o *Post) GetPageTitle() string {
	if o.Type != PostTypePage {
		return ""
	}
	if title, ok := o.GetProp(PagePropsTitle).(string); ok && title != "" {
		return title
	}
	return DefaultPageTitle
}

// GetPageSortOrder returns the sort order for a page from Props.
// Returns 0 if not set, which means sorting by CreateAt as fallback.
func (o *Post) GetPageSortOrder() int64 {
	props := o.GetProps()
	if props == nil {
		return 0
	}
	if v, ok := props[PagePropsPageSortOrder]; ok {
		switch val := v.(type) {
		case float64:
			return int64(val)
		case int64:
			return val
		case int:
			return int64(val)
		case string:
			if i, err := strconv.ParseInt(val, 10, 64); err == nil {
				return i
			}
		}
	}
	return 0
}

// SetPageSortOrder sets the sort order for a page in Props.
func (o *Post) SetPageSortOrder(order int64) {
	o.AddProp(PagePropsPageSortOrder, order)
}
