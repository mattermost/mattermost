// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPermissionsJSONRoundTrip(t *testing.T) {
	// The Department field from §3.1: the JSON tags must match the spec wire
	// shape, and the three parts must decode into their typed fields.
	raw := []byte(`{
		"restrictions": {
			"value":  { "read": "everyone", "write": "none" },
			"field":  { "write": "sysadmin" }
		},
		"grants": [
			{ "type": "plugin", "id": "com.mattermost.scim", "scopes": ["entra"], "allow": ["value.write"] }
		],
		"masking": { "mask_by_field_id": "somefield", "except": [ { "type": "plugin", "id": "com.example" } ] }
	}`)

	var p Permissions
	require.NoError(t, json.Unmarshal(raw, &p))

	require.NotNil(t, p.Restrictions)
	assert.Equal(t, PermissionLevelEveryone, p.Restrictions.Value.Read)
	assert.Equal(t, PermissionLevelNone, p.Restrictions.Value.Write)
	assert.Equal(t, PermissionLevelSysadmin, p.Restrictions.Field.Write)

	require.Len(t, p.Grants, 1)
	assert.Equal(t, PropertyOwnerTypePlugin, p.Grants[0].Type)
	assert.Equal(t, "com.mattermost.scim", p.Grants[0].ID)
	assert.Equal(t, []string{"entra"}, p.Grants[0].Scopes)
	assert.Equal(t, []string{PropertyActionValueWrite}, p.Grants[0].Allow)

	require.NotNil(t, p.Masking)
	assert.Equal(t, "somefield", p.Masking.MaskByFieldID)
	require.Len(t, p.Masking.Except, 1)
	assert.Equal(t, "com.example", p.Masking.Except[0].ID)

	// Round-trips back to equivalent JSON.
	out, err := json.Marshal(&p)
	require.NoError(t, err)
	var p2 Permissions
	require.NoError(t, json.Unmarshal(out, &p2))
	assert.Equal(t, p, p2)
}

func TestRestrictionsLeafDefaulting(t *testing.T) {
	p := &Permissions{Restrictions: &Restrictions{
		Value: ReadWrite{Read: PermissionLevelEveryone},
	}}
	require.NoError(t, p.IsValid(""))

	// The one set leaf is kept; the other four are filled to none explicitly.
	assert.Equal(t, PermissionLevelEveryone, p.Restrictions.Value.Read)
	assert.Equal(t, PermissionLevelNone, p.Restrictions.Value.Write)
	assert.Equal(t, PermissionLevelNone, p.Restrictions.Option.Read)
	assert.Equal(t, PermissionLevelNone, p.Restrictions.Option.Write)
	assert.Equal(t, PermissionLevelNone, p.Restrictions.Field.Write)
}

func TestRestrictionsRejectsInvalidTier(t *testing.T) {
	p := &Permissions{Restrictions: &Restrictions{
		Value: ReadWrite{Write: PermissionLevel("bogus")},
	}}
	require.Error(t, p.IsValid(""))
}

func TestFieldReadRejectedOnUnmarshal(t *testing.T) {
	// field.read is not enforced and must be rejected as an input key, not
	// silently dropped.
	err := json.Unmarshal([]byte(`{"restrictions":{"field":{"read":"everyone","write":"sysadmin"}}}`), &Permissions{})
	require.Error(t, err)

	// A field block with only write still parses.
	var p Permissions
	require.NoError(t, json.Unmarshal([]byte(`{"restrictions":{"field":{"write":"sysadmin"}}}`), &p))
	assert.Equal(t, PermissionLevelSysadmin, p.Restrictions.Field.Write)
}

func TestGrantsValidation(t *testing.T) {
	grant := func(g Grant) *Permissions { return &Permissions{Grants: []Grant{g}} }

	t.Run("valid grant", func(t *testing.T) {
		require.NoError(t, grant(Grant{
			Identity: Identity{Type: PropertyOwnerTypePlugin, ID: "com.example"},
			Scopes:   []string{"entra"},
			Allow:    []string{PropertyActionValueRead, PropertyActionValueWrite},
		}).IsValid(""))
	})

	t.Run("empty allow rejected", func(t *testing.T) {
		require.Error(t, grant(Grant{Identity: Identity{Type: PropertyOwnerTypePlugin, ID: "com.example"}}).IsValid(""))
	})

	t.Run("unknown action rejected", func(t *testing.T) {
		require.Error(t, grant(Grant{Identity: Identity{Type: PropertyOwnerTypeUser, ID: NewId()}, Allow: []string{"field.read"}}).IsValid(""))
	})

	t.Run("wildcard action rejected", func(t *testing.T) {
		require.Error(t, grant(Grant{Identity: Identity{Type: PropertyOwnerTypePlugin, ID: "com.example"}, Allow: []string{"*"}}).IsValid(""))
	})

	t.Run("wildcard id allowed for plugin, rejected for user", func(t *testing.T) {
		require.NoError(t, grant(Grant{Identity: Identity{Type: PropertyOwnerTypePlugin, ID: "*"}, Allow: []string{PropertyActionValueWrite}}).IsValid(""))
		require.NoError(t, grant(Grant{Identity: Identity{Type: PropertyOwnerTypeService, ID: "*"}, Allow: []string{PropertyActionValueWrite}}).IsValid(""))
		require.Error(t, grant(Grant{Identity: Identity{Type: PropertyOwnerTypeUser, ID: "*"}, Allow: []string{PropertyActionValueWrite}}).IsValid(""))
		require.Error(t, grant(Grant{Identity: Identity{Type: PropertyOwnerTypeRole, ID: "*"}, Allow: []string{PropertyActionValueWrite}}).IsValid(""))
	})

	t.Run("invalid type rejected", func(t *testing.T) {
		require.Error(t, grant(Grant{Identity: Identity{Type: "bogus", ID: "x"}, Allow: []string{PropertyActionValueWrite}}).IsValid(""))
	})

	t.Run("missing id rejected", func(t *testing.T) {
		require.Error(t, grant(Grant{Identity: Identity{Type: PropertyOwnerTypePlugin}, Allow: []string{PropertyActionValueWrite}}).IsValid(""))
	})

	t.Run("malformed scope rejected", func(t *testing.T) {
		require.Error(t, grant(Grant{Identity: Identity{Type: PropertyOwnerTypePlugin, ID: "com.example"}, Scopes: []string{"a b"}, Allow: []string{PropertyActionValueWrite}}).IsValid(""))
	})
}

func TestMaskingValidation(t *testing.T) {
	t.Run("empty masking is valid", func(t *testing.T) {
		require.NoError(t, (&Permissions{Masking: &Masking{}}).IsValid(PropertyFieldObjectTypeUser))
	})

	t.Run("wildcard except rejected", func(t *testing.T) {
		p := &Permissions{Masking: &Masking{Except: []Identity{{Type: PropertyOwnerTypePlugin, ID: "*"}}}}
		require.Error(t, p.IsValid(PropertyFieldObjectTypeChannel))
	})

	t.Run("except with bad type or missing id rejected", func(t *testing.T) {
		require.Error(t, (&Permissions{Masking: &Masking{Except: []Identity{{Type: "bogus", ID: "x"}}}}).IsValid(""))
		require.Error(t, (&Permissions{Masking: &Masking{Except: []Identity{{Type: PropertyOwnerTypePlugin}}}}).IsValid(""))
	})

	t.Run("valid non-wildcard except passes", func(t *testing.T) {
		p := &Permissions{Masking: &Masking{Except: []Identity{{Type: PropertyOwnerTypePlugin, ID: "com.example"}}}}
		require.NoError(t, p.IsValid(PropertyFieldObjectTypeUser))
	})

	t.Run("mask_by_field_id rejected off a template", func(t *testing.T) {
		p := &Permissions{Masking: &Masking{MaskByFieldID: "sampleid"}}
		require.Error(t, p.IsValid(PropertyFieldObjectTypeUser))
	})

	t.Run("masked non-user field with no mask_by_field_id has no resolvable holdings", func(t *testing.T) {
		p := &Permissions{Masking: &Masking{}}
		require.Error(t, p.IsValid(PropertyFieldObjectTypeChannel))
	})

	t.Run("self-writable user field rejected", func(t *testing.T) {
		for _, w := range []PermissionLevel{PermissionLevelMember, PermissionLevelEveryone} {
			p := &Permissions{
				Restrictions: &Restrictions{Value: ReadWrite{Write: w}},
				Masking:      &Masking{},
			}
			require.Error(t, p.IsValid(PropertyFieldObjectTypeUser), "value.write %s", w)
		}
	})

	t.Run("admin/none/sysadmin user field allowed", func(t *testing.T) {
		for _, w := range []PermissionLevel{PermissionLevelNone, PermissionLevelAdmin, PermissionLevelSysadmin} {
			p := &Permissions{
				Restrictions: &Restrictions{Value: ReadWrite{Write: w}},
				Masking:      &Masking{},
			}
			require.NoError(t, p.IsValid(PropertyFieldObjectTypeUser), "value.write %s", w)
		}
	})

	t.Run("self-writable rule does not apply to non-user objects", func(t *testing.T) {
		p := &Permissions{
			Restrictions: &Restrictions{Value: ReadWrite{Write: PermissionLevelMember}},
			Masking:      &Masking{MaskByFieldID: "sampleid"},
		}
		require.NoError(t, p.IsValid(PropertyFieldObjectTypeTemplate))
	})
}

// TestWorkedExamplesValidate parses the §3 permissions blocks as written and
// confirms each validates against its field's object type.
func TestWorkedExamplesValidate(t *testing.T) {
	cases := []struct {
		name       string
		objectType string
		json       string
	}{
		{"3.1 Department", PropertyFieldObjectTypeUser,
			`{"restrictions":{"value":{"read":"everyone","write":"none"},"field":{"write":"sysadmin"}},
			  "grants":[{"type":"plugin","id":"com.mattermost.scim","scopes":["entra"],"allow":["value.write"]}]}`},
		{"3.1 LDAP service variant", PropertyFieldObjectTypeUser,
			`{"grants":[{"type":"service","id":"ldap","allow":["value.write"]}]}`},
		{"3.2 CostCenter", PropertyFieldObjectTypeUser,
			`{"restrictions":{"value":{"read":"everyone","write":"admin"},"option":{"read":"everyone","write":"sysadmin"},"field":{"write":"sysadmin"}},
			  "grants":[{"type":"user","id":"someuserid","allow":["value.write"]},
			            {"type":"role","id":"finance_admin","allow":["value.write","option.write"]}]}`},
		{"3.3 ProjectCodename", PropertyFieldObjectTypeUser,
			`{"restrictions":{"value":{"read":"everyone","write":"none"}},
			  "grants":[{"type":"service","id":"ldap","allow":["value.write"]}],"masking":{}}`},
		{"3.4 ProgramsTemplate", PropertyFieldObjectTypeTemplate,
			`{"restrictions":{"field":{"write":"sysadmin"},"option":{"write":"sysadmin"}},
			  "masking":{"mask_by_field_id":"UserPrograms","except":[{"type":"plugin","id":"com.example.programs-manager"}]}}`},
		{"3.4 UserPrograms", PropertyFieldObjectTypeUser,
			`{"restrictions":{"value":{"read":"everyone","write":"none"}},
			  "grants":[{"type":"service","id":"ldap","allow":["value.write"]}]}`},
		{"3.4 ChannelPrograms", PropertyFieldObjectTypeChannel,
			`{"restrictions":{"value":{"read":"member","write":"admin"},"option":{"read":"member"}}}`},
		{"3.5 FlagReason", PropertyFieldObjectTypePost,
			`{"restrictions":{"value":{"read":"none","write":"none"},"option":{"read":"none","write":"sysadmin"},"field":{"write":"sysadmin"}},
			  "grants":[{"type":"role","id":"content_reviewer","allow":["value.read","option.read","value.write"]},
			            {"type":"plugin","id":"com.mattermost.content-flagging","allow":["value.read","value.write"]}]}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var p Permissions
			require.NoError(t, json.Unmarshal([]byte(tc.json), &p))
			require.NoError(t, p.IsValid(tc.objectType))
		})
	}
}

func TestRestrictionsTierFor(t *testing.T) {
	r := &Restrictions{
		Value:  ReadWrite{Read: PermissionLevelEveryone, Write: PermissionLevelAdmin},
		Option: ReadWrite{Read: PermissionLevelMember, Write: PermissionLevelSysadmin},
		Field:  WriteOnly{Write: PermissionLevelSysadmin},
	}
	assert.Equal(t, PermissionLevelSysadmin, r.TierFor(PropertyActionFieldWrite))
	assert.Equal(t, PermissionLevelMember, r.TierFor(PropertyActionOptionRead))
	assert.Equal(t, PermissionLevelSysadmin, r.TierFor(PropertyActionOptionWrite))
	assert.Equal(t, PermissionLevelEveryone, r.TierFor(PropertyActionValueRead))
	assert.Equal(t, PermissionLevelAdmin, r.TierFor(PropertyActionValueWrite))

	// field.read is not an enforced action and resolves like any unknown one.
	assert.Equal(t, PermissionLevelNone, r.TierFor("field.read"))
	assert.Equal(t, PermissionLevelNone, r.TierFor("bogus"))

	// A leaf that was never set (empty string) resolves to none too.
	assert.Equal(t, PermissionLevelNone, (&Restrictions{}).TierFor(PropertyActionValueRead))

	// A nil receiver grants no human anything.
	var nilRestrictions *Restrictions
	assert.Equal(t, PermissionLevelNone, nilRestrictions.TierFor(PropertyActionValueRead))
}

func TestPropertyActionMeasuredAgainstValueObject(t *testing.T) {
	assert.True(t, PropertyActionMeasuredAgainstValueObject(PropertyActionValueRead))
	assert.True(t, PropertyActionMeasuredAgainstValueObject(PropertyActionValueWrite))
	assert.False(t, PropertyActionMeasuredAgainstValueObject(PropertyActionFieldWrite))
	assert.False(t, PropertyActionMeasuredAgainstValueObject(PropertyActionOptionRead))
	assert.False(t, PropertyActionMeasuredAgainstValueObject(PropertyActionOptionWrite))
}

func TestPermissionsMatchingGrant(t *testing.T) {
	grant := func(g Grant) *Permissions { return &Permissions{Grants: []Grant{g}} }

	t.Run("exact id match", func(t *testing.T) {
		p := grant(Grant{Identity: Identity{Type: PropertyOwnerTypeUser, ID: "u1"}, Allow: []string{PropertyActionValueWrite}})
		g := p.MatchingGrant(PropertyOwnerTypeUser, "u1", "", PropertyActionValueWrite)
		require.NotNil(t, g)
		assert.Equal(t, "u1", g.ID)
	})

	t.Run("wildcard matches plugin and service", func(t *testing.T) {
		p := grant(Grant{Identity: Identity{Type: PropertyOwnerTypePlugin, ID: "*"}, Allow: []string{PropertyActionValueWrite}})
		require.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "com.example", "", PropertyActionValueWrite))

		p2 := grant(Grant{Identity: Identity{Type: PropertyOwnerTypeService, ID: "*"}, Allow: []string{PropertyActionValueWrite}})
		require.NotNil(t, p2.MatchingGrant(PropertyOwnerTypeService, "ldap", "", PropertyActionValueWrite))
	})

	t.Run("wildcard rejected for user and role", func(t *testing.T) {
		p := grant(Grant{Identity: Identity{Type: PropertyOwnerTypeUser, ID: "*"}, Allow: []string{PropertyActionValueWrite}})
		assert.Nil(t, p.MatchingGrant(PropertyOwnerTypeUser, "u1", "", PropertyActionValueWrite))

		p2 := grant(Grant{Identity: Identity{Type: PropertyOwnerTypeRole, ID: "*"}, Allow: []string{PropertyActionValueWrite}})
		assert.Nil(t, p2.MatchingGrant(PropertyOwnerTypeRole, "finance_admin", "", PropertyActionValueWrite))
	})

	t.Run("wrong type does not match", func(t *testing.T) {
		p := grant(Grant{Identity: Identity{Type: PropertyOwnerTypeUser, ID: "u1"}, Allow: []string{PropertyActionValueWrite}})
		assert.Nil(t, p.MatchingGrant(PropertyOwnerTypeRole, "u1", "", PropertyActionValueWrite))
	})

	t.Run("unscoped grant matches scoped and unscoped caller", func(t *testing.T) {
		p := grant(Grant{Identity: Identity{Type: PropertyOwnerTypePlugin, ID: "com.example"}, Allow: []string{PropertyActionValueWrite}})
		require.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "com.example", "entra", PropertyActionValueWrite))
		require.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "com.example", "", PropertyActionValueWrite))
	})

	t.Run("scoped grant matches only the listed scope, not empty", func(t *testing.T) {
		p := grant(Grant{Identity: Identity{Type: PropertyOwnerTypePlugin, ID: "com.example"}, Scopes: []string{"entra"}, Allow: []string{PropertyActionValueWrite}})
		require.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "com.example", "entra", PropertyActionValueWrite))
		assert.Nil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "com.example", "", PropertyActionValueWrite))
		assert.Nil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "com.example", "other", PropertyActionValueWrite))
	})

	t.Run("action absent from allow does not match", func(t *testing.T) {
		p := grant(Grant{Identity: Identity{Type: PropertyOwnerTypeUser, ID: "u1"}, Allow: []string{PropertyActionValueWrite}})
		assert.Nil(t, p.MatchingGrant(PropertyOwnerTypeUser, "u1", "", PropertyActionValueRead))
	})

	t.Run("fail-closed cases", func(t *testing.T) {
		p := grant(Grant{Identity: Identity{Type: PropertyOwnerTypePlugin, ID: "*"}, Allow: []string{PropertyActionValueWrite}})
		assert.Nil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "", "", PropertyActionValueWrite), "empty caller id")
		assert.Nil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "*", "", PropertyActionValueWrite), "wildcard caller id")
		assert.Nil(t, p.MatchingGrant("bogus", "com.example", "", PropertyActionValueWrite), "unrecognized caller type")

		var nilPermissions *Permissions
		assert.Nil(t, nilPermissions.MatchingGrant(PropertyOwnerTypePlugin, "com.example", "", PropertyActionValueWrite), "nil receiver")

		assert.Nil(t, (&Permissions{}).MatchingGrant(PropertyOwnerTypePlugin, "com.example", "", PropertyActionValueWrite), "empty grants")
	})
}

func TestPropertyFieldPermissionsWiring(t *testing.T) {
	base := func(objectType string) *PropertyField {
		pf := &PropertyField{
			ID:         NewId(),
			GroupID:    NewId(),
			Name:       "test field",
			Type:       PropertyFieldTypeText,
			ObjectType: objectType,
			TargetType: string(PropertyFieldTargetLevelSystem),
			CreateAt:   GetMillis(),
			UpdateAt:   GetMillis(),
		}
		return pf
	}

	t.Run("valid permissions pass and normalize through the field", func(t *testing.T) {
		pf := base(PropertyFieldObjectTypeUser)
		pf.Permissions = &Permissions{Restrictions: &Restrictions{Value: ReadWrite{Read: PermissionLevelEveryone}}}
		require.NoError(t, pf.IsValid())
		// IsValid normalized the omitted leaves in place.
		assert.Equal(t, PermissionLevelNone, pf.Permissions.Restrictions.Value.Write)
		assert.Equal(t, PermissionLevelNone, pf.Permissions.Restrictions.Field.Write)
	})

	t.Run("an invalid grant surfaces as a field error", func(t *testing.T) {
		pf := base(PropertyFieldObjectTypeUser)
		pf.Permissions = &Permissions{Grants: []Grant{{Identity: Identity{Type: PropertyOwnerTypePlugin, ID: "x"}}}} // empty allow
		require.Error(t, pf.IsValid())
	})

	t.Run("self-writable masked user field surfaces as a field error", func(t *testing.T) {
		pf := base(PropertyFieldObjectTypeUser)
		pf.Permissions = &Permissions{
			Restrictions: &Restrictions{Value: ReadWrite{Write: PermissionLevelMember}},
			Masking:      &Masking{},
		}
		require.Error(t, pf.IsValid())
	})

	t.Run("PSAv1 field cannot carry permissions", func(t *testing.T) {
		pf := base(PropertyFieldObjectTypeUser)
		pf.ObjectType = "" // PSAv1
		pf.Permissions = &Permissions{Restrictions: &Restrictions{Value: ReadWrite{Read: PermissionLevelEveryone}}}
		require.Error(t, pf.IsValid())
	})

	t.Run("nil permissions is fine", func(t *testing.T) {
		require.NoError(t, base(PropertyFieldObjectTypeUser).IsValid())
	})
}
