// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slices

func IncludesString(list []string, item string) bool {
	for _, v := range list {
		if v == item {
			return true
		}
	}
	return false
}

// TODO: Convert all instances of this functionality in Mattermost to use this method.
func AsStringBoolMap(list []string) map[string]bool {
	listMap := map[string]bool{}
	for _, p := range list {
		listMap[p] = true
	}
	return listMap
}