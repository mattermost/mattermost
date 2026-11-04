// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import "strings"

// TrimLabel returns the label without the spaces around it.
func TrimLabel(s string) string {
	return strings.TrimSpace(s)
}
