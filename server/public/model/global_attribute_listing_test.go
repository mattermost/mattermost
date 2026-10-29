// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGlobalAttributeListingJSON(t *testing.T) {
	t.Run("search decodes the documented keys", func(t *testing.T) {
		var s GlobalAttributeListingSearch
		require.NoError(t, json.Unmarshal([]byte(`{"term":"50%_off \\ clearance","source":"ldap"}`), &s))
		assert.Equal(t, GlobalAttributeListingSearch{Term: "50%_off \\ clearance", Source: "ldap"}, s)
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

func TestGlobalAttributeListingSearchIsValid(t *testing.T) {
	for name, tc := range map[string]struct {
		term  string
		valid bool
	}{
		"empty term":               {"", true},
		"term at the name limit":   {strings.Repeat("é", PropertyFieldNameMaxRunes), true},
		"term over the name limit": {strings.Repeat("a", PropertyFieldNameMaxRunes+1), false},
	} {
		t.Run(name, func(t *testing.T) {
			s := GlobalAttributeListingSearch{Term: tc.term}
			if tc.valid {
				assert.NoError(t, s.IsValid())
			} else {
				assert.Error(t, s.IsValid())
			}
		})
	}
}

func TestGlobalAttributeListingSearchSourceIsValid(t *testing.T) {
	for _, source := range []string{
		"",
		GlobalAttributeSourceManaged,
		GlobalAttributeSourcePlugin,
		GlobalAttributeSourceLDAP,
		GlobalAttributeSourceSAML,
		GlobalAttributeSourceOpenID,
	} {
		t.Run("accepts "+source, func(t *testing.T) {
			s := GlobalAttributeListingSearch{Source: source}
			assert.NoError(t, s.IsValid())
		})
	}

	for name, source := range map[string]string{
		"unknown source":             "scim",
		"source with different case": "LDAP",
		"source kind external":       GlobalAttributeSourceKindExternal,
		"hostile source":             `ldap'); DROP TABLE PropertyFields; --`,
	} {
		t.Run(name, func(t *testing.T) {
			s := GlobalAttributeListingSearch{Source: source}
			assert.Error(t, s.IsValid())
		})
	}
}

func TestGlobalAttributeListingOptsIsValid(t *testing.T) {
	valid := func() GlobalAttributeListingOpts {
		return GlobalAttributeListingOpts{GroupID: NewId()}
	}

	t.Run("minimal opts", func(t *testing.T) {
		o := valid()
		require.NoError(t, o.IsValid())
	})

	t.Run("fully populated", func(t *testing.T) {
		o := valid()
		o.Term = "x"
		o.Source = GlobalAttributeSourcePlugin
		o.AllowedResourceTypes = []string{PropertyFieldObjectTypeUser, PropertyFieldObjectTypeChannel, PropertyFieldObjectTypePost}
		o.ExcludeIDs = []string{NewId()}
		require.NoError(t, o.IsValid())
	})

	t.Run("missing group id", func(t *testing.T) {
		o := valid()
		o.GroupID = ""
		assert.Error(t, o.IsValid())
	})

	t.Run("unknown source", func(t *testing.T) {
		o := valid()
		o.Source = "ssh"
		assert.Error(t, o.IsValid())
	})

	t.Run("unknown allowed resource type", func(t *testing.T) {
		o := valid()
		o.AllowedResourceTypes = []string{PropertyFieldObjectTypeTemplate}
		assert.Error(t, o.IsValid())
	})
}
