// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBoundsParent(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	rctx := RequestContextWithCallerID(th.Context, model.NewId())

	belowParent := model.PropertyBounds{{Operator: model.PropertyBoundsOperatorAtOrBelow, Reference: model.PropertyBoundsReferenceParent}}

	postChannels := map[string]string{}
	newHook := func(groupID string, resolver PostChannelResolver) *AccessControlAttributeValidationHook {
		return NewAccessControlAttributeValidationHook(th.service, AccessControlAttributeValidationHookConfig{PostChannelResolver: resolver}, groupID)
	}
	mapResolver := func(_ request.CTX, postID string) (string, error) { return postChannels[postID], nil }

	// Each case gets its own group and template so matching fields never leak between them.
	setup := func(t *testing.T) (groupID string, create func(objectType string, bounds model.PropertyBounds) *model.PropertyField, createDirect func(objectType string) *model.PropertyField) {
		t.Helper()
		groupID = th.RegisterPropertyGroup(t, model.PropertyGroupVersionV3).ID
		template := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    groupID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeRank,
			Name:       "Classification " + model.NewId(),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "LOW", "rank": 1},
					map[string]any{"id": model.NewId(), "name": "HIGH", "rank": 2},
				},
			},
			Permissions: openPermissions(),
		})
		field := func(objectType string, bounds model.PropertyBounds) *model.PropertyField {
			return &model.PropertyField{
				GroupID:       groupID,
				ObjectType:    objectType,
				TargetType:    string(model.PropertyFieldTargetLevelSystem),
				Name:          objectType + " " + model.NewId(),
				LinkedFieldID: &template.ID,
				Bounds:        bounds,
			}
		}
		create = func(objectType string, bounds model.PropertyBounds) *model.PropertyField {
			created, err := th.service.CreatePropertyField(rctx, field(objectType, bounds))
			require.NoError(t, err)
			return created
		}
		createDirect = func(objectType string) *model.PropertyField {
			f := field(objectType, nil)
			f.Type = model.PropertyFieldTypeRank
			f.Permissions = openPermissions()
			return th.CreatePropertyFieldDirect(t, f)
		}
		return
	}

	t.Run("a channel field's parent is the system field", func(t *testing.T) {
		groupID, create, _ := setup(t)
		system := create(model.PropertyFieldObjectTypeSystem, nil)
		channel := create(model.PropertyFieldObjectTypeChannel, belowParent)

		parent, targetType, targetID, err := newHook(groupID, nil).boundsParent(rctx, channel, model.NewId())
		require.NoError(t, err)
		assert.Equal(t, system.ID, parent.ID)
		assert.Equal(t, model.PropertyValueTargetTypeSystem, targetType)
		assert.Equal(t, model.PropertyValueSystemTargetID, targetID)
	})

	t.Run("a user field's parent is the system field", func(t *testing.T) {
		groupID, create, _ := setup(t)
		system := create(model.PropertyFieldObjectTypeSystem, nil)
		user := create(model.PropertyFieldObjectTypeUser, belowParent)

		parent, targetType, targetID, err := newHook(groupID, nil).boundsParent(rctx, user, model.NewId())
		require.NoError(t, err)
		assert.Equal(t, system.ID, parent.ID)
		assert.Equal(t, model.PropertyValueTargetTypeSystem, targetType)
		assert.Equal(t, model.PropertyValueSystemTargetID, targetID)
	})

	t.Run("a post field's parent is the channel field on the post's channel", func(t *testing.T) {
		groupID, create, _ := setup(t)
		channel := create(model.PropertyFieldObjectTypeChannel, nil)
		post := create(model.PropertyFieldObjectTypePost, belowParent)
		postID, channelID := model.NewId(), model.NewId()
		postChannels[postID] = channelID

		parent, targetType, targetID, err := newHook(groupID, mapResolver).boundsParent(rctx, post, postID)
		require.NoError(t, err)
		assert.Equal(t, channel.ID, parent.ID)
		assert.Equal(t, model.PropertyValueTargetTypeChannel, targetType)
		assert.Equal(t, channelID, targetID)
	})

	t.Run("a post whose channel can't be found refuses", func(t *testing.T) {
		groupID, create, _ := setup(t)
		create(model.PropertyFieldObjectTypeChannel, nil)
		post := create(model.PropertyFieldObjectTypePost, belowParent)

		cases := map[string]PostChannelResolver{
			"no resolver":         nil,
			"resolver errors":     func(request.CTX, string) (string, error) { return "", errors.New("no such post") },
			"resolver gives \"\"": func(request.CTX, string) (string, error) { return "", nil },
		}
		for name, resolver := range cases {
			t.Run(name, func(t *testing.T) {
				_, _, _, err := newHook(groupID, resolver).boundsParent(rctx, post, model.NewId())
				require.ErrorIs(t, err, errBoundsCheckFailed)
			})
		}
	})

	t.Run("a missing matching field refuses", func(t *testing.T) {
		groupID, create, _ := setup(t)
		system := create(model.PropertyFieldObjectTypeSystem, nil)
		channel := create(model.PropertyFieldObjectTypeChannel, belowParent)
		require.NoError(t, th.service.DeletePropertyField(rctx, groupID, system.ID))

		_, _, _, err := newHook(groupID, nil).boundsParent(rctx, channel, model.NewId())
		require.ErrorIs(t, err, errBoundsCheckFailed)
	})

	t.Run("two matching fields refuse", func(t *testing.T) {
		groupID, create, createDirect := setup(t)
		create(model.PropertyFieldObjectTypeSystem, nil)
		channel := create(model.PropertyFieldObjectTypeChannel, belowParent)
		createDirect(model.PropertyFieldObjectTypeSystem)

		_, _, _, err := newHook(groupID, nil).boundsParent(rctx, channel, model.NewId())
		require.ErrorIs(t, err, errBoundsCheckFailed)
	})

	t.Run("a field whose object type has no parent refuses", func(t *testing.T) {
		system := &model.PropertyField{ObjectType: model.PropertyFieldObjectTypeSystem, Bounds: belowParent}

		_, _, _, err := newHook(model.NewId(), nil).boundsParent(rctx, system, model.PropertyValueSystemTargetID)
		require.ErrorIs(t, err, errBoundsCheckFailed)
	})
}

func TestCompareByRank(t *testing.T) {
	field := &model.PropertyField{
		ID:   model.NewId(),
		Type: model.PropertyFieldTypeRank,
		Attrs: model.StringInterface{
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"id": "optlow", "name": "LOW", "rank": 1},
				map[string]any{"id": "optmid", "name": "MID", "rank": 2},
				map[string]any{"id": "opthigh", "name": "HIGH", "rank": 3},
				map[string]any{"id": "optnone", "name": "UNRANKED"},
			},
		},
	}
	val := func(id string) json.RawMessage { return json.RawMessage(`"` + id + `"`) }

	below, above := model.PropertyBoundsOperatorAtOrBelow, model.PropertyBoundsOperatorAtOrAbove
	for name, tc := range map[string]struct {
		op        model.PropertyBoundsOperator
		next, ref json.RawMessage
		want      error
	}{
		"below, lower passes":        {below, val("optlow"), val("optmid"), nil},
		"below, equal passes":        {below, val("optmid"), val("optmid"), nil},
		"below, higher violates":     {below, val("opthigh"), val("optmid"), errBoundsViolated},
		"above, higher passes":       {above, val("opthigh"), val("optmid"), nil},
		"above, equal passes":        {above, val("optmid"), val("optmid"), nil},
		"above, lower violates":      {above, val("optlow"), val("optmid"), errBoundsViolated},
		"unknown next option":        {below, val("gone"), val("optmid"), errBoundsCheckFailed},
		"unknown ref option":         {below, val("optmid"), val("gone"), errBoundsCheckFailed},
		"next option without a rank": {below, val("optnone"), val("optmid"), errBoundsCheckFailed},
		"ref option without a rank":  {below, val("optmid"), val("optnone"), errBoundsCheckFailed},
		"empty next":                 {below, nil, val("optmid"), errBoundsCheckFailed},
		"empty ref":                  {below, val("optmid"), nil, errBoundsCheckFailed},
		"unknown operator":           {"sideways", val("optlow"), val("opthigh"), errBoundsCheckFailed},
	} {
		t.Run(name, func(t *testing.T) {
			err := compareByRank(field, tc.op, tc.next, tc.ref)
			if tc.want == nil {
				require.NoError(t, err)
				return
			}
			require.ErrorIs(t, err, tc.want)
			for _, secret := range []string{"optlow", "optmid", "opthigh", "optnone", "gone"} {
				assert.NotContains(t, err.Error(), secret)
			}
		})
	}
}
