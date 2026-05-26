// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"fmt"
	"net/url"
	"strconv"
)

func parseInt(u *url.URL, name string, defaultValue int) (int, error) {
	valueStr := u.Query().Get(name)
	if valueStr == "" {
		return defaultValue, nil
	}

	value, err := strconv.Atoi(valueStr)
	if err != nil {
		return 0, fmt.Errorf("failed to parse %s as integer: %w", name, err)
	}

	return value, nil
}
