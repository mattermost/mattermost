// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package web

import (
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetPerPageFromQuery(t *testing.T) {
	t.Run("defaults should be set", func(t *testing.T) {
		query := make(url.Values)
		perPage := getPerPageFromQuery(query)
		require.Equal(t, PerPageDefault, perPage)
	})

	t.Run("per_page should take priority", func(t *testing.T) {
		query := make(url.Values)
		query.Add("pageSize", "100")
		query.Add("per_page", "50")
		perPage := getPerPageFromQuery(query)
		require.Equal(t, 50, perPage)
	})

	t.Run("pageSize should be used only if per_page is incorrectly set", func(t *testing.T) {
		query := make(url.Values)
		query.Add("pageSize", "100")
		query.Add("per_page", "BAD VALUE")
		perPage := getPerPageFromQuery(query)
		require.Equal(t, 100, perPage)
	})
}
