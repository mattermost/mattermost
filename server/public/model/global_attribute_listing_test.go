// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGlobalAttributeListingSearchSetDefaults(t *testing.T) {
	for name, tc := range map[string]struct {
		perPage  int
		expected int
	}{
		"unset uses the default":       {perPage: 0, expected: GlobalAttributeListingPerPageDefault},
		"negative uses the default":    {perPage: -5, expected: GlobalAttributeListingPerPageDefault},
		"in range is kept":             {perPage: 25, expected: 25},
		"maximum is kept":              {perPage: GlobalAttributeListingPerPageMaximum, expected: GlobalAttributeListingPerPageMaximum},
		"above the maximum is clamped": {perPage: GlobalAttributeListingPerPageMaximum + 1, expected: GlobalAttributeListingPerPageMaximum},
	} {
		t.Run(name, func(t *testing.T) {
			s := GlobalAttributeListingSearch{PerPage: tc.perPage}
			s.SetDefaults()
			assert.Equal(t, tc.expected, s.PerPage)
		})
	}
}

func TestGlobalAttributeListingSearchIsValid(t *testing.T) {
	valid := func() GlobalAttributeListingSearch {
		return GlobalAttributeListingSearch{PerPage: GlobalAttributeListingPerPageDefault}
	}

	t.Run("no filters", func(t *testing.T) {
		s := valid()
		require.NoError(t, s.IsValid())
	})

	t.Run("every source value", func(t *testing.T) {
		for _, source := range []string{
			GlobalAttributeSourceManaged,
			GlobalAttributeSourcePlugin,
			GlobalAttributeSourceLDAP,
			GlobalAttributeSourceSAML,
			GlobalAttributeSourceOpenID,
		} {
			s := valid()
			s.Source = source
			assert.NoError(t, s.IsValid(), source)
		}
	})

	t.Run("every resource type", func(t *testing.T) {
		for _, resourceType := range []string{
			PropertyFieldObjectTypeUser,
			PropertyFieldObjectTypeChannel,
			PropertyFieldObjectTypePost,
		} {
			s := valid()
			s.ResourceType = resourceType
			assert.NoError(t, s.IsValid(), resourceType)
		}
	})

	t.Run("term is free text", func(t *testing.T) {
		s := valid()
		s.Term = "50%_off \\ clearance"
		require.NoError(t, s.IsValid())
	})

	for name, mutate := range map[string]func(*GlobalAttributeListingSearch){
		"unknown source":             func(s *GlobalAttributeListingSearch) { s.Source = "scim" },
		"source with different case": func(s *GlobalAttributeListingSearch) { s.Source = "LDAP" },
		"template as resource type":  func(s *GlobalAttributeListingSearch) { s.ResourceType = PropertyFieldObjectTypeTemplate },
		"unknown resource type":      func(s *GlobalAttributeListingSearch) { s.ResourceType = "team" },
		"negative page":              func(s *GlobalAttributeListingSearch) { s.Page = -1 },
		"zero per_page":              func(s *GlobalAttributeListingSearch) { s.PerPage = 0 },
		"per_page above the maximum": func(s *GlobalAttributeListingSearch) { s.PerPage = GlobalAttributeListingPerPageMaximum + 1 },
	} {
		t.Run(name, func(t *testing.T) {
			s := valid()
			mutate(&s)
			require.Error(t, s.IsValid())
		})
	}
}

func TestGlobalAttributeListingJSON(t *testing.T) {
	t.Run("search decodes the documented keys", func(t *testing.T) {
		var s GlobalAttributeListingSearch
		require.NoError(t, json.Unmarshal([]byte(`{"term":"clear","source":"ldap","resource_type":"channel","page":2,"per_page":20}`), &s))
		assert.Equal(t, GlobalAttributeListingSearch{Term: "clear", Source: "ldap", ResourceType: "channel", Page: 2, PerPage: 20}, s)
	})

	t.Run("row omits a missing name conflict and owner template", func(t *testing.T) {
		row := GlobalAttributeListingRow{
			Field:       &PropertyField{ID: "f1", Name: "clearance"},
			AppliesTo:   []string{PropertyFieldObjectTypeUser},
			Owners:      []PropertyOwner{},
			SourceKind:  GlobalAttributeSourceKindManaged,
			SyncSources: []string{},
		}
		b, err := json.Marshal(row)
		require.NoError(t, err)

		var decoded map[string]any
		require.NoError(t, json.Unmarshal(b, &decoded))
		assert.NotContains(t, decoded, "name_conflict")
		assert.Equal(t, []any{"user"}, decoded["applies_to"])
		assert.Equal(t, "managed", decoded["source_kind"])
		assert.Equal(t, false, decoded["is_classification"])

		row.NameConflict = &GlobalAttributeNameConflict{Field: &PropertyField{ID: "u1", Name: "Clearance"}}
		b, err = json.Marshal(row)
		require.NoError(t, err)
		require.NoError(t, json.Unmarshal(b, &decoded))
		conflict := decoded["name_conflict"].(map[string]any)
		assert.NotContains(t, conflict, "owner_template")
		assert.Equal(t, false, conflict["exact"])
	})
}
