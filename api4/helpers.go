// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/url"
	"strconv"

	"github.com/pkg/errors"
)

func parseInt(u *url.URL, name string, defaultValue int) (int, error) {
	valueStr := u.Query().Get(name)
	if valueStr == "" {
		return defaultValue, nil
	}

	value, err := strconv.Atoi(valueStr)
	if err != nil {
		return 0, errors.Wrapf(err, "failed to parse %s as integer", name)
	}

	return value, nil
}
