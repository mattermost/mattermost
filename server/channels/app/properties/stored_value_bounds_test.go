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
