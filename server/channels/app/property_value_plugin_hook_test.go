// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestPropertyValuesHookCalls(t *testing.T) {
	value := func(targetID, fieldID, v string) *model.PropertyValue {
		return &model.PropertyValue{TargetType: "post", TargetID: targetID, FieldID: fieldID, Value: json.RawMessage(`"` + v + `"`)}
	}
	fieldIDs := func(values []*model.PropertyValue) []string {
		ids := []string{}
		for _, v := range values {
			ids = append(ids, v.FieldID)
		}
		return ids
	}

	t.Run("pairs written and previous values of one target", func(t *testing.T) {
		calls := propertyValuesHookCalls(
			[]*model.PropertyValue{value("p1", "f1", "new"), value("p1", "f2", "first")},
			[]*model.PropertyValue{value("p1", "f1", "old")},
		)
		require.Len(t, calls, 1)
		assert.Equal(t, propertyValuesTarget{"post", "p1"}, calls[0].target)
		assert.Equal(t, []string{"f1", "f2"}, fieldIDs(calls[0].values))
		assert.Equal(t, []string{"f1"}, fieldIDs(calls[0].previous))
	})

	t.Run("reports deletions as previous values without written ones", func(t *testing.T) {
		calls := propertyValuesHookCalls(nil, []*model.PropertyValue{value("p1", "f1", "old"), value("p1", "f2", "old")})
		require.Len(t, calls, 1)
		assert.Empty(t, calls[0].values)
		assert.Equal(t, []string{"f1", "f2"}, fieldIDs(calls[0].previous))
	})

	t.Run("splits a batch by target in first-seen order", func(t *testing.T) {
		calls := propertyValuesHookCalls(
			[]*model.PropertyValue{value("p2", "f1", "a"), value("p1", "f1", "b"), value("p2", "f2", "c")},
			[]*model.PropertyValue{value("p1", "f1", "old")},
		)
		require.Len(t, calls, 2)
		assert.Equal(t, "p2", calls[0].target.targetID)
		assert.Equal(t, []string{"f1", "f2"}, fieldIDs(calls[0].values))
		assert.Empty(t, calls[0].previous)
		assert.Equal(t, "p1", calls[1].target.targetID)
		assert.Equal(t, []string{"f1"}, fieldIDs(calls[1].values))
		assert.Equal(t, []string{"f1"}, fieldIDs(calls[1].previous))
	})

	t.Run("bounds each call", func(t *testing.T) {
		var written, previous []*model.PropertyValue
		for range propertyValuesHookMaxValues + 30 {
			id := model.NewId()
			written = append(written, value("p1", id, "new"))
			previous = append(previous, value("p1", id, "old"))
		}
		calls := propertyValuesHookCalls(written, previous)
		require.Len(t, calls, 2)
		assert.Len(t, calls[0].values, propertyValuesHookMaxValues)
		assert.Len(t, calls[0].previous, propertyValuesHookMaxValues)
		assert.Len(t, calls[1].values, 30)
		assert.Len(t, calls[1].previous, 30)
		assert.Equal(t, fieldIDs(calls[1].values), fieldIDs(calls[1].previous))
	})

	t.Run("nothing to report", func(t *testing.T) {
		assert.Empty(t, propertyValuesHookCalls(nil, nil))
	})
}

func TestPreviousPropertyValuesWithoutPlugins(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	values := []*model.PropertyValue{{TargetType: "post", TargetID: model.NewId(), GroupID: model.NewId(), FieldID: model.NewId()}}
	assert.Nil(t, th.App.previousPropertyValues(th.Context, values[0].GroupID, values), "no plugin implements the hook, so nothing is read")
}

func TestStoredPropertyValuesReadsMaster(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	groupID, targetID, fieldID := model.NewId(), model.NewId(), model.NewId()
	stored := &model.PropertyValue{ID: model.NewId(), GroupID: groupID, TargetType: "post", TargetID: targetID, FieldID: fieldID, Value: json.RawMessage(`"a"`)}

	mockStore := th.App.Srv().Store().(*storemocks.Store)
	mockValueStore := storemocks.PropertyValueStore{}
	mockStore.On("PropertyValue").Return(&mockValueStore)
	// A replica may not have the write just before this one yet, so the read must go to the master.
	mockValueStore.On("SearchPropertyValues", mock.MatchedBy(func(rctx request.CTX) bool {
		return store.HasMaster(rctx.Context())
	}), mock.Anything).Return([]*model.PropertyValue{stored}, nil).Once()

	previous := th.App.storedPropertyValues(th.Context, groupID, propertyValuesTarget{"post", targetID}, nil)
	require.Len(t, previous, 1)
	assert.Equal(t, stored.ID, previous[0].ID)
	mockValueStore.AssertExpectations(t)
}

func TestStoredPropertyValuesPaging(t *testing.T) {
	mainHelper.Parallel(t)

	groupID, targetID := model.NewId(), model.NewId()
	valueOf := func(fieldID string) *model.PropertyValue {
		return &model.PropertyValue{ID: model.NewId(), GroupID: groupID, TargetType: "post", TargetID: targetID, FieldID: fieldID, Value: json.RawMessage(`"a"`)}
	}
	fullPage := func() []*model.PropertyValue {
		page := make([]*model.PropertyValue, propertyValuesHookPageSize)
		for i := range page {
			page[i] = valueOf(model.NewId())
		}
		return page
	}
	setup := func(t *testing.T) (*TestHelper, *storemocks.PropertyValueStore) {
		th := SetupWithStoreMock(t)
		mockValueStore := &storemocks.PropertyValueStore{}
		th.App.Srv().Store().(*storemocks.Store).On("PropertyValue").Return(mockValueStore)
		return th, mockValueStore
	}
	firstPage := mock.MatchedBy(func(opts model.PropertyValueSearchOpts) bool { return opts.Cursor.IsEmpty() })
	nextPage := mock.MatchedBy(func(opts model.PropertyValueSearchOpts) bool { return !opts.Cursor.IsEmpty() })

	t.Run("reads past full pages to find a field's value", func(t *testing.T) {
		th, mockValueStore := setup(t)
		wanted := valueOf(model.NewId())
		mockValueStore.On("SearchPropertyValues", mock.Anything, firstPage).Return(fullPage(), nil).Once()
		mockValueStore.On("SearchPropertyValues", mock.Anything, nextPage).Return([]*model.PropertyValue{wanted}, nil).Once()

		previous := th.App.storedPropertyValues(th.Context, groupID, propertyValuesTarget{"post", targetID}, map[string]bool{wanted.FieldID: true})
		require.Len(t, previous, 1)
		assert.Equal(t, wanted.ID, previous[0].ID)
		mockValueStore.AssertExpectations(t)
	})

	t.Run("stops once every field's value is found", func(t *testing.T) {
		th, mockValueStore := setup(t)
		page := fullPage()
		wanted := page[len(page)/2]
		mockValueStore.On("SearchPropertyValues", mock.Anything, firstPage).Return(page, nil).Once()

		previous := th.App.storedPropertyValues(th.Context, groupID, propertyValuesTarget{"post", targetID}, map[string]bool{wanted.FieldID: true})
		require.Len(t, previous, 1)
		assert.Equal(t, wanted.ID, previous[0].ID)
		mockValueStore.AssertExpectations(t)
	})
}

// hookPropertyValuesCall is one PropertyValuesHaveBeenUpdated call as the test plugin records it.
type hookPropertyValuesCall struct {
	UserID     string                 `json:"user_id"`
	GroupID    string                 `json:"group_id"`
	TargetType string                 `json:"target_type"`
	TargetID   string                 `json:"target_id"`
	Values     []*model.PropertyValue `json:"values"`
	Previous   []*model.PropertyValue `json:"previous"`
}

func TestHookPropertyValuesHaveBeenUpdated(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	tearDown, pluginIDs, activationErrors := SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"encoding/json"

			"github.com/mattermost/mattermost/server/public/model"
			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) PropertyValuesHaveBeenUpdated(c *plugin.Context, userID, groupID, targetType, targetID string, values, previousValues []*model.PropertyValue) {
			var calls []json.RawMessage
			if raw, appErr := p.API.KVGet("calls"); appErr == nil && raw != nil {
				_ = json.Unmarshal(raw, &calls)
			}
			call, _ := json.Marshal(map[string]any{
				"user_id":     userID,
				"group_id":    groupID,
				"target_type": targetType,
				"target_id":   targetID,
				"values":      values,
				"previous":    previousValues,
			})
			calls = append(calls, call)
			data, _ := json.Marshal(calls)
			p.API.KVSet("calls", data)
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`,
		}, th.App, th.NewPluginAPI)
	defer tearDown()
	require.Len(t, pluginIDs, 1)
	require.NoError(t, activationErrors[0])
	pluginID := pluginIDs[0]

	recorded := func() []hookPropertyValuesCall {
		raw, appErr := th.App.GetPluginKey(pluginID, "calls")
		require.Nil(t, appErr)
		var calls []hookPropertyValuesCall
		if raw != nil {
			require.NoError(t, json.Unmarshal(raw, &calls))
		}
		return calls
	}
	waitForCalls := func(n int) []hookPropertyValuesCall {
		var calls []hookPropertyValuesCall
		require.Eventually(t, func() bool {
			calls = recorded()
			return len(calls) >= n
		}, 10*time.Second, 50*time.Millisecond)
		require.Len(t, calls, n)
		return calls
	}

	groupID := registerTestPropertyGroup(t, th)
	field, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
		GroupID:    groupID,
		Name:       "hooked-" + model.NewId(),
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypePost,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	}, false, "")
	require.Nil(t, appErr)
	other, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
		GroupID:    groupID,
		Name:       "untouched-" + model.NewId(),
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypePost,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	}, false, "")
	require.Nil(t, appErr)

	post, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "a post with values",
	}, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)

	makeValue := func(fieldID, v, by string) *model.PropertyValue {
		return &model.PropertyValue{
			TargetID:   post.Id,
			TargetType: model.PropertyValueTargetTypePost,
			GroupID:    groupID,
			FieldID:    fieldID,
			Value:      json.RawMessage(`"` + v + `"`),
			CreatedBy:  by,
			UpdatedBy:  by,
		}
	}

	// The other field's value must never show up as a previous value of the hooked field.
	_, appErr = th.App.UpsertPropertyValues(th.Context, []*model.PropertyValue{makeValue(other.ID, "other", th.BasicUser.Id)}, "", "", "")
	require.Nil(t, appErr)
	calls := waitForCalls(1)
	assert.Equal(t, th.BasicUser.Id, calls[0].UserID, "without a session the writer is UpdatedBy")

	t.Run("first value of a field has no previous value", func(t *testing.T) {
		rctx := th.Context.WithSession(&model.Session{Id: model.NewId(), UserId: th.BasicUser2.Id})
		_, appErr := th.App.UpsertPropertyValues(rctx, []*model.PropertyValue{makeValue(field.ID, "first", th.BasicUser.Id)}, model.PropertyFieldObjectTypePost, post.Id, "")
		require.Nil(t, appErr)

		call := waitForCalls(2)[1]
		assert.Equal(t, th.BasicUser2.Id, call.UserID, "the session user is the writer")
		assert.Equal(t, groupID, call.GroupID)
		assert.Equal(t, model.PropertyValueTargetTypePost, call.TargetType)
		assert.Equal(t, post.Id, call.TargetID)
		require.Len(t, call.Values, 1)
		assert.Equal(t, field.ID, call.Values[0].FieldID)
		assert.JSONEq(t, `"first"`, string(call.Values[0].Value))
		assert.Empty(t, call.Previous)
	})

	t.Run("an update reports the value it replaced", func(t *testing.T) {
		_, appErr := th.App.UpsertPropertyValue(th.Context, makeValue(field.ID, "second", th.BasicUser2.Id))
		require.Nil(t, appErr)

		call := waitForCalls(3)[2]
		assert.Equal(t, th.BasicUser2.Id, call.UserID)
		require.Len(t, call.Values, 1)
		assert.JSONEq(t, `"second"`, string(call.Values[0].Value))
		require.Len(t, call.Previous, 1)
		assert.Equal(t, field.ID, call.Previous[0].FieldID)
		assert.JSONEq(t, `"first"`, string(call.Previous[0].Value))
	})

	t.Run("a deletion reports the deleted value only", func(t *testing.T) {
		values, appErr := th.App.SearchPropertyValues(th.Context, groupID, model.PropertyValueSearchOpts{TargetIDs: []string{post.Id}, FieldID: field.ID, PerPage: 10})
		require.Nil(t, appErr)
		require.Len(t, values, 1)

		require.Nil(t, th.App.DeletePropertyValue(th.Context, groupID, values[0].ID))

		call := waitForCalls(4)[3]
		assert.Empty(t, call.Values)
		require.Len(t, call.Previous, 1)
		assert.Equal(t, field.ID, call.Previous[0].FieldID)
		assert.JSONEq(t, `"second"`, string(call.Previous[0].Value))
	})

	t.Run("deleting a target's values reports all of them", func(t *testing.T) {
		require.Nil(t, th.App.DeletePropertyValuesForTarget(th.Context, groupID, model.PropertyValueTargetTypePost, post.Id))

		call := waitForCalls(5)[4]
		assert.Equal(t, post.Id, call.TargetID)
		assert.Empty(t, call.Values)
		require.Len(t, call.Previous, 1)
		assert.Equal(t, other.ID, call.Previous[0].FieldID)
	})

	t.Run("a plugin receives only the values it may read", func(t *testing.T) {
		// Reads of the access control group need an Enterprise license.
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
		defer th.App.Srv().SetLicense(nil)

		cpaGroup, appErr := th.App.GetPropertyGroup(th.Context, model.AccessControlPropertyGroupName)
		require.Nil(t, appErr)

		// Written to the store directly: only the owning plugin could create this field through
		// the service, and it isn't installed.
		newCPAField := func(attrs model.StringInterface) *model.PropertyField {
			created, err := th.App.Srv().Store().PropertyField().Create(&model.PropertyField{
				GroupID:    cpaGroup.ID,
				Name:       "field_" + model.NewId(),
				Type:       model.PropertyFieldTypeText,
				ObjectType: model.PropertyFieldObjectTypeUser,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				Attrs:      attrs,
			})
			require.NoError(t, err)
			return created
		}
		public := newCPAField(nil)
		restricted := newCPAField(model.StringInterface{
			model.PropertyAttrsProtected:      true,
			model.PropertyAttrsAccessMode:     model.PropertyAccessModeSourceOnly,
			model.PropertyAttrsSourcePluginID: "another.plugin",
		})
		userValue := func(fieldID, v string) *model.PropertyValue {
			return &model.PropertyValue{
				ID:         model.NewId(),
				GroupID:    cpaGroup.ID,
				FieldID:    fieldID,
				TargetType: model.PropertyValueTargetTypeUser,
				TargetID:   th.BasicUser.Id,
				Value:      json.RawMessage(`"` + v + `"`),
			}
		}

		before := len(recorded())

		// A change it may read none of isn't reported to it at all.
		th.App.runPropertyValuesHaveBeenUpdatedHook(th.Context, cpaGroup.ID, []*model.PropertyValue{userValue(restricted.ID, "secret")}, nil)
		th.App.runPropertyValuesHaveBeenUpdatedHook(th.Context, cpaGroup.ID,
			[]*model.PropertyValue{userValue(public.ID, "visible"), userValue(restricted.ID, "secret")},
			[]*model.PropertyValue{userValue(restricted.ID, "old secret")},
		)

		call := waitForCalls(before + 1)[before]
		require.Len(t, call.Values, 1)
		assert.Equal(t, public.ID, call.Values[0].FieldID)
		assert.Empty(t, call.Previous)
		assert.Never(t, func() bool { return len(recorded()) > before+1 }, time.Second, 50*time.Millisecond)
	})
}
