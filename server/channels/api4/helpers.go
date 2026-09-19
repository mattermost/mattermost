// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/url"
	"strconv"

	"github.com/pkg/errors"
)

// pluckIDs maps a slice to the IDs produced by idFn, preserving order.
func pluckIDs[T any](items []T, idFn func(T) string) []string {
	ids := make([]string, 0, len(items))
	for _, item := range items {
		ids = append(ids, idFn(item))
	}
	return ids
}

// containsByID reports whether any element of items yields id via idFn.
func containsByID[T any](items []T, id string, idFn func(T) string) bool {
	for _, item := range items {
		if idFn(item) == id {
			return true
		}
	}
	return false
}

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
