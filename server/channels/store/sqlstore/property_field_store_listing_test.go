// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestListingWhereBindsEveryInput(t *testing.T) {
	const hostile = `x'); DROP TABLE PropertyFields; --`

	for _, source := range []string{
		"",
		model.GlobalAttributeSourceManaged,
		model.GlobalAttributeSourcePlugin,
		model.GlobalAttributeSourceLDAP,
		hostile,
	} {
		t.Run("source "+source, func(t *testing.T) {
			sql, args, err := listingWhere(model.GlobalAttributeListingOpts{
				GroupID:              hostile,
				Term:                 hostile,
				Source:               source,
				ResourceType:         hostile,
				AllowedResourceTypes: []string{hostile},
				ExcludeIDs:           []string{hostile},
			}).ToSql()
			require.NoError(t, err)

			assert.NotContains(t, sql, "DROP TABLE", "request input must never reach the SQL text")
			assert.NotContains(t, sql, "'x'", "request input must never reach the SQL text")
			assert.Contains(t, args, hostile, "request input travels as a bound argument")
		})
	}
}

func TestListingTableName(t *testing.T) {
	assert.Equal(t, "PropertyFields", listingRowTable.name())
	assert.Equal(t, "lf", listingChildTable.name())
	assert.Panics(t, func() { _ = listingTable(99).name() })
}
