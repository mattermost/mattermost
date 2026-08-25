// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

// optionTestFields is the shape every subtest below works against: a template
// field owning the options, and a field of the driving object type linking to it
// and therefore serving them without owning any.
type optionTestFields struct {
	template *model.PropertyField
	linked   *model.PropertyField
}

func setupOptionFields(t *testing.T, th *TestHelper, groupID string, fieldType model.PropertyFieldType, optionsLevel model.PermissionLevel, options []map[string]any) optionTestFields {
	t.Helper()

	memberLevel := model.PermissionLevelMember
	attrs := model.StringInterface{}
	if len(options) > 0 {
		attrs[model.PropertyFieldAttributeOptions] = options
	}

	template, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
		Name:              model.NewId(),
		Type:              fieldType,
		GroupID:           groupID,
		ObjectType:        model.PropertyFieldObjectTypeTemplate,
		TargetType:        "system",
		Attrs:             attrs,
		PermissionField:   &memberLevel,
		PermissionValues:  &memberLevel,
		PermissionOptions: &optionsLevel,
	}, false, "")
	require.Nil(t, appErr)

	linked, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
		Name:          model.NewId(),
		GroupID:       groupID,
		ObjectType:    model.PropertyFieldObjectTypeUser,
		TargetType:    "system",
		LinkedFieldID: &template.ID,
	}, false, "")
	require.Nil(t, appErr)

	return optionTestFields{template: template, linked: linked}
}

// namedOption builds a create payload item.
func namedOption(name string, parents ...string) *model.PropertyFieldOption {
	option := &model.PropertyFieldOption{Name: name}
	if parents != nil {
		option.Parents = &parents
	}
	return option
}

func optionNames(options []*model.PropertyFieldOption) []string {
	names := make([]string, 0, len(options))
	for _, option := range options {
		names = append(names, option.Name)
	}
	return names
}

func optionByName(t *testing.T, options []*model.PropertyFieldOption, name string) *model.PropertyFieldOption {
	t.Helper()
	for _, option := range options {
		if option.Name == name {
			return option
		}
	}
	require.FailNowf(t, "option not found", "no option called %q among %v", name, optionNames(options))
	return nil
}

func TestPropertyFieldOptions(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
		cfg.FeatureFlags.PropertyFieldGraph = true
	}).InitBasic(t)

	group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_field_options", Version: model.PropertyGroupVersionV2})
	require.Nil(t, appErr)

	memberLevel := model.PermissionLevelMember
	noneLevel := model.PermissionLevelNone
	sysadminLevel := model.PermissionLevelSysadmin
	graph := model.PropertyFieldTypeGraph
	template := model.PropertyFieldObjectTypeTemplate
	userObject := model.PropertyFieldObjectTypeUser

	t.Run("a whole hierarchy is created in one call, referring forward by name", func(t *testing.T) {
		fields := setupOptionFields(t, th, group.ID, graph, memberLevel, nil)

		created, resp, err := th.SystemAdminClient.CreatePropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []*model.PropertyFieldOption{
			namedOption("Fighter Jet Program", "Air Program"),
			namedOption("Air Program"),
			namedOption("F-18 Program", "Fighter Jet Program"),
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.Len(t, created, 3)

		// Returned in the order they were sent, with the identifiers assigned.
		require.Equal(t, []string{"Fighter Jet Program", "Air Program", "F-18 Program"}, optionNames(created))
		for _, option := range created {
			require.True(t, model.IsValidId(option.ID), "option %q got no identifier", option.Name)
			require.False(t, option.ReadOnly)
			require.NotZero(t, option.CreateAt)
		}
		require.Equal(t, []string{"Air Program"}, *optionByName(t, created, "Fighter Jet Program").Parents)
		require.Empty(t, *optionByName(t, created, "Air Program").Parents)
		require.Equal(t, []string{"Fighter Jet Program"}, *optionByName(t, created, "F-18 Program").Parents)
	})

	t.Run("an option change moves the field's UpdateAt", func(t *testing.T) {
		fields := setupOptionFields(t, th, group.ID, graph, memberLevel, nil)

		_, _, err := th.SystemAdminClient.CreatePropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []*model.PropertyFieldOption{
			namedOption("Air Program"),
		})
		require.NoError(t, err)

		after, appErr := th.App.GetPropertyField(th.Context, group.ID, fields.template.ID)
		require.Nil(t, appErr)
		require.Greater(t, after.UpdateAt, fields.template.UpdateAt)
	})

	t.Run("an option change is announced for the field that owns it and for every field serving it", func(t *testing.T) {
		// The template's row is the only one an option change writes, so nothing
		// about a field linking to it says that the options it serves have moved.
		// Each field is announced separately, from its own perspective: the option
		// list is the one that field's readers see, and the event carries that
		// field's own object type.
		fields := setupOptionFields(t, th, group.ID, graph, memberLevel, nil)

		created, _, err := th.SystemAdminClient.CreatePropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []*model.PropertyFieldOption{
			namedOption("Air Program"),
		})
		require.NoError(t, err)

		th.LoginBasic(t)
		webSocketClient := th.CreateConnectedWebSocketClient(t)

		_, _, err = th.SystemAdminClient.PatchPropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []*model.PropertyFieldOption{
			{ID: created[0].ID, Name: "Aerial Program"},
		})
		require.NoError(t, err)

		// One event per field, keyed by the field each one carries. Other events may
		// arrive in between, so this collects rather than reading a fixed number.
		announced := map[string]*model.WebSocketEvent{}
		require.Eventually(t, func() bool {
			select {
			case event := <-webSocketClient.EventChannel:
				if event.EventType() != model.WebsocketEventPropertyFieldUpdated {
					return false
				}
				var received model.PropertyField
				require.NoError(t, json.Unmarshal([]byte(event.GetData()["property_field"].(string)), &received))
				announced[received.ID] = event
			default:
			}
			return len(announced) == 2
		}, 5*time.Second, 100*time.Millisecond)

		for _, tc := range []struct {
			fieldID    string
			objectType string
		}{
			{fields.template.ID, template},
			{fields.linked.ID, userObject},
		} {
			event := announced[tc.fieldID]
			require.NotNil(t, event, "no event for field %s", tc.fieldID)
			require.Equal(t, tc.objectType, event.GetData()["object_type"])

			var received model.PropertyField
			require.NoError(t, json.Unmarshal([]byte(event.GetData()["property_field"].(string)), &received))

			// The renamed option, as this field serves it: the template owns it and
			// the linked field derives it, and both carry the new name.
			options, ok := received.Attrs[model.PropertyFieldAttributeOptions].([]any)
			require.True(t, ok, "field %s should carry its option list", tc.fieldID)
			require.Len(t, options, 1)
			assert.Equal(t, "Aerial Program", options[0].(map[string]any)["name"])
		}
	})

	t.Run("an access-controlled field's option list is withheld from the websocket broadcast", func(t *testing.T) {
		// A broadcast has no recipient to filter options against, so a shared_only
		// field must go out with none at all -- unlike the public fields above,
		// which still carry theirs. A client that needs the list reads the field
		// back, and that read is filtered per caller.
		none := model.PermissionLevelNone
		sysadmin := model.PermissionLevelSysadmin
		sharedTemplate, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
			Name:       model.NewId(),
			Type:       graph,
			GroupID:    group.ID,
			ObjectType: template,
			TargetType: "system",
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected:  true,
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly,
			},
			Protected:         true,
			PermissionField:   &none,
			PermissionValues:  &sysadmin,
			PermissionOptions: &memberLevel,
		}, true, "")
		require.Nil(t, appErr)

		sharedLinked, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
			Name:          model.NewId(),
			GroupID:       group.ID,
			ObjectType:    userObject,
			TargetType:    "system",
			LinkedFieldID: &sharedTemplate.ID,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected:  true,
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly,
			},
			Protected:       true,
			PermissionField: &none,
		}, true, "")
		require.Nil(t, appErr)

		created, resp, err := th.SystemAdminClient.CreatePropertyFieldOptions(context.Background(), group.Name, template, sharedTemplate.ID, []*model.PropertyFieldOption{
			namedOption("Air Program"),
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		th.LoginBasic(t)
		webSocketClient := th.CreateConnectedWebSocketClient(t)

		_, _, err = th.SystemAdminClient.PatchPropertyFieldOptions(context.Background(), group.Name, template, sharedTemplate.ID, []*model.PropertyFieldOption{
			{ID: created[0].ID, Name: "Aerial Program"},
		})
		require.NoError(t, err)

		announced := map[string]*model.WebSocketEvent{}
		require.Eventually(t, func() bool {
			select {
			case event := <-webSocketClient.EventChannel:
				if event.EventType() != model.WebsocketEventPropertyFieldUpdated {
					return false
				}
				var received model.PropertyField
				require.NoError(t, json.Unmarshal([]byte(event.GetData()["property_field"].(string)), &received))
				announced[received.ID] = event
			default:
			}
			return len(announced) == 2
		}, 5*time.Second, 100*time.Millisecond)

		for _, fieldID := range []string{sharedTemplate.ID, sharedLinked.ID} {
			event := announced[fieldID]
			require.NotNil(t, event, "no event for field %s", fieldID)

			var received model.PropertyField
			require.NoError(t, json.Unmarshal([]byte(event.GetData()["property_field"].(string)), &received))

			options, ok := received.Attrs[model.PropertyFieldAttributeOptions].([]any)
			require.True(t, ok, "field %s should still carry an options key", fieldID)
			require.Empty(t, options)
			_, hasCount := received.Attrs[model.PropertyFieldAttributeOptionsCount]
			require.False(t, hasCount, "field %s should carry no options_count", fieldID)
			_, hasOmitted := received.Attrs[model.PropertyFieldAttributeOptionsOmitted]
			require.False(t, hasOmitted, "field %s should carry no options_omitted", fieldID)
		}

		// The rename landed -- the broadcast was masked, not the write rejected.
		listed, _, err := th.SystemAdminClient.GetPropertyFieldOptions(context.Background(), group.Name, template, sharedTemplate.ID, 0, "", 100)
		require.NoError(t, err)
		require.Equal(t, []string{"Aerial Program"}, optionNames(listed))
	})

	t.Run("the effective set is listed, with inherited options read-only", func(t *testing.T) {
		fields := setupOptionFields(t, th, group.ID, graph, memberLevel, nil)

		_, _, err := th.SystemAdminClient.CreatePropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []*model.PropertyFieldOption{
			namedOption("Air Program"),
			namedOption("Fighter Jet Program", "Air Program"),
		})
		require.NoError(t, err)

		// Through the linked field: it owns nothing, so everything is inherited,
		// and the hierarchy it serves is the template's.
		listed, resp, err := th.Client.GetPropertyFieldOptions(context.Background(), group.Name, userObject, fields.linked.ID, 0, "", 100)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, listed, 2)
		for _, option := range listed {
			require.True(t, option.ReadOnly, "option %q should be read-only through a linked field", option.Name)
		}
		require.Equal(t, []string{"Air Program"}, *optionByName(t, listed, "Fighter Jet Program").Parents)

		// Through the template that owns them: nothing is read-only.
		owned, _, err := th.Client.GetPropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, 0, "", 100)
		require.NoError(t, err)
		require.Len(t, owned, 2)
		for _, option := range owned {
			require.False(t, option.ReadOnly)
		}
	})

	t.Run("the listing pages in creation order", func(t *testing.T) {
		fields := setupOptionFields(t, th, group.ID, graph, memberLevel, nil)

		for _, name := range []string{"one", "two", "three"} {
			_, _, err := th.SystemAdminClient.CreatePropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []*model.PropertyFieldOption{
				namedOption(name),
			})
			require.NoError(t, err)
		}

		var paged []*model.PropertyFieldOption
		var cursorCreateAt int64
		var cursorID string
		for range 4 {
			page, _, err := th.SystemAdminClient.GetPropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, cursorCreateAt, cursorID, 2)
			require.NoError(t, err)
			if len(page) == 0 {
				break
			}
			paged = append(paged, page...)
			last := page[len(page)-1]
			cursorCreateAt, cursorID = last.CreateAt, last.ID
		}
		require.Equal(t, []string{"one", "two", "three"}, optionNames(paged))
	})

	t.Run("half a cursor is refused", func(t *testing.T) {
		fields := setupOptionFields(t, th, group.ID, graph, memberLevel, nil)

		_, resp, err := th.SystemAdminClient.GetPropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, 0, model.NewId(), 100)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "api.property_field.options.invalid_cursor.app_error")
	})

	t.Run("a change names the first item it cannot accept", func(t *testing.T) {
		fields := setupOptionFields(t, th, group.ID, graph, memberLevel, nil)

		_, _, err := th.SystemAdminClient.CreatePropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []*model.PropertyFieldOption{
			namedOption("Air Program"),
		})
		require.NoError(t, err)

		for _, tc := range []struct {
			name     string
			payload  []*model.PropertyFieldOption
			contains string
		}{
			{
				name: "a name already taken",
				payload: []*model.PropertyFieldOption{
					namedOption("Sea Program"),
					namedOption("Air Program"),
				},
				contains: `at index 1 names option "Air Program", which field`,
			},
			{
				name: "a parent that resolves to nothing",
				payload: []*model.PropertyFieldOption{
					namedOption("Sea Program"),
					namedOption("Frigate Program", "Naval Program"),
				},
				contains: `at index 1 puts option "Frigate Program" under "Naval Program"`,
			},
			{
				name: "an identifier the caller chose",
				payload: []*model.PropertyFieldOption{
					namedOption("Sea Program"),
					{ID: model.NewId(), Name: "Frigate Program"},
				},
				contains: "at index 1 carries the id",
			},
			{
				name: "two options with the same name",
				payload: []*model.PropertyFieldOption{
					namedOption("Sea Program"),
					namedOption("Sea Program"),
				},
				contains: "duplicate option name found at index 1",
			},
		} {
			t.Run(tc.name, func(t *testing.T) {
				_, resp, cErr := th.SystemAdminClient.CreatePropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, tc.payload)
				require.Error(t, cErr)
				CheckBadRequestStatus(t, resp)
				require.Contains(t, cErr.(*model.AppError).Message, tc.contains)
			})
		}

		// Nothing from any of those payloads was written.
		listed, _, lErr := th.SystemAdminClient.GetPropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, 0, "", 100)
		require.NoError(t, lErr)
		require.Equal(t, []string{"Air Program"}, optionNames(listed))
	})

	t.Run("an empty payload is refused", func(t *testing.T) {
		fields := setupOptionFields(t, th, group.ID, graph, memberLevel, nil)

		_, resp, err := th.SystemAdminClient.CreatePropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []*model.PropertyFieldOption{})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "api.property_field.options.empty_body.app_error")

		resp, err = th.SystemAdminClient.DeletePropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []string{})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "api.property_field.options.empty_body.app_error")
	})

	t.Run("a payload larger than a page is refused", func(t *testing.T) {
		fields := setupOptionFields(t, th, group.ID, graph, memberLevel, nil)

		payload := make([]*model.PropertyFieldOption, 0, maxPropertyFieldOptionItems+1)
		for i := range maxPropertyFieldOptionItems + 1 {
			payload = append(payload, namedOption(fmt.Sprintf("option %d", i)))
		}
		_, resp, err := th.SystemAdminClient.CreatePropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, payload)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "api.property_field.options.too_many_items.request_error")
	})

	t.Run("a linked graph field may own no options of its own", func(t *testing.T) {
		graphFields := setupOptionFields(t, th, group.ID, graph, memberLevel, nil)

		_, resp, err := th.SystemAdminClient.CreatePropertyFieldOptions(context.Background(), group.Name, userObject, graphFields.linked.ID, []*model.PropertyFieldOption{
			namedOption("Local Program"),
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		require.Contains(t, err.(*model.AppError).Message, "cannot own options of its own")

		// The same call on a linked field of a type whose options form no
		// hierarchy is fine: a local option there has nothing to be disconnected
		// from.
		selectFields := setupOptionFields(t, th, group.ID, model.PropertyFieldTypeSelect, memberLevel, []map[string]any{
			{"id": model.NewId(), "name": "Inherited"},
		})
		created, resp, err := th.SystemAdminClient.CreatePropertyFieldOptions(context.Background(), group.Name, userObject, selectFields.linked.ID, []*model.PropertyFieldOption{
			namedOption("Local"),
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.Len(t, created, 1)
		require.False(t, created[0].ReadOnly)
		require.Nil(t, created[0].Parents, "a select field's options form no hierarchy")

		// And it now serves both.
		listed, _, err := th.SystemAdminClient.GetPropertyFieldOptions(context.Background(), group.Name, userObject, selectFields.linked.ID, 0, "", 100)
		require.NoError(t, err)
		require.Len(t, listed, 2)
		require.True(t, optionByName(t, listed, "Inherited").ReadOnly)
		require.False(t, optionByName(t, listed, "Local").ReadOnly)
	})

	t.Run("parents on a field whose options form no hierarchy are refused", func(t *testing.T) {
		fields := setupOptionFields(t, th, group.ID, model.PropertyFieldTypeSelect, memberLevel, nil)

		_, resp, err := th.SystemAdminClient.CreatePropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []*model.PropertyFieldOption{
			namedOption("First"),
			namedOption("Second", "First"),
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		require.Contains(t, err.(*model.AppError).Message, "at index 1 carries parents")
	})

	t.Run("a change replaces the parts it names and leaves the rest alone", func(t *testing.T) {
		fields := setupOptionFields(t, th, group.ID, graph, memberLevel, nil)

		blue := "blue"
		created, _, err := th.SystemAdminClient.CreatePropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []*model.PropertyFieldOption{
			namedOption("Air Program"),
			{Name: "Fighter Jet Program", Color: &blue, Parents: &[]string{"Air Program"}, Attrs: &model.StringInterface{"code": "FJP"}},
		})
		require.NoError(t, err)
		child := optionByName(t, created, "Fighter Jet Program")
		require.Equal(t, "blue", *child.Color)

		// Only the name is given, so the colour, the attrs and the option above it
		// all stay as they were.
		updated, resp, err := th.SystemAdminClient.PatchPropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []*model.PropertyFieldOption{
			{ID: child.ID, Name: "Jet Program"},
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, updated, 1)
		require.Equal(t, "Jet Program", updated[0].Name)
		require.Equal(t, "blue", *updated[0].Color)
		require.Equal(t, model.StringInterface{"code": "FJP"}, *updated[0].Attrs)
		require.Equal(t, []string{"Air Program"}, *updated[0].Parents)

		// An empty parent list is a request to detach, and is obeyed.
		updated, _, err = th.SystemAdminClient.PatchPropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []*model.PropertyFieldOption{
			{ID: child.ID, Name: "Jet Program", Parents: &[]string{}},
		})
		require.NoError(t, err)
		require.Empty(t, *updated[0].Parents)
	})

	t.Run("a parent set is replaced rather than added to", func(t *testing.T) {
		fields := setupOptionFields(t, th, group.ID, graph, memberLevel, nil)

		created, _, err := th.SystemAdminClient.CreatePropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []*model.PropertyFieldOption{
			namedOption("Air Program"),
			namedOption("Sea Program"),
			namedOption("Patrol Program", "Air Program"),
		})
		require.NoError(t, err)
		child := optionByName(t, created, "Patrol Program")

		updated, _, err := th.SystemAdminClient.PatchPropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []*model.PropertyFieldOption{
			{ID: child.ID, Name: "Patrol Program", Parents: &[]string{"Sea Program"}},
		})
		require.NoError(t, err)
		require.Equal(t, []string{"Sea Program"}, *updated[0].Parents)
	})

	t.Run("a change that would put an option below itself is refused", func(t *testing.T) {
		fields := setupOptionFields(t, th, group.ID, graph, memberLevel, nil)

		created, _, err := th.SystemAdminClient.CreatePropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []*model.PropertyFieldOption{
			namedOption("Air Program"),
			namedOption("Fighter Jet Program", "Air Program"),
		})
		require.NoError(t, err)
		root := optionByName(t, created, "Air Program")

		_, resp, err := th.SystemAdminClient.PatchPropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []*model.PropertyFieldOption{
			{ID: root.ID, Name: "Air Program", Parents: &[]string{"Fighter Jet Program"}},
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		require.Contains(t, err.(*model.AppError).Message, "would put an option below itself")

		// The hierarchy is untouched.
		listed, _, err := th.SystemAdminClient.GetPropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, 0, "", 100)
		require.NoError(t, err)
		require.Empty(t, *optionByName(t, listed, "Air Program").Parents)
		require.Equal(t, []string{"Air Program"}, *optionByName(t, listed, "Fighter Jet Program").Parents)
	})

	t.Run("an inherited option cannot be changed or deleted through the field that inherits it", func(t *testing.T) {
		fields := setupOptionFields(t, th, group.ID, model.PropertyFieldTypeSelect, memberLevel, []map[string]any{
			{"id": model.NewId(), "name": "Inherited"},
		})

		listed, _, err := th.SystemAdminClient.GetPropertyFieldOptions(context.Background(), group.Name, userObject, fields.linked.ID, 0, "", 100)
		require.NoError(t, err)
		require.Len(t, listed, 1)
		inherited := listed[0]
		require.True(t, inherited.ReadOnly)

		_, resp, err := th.SystemAdminClient.PatchPropertyFieldOptions(context.Background(), group.Name, userObject, fields.linked.ID, []*model.PropertyFieldOption{
			{ID: inherited.ID, Name: "Renamed"},
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		require.Contains(t, err.(*model.AppError).Message, "change it there instead")

		resp, err = th.SystemAdminClient.DeletePropertyFieldOptions(context.Background(), group.Name, userObject, fields.linked.ID, []string{inherited.ID})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		require.Contains(t, err.(*model.AppError).Message, "delete it there instead")

		// The same option is editable on the template that owns it, and the change
		// is visible through the field that inherits it.
		_, _, err = th.SystemAdminClient.PatchPropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []*model.PropertyFieldOption{
			{ID: inherited.ID, Name: "Renamed"},
		})
		require.NoError(t, err)

		listed, _, err = th.SystemAdminClient.GetPropertyFieldOptions(context.Background(), group.Name, userObject, fields.linked.ID, 0, "", 100)
		require.NoError(t, err)
		require.Equal(t, []string{"Renamed"}, optionNames(listed))
	})

	t.Run("an option with something still below it can only go with it", func(t *testing.T) {
		fields := setupOptionFields(t, th, group.ID, graph, memberLevel, nil)

		created, _, err := th.SystemAdminClient.CreatePropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []*model.PropertyFieldOption{
			namedOption("Air Program"),
			namedOption("Fighter Jet Program", "Air Program"),
			namedOption("F-18 Program", "Fighter Jet Program"),
		})
		require.NoError(t, err)
		root := optionByName(t, created, "Air Program")
		middle := optionByName(t, created, "Fighter Jet Program")
		leaf := optionByName(t, created, "F-18 Program")

		resp, err := th.SystemAdminClient.DeletePropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []string{middle.ID})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		require.Contains(t, err.(*model.AppError).Message, "is still below")

		// The whole branch at once is accepted, and leaves the root behind.
		resp, err = th.SystemAdminClient.DeletePropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []string{middle.ID, leaf.ID})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		listed, _, err := th.SystemAdminClient.GetPropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, 0, "", 100)
		require.NoError(t, err)
		require.Equal(t, []string{"Air Program"}, optionNames(listed))
		require.Equal(t, root.ID, listed[0].ID)
	})

	t.Run("every mutation is gated on the field's options permission", func(t *testing.T) {
		th.LoginBasic(t)

		for _, tc := range []struct {
			name  string
			level model.PermissionLevel
			admin bool
			allow bool
		}{
			{name: "a member level lets a member through", level: memberLevel, allow: true},
			{name: "a sysadmin level does not", level: sysadminLevel, allow: false},
			{name: "a sysadmin level lets an administrator through", level: sysadminLevel, admin: true, allow: true},
			{name: "no level lets nobody through", level: noneLevel, admin: true, allow: false},
		} {
			t.Run(tc.name, func(t *testing.T) {
				fields := setupOptionFields(t, th, group.ID, graph, tc.level, []map[string]any{
					{"id": model.NewId(), "name": "Seeded Program"},
				})
				client := th.Client
				if tc.admin {
					client = th.SystemAdminClient
				}

				created, resp, err := client.CreatePropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []*model.PropertyFieldOption{
					namedOption("Air Program"),
				})
				if !tc.allow {
					require.Error(t, err)
					CheckForbiddenStatus(t, resp)
					CheckErrorID(t, err, "api.property_field.options.no_permission.app_error")

					// Reading is not gated on the options permission: a field's
					// options are part of its definition, which is readable at the
					// field's own scope.
					listed, resp, err := client.GetPropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, 0, "", 100)
					require.NoError(t, err)
					CheckOKStatus(t, resp)
					seeded := optionByName(t, listed, "Seeded Program")

					_, resp, err = client.PatchPropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []*model.PropertyFieldOption{
						{ID: seeded.ID, Name: "Renamed Program"},
					})
					require.Error(t, err)
					CheckForbiddenStatus(t, resp)
					CheckErrorID(t, err, "api.property_field.options.no_permission.app_error")

					resp, err = client.DeletePropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []string{seeded.ID})
					require.Error(t, err)
					CheckForbiddenStatus(t, resp)
					CheckErrorID(t, err, "api.property_field.options.no_permission.app_error")
					return
				}
				require.NoError(t, err)
				CheckCreatedStatus(t, resp)

				_, _, err = client.PatchPropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []*model.PropertyFieldOption{
					{ID: created[0].ID, Name: "Aviation Program"},
				})
				require.NoError(t, err)

				_, err = client.DeletePropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []string{created[0].ID})
				require.NoError(t, err)
			})
		}
	})

	t.Run("a field addressed through the wrong object type is not found", func(t *testing.T) {
		fields := setupOptionFields(t, th, group.ID, graph, memberLevel, nil)

		_, resp, err := th.SystemAdminClient.GetPropertyFieldOptions(context.Background(), group.Name, userObject, fields.template.ID, 0, "", 100)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		CheckErrorID(t, err, "api.property_field.object_type_mismatch.app_error")
	})

	t.Run("an unauthenticated request is refused", func(t *testing.T) {
		fields := setupOptionFields(t, th, group.ID, graph, memberLevel, nil)
		client := model.NewAPIv4Client(th.Client.URL)

		_, resp, err := client.GetPropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, 0, "", 100)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	// A hierarchy can also be written as part of the field itself, which is the only
	// way to create one in a single request. The two write paths have to agree about
	// what an option's parents are, so these read the result back through the
	// endpoints above.
	t.Run("a hierarchy is created with the field, and read back through its options", func(t *testing.T) {
		created, resp, err := th.SystemAdminClient.CreatePropertyField(context.Background(), group.Name, template, &model.PropertyField{
			Name:              model.NewId(),
			Type:              graph,
			TargetType:        "system",
			PermissionOptions: &memberLevel,
			Attrs: model.StringInterface{model.PropertyFieldAttributeOptions: []map[string]any{
				{"name": "Fighter Jet Program", "parents": []string{"Air Program"}},
				{"name": "Air Program"},
				{"name": "F-18 Program", "parents": []string{"Fighter Jet Program"}},
			}},
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		options, resp, err := th.SystemAdminClient.GetPropertyFieldOptions(context.Background(), group.Name, template, created.ID, 0, "", 100)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, options, 3)
		require.Equal(t, []string{"Air Program"}, *optionByName(t, options, "Fighter Jet Program").Parents)
		require.Equal(t, []string{"Fighter Jet Program"}, *optionByName(t, options, "F-18 Program").Parents)
		require.Empty(t, *optionByName(t, options, "Air Program").Parents)
	})

	t.Run("a parent no option of the field is called is refused, in the answer to the request", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.CreatePropertyField(context.Background(), group.Name, template, &model.PropertyField{
			Name:       model.NewId(),
			Type:       graph,
			TargetType: "system",
			Attrs: model.StringInterface{model.PropertyFieldAttributeOptions: []map[string]any{
				{"name": "Air Program"},
				{"name": "F-18 Program", "parents": []string{"Fighter Jet Program"}},
			}},
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		// The reason has to be in the response, not only in the server log: there is
		// no fixing a payload from "the options were rejected". Asserted on Message
		// rather than DetailedError, which the HTTP layer strips.
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		require.Contains(t, appErr.Message, `"Fighter Jet Program"`)
		require.Contains(t, appErr.Message, "no option called")
	})
}

func TestPropertyFieldOptionsAudit(t *testing.T) {
	logFile, err := os.CreateTemp("", "property_field_options_audit.log")
	require.NoError(t, err)
	defer os.Remove(logFile.Name())

	options := []app.Option{app.WithLicense(model.NewTestLicense("advanced_logging"))}
	th := SetupWithServerOptionsAndConfig(t, options, func(cfg *model.Config) {
		cfg.ExperimentalAuditSettings.FileEnabled = model.NewPointer(true)
		cfg.ExperimentalAuditSettings.FileName = model.NewPointer(logFile.Name())
		cfg.FeatureFlags.IntegratedBoards = true
		cfg.FeatureFlags.PropertyFieldGraph = true
	})

	group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_field_options_audit", Version: model.PropertyGroupVersionV2})
	require.Nil(t, appErr)

	memberLevel := model.PermissionLevelMember
	template := model.PropertyFieldObjectTypeTemplate
	fields := setupOptionFields(t, th, group.ID, model.PropertyFieldTypeGraph, memberLevel, nil)

	created, _, err := th.SystemAdminClient.CreatePropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []*model.PropertyFieldOption{
		namedOption("Air Program"),
		namedOption("Fighter Jet Program", "Air Program"),
	})
	require.NoError(t, err)
	child := optionByName(t, created, "Fighter Jet Program")

	// Detaching a link is the change with no other record: an option keeps its row
	// when it is deleted, but a parent link is removed outright.
	_, _, err = th.SystemAdminClient.PatchPropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []*model.PropertyFieldOption{
		{ID: child.ID, Name: "Fighter Jet Program", Parents: &[]string{}},
	})
	require.NoError(t, err)

	_, err = th.SystemAdminClient.DeletePropertyFieldOptions(context.Background(), group.Name, template, fields.template.ID, []string{child.ID})
	require.NoError(t, err)

	require.NoError(t, th.Server.Audit.Flush())
	require.NoError(t, logFile.Sync())
	data, rErr := io.ReadAll(logFile)
	require.NoError(t, rErr)
	require.NotEmpty(t, data)

	t.Run("creating options records the field and every option", func(t *testing.T) {
		entry := FindAuditEntry(string(data), model.AuditEventCreatePropertyFieldOptions, "")
		require.NotNil(t, entry)
		assert.Equal(t, "success", entry.Status)
		raw := fmt.Sprintf("%v", entry.Raw)
		assert.Contains(t, raw, fields.template.ID)
		assert.Contains(t, raw, "Fighter Jet Program")
		assert.Contains(t, raw, child.ID)
	})

	t.Run("changing a parent set records what it replaced", func(t *testing.T) {
		entry := FindAuditEntry(string(data), model.AuditEventPatchPropertyFieldOptions, "")
		require.NotNil(t, entry)
		assert.Equal(t, "success", entry.Status)

		parameters := entry.Raw["event"].(map[string]any)["parameters"].(map[string]any)
		prior := parameters["prior_options"].([]any)[0].(map[string]any)
		updated := parameters["updated_options"].([]any)[0].(map[string]any)
		// The link the change removed exists nowhere else once it is gone.
		assert.Equal(t, []any{"Air Program"}, prior["parents"])
		assert.Empty(t, updated["parents"])
	})

	t.Run("deleting options records them as they stood", func(t *testing.T) {
		entry := FindAuditEntry(string(data), model.AuditEventDeletePropertyFieldOptions, "")
		require.NotNil(t, entry)
		assert.Equal(t, "success", entry.Status)

		parameters := entry.Raw["event"].(map[string]any)["parameters"].(map[string]any)
		deleted := parameters["deleted_options"].([]any)[0].(map[string]any)
		assert.Equal(t, child.ID, deleted["id"])
		assert.Equal(t, "Fighter Jet Program", deleted["name"])
	})
}
