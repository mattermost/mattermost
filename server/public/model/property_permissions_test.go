// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPropertyActionConstants(t *testing.T) {
	// The wire strings are the grid cells clients and stored grants name; they
	// are part of the contract, so pin them.
	assert.Equal(t, "field.write", PropertyActionFieldWrite)
	assert.Equal(t, "option.read", PropertyActionOptionRead)
	assert.Equal(t, "option.write", PropertyActionOptionWrite)
	assert.Equal(t, "value.read", PropertyActionValueRead)
	assert.Equal(t, "value.write", PropertyActionValueWrite)
}

func TestPermissionLevelEveryoneIsValid(t *testing.T) {
	pf := &PropertyField{
		ID:         NewId(),
		GroupID:    NewId(),
		Name:       "test field",
		Type:       PropertyFieldTypeText,
		ObjectType: PropertyFieldObjectTypePost,
		TargetType: string(PropertyFieldTargetLevelSystem),
		CreateAt:   GetMillis(),
		UpdateAt:   GetMillis(),
	}
	pf.PermissionValues = new(PermissionLevelEveryone)
	require.NoError(t, pf.IsValid())
}

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
	require.NoError(t, p.IsValid())

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
	require.Error(t, p.IsValid())
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
