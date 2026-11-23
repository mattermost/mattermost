// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// requiredChannelAttributeResolution is what a person has to supply, and may
// leave, when an action puts a channel in front of required attributes.
type requiredChannelAttributeResolution struct {
	// ValuesToWrite are the supplied values, validated and stamped with the
	// group, ready for writeChannelAttributeValues.
	ValuesToWrite []*model.PropertyValue
	// Missing are the required fields the person can set that still have no
	// value after the supplied ones.
	Missing []*model.PropertyField
	// Skipped are the required fields that still have no value and that the
	// person can't set, or that have no editor anywhere.
	Skipped []*model.PropertyField
}

// CanSetChannelAttributeOnPendingChannel reports whether the caller of rctx may
// set this attribute on a channel that is about to exist. The channel does not
// exist yet, so the channel-scoped tiers are answered from what creation itself
// guarantees: the creator is saved as a channel admin, which satisfies both
// "admin" and "member". A tier the caller cannot satisfy is skipped rather than
// enforced — one sysadmin-only required attribute must not make channel creation
// impossible for everyone else.
//
// Unrecognised and unset tiers answer no, matching
// SessionHasPermissionToSetPropertyFieldValues. That check is the only gate on
// this path, so a field the property API would refuse a value for must not
// become settable through channel creation.
func (a *App) CanSetChannelAttributeOnPendingChannel(rctx request.CTX, field *model.PropertyField) bool {
	if field.PermissionValues == nil {
		return false
	}

	switch *field.PermissionValues {
	case model.PermissionLevelMember, model.PermissionLevelAdmin:
		return true
	case model.PermissionLevelSysadmin:
		return a.SessionHasPermissionTo(*rctx.Session(), model.PermissionManageSystem)
	default:
		return false
	}
}

// ChannelAttributeValuesFromItems turns submitted attribute values into
// PropertyValues of the given group, refusing an invalid ID, a duplicate, an
// unknown or unavailable field, and a field canSet answers no for. Option
// validity is left to the value write hooks. Errors never name an attribute:
// which markings a server defines is itself sensitive, and the caller may not be
// allowed to see them.
func (a *App) ChannelAttributeValuesFromItems(groupID string, fields []*model.PropertyField, items []model.PropertyValuePatchItem, canSet func(field *model.PropertyField) bool) ([]*model.PropertyValue, error) {
	channelAttributesAvailable, classificationAvailable := a.channelAttributeAvailability()

	fieldByID := make(map[string]*model.PropertyField, len(fields))
	for _, field := range fields {
		fieldByID[field.ID] = field
	}

	supplied := make(map[string]bool, len(items))
	values := make([]*model.PropertyValue, 0, len(items))
	for _, item := range items {
		if !model.IsValidId(item.FieldID) {
			return nil, model.NewAppError("ChannelAttributeValuesFromItems", "api.channel.create_channel.invalid_attribute.app_error", nil, "", http.StatusBadRequest)
		}
		if supplied[item.FieldID] {
			return nil, model.NewAppError("ChannelAttributeValuesFromItems", "api.channel.create_channel.invalid_attribute.app_error", nil, "duplicate field", http.StatusBadRequest)
		}
		field, ok := fieldByID[item.FieldID]
		if !ok {
			return nil, model.NewAppError("ChannelAttributeValuesFromItems", "api.channel.create_channel.invalid_attribute.app_error", nil, "unknown field", http.StatusBadRequest)
		}
		if !ChannelAttributeFieldAvailable(field, channelAttributesAvailable, classificationAvailable) {
			return nil, model.NewAppError("ChannelAttributeValuesFromItems", "api.channel.create_channel.attributes_feature_disabled.app_error", nil, "", http.StatusBadRequest)
		}
		if !canSet(field) {
			return nil, model.NewAppError("ChannelAttributeValuesFromItems", "api.channel.create_channel.attribute_no_permission.app_error", nil, "", http.StatusForbidden)
		}

		supplied[item.FieldID] = true
		values = append(values, &model.PropertyValue{
			GroupID: groupID,
			FieldID: field.ID,
			// Sanitized so "  " counts as unset here exactly as it will when written.
			Value: model.SanitizePropertyValue(item.Value),
		})
	}
	return values, nil
}

// resolveRequiredChannelAttributes validates the values the person sent and
// works out which required attributes the channel would still lack. pending is
// true for a channel that does not exist in its final shape yet (a group message
// being converted): nothing is read for it, every required field counts as
// without a value, and what the person can set follows the create rule. For an
// existing channel, the values are read from the store and a field is settable
// when the person may both read and write its values.
//
// With required attributes off it returns an empty result without a query, or
// refuses values the way channel creation does when the feature is off.
func (a *App) resolveRequiredChannelAttributes(rctx request.CTX, userID string, channel *model.Channel, pending bool, items []model.PropertyValuePatchItem) (*requiredChannelAttributeResolution, error) {
	if !a.requiredChannelAttributesEnabled() {
		if len(items) > 0 {
			return nil, model.NewAppError("resolveRequiredChannelAttributes", "api.channel.create_channel.attributes_feature_disabled.app_error", nil, "", http.StatusBadRequest)
		}
		return &requiredChannelAttributeResolution{}, nil
	}

	// Archived channels still take values: unarchiving asks for them first.
	if !pending && channel.Type != model.ChannelTypeOpen && channel.Type != model.ChannelTypePrivate {
		if len(items) > 0 {
			return nil, model.NewAppError("resolveRequiredChannelAttributes", "api.channel.create_channel.invalid_attribute.app_error", nil, "attributes are not assigned to this channel type", http.StatusBadRequest)
		}
		return &requiredChannelAttributeResolution{}, nil
	}

	groupID, fields, err := a.channelAttributeFields(rctxWithSessionCallerID(rctx))
	if err != nil {
		return nil, err
	}

	// The write decision is asked for the sent items and again for each required
	// field, so it is answered once per field.
	decided := make(map[string]bool, len(fields))
	canSetValue := func(field *model.PropertyField) bool {
		if allowed, ok := decided[field.ID]; ok {
			return allowed
		}
		var allowed bool
		if pending {
			// The value hook refuses a person's write of these fields whatever the
			// tier says, and on a conversion that refusal would only come after the
			// channel changed.
			allowed = !channelAttributeWriteRefusedForPerson(field) && a.CanSetChannelAttributeOnPendingChannel(rctx, field)
		} else {
			allowed = a.channelAttributeActionAllowed(rctx, userID, field, model.PropertyActionValueWrite, channel.Id)
		}
		decided[field.ID] = allowed
		return allowed
	}

	values, appErr := a.ChannelAttributeValuesFromItems(groupID, fields, items, canSetValue)
	if appErr != nil {
		return nil, appErr
	}
	supplied := make(map[string]json.RawMessage, len(values))
	for _, value := range values {
		supplied[value.FieldID] = value.Value
	}

	required := a.requiredAvailableChannelAttributeFields(fields)
	withoutValue := required
	if !pending {
		withoutValue, err = a.missingRequiredFieldsOf(rctx, groupID, required, channel)
		if err != nil {
			return nil, err
		}
	}

	toWrite := values
	if !pending {
		toWrite, err = a.withoutUnchangedChannelAttributeValues(rctx, groupID, fields, channel, values)
		if err != nil {
			return nil, err
		}
	}

	resolution := &requiredChannelAttributeResolution{ValuesToWrite: toWrite}
	for _, field := range withoutValue {
		if value, ok := supplied[field.ID]; ok && !model.IsEmptyPropertyValue(value) {
			continue
		}

		// A field with no editor anywhere can't be asked for, so it never blocks.
		settable := channelAttributeHasEditor(field) && canSetValue(field)
		if settable && !pending {
			settable = a.channelAttributeActionAllowed(rctx, userID, field, model.PropertyActionValueRead, channel.Id)
		}
		if settable {
			resolution.Missing = append(resolution.Missing, field)
		} else {
			resolution.Skipped = append(resolution.Skipped, field)
		}
	}
	return resolution, nil
}

// withoutUnchangedChannelAttributeValues drops the values channel already holds.
// Rewriting one is a no-op at best, and a change policy refuses it outright, so a
// retry after an action that stored its values but then failed would never pass.
func (a *App) withoutUnchangedChannelAttributeValues(rctx request.CTX, groupID string, fields []*model.PropertyField, channel *model.Channel, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if len(values) == 0 {
		return values, nil
	}

	stored, err := a.Srv().Store().PropertyValue().SearchPropertyValues(store.RequestContextWithMaster(rctx), model.PropertyValueSearchOpts{
		GroupID:    groupID,
		TargetType: model.PropertyValueTargetTypeChannel,
		TargetIDs:  []string{channel.Id},
		PerPage:    model.AccessControlGroupFieldLimit + 5,
	})
	if err != nil {
		return nil, model.NewAppError("withoutUnchangedChannelAttributeValues", "app.property_value.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if len(stored) == 0 {
		return values, nil
	}

	storedByField := make(map[string]*model.PropertyValue, len(stored))
	for _, value := range stored {
		storedByField[value.FieldID] = value
	}
	typeByField := make(map[string]model.PropertyFieldType, len(fields))
	for _, field := range fields {
		typeByField[field.ID] = field.Type
	}

	changed := make([]*model.PropertyValue, 0, len(values))
	for _, value := range values {
		current, ok := storedByField[value.FieldID]
		if ok && !propertyValueChanged(typeByField[value.FieldID], current, value.Value) {
			continue
		}
		changed = append(changed, value)
	}
	return changed, nil
}

// channelAttributeActionAllowed answers decidePropertyFieldPermission for a
// person, and for local mode, whose callers have no user ID: the property
// access hook lets them do anything except write a value of a synced,
// owner-managed or protected field, which is judged like any other caller's.
func (a *App) channelAttributeActionAllowed(rctx request.CTX, userID string, field *model.PropertyField, action, channelID string) bool {
	if userID == model.CallerIDLocalAdmin &&
		(action != model.PropertyActionValueWrite || !channelAttributeWriteRefusedForPerson(field)) {
		return true
	}
	return a.decidePropertyFieldPermission(rctx, userID, field, action, channelID).Allowed
}

// channelAttributeWriteRefusedForPerson reports whether the property access hook
// refuses a person's write of this field's values: synced, owner-managed and
// protected fields are not edited by people.
func channelAttributeWriteRefusedForPerson(field *model.PropertyField) bool {
	return model.IsPropertyFieldSynced(field) || model.HasPropertyFieldOwners(field) || model.IsPropertyFieldProtected(field)
}

// requiredChannelAttributeActorID is who a person's request is made by when
// resolving required attributes: the local admin in local mode, else the
// session user, else fallback.
func requiredChannelAttributeActorID(rctx request.CTX, fallback string) string {
	session := rctx.Session()
	if session.IsUnrestricted() {
		return model.CallerIDLocalAdmin
	}
	if session.UserId != "" {
		return session.UserId
	}
	return fallback
}

// notifyChannelAdminsOfMissingRequiredAttributes tells the channel's current
// admins, in the background, which required attributes they can still set after
// an action that a person without access to those attributes took. Nothing
// starts when required attributes are off or the channel takes no attributes.
func (a *App) notifyChannelAdminsOfMissingRequiredAttributes(rctx request.CTX, channel *model.Channel) {
	if !a.requiredChannelAttributesEnabled() || !channelCanMissRequiredAttributes(channel) {
		return
	}

	a.Srv().Go(func() {
		admins, err := a.Srv().Store().Channel().GetChannelAdminsInfoByChannelIds([]string{channel.Id})
		if err != nil {
			rctx.Logger().Warn("Failed to load the channel admins to notify of missing required channel attributes",
				mlog.String("channel_id", channel.Id), mlog.Err(err))
			return
		}
		for _, admin := range admins[channel.Id] {
			a.NotifyNewChannelAdminOfMissingRequiredAttributes(rctx, admin.Id, []*model.Channel{channel})
		}
	})
}

// writeChannelAttributeValues writes validated values onto channel on behalf of
// userID, through the property service so field permissions and the value
// hooks run.
func (a *App) writeChannelAttributeValues(rctx request.CTX, channel *model.Channel, userID string, values []*model.PropertyValue) error {
	if len(values) == 0 {
		return nil
	}

	for _, value := range values {
		value.TargetID = channel.Id
		value.TargetType = model.PropertyValueTargetTypeChannel
		value.CreatedBy = userID
		value.UpdatedBy = userID
	}

	if _, appErr := a.UpsertPropertyValues(rctxWithSessionCallerID(rctx), values, model.PropertyFieldObjectTypeChannel, channel.Id, ""); appErr != nil {
		return appErr
	}
	return nil
}
