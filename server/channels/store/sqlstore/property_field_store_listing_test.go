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

	filters := map[string]model.GlobalAttributeListingOpts{
		"no filter":                        {},
		"source managed":                   {Source: model.GlobalAttributeSourceManaged},
		"source plugin":                    {Source: model.GlobalAttributeSourcePlugin},
		"source ldap":                      {Source: model.GlobalAttributeSourceLDAP},
		"hostile source":                   {Source: hostile},
		"resource type channel":            {ResourceType: model.PropertyFieldObjectTypeChannel},
		"hostile resource type":            {ResourceType: hostile},
		"hostile source and resource type": {Source: hostile, ResourceType: hostile},
	}
	for name, filter := range filters {
		t.Run(name, func(t *testing.T) {
			sql, args, err := listingWhere(model.GlobalAttributeListingOpts{
				GroupID:              hostile,
				Term:                 hostile,
				Source:               filter.Source,
				ResourceType:         filter.ResourceType,
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
