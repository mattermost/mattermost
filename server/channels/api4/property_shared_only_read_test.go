// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// A shared_only field's masking is computed against what the *caller* holds, so
// every read of one has to say who is asking. The properties REST routes did
// not: they passed the untagged request context straight to the service, the
// access control hook read no caller ID, and every caller -- the owner of the
// values included -- was answered as someone who holds nothing and shown an
// empty list. Nothing distinguished that from masking working, because "you
// share nothing" is a legitimate answer.
//
// These tests read one target's values back through
// GET /properties/groups/{group}/{object_type}/values/{target_id} as four
// different callers and assert what each of them gets, per caller, rather than
// that anything came back at all. Both masking branches are covered: multiselect
// intersects the caller's own options with the target's, graph resolves the
// hierarchy -- an untagged caller fell into the same hole in both, but only one
// of them would have caught a regression in the other.

// sharedOnlyReadFixture is one shared_only field on the access_control group,
// the public field alongside it that anchors "the read itself works", and the
// four callers whose answers differ.
type sharedOnlyReadFixture struct {
	th *TestHelper

	groupID       string
	fieldID       string
	publicFieldID string

	// The users. target's values are the ones being read; owner is target
	// reading their own, sharer holds something in common with target, stranger
	// holds nothing for the field at all.
	target   *model.User
	sharer   *model.User
	stranger *model.User

	ownerClient    *model.Client4
	sharerClient   *model.Client4
	strangerClient *model.Client4
}

// setupSharedOnlyRead builds the fixture for one field type.
//
// The field is authored public and its values are written while it still is,
// then flipped to protected + shared_only directly in the store. A shared_only
// field must be protected (model.ValidatePropertyFieldAccessMode) and only a
// plugin may set protected, so there is no way to author one over HTTP -- and
// once it is protected nothing but its source plugin may write its values
// either. Flipping afterwards gets the same rows a plugin-authored field has,
// which is what the read paths under test see.
func setupSharedOnlyRead(t *testing.T, fieldType model.PropertyFieldType, optionNames []string, holdings map[string][]string) *sharedOnlyReadFixture {
	t.Helper()

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
		cfg.FeatureFlags.PropertyFieldGraph = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	ctx := context.Background()
	admin := th.SystemAdminClient
	groupName := model.AccessControlPropertyGroupName

	f := &sharedOnlyReadFixture{th: th, target: th.BasicUser, sharer: th.BasicUser2}

	// A third user, on the team so the read's own target-access check
	// (UserCanSeeOtherUser) passes and the only thing left to answer is masking.
	f.stranger = th.CreateUser(t)
	th.LinkUserToTeam(t, f.stranger, th.BasicTeam)

	login := func(u *model.User) *model.Client4 {
		client := th.CreateClient()
		_, _, err := client.Login(ctx, u.Email, u.Password)
		require.NoError(t, err)
		return client
	}
	f.ownerClient = login(f.target)
	f.sharerClient = login(f.sharer)
	f.strangerClient = login(f.stranger)

	options := make([]map[string]any, 0, len(optionNames))
	for _, name := range optionNames {
		option := map[string]any{"name": name}
		if fieldType == model.PropertyFieldTypeGraph {
			// The hierarchy the graph branch resolves against: a chain, so a
			// caller holding a leaf covers strictly less than the target's root.
			if parent := graphParentOf(name, optionNames); parent != "" {
				option["parents"] = []string{parent}
			}
		}
		options = append(options, option)
	}

	field, resp, err := admin.CreatePropertyField(ctx, groupName, model.PropertyFieldObjectTypeUser, &model.PropertyField{
		Name:       celSafeName(),
		Type:       fieldType,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs:      model.StringInterface{model.PropertyFieldAttributeOptions: options},
	})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	f.groupID = field.GroupID
	f.fieldID = field.ID

	publicField, resp, err := admin.CreatePropertyField(ctx, groupName, model.PropertyFieldObjectTypeUser, &model.PropertyField{
		Name:       celSafeName(),
		Type:       model.PropertyFieldTypeText,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	f.publicFieldID = publicField.ID

	optionIDs := optionIDsByName(t, field)

	// Holdings go in while the field is still public: a protected field takes
	// value writes from nobody but its source plugin.
	for userKey, names := range holdings {
		ids := make([]string, 0, len(names))
		for _, name := range names {
			id, ok := optionIDs[name]
			require.True(t, ok, "no option named %q on the field", name)
			ids = append(ids, id)
		}
		_, resp, err = admin.PatchPropertyValues(ctx, groupName, model.PropertyFieldObjectTypeUser, f.userByKey(t, userKey).Id, []model.PropertyValuePatchItem{{
			FieldID: f.fieldID,
			Value:   sharedOnlyValue(t, fieldType, ids),
		}})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	}

	_, resp, err = admin.PatchPropertyValues(ctx, groupName, model.PropertyFieldObjectTypeUser, f.target.Id, []model.PropertyValuePatchItem{{
		FieldID: f.publicFieldID,
		Value:   json.RawMessage(`"visible to everyone"`),
	}})
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	f.makeSharedOnly(t)

	return f
}

// graphParentOf returns the option that comes before name in the list, which is
// the parent in the chain these tests build: the first name is the root and each
// one after it hangs off the one before.
func graphParentOf(name string, ordered []string) string {
	for i, candidate := range ordered {
		if candidate == name && i > 0 {
			return ordered[i-1]
		}
	}
	return ""
}

// sharedOnlyValue encodes a holding for the field type under test. Both types
// this covers store a list of option identifiers.
func sharedOnlyValue(t *testing.T, fieldType model.PropertyFieldType, optionIDs []string) json.RawMessage {
	t.Helper()
	require.Contains(t, []model.PropertyFieldType{model.PropertyFieldTypeMultiselect, model.PropertyFieldTypeGraph}, fieldType)

	raw, err := json.Marshal(optionIDs)
	require.NoError(t, err)
	return raw
}

// optionIDsByName reports the identifier each of a field's inlined options was
// given.
func optionIDsByName(t *testing.T, field *model.PropertyField) map[string]string {
	t.Helper()

	stored, ok := field.Attrs[model.PropertyFieldAttributeOptions].([]any)
	require.True(t, ok, "the field should read back with its options")

	ids := make(map[string]string, len(stored))
	for _, option := range stored {
		entry, ok := option.(map[string]any)
		require.True(t, ok)
		ids[entry["name"].(string)] = entry["id"].(string)
	}
	return ids
}

func (f *sharedOnlyReadFixture) userByKey(t *testing.T, key string) *model.User {
	t.Helper()
	switch key {
	case "target":
		return f.target
	case "sharer":
		return f.sharer
	case "stranger":
		return f.stranger
	}
	require.FailNowf(t, "unknown user", "no fixture user %q", key)
	return nil
}

// makeSharedOnly flips the field to the posture a plugin would have authored it
// with, in the store, since neither the REST API nor the service will accept it
// from a session.
func (f *sharedOnlyReadFixture) makeSharedOnly(t *testing.T) {
	t.Helper()

	store := f.th.App.Srv().Store().PropertyField()
	field, err := store.Get(request.TestContext(t), f.groupID, f.fieldID)
	require.NoError(t, err)

	// A protected field's definition is the source plugin's alone
	// (PropertyField.IsValid pins permission_field to none), and shared_only is
	// a rejected combination with member-writable values -- a member who can
	// self-assign any option can read anyone's.
	none := model.PermissionLevelNone
	sysadmin := model.PermissionLevelSysadmin
	field.Protected = true
	field.PermissionField = &none
	field.PermissionOptions = &none
	field.PermissionValues = &sysadmin
	if field.Attrs == nil {
		field.Attrs = model.StringInterface{}
	}
	field.Attrs[model.PropertyAttrsProtected] = true
	field.Attrs[model.PropertyAttrsAccessMode] = model.PropertyAccessModeSharedOnly

	_, err = store.Update(f.groupID, []*model.PropertyField{field}, nil)
	require.NoError(t, err)
}

// readTargetValue reads the target's values over the properties route as the
// given caller and returns what came back for the shared_only field, or nil when
// the field was masked away entirely.
//
// The public field is asserted on every read: it is what tells "the caller was
// shown nothing of this field" apart from "the read returned nothing at all",
// which is the distinction the original bug hid behind.
func (f *sharedOnlyReadFixture) readTargetValue(t *testing.T, client *model.Client4) []string {
	t.Helper()

	values, resp, err := client.GetPropertyValues(context.Background(),
		model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeUser, f.target.Id,
		model.PropertyValueSearch{PerPage: model.AccessControlGroupFieldLimit})
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	var masked []string
	sawPublic := false
	for _, value := range values {
		switch value.FieldID {
		case f.publicFieldID:
			sawPublic = true
		case f.fieldID:
			require.NoError(t, json.Unmarshal(value.Value, &masked))
			require.NotNil(t, masked, "a value that survived masking should carry options")
		}
	}
	assert.True(t, sawPublic, "the public field on the same target should always come back")

	return masked
}

// names maps option identifiers back to names so a failure reads as programs
// rather than as identifiers.
func namesOf(t *testing.T, optionIDs map[string]string, ids []string) []string {
	t.Helper()

	byID := make(map[string]string, len(optionIDs))
	for name, id := range optionIDs {
		byID[id] = name
	}

	out := make([]string, 0, len(ids))
	for _, id := range ids {
		name, ok := byID[id]
		require.True(t, ok, "the read returned an option %q the field does not have", id)
		out = append(out, name)
	}
	return out
}

func (f *sharedOnlyReadFixture) optionIDs(t *testing.T) map[string]string {
	t.Helper()

	field, err := f.th.App.Srv().Store().PropertyField().Get(request.TestContext(t), f.groupID, f.fieldID)
	require.NoError(t, err)
	return optionIDsByName(t, field)
}

// TestSharedOnlyValuesOverPropertiesRoute_Multiselect covers the flat masking
// branch: a caller sees exactly the options they hold in common with the target.
func TestSharedOnlyValuesOverPropertiesRoute_Multiselect(t *testing.T) {
	mainHelper.Parallel(t)

	const (
		alpha   = "Alpha"
		bravo   = "Bravo"
		charlie = "Charlie"
	)

	f := setupSharedOnlyRead(t, model.PropertyFieldTypeMultiselect,
		[]string{alpha, bravo, charlie},
		map[string][]string{
			"target": {alpha, bravo},
			"sharer": {bravo, charlie},
			// stranger holds nothing.
		})
	ids := f.optionIDs(t)

	t.Run("the owner sees their own value whole", func(t *testing.T) {
		assert.ElementsMatch(t, []string{alpha, bravo}, namesOf(t, ids, f.readTargetValue(t, f.ownerClient)))
	})

	t.Run("a caller sharing one option sees that option and no other", func(t *testing.T) {
		assert.Equal(t, []string{bravo}, namesOf(t, ids, f.readTargetValue(t, f.sharerClient)))
	})

	t.Run("a caller holding nothing sees nothing of the field", func(t *testing.T) {
		assert.Empty(t, f.readTargetValue(t, f.strangerClient))
	})

	// A sysadmin is not the field's source plugin, so shared_only masks them like
	// anyone else and they hold nothing to share. This is the same answer the CPA
	// route gives; asserted so a future change that grants admins a bypass has to
	// be a deliberate one.
	t.Run("a sysadmin holding nothing sees nothing of the field", func(t *testing.T) {
		assert.Empty(t, f.readTargetValue(t, f.th.SystemAdminClient))
	})
}

// TestSharedOnlyValuesOverPropertiesRoute_Graph covers the hierarchy branch: an
// option the caller does not cover is replaced by the options below it that they
// do, rather than being dropped.
func TestSharedOnlyValuesOverPropertiesRoute_Graph(t *testing.T) {
	mainHelper.Parallel(t)

	// A chain: each option hangs off the one before it.
	const (
		fruitBasket = "TS Fruit Basket"
		redFruit    = "S Red Fruit"
		apples      = "U Apples"
	)

	f := setupSharedOnlyRead(t, model.PropertyFieldTypeGraph,
		[]string{fruitBasket, redFruit, apples},
		map[string][]string{
			"target": {fruitBasket},
			"sharer": {redFruit},
			// stranger holds nothing.
		})
	ids := f.optionIDs(t)

	t.Run("the owner covers their own option and sees it as it stands", func(t *testing.T) {
		assert.Equal(t, []string{fruitBasket}, namesOf(t, ids, f.readTargetValue(t, f.ownerClient)))
	})

	// The distinguishing case for the graph branch: the target holds an option
	// above the caller's, so the value is clamped down to the caller's own part
	// of the hierarchy rather than hidden. A flat type would have shown nothing
	// here.
	t.Run("a caller below the target's option sees the value clamped to their own", func(t *testing.T) {
		assert.Equal(t, []string{redFruit}, namesOf(t, ids, f.readTargetValue(t, f.sharerClient)))
	})

	t.Run("a caller holding nothing sees nothing of the field", func(t *testing.T) {
		assert.Empty(t, f.readTargetValue(t, f.strangerClient))
	})

	t.Run("a sysadmin holding nothing sees nothing of the field", func(t *testing.T) {
		assert.Empty(t, f.readTargetValue(t, f.th.SystemAdminClient))
	})
}

// TestSharedOnlyFieldOptionsOverPropertiesRoute covers the other read the
// properties route serves untagged: the field listing, whose inlined option list
// is filtered by the same rule as the values. It emptied that list for every
// caller for the same reason.
func TestSharedOnlyFieldOptionsOverPropertiesRoute(t *testing.T) {
	mainHelper.Parallel(t)

	const (
		fruitBasket = "TS Fruit Basket"
		redFruit    = "S Red Fruit"
		apples      = "U Apples"
	)

	f := setupSharedOnlyRead(t, model.PropertyFieldTypeGraph,
		[]string{fruitBasket, redFruit, apples},
		map[string][]string{
			"target": {fruitBasket},
			"sharer": {redFruit},
		})

	read := func(t *testing.T, client *model.Client4) []string {
		t.Helper()

		fields, resp, err := client.GetPropertyFields(context.Background(),
			model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeUser, model.PropertyFieldSearch{
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				PerPage:    model.AccessControlGroupFieldLimit,
			})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		for _, field := range fields {
			if field.ID == f.fieldID {
				return inlineOptionNames(t, field)
			}
		}
		require.FailNow(t, "the shared_only field should still be listed, with its options filtered")
		return nil
	}

	// The holder of the root covers everything below it.
	t.Run("a caller covering the hierarchy sees all of it", func(t *testing.T) {
		assert.ElementsMatch(t, []string{fruitBasket, redFruit, apples}, read(t, f.ownerClient))
	})

	t.Run("a caller covering part of it sees their own part", func(t *testing.T) {
		assert.ElementsMatch(t, []string{redFruit, apples}, read(t, f.sharerClient))
	})

	t.Run("a caller holding nothing sees no options", func(t *testing.T) {
		assert.Empty(t, read(t, f.strangerClient))
	})
}
