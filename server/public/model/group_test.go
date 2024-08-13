package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGroupAuditable(t *testing.T) {
	t.Run("zero value", func(t *testing.T) {
		var g Group
		m := g.Auditable()
		require.NotNil(t, m)
		assert.Equal(t, "", m["remote_id"])
	})

	t.Run("values set", func(t *testing.T) {
		id := NewId()
		now := GetMillis()
		g := Group{
			Id:             id,
			Name:           NewPointer("some name"),
			DisplayName:    "some display name",
			Source:         GroupSourceLdap,
			RemoteId:       NewPointer("some_remote"),
			CreateAt:       now,
			UpdateAt:       now,
			DeleteAt:       now,
			HasSyncables:   true,
			MemberCount:    NewPointer(10),
			AllowReference: true,
		}
		m := g.Auditable()

		expected := map[string]any{
			"id":              id,
			"source":          GroupSourceLdap,
			"remote_id":       "some_remote",
			"create_at":       now,
			"update_at":       now,
			"delete_at":       now,
			"has_syncables":   true,
			"member_count":    10,
			"allow_reference": true,
		}

		assert.Equal(t, expected, m)
	})
}

func TestGroupLogClone(t *testing.T) {
	t.Run("zero value", func(t *testing.T) {
		var g Group
		l := g.LogClone()
		require.NotNil(t, l)

		m, ok := l.(map[string]interface{})
		require.True(t, ok)
		assert.Equal(t, "", m["remote_id"])
	})

	t.Run("values set", func(t *testing.T) {
		id := NewId()
		now := GetMillis()
		g := Group{
			Id:             id,
			Name:           NewPointer("some name"),
			DisplayName:    "some display name",
			Source:         GroupSourceLdap,
			RemoteId:       NewPointer("some_remote"),
			CreateAt:       now,
			UpdateAt:       now,
			DeleteAt:       now,
			HasSyncables:   true,
			MemberCount:    NewPointer(10),
			AllowReference: true,
		}
		l := g.LogClone()
		m, ok := l.(map[string]interface{})
		require.True(t, ok)

		expected := map[string]any{
			"id":              id,
			"name":            "some name",
			"display_name":    "some display name",
			"source":          GroupSourceLdap,
			"remote_id":       "some_remote",
			"create_at":       now,
			"update_at":       now,
			"delete_at":       now,
			"has_syncables":   true,
			"member_count":    10,
			"allow_reference": true,
		}

		assert.Equal(t, expected, m)
	})
}
