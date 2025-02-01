// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

// FindExclusives returns three arrays:
// 1. Items exclusive to arr1
// 2. Items exclusive to arr2
// 3. Items common to both arr1 and arr2
func FindExclusives[T comparable](arr1, arr2 []T) ([]T, []T, []T) {
	// Create maps to track the presence of elements in each array
	existsInArr1 := make(map[T]bool)
	existsInArr2 := make(map[T]bool)

	// Populate the maps with the elements from both arrays
	for _, elem := range arr1 {
		existsInArr1[elem] = true
	}
	for _, elem := range arr2 {
		existsInArr2[elem] = true
	}

	// Slices for results
	var uniqueToArr1 []T
	var uniqueToArr2 []T
	var common []T

	// Find elements unique to arr1 and common elements
	for elem := range existsInArr1 {
		if existsInArr2[elem] {
			common = append(common, elem)
		} else {
			uniqueToArr1 = append(uniqueToArr1, elem)
		}
	}

	// Find elements unique to arr2
	for elem := range existsInArr2 {
		if !existsInArr1[elem] {
			uniqueToArr2 = append(uniqueToArr2, elem)
		}
	}

	return uniqueToArr1, uniqueToArr2, common
}
