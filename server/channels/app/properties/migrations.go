// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// MigrateBackfillCPADisplayName backfills the CPA display_name attribute on
// every CPA PropertyField that is missing one (absent key or empty string).
//
// This is the only public entry point that performs writes to CPA fields
// without going through the access-control layer. It does so deliberately:
// the backfill is a one-shot system migration and the access-control layer
// would otherwise reject writes against fields whose source plugin is not the
// caller (e.g. UAS-managed CPA fields with attrs["protected"]=true). Confining
// the bypass to this single, named, side-effect-bounded method avoids
// introducing a general "skip access control" surface that other code could
// reach for.
//
// The method is idempotent at the field level: fields that already have a
// non-empty display_name are skipped. The caller (app/migrations.go) is
// responsible for the System-key idempotency wrapper that prevents the whole
// migration from running twice.
//
// Returns the number of fields that were backfilled and the number that were
// skipped, so the caller can log a summary.
func (ps *PropertyService) MigrateBackfillCPADisplayName(rctx request.CTX) (backfilled int, skipped int, err error) {
	group, err := ps.Group(model.AccessControlPropertyGroupName)
	if err != nil {
		return 0, 0, fmt.Errorf("MigrateBackfillCPADisplayName: failed to get CPA property group: %w", err)
	}
	groupID := group.ID

	const cpaFieldLimit = 20
	var fieldsToUpdate []*model.PropertyField

	// Use the unexported searchPropertyFields to bypass access control.
	// AC would filter out (or strip options from) protected fields when
	// the caller is not the source plugin, which would corrupt the
	// fields we then try to write back. CPA creation is capped at 20
	// active fields, so a single page covers the full migration scope.
	fields, searchErr := ps.searchPropertyFields(groupID, model.PropertyFieldSearchOpts{
		PerPage: cpaFieldLimit,
	})
	if searchErr != nil {
		return 0, 0, fmt.Errorf("MigrateBackfillCPADisplayName: failed to search CPA fields: %w", searchErr)
	}

	for _, pf := range fields {
		cpaField, convErr := model.NewCPAFieldFromPropertyField(pf)
		if convErr != nil {
			return 0, 0, fmt.Errorf("MigrateBackfillCPADisplayName: failed to convert property field %q: %w", pf.ID, convErr)
		}

		// Backfill if display_name is absent OR empty-string. This covers
		// fields created before display_name existed, fields created after
		// without an explicit display_name (stored as ""), and fields
		// patched with display_name="".
		if cpaField.Attrs.DisplayName != "" {
			skipped++
			continue
		}

		cpaField.Attrs.DisplayName = cpaField.Name
		fieldsToUpdate = append(fieldsToUpdate, cpaField.ToPropertyField())
	}

	if len(fieldsToUpdate) > 0 {
		// Use the unexported updatePropertyFields for the same reason as
		// searchPropertyFields above: the AC layer rejects writes from the
		// system to fields owned by a source plugin.
		if _, _, _, updateErr := ps.updatePropertyFields(rctx, groupID, fieldsToUpdate); updateErr != nil {
			return 0, 0, fmt.Errorf("MigrateBackfillCPADisplayName: failed to update CPA fields: %w", updateErr)
		}
	}

	return len(fieldsToUpdate), skipped, nil
}

// isEligibleForGlobalAttributesMigration reports whether a CPA field should be
// migrated into a Global Attributes template: not already linked, and not
// plugin-managed, protected, or owner-managed (checked independently, since
// Owners supersedes the legacy protected/source_plugin_id gating).
func isEligibleForGlobalAttributesMigration(field *model.PropertyField) bool {
	if field.LinkedFieldID != nil && *field.LinkedFieldID != "" {
		return false
	}
	if sourcePluginID, _ := field.Attrs[model.PropertyAttrsSourcePluginID].(string); sourcePluginID != "" {
		return false
	}
	if model.IsPropertyFieldProtected(field) {
		return false
	}
	if model.HasPropertyFieldOwners(field) {
		return false
	}
	return true
}

// deepCopyAttrs clones a field's Attrs map so the copy shares no nested
// slices/maps with the original — a shallow copy would let mutating one
// field's options silently corrupt the other's.
func deepCopyAttrs(attrs model.StringInterface) (model.StringInterface, error) {
	if attrs == nil {
		return model.StringInterface{}, nil
	}

	data, err := json.Marshal(attrs)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal attrs for deep copy: %w", err)
	}

	var clone model.StringInterface
	if err := json.Unmarshal(data, &clone); err != nil {
		return nil, fmt.Errorf("failed to unmarshal attrs for deep copy: %w", err)
	}

	return clone, nil
}

// errUnrelatedTemplateName marks a lookupReusableTemplate failure that's
// specifically a name collision with an unrelated template — as opposed to a
// marked template that's unsafe to reuse for some other reason (protected,
// plugin/owner-managed, type mismatch). Callers use this to decide whether
// retrying under a disambiguating name is worth attempting.
var errUnrelatedTemplateName = errors.New("template name is used by an unrelated template")

// reservedTemplateNames lists template Names owned by another Mattermost
// feature. A CPA field colliding with one of these is always skipped — never
// retried under a "_copy" name — since the name itself belongs to that
// feature, not to an incidental admin-created attribute.
var reservedTemplateNames = map[string]bool{
	"classification": true, // Classification Markings' own template
}

// lookupReusableTemplate looks for an existing template named templateName
// that's safe to reuse for cpaField: it must carry this migration's own
// marker (PropertyAttrsMigratedToGlobal) — an unmarked, same-named template
// belongs to someone else and must not be hijacked (errUnrelatedTemplateName)
// — it must be unprotected, not plugin/owner-managed, and type-matched, since
// the link-write this feeds bypasses the validation that would normally check
// all of that, and it must not already be linked from a different field: two
// CPA fields sharing one template is the "ambiguous sibling" state
// access_control_masking.go documents as having no DB-level uniqueness guard.
//
// Reads from master: also used as the post-create-failure fallback, so it
// must see another HA node's just-committed row without replication lag.
//
// Returns (template, true, nil) on a safe reuse; (nil, false, nil) when
// nothing exists at this name; (nil, true, err) for an unsafe or conflicting
// match (permanent skip); (nil, false, err) when the lookup itself failed
// (transient).
func (ps *PropertyService) lookupReusableTemplate(rctx request.CTX, groupID, templateName string, cpaField *model.PropertyField) (template *model.PropertyField, found bool, err error) {
	existing, lookupErr := ps.getPropertyFieldByNameForObjectType(store.RequestContextWithMaster(rctx), groupID, "", model.PropertyFieldObjectTypeTemplate, templateName)
	if lookupErr != nil {
		if store.IsErrNotFound(lookupErr) {
			return nil, false, nil
		}
		return nil, false, fmt.Errorf("failed to check for an existing template named %q: %w", templateName, lookupErr)
	}

	if migrated, _ := existing.Attrs[model.PropertyAttrsMigratedToGlobal].(bool); !migrated {
		return nil, true, fmt.Errorf("template name %q is already used by an unrelated, unmarked template: %w", templateName, errUnrelatedTemplateName)
	}
	if existing.Protected || model.IsPropertyFieldProtected(existing) || model.HasPropertyFieldOwners(existing) {
		return nil, true, fmt.Errorf("template name %q is protected or owner-managed; refusing to reuse", templateName)
	}
	if sourcePluginID, _ := existing.Attrs[model.PropertyAttrsSourcePluginID].(string); sourcePluginID != "" {
		return nil, true, fmt.Errorf("template name %q is plugin-owned; refusing to reuse", templateName)
	}
	if existing.Type != cpaField.Type {
		return nil, true, fmt.Errorf("template name %q has type %q, which does not match field type %q; refusing to reuse", templateName, existing.Type, cpaField.Type)
	}

	linkedCount, countErr := ps.fieldStore.CountLinkedFields(existing.ID)
	if countErr != nil {
		return nil, false, fmt.Errorf("failed to check existing links for template %q: %w", templateName, countErr)
	}
	if linkedCount > 0 {
		return nil, true, fmt.Errorf("template name %q is already linked from another field; refusing to create an ambiguous sibling link", templateName)
	}

	return existing, true, nil
}

// isPermanentCreateFailure reports whether a CreatePropertyField failure is
// deterministic and will never resolve on retry: the field-limit sentinels,
// or any AppError/ErrInvalidFieldAttrs/ErrAdminRequired raised by the hook
// chain's create-time validation. Several of these validations are strict on
// create but grandfathered on update (e.g. ValidateCPAFieldName), so a
// legacy CPA field can fail every single create attempt. A genuine store/DB
// error carries none of these sentinels and is treated as transient.
func isPermanentCreateFailure(err error) bool {
	if errors.Is(err, ErrGroupFieldLimitReached) || errors.Is(err, ErrFieldLimitReached) ||
		errors.Is(err, ErrInvalidFieldAttrs) || errors.Is(err, ErrAdminRequired) {
		return true
	}
	var appErr *model.AppError
	return errors.As(err, &appErr)
}

// copyNameSuffix disambiguates a template name that collides with an
// unrelated, unmarked template. Attempted exactly once — if the
// disambiguated name also fails, that failure is final (see
// createOrReuseGlobalAttributeTemplate).
const copyNameSuffix = "_copy"

// attemptCreateOrReuseTemplate reuses or creates a template named
// templateName for cpaField. unrelatedNameCollision reports whether the
// failure was specifically an unrelated-template name collision, so the
// caller can decide whether a disambiguated retry is worth attempting. See
// createOrReuseGlobalAttributeTemplate for the transient/permanent contract.
func (ps *PropertyService) attemptCreateOrReuseTemplate(rctx request.CTX, groupID, templateName string, cpaField *model.PropertyField) (template *model.PropertyField, transient, unrelatedNameCollision bool, err error) {
	existing, found, lookupErr := ps.lookupReusableTemplate(rctx, groupID, templateName, cpaField)
	if found {
		return existing, false, errors.Is(lookupErr, errUnrelatedTemplateName), lookupErr
	}
	if lookupErr != nil {
		return nil, true, false, lookupErr
	}

	attrsCopy, copyErr := deepCopyAttrs(cpaField.Attrs)
	if copyErr != nil {
		return nil, true, false, fmt.Errorf("failed to deep-copy attrs for field %q: %w", cpaField.ID, copyErr)
	}
	attrsCopy[model.PropertyAttrsMigratedToGlobal] = true
	if templateName != cpaField.Name {
		if displayName, _ := attrsCopy[model.PropertyFieldAttrDisplayName].(string); displayName != "" {
			attrsCopy[model.PropertyFieldAttrDisplayName] = displayName + " (copy)"
		}
	}

	sysadmin := model.PermissionLevelSysadmin
	created, createErr := ps.CreatePropertyField(rctx, &model.PropertyField{
		GroupID:           groupID,
		Name:              templateName,
		Type:              cpaField.Type,
		Attrs:             attrsCopy,
		TargetType:        cpaField.TargetType,
		ObjectType:        model.PropertyFieldObjectTypeTemplate,
		PermissionField:   &sysadmin,
		PermissionValues:  &sysadmin,
		PermissionOptions: &sysadmin,
		CreatedBy:         model.CallerIDLocalAdmin,
		UpdatedBy:         model.CallerIDLocalAdmin,
	})
	if createErr == nil {
		return created, false, false, nil
	}

	// Retry the lookup before classifying createErr: CreatePropertyField's own
	// name-conflict check reads master before the INSERT, so an HA race
	// between two nodes usually surfaces as a deterministic-looking AppError.
	// If another node already committed a template here, that wins regardless
	// of how createErr looks.
	existing, found, lookupErr = ps.lookupReusableTemplate(rctx, groupID, templateName, cpaField)
	if found {
		return existing, false, errors.Is(lookupErr, errUnrelatedTemplateName), lookupErr
	}

	if isPermanentCreateFailure(createErr) {
		return nil, false, false, fmt.Errorf("permanently skipping field %q: %w", cpaField.Name, createErr)
	}

	return nil, true, false, fmt.Errorf("failed to create template for field %q: %w", cpaField.Name, errors.Join(createErr, lookupErr))
}

// createOrReuseGlobalAttributeTemplate creates a new Global Attribute template
// for the given CPA field, or reuses an existing one this same migration
// created on a prior (crashed or racing) run. Returns transient=true when the
// failure is unresolved and the field should be retried on a later restart
// (the caller must not persist the migration's "done" marker for this run);
// transient=false marks a permanent, by-design skip.
//
// If cpaField.Name collides with an unrelated, unmarked template, this
// retries exactly once under "<name>_copy" rather than skipping outright —
// unless the name is reserved for another Mattermost feature (e.g.
// Classification Markings' "classification" template), which is always
// skipped rather than risking a look-alike under that feature's name.
func (ps *PropertyService) createOrReuseGlobalAttributeTemplate(rctx request.CTX, groupID string, cpaField *model.PropertyField) (template *model.PropertyField, transient bool, err error) {
	template, transient, unrelatedNameCollision, err := ps.attemptCreateOrReuseTemplate(rctx, groupID, cpaField.Name, cpaField)
	if !unrelatedNameCollision || reservedTemplateNames[cpaField.Name] {
		return template, transient, err
	}

	template, transient, _, err = ps.attemptCreateOrReuseTemplate(rctx, groupID, cpaField.Name+copyNameSuffix, cpaField)
	return template, transient, err
}

// MigrateLinkCPAFieldToGlobalAttributeTemplate sets LinkedFieldID on an
// existing CPA field, bypassing the invariant in updatePropertyFields that
// blocks retrofitting a link after creation. It performs none of the normal
// validation and must never be called on anything but the small,
// pre-validated set MigrateCPAFieldsToGlobalAttributes produces.
func (ps *PropertyService) MigrateLinkCPAFieldToGlobalAttributeTemplate(rctx request.CTX, groupID, fieldID, templateID string) (*model.PropertyField, error) {
	field, err := ps.fieldStore.Get(store.RequestContextWithMaster(rctx), groupID, fieldID)
	if err != nil {
		return nil, fmt.Errorf("MigrateLinkCPAFieldToGlobalAttributeTemplate: failed to get field %q: %w", fieldID, err)
	}

	// An HA rolling restart can have this node running the migration while
	// another node is still live and serving an admin edit to this same
	// field. expectedUpdateAts closes that TOCTOU window: if the row changed
	// since the Get above, the store returns store.ErrConflict instead of
	// blindly overwriting the concurrent write, and the caller retries the
	// field on a later restart (see MigrateCPAFieldsToGlobalAttributes).
	expectedUpdateAt := field.UpdateAt
	field.LinkedFieldID = &templateID

	updated, err := ps.fieldStore.Update(groupID, []*model.PropertyField{field}, map[string]int64{fieldID: expectedUpdateAt})
	if err != nil {
		return nil, fmt.Errorf("MigrateLinkCPAFieldToGlobalAttributeTemplate: failed to link field %q to template %q: %w", fieldID, templateID, err)
	}

	return updated[0], nil
}

// MigrateCPAFieldsToGlobalAttributes migrates every eligible CPA field (see
// isEligibleForGlobalAttributesMigration) into a Global Attributes template:
// a new template field is created (or an orphaned one from a prior crashed
// run is reused), and the original CPA field is linked to it. Values
// (PropertyValue rows) are never touched — they stay attached to the original
// field's unchanged ID.
//
// Returns the number of fields migrated, the number permanently skipped by
// design, and the number that hit an unresolved per-field failure. The
// caller must not persist the migration's "done" marker when retryable > 0,
// so a later restart retries those fields; err is reserved for a
// migration-wide failure (e.g. can't look up the property group or list its
// fields).
func (ps *PropertyService) MigrateCPAFieldsToGlobalAttributes(rctx request.CTX) (migrated, skipped, retryable int, err error) {
	group, err := ps.Group(model.AccessControlPropertyGroupName)
	if err != nil {
		return 0, 0, 0, fmt.Errorf("MigrateCPAFieldsToGlobalAttributes: failed to get CPA property group: %w", err)
	}
	groupID := group.ID

	// Don't trust the 20-field FieldLimitHook cap here: it postdates CPA's
	// original release, so match the CPA listing endpoint's own defensive
	// PerPage instead of risking a silently-truncated page.
	fields, searchErr := ps.searchPropertyFields(groupID, model.PropertyFieldSearchOpts{
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		PerPage:    model.AccessControlGroupFieldLimit + 5,
	})
	if searchErr != nil {
		return 0, 0, 0, fmt.Errorf("MigrateCPAFieldsToGlobalAttributes: failed to search CPA fields: %w", searchErr)
	}

	// Template creation goes through the normal hooked CreatePropertyField
	// path. CallerIDLocalAdmin is required for AccessControlAttributeValidationHook
	// to allow copying a managed=admin field's attrs — the same identity real
	// local-mode admin sessions already use for that check, not a new bypass.
	migCtx := SystemCallerContext(rctx)
	migCtx = migCtx.WithContext(model.WithCallerID(migCtx.Context(), model.CallerIDLocalAdmin))

	for _, field := range fields {
		if !isEligibleForGlobalAttributesMigration(field) {
			skipped++
			continue
		}

		template, transient, tmplErr := ps.createOrReuseGlobalAttributeTemplate(migCtx, groupID, field)
		if tmplErr != nil {
			if transient {
				rctx.Logger().Warn("CPA-to-Global-Attributes migration: field will be retried on a later restart",
					mlog.String("field_id", field.ID), mlog.String("field_name", field.Name), mlog.Err(tmplErr))
				retryable++
			} else {
				rctx.Logger().Warn("CPA-to-Global-Attributes migration: field permanently skipped",
					mlog.String("field_id", field.ID), mlog.String("field_name", field.Name), mlog.Err(tmplErr))
				skipped++
			}
			continue
		}

		if _, linkErr := ps.MigrateLinkCPAFieldToGlobalAttributeTemplate(migCtx, groupID, field.ID, template.ID); linkErr != nil {
			rctx.Logger().Warn("CPA-to-Global-Attributes migration: field will be retried on a later restart",
				mlog.String("field_id", field.ID), mlog.String("field_name", field.Name), mlog.String("template_id", template.ID), mlog.Err(linkErr))
			retryable++
			continue
		}

		migrated++
	}

	return migrated, skipped, retryable, nil
}
