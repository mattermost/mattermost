// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"errors"
	"net/http"
	"sync"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
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
		// Deleting the matching field is refused while the rule depends on it, so reach the broken state through the store.
		require.NoError(t, th.service.fieldStore.Delete(groupID, system.ID))

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

// injectingHook writes a value straight to the store inside a pre-hook of a write to field,
// standing in for a concurrent writer that lands between a check and the write it judged.
type injectingHook struct {
	BasePropertyHook
	field  *model.PropertyField
	inject func()
}

func (h *injectingHook) run(v *model.PropertyValue) {
	if h.inject != nil && v.FieldID == h.field.ID {
		h.inject()
	}
}

func (h *injectingHook) PreCreatePropertyValue(_ request.CTX, v *model.PropertyValue) (*model.PropertyValue, error) {
	h.run(v)
	return v, nil
}

func (h *injectingHook) PreUpsertPropertyValue(_ request.CTX, v *model.PropertyValue) (*model.PropertyValue, error) {
	h.run(v)
	return v, nil
}

func requireAppErrorID(t *testing.T, err error, id string, status int) {
	t.Helper()
	var appErr *model.AppError
	require.True(t, errors.As(err, &appErr), "got %v", err)
	assert.Equal(t, id, appErr.Id)
	assert.Equal(t, status, appErr.StatusCode)
}

func TestSamePropertyValue(t *testing.T) {
	cases := map[string]struct {
		a, b string
		want bool
	}{
		"identical":             {`"a"`, `"a"`, true},
		"different":             {`"a"`, `"b"`, false},
		"spacing differs":       {`["a","b"]`, `["a", "b"]`, true},
		"array order counts":    {`["a","b"]`, `["b","a"]`, false},
		"two empty values":      {`null`, `[]`, true},
		"empty against a value": {`""`, `"a"`, false},
		"absent against null":   {``, `null`, true},
		"a value against none":  {`"a"`, ``, false},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, tc.want, samePropertyValue(json.RawMessage(tc.a), json.RawMessage(tc.b)))
		})
	}
}

func TestEnforceMutability(t *testing.T) {
	th := Setup(t)
	rctx := th.Context
	groupID, create, createDirect := boundsSetup(t, th, rctx)
	// Made before the hook is registered: it would refuse these fixtures' names.
	create(model.PropertyFieldObjectTypeSystem, nil)
	parentRuleField := create(model.PropertyFieldObjectTypeChannel, model.PropertyBounds{{Operator: model.PropertyBoundsOperatorAtOrBelow, Reference: model.PropertyBoundsReferenceParent}})
	noRuleField := createDirect(model.PropertyFieldObjectTypeChannel)
	hook := NewAccessControlAttributeValidationHook(th.service, AccessControlAttributeValidationHookConfig{PropertyFieldBounds: func() bool { return true }}, groupID)
	th.service.AddHook(hook)
	// Registered after the validation hook, so it sees what the hook recorded.
	recorder := &recordingHook{}
	th.service.AddHook(recorder)
	injector := &injectingHook{}
	th.service.AddHook(injector)

	newField := func(fieldType model.PropertyFieldType, mutability model.PropertyFieldMutability, bounds model.PropertyBounds) *model.PropertyField {
		return th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    groupID,
			ObjectType: model.PropertyFieldObjectTypeChannel,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       fieldType,
			Name:       "f " + model.NewId(),
			Mutability: mutability,
			Bounds:     bounds,
		})
	}
	writeOnce := func() *model.PropertyField {
		return newField(model.PropertyFieldTypeText, model.PropertyFieldMutabilityWriteOnce, nil)
	}
	value := func(f *model.PropertyField, targetID, raw string) *model.PropertyValue {
		return &model.PropertyValue{GroupID: groupID, FieldID: f.ID, TargetID: targetID, TargetType: model.PropertyValueTargetTypeChannel, Value: json.RawMessage(raw)}
	}
	// seed writes straight to the store, past the hooks.
	seed := func(f *model.PropertyField, targetID, raw string) *model.PropertyValue {
		created, err := th.dbStore.PropertyValue().Create(value(f, targetID, raw))
		require.NoError(t, err)
		return created
	}
	stored := func(f *model.PropertyField, targetID string) string {
		vals, err := th.dbStore.PropertyValue().SearchPropertyValues(rctx, model.PropertyValueSearchOpts{GroupID: groupID, FieldID: f.ID, TargetIDs: []string{targetID}, PerPage: 10})
		require.NoError(t, err)
		if len(vals) == 0 {
			return ""
		}
		return string(vals[0].Value)
	}
	const writeOnceID = "app.property_value.write_once.app_error"

	t.Run("write-once takes a first write and refuses a change", func(t *testing.T) {
		f, target := writeOnce(), model.NewId()

		_, err := th.service.UpsertPropertyValue(rctx, value(f, target, `"a"`))
		require.NoError(t, err)

		_, err = th.service.UpsertPropertyValue(rctx, value(f, target, `"b"`))
		requireAppErrorID(t, err, writeOnceID, http.StatusForbidden)
		assert.Equal(t, `"a"`, stored(f, target))

		_, err = th.service.UpsertPropertyValue(rctx, value(f, target, `"a"`))
		require.NoError(t, err)

		_, err = th.service.UpsertPropertyValue(rctx, value(f, target, `null`))
		requireAppErrorID(t, err, writeOnceID, http.StatusForbidden)
		assert.Equal(t, `"a"`, stored(f, target))
	})

	t.Run("write-once accepts the stored value with different spacing", func(t *testing.T) {
		f := newField(model.PropertyFieldTypeMultiuser, model.PropertyFieldMutabilityWriteOnce, nil)
		target, a, b := model.NewId(), model.NewId(), model.NewId()

		_, err := th.service.UpsertPropertyValue(rctx, value(f, target, `["`+a+`","`+b+`"]`))
		require.NoError(t, err)
		_, err = th.service.UpsertPropertyValue(rctx, value(f, target, `[ "`+a+`" , "`+b+`" ]`))
		require.NoError(t, err)
		_, err = th.service.UpsertPropertyValue(rctx, value(f, target, `["`+b+`","`+a+`"]`))
		requireAppErrorID(t, err, writeOnceID, http.StatusForbidden)
	})

	t.Run("write-once counts a null-valued row as no value", func(t *testing.T) {
		f, target := writeOnce(), model.NewId()
		seed(f, target, `null`)

		_, err := th.service.UpsertPropertyValue(rctx, value(f, target, `"a"`))
		require.NoError(t, err)
		assert.Equal(t, `"a"`, stored(f, target))
	})

	t.Run("set-on-create refuses even a first write", func(t *testing.T) {
		f, target := newField(model.PropertyFieldTypeText, model.PropertyFieldMutabilitySetOnCreate, nil), model.NewId()

		_, err := th.service.UpsertPropertyValue(rctx, value(f, target, `"a"`))
		requireAppErrorID(t, err, "app.property_value.set_on_create.app_error", http.StatusForbidden)
		assert.Equal(t, "", stored(f, target))
	})

	t.Run("an update that soft-deletes a set write-once value is refused", func(t *testing.T) {
		f, target := writeOnce(), model.NewId()
		row := seed(f, target, `"a"`)

		upd := *row
		upd.DeleteAt = model.GetMillis()
		_, err := th.service.UpdatePropertyValue(rctx, groupID, &upd)
		requireAppErrorID(t, err, writeOnceID, http.StatusForbidden)
		assert.Equal(t, `"a"`, stored(f, target))
	})

	t.Run("one refused value refuses the whole batch", func(t *testing.T) {
		f, free, locked := writeOnce(), model.NewId(), model.NewId()
		seed(f, locked, `"a"`)

		_, err := th.service.UpsertPropertyValues(rctx, []*model.PropertyValue{value(f, free, `"x"`), value(f, locked, `"b"`)})
		requireAppErrorID(t, err, writeOnceID, http.StatusForbidden)
		assert.Equal(t, "", stored(f, free))
		assert.Equal(t, `"a"`, stored(f, locked))
	})

	t.Run("a batch naming one governed field and target twice is refused", func(t *testing.T) {
		f, target := writeOnce(), model.NewId()

		_, err := th.service.UpsertPropertyValues(rctx, []*model.PropertyValue{value(f, target, `"a"`), value(f, target, `"b"`)})
		require.ErrorIs(t, err, ErrInvalidValue)
		assert.Equal(t, "", stored(f, target))
	})

	t.Run("fields that don't compare with the stored value record nothing", func(t *testing.T) {
		for name, f := range map[string]*model.PropertyField{"no rule": noRuleField, "parent rule": parentRuleField} {
			t.Run(name, func(t *testing.T) {
				target := model.NewId()
				seed(f, target, `"optlow"`)
				var recorded = -1
				recorder.record = func(c *valueWriteConditions) { recorded = len(c.read) }
				t.Cleanup(func() { recorder.record = nil })

				_, err := th.service.UpsertPropertyValue(rctx, value(f, target, `"optmid"`))
				require.NoError(t, err)
				assert.Equal(t, 0, recorded)
				assert.Equal(t, `"optmid"`, stored(f, target))
			})
		}
	})

	t.Run("a write with no record on the request is refused", func(t *testing.T) {
		f, target := writeOnce(), model.NewId()

		_, err := hook.PreUpsertPropertyValues(rctx, []*model.PropertyValue{value(f, target, `"a"`)})
		require.Error(t, err)
		assert.Equal(t, "", stored(f, target))
	})

	t.Run("a writer landing between the check and the write is refused", func(t *testing.T) {
		t.Cleanup(func() { injector.inject = nil })

		t.Run("upsert", func(t *testing.T) {
			f, target := writeOnce(), model.NewId()
			injector.field = f
			injector.inject = func() {
				_, err := th.dbStore.PropertyValue().Upsert([]*model.PropertyValue{value(f, target, `"b"`)})
				require.NoError(t, err)
			}

			_, err := th.service.UpsertPropertyValue(rctx, value(f, target, `"a"`))
			requireWriteConflict(t, err)
			assert.Equal(t, `"b"`, stored(f, target))
		})

		t.Run("create", func(t *testing.T) {
			f, target := writeOnce(), model.NewId()
			injector.field = f
			injector.inject = func() {
				_, err := th.dbStore.PropertyValue().Upsert([]*model.PropertyValue{value(f, target, `"b"`)})
				require.NoError(t, err)
			}

			_, err := th.service.CreatePropertyValue(rctx, value(f, target, `"a"`))
			requireWriteConflict(t, err)
			assert.Equal(t, `"b"`, stored(f, target))
		})
	})

	t.Run("of two simultaneous first writes exactly one wins", func(t *testing.T) {
		f := writeOnce()
		for range 20 {
			target := model.NewId()
			var wg sync.WaitGroup
			errs := make([]error, 2)
			for i, raw := range []string{`"a"`, `"b"`} {
				wg.Go(func() {
					_, errs[i] = th.service.UpsertPropertyValue(rctx, value(f, target, raw))
				})
			}
			wg.Wait()

			winner := 0
			if errs[0] != nil {
				winner = 1
			}
			require.NoError(t, errs[winner])
			var appErr *model.AppError
			require.True(t, errors.As(errs[1-winner], &appErr), "got %v", errs[1-winner])
			assert.Contains(t, []string{"app.property_value.write_conflict.app_error", writeOnceID}, appErr.Id)
			assert.Equal(t, []string{`"a"`, `"b"`}[winner], stored(f, target))
		}
	})
}

func TestEnforceSelfRules(t *testing.T) {
	th := Setup(t)
	rctx := th.Context
	groupID, create, _ := boundsSetup(t, th, rctx)
	// Made before the hook is registered: it would refuse these fixtures' names.
	create(model.PropertyFieldObjectTypeSystem, nil)
	raiseOnly := create(model.PropertyFieldObjectTypeChannel, model.PropertyBounds{{Operator: model.PropertyBoundsOperatorAtOrAbove, Reference: model.PropertyBoundsReferenceSelf}})
	lowerOnly := create(model.PropertyFieldObjectTypeChannel, model.PropertyBounds{{Operator: model.PropertyBoundsOperatorAtOrBelow, Reference: model.PropertyBoundsReferenceSelf}})
	hook := NewAccessControlAttributeValidationHook(th.service, AccessControlAttributeValidationHookConfig{PropertyFieldBounds: func() bool { return true }}, groupID)
	th.service.AddHook(hook)
	injector := &injectingHook{}
	th.service.AddHook(injector)

	value := func(f *model.PropertyField, targetID, raw string) *model.PropertyValue {
		return &model.PropertyValue{GroupID: groupID, FieldID: f.ID, TargetID: targetID, TargetType: model.PropertyValueTargetTypeChannel, Value: json.RawMessage(raw)}
	}
	opt := func(id string) string { return `"` + id + `"` }
	write := func(f *model.PropertyField, targetID, raw string) error {
		_, err := th.service.UpsertPropertyValue(rctx, value(f, targetID, raw))
		return err
	}
	stored := func(f *model.PropertyField, targetID string) string {
		vals, err := th.dbStore.PropertyValue().SearchPropertyValues(rctx, model.PropertyValueSearchOpts{GroupID: groupID, FieldID: f.ID, TargetIDs: []string{targetID}, PerPage: 10})
		require.NoError(t, err)
		if len(vals) == 0 {
			return ""
		}
		return string(vals[0].Value)
	}
	const violatedID = "app.property_value.bounds_violated.app_error"
	const checkFailedID = "app.property_value.bounds_check_failed.app_error"

	t.Run("raise-only", func(t *testing.T) {
		target := model.NewId()
		require.NoError(t, write(raiseOnly, target, opt("optmid")))
		require.NoError(t, write(raiseOnly, target, opt("opthigh")))

		err := write(raiseOnly, target, opt("optlow"))
		requireAppErrorID(t, err, violatedID, http.StatusForbidden)
		require.ErrorIs(t, err, errBoundsViolated)
		assert.Equal(t, opt("opthigh"), stored(raiseOnly, target))

		require.NoError(t, write(raiseOnly, target, opt("opthigh")))

		requireAppErrorID(t, write(raiseOnly, target, `null`), violatedID, http.StatusForbidden)
		assert.Equal(t, opt("opthigh"), stored(raiseOnly, target))
	})

	t.Run("lower-only", func(t *testing.T) {
		target := model.NewId()
		require.NoError(t, write(lowerOnly, target, opt("optmid")))
		require.NoError(t, write(lowerOnly, target, opt("optlow")))
		requireAppErrorID(t, write(lowerOnly, target, opt("opthigh")), violatedID, http.StatusForbidden)
		assert.Equal(t, opt("optlow"), stored(lowerOnly, target))
		require.NoError(t, write(lowerOnly, target, opt("optlow")))
	})

	t.Run("a clear with nothing stored is free", func(t *testing.T) {
		target := model.NewId()
		require.NoError(t, write(raiseOnly, target, `null`))
	})

	t.Run("a null-valued row counts as nothing stored", func(t *testing.T) {
		target := model.NewId()
		_, err := th.dbStore.PropertyValue().Create(value(raiseOnly, target, `null`))
		require.NoError(t, err)

		require.NoError(t, write(raiseOnly, target, opt("optlow")))
		assert.Equal(t, opt("optlow"), stored(raiseOnly, target))
	})

	t.Run("a soft delete of a set value is a clear and is refused", func(t *testing.T) {
		target := model.NewId()
		row, err := th.dbStore.PropertyValue().Create(value(raiseOnly, target, opt("optmid")))
		require.NoError(t, err)

		upd := *row
		upd.DeleteAt = model.GetMillis()
		_, err = th.service.UpdatePropertyValue(rctx, groupID, &upd)
		requireAppErrorID(t, err, violatedID, http.StatusForbidden)
		assert.Equal(t, opt("optmid"), stored(raiseOnly, target))
	})

	t.Run("a stored option the template no longer has refuses the write", func(t *testing.T) {
		target := model.NewId()
		_, err := th.dbStore.PropertyValue().Upsert([]*model.PropertyValue{value(raiseOnly, target, opt("gone"))})
		require.NoError(t, err)

		requireAppErrorID(t, write(raiseOnly, target, opt("opthigh")), checkFailedID, http.StatusConflict)
		assert.Equal(t, opt("gone"), stored(raiseOnly, target))
	})

	t.Run("an unknown reference refuses the write", func(t *testing.T) {
		f := *raiseOnly
		f.Bounds = model.PropertyBounds{{Operator: model.PropertyBoundsOperatorAtOrBelow, Reference: "sibling"}}
		wctx, _ := withValueWriteConditions(rctx)

		err := hook.enforceBounds(wctx, []*model.PropertyValue{value(&f, model.NewId(), opt("optlow"))}, map[string]*model.PropertyField{f.ID: &f})
		require.ErrorIs(t, err, errBoundsCheckFailed)
	})

	t.Run("a refusal never reveals a limit", func(t *testing.T) {
		target := model.NewId()
		require.NoError(t, write(raiseOnly, target, opt("opthigh")))
		err := write(raiseOnly, target, opt("optlow"))
		var appErr *model.AppError
		require.True(t, errors.As(err, &appErr))
		for _, secret := range []string{"optlow", "optmid", "opthigh"} {
			assert.NotContains(t, appErr.Message, secret)
			assert.NotContains(t, appErr.DetailedError, secret)
			assert.NotContains(t, appErr.Error(), secret)
		}
	})

	t.Run("a raise landing between the check and the write is refused", func(t *testing.T) {
		t.Cleanup(func() { injector.inject = nil })
		target := model.NewId()
		require.NoError(t, write(raiseOnly, target, opt("optlow")))
		injector.field = raiseOnly
		injector.inject = func() {
			_, err := th.dbStore.PropertyValue().Upsert([]*model.PropertyValue{value(raiseOnly, target, opt("opthigh"))})
			require.NoError(t, err)
		}

		requireWriteConflict(t, write(raiseOnly, target, opt("optmid")))
		assert.Equal(t, opt("opthigh"), stored(raiseOnly, target))
	})
}

func TestEnforceParentRules(t *testing.T) {
	th := Setup(t)
	rctx := th.Context
	groupID, create, _ := boundsSetup(t, th, rctx)
	below := model.PropertyBounds{{Operator: model.PropertyBoundsOperatorAtOrBelow, Reference: model.PropertyBoundsReferenceParent}}
	above := model.PropertyBounds{{Operator: model.PropertyBoundsOperatorAtOrAbove, Reference: model.PropertyBoundsReferenceParent}}
	// Made before the hook is registered: it would refuse these fixtures' names.
	system := create(model.PropertyFieldObjectTypeSystem, nil)
	channelField := create(model.PropertyFieldObjectTypeChannel, below)
	userField := create(model.PropertyFieldObjectTypeUser, above)
	postField := create(model.PropertyFieldObjectTypePost, below)

	postChannels := map[string]string{}
	resolver := func(_ request.CTX, postID string) (string, error) {
		if channelID, ok := postChannels[postID]; ok {
			return channelID, nil
		}
		return "", errors.New("no such post")
	}
	hook := NewAccessControlAttributeValidationHook(th.service, AccessControlAttributeValidationHookConfig{
		PropertyFieldBounds: func() bool { return true },
		PostChannelResolver: resolver,
	}, groupID)
	th.service.AddHook(hook)
	// Registered after the validation hook, so it sees what the hook recorded.
	recorder := &recordingHook{}
	th.service.AddHook(recorder)

	opt := func(id string) string { return `"` + id + `"` }
	// seed writes straight to the store, past the hooks.
	seed := func(f *model.PropertyField, targetType, targetID, raw string) {
		_, err := th.dbStore.PropertyValue().Upsert([]*model.PropertyValue{{GroupID: groupID, FieldID: f.ID, TargetType: targetType, TargetID: targetID, Value: json.RawMessage(raw)}})
		require.NoError(t, err)
	}
	// setSystem replaces the one system value every subtest shares; `null` is no value.
	setSystem := func(raw string) {
		seed(system, model.PropertyValueTargetTypeSystem, model.PropertyValueSystemTargetID, raw)
	}
	write := func(f *model.PropertyField, targetType, targetID, raw string) error {
		_, err := th.service.UpsertPropertyValue(rctx, &model.PropertyValue{GroupID: groupID, FieldID: f.ID, TargetType: targetType, TargetID: targetID, Value: json.RawMessage(raw)})
		return err
	}
	newPost := func(channelID string) string {
		postID := model.NewId()
		postChannels[postID] = channelID
		return postID
	}
	const violatedID = "app.property_value.bounds_violated.app_error"
	const checkFailedID = "app.property_value.bounds_check_failed.app_error"

	t.Run("a channel is held at or below the system", func(t *testing.T) {
		setSystem(opt("optmid"))
		target := model.NewId()
		err := write(channelField, model.PropertyValueTargetTypeChannel, target, opt("opthigh"))
		requireAppErrorID(t, err, violatedID, http.StatusForbidden)
		require.ErrorIs(t, err, errBoundsViolated)
		require.NoError(t, write(channelField, model.PropertyValueTargetTypeChannel, target, opt("optmid")))
		require.NoError(t, write(channelField, model.PropertyValueTargetTypeChannel, target, opt("optlow")))
	})

	t.Run("a system with no value sets no limit", func(t *testing.T) {
		setSystem(`null`)
		require.NoError(t, write(channelField, model.PropertyValueTargetTypeChannel, model.NewId(), opt("opthigh")))
	})

	t.Run("a user is held at or above the system", func(t *testing.T) {
		setSystem(opt("optmid"))
		target := model.NewId()
		requireAppErrorID(t, write(userField, model.PropertyValueTargetTypeUser, target, opt("optlow")), violatedID, http.StatusForbidden)
		require.NoError(t, write(userField, model.PropertyValueTargetTypeUser, target, opt("opthigh")))
	})

	t.Run("a post is held to its channel, and clearing needs no lookup", func(t *testing.T) {
		setSystem(`null`)
		channelID := model.NewId()
		seed(channelField, model.PropertyValueTargetTypeChannel, channelID, opt("optlow"))
		postID := newPost(channelID)
		requireAppErrorID(t, write(postField, model.PropertyValueTargetTypePost, postID, opt("optmid")), violatedID, http.StatusForbidden)
		require.NoError(t, write(postField, model.PropertyValueTargetTypePost, postID, opt("optlow")))

		// No entry for postID in the resolver: a lookup would refuse.
		require.NoError(t, write(postField, model.PropertyValueTargetTypePost, model.NewId(), `null`))
	})

	t.Run("a channel with no value passes the post up to the system", func(t *testing.T) {
		setSystem(opt("optmid"))
		postID := newPost(model.NewId())
		requireAppErrorID(t, write(postField, model.PropertyValueTargetTypePost, postID, opt("opthigh")), violatedID, http.StatusForbidden)
		require.NoError(t, write(postField, model.PropertyValueTargetTypePost, postID, opt("optmid")))
	})

	t.Run("a post whose channel can't be found is refused", func(t *testing.T) {
		setSystem(opt("optmid"))
		err := write(postField, model.PropertyValueTargetTypePost, model.NewId(), opt("optlow"))
		requireAppErrorID(t, err, checkFailedID, http.StatusConflict)
		require.ErrorIs(t, err, errBoundsCheckFailed)
	})

	t.Run("a refusal never reveals the parent's value", func(t *testing.T) {
		setSystem(opt("optmid"))
		err := write(channelField, model.PropertyValueTargetTypeChannel, model.NewId(), opt("opthigh"))
		var appErr *model.AppError
		require.True(t, errors.As(err, &appErr))
		for _, secret := range []string{"optlow", "optmid", "opthigh"} {
			assert.NotContains(t, appErr.Message, secret)
			assert.NotContains(t, appErr.DetailedError, secret)
			assert.NotContains(t, appErr.Error(), secret)
		}
	})

	t.Run("a field with only parent rules records nothing", func(t *testing.T) {
		t.Cleanup(func() { recorder.record = nil })
		setSystem(opt("optmid"))
		target := model.NewId()
		recorder.record = func(c *valueWriteConditions) {
			assert.Empty(t, c.read)
		}
		require.NoError(t, write(channelField, model.PropertyValueTargetTypeChannel, target, opt("optlow")))
	})
}

func TestClearRefusal(t *testing.T) {
	self := model.PropertyBoundsRule{Operator: model.PropertyBoundsOperatorAtOrAbove, Reference: model.PropertyBoundsReferenceSelf}
	parent := model.PropertyBoundsRule{Operator: model.PropertyBoundsOperatorAtOrBelow, Reference: model.PropertyBoundsReferenceParent}
	cases := map[string]struct {
		mutability model.PropertyFieldMutability
		bounds     model.PropertyBounds
		wantID     string
	}{
		"nothing":               {},
		"mutable":               {mutability: model.PropertyFieldMutabilityMutable},
		"parent rule only":      {bounds: model.PropertyBounds{parent}},
		"write-once":            {mutability: model.PropertyFieldMutabilityWriteOnce, wantID: "app.property_value.write_once.app_error"},
		"set-on-create":         {mutability: model.PropertyFieldMutabilitySetOnCreate, wantID: "app.property_value.set_on_create.app_error"},
		"unrecognised":          {mutability: "frozen", wantID: "app.property_value.set_on_create.app_error"},
		"self rule":             {bounds: model.PropertyBounds{self}, wantID: "app.property_value.bounds_violated.app_error"},
		"self and parent rules": {bounds: model.PropertyBounds{parent, self}, wantID: "app.property_value.bounds_violated.app_error"},
		"write-once, self rule": {mutability: model.PropertyFieldMutabilityWriteOnce, bounds: model.PropertyBounds{self}, wantID: "app.property_value.write_once.app_error"},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			field := &model.PropertyField{ID: model.NewId(), Mutability: tc.mutability, Bounds: tc.bounds}
			err := clearRefusal(field)
			// A clear is refused exactly when the write path compares with the stored value.
			assert.Equal(t, storedValueMatters(field), err != nil)
			if tc.wantID == "" {
				require.NoError(t, err)
				return
			}
			requireAppErrorID(t, err, tc.wantID, http.StatusForbidden)
		})
	}
}

// deleteInjectingHook runs inject inside the pre-hook of a delete of everything on a target, standing
// in for a first write that lands between the check and the delete.
type deleteInjectingHook struct {
	BasePropertyHook
	inject func()
}

func (h *deleteInjectingHook) PreDeletePropertyValuesForTarget(request.CTX, string, string, string) error {
	if h.inject != nil {
		h.inject()
	}
	return nil
}

func TestRefuseLockedDeletes(t *testing.T) {
	th := Setup(t)
	rctx := th.Context
	groupID, create, createDirect := boundsSetup(t, th, rctx)
	selfRule := model.PropertyBounds{{Operator: model.PropertyBoundsOperatorAtOrAbove, Reference: model.PropertyBoundsReferenceSelf}}
	parentRule := model.PropertyBounds{{Operator: model.PropertyBoundsOperatorAtOrBelow, Reference: model.PropertyBoundsReferenceParent}}
	// Made before the hook is registered: it would refuse these fixtures' names.
	create(model.PropertyFieldObjectTypeSystem, nil)
	raiseOnlyUser := create(model.PropertyFieldObjectTypeUser, selfRule)
	parentOnlyUser := create(model.PropertyFieldObjectTypeUser, parentRule)
	parentOnlyChannel := create(model.PropertyFieldObjectTypeChannel, parentRule)
	mutableChannel := createDirect(model.PropertyFieldObjectTypeChannel)
	th.service.AddHook(NewAccessControlAttributeValidationHook(th.service, AccessControlAttributeValidationHookConfig{PropertyFieldBounds: func() bool { return true }}, groupID))
	// Registered after the validation hook, so it runs once the hook has judged the delete.
	injector := &deleteInjectingHook{}
	th.service.AddHook(injector)

	newWriteOnce := func() *model.PropertyField {
		return th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    groupID,
			ObjectType: model.PropertyFieldObjectTypeChannel,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
			Name:       "f " + model.NewId(),
			Mutability: model.PropertyFieldMutabilityWriteOnce,
		})
	}
	// seed writes straight to the store, past the hooks.
	seed := func(f *model.PropertyField, targetType, targetID, raw string) *model.PropertyValue {
		created, err := th.dbStore.PropertyValue().Create(&model.PropertyValue{GroupID: groupID, FieldID: f.ID, TargetType: targetType, TargetID: targetID, Value: json.RawMessage(raw)})
		require.NoError(t, err)
		return created
	}
	stored := func(f *model.PropertyField, targetID string) string {
		vals, err := th.dbStore.PropertyValue().SearchPropertyValues(rctx, model.PropertyValueSearchOpts{GroupID: groupID, FieldID: f.ID, TargetIDs: []string{targetID}, PerPage: 10})
		require.NoError(t, err)
		if len(vals) == 0 {
			return ""
		}
		return string(vals[0].Value)
	}
	const writeOnceID = "app.property_value.write_once.app_error"
	const violatedID = "app.property_value.bounds_violated.app_error"
	channel, user := model.PropertyValueTargetTypeChannel, model.PropertyValueTargetTypeUser

	t.Run("a write-once row is not deleted, set or not", func(t *testing.T) {
		f, target := newWriteOnce(), model.NewId()
		set := seed(f, channel, target, `"a"`)
		requireAppErrorID(t, th.service.DeletePropertyValue(rctx, groupID, set.ID), writeOnceID, http.StatusForbidden)
		assert.Equal(t, `"a"`, stored(f, target))

		other, otherTarget := newWriteOnce(), model.NewId()
		null := seed(other, channel, otherTarget, `null`)
		requireAppErrorID(t, th.service.DeletePropertyValue(rctx, groupID, null.ID), writeOnceID, http.StatusForbidden)
		assert.Equal(t, `null`, stored(other, otherTarget))
	})

	t.Run("a row of a field with only a parent rule is deleted", func(t *testing.T) {
		target := model.NewId()
		row := seed(parentOnlyChannel, channel, target, `"optlow"`)
		require.NoError(t, th.service.DeletePropertyValue(rctx, groupID, row.ID))
		assert.Equal(t, "", stored(parentOnlyChannel, target))
	})

	t.Run("a row that is already gone is left to the store", func(t *testing.T) {
		err := th.service.DeletePropertyValue(rctx, groupID, model.NewId())
		require.Error(t, err)
		assert.True(t, store.IsErrNotFound(err), "got %v", err)
	})

	t.Run("a raise-only user's values are not cleared in bulk", func(t *testing.T) {
		target := model.NewId()
		seed(raiseOnlyUser, user, target, `"optmid"`)
		err := th.service.DeletePropertyValuesForTarget(rctx, groupID, user, target)
		requireAppErrorID(t, err, violatedID, http.StatusForbidden)
		assert.Equal(t, `"optmid"`, stored(raiseOnlyUser, target))
	})

	t.Run("a user's values under only a parent rule are cleared in bulk", func(t *testing.T) {
		target := model.NewId()
		seed(parentOnlyUser, user, target, `"optlow"`)
		require.NoError(t, th.service.DeletePropertyValuesForTarget(rctx, groupID, user, target))
		assert.Equal(t, "", stored(parentOnlyUser, target))
	})

	t.Run("a set write-once value on a channel refuses the whole bulk delete", func(t *testing.T) {
		f, target := newWriteOnce(), model.NewId()
		seed(f, channel, target, `"a"`)
		seed(mutableChannel, channel, target, `"m"`)

		err := th.service.DeletePropertyValuesForTarget(rctx, groupID, channel, target)
		requireAppErrorID(t, err, writeOnceID, http.StatusForbidden)
		assert.Equal(t, `"a"`, stored(f, target))
		assert.Equal(t, `"m"`, stored(mutableChannel, target))
	})

	t.Run("a null write-once row stays and the rest goes", func(t *testing.T) {
		f, target := newWriteOnce(), model.NewId()
		seed(f, channel, target, `null`)
		seed(mutableChannel, channel, target, `"m"`)

		require.NoError(t, th.service.DeletePropertyValuesForTarget(rctx, groupID, channel, target))
		assert.Equal(t, "", stored(mutableChannel, target))
		assert.Equal(t, `null`, stored(f, target))
	})

	t.Run("a first write landing before the delete keeps its value", func(t *testing.T) {
		f, target := newWriteOnce(), model.NewId()
		seed(mutableChannel, channel, target, `"m"`)
		injector.inject = func() { seed(f, channel, target, `"first"`) }
		t.Cleanup(func() { injector.inject = nil })

		require.NoError(t, th.service.DeletePropertyValuesForTarget(rctx, groupID, channel, target))
		assert.Equal(t, `"first"`, stored(f, target))
		assert.Equal(t, "", stored(mutableChannel, target))
	})

	t.Run("every value of a write-once field is not deleted, set or not", func(t *testing.T) {
		f := newWriteOnce()
		requireAppErrorID(t, th.service.DeletePropertyValuesForField(rctx, groupID, f.ID), writeOnceID, http.StatusForbidden)
	})

	t.Run("every value of a field with only a parent rule is deleted", func(t *testing.T) {
		target := model.NewId()
		seed(parentOnlyChannel, channel, target, `"optlow"`)
		require.NoError(t, th.service.DeletePropertyValuesForField(rctx, groupID, parentOnlyChannel.ID))
		assert.Equal(t, "", stored(parentOnlyChannel, target))
	})
}
