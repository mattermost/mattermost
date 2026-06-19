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
// over the Pages table (not Posts). Live-page guard DeleteAt=0 is applied at every
// level of the recursion so version snapshots never appear in tree results.
//
// Parameters:
//
//	direction: Whether to traverse up (ancestors), down (descendants), or all descendants (subtree)
//	excludeRoot: Whether to exclude the root page from results
//	fullSelect: Whether to select all Page columns or just IDs
func buildPageHierarchyCTE(direction PageHierarchyCTEDirection, excludeRoot, fullSelect bool) string {
	var cte, selectClause string

	// pageColList matches pageColumns() for the full-select case.
	// These are the columns of the Pages table in declaration order.
	const pageColList = `p.Id, p.WikiId, p.ChannelId, p.ParentId, p.Type,
		       p.Title, p.Body, p.SearchText,
		       p.UserId, p.LastModifiedBy, p.SortOrder,
		       p.CreateAt, p.UpdateAt, p.EditAt, p.DeleteAt, p.OriginalId,
		       p.HasEffectiveViewRestriction, p.HasLocalEditRestriction,
		       p.Props,
		       p.ReparentedParentOnDelete, p.ReparentedChildrenOnDelete`

	switch direction {
	case PageHierarchyDescendants, PageHierarchySubtree:
		cteName := "descendants"
		if direction == PageHierarchySubtree {
			cteName = "page_subtree"
		}

		// Include depth tracking to prevent infinite recursion.
		// DeleteAt=0 guard at both the anchor and the recursive step ensures
		// version snapshots (DeleteAt>0) never appear in tree traversal.
		cte = fmt.Sprintf(`
		WITH RECURSIVE %s AS (
			SELECT Id, ParentId, 1 AS depth
			FROM Pages WHERE Id = $1 AND DeleteAt = 0
			UNION ALL
			SELECT p.Id, p.ParentId, d.depth + 1
			FROM Pages p
			INNER JOIN %s d ON p.ParentId = d.Id
			WHERE p.DeleteAt = 0 AND d.depth < %d
		)`, cteName, cteName, MaxPageHierarchyDepth)

		if fullSelect {
			selectClause = fmt.Sprintf(`
		SELECT `+pageColList+`
		FROM %s d
		INNER JOIN Pages p ON p.Id = d.Id`, cteName)
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
		// Include depth tracking to prevent infinite recursion.
		cte = fmt.Sprintf(`
		WITH RECURSIVE ancestors AS (
			SELECT Id, ParentId, 1 AS depth
			FROM Pages WHERE Id = $1 AND DeleteAt = 0
			UNION ALL
			SELECT p.Id, p.ParentId, a.depth + 1
			FROM Pages p
			INNER JOIN ancestors a ON p.Id = a.ParentId
			WHERE a.ParentId IS NOT NULL AND a.ParentId != ''
			  AND p.DeleteAt = 0 AND a.depth < %d
		)`, MaxPageHierarchyDepth)

		if fullSelect {
			selectClause = `
		SELECT ` + pageColList + `
		FROM ancestors a
		INNER JOIN Pages p ON p.Id = a.Id`
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
