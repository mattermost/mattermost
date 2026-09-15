// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package b

import (
	"slices"
	. "sort"
)

func invalid() {
	strs := []string{"b", "a"}
	Strings(strs) // want `sort\.Strings is not allowed, use slices\.Sort from the slices package instead`

	ints := []int{2, 1}
	Ints(ints) // want `sort\.Ints is not allowed, use slices\.Sort from the slices package instead`

	Slice(strs, func(i, j int) bool { return strs[i] < strs[j] }) // want `sort\.Slice is not allowed, use slices\.SortFunc from the slices package instead`

	SliceStable(strs, func(i, j int) bool { return strs[i] < strs[j] }) // want `sort\.SliceStable is not allowed, use slices\.SortStableFunc from the slices package instead`
}

func valid() {
	strs := []string{"b", "a"}
	slices.Sort(strs)

	// Other functions in the sort package aren't flagged by this analyzer.
	Sort(StringSlice(strs))
}
