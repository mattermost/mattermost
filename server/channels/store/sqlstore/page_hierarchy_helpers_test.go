// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBuildPageHierarchyCTE(t *testing.T) {
	if enableFullyParallelTests {
		t.Parallel()
	}

	testCases := []struct {
		name           string
		direction      PageHierarchyCTEDirection
		excludeRoot    bool
		fullSelect     bool
		mustContain    []string
		mustNotContain []string
	}{
		{
			name:        "descendants with full select and root included",
			direction:   PageHierarchyDescendants,
			excludeRoot: false,
			fullSelect:  true,
			mustContain: []string{
				"WITH RECURSIVE descendants AS",
				"INNER JOIN Posts p ON p.Id = d.Id",
				"ORDER BY p.CreateAt",
				"SELECT p.Id, p.CreateAt",
			},
			mustNotContain: []string{
				"WHERE d.Id != $1",
			},
		},
		{
			name:        "descendants with full select and root excluded",
			direction:   PageHierarchyDescendants,
			excludeRoot: true,
			fullSelect:  true,
			mustContain: []string{
				"WITH RECURSIVE descendants AS",
				"INNER JOIN Posts p ON p.Id = d.Id",
				"WHERE d.Id != $1",
				"ORDER BY p.CreateAt",
			},
			mustNotContain: []string{},
		},
		{
			name:        "descendants without full select and root included",
			direction:   PageHierarchyDescendants,
			excludeRoot: false,
			fullSelect:  false,
			mustContain: []string{
				"WITH RECURSIVE descendants AS",
				"SELECT Id FROM descendants",
			},
			mustNotContain: []string{
				"FROM descendants d\n\t\tINNER JOIN Posts p",
				"ORDER BY p.CreateAt",
			},
		},
		{
			name:        "descendants without full select and root excluded",
			direction:   PageHierarchyDescendants,
			excludeRoot: true,
			fullSelect:  false,
			mustContain: []string{
				"WITH RECURSIVE descendants AS",
				"SELECT Id FROM descendants",
				"WHERE Id != $1",
			},
			mustNotContain: []string{
				"FROM descendants d\n\t\tINNER JOIN Posts p",
				"ORDER BY p.CreateAt",
				"WHERE d.Id",
			},
		},
		{
			name:        "subtree with full select and root included",
			direction:   PageHierarchySubtree,
			excludeRoot: false,
			fullSelect:  true,
			mustContain: []string{
				"WITH RECURSIVE page_subtree AS",
				"INNER JOIN Posts p ON p.Id = d.Id",
				"ORDER BY p.CreateAt",
			},
			mustNotContain: []string{
				"WHERE d.Id != $1",
			},
		},
		{
			name:        "subtree without full select and root excluded",
			direction:   PageHierarchySubtree,
			excludeRoot: true,
			fullSelect:  false,
			mustContain: []string{
				"WITH RECURSIVE page_subtree AS",
				"SELECT Id FROM page_subtree",
				"WHERE Id != $1",
			},
			mustNotContain: []string{
				"FROM page_subtree d\n\t\tINNER JOIN Posts p",
				"ORDER BY p.CreateAt",
			},
		},
		{
			name:        "ancestors with full select and root included",
			direction:   PageHierarchyAncestors,
			excludeRoot: false,
			fullSelect:  true,
			mustContain: []string{
				"WITH RECURSIVE ancestors AS",
				"INNER JOIN Posts p ON p.Id = a.Id",
				"ORDER BY p.CreateAt",
				"SELECT p.Id, p.CreateAt",
			},
			mustNotContain: []string{
				"WHERE a.Id != $1",
			},
		},
		{
			name:        "ancestors with full select and root excluded",
			direction:   PageHierarchyAncestors,
			excludeRoot: true,
			fullSelect:  true,
			mustContain: []string{
				"WITH RECURSIVE ancestors AS",
				"INNER JOIN Posts p ON p.Id = a.Id",
				"WHERE a.Id != $1",
				"ORDER BY p.CreateAt",
			},
			mustNotContain: []string{},
		},
		{
			name:        "ancestors without full select and root included",
			direction:   PageHierarchyAncestors,
			excludeRoot: false,
			fullSelect:  false,
			mustContain: []string{
				"WITH RECURSIVE ancestors AS",
				"SELECT Id FROM ancestors",
			},
			mustNotContain: []string{
				"FROM ancestors a\n\t\tINNER JOIN Posts p",
				"ORDER BY p.CreateAt",
			},
		},
		{
			name:        "ancestors without full select and root excluded",
			direction:   PageHierarchyAncestors,
			excludeRoot: true,
			fullSelect:  false,
			mustContain: []string{
				"WITH RECURSIVE ancestors AS",
				"SELECT Id FROM ancestors",
				"WHERE Id != $1",
			},
			mustNotContain: []string{
				"FROM ancestors a\n\t\tINNER JOIN Posts p",
				"ORDER BY p.CreateAt",
				"WHERE a.Id",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			sql := buildPageHierarchyCTE(tc.direction, tc.excludeRoot, tc.fullSelect)

			for _, mustContain := range tc.mustContain {
				require.Contains(t, sql, mustContain,
					"SQL should contain: %s\nGenerated SQL:\n%s", mustContain, sql)
			}

			for _, mustNotContain := range tc.mustNotContain {
				require.NotContains(t, sql, mustNotContain,
					"SQL should NOT contain: %s\nGenerated SQL:\n%s", mustNotContain, sql)
			}

			if !tc.fullSelect {
				require.NotContains(t, sql, "ORDER BY p.CreateAt",
					"When fullSelect=false, final SELECT should not include ORDER BY with 'p' alias\nGenerated SQL:\n%s", sql)

				splitSQL := strings.Split(sql, ")")
				if len(splitSQL) > 1 {
					finalSelect := splitSQL[len(splitSQL)-1]
					require.NotContains(t, finalSelect, "INNER JOIN Posts p",
						"When fullSelect=false, final SELECT should not JOIN Posts table\nFinal SELECT:\n%s", finalSelect)
				}
			}
		})
	}
}

func TestBuildPageHierarchyCTE_SQLSyntaxValidity(t *testing.T) {
	if enableFullyParallelTests {
		t.Parallel()
	}

	directions := []PageHierarchyCTEDirection{
		PageHierarchyDescendants,
		PageHierarchyAncestors,
		PageHierarchySubtree,
	}

	for _, direction := range directions {
		for _, excludeRoot := range []bool{true, false} {
			for _, fullSelect := range []bool{true, false} {
				t.Run(string(direction)+"_excludeRoot="+boolToString(excludeRoot)+"_fullSelect="+boolToString(fullSelect), func(t *testing.T) {
					sql := buildPageHierarchyCTE(direction, excludeRoot, fullSelect)

					require.NotEmpty(t, sql, "Generated SQL should not be empty")

					require.True(t, strings.HasPrefix(strings.TrimSpace(sql), "WITH RECURSIVE"),
						"SQL should start with WITH RECURSIVE")

					require.Contains(t, sql, "SELECT",
						"SQL should contain SELECT clause")

					if fullSelect {
						require.Contains(t, sql, "INNER JOIN Posts p",
							"When fullSelect=true, SQL should include JOIN to Posts table")
						require.Contains(t, sql, "ORDER BY p.CreateAt",
							"When fullSelect=true, SQL should include ORDER BY using joined table")
					} else {
						require.NotContains(t, sql, "INNER JOIN Posts p",
							"When fullSelect=false, SQL should NOT include JOIN to Posts table")
						require.NotContains(t, sql, "ORDER BY",
							"When fullSelect=false, SQL should NOT include ORDER BY")
					}

					if excludeRoot {
						require.Contains(t, sql, "WHERE",
							"When excludeRoot=true, SQL should include WHERE clause")
						require.Contains(t, sql, "!= $1",
							"When excludeRoot=true, SQL should filter out root with parameter")
					}
				})
			}
		}
	}
}

func boolToString(b bool) string {
	if b {
		return "true"
	}
	return "false"
}
