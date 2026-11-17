// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSystemSettingPolicyOrderIsValid(t *testing.T) {
	t.Run("accepts an empty order", func(t *testing.T) {
		assert.Nil(t, (&SystemSettingPolicyOrder{}).IsValid())
	})

	t.Run("accepts distinct valid IDs", func(t *testing.T) {
		assert.Nil(t, (&SystemSettingPolicyOrder{PolicyIDs: []string{NewId(), NewId()}}).IsValid())
	})

	t.Run("rejects malformed IDs", func(t *testing.T) {
		appErr := (&SystemSettingPolicyOrder{PolicyIDs: []string{NewId(), "not-an-id"}}).IsValid()
		require.NotNil(t, appErr)
		assert.Equal(t, "model.system_setting_policy_order.is_valid.id.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("rejects duplicate IDs", func(t *testing.T) {
		id := NewId()
		appErr := (&SystemSettingPolicyOrder{PolicyIDs: []string{id, NewId(), id}}).IsValid()
		require.NotNil(t, appErr)
		assert.Equal(t, "model.system_setting_policy_order.is_valid.duplicate.app_error", appErr.Id)
	})

	t.Run("bounds the order to what fits in a Systems value", func(t *testing.T) {
		ids := make([]string, 0, MaxSystemSettingPolicyOrderLength)
		for range MaxSystemSettingPolicyOrderLength {
			ids = append(ids, NewId())
		}
		require.Nil(t, (&SystemSettingPolicyOrder{PolicyIDs: ids}).IsValid())
		assert.LessOrEqual(t, len(strings.Join(ids, ",")), 1024)

		appErr := (&SystemSettingPolicyOrder{PolicyIDs: append(ids, NewId())}).IsValid()
		require.NotNil(t, appErr)
		assert.Equal(t, "model.system_setting_policy_order.is_valid.too_many.app_error", appErr.Id)
	})
}
