// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPropertySyncSourceHelpers(t *testing.T) {
	t.Run("IsValidPropertySyncSource", func(t *testing.T) {
		assert.True(t, IsValidPropertySyncSource(PropertySyncSourceLDAP))
		assert.True(t, IsValidPropertySyncSource(PropertySyncSourceSAML))
		assert.False(t, IsValidPropertySyncSource(""))
		assert.False(t, IsValidPropertySyncSource("oauth"))
	})

	t.Run("PropertySyncCallerID", func(t *testing.T) {
		assert.Equal(t, CallerIDLDAPSync, PropertySyncCallerID(PropertySyncSourceLDAP))
		assert.Equal(t, CallerIDSAMLSync, PropertySyncCallerID(PropertySyncSourceSAML))
		assert.Equal(t, "", PropertySyncCallerID("oauth"))
	})

	t.Run("PropertySyncSourceAttr", func(t *testing.T) {
		assert.Equal(t, PropertyFieldAttrLDAP, PropertySyncSourceAttr(PropertySyncSourceLDAP))
		assert.Equal(t, PropertyFieldAttrSAML, PropertySyncSourceAttr(PropertySyncSourceSAML))
		assert.Equal(t, "", PropertySyncSourceAttr("oauth"))
	})

	t.Run("sources match GetPropertyFieldSyncSource", func(t *testing.T) {
		ldapField := &PropertyField{Attrs: StringInterface{PropertyFieldAttrLDAP: "memberOf"}}
		samlField := &PropertyField{Attrs: StringInterface{PropertyFieldAttrSAML: "groups"}}
		assert.Equal(t, PropertySyncSourceLDAP, GetPropertyFieldSyncSource(ldapField))
		assert.Equal(t, PropertySyncSourceSAML, GetPropertyFieldSyncSource(samlField))
	})
}

func TestPropertySyncResult(t *testing.T) {
	t.Run("nil result is safe", func(t *testing.T) {
		var r *PropertySyncResult
		assert.Equal(t, 0, r.Count(PropertySyncFieldUpdated))
		assert.False(t, r.Changed())
		assert.False(t, r.HasErrors())
	})

	r := &PropertySyncResult{Fields: []PropertySyncFieldOutcome{
		{Status: PropertySyncFieldUpdated},
		{Status: PropertySyncFieldUnchanged},
		{Status: PropertySyncFieldUnchanged},
		{Status: PropertySyncFieldCleared},
		{Status: PropertySyncFieldSkipped},
	}}

	t.Run("Count", func(t *testing.T) {
		assert.Equal(t, 1, r.Count(PropertySyncFieldUpdated))
		assert.Equal(t, 2, r.Count(PropertySyncFieldUnchanged))
		assert.Equal(t, 1, r.Count(PropertySyncFieldCleared))
		assert.Equal(t, 1, r.Count(PropertySyncFieldSkipped))
		assert.Equal(t, 0, r.Count(PropertySyncFieldError))
	})

	t.Run("Changed counts updates and clears", func(t *testing.T) {
		assert.True(t, r.Changed())
		assert.False(t, (&PropertySyncResult{Fields: []PropertySyncFieldOutcome{{Status: PropertySyncFieldUnchanged}}}).Changed())
	})

	t.Run("HasErrors", func(t *testing.T) {
		assert.False(t, r.HasErrors())
		r.Fields = append(r.Fields, PropertySyncFieldOutcome{Status: PropertySyncFieldError})
		assert.True(t, r.HasErrors())
	})
}

func TestPropertySyncPruneResult(t *testing.T) {
	var nilResult *PropertySyncPruneResult
	require.Equal(t, 0, nilResult.OptionsPruned())

	r := &PropertySyncPruneResult{Fields: []PropertySyncPrunedField{
		{FieldID: NewId(), OptionIDs: []string{NewId(), NewId()}},
		{FieldID: NewId(), OptionIDs: []string{NewId()}},
	}}
	assert.Equal(t, 3, r.OptionsPruned())
}
