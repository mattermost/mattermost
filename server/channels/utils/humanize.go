// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"strings"

	"github.com/mattermost/mattermost/server/public/shared/i18n"
)

func JoinList(items []string) string {
	if len(items) == 0 {
		return ""
	} else if len(items) == 1 {
		return items[0]
	} else {
		return i18n.T(
			"humanize.list_join",
			map[string]any{
				"OtherItems": strings.Join(items[:len(items)-1], ", "),
				"LastItem":   items[len(items)-1],
			})
	}
}
