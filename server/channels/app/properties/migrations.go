// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
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

// ConvertSystemOwnedFields makes sure every builtin field a system subsystem
// owns in groupID (per model.SystemOwnedFieldGrant) carries that subsystem's
// {service, groupName} grant, converting the field from its legacy columns
// first if it carries no Permissions object at all.
//
// Reads and writes through the unexported field accessors, bypassing the
// access-control hook, for the same reason MigrateBackfillCPADisplayName
// does: the hook refuses a field with no Permissions object outright, on
// both the read (hiding its options, the same defect that once destroyed
// every install's boards Status options) and the write, before any caller
// identity or grant is ever consulted -- so there is no way through the hook
// to reach a field that has never been converted, or one converted before
// this grant existed. A setup migration calls this before anything else it
// does, so its own subsequent hook-gated reads and writes find the grant
// already there whether the field predates the permissions object entirely,
// was converted by an earlier server version that had no such grant, or
// already carries this one -- each of the three is a no-op past this point.
//
// Confined to the names groupName's migration seeds (SystemOwnedFieldGrant
// returns nil for anything else), so a custom field sharing the group with a
// builtin one -- session_attributes accepts admin-created fields through the
// generic v3 API -- is never touched.
func (ps *PropertyService) ConvertSystemOwnedFields(rctx request.CTX, groupID, groupName string) error {
	fields, err := ps.searchPropertyFields(groupID, model.PropertyFieldSearchOpts{PerPage: propertyPermissionsBackfillPageSize})
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

		changed := false
		if field.Permissions == nil {
			field.Permissions = model.PermissionsFromLegacy(field, model.LegacyConversionOpts{ConvertAttrs: convertAttrs})
			changed = true
		}
		if field.Permissions.MatchingGrant(grant.Type, grant.ID, "", model.PropertyActionFieldWrite) == nil {
			field.Permissions.Grants = append(field.Permissions.Grants, *grant)
			changed = true
		}
		if changed {
			toUpdate = append(toUpdate, field)
		}
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

			if opts.ConvertAttrs && template.Masking == nil && field.GetAccessMode() == model.PropertyAccessModeSharedOnly {
				// PermissionsFromLegacy narrows this field's own reads to none
				// below rather than emitting a masking object it is not allowed
				// to carry (divergence: a linked field may not declare masking of
				// its own). That is a real access change an operator needs to
				// know about, unlike every other conversion here, which is like
				// for like.
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
		fields, searchErr := ps.searchPropertyFields("", model.PropertyFieldSearchOpts{
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

	template, err := b.service.getPropertyField(groupID, templateID)
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
		b.warnIfMaskedTemplateHasNonUserSiblings(rctx, template)
	}

	return permissions, nil
}

// warnIfMaskedTemplateHasNonUserSiblings logs once when template converts to
// masked and a field linked to it is not object_type: user. Such a field
// shows nobody anything, before this conversion and after it, until an
// operator sets the template's mask_by_field_id -- the conversion cannot pick
// that field itself (§2.6 forbids inferring it), so this line is the only
// thing that tells an operator the scheme is waiting on them.
func (b *permissionsBackfill) warnIfMaskedTemplateHasNonUserSiblings(rctx request.CTX, template *model.PropertyField) {
	linked, err := b.service.fieldStore.GetLinkedFields([]string{template.ID}, nil)
	if err != nil {
		rctx.Logger().Warn("Failed to check a masked template's linked fields for non-user object types",
			mlog.String("template_id", template.ID),
			mlog.Err(err),
		)
		return
	}

	var nonUserFieldIDs []string
	for _, field := range linked {
		if field.ObjectType != model.PropertyFieldObjectTypeUser {
			nonUserFieldIDs = append(nonUserFieldIDs, field.ID)
		}
	}
	if len(nonUserFieldIDs) == 0 {
		return
	}

	rctx.Logger().Warn("A masked template has fields linked to it that are not object_type user; those fields show nobody anything until the template's mask_by_field_id is set",
		mlog.String("template_id", template.ID),
		mlog.String("template_name", template.Name),
		mlog.Array("non_user_field_ids", nonUserFieldIDs),
	)
}
