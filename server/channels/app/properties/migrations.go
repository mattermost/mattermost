// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"errors"
	"fmt"
	"unicode/utf8"

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

// errUnrelatedTemplateName marks a lookupReusableTemplate failure that's a
// name collision with an unrelated template, as opposed to a marked template
// that's unsafe for some other reason (protected, plugin/owner-managed, type
// mismatch). Callers use this to decide whether a "_copy" retry is worth it.
var errUnrelatedTemplateName = errors.New("template name is used by an unrelated template")

// lookupReusableTemplate finds a template named templateName safe to reuse
// for cpaField: marked PropertyAttrsMigratedToGlobal (unmarked means it
// belongs to someone else, don't hijack it), unprotected, not
// plugin/owner-managed, type-matched, and not already linked from another
// field (the "ambiguous sibling" state access_control_masking.go warns has
// no DB-level guard) — the link-write this feeds skips all that validation.
//
// Reads from master: also serves as the post-create-failure fallback, so it
// must see another HA node's just-committed row.
//
// Returns: (template, true, nil) safe reuse; (nil, false, nil) no match;
// (nil, true, err) unsafe/conflicting match, permanent skip; (nil, false,
// err) lookup itself failed, transient.
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

// isPermanentPropertyFieldFailure reports whether a CreatePropertyField or
// fieldStore.Update failure is deterministic and won't resolve on retry: the
// create-only field-limit sentinels, or an AppError from validation (create-
// or update-time, e.g. ValidateCPAFieldName or PropertyField.IsValid's
// cross-field checks — some are stricter on create, so a legacy field can
// fail every attempt). Anything else is a genuine store/DB error and
// transient.
func isPermanentPropertyFieldFailure(err error) bool {
	if errors.Is(err, ErrGroupFieldLimitReached) || errors.Is(err, ErrFieldLimitReached) ||
		errors.Is(err, ErrInvalidFieldAttrs) || errors.Is(err, ErrAdminRequired) {
		return true
	}
	var appErr *model.AppError
	return errors.As(err, &appErr)
}

// disambiguatedTemplateName returns a template name for cpaField that can
// never collide with anything: the field's own ID is globally unique, so
// appending it guarantees a fresh name no matter what else exists in the
// group — including another feature's reserved template name. Deterministic
// across restarts, so a crashed prior run's orphaned template at this same
// name is still found and reused by lookupReusableTemplate rather than
// duplicated. Attempted exactly once — if this also fails, that failure is
// final (see createOrReuseGlobalAttributeTemplate).
func disambiguatedTemplateName(cpaField *model.PropertyField) string {
	return cpaField.Name + "_" + cpaField.ID
}

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
			// Skip the suffix rather than risk pushing an already-long
			// display_name over the field name length limit and turning a
			// disambiguation attempt into its own permanent skip.
			const copySuffix = " (copy)"
			if utf8.RuneCountInString(displayName)+utf8.RuneCountInString(copySuffix) <= model.PropertyFieldNameMaxRunes {
				attrsCopy[model.PropertyFieldAttrDisplayName] = displayName + copySuffix
			}
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

	// Retry the lookup before classifying createErr: another node may have
	// already committed a template here (its conflict check reads master
	// before the INSERT), which wins regardless of how createErr looks.
	existing, found, lookupErr = ps.lookupReusableTemplate(rctx, groupID, templateName, cpaField)
	if found {
		return existing, false, errors.Is(lookupErr, errUnrelatedTemplateName), lookupErr
	}

	if isPermanentPropertyFieldFailure(createErr) {
		return nil, false, false, fmt.Errorf("permanently skipping field %q: %w", cpaField.Name, createErr)
	}

	return nil, true, false, fmt.Errorf("failed to create template for field %q: %w", cpaField.Name, errors.Join(createErr, lookupErr))
}

// createOrReuseGlobalAttributeTemplate creates a template for cpaField, or
// reuses one this migration created on a prior crashed/racing run.
// transient=true means retry on a later restart (don't persist the "done"
// marker yet); transient=false is a permanent, by-design skip.
//
// A name collision with an unrelated, unmarked template retries once under
// disambiguatedTemplateName, which — being ID-suffixed — always succeeds
// regardless of what the colliding name is.
func (ps *PropertyService) createOrReuseGlobalAttributeTemplate(rctx request.CTX, groupID string, cpaField *model.PropertyField) (template *model.PropertyField, transient bool, err error) {
	template, transient, unrelatedNameCollision, err := ps.attemptCreateOrReuseTemplate(rctx, groupID, cpaField.Name, cpaField)
	if !unrelatedNameCollision {
		return template, transient, err
	}

	template, transient, _, err = ps.attemptCreateOrReuseTemplate(rctx, groupID, disambiguatedTemplateName(cpaField), cpaField)
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

	// Closes the TOCTOU window an HA rolling restart opens (another node can
	// still be live, editing this field): a mismatch surfaces as
	// store.ErrConflict instead of silently overwriting that edit.
	expectedUpdateAt := field.UpdateAt
	field.LinkedFieldID = &templateID

	updated, err := ps.fieldStore.Update(groupID, []*model.PropertyField{field}, map[string]int64{fieldID: expectedUpdateAt})
	if err != nil {
		return nil, fmt.Errorf("MigrateLinkCPAFieldToGlobalAttributeTemplate: failed to link field %q to template %q: %w", fieldID, templateID, err)
	}

	return updated[0], nil
}

// MigrateCPAFieldsToGlobalAttributes migrates every eligible CPA field (see
// isEligibleForGlobalAttributesMigration) into a Global Attributes template,
// creating or reusing a template and linking the field to it. PropertyValue
// rows are untouched — they stay attached to the field's unchanged ID.
//
// Returns counts of migrated, permanently-skipped, and retryable fields; the
// caller must not persist the "done" marker while retryable > 0. err is only
// set for a migration-wide failure (e.g. can't look up the property group).
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
			if isPermanentPropertyFieldFailure(linkErr) {
				rctx.Logger().Warn("CPA-to-Global-Attributes migration: field permanently skipped",
					mlog.String("field_id", field.ID), mlog.String("field_name", field.Name), mlog.String("template_id", template.ID), mlog.Err(linkErr))
				skipped++
			} else {
				rctx.Logger().Warn("CPA-to-Global-Attributes migration: field will be retried on a later restart",
					mlog.String("field_id", field.ID), mlog.String("field_name", field.Name), mlog.String("template_id", template.ID), mlog.Err(linkErr))
				retryable++
			}
			continue
		}

		migrated++
	}

	return migrated, skipped, retryable, nil
}
