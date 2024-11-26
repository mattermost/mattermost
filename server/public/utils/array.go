// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

// FindExclusives returns three arrays:
// 1. Items exclusive to arr1
// 2. Items exclusive to arr2
// 3. Items common to both arr1 and arr2
func FindExclusives[T comparable](arr1, arr2 []T) ([]T, []T, []T) {
	elementMap := make(map[T]int)

	// Populate the map with counts from arr1
	for _, elem := range arr1 {
		elementMap[elem]++
	}

	// Process arr2 and adjust counts
	var exclusiveToArr2 []T
	var commonElements []T
	for _, elem := range arr2 {
		if elementMap[elem] > 0 {
			elementMap[elem]--                            // Common element
			commonElements = append(commonElements, elem) // Track common elements
		} else {
			exclusiveToArr2 = append(exclusiveToArr2, elem) // Exclusive to arr2
		}
	}

	// Collect exclusive elements for arr1
	var exclusiveToArr1 []T
	for elem, count := range elementMap {
		for i := 0; i < count; i++ {
			exclusiveToArr1 = append(exclusiveToArr1, elem)
		}
	}

	return exclusiveToArr1, exclusiveToArr2, commonElements
}
