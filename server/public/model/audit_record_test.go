// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type testAuditable struct {
	id string
}

func (a testAuditable) Auditable() map[string]any {
	return map[string]any{"id": a.id}
}

func TestAuditRecordAddEventParameter(t *testing.T) {
	t.Run("initializes nil parameters map", func(t *testing.T) {
		rec := &AuditRecord{}
		require.Nil(t, rec.EventData.Parameters)

		rec.AddEventParameter("key", "value")

		require.NotNil(t, rec.EventData.Parameters)
		assert.Equal(t, "value", rec.EventData.Parameters["key"])
	})

	t.Run("supported value types", func(t *testing.T) {
		rec := &AuditRecord{}

		rec.AddEventParameter("string", "value")
		rec.AddEventParameter("bool", true)
		rec.AddEventParameter("int", 1)
		rec.AddEventParameter("int64", int64(2))
		rec.AddEventParameter("strings", []string{"a", "b"})
		rec.AddEventParameter("map", map[string]string{"k": "v"})

		assert.Equal(t, map[string]any{
			"string":  "value",
			"bool":    true,
			"int":     1,
			"int64":   int64(2),
			"strings": []string{"a", "b"},
			"map":     map[string]string{"k": "v"},
		}, rec.EventData.Parameters)
	})

	t.Run("keeps existing parameters", func(t *testing.T) {
		rec := &AuditRecord{}
		rec.AddEventParameter("first", "1")
		rec.AddEventParameter("second", "2")

		assert.Equal(t, map[string]any{"first": "1", "second": "2"}, rec.EventData.Parameters)
	})

	t.Run("old function wrapper matches method", func(t *testing.T) {
		viaMethod := &AuditRecord{}
		viaMethod.AddEventParameter("key", []string{"a"})
		viaFunc := &AuditRecord{}
		AddEventParameterToAuditRec(viaFunc, "key", []string{"a"})

		assert.Equal(t, viaMethod.EventData.Parameters, viaFunc.EventData.Parameters)
	})

	t.Run("nil receiver panics", func(t *testing.T) {
		var rec *AuditRecord
		assert.Panics(t, func() { rec.AddEventParameter("key", "value") })
	})
}

func TestAuditRecordAddEventParameterAuditableArray(t *testing.T) {
	t.Run("initializes nil parameters map and processes values", func(t *testing.T) {
		rec := &AuditRecord{}
		require.Nil(t, rec.EventData.Parameters)

		rec.AddEventParameterAuditableArray("items", []testAuditable{{id: "a"}, {id: "b"}})

		assert.Equal(t, map[string]any{
			"items": []map[string]any{{"id": "a"}, {"id": "b"}},
		}, rec.EventData.Parameters)
	})

	t.Run("nil slice yields empty non-nil slice", func(t *testing.T) {
		rec := &AuditRecord{}

		rec.AddEventParameterAuditableArray("items", []testAuditable(nil))

		assert.Equal(t, []map[string]any{}, rec.EventData.Parameters["items"])
	})

	t.Run("old function wrapper matches method", func(t *testing.T) {
		viaMethod := &AuditRecord{}
		viaMethod.AddEventParameterAuditableArray("items", []testAuditable{{id: "a"}})
		viaFunc := &AuditRecord{}
		AddEventParameterAuditableArrayToAuditRec(viaFunc, "items", []testAuditable{{id: "a"}})

		assert.Equal(t, viaMethod.EventData.Parameters, viaFunc.EventData.Parameters)
	})
}
