// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"maps"
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAllowedByRule(t *testing.T) {
	ranks := map[string]int{"low": 1, "mid": 2, "high": 3}

	got, err := allowedByRule(ranks, model.PropertyBoundsOperatorAtOrBelow, 2)
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"low", "mid"}, got)

	got, err = allowedByRule(ranks, model.PropertyBoundsOperatorAtOrAbove, 2)
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"mid", "high"}, got)

	_, err = allowedByRule(ranks, "sideways", 2)
	require.ErrorIs(t, err, errBoundsCheckFailed)
}

func TestRefuseRulesBrokenByStoredValues(t *testing.T) {
	th := Setup(t)
	rctx := th.Context
	below := model.PropertyBounds{{Operator: model.PropertyBoundsOperatorAtOrBelow, Reference: model.PropertyBoundsReferenceParent}}
	above := model.PropertyBounds{{Operator: model.PropertyBoundsOperatorAtOrAbove, Reference: model.PropertyBoundsReferenceParent}}
	self := model.PropertyBounds{{Operator: model.PropertyBoundsOperatorAtOrAbove, Reference: model.PropertyBoundsReferenceSelf}}
	const breachID = "app.property_field.bounds_stored_values.app_error"
	const checkFailedID = "app.property_field.bounds_check_failed.app_error"

	type fixture struct {
		system, channel, user *model.PropertyField
	}
	setup := func(t *testing.T) fixture {
		t.Helper()
		_, create, _ := boundsSetup(t, th, rctx)
		return fixture{
			system:  create(model.PropertyFieldObjectTypeSystem, nil),
			channel: create(model.PropertyFieldObjectTypeChannel, nil),
			user:    create(model.PropertyFieldObjectTypeUser, nil),
		}
	}
	// seed writes straight to the store, past the hooks.
	seed := func(f *model.PropertyField, targetType, targetID, optionID string) {
		t.Helper()
		raw := json.RawMessage(`"` + optionID + `"`)
		_, err := th.dbStore.PropertyValue().Upsert([]*model.PropertyValue{{GroupID: f.GroupID, FieldID: f.ID, TargetType: targetType, TargetID: targetID, Value: raw}})
		require.NoError(t, err)
	}
	seedSystem := func(f fixture, optionID string) {
		seed(f.system, model.PropertyValueTargetTypeSystem, model.PropertyValueSystemTargetID, optionID)
	}
	// setBounds saves f with the given bounds; nil leaves them unstated.
	setBounds := func(f *model.PropertyField, bounds model.PropertyBounds) error {
		c := *f
		c.Bounds = bounds
		_, _, err := th.service.UpdatePropertyField(rctx, f.GroupID, &c)
		return err
	}
	storedBounds := func(f *model.PropertyField) model.PropertyBounds {
		got, err := th.service.GetPropertyField(rctx, f.GroupID, f.ID)
		require.NoError(t, err)
		return got.Bounds
	}
	examplesOf := func(err error) []string {
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		_, list, ok := strings.Cut(appErr.DetailedError, "e.g. ")
		require.True(t, ok, appErr.DetailedError)
		return strings.Split(list, ", ")
	}

	t.Run("a channel rule that a stored value breaks is refused", func(t *testing.T) {
		f := setup(t)
		seedSystem(f, "optmid")
		a, b := model.NewId(), model.NewId()
		seed(f.channel, model.PropertyValueTargetTypeChannel, a, "opthigh")
		seed(f.channel, model.PropertyValueTargetTypeChannel, b, "optlow")

		err := setBounds(f.channel, below)
		requireAppErrorID(t, err, breachID, http.StatusConflict)
		assert.Contains(t, err.Error(), "1 stored values out of bounds")
		assert.Equal(t, []string{a}, examplesOf(err))
		assert.Empty(t, storedBounds(f.channel))

		seed(f.channel, model.PropertyValueTargetTypeChannel, a, "optmid")
		require.NoError(t, setBounds(f.channel, below))
		assert.Equal(t, below, storedBounds(f.channel))
	})

	t.Run("a system with no value sets no limit", func(t *testing.T) {
		f := setup(t)
		seed(f.channel, model.PropertyValueTargetTypeChannel, model.NewId(), "opthigh")
		require.NoError(t, setBounds(f.channel, below))
	})

	t.Run("a user rule is checked against the user's values", func(t *testing.T) {
		f := setup(t)
		seedSystem(f, "optmid")
		target := model.NewId()
		seed(f.user, model.PropertyValueTargetTypeUser, target, "optlow")
		requireAppErrorID(t, setBounds(f.user, above), breachID, http.StatusConflict)

		seed(f.user, model.PropertyValueTargetTypeUser, target, "opthigh")
		require.NoError(t, setBounds(f.user, above))
	})

	t.Run("the count is the total and the examples stop at five", func(t *testing.T) {
		f := setup(t)
		seedSystem(f, "optlow")
		for range 7 {
			seed(f.channel, model.PropertyValueTargetTypeChannel, model.NewId(), "opthigh")
		}
		err := setBounds(f.channel, below)
		requireAppErrorID(t, err, breachID, http.StatusConflict)
		assert.Contains(t, err.Error(), "7 stored values out of bounds")
		assert.Len(t, examplesOf(err), 5)
	})

	t.Run("a value naming a deleted option counts as a breach", func(t *testing.T) {
		f := setup(t)
		seedSystem(f, "optmid")
		seed(f.channel, model.PropertyValueTargetTypeChannel, model.NewId(), "optgone")
		err := setBounds(f.channel, below)
		requireAppErrorID(t, err, breachID, http.StatusConflict)
		assert.Contains(t, err.Error(), "1 stored values out of bounds")
	})

	t.Run("a system value naming a deleted option can't be checked", func(t *testing.T) {
		f := setup(t)
		seedSystem(f, "optgone")
		requireAppErrorID(t, setBounds(f.channel, below), checkFailedID, http.StatusConflict)
		assert.Empty(t, storedBounds(f.channel))
	})

	t.Run("removing a rule, or keeping it, is not checked", func(t *testing.T) {
		f := setup(t)
		seedSystem(f, "optmid")
		require.NoError(t, setBounds(f.channel, below))
		seed(f.channel, model.PropertyValueTargetTypeChannel, model.NewId(), "opthigh")

		require.NoError(t, setBounds(f.channel, nil))
		require.NoError(t, setBounds(f.channel, below))
		require.NoError(t, setBounds(f.channel, model.PropertyBounds{}))
		assert.Empty(t, storedBounds(f.channel))
	})

	t.Run("a self rule is not checked against stored values", func(t *testing.T) {
		f := setup(t)
		seed(f.channel, model.PropertyValueTargetTypeChannel, model.NewId(), "opthigh")
		require.NoError(t, setBounds(f.channel, self))
	})

	t.Run("a refusal never names an option", func(t *testing.T) {
		f := setup(t)
		seedSystem(f, "optmid")
		seed(f.channel, model.PropertyValueTargetTypeChannel, model.NewId(), "opthigh")
		err := setBounds(f.channel, below)
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)

		g := setup(t)
		seedSystem(g, "optgone")
		var checkErr *model.AppError
		require.ErrorAs(t, setBounds(g.channel, below), &checkErr)

		for _, e := range []*model.AppError{appErr, checkErr} {
			for _, secret := range []string{"optlow", "optmid", "opthigh", "optgone"} {
				assert.False(t, slices.ContainsFunc([]string{e.Message, e.DetailedError, e.Error()}, func(s string) bool { return strings.Contains(s, secret) }), "%s leaked in %v", secret, e)
			}
		}
	})
}

func TestRefuseRulesBrokenByStoredPostValues(t *testing.T) {
	th := Setup(t)
	rctx := th.Context
	below := model.PropertyBounds{{Operator: model.PropertyBoundsOperatorAtOrBelow, Reference: model.PropertyBoundsReferenceParent}}
	above := model.PropertyBounds{{Operator: model.PropertyBoundsOperatorAtOrAbove, Reference: model.PropertyBoundsReferenceParent}}
	const breachID = "app.property_field.bounds_stored_values.app_error"
	const checkFailedID = "app.property_field.bounds_check_failed.app_error"
	team := th.CreateTeam(t)

	type fixture struct {
		system, channel, post *model.PropertyField
	}
	// setup creates the three fields, each with the given bounds; the channel field is created
	// first and the post field last, so a rule on either finds its parent side.
	setup := func(t *testing.T, channelBounds, postBounds model.PropertyBounds) fixture {
		t.Helper()
		_, create, _ := boundsSetup(t, th, rctx)
		f := fixture{system: create(model.PropertyFieldObjectTypeSystem, nil)}
		f.channel = create(model.PropertyFieldObjectTypeChannel, channelBounds)
		f.post = create(model.PropertyFieldObjectTypePost, postBounds)
		return f
	}
	seed := func(f *model.PropertyField, targetType, targetID, optionID string) {
		t.Helper()
		raw := json.RawMessage(`"` + optionID + `"`)
		_, err := th.dbStore.PropertyValue().Upsert([]*model.PropertyValue{{GroupID: f.GroupID, FieldID: f.ID, TargetType: targetType, TargetID: targetID, Value: raw}})
		require.NoError(t, err)
	}
	seedSystem := func(f fixture, optionID string) {
		seed(f.system, model.PropertyValueTargetTypeSystem, model.PropertyValueSystemTargetID, optionID)
	}
	// channel returns a channel holding optionID for the channel field; "" leaves it with no value.
	channel := func(f fixture, optionID string) string {
		id := th.CreateChannel(t, team.Id).Id
		if optionID != "" {
			seed(f.channel, model.PropertyValueTargetTypeChannel, id, optionID)
		}
		return id
	}
	// post returns a post in channelID holding optionID for the post field; "" gives it no value.
	post := func(f fixture, channelID, optionID string) string {
		t.Helper()
		p, err := th.dbStore.Post().Save(rctx, &model.Post{ChannelId: channelID, UserId: model.NewId(), Message: "m " + model.NewId()})
		require.NoError(t, err)
		if optionID != "" {
			seed(f.post, model.PropertyValueTargetTypePost, p.Id, optionID)
		}
		return p.Id
	}
	setBounds := func(f *model.PropertyField, bounds model.PropertyBounds) error {
		c := *f
		c.Bounds = bounds
		_, _, err := th.service.UpdatePropertyField(rctx, f.GroupID, &c)
		return err
	}
	storedBounds := func(f *model.PropertyField) model.PropertyBounds {
		got, err := th.service.GetPropertyField(rctx, f.GroupID, f.ID)
		require.NoError(t, err)
		return got.Bounds
	}
	examplesOf := func(err error) []string {
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		_, list, ok := strings.Cut(appErr.DetailedError, "e.g. ")
		require.True(t, ok, appErr.DetailedError)
		return strings.Split(list, ", ")
	}

	t.Run("a post rule is checked against the posts' channels", func(t *testing.T) {
		f := setup(t, nil, nil)
		x, y := channel(f, "optmid"), channel(f, "opthigh")
		high := post(f, x, "opthigh")
		post(f, x, "optlow")
		post(f, y, "opthigh")

		err := setBounds(f.post, below)
		requireAppErrorID(t, err, breachID, http.StatusConflict)
		assert.Contains(t, err.Error(), "1 stored values out of bounds")
		assert.Equal(t, []string{high}, examplesOf(err))
		assert.Empty(t, storedBounds(f.post))

		seed(f.post, model.PropertyValueTargetTypePost, high, "optmid")
		require.NoError(t, setBounds(f.post, below))
		assert.Equal(t, below, storedBounds(f.post))
	})

	t.Run("a deleted post does not count", func(t *testing.T) {
		f := setup(t, nil, nil)
		x := channel(f, "optmid")
		require.NoError(t, th.dbStore.Post().Delete(rctx, post(f, x, "opthigh"), model.GetMillis(), model.NewId()))
		require.NoError(t, setBounds(f.post, below))
	})

	t.Run("a channel value naming a deleted option can't be compared", func(t *testing.T) {
		f := setup(t, nil, nil)
		x := channel(f, "optgone")
		post(f, x, "optlow")
		requireAppErrorID(t, setBounds(f.post, below), breachID, http.StatusConflict)

		g := setup(t, nil, nil)
		post(g, channel(g, "optgone"), "")
		require.NoError(t, setBounds(g.post, below))
	})

	t.Run("a channel with no value falls back to the system only when the channel field carries the rule", func(t *testing.T) {
		f := setup(t, nil, nil)
		seedSystem(f, "optmid")
		z := channel(f, "")
		post(f, z, "opthigh")
		require.NoError(t, setBounds(f.post, below))

		g := setup(t, below, nil)
		seedSystem(g, "optmid")
		zg := channel(g, "")
		high := post(g, zg, "opthigh")
		err := setBounds(g.post, below)
		requireAppErrorID(t, err, breachID, http.StatusConflict)
		assert.Equal(t, []string{high}, examplesOf(err))

		h := setup(t, below, nil)
		post(h, channel(h, ""), "opthigh")
		require.NoError(t, setBounds(h.post, below))
	})

	t.Run("a system value naming a deleted option can't be checked", func(t *testing.T) {
		f := setup(t, below, nil)
		seedSystem(f, "optgone")
		post(f, channel(f, ""), "opthigh")
		requireAppErrorID(t, setBounds(f.post, below), checkFailedID, http.StatusConflict)
	})

	t.Run("a channel field's new rule caps the posts that fall back through it", func(t *testing.T) {
		f := setup(t, nil, below)
		seedSystem(f, "optmid")
		z := channel(f, "")
		high := post(f, z, "opthigh")
		err := setBounds(f.channel, below)
		requireAppErrorID(t, err, breachID, http.StatusConflict)
		assert.Contains(t, err.Error(), "field "+f.channel.ID)
		assert.Equal(t, []string{high}, examplesOf(err))
		assert.Empty(t, storedBounds(f.channel))

		g := setup(t, nil, below)
		post(g, channel(g, ""), "opthigh")
		require.NoError(t, setBounds(g.channel, below))

		h := setup(t, nil, above)
		seedSystem(h, "optmid")
		post(h, channel(h, ""), "optlow")
		require.NoError(t, setBounds(h.channel, below))
	})

	t.Run("one call adding the rule to both fields is checked", func(t *testing.T) {
		f := setup(t, nil, nil)
		seedSystem(f, "optmid")
		post(f, channel(f, ""), "opthigh")
		c, p := *f.channel, *f.post
		c.Bounds, p.Bounds = below, below
		_, _, _, err := th.service.UpdatePropertyFields(rctx, f.channel.GroupID, []*model.PropertyField{&c, &p})
		requireAppErrorID(t, err, breachID, http.StatusConflict)
		assert.Empty(t, storedBounds(f.channel))
		assert.Empty(t, storedBounds(f.post))
	})
}

func TestLocksField(t *testing.T) {
	const (
		mutable = model.PropertyFieldMutabilityMutable
		once    = model.PropertyFieldMutabilityWriteOnce
		onSet   = model.PropertyFieldMutabilitySetOnCreate
	)
	for name, tc := range map[string]struct {
		existing, next model.PropertyFieldMutability
		want           bool
	}{
		"unset to write_once":         {"", once, true},
		"mutable to write_once":       {mutable, once, true},
		"write_once to set_on_create": {once, onSet, true},
		"set_on_create to write_once": {onSet, once, true},
		"write_once kept":             {once, once, false},
		"write_once to mutable":       {once, mutable, false},
		"write_once to unset":         {once, "", false},
		"unset kept":                  {"", "", false},
	} {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, tc.want, locksField(tc.existing, tc.next))
		})
	}
}

func TestRefuseLockWhileValuesNameDeletedOption(t *testing.T) {
	th := Setup(t)
	rctx := th.Context
	const refusedID = "app.property_field.mutability_deleted_options.app_error"
	team := th.CreateTeam(t)

	seed := func(f *model.PropertyField, targetType, targetID, raw string) {
		t.Helper()
		_, err := th.dbStore.PropertyValue().Upsert([]*model.PropertyValue{{GroupID: f.GroupID, FieldID: f.ID, TargetType: targetType, TargetID: targetID, Value: json.RawMessage(raw)}})
		require.NoError(t, err)
	}
	// setMutability saves a fresh copy of f, so an option dropped since f was read isn't
	// mistaken for an edit of a linked field's options.
	setMutability := func(f *model.PropertyField, m model.PropertyFieldMutability) error {
		c, err := th.service.GetPropertyField(rctx, f.GroupID, f.ID)
		require.NoError(t, err)
		c.Mutability = m
		_, _, err = th.service.UpdatePropertyField(rctx, f.GroupID, c)
		return err
	}
	storedMutability := func(f *model.PropertyField) model.PropertyFieldMutability {
		got, err := th.service.GetPropertyField(rctx, f.GroupID, f.ID)
		require.NoError(t, err)
		return got.Mutability
	}
	// linkedField is a rank field linked to a template holding optlow, optmid and opthigh; the
	// template is returned by ID so a test can drop one of its options.
	linkedField := func(t *testing.T, objectType string) (*model.PropertyField, string) {
		t.Helper()
		_, create, _ := boundsSetup(t, th, rctx)
		f := create(objectType, nil)
		require.NotNil(t, f.LinkedFieldID)
		return f, *f.LinkedFieldID
	}
	selectField := func(t *testing.T, fieldType model.PropertyFieldType, objectType string) *model.PropertyField {
		t.Helper()
		return th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:     th.RegisterPropertyGroup(t, model.PropertyGroupVersionV3).ID,
			ObjectType:  objectType,
			TargetType:  string(model.PropertyFieldTargetLevelSystem),
			Type:        fieldType,
			Name:        "Select " + model.NewId(),
			Permissions: openPermissions(),
			Attrs: model.StringInterface{model.PropertyFieldAttributeOptions: []any{
				map[string]any{"id": "o1", "name": "One"},
				map[string]any{"id": "o2", "name": "Two"},
			}},
		})
	}
	dropOption := func(f *model.PropertyField, ownerID, optionID string) {
		t.Helper()
		require.NoError(t, th.dbStore.PropertyField().DeleteOptions(f.GroupID, ownerID, 0, []string{optionID}))
	}
	examplesOf := func(err error) []string {
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		_, list, ok := strings.Cut(appErr.DetailedError, "e.g. ")
		require.True(t, ok, appErr.DetailedError)
		return strings.Split(list, ", ")
	}

	t.Run("a value naming a deleted option refuses the lock until it is cleared", func(t *testing.T) {
		f := selectField(t, model.PropertyFieldTypeSelect, model.PropertyFieldObjectTypeChannel)
		target := model.NewId()
		seed(f, model.PropertyValueTargetTypeChannel, target, `"o2"`)
		dropOption(f, f.ID, "o2")

		err := setMutability(f, model.PropertyFieldMutabilityWriteOnce)
		requireAppErrorID(t, err, refusedID, http.StatusConflict)
		assert.Contains(t, err.Error(), "1 values name a deleted option")
		assert.Equal(t, []string{target}, examplesOf(err))
		assert.NotContains(t, err.Error(), "o2")
		assert.Equal(t, model.PropertyFieldMutability(""), storedMutability(f))

		seed(f, model.PropertyValueTargetTypeChannel, target, `null`)
		require.NoError(t, setMutability(f, model.PropertyFieldMutabilityWriteOnce))
		assert.Equal(t, model.PropertyFieldMutabilityWriteOnce, storedMutability(f))
	})

	t.Run("a multiselect value is refused when one element is deleted", func(t *testing.T) {
		f := selectField(t, model.PropertyFieldTypeMultiselect, model.PropertyFieldObjectTypeChannel)
		target := model.NewId()
		seed(f, model.PropertyValueTargetTypeChannel, target, `["o1","o2"]`)
		dropOption(f, f.ID, "o2")
		requireAppErrorID(t, setMutability(f, model.PropertyFieldMutabilityWriteOnce), refusedID, http.StatusConflict)

		seed(f, model.PropertyValueTargetTypeChannel, target, `["o1"]`)
		require.NoError(t, setMutability(f, model.PropertyFieldMutabilityWriteOnce))
	})

	t.Run("a linked field is judged against its template's options", func(t *testing.T) {
		f, templateID := linkedField(t, model.PropertyFieldObjectTypeChannel)
		seed(f, model.PropertyValueTargetTypeChannel, model.NewId(), `"optmid"`)
		dropOption(f, templateID, "optmid")
		requireAppErrorID(t, setMutability(f, model.PropertyFieldMutabilityWriteOnce), refusedID, http.StatusConflict)
	})

	t.Run("no deleted option, or no value, allows the lock", func(t *testing.T) {
		f := selectField(t, model.PropertyFieldTypeSelect, model.PropertyFieldObjectTypeChannel)
		require.NoError(t, setMutability(f, model.PropertyFieldMutabilityWriteOnce))

		g := selectField(t, model.PropertyFieldTypeSelect, model.PropertyFieldObjectTypeChannel)
		seed(g, model.PropertyValueTargetTypeChannel, model.NewId(), `"o1"`)
		dropOption(g, g.ID, "o2")
		require.NoError(t, setMutability(g, model.PropertyFieldMutabilityWriteOnce))
	})

	t.Run("a text field is not looked at", func(t *testing.T) {
		f := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:     th.RegisterPropertyGroup(t, model.PropertyGroupVersionV3).ID,
			ObjectType:  model.PropertyFieldObjectTypeChannel,
			TargetType:  string(model.PropertyFieldTargetLevelSystem),
			Type:        model.PropertyFieldTypeText,
			Name:        "Text " + model.NewId(),
			Permissions: openPermissions(),
		})
		seed(f, model.PropertyValueTargetTypeChannel, model.NewId(), `"o2"`)
		require.NoError(t, setMutability(f, model.PropertyFieldMutabilityWriteOnce))
	})

	t.Run("unlocking, or saving a lock unchanged, is not checked", func(t *testing.T) {
		f := selectField(t, model.PropertyFieldTypeSelect, model.PropertyFieldObjectTypeChannel)
		require.NoError(t, setMutability(f, model.PropertyFieldMutabilityWriteOnce))
		seed(f, model.PropertyValueTargetTypeChannel, model.NewId(), `"o2"`)
		dropOption(f, f.ID, "o2")

		require.NoError(t, setMutability(f, ""))
		assert.Equal(t, model.PropertyFieldMutabilityWriteOnce, storedMutability(f))
		require.NoError(t, setMutability(f, model.PropertyFieldMutabilityWriteOnce))
		// Mutable is stored as NULL, which reads back as unset.
		require.NoError(t, setMutability(f, model.PropertyFieldMutabilityMutable))
		assert.Equal(t, model.PropertyFieldMutability(""), storedMutability(f))
	})

	t.Run("a value on a deleted post does not count", func(t *testing.T) {
		f, templateID := linkedField(t, model.PropertyFieldObjectTypePost)
		p, err := th.dbStore.Post().Save(rctx, &model.Post{ChannelId: th.CreateChannel(t, team.Id).Id, UserId: model.NewId(), Message: "m " + model.NewId()})
		require.NoError(t, err)
		seed(f, model.PropertyValueTargetTypePost, p.Id, `"optmid"`)
		dropOption(f, templateID, "optmid")
		requireAppErrorID(t, setMutability(f, model.PropertyFieldMutabilityWriteOnce), refusedID, http.StatusConflict)

		require.NoError(t, th.dbStore.Post().Delete(rctx, p.Id, model.GetMillis(), model.NewId()))
		require.NoError(t, setMutability(f, model.PropertyFieldMutabilityWriteOnce))
	})
}

func TestRefuseRankChangeBreakingStoredValues(t *testing.T) {
	th := Setup(t)
	rctx := th.Context
	below := model.PropertyBounds{{Operator: model.PropertyBoundsOperatorAtOrBelow, Reference: model.PropertyBoundsReferenceParent}}
	self := model.PropertyBounds{{Operator: model.PropertyBoundsOperatorAtOrAbove, Reference: model.PropertyBoundsReferenceSelf}}
	const ranksID = "app.property_field.option_ranks_stored_values.app_error"
	const checkFailedID = "app.property_field.bounds_check_failed.app_error"
	team := th.CreateTeam(t)

	type fixture struct {
		template, system, channel, post *model.PropertyField
	}
	// setup creates the template's linked fields, the channel and post ones with the given bounds.
	setup := func(t *testing.T, channelBounds, postBounds model.PropertyBounds) fixture {
		t.Helper()
		_, create, _ := boundsSetup(t, th, rctx)
		f := fixture{system: create(model.PropertyFieldObjectTypeSystem, nil)}
		f.channel = create(model.PropertyFieldObjectTypeChannel, channelBounds)
		f.post = create(model.PropertyFieldObjectTypePost, postBounds)
		var err error
		f.template, err = th.service.GetPropertyField(rctx, f.system.GroupID, *f.system.LinkedFieldID)
		require.NoError(t, err)
		return f
	}
	seed := func(f *model.PropertyField, targetType, targetID, optionID string) {
		t.Helper()
		raw := json.RawMessage(`"` + optionID + `"`)
		_, err := th.dbStore.PropertyValue().Upsert([]*model.PropertyValue{{GroupID: f.GroupID, FieldID: f.ID, TargetType: targetType, TargetID: targetID, Value: raw}})
		require.NoError(t, err)
	}
	seedSystem := func(f fixture, optionID string) {
		seed(f.system, model.PropertyValueTargetTypeSystem, model.PropertyValueSystemTargetID, optionID)
	}
	channel := func(f fixture, optionID string) string {
		id := th.CreateChannel(t, team.Id).Id
		if optionID != "" {
			seed(f.channel, model.PropertyValueTargetTypeChannel, id, optionID)
		}
		return id
	}
	post := func(f fixture, channelID, optionID string) string {
		t.Helper()
		p, err := th.dbStore.Post().Save(rctx, &model.Post{ChannelId: channelID, UserId: model.NewId(), Message: "m " + model.NewId()})
		require.NoError(t, err)
		seed(f.post, model.PropertyValueTargetTypePost, p.Id, optionID)
		return p.Id
	}
	// options is the template's option list with the given ranks; extra edits each option map.
	options := func(low, mid, high int, extra func(opt map[string]any)) []any {
		opts := []any{
			map[string]any{"id": "optlow", "name": "LOW", "rank": low},
			map[string]any{"id": "optmid", "name": "MID", "rank": mid},
			map[string]any{"id": "opthigh", "name": "HIGH", "rank": high},
		}
		if extra != nil {
			for _, o := range opts {
				extra(o.(map[string]any))
			}
		}
		return opts
	}
	withOptions := func(f fixture, opts []any) *model.PropertyField {
		c := *f.template
		c.Attrs = maps.Clone(f.template.Attrs)
		c.Attrs[model.PropertyFieldAttributeOptions] = opts
		return &c
	}
	saveOptions := func(f fixture, opts []any) error {
		_, _, err := th.service.UpdatePropertyField(rctx, f.template.GroupID, withOptions(f, opts))
		return err
	}
	storedRanks := func(f fixture) map[string]int {
		got, err := th.service.GetPropertyField(rctx, f.template.GroupID, f.template.ID)
		require.NoError(t, err)
		return buildOptionRankMap(got)
	}
	swapped := map[string]int{"optlow": 3, "optmid": 2, "opthigh": 1}
	original := map[string]int{"optlow": 1, "optmid": 2, "opthigh": 3}
	examplesOf := func(err error) []string {
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		_, list, ok := strings.Cut(appErr.DetailedError, "e.g. ")
		require.True(t, ok, appErr.DetailedError)
		return strings.Split(list, ", ")
	}

	t.Run("a swap that puts a channel value above the system's is refused", func(t *testing.T) {
		f := setup(t, below, nil)
		seedSystem(f, "optmid")
		a := channel(f, "optlow")

		err := saveOptions(f, options(3, 2, 1, nil))
		requireAppErrorID(t, err, ranksID, http.StatusConflict)
		assert.Contains(t, err.Error(), "field "+f.template.ID)
		assert.Contains(t, err.Error(), "of field "+f.channel.ID)
		assert.Contains(t, err.Error(), "1 stored values")
		assert.Equal(t, []string{a}, examplesOf(err))
		for _, secret := range []string{"optlow", "optmid", "opthigh"} {
			assert.NotContains(t, err.Error(), secret)
		}
		assert.Equal(t, original, storedRanks(f))

		g := setup(t, below, nil)
		seedSystem(g, "optmid")
		channel(g, "optmid")
		require.NoError(t, saveOptions(g, options(3, 2, 1, nil)))
		assert.Equal(t, swapped, storedRanks(g))
	})

	t.Run("a post held by a channel is judged against it", func(t *testing.T) {
		f := setup(t, nil, below)
		x := channel(f, "optmid")
		p := post(f, x, "optlow")

		err := saveOptions(f, options(3, 2, 1, nil))
		requireAppErrorID(t, err, ranksID, http.StatusConflict)
		assert.Equal(t, []string{p}, examplesOf(err))
		assert.Equal(t, original, storedRanks(f))
	})

	t.Run("a system with no value sets no limit", func(t *testing.T) {
		f := setup(t, below, nil)
		channel(f, "optlow")
		channel(f, "opthigh")
		require.NoError(t, saveOptions(f, options(3, 2, 1, nil)))
	})

	t.Run("an edit that moves no rank is allowed", func(t *testing.T) {
		f := setup(t, below, nil)
		seedSystem(f, "optmid")
		channel(f, "optlow")

		require.NoError(t, saveOptions(f, options(1, 2, 3, func(o map[string]any) { o["name"] = o["name"].(string) + "!" })))
		require.NoError(t, saveOptions(f, options(1, 2, 3, func(o map[string]any) { o["color"] = "#123456" })))
		reordered := options(1, 2, 3, nil)
		slices.Reverse(reordered)
		require.NoError(t, saveOptions(f, reordered))
		added := append(options(1, 2, 3, nil), map[string]any{"id": "optmax", "name": "MAX", "rank": 4})
		require.NoError(t, saveOptions(f, added))
		assert.Equal(t, map[string]int{"optlow": 1, "optmid": 2, "opthigh": 3, "optmax": 4}, storedRanks(f))
	})

	t.Run("a field with only a self rule is not checked", func(t *testing.T) {
		f := setup(t, self, nil)
		seedSystem(f, "optmid")
		channel(f, "optlow")
		require.NoError(t, saveOptions(f, options(3, 2, 1, nil)))
	})

	t.Run("a new rule in the same call is judged with the new ranks", func(t *testing.T) {
		saveBoth := func(f fixture) error {
			c := *f.channel
			c.Bounds = below
			_, _, _, err := th.service.UpdatePropertyFields(rctx, f.template.GroupID, []*model.PropertyField{withOptions(f, options(3, 2, 1, nil)), &c})
			return err
		}
		f := setup(t, nil, nil)
		seedSystem(f, "optmid")
		channel(f, "optlow")
		requireAppErrorID(t, saveBoth(f), ranksID, http.StatusConflict)
		assert.Equal(t, original, storedRanks(f))
		got, err := th.service.GetPropertyField(rctx, f.channel.GroupID, f.channel.ID)
		require.NoError(t, err)
		assert.Empty(t, got.Bounds)

		g := setup(t, nil, nil)
		seedSystem(g, "optmid")
		channel(g, "opthigh")
		require.NoError(t, saveBoth(g))
		assert.Equal(t, swapped, storedRanks(g))
	})

	t.Run("a system value that can't be ranked refuses the change", func(t *testing.T) {
		f := setup(t, below, nil)
		seedSystem(f, "optgone")
		channel(f, "optlow")
		requireAppErrorID(t, saveOptions(f, options(3, 2, 1, nil)), checkFailedID, http.StatusConflict)
		assert.Equal(t, original, storedRanks(f))
	})

	t.Run("an option sent without a rank is refused as invalid options", func(t *testing.T) {
		f := setup(t, below, nil)
		th.service.AddHook(NewAccessControlAttributeValidationHook(th.service, AccessControlAttributeValidationHookConfig{}, f.template.GroupID))
		opts := options(1, 2, 3, nil)
		delete(opts[1].(map[string]any), "rank")
		err := saveOptions(f, opts)
		require.ErrorIs(t, err, ErrInvalidFieldAttrs)
		assert.Equal(t, original, storedRanks(f))
	})
}
