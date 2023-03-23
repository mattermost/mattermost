// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"net/url"
	"strings"
)

func URLEncode(str string) string {
	strs := strings.Split(str, " ")

	for i, s := range strs {
		strs[i] = url.QueryEscape(s)
	}

	return strings.Join(strs, "%20")
}
