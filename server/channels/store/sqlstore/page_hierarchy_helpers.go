// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"
)

// PageHierarchyCTEDirection specifies the traversal direction for page hierarchies
type PageHierarchyCTEDirection string

const (
	PageHierarchyDescendants PageHierarchyCTEDirection = "descendants"
	PageHierarchyAncestors   PageHierarchyCTEDirection = "ancestors"
	PageHierarchySubtree     PageHierarchyCTEDirection = "subtree"
)

// MaxPageHierarchyDepth limits CTE recursion depth to prevent infinite loops
// and excessive resource consumption on deeply nested page hierarchies.
const MaxPageHierarchyDepth = 50

// buildPageHierarchyCTE generates a recursive CTE query for page hierarchy traversal
// Parameters:
//
//	direction: Whether to traverse up (ancestors), down (descendants), or all descendants (subtree)
//	excludeRoot: Whether to exclude the root page from results
//	fullSelect: Whether to select all Post columns or just IDs
func buildPageHierarchyCTE(direction PageHierarchyCTEDirection, excludeRoot, fullSelect bool) string {
	var cte, selectClause string

	switch direction {
	case PageHierarchyDescendants, PageHierarchySubtree:
		cteName := "descendants"
		if direction == PageHierarchySubtree {
			cteName = "page_subtree"
		}

		// Include depth tracking to prevent infinite recursion
		cte = fmt.Sprintf(`
		WITH RECURSIVE %s AS (
			SELECT Id, PageParentId, 1 AS depth
			FROM Posts WHERE Id = $1 AND Type = 'page' AND DeleteAt = 0
			UNION ALL
			SELECT p.Id, p.PageParentId, d.depth + 1
			FROM Posts p
			INNER JOIN %s d ON p.PageParentId = d.Id
			WHERE p.Type = 'page' AND p.DeleteAt = 0 AND d.depth < %d
		)`, cteName, cteName, MaxPageHierarchyDepth)

		if fullSelect {
			selectClause = fmt.Sprintf(`
		SELECT p.Id, p.CreateAt, p.UpdateAt, p.EditAt, p.DeleteAt, p.IsPinned, p.UserId,
		       p.ChannelId, p.RootId, p.OriginalId, p.Message, p.Type, p.Props, p.Hashtags,
		       p.Filenames, p.FileIds, p.HasReactions, p.RemoteId, p.PageParentId
		FROM %s d
		INNER JOIN Posts p ON p.Id = d.Id`, cteName)
			if excludeRoot {
				selectClause += "\n		WHERE d.Id != $1"
			}
			selectClause += "\n		ORDER BY p.CreateAt"
		} else {
			selectClause = fmt.Sprintf(`SELECT Id FROM %s`, cteName)
			if excludeRoot {
				selectClause += "\n		WHERE Id != $1"
			}
		}

	case PageHierarchyAncestors:
		// Include depth tracking to prevent infinite recursion
		cte = fmt.Sprintf(`
		WITH RECURSIVE ancestors AS (
			SELECT Id, PageParentId, 1 AS depth
			FROM Posts WHERE Id = $1 AND Type = 'page' AND DeleteAt = 0
			UNION ALL
			SELECT p.Id, p.PageParentId, a.depth + 1
			FROM Posts p
			INNER JOIN ancestors a ON p.Id = a.PageParentId
			WHERE a.PageParentId IS NOT NULL AND a.PageParentId != ''
			  AND p.Type = 'page' AND p.DeleteAt = 0 AND a.depth < %d
		)`, MaxPageHierarchyDepth)

		if fullSelect {
			selectClause = `
		SELECT p.Id, p.CreateAt, p.UpdateAt, p.EditAt, p.DeleteAt, p.IsPinned, p.UserId,
		       p.ChannelId, p.RootId, p.OriginalId, p.Message, p.Type, p.Props, p.Hashtags,
		       p.Filenames, p.FileIds, p.HasReactions, p.RemoteId, p.PageParentId
		FROM ancestors a
		INNER JOIN Posts p ON p.Id = a.Id`
			if excludeRoot {
				selectClause += "\n		WHERE a.Id != $1"
			}
			selectClause += "\n		ORDER BY p.CreateAt"
		} else {
			selectClause = `SELECT Id FROM ancestors`
			if excludeRoot {
				selectClause += "\n		WHERE Id != $1"
			}
		}
	}

	return cte + "\n	" + selectClause
}
