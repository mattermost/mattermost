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

// boundsSetup gives each caller its own group and rank template (LOW < MID < HIGH, fixed option IDs
// optlow/optmid/opthigh) so matching fields never leak between tests.
func boundsSetup(t *testing.T, th *TestHelper, rctx request.CTX) (groupID string, create func(objectType string, bounds model.PropertyBounds) *model.PropertyField, createDirect func(objectType string) *model.PropertyField) {
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
				map[string]any{"id": "optlow", "name": "LOW", "rank": 1},
				map[string]any{"id": "optmid", "name": "MID", "rank": 2},
				map[string]any{"id": "opthigh", "name": "HIGH", "rank": 3},
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

func TestBoundsParent(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	rctx := RequestContextWithCallerID(th.Context, model.NewId())

	belowParent := model.PropertyBounds{{Operator: model.PropertyBoundsOperatorAtOrBelow, Reference: model.PropertyBoundsReferenceParent}}

	postChannels := map[string]string{}
	newHook := func(groupID string, resolver PostChannelResolver) *AccessControlAttributeValidationHook {
		return NewAccessControlAttributeValidationHook(th.service, AccessControlAttributeValidationHookConfig{PostChannelResolver: resolver}, groupID)
	}
	mapResolver := func(_ request.CTX, postID string) (string, error) { return postChannels[postID], nil }

	t.Run("a channel field's parent is the system field", func(t *testing.T) {
		groupID, create, _ := boundsSetup(t, th, rctx)
		system := create(model.PropertyFieldObjectTypeSystem, nil)
		channel := create(model.PropertyFieldObjectTypeChannel, belowParent)

		parent, targetType, targetID, err := newHook(groupID, nil).boundsParent(rctx, channel, model.NewId())
		require.NoError(t, err)
		assert.Equal(t, system.ID, parent.ID)
		assert.Equal(t, model.PropertyValueTargetTypeSystem, targetType)
		assert.Equal(t, model.PropertyValueSystemTargetID, targetID)
	})

	t.Run("a user field's parent is the system field", func(t *testing.T) {
		groupID, create, _ := boundsSetup(t, th, rctx)
		system := create(model.PropertyFieldObjectTypeSystem, nil)
		user := create(model.PropertyFieldObjectTypeUser, belowParent)

		parent, targetType, targetID, err := newHook(groupID, nil).boundsParent(rctx, user, model.NewId())
		require.NoError(t, err)
		assert.Equal(t, system.ID, parent.ID)
		assert.Equal(t, model.PropertyValueTargetTypeSystem, targetType)
		assert.Equal(t, model.PropertyValueSystemTargetID, targetID)
	})

	t.Run("a post field's parent is the channel field on the post's channel", func(t *testing.T) {
		groupID, create, _ := boundsSetup(t, th, rctx)
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
		groupID, create, _ := boundsSetup(t, th, rctx)
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
		groupID, create, _ := boundsSetup(t, th, rctx)
		system := create(model.PropertyFieldObjectTypeSystem, nil)
		channel := create(model.PropertyFieldObjectTypeChannel, belowParent)
		require.NoError(t, th.service.DeletePropertyField(rctx, groupID, system.ID))

		_, _, _, err := newHook(groupID, nil).boundsParent(rctx, channel, model.NewId())
		require.ErrorIs(t, err, errBoundsCheckFailed)
	})

	t.Run("two matching fields refuse", func(t *testing.T) {
		groupID, create, createDirect := boundsSetup(t, th, rctx)
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

func TestCheckParentRule(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	rctx := RequestContextWithCallerID(th.Context, model.NewId())

	below := model.PropertyBoundsRule{Operator: model.PropertyBoundsOperatorAtOrBelow, Reference: model.PropertyBoundsReferenceParent}
	above := model.PropertyBoundsRule{Operator: model.PropertyBoundsOperatorAtOrAbove, Reference: model.PropertyBoundsReferenceParent}
	opt := func(id string) json.RawMessage { return json.RawMessage(`"` + id + `"`) }

	postChannels := map[string]string{}
	resolver := func(_ request.CTX, postID string) (string, error) {
		if channelID, ok := postChannels[postID]; ok {
			return channelID, nil
		}
		return "", errors.New("no such post")
	}

	// chain is a system, channel and post field on one template, hooked up with a stub resolver.
	type chain struct {
		hook                  *AccessControlAttributeValidationHook
		system, channel, post *model.PropertyField
		channelID, postID     string
	}
	newChain := func(t *testing.T, channelBounds, postBounds model.PropertyBounds) *chain {
		groupID, create, _ := boundsSetup(t, th, rctx)
		c := &chain{
			system:    create(model.PropertyFieldObjectTypeSystem, nil),
			channel:   create(model.PropertyFieldObjectTypeChannel, channelBounds),
			post:      create(model.PropertyFieldObjectTypePost, postBounds),
			channelID: model.NewId(),
			postID:    model.NewId(),
		}
		postChannels[c.postID] = c.channelID
		c.hook = NewAccessControlAttributeValidationHook(th.service, AccessControlAttributeValidationHookConfig{PostChannelResolver: resolver}, groupID)
		return c
	}
	// set stores a value straight through the service; no hooks are registered, so nothing validates it.
	set := func(t *testing.T, field *model.PropertyField, targetType, targetID string, value json.RawMessage) {
		t.Helper()
		_, err := th.service.UpsertPropertyValue(rctx, &model.PropertyValue{
			GroupID: field.GroupID, FieldID: field.ID, TargetType: targetType, TargetID: targetID, Value: value,
		})
		require.NoError(t, err)
	}
	setSystem := func(t *testing.T, c *chain, value json.RawMessage) {
		set(t, c.system, model.PropertyValueTargetTypeSystem, model.PropertyValueSystemTargetID, value)
	}
	setChannel := func(t *testing.T, c *chain, value json.RawMessage) {
		set(t, c.channel, model.PropertyValueTargetTypeChannel, c.channelID, value)
	}
	check := func(c *chain, field *model.PropertyField, rule model.PropertyBoundsRule, targetID string, value json.RawMessage) error {
		return c.hook.checkParentRule(rctx, field, rule, &model.PropertyValue{FieldID: field.ID, TargetID: targetID, Value: value})
	}

	t.Run("channel against the system", func(t *testing.T) {
		c := newChain(t, model.PropertyBounds{below}, nil)
		setSystem(t, c, opt("optmid"))
		require.ErrorIs(t, check(c, c.channel, below, c.channelID, opt("opthigh")), errBoundsViolated)
		require.NoError(t, check(c, c.channel, below, c.channelID, opt("optmid")))
		require.NoError(t, check(c, c.channel, below, c.channelID, opt("optlow")))
	})

	t.Run("a system with no value or a cleared one sets no limit", func(t *testing.T) {
		c := newChain(t, model.PropertyBounds{below}, nil)
		require.NoError(t, check(c, c.channel, below, c.channelID, opt("opthigh")))

		setSystem(t, c, json.RawMessage(`null`))
		require.NoError(t, check(c, c.channel, below, c.channelID, opt("opthigh")))
	})

	t.Run("post against its channel", func(t *testing.T) {
		c := newChain(t, nil, model.PropertyBounds{below})
		setChannel(t, c, opt("optlow"))
		require.ErrorIs(t, check(c, c.post, below, c.postID, opt("optmid")), errBoundsViolated)
		require.NoError(t, check(c, c.post, below, c.postID, opt("optlow")))
	})

	t.Run("an empty channel falls through to the system when channels carry the same rule", func(t *testing.T) {
		c := newChain(t, model.PropertyBounds{below}, model.PropertyBounds{below})
		setSystem(t, c, opt("optmid"))
		require.ErrorIs(t, check(c, c.post, below, c.postID, opt("opthigh")), errBoundsViolated)
		require.NoError(t, check(c, c.post, below, c.postID, opt("optmid")))

		// A cleared channel row counts as empty too.
		setChannel(t, c, json.RawMessage(`""`))
		require.ErrorIs(t, check(c, c.post, below, c.postID, opt("opthigh")), errBoundsViolated)
	})

	t.Run("an empty channel ends the walk when channels don't carry the rule", func(t *testing.T) {
		c := newChain(t, nil, model.PropertyBounds{below})
		setSystem(t, c, opt("optlow"))
		require.NoError(t, check(c, c.post, below, c.postID, opt("opthigh")))
	})

	t.Run("an empty channel and an empty system set no limit", func(t *testing.T) {
		c := newChain(t, model.PropertyBounds{below}, model.PropertyBounds{below})
		require.NoError(t, check(c, c.post, below, c.postID, opt("opthigh")))
	})

	t.Run("a floor walks up only through a floor", func(t *testing.T) {
		c := newChain(t, model.PropertyBounds{below}, model.PropertyBounds{above})
		setChannel(t, c, opt("optmid"))
		require.ErrorIs(t, check(c, c.post, above, c.postID, opt("optlow")), errBoundsViolated)
		require.NoError(t, check(c, c.post, above, c.postID, opt("opthigh")))

		// The channel field carries only a ceiling, so an empty channel ends the floor's walk.
		setChannel(t, c, json.RawMessage(`null`))
		setSystem(t, c, opt("opthigh"))
		require.NoError(t, check(c, c.post, above, c.postID, opt("optlow")))
	})

	t.Run("an empty new value passes without a lookup", func(t *testing.T) {
		c := newChain(t, nil, model.PropertyBounds{below})
		c.hook.postChannelResolver = nil
		require.NoError(t, check(c, c.post, below, c.postID, json.RawMessage(`null`)))
	})

	t.Run("broken data refuses", func(t *testing.T) {
		t.Run("a second matching field above an empty channel", func(t *testing.T) {
			groupID, create, createDirect := boundsSetup(t, th, rctx)
			create(model.PropertyFieldObjectTypeSystem, nil)
			create(model.PropertyFieldObjectTypeChannel, model.PropertyBounds{below})
			post := create(model.PropertyFieldObjectTypePost, model.PropertyBounds{below})
			createDirect(model.PropertyFieldObjectTypeSystem)
			channelID, postID := model.NewId(), model.NewId()
			postChannels[postID] = channelID
			hook := NewAccessControlAttributeValidationHook(th.service, AccessControlAttributeValidationHookConfig{PostChannelResolver: resolver}, groupID)

			err := hook.checkParentRule(rctx, post, below, &model.PropertyValue{FieldID: post.ID, TargetID: postID, Value: opt("optlow")})
			require.ErrorIs(t, err, errBoundsCheckFailed)
		})

		t.Run("a parent value naming an option the template lacks", func(t *testing.T) {
			c := newChain(t, model.PropertyBounds{below}, nil)
			setSystem(t, c, opt("gone"))
			require.ErrorIs(t, check(c, c.channel, below, c.channelID, opt("optlow")), errBoundsCheckFailed)
		})

		t.Run("a post whose channel can't be found", func(t *testing.T) {
			c := newChain(t, nil, model.PropertyBounds{below})
			require.ErrorIs(t, check(c, c.post, below, model.NewId(), opt("optlow")), errBoundsCheckFailed)
		})
	})
}
