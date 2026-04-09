// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"fmt"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// testHook is a configurable PropertyHook implementation for testing hook
// registration, ordering, chaining, and blocking behavior. It embeds
// BasePropertyHook for default passthrough behavior and only overrides
// methods where a test-specific function is set.
type testHook struct {
	BasePropertyHook
	preCreateFieldFn  func(*model.PropertyField) (*model.PropertyField, error)
	preUpdateFieldFn  func(string, *model.PropertyField) (*model.PropertyField, error)
	preUpdateFieldsFn func(string, []*model.PropertyField) ([]*model.PropertyField, error)
	preDeleteFieldFn  func(string, string) error
	postGetFieldFn    func(*model.PropertyField) (*model.PropertyField, error)
	postGetFieldsFn   func([]*model.PropertyField) ([]*model.PropertyField, error)
	preUpsertValueFn  func(*model.PropertyValue) (*model.PropertyValue, error)
	preUpsertValuesFn func([]*model.PropertyValue) ([]*model.PropertyValue, error)
	postGetValueFn    func(*model.PropertyValue) (*model.PropertyValue, error)
	postGetValuesFn   func([]*model.PropertyValue) ([]*model.PropertyValue, error)
}

func (h *testHook) PreCreatePropertyField(_ request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	if h.preCreateFieldFn != nil {
		return h.preCreateFieldFn(field)
	}
	return field, nil
}

func (h *testHook) PreUpdatePropertyField(_ request.CTX, groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	if h.preUpdateFieldFn != nil {
		return h.preUpdateFieldFn(groupID, field)
	}
	return field, nil
}

func (h *testHook) PreUpdatePropertyFields(_ request.CTX, groupID string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	if h.preUpdateFieldsFn != nil {
		return h.preUpdateFieldsFn(groupID, fields)
	}
	return fields, nil
}

func (h *testHook) PreDeletePropertyField(_ request.CTX, groupID string, id string) error {
	if h.preDeleteFieldFn != nil {
		return h.preDeleteFieldFn(groupID, id)
	}
	return nil
}

func (h *testHook) PostGetPropertyField(_ request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	if h.postGetFieldFn != nil {
		return h.postGetFieldFn(field)
	}
	return field, nil
}

func (h *testHook) PostGetPropertyFields(_ request.CTX, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	if h.postGetFieldsFn != nil {
		return h.postGetFieldsFn(fields)
	}
	return fields, nil
}

func (h *testHook) PreUpsertPropertyValue(_ request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if h.preUpsertValueFn != nil {
		return h.preUpsertValueFn(value)
	}
	return value, nil
}

func (h *testHook) PreUpsertPropertyValues(_ request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if h.preUpsertValuesFn != nil {
		return h.preUpsertValuesFn(values)
	}
	return values, nil
}

func (h *testHook) PostGetPropertyValue(_ request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if h.postGetValueFn != nil {
		return h.postGetValueFn(value)
	}
	return value, nil
}

func (h *testHook) PostGetPropertyValues(_ request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if h.postGetValuesFn != nil {
		return h.postGetValuesFn(values)
	}
	return values, nil
}

func TestHookRegistration(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)

	t.Run("service starts with no hooks", func(t *testing.T) {
		service, err := New(ServiceConfig{
			PropertyGroupStore: th.dbStore.PropertyGroup(),
			PropertyFieldStore: th.dbStore.PropertyField(),
			PropertyValueStore: th.dbStore.PropertyValue(),
		})
		require.NoError(t, err)
		assert.Empty(t, service.hooks)
	})

	t.Run("AddHook appends hooks in order", func(t *testing.T) {
		service, err := New(ServiceConfig{
			PropertyGroupStore: th.dbStore.PropertyGroup(),
			PropertyFieldStore: th.dbStore.PropertyField(),
			PropertyValueStore: th.dbStore.PropertyValue(),
		})
		require.NoError(t, err)

		hook1 := &testHook{}
		hook2 := &testHook{}
		service.AddHook(hook1)
		service.AddHook(hook2)
		assert.Len(t, service.hooks, 2)
	})
}

func TestPreHookBlocking(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	rctx := th.Context
	groupID := model.NewId()

	t.Run("pre-hook error blocks CreatePropertyField", func(t *testing.T) {
		hook := &testHook{
			preCreateFieldFn: func(field *model.PropertyField) (*model.PropertyField, error) {
				return nil, fmt.Errorf("blocked by hook")
			},
		}
		th.service.AddHook(hook)
		defer func() { th.service.hooks = th.service.hooks[:len(th.service.hooks)-1] }()

		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "blocked-field-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
		}
		_, err := th.service.CreatePropertyField(rctx, field)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "blocked by hook")
	})

	t.Run("pre-hook error blocks DeletePropertyField", func(t *testing.T) {
		hook := &testHook{
			preDeleteFieldFn: func(gid string, id string) error {
				return fmt.Errorf("delete blocked")
			},
		}
		th.service.AddHook(hook)
		defer func() { th.service.hooks = th.service.hooks[:len(th.service.hooks)-1] }()

		err := th.service.DeletePropertyField(rctx, groupID, model.NewId())
		require.Error(t, err)
		assert.Contains(t, err.Error(), "delete blocked")
	})

	t.Run("pre-hook error blocks UpsertPropertyValue", func(t *testing.T) {
		hook := &testHook{
			preUpsertValueFn: func(value *model.PropertyValue) (*model.PropertyValue, error) {
				return nil, fmt.Errorf("upsert blocked")
			},
		}
		th.service.AddHook(hook)
		defer func() { th.service.hooks = th.service.hooks[:len(th.service.hooks)-1] }()

		value := &model.PropertyValue{
			GroupID: groupID,
			FieldID: model.NewId(),
		}
		_, err := th.service.UpsertPropertyValue(rctx, value)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "upsert blocked")
	})
}

func TestPreHookInputModification(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	rctx := th.Context
	groupID := model.NewId()

	t.Run("pre-hook modifies field before creation", func(t *testing.T) {
		hook := &testHook{
			preCreateFieldFn: func(field *model.PropertyField) (*model.PropertyField, error) {
				// Modify the field name
				field.Name = "modified-" + field.Name
				return field, nil
			},
		}
		th.service.AddHook(hook)
		defer func() { th.service.hooks = th.service.hooks[:len(th.service.hooks)-1] }()

		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "original",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
		}
		result, err := th.service.CreatePropertyField(rctx, field)
		require.NoError(t, err)
		assert.Equal(t, "modified-original", result.Name)
	})
}

func TestPostHookFiltering(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	rctx := th.Context
	groupID := model.NewId()

	t.Run("post-hook returns nil to filter out single field", func(t *testing.T) {
		// Create a field first
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    groupID,
			Name:       "filterable-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
		})

		hook := &testHook{
			postGetFieldFn: func(f *model.PropertyField) (*model.PropertyField, error) {
				return nil, nil // filter out the field
			},
		}
		th.service.AddHook(hook)
		defer func() { th.service.hooks = th.service.hooks[:len(th.service.hooks)-1] }()

		result, err := th.service.GetPropertyField(rctx, groupID, field.ID)
		require.NoError(t, err)
		assert.Nil(t, result)
	})

	t.Run("post-hook that drops fields from list returns error", func(t *testing.T) {
		field1 := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    groupID,
			Name:       "keep-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
		})
		field2 := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    groupID,
			Name:       "remove-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
		})

		hook := &testHook{
			postGetFieldsFn: func(fields []*model.PropertyField) ([]*model.PropertyField, error) {
				filtered := []*model.PropertyField{}
				for _, f := range fields {
					if f.ID == field1.ID {
						filtered = append(filtered, f)
					}
				}
				return filtered, nil
			},
		}
		th.service.AddHook(hook)
		defer func() { th.service.hooks = th.service.hooks[:len(th.service.hooks)-1] }()

		_, err := th.service.GetPropertyFields(rctx, groupID, []string{field1.ID, field2.ID})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "fewer fields")
	})
}

func TestMultipleHooksChaining(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	rctx := th.Context
	groupID := model.NewId()

	t.Run("multiple pre-hooks chain modifications in order", func(t *testing.T) {
		order := []string{}

		hook1 := &testHook{
			preCreateFieldFn: func(field *model.PropertyField) (*model.PropertyField, error) {
				order = append(order, "hook1")
				field.Name = field.Name + "-h1"
				return field, nil
			},
		}
		hook2 := &testHook{
			preCreateFieldFn: func(field *model.PropertyField) (*model.PropertyField, error) {
				order = append(order, "hook2")
				field.Name = field.Name + "-h2"
				return field, nil
			},
		}
		th.service.AddHook(hook1)
		th.service.AddHook(hook2)
		defer func() { th.service.hooks = th.service.hooks[:len(th.service.hooks)-2] }()

		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "base",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
		}
		result, err := th.service.CreatePropertyField(rctx, field)
		require.NoError(t, err)
		assert.Equal(t, "base-h1-h2", result.Name)
		assert.Equal(t, []string{"hook1", "hook2"}, order)
	})

	t.Run("first hook error prevents second hook from running", func(t *testing.T) {
		hook2Called := false

		hook1 := &testHook{
			preCreateFieldFn: func(field *model.PropertyField) (*model.PropertyField, error) {
				return nil, fmt.Errorf("hook1 blocked")
			},
		}
		hook2 := &testHook{
			preCreateFieldFn: func(field *model.PropertyField) (*model.PropertyField, error) {
				hook2Called = true
				return field, nil
			},
		}
		th.service.AddHook(hook1)
		th.service.AddHook(hook2)
		defer func() { th.service.hooks = th.service.hooks[:len(th.service.hooks)-2] }()

		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "should-fail-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
		}
		_, err := th.service.CreatePropertyField(rctx, field)
		require.Error(t, err)
		assert.False(t, hook2Called, "second hook should not have been called")
	})

	t.Run("multiple post-hooks chain in order", func(t *testing.T) {
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    groupID,
			Name:       "chain-post-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs:      model.StringInterface{"step": "0"},
		})

		hook1 := &testHook{
			postGetFieldFn: func(f *model.PropertyField) (*model.PropertyField, error) {
				if f.Attrs == nil {
					f.Attrs = make(model.StringInterface)
				}
				f.Attrs["hook1"] = true
				return f, nil
			},
		}
		hook2 := &testHook{
			postGetFieldFn: func(f *model.PropertyField) (*model.PropertyField, error) {
				if f.Attrs == nil {
					f.Attrs = make(model.StringInterface)
				}
				f.Attrs["hook2"] = true
				return f, nil
			},
		}
		th.service.AddHook(hook1)
		th.service.AddHook(hook2)
		defer func() { th.service.hooks = th.service.hooks[:len(th.service.hooks)-2] }()

		result, err := th.service.GetPropertyField(rctx, groupID, field.ID)
		require.NoError(t, err)
		assert.Equal(t, true, result.Attrs["hook1"])
		assert.Equal(t, true, result.Attrs["hook2"])
	})
}

func TestAccessControlHookGroupScoping(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	rctx := th.Context

	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-1"
	})

	rctxPlugin1 := RequestContextWithCallerID(th.Context, "plugin-1")
	rctxPlugin2 := RequestContextWithCallerID(th.Context, "plugin-2")

	t.Run("access control enforced for managed group (CPA)", func(t *testing.T) {
		// Create a protected field in the CPA group via the source plugin
		field := &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "protected-managed-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
		}
		created, err := th.service.CreatePropertyField(rctxPlugin1, field)
		require.NoError(t, err)
		assert.Equal(t, "plugin-1", created.Attrs[model.PropertyAttrsSourcePluginID])

		// Another plugin should NOT be able to update it (protected)
		created.Attrs[model.PropertyAttrsProtected] = true
		updated, err := th.service.UpdatePropertyField(rctxPlugin1, th.CPAGroupID, created)
		require.NoError(t, err)

		updated.Name = "attempt-update"
		_, err = th.service.UpdatePropertyField(rctxPlugin2, th.CPAGroupID, updated)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "protected")
	})

	t.Run("access control NOT enforced for unmanaged group", func(t *testing.T) {
		unmanagedGroup, err := th.service.RegisterPropertyGroup("unmanaged-scoping-test")
		require.NoError(t, err)

		// Create a protected field in an unmanaged group
		field := &model.PropertyField{
			GroupID:    unmanagedGroup.ID,
			Name:       "protected-unmanaged-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected:      true,
				model.PropertyAttrsSourcePluginID: "plugin-1",
			},
		}
		created, err := th.service.CreatePropertyField(rctxPlugin1, field)
		require.NoError(t, err)

		// Another plugin CAN update it (no access control for this group)
		created.Name = "updated-by-plugin2"
		updated, err := th.service.UpdatePropertyField(rctxPlugin2, unmanagedGroup.ID, created)
		require.NoError(t, err)
		assert.Equal(t, "updated-by-plugin2", updated.Name)
	})

	t.Run("read filtering applied for managed group", func(t *testing.T) {
		// Create a source-only protected field in the CPA group
		field := &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "source-only-managed-" + model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSourceOnly,
				model.PropertyAttrsProtected:  true,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Option 1"},
					map[string]any{"id": "opt2", "value": "Option 2"},
				},
			},
		}
		created, err := th.service.CreatePropertyField(rctxPlugin1, field)
		require.NoError(t, err)

		// Source plugin sees all options
		result, err := th.service.GetPropertyField(rctxPlugin1, th.CPAGroupID, created.ID)
		require.NoError(t, err)
		opts := result.Attrs[model.PropertyFieldAttributeOptions].([]any)
		assert.Len(t, opts, 2)

		// Other caller sees empty options
		result2, err := th.service.GetPropertyField(rctx, th.CPAGroupID, created.ID)
		require.NoError(t, err)
		opts2 := result2.Attrs[model.PropertyFieldAttributeOptions].([]any)
		assert.Len(t, opts2, 0)
	})

	t.Run("read filtering NOT applied for unmanaged group", func(t *testing.T) {
		unmanagedGroup, err := th.service.RegisterPropertyGroup("unmanaged-read-test")
		require.NoError(t, err)

		// Create a source-only field in an unmanaged group
		field := &model.PropertyField{
			GroupID:    unmanagedGroup.ID,
			Name:       "source-only-unmanaged-" + model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode:     model.PropertyAccessModeSourceOnly,
				model.PropertyAttrsSourcePluginID: "plugin-1",
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Option 1"},
					map[string]any{"id": "opt2", "value": "Option 2"},
				},
			},
		}
		created, err := th.service.CreatePropertyField(rctxPlugin1, field)
		require.NoError(t, err)

		// Non-source caller sees ALL options (no filtering for unmanaged groups)
		result, err := th.service.GetPropertyField(rctx, unmanagedGroup.ID, created.ID)
		require.NoError(t, err)
		opts := result.Attrs[model.PropertyFieldAttributeOptions].([]any)
		assert.Len(t, opts, 2)
	})
}

func TestPreUpdatePropertyFieldsHook(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	rctx := th.Context
	groupID := model.NewId()

	t.Run("pre-hook error blocks batch UpdatePropertyFields", func(t *testing.T) {
		hook := &testHook{
			preUpdateFieldsFn: func(gid string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
				return nil, fmt.Errorf("batch update blocked")
			},
		}
		th.service.AddHook(hook)
		defer func() { th.service.hooks = th.service.hooks[:len(th.service.hooks)-1] }()

		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    groupID,
			Name:       "batch-block-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
		})
		field.Name = "updated"
		_, err := th.service.UpdatePropertyFields(rctx, groupID, []*model.PropertyField{field})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "batch update blocked")
	})

	t.Run("pre-hook modifies fields in batch update", func(t *testing.T) {
		hook := &testHook{
			preUpdateFieldsFn: func(gid string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
				for _, f := range fields {
					f.Name = "modified-" + f.Name
				}
				return fields, nil
			},
		}
		th.service.AddHook(hook)
		defer func() { th.service.hooks = th.service.hooks[:len(th.service.hooks)-1] }()

		field1 := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    groupID,
			Name:       "batch-a-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
		})
		field2 := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    groupID,
			Name:       "batch-b-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
		})

		field1.Name = "a"
		field2.Name = "b"
		results, err := th.service.UpdatePropertyFields(rctx, groupID, []*model.PropertyField{field1, field2})
		require.NoError(t, err)
		require.Len(t, results, 2)
		assert.Equal(t, "modified-a", results[0].Name)
		assert.Equal(t, "modified-b", results[1].Name)
	})
}
