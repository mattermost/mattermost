// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

// Contains returns true if the slice contains the item.
func Contains[T comparable](slice []T, item T) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
