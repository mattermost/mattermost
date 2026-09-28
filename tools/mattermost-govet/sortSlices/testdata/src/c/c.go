// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package c

import (
	"slices"
	"sort"
	. "sort"
)

func invalid() {
	strs := []string{"b", "a"}

	sorter := sort.Slice
	sorter(strs, func(i, j int) bool { return strs[i] < strs[j] }) // want `sort\.Slice is not allowed, use slices\.SortFunc from the slices package instead`

	var stringSorter = sort.Strings
	stringSorter(strs) // want `sort\.Strings is not allowed, use slices\.Sort from the slices package instead`

	// Aliasing a dot-imported reference is also flagged.
	stableSorter := SliceStable
	stableSorter(strs, func(i, j int) bool { return strs[i] < strs[j] }) // want `sort\.SliceStable is not allowed, use slices\.SortStableFunc from the slices package instead`
}

func valid() {
	strs := []string{"b", "a"}
	slices.Sort(strs)
}
