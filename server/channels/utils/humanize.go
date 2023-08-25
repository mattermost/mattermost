// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import "strings"

func JoinList(items []string) string {
	return strings.Join(items[:len(items)-1], ", ") + " and " + items[len(items)-1]
}
