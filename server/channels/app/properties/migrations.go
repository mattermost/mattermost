// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
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
	fields, searchErr := ps.searchPropertyFields(rctx, groupID, model.PropertyFieldSearchOpts{
		PerPage: cpaFieldLimit,
	})
	if searchErr != nil {
		return 0, 0, fmt.Errorf("MigrateBackfillCPADisplayName: failed to search CPA fields: %w", searchErr)
	}

	for _, pf := range fields {
		// The display_name attr is set on the PropertyField in place rather than by
		// round-tripping through model.CPAField. CPAField holds a fixed set of typed
		// attrs, so ToPropertyField rebuilds the whole blob from them and drops
		// anything it has no field for — including the marker a read leaves on a
		// field whose option list was withheld for being oversized. Losing that
		// marker turns this backfill's write into "this field now has no options"
		// and soft-deletes every one of them.
		//
		// Backfill if display_name is absent OR empty-string. This covers
		// fields created before display_name existed, fields created after
		// without an explicit display_name (stored as ""), and fields
		// patched with display_name="".
		if displayName, _ := pf.Attrs[model.CustomProfileAttributesPropertyAttrsDisplayName].(string); displayName != "" {
			skipped++
			continue
		}

		if pf.Attrs == nil {
			pf.Attrs = model.StringInterface{}
		}
		pf.Attrs[model.CustomProfileAttributesPropertyAttrsDisplayName] = pf.Name
		fieldsToUpdate = append(fieldsToUpdate, pf)
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
	return isPlainCPAField(field)
}

// isPlainCPAField reports whether field is one this migration may act on at
// all: not plugin-managed, protected, or owner-managed. Shared by
// isEligibleForGlobalAttributesMigration (an unlinked field) and the
// already-linked cleanup below (an already-linked field) -- a field excluded
// for any of these reasons may be linked for reasons that have nothing to do
// with this migration, and its own option rows are not this migration's to
// touch either way.
func isPlainCPAField(field *model.PropertyField) bool {
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

// errPermissionsAuthored marks a field whose permissions object no longer
// matches its legacy settings, so linking cannot reconvert it without loss.
var errPermissionsAuthored = errors.New("permissions were changed after conversion")

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
// create-only field-limit sentinels, or an AppError from validation (e.g.
// PropertyField.IsValid's 255-rune Name cap on a long slugified legacy
// name). Anything else is a genuine store/DB error and transient.
func isPermanentPropertyFieldFailure(err error) bool {
	if errors.Is(err, ErrGroupFieldLimitReached) || errors.Is(err, ErrFieldLimitReached) ||
		errors.Is(err, ErrInvalidFieldAttrs) || errors.Is(err, ErrAdminRequired) || errors.Is(err, errPermissionsAuthored) {
		return true
	}
	var appErr *model.AppError
	return errors.As(err, &appErr)
}

// disambiguatedTemplateName appends the field's own globally-unique ID to
// baseName, guaranteeing no collision with anything else in the group.
// Deterministic across restarts, so a crashed prior run's orphaned template
// at this name is found and reused, not duplicated.
func disambiguatedTemplateName(baseName, fieldID string) string {
	return baseName + "_" + fieldID
}

var (
	celCamelBoundary1     = regexp.MustCompile(`([a-z0-9])([A-Z])`)
	celCamelBoundary2     = regexp.MustCompile(`([A-Z]+)([A-Z][a-z])`)
	celInvalidChars       = regexp.MustCompile(`[^a-z0-9_]`)
	celLeadingDigit       = regexp.MustCompile(`^[0-9]`)
	celRepeatedUnderscore = regexp.MustCompile(`_+`)
	celTrailingUnderscore = regexp.MustCompile(`_+$`)
)

// slugifyForCEL converts name into a CEL-safe identifier, mirroring the
// webapp's twin (utils/properties.ts) used when suggesting a unique name
// from a display name, so the same input produces the same result whether
// slugified client-side or here. Always satisfies CPAFieldNamePattern by
// construction; additionally escapes a charset-valid CEL reserved word
// (e.g. a legacy field literally named "in"), which the webapp twin doesn't
// need to since it never has to survive ValidateCPAFieldName on its own.
func slugifyForCEL(name string) string {
	slug := celCamelBoundary1.ReplaceAllString(name, "${1}_${2}")
	slug = celCamelBoundary2.ReplaceAllString(slug, "${1}_${2}")
	slug = strings.ToLower(slug)
	slug = celInvalidChars.ReplaceAllString(slug, "_")
	if celLeadingDigit.MatchString(slug) {
		slug = "_" + slug
	}
	slug = celRepeatedUnderscore.ReplaceAllString(slug, "_")
	slug = celTrailingUnderscore.ReplaceAllString(slug, "")
	if slug == "" {
		slug = "_copy"
	}
	if _, reserved := model.CPAFieldNameReservedWords[slug]; reserved {
		slug += "_attr"
	}
	return slug
}

// templateNameBase returns the name to attempt for cpaField's template:
// cpaField.Name verbatim when it's already CEL-safe, or a slugified version
// when it's not (a legacy name that predates ValidateCPAFieldName, e.g. one
// containing a space). The CPA field's own Name is never changed, and the
// original string is preserved as the template's display_name — already
// backfilled from Name if empty by MigrateBackfillCPADisplayName, which
// runs before this migration — so nothing user-visible changes.
func templateNameBase(cpaField *model.PropertyField) string {
	if appErr := model.ValidateCPAFieldName(cpaField.Name); appErr != nil {
		return slugifyForCEL(cpaField.Name)
	}
	return cpaField.Name
}

// attemptCreateOrReuseTemplate reuses or creates a template named
// templateName for cpaField. templateName == baseName is the primary
// attempt; anything else is a disambiguated retry, which appends a
// "(copy)" suffix to display_name. unrelatedNameCollision reports whether
// the failure was an unrelated-template name collision, so the caller
// knows whether a disambiguated retry is worth attempting. See
// createOrReuseGlobalAttributeTemplate for the transient/permanent
// contract.
func (ps *PropertyService) attemptCreateOrReuseTemplate(rctx request.CTX, groupID, templateName, baseName string, cpaField *model.PropertyField) (template *model.PropertyField, transient, unrelatedNameCollision bool, err error) {
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
	if templateName != baseName {
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
// The base name (see templateNameBase) is attempted first. A collision with
// an unrelated, unmarked template retries once with that base name
// disambiguated by field ID (see disambiguatedTemplateName), which always
// succeeds.
func (ps *PropertyService) createOrReuseGlobalAttributeTemplate(rctx request.CTX, groupID string, cpaField *model.PropertyField) (template *model.PropertyField, transient bool, err error) {
	baseName := templateNameBase(cpaField)
	template, transient, unrelatedNameCollision, err := ps.attemptCreateOrReuseTemplate(rctx, groupID, baseName, baseName, cpaField)
	if !unrelatedNameCollision {
		return template, transient, err
	}

	template, transient, _, err = ps.attemptCreateOrReuseTemplate(rctx, groupID, disambiguatedTemplateName(baseName, cpaField.ID), baseName, cpaField)
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

	// An unlicensed first boot skips this migration but not the permissions
	// backfill, which converts the field unlinked and never revisits it. Convert
	// it again as the backfill would have once linked, but only while the object
	// is still that conversion: anything authored since would be overwritten.
	if field.Permissions != nil {
		source := legacySourceOf(field)
		if !permissionsEquivalent(field.Permissions, model.PermissionsFromLegacy(source, model.LegacyConversionOpts{ConvertAttrs: true})) {
			return nil, fmt.Errorf("MigrateLinkCPAFieldToGlobalAttributeTemplate: field %q: %w", fieldID, errPermissionsAuthored)
		}
		template, templateErr := ps.fieldStore.Get(store.RequestContextWithMaster(rctx), groupID, templateID)
		if templateErr != nil {
			return nil, fmt.Errorf("MigrateLinkCPAFieldToGlobalAttributeTemplate: failed to get template %q: %w", templateID, templateErr)
		}
		field.Permissions = model.PermissionsFromLegacy(source, model.LegacyConversionOpts{ConvertAttrs: true, Template: templatePermissionsOrZero(template)})
	}

	updated, err := ps.fieldStore.Update(groupID, []*model.PropertyField{field}, map[string]int64{fieldID: expectedUpdateAt})
	if err != nil {
		return nil, fmt.Errorf("MigrateLinkCPAFieldToGlobalAttributeTemplate: failed to link field %q to template %q: %w", fieldID, templateID, err)
	}

	// The template was created with its own copy of this field's options
	// (attemptCreateOrReuseTemplate deep-copies Attrs, IDs included), and a
	// linked field derives its options from the template it links to rather
	// than holding a copy. Its own rows are now redundant, and optionOwnerIDs
	// unions a linked field's own rows with its template's, so leaving them
	// live would double every option this field's options are read as.
	if field.Type.SupportsOptions() {
		if err := ps.fieldStore.PermanentDeleteOwnedOptions(groupID, fieldID); err != nil {
			return nil, fmt.Errorf("MigrateLinkCPAFieldToGlobalAttributeTemplate: failed to clear field %q's own options after linking to template %q: %w", fieldID, templateID, err)
		}
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
	//
	// Reads from master: this is a one-shot migration, so a field missed
	// here due to replica lag is missed permanently, not just delayed.
	fields, searchErr := ps.searchPropertyFields(store.RequestContextWithMaster(rctx), groupID, model.PropertyFieldSearchOpts{
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
	migCtx := rctx.WithContext(model.WithCallerID(rctx.Context(), model.CallerIDLocalAdmin))

	for _, field := range fields {
		if !isEligibleForGlobalAttributesMigration(field) {
			// A field this migration itself linked derives its options from
			// that template, but a prior version of the link step below left
			// its own pre-linking option rows in place -- and optionOwnerIDs
			// (property_field_options.go) unions a linked field's own rows
			// with its template's, so every option it serves came back
			// doubled. Clearing them here, on every pass over such a field,
			// is what makes clearing this migration's own System-key marker
			// and re-running it a genuine "fixes itself" for installs that
			// already carry the duplication -- no separate migration or
			// marker needed for it. isPlainCPAField excludes anything linked
			// for reasons that have nothing to do with this migration (e.g. a
			// plugin-managed field with its own, unrelated link).
			if field.LinkedFieldID != nil && *field.LinkedFieldID != "" && field.Type.SupportsOptions() && isPlainCPAField(field) {
				if clearErr := ps.fieldStore.PermanentDeleteOwnedOptions(groupID, field.ID); clearErr != nil {
					// Counted toward retryable, not skipped: skipped would let the
					// caller persist the "done" marker with this field's duplication
					// still unfixed, and never retry it again.
					rctx.Logger().Warn("CPA-to-Global-Attributes migration: field will be retried on a later restart",
						mlog.String("field_id", field.ID), mlog.String("field_name", field.Name), mlog.Err(clearErr))
					retryable++
					continue
				}
				rctx.Logger().Info("CPA-to-Global-Attributes migration: cleared an already-linked field's own options",
					mlog.String("field_id", field.ID), mlog.String("field_name", field.Name))
			}
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

// ConvertSystemOwnedFields bootstraps builtin fields that a system subsystem
// owns in groupID (per model.SystemOwnedFieldGrant) when they carry no Permissions
// object at all, converting them from legacy columns and adding the subsystem's
// {service, groupName} grant.
//
// Reads and writes through the unexported field accessors, bypassing the
// access-control hook, for the same reason MigrateBackfillCPADisplayName
// does: the hook refuses a field with no Permissions object outright before
// any caller identity or grant is consulted.
//
// Only runs when field.Permissions == nil: if the field already carries permissions,
// it is left untouched so that an administrator's revocation of the grant is not
// undone on reboot.
func (ps *PropertyService) ConvertSystemOwnedFields(rctx request.CTX, groupID, groupName string) error {
	fields, err := ps.searchPropertyFields(rctx, groupID, model.PropertyFieldSearchOpts{PerPage: propertyPermissionsBackfillPageSize})
	if err != nil {
		return fmt.Errorf("ConvertSystemOwnedFields: failed to search fields: %w", err)
	}

	convertAttrs, err := ps.groupConvertsAttrs(groupID)
	if err != nil {
		return fmt.Errorf("ConvertSystemOwnedFields: %w", err)
	}

	var toUpdate []*model.PropertyField
	for _, field := range fields {
		grant := model.SystemOwnedFieldGrant(groupName, field.Name)
		if grant == nil {
			continue
		}

		if field.Permissions != nil {
			continue
		}

		field.Permissions = model.PermissionsFromLegacy(field, model.LegacyConversionOpts{ConvertAttrs: convertAttrs})
		field.Permissions.Grants = append(field.Permissions.Grants, *grant)
		toUpdate = append(toUpdate, field)
	}
	if len(toUpdate) == 0 {
		return nil
	}

	_, _, _, err = ps.updatePropertyFields(rctx, groupID, toUpdate)
	if err != nil {
		return fmt.Errorf("ConvertSystemOwnedFields: failed to persist converted fields: %w", err)
	}
	return nil
}

// permissionsBackfill holds the state one backfill run carries across pages:
// which group is access_control (the only one whose Attrs ever gated
// anything, so the only one whose Attrs convert), and every linked field's
// template Permissions resolved so far, so a scheme with many linked fields
// reads and converts its template once rather than once per field.
type permissionsBackfill struct {
	service              *PropertyService
	accessControlGroupID string
	templates            map[string]*model.Permissions
}

func newPermissionsBackfill(service *PropertyService, accessControlGroupID string) *permissionsBackfill {
	return &permissionsBackfill{
		service:              service,
		accessControlGroupID: accessControlGroupID,
		templates:            map[string]*model.Permissions{},
	}
}

// convertBatch sets Permissions in place on every field in fields that does
// not already have one, and returns the subset it changed. A field already
// carrying Permissions is left alone and excluded from the result, so the
// backfill is idempotent at the field level and never reverts a field a v3
// caller wrote mid-run. A PSAv1 field (empty ObjectType, e.g. the content
// flagging group's fields) is left alone too: PropertyField.IsValid refuses a
// Permissions object on that schema, so there is nothing for this conversion
// to give it.
func (b *permissionsBackfill) convertBatch(rctx request.CTX, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	var converted []*model.PropertyField
	for _, field := range fields {
		if field.Permissions != nil || field.IsPSAv1() {
			continue
		}

		opts := model.LegacyConversionOpts{
			// Only the access_control group's Attrs (protected, access_mode,
			// owners, source plugin, sync lock) were ever enforced; everywhere
			// else there is nothing in Attrs to preserve.
			ConvertAttrs: field.GroupID == b.accessControlGroupID,
		}

		if field.LinkedFieldID != nil && *field.LinkedFieldID != "" {
			template, err := b.resolveTemplate(rctx, field.GroupID, *field.LinkedFieldID, opts.ConvertAttrs)
			if err != nil {
				return nil, err
			}
			opts.Template = template

			if opts.ConvertAttrs && template.Masking == nil && model.LegacyAccessMode(field) == model.PropertyAccessModeSharedOnly {
				// PermissionsFromLegacy narrows this field's own reads to none
				// below rather than emitting a masking object it is not allowed
				// to carry: a linked field may not declare masking of its own.
				// That is a real access change an operator needs to know about;
				// every other conversion here is like for like.
				rctx.Logger().Warn("Converting a linked field's shared_only access mode to no read access because its template did not convert to masked",
					mlog.String("field_id", field.ID),
					mlog.String("template_id", *field.LinkedFieldID),
				)
			}
		}

		field.Permissions = model.PermissionsFromLegacy(field, opts)
		converted = append(converted, field)
	}
	return converted, nil
}

// propertyPermissionsBackfillPageSize bounds how many fields one page of
// MigrateBackfillPropertyPermissions reads and writes. Unlike the CPA display
// name backfill, this one runs over every group, some of which (boards,
// content_flagging) can hold far more fields than a single page should carry.
// A var, not a const, so a test can shrink it to make paging happen over a
// handful of fields instead of hundreds.
var propertyPermissionsBackfillPageSize = 200

// MigrateBackfillPropertyPermissions gives every PropertyField across every
// group a Permissions object converted from its legacy settings, so the
// decision engine can eventually read Permissions alone. Same bypass
// rationale as MigrateBackfillCPADisplayName: it reads and writes through the
// unexported field accessors so the access-control layer never filters or
// refuses a protected or plugin-owned field mid-conversion, and it is
// idempotent at the field level so a partial run resumes cleanly. The
// System-key wrapper that stops the whole migration running twice belongs to
// its caller (app/migrations.go), as with the CPA backfill.
//
// Fields are read with no group filter and paged by (CreateAt, Id), which
// walks every group with one cursor. Writes go through the unexported
// updatePropertyFields, one call per group per page, since that method takes
// a single group ID.
//
// Returns the number of fields given a Permissions object and the number left
// alone, either because they already carried one or because they are PSAv1
// (the content flagging group's fields, which cannot carry Permissions at
// all).
func (ps *PropertyService) MigrateBackfillPropertyPermissions(rctx request.CTX) (converted int, skipped int, err error) {
	accessControlGroup, err := ps.Group(model.AccessControlPropertyGroupName)
	if err != nil {
		return 0, 0, fmt.Errorf("MigrateBackfillPropertyPermissions: failed to get access control property group: %w", err)
	}

	backfill := newPermissionsBackfill(ps, accessControlGroup.ID)

	var cursor model.PropertyFieldSearchCursor
	for {
		fields, searchErr := ps.searchPropertyFields(rctx, "", model.PropertyFieldSearchOpts{
			PerPage: propertyPermissionsBackfillPageSize,
			Cursor:  cursor,
		})
		if searchErr != nil {
			return converted, skipped, fmt.Errorf("MigrateBackfillPropertyPermissions: failed to search property fields: %w", searchErr)
		}
		if len(fields) == 0 {
			break
		}

		last := fields[len(fields)-1]
		cursor = model.PropertyFieldSearchCursor{PropertyFieldID: last.ID, CreateAt: last.CreateAt}

		convertedFields, convertErr := backfill.convertBatch(rctx, fields)
		if convertErr != nil {
			return converted, skipped, fmt.Errorf("MigrateBackfillPropertyPermissions: failed to convert fields: %w", convertErr)
		}
		skipped += len(fields) - len(convertedFields)

		// updatePropertyFields takes one group ID, so a page spanning several
		// groups needs one call per group.
		byGroup := map[string][]*model.PropertyField{}
		for _, field := range convertedFields {
			byGroup[field.GroupID] = append(byGroup[field.GroupID], field)
		}
		for groupID, groupFields := range byGroup {
			if _, _, _, updateErr := ps.updatePropertyFields(rctx, groupID, groupFields); updateErr != nil {
				return converted, skipped, fmt.Errorf("MigrateBackfillPropertyPermissions: failed to update fields for group %q: %w", groupID, updateErr)
			}
		}
		converted += len(convertedFields)

		if len(fields) < propertyPermissionsBackfillPageSize {
			break
		}
	}

	return converted, skipped, nil
}

// resolveTemplate returns templateID's converted Permissions, memoized so a
// template linked from many fields is read and converted only once per
// backfill run. Reads through the unexported accessor, same as the fields
// this backfill converts, so the access-control layer never filters or strips
// the template out from under it.
func (b *permissionsBackfill) resolveTemplate(rctx request.CTX, groupID, templateID string, convertAttrs bool) (*model.Permissions, error) {
	if permissions, ok := b.templates[templateID]; ok {
		return permissions, nil
	}

	template, err := b.service.getPropertyField(rctx, groupID, templateID)
	if err != nil {
		return nil, fmt.Errorf("permissionsBackfill: failed to resolve template %q: %w", templateID, err)
	}

	permissions := template.Permissions
	if permissions == nil {
		// A template cannot itself be linked, so this conversion is one hop
		// deep and needs no cycle guard. A linked field is always in the same
		// group as its template, so convertAttrs carries over unchanged.
		permissions = model.PermissionsFromLegacy(template, model.LegacyConversionOpts{ConvertAttrs: convertAttrs})
	}
	b.templates[templateID] = permissions

	if permissions.Masking != nil {
		b.warnAboutMaskedTemplate(rctx, template, permissions, convertAttrs)
	}

	return permissions, nil
}

// warnAboutMaskedTemplate logs what an operator has to act on once template
// converts to masked, across every field linked to it.
//
// A linked field that is not object_type: user shows nobody anything, before
// this conversion and after it, until an operator sets the template's
// mask_by_field_id -- the conversion cannot infer that field from the
// template's linked fields, so this line is the only thing that tells an
// operator the scheme is waiting on them.
//
// A holdings field the people it filters can write defeats the mask outright:
// they set their own holdings to whatever they want the read to return. The
// store's ValidateMaskByFieldID and the service's create and update gates
// refuse that combination on a write, but neither reaches a row already
// stored, so this line is the only signal for a scheme that is open today.
func (b *permissionsBackfill) warnAboutMaskedTemplate(rctx request.CTX, template *model.PropertyField, permissions *model.Permissions, convertAttrs bool) {
	linked, err := b.service.fieldStore.GetLinkedFields([]string{template.ID}, nil)
	if err != nil {
		rctx.Logger().Warn("Failed to check a masked template's linked fields for non-user object types",
			mlog.String("template_id", template.ID),
			mlog.Err(err),
		)
		return
	}

	var nonUserFieldIDs []string
	var writableHoldingsIDs []string
	for _, field := range linked {
		if field.ObjectType != model.PropertyFieldObjectTypeUser {
			nonUserFieldIDs = append(nonUserFieldIDs, field.ID)
		}
		// A field the masking resolves its own holdings to -- mask_by_field_id names
		// it, or the template sets none so it falls back to itself -- is open to the
		// members it filters when its effective value.write admits them.
		if holdingsFieldIDFor(field, permissions.Masking) != field.ID {
			continue
		}
		// Decide from the Permissions this field ends the backfill with, not from
		// its stored column: the conversion drives value.write to none on a
		// protected, owner-managed or synced field, so the raw column reports an
		// open scheme the backfill is in the middle of closing.
		converted := field.Permissions
		if converted == nil {
			converted = model.PermissionsFromLegacy(field, model.LegacyConversionOpts{
				ConvertAttrs: convertAttrs,
				Template:     permissions,
			})
		}
		switch converted.Restrictions.TierFor(model.PropertyActionValueWrite) {
		case model.PermissionLevelMember, model.PermissionLevelEveryone:
			writableHoldingsIDs = append(writableHoldingsIDs, field.ID)
		}
	}

	if len(nonUserFieldIDs) > 0 {
		rctx.Logger().Warn("A masked template has fields linked to it that are not object_type user; those fields show nobody anything until the template's mask_by_field_id is set",
			mlog.String("template_id", template.ID),
			mlog.String("template_name", template.Name),
			mlog.Array("non_user_field_ids", nonUserFieldIDs),
		)
	}

	if len(writableHoldingsIDs) > 0 {
		rctx.Logger().Warn("A masked template's holdings field is writable by the members it filters, so they can widen their own masked view; tighten its value.write",
			mlog.String("template_id", template.ID),
			mlog.String("template_name", template.Name),
			mlog.Array("writable_holdings_field_ids", writableHoldingsIDs),
		)
	}
}
