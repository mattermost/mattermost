// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import "strings"

// NormalizeName returns the name in lower case, without the spaces around it.
func NormalizeName(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

// JoinNames returns the normalized names separated by commas.
func JoinNames(names []string) string {
	normalized := make([]string, 0, len(names))
	for _, n := range names {
		normalized = append(normalized, NormalizeName(n))
	}
	return strings.Join(normalized, ",")
}
