// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package a

import (
	"slices"
	"sort"
)

func invalid() {
	strs := []string{"b", "a"}
	sort.Strings(strs) // want `sort\.Strings is not allowed, use slices\.Sort from the slices package instead`

	ints := []int{2, 1}
	sort.Ints(ints) // want `sort\.Ints is not allowed, use slices\.Sort from the slices package instead`

	sort.Slice(strs, func(i, j int) bool { return strs[i] < strs[j] }) // want `sort\.Slice is not allowed, use slices\.SortFunc from the slices package instead`

	sort.SliceStable(strs, func(i, j int) bool { return strs[i] < strs[j] }) // want `sort\.SliceStable is not allowed, use slices\.SortStableFunc from the slices package instead`
}

func valid() {
	strs := []string{"b", "a"}
	slices.Sort(strs)

	slices.SortFunc(strs, func(a, b string) int {
		if a < b {
			return -1
		}
		return 1
	})

	// Other functions in the sort package aren't flagged by this analyzer.
	sort.Sort(sort.StringSlice(strs))
	sort.Search(len(strs), func(i int) bool { return strs[i] >= "a" })
}
