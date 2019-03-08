// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"sort"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestApplyPermissionsMap(t *testing.T) {
	tt := []struct {
		Name           string
		Permissions    []string
		TranslationMap permissionsMap
		ExpectedResult []string
	}{
		{
			"Split existing",
			[]string{"test1", "test2", "test3"},
			permissionsMap{permissionTransformation{On: permissionExists("test2"), Add: []string{"test4", "test5"}}},
			[]string{"test1", "test2", "test3", "test4", "test5"},
		},
		{
			"Remove existing",
			[]string{"test1", "test2", "test3"},
			permissionsMap{permissionTransformation{On: permissionExists("test2"), Remove: []string{"test2"}}},
			[]string{"test1", "test3"},
		},
		{
			"Rename existing",
			[]string{"test1", "test2", "test3"},
			permissionsMap{permissionTransformation{On: permissionExists("test2"), Add: []string{"test5"}, Remove: []string{"test2"}}},
			[]string{"test1", "test3", "test5"},
		},
		{
			"Remove when other not exists",
			[]string{"test1", "test2", "test3"},
			permissionsMap{permissionTransformation{On: permissionNotExists("test5"), Remove: []string{"test2"}}},
			[]string{"test1", "test3"},
		},
		{
			"Add when at least one exists",
			[]string{"test1", "test2", "test3"},
			permissionsMap{permissionTransformation{
				On:  permissionOr(permissionExists("test5"), permissionExists("test3")),
				Add: []string{"test4"},
			}},
			[]string{"test1", "test2", "test3", "test4"},
		},
		{
			"Add when all exists",
			[]string{"test1", "test2", "test3"},
			permissionsMap{permissionTransformation{
				On:  permissionAnd(permissionExists("test1"), permissionExists("test2")),
				Add: []string{"test4"},
			}},
			[]string{"test1", "test2", "test3", "test4"},
		},
		{
			"Not add when one in the and not exists",
			[]string{"test1", "test2", "test3"},
			permissionsMap{permissionTransformation{
				On:  permissionAnd(permissionExists("test1"), permissionExists("test5")),
				Add: []string{"test4"},
			}},
			[]string{"test1", "test2", "test3"},
		},
		{
			"Not Add when none on the or exists",
			[]string{"test1", "test2", "test3"},
			permissionsMap{permissionTransformation{
				On:  permissionOr(permissionExists("test7"), permissionExists("test9")),
				Add: []string{"test4"},
			}},
			[]string{"test1", "test2", "test3"},
		},
	}

	for _, tc := range tt {
		t.Run(tc.Name, func(t *testing.T) {
			result := applyPermissionsMap(tc.Permissions, tc.TranslationMap)
			sort.Strings(result)
			assert.Equal(t, tc.ExpectedResult, result)
		})
	}
}
