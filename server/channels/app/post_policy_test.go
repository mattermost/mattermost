// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// selectField builds a select-typed *PropertyField with the given options for
// resolvePostValueForCEL tests. Options are stored as []*CustomProfileAttributesSelectOption
// to mirror the shape produced by EnsureOptionIDs in production.
func selectField(name string, opts ...[2]string) *model.PropertyField {
	options := make([]*model.CustomProfileAttributesSelectOption, len(opts))
	for i, kv := range opts {
		options[i] = &model.CustomProfileAttributesSelectOption{ID: kv[0], Name: kv[1]}
	}
	return &model.PropertyField{
		Name: name,
		Type: model.PropertyFieldTypeSelect,
		Attrs: model.StringInterface{
			model.PropertyFieldAttributeOptions: options,
		},
	}
}

func multiselectField(name string, opts ...[2]string) *model.PropertyField {
	f := selectField(name, opts...)
	f.Type = model.PropertyFieldTypeMultiselect
	return f
}

func textField(name string) *model.PropertyField {
	return &model.PropertyField{Name: name, Type: model.PropertyFieldTypeText}
}

func mustRaw(t *testing.T, v any) []byte {
	t.Helper()
	b, err := json.Marshal(v)
	require.NoError(t, err)
	return b
}

func TestBlankedPostFor(t *testing.T) {
	t.Run("returns clone with message, file ids and attachments cleared and sentinel set", func(t *testing.T) {
		p := &model.Post{
			Id:        "p1",
			UserId:    "u1",
			ChannelId: "c1",
			CreateAt:  10,
			Type:      "",
			Message:   "top secret",
			FileIds:   []string{"f1", "f2"},
			Props: model.StringInterface{
				model.PostPropsAttachments: []any{map[string]any{"text": "secret"}},
				"keep_me":                  "ok",
			},
		}

		blanked := blankedPostFor(p)

		require.NotSame(t, p, blanked, "must return a different pointer (avoid cache poisoning)")
		require.Equal(t, "top secret", p.Message, "original message must NOT be mutated")
		require.Equal(t, model.StringArray{"f1", "f2"}, p.FileIds, "original FileIds must NOT be mutated")
		require.Nil(t, p.Props[model.PostPropsHiddenByPolicy], "original Props must NOT gain the sentinel")
		require.NotNil(t, p.Props[model.PostPropsAttachments], "original attachments must remain")

		require.Equal(t, "p1", blanked.Id, "Id must remain on clone")
		require.Equal(t, "u1", blanked.UserId, "UserId must remain on clone")
		require.Equal(t, "c1", blanked.ChannelId, "ChannelId must remain on clone")
		require.Equal(t, int64(10), blanked.CreateAt, "CreateAt must remain on clone")
		require.Empty(t, blanked.Message, "Message must be blanked on clone")
		require.Nil(t, blanked.FileIds, "FileIds must be cleared on clone")
		require.Nil(t, blanked.Props[model.PostPropsAttachments], "attachments prop must be cleared on clone")
		require.Equal(t, true, blanked.Props[model.PostPropsHiddenByPolicy], "sentinel prop must be set on clone")
		require.Equal(t, "ok", blanked.Props["keep_me"], "unrelated props are not stripped")
	})

	t.Run("initializes Props on clone when source has nil Props", func(t *testing.T) {
		p := &model.Post{Id: "p2", Message: "hi"}
		blanked := blankedPostFor(p)
		require.NotNil(t, blanked.Props)
		require.Equal(t, true, blanked.Props[model.PostPropsHiddenByPolicy])
		require.Nil(t, p.Props, "original must not gain a Props map")
	})

	t.Run("nil post returns nil", func(t *testing.T) {
		require.Nil(t, blankedPostFor(nil))
	})
}

func TestResolvePostValueForCEL(t *testing.T) {
	t.Run("text field — JSON string passes through", func(t *testing.T) {
		got, err := resolvePostValueForCEL(textField("note"), mustRaw(t, "hello"))
		require.NoError(t, err)
		require.Equal(t, "hello", got)
	})

	t.Run("text field — number passes through", func(t *testing.T) {
		got, err := resolvePostValueForCEL(textField("count"), mustRaw(t, 42))
		require.NoError(t, err)
		require.InEpsilon(t, 42.0, got.(float64), 0.0001)
	})

	t.Run("text field — boolean passes through", func(t *testing.T) {
		got, err := resolvePostValueForCEL(textField("flag"), mustRaw(t, true))
		require.NoError(t, err)
		require.Equal(t, true, got)
	})

	t.Run("select field — option id resolves to name", func(t *testing.T) {
		f := selectField("lvl", [2]string{"opt_l1", "L1"}, [2]string{"opt_l2", "L2"})
		got, err := resolvePostValueForCEL(f, mustRaw(t, "opt_l1"))
		require.NoError(t, err)
		require.Equal(t, "L1", got, "rule like post.attributes.lvl == \"L1\" must see the resolved name")
	})

	t.Run("select field — unknown option id falls through as raw id", func(t *testing.T) {
		// Deliberate: returning the raw id (not "") makes mismatches visible
		// when an option was deleted after a value was stored.
		f := selectField("lvl", [2]string{"opt_l1", "L1"})
		got, err := resolvePostValueForCEL(f, mustRaw(t, "opt_deleted"))
		require.NoError(t, err)
		require.Equal(t, "opt_deleted", got)
	})

	t.Run("select field — empty string id passes through", func(t *testing.T) {
		f := selectField("lvl", [2]string{"opt_l1", "L1"})
		got, err := resolvePostValueForCEL(f, mustRaw(t, ""))
		require.NoError(t, err)
		require.Equal(t, "", got)
	})

	t.Run("select field — missing options attr returns raw id", func(t *testing.T) {
		f := &model.PropertyField{Name: "lvl", Type: model.PropertyFieldTypeSelect}
		got, err := resolvePostValueForCEL(f, mustRaw(t, "opt_l1"))
		require.NoError(t, err)
		require.Equal(t, "opt_l1", got)
	})

	t.Run("select field — non-string JSON falls through to generic decode", func(t *testing.T) {
		f := selectField("lvl", [2]string{"opt_l1", "L1"})
		got, err := resolvePostValueForCEL(f, mustRaw(t, 42))
		require.NoError(t, err)
		require.InEpsilon(t, 42.0, got.(float64), 0.0001)
	})

	t.Run("multiselect field — ids resolve to names []any", func(t *testing.T) {
		f := multiselectField("tags",
			[2]string{"opt_l1", "L1"},
			[2]string{"opt_l2", "L2"},
			[2]string{"opt_eng", "Engineering"},
		)
		got, err := resolvePostValueForCEL(f, mustRaw(t, []string{"opt_l1", "opt_eng"}))
		require.NoError(t, err)
		require.Equal(t, []any{"L1", "Engineering"}, got,
			"shape must be []any so structpb.NewValue accepts it; values are the resolved names")
	})

	t.Run("multiselect field — partial unknown ids keep raw id", func(t *testing.T) {
		f := multiselectField("tags", [2]string{"opt_l1", "L1"})
		got, err := resolvePostValueForCEL(f, mustRaw(t, []string{"opt_l1", "opt_deleted"}))
		require.NoError(t, err)
		require.Equal(t, []any{"L1", "opt_deleted"}, got)
	})

	t.Run("multiselect field — empty array yields empty []any", func(t *testing.T) {
		f := multiselectField("tags", [2]string{"opt_l1", "L1"})
		got, err := resolvePostValueForCEL(f, mustRaw(t, []string{}))
		require.NoError(t, err)
		require.Equal(t, []any{}, got)
	})

	t.Run("multiselect field — non-array JSON falls through to generic decode", func(t *testing.T) {
		f := multiselectField("tags", [2]string{"opt_l1", "L1"})
		got, err := resolvePostValueForCEL(f, mustRaw(t, "opt_l1"))
		require.NoError(t, err)
		require.Equal(t, "opt_l1", got)
	})

	t.Run("nil field returns nil", func(t *testing.T) {
		got, err := resolvePostValueForCEL(nil, mustRaw(t, "x"))
		require.NoError(t, err)
		require.Nil(t, got)
	})

	t.Run("empty raw returns nil", func(t *testing.T) {
		got, err := resolvePostValueForCEL(textField("note"), nil)
		require.NoError(t, err)
		require.Nil(t, got)
	})

	t.Run("malformed JSON returns error", func(t *testing.T) {
		_, err := resolvePostValueForCEL(textField("note"), []byte("{not json"))
		require.Error(t, err)
	})
}

func TestLookupPostOptionName(t *testing.T) {
	t.Run("nil field returns raw id", func(t *testing.T) {
		require.Equal(t, "opt_x", lookupPostOptionName(nil, "opt_x"))
	})

	t.Run("nil Attrs returns raw id", func(t *testing.T) {
		f := &model.PropertyField{Name: "x", Type: model.PropertyFieldTypeSelect}
		require.Equal(t, "opt_x", lookupPostOptionName(f, "opt_x"))
	})

	t.Run("options stored as []map[string]any (raw JSON round-trip)", func(t *testing.T) {
		// EnsureOptionIDs normalises options to []any of map[string]any, so
		// the lookup must work on that exact shape.
		f := &model.PropertyField{
			Name: "lvl",
			Type: model.PropertyFieldTypeSelect,
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt_l1", "name": "L1"},
					map[string]any{"id": "opt_l2", "name": "L2"},
				},
			},
		}
		require.Equal(t, "L2", lookupPostOptionName(f, "opt_l2"))
	})

	t.Run("malformed options blob returns raw id", func(t *testing.T) {
		f := &model.PropertyField{
			Name: "lvl",
			Type: model.PropertyFieldTypeSelect,
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: "not-a-list",
			},
		}
		require.Equal(t, "opt_l1", lookupPostOptionName(f, "opt_l1"))
	})
}
