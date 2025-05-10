// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLdapSyncOptionsToMap(t *testing.T) {
	t.Run("nil options", func(t *testing.T) {
		var opts *LdapSyncOptions
		result := opts.ToMap()
		require.Empty(t, result, "ToMap with nil options should return empty map")
	})

	t.Run("nil ReAddRemovedMembers", func(t *testing.T) {
		opts := &LdapSyncOptions{
			ReAddRemovedMembers: nil,
		}
		result := opts.ToMap()
		require.Empty(t, result, "ToMap with nil ReAddRemovedMembers should return empty map")
	})

	t.Run("ReAddRemovedMembers true", func(t *testing.T) {
		trueValue := true
		opts := &LdapSyncOptions{
			ReAddRemovedMembers: &trueValue,
		}
		result := opts.ToMap()
		require.Len(t, result, 1, "Should contain 1 entry")
		assert.Equal(t, "true", result["re_add_removed_members"], "Should convert true to string")
	})

	t.Run("ReAddRemovedMembers false", func(t *testing.T) {
		falseValue := false
		opts := &LdapSyncOptions{
			ReAddRemovedMembers: &falseValue,
		}
		result := opts.ToMap()
		require.Len(t, result, 1, "Should contain 1 entry")
		assert.Equal(t, "false", result["re_add_removed_members"], "Should convert false to string")
	})
}

func TestLdapSyncOptionsFromMap(t *testing.T) {
	t.Run("nil map", func(t *testing.T) {
		opts := &LdapSyncOptions{}
		opts.FromMap(nil)
		assert.Nil(t, opts.ReAddRemovedMembers, "FromMap with nil map should not change the struct")
	})

	t.Run("empty map", func(t *testing.T) {
		opts := &LdapSyncOptions{}
		opts.FromMap(map[string]string{})
		assert.Nil(t, opts.ReAddRemovedMembers, "FromMap with empty map should not change the struct")
	})

	t.Run("map missing the key", func(t *testing.T) {
		opts := &LdapSyncOptions{}
		opts.FromMap(map[string]string{"some_other_key": "true"})
		assert.Nil(t, opts.ReAddRemovedMembers, "FromMap with missing key should not change the struct")
	})

	t.Run("map with invalid value", func(t *testing.T) {
		opts := &LdapSyncOptions{}
		opts.FromMap(map[string]string{"re_add_removed_members": "not-a-bool"})
		assert.Nil(t, opts.ReAddRemovedMembers, "FromMap with invalid value should not set the field")
	})

	t.Run("map with true value", func(t *testing.T) {
		opts := &LdapSyncOptions{}
		opts.FromMap(map[string]string{"re_add_removed_members": "true"})
		require.NotNil(t, opts.ReAddRemovedMembers, "FromMap with true value should set the field")
		assert.True(t, *opts.ReAddRemovedMembers, "FromMap with true value should set the field to true")
	})

	t.Run("map with false value", func(t *testing.T) {
		opts := &LdapSyncOptions{}
		opts.FromMap(map[string]string{"re_add_removed_members": "false"})
		require.NotNil(t, opts.ReAddRemovedMembers, "FromMap with false value should set the field")
		assert.False(t, *opts.ReAddRemovedMembers, "FromMap with false value should set the field to false")
	})

	t.Run("with initial value being overwritten", func(t *testing.T) {
		opts := &LdapSyncOptions{
			ReAddRemovedMembers: NewPointer(true),
		}
		opts.FromMap(map[string]string{"re_add_removed_members": "false"})
		require.NotNil(t, opts.ReAddRemovedMembers, "FromMap should overwrite initial value")
		assert.False(t, *opts.ReAddRemovedMembers, "FromMap should set value to false")
	})
}
