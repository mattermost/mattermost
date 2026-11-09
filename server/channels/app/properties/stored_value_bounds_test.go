// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
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
