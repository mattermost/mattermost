// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"errors"
	"fmt"
	"math"
	"slices"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// classificationTemplateName is the name of the Classification Markings
// template in the access_control group. The template is told apart from an
// ordinary attribute of the same name by its type as well.
const classificationTemplateName = "classification"

// GlobalAttributeListingPolicy is what the caller's licence and configuration
// allow the Global Attributes listing to show. The service holds neither, so the
// app layer decides and passes the outcome in.
type GlobalAttributeListingPolicy struct {
	// AllowedResourceTypes are the resource types that may appear in a row, in
	// its applies_to, or as a filter. Order is irrelevant.
	AllowedResourceTypes []string

	// ClassificationReachable reports whether the Classification Markings page
	// is reachable. When it is not, the Classification template is not listed.
	ClassificationReachable bool
}

// SearchGlobalAttributeListing returns one page of the Global Attributes
// listing for the access_control group: the rows matching the search, each
// composed with the values the table derives from its linked fields, and the
// number of matching rows across all pages.
//
// Rows are composed from the stored fields, as the generic property endpoints
// return them, so owners and sync sources agree with what a GET of the same field
// shows. A plugin owner present only as a grant of the field's permissions
// object, with no entry in its stored owners attr, is not seen by the source
// filter, which reads the stored attrs in SQL.
func (ps *PropertyService) SearchGlobalAttributeListing(rctx request.CTX, groupID string, search model.GlobalAttributeListingSearch, policy GlobalAttributeListingPolicy) (*model.GlobalAttributeListing, error) {
	if err := search.IsValid(); err != nil {
		return nil, fmt.Errorf("SearchGlobalAttributeListing: %w", err)
	}

	classificationID, err := ps.classificationTemplateID(rctx, groupID)
	if err != nil {
		return nil, fmt.Errorf("SearchGlobalAttributeListing: %w", err)
	}

	opts := model.GlobalAttributeListingOpts{
		GroupID:              groupID,
		Term:                 search.Term,
		Source:               search.Source,
		ResourceType:         search.ResourceType,
		AllowedResourceTypes: policy.AllowedResourceTypes,
		Offset:               listingOffset(search.Page, search.PerPage),
		Limit:                search.PerPage,
	}
	if classificationID != "" && !policy.ClassificationReachable {
		opts.ExcludeIDs = []string{classificationID}
	}

	fields, total, err := ps.fieldStore.SearchGlobalAttributeListing(rctx, opts)
	if err != nil {
		return nil, fmt.Errorf("SearchGlobalAttributeListing: %w", err)
	}

	listing := &model.GlobalAttributeListing{
		Rows:       make([]*model.GlobalAttributeListingRow, 0, len(fields)),
		TotalCount: total,
	}
	if len(fields) == 0 {
		return listing, nil
	}

	linkedByTemplate, err := ps.liveLinkedFieldsByTemplate(fields, policy.AllowedResourceTypes)
	if err != nil {
		return nil, fmt.Errorf("SearchGlobalAttributeListing: %w", err)
	}

	conflicts, err := ps.nameConflicts(rctx, groupID, fields)
	if err != nil {
		return nil, fmt.Errorf("SearchGlobalAttributeListing: %w", err)
	}

	for _, field := range fields {
		row := &model.GlobalAttributeListingRow{
			Field:            field,
			AppliesTo:        listingAppliesTo(field, linkedByTemplate[field.ID]),
			Owners:           listingOwners(field, linkedByTemplate[field.ID]),
			SourceKind:       listingSourceKind(field),
			SyncSources:      listingSyncSources(field),
			IsClassification: classificationID != "" && field.ID == classificationID,
			NameConflict:     conflicts[field.ID],
		}
		listing.Rows = append(listing.Rows, row)
	}

	if err := ps.applyListingReadHooks(rctx, listing); err != nil {
		return nil, fmt.Errorf("SearchGlobalAttributeListing: %w", err)
	}

	return listing, nil
}

// listingOffset is the row offset of a page, saturating rather than wrapping
// for a page number too large to multiply.
func listingOffset(page, perPage int) int {
	if page > math.MaxInt/perPage {
		return math.MaxInt
	}
	return page * perPage
}

// classificationTemplateID returns the ID of the Classification Markings
// template, or "" when the group has none.
func (ps *PropertyService) classificationTemplateID(rctx request.CTX, groupID string) (string, error) {
	field, err := ps.fieldStore.GetFieldByNameForObjectType(rctx, groupID, "", model.PropertyFieldObjectTypeTemplate, classificationTemplateName)
	if err != nil {
		if _, ok := errors.AsType[*store.ErrNotFound](err); ok {
			return "", nil
		}
		return "", fmt.Errorf("failed to look up the classification template: %w", err)
	}
	if field.Type != model.PropertyFieldTypeRank {
		return "", nil
	}
	return field.ID, nil
}

// liveLinkedFieldsByTemplate groups the live fields of an allowed resource type
// that link to each template among fields, keyed by template ID.
func (ps *PropertyService) liveLinkedFieldsByTemplate(fields []*model.PropertyField, allowedResourceTypes []string) (map[string][]*model.PropertyField, error) {
	var templateIDs []string
	for _, field := range fields {
		if field.ObjectType == model.PropertyFieldObjectTypeTemplate {
			templateIDs = append(templateIDs, field.ID)
		}
	}

	linked, err := ps.fieldStore.GetLiveLinkedFieldsByObjectTypes(templateIDs, allowedResourceTypes)
	if err != nil {
		return nil, fmt.Errorf("failed to get the fields linked to the templates: %w", err)
	}

	byTemplate := make(map[string][]*model.PropertyField, len(templateIDs))
	for _, field := range linked {
		if field.LinkedFieldID == nil {
			continue
		}
		byTemplate[*field.LinkedFieldID] = append(byTemplate[*field.LinkedFieldID], field)
	}
	return byTemplate, nil
}

// listingAppliesTo lists the resource types a row applies to, in the fixed
// order user, channel, post: the object types of a template's live linked
// fields, or the row's own object type for any other row.
func listingAppliesTo(field *model.PropertyField, linked []*model.PropertyField) []string {
	if field.ObjectType != model.PropertyFieldObjectTypeTemplate {
		return []string{field.ObjectType}
	}

	present := make(map[string]bool, len(linked))
	for _, linkedField := range linked {
		present[linkedField.ObjectType] = true
	}

	appliesTo := []string{}
	for _, resourceType := range []string{
		model.PropertyFieldObjectTypeUser,
		model.PropertyFieldObjectTypeChannel,
		model.PropertyFieldObjectTypePost,
	} {
		if present[resourceType] {
			appliesTo = append(appliesTo, resourceType)
		}
	}
	return appliesTo
}

// listingOwners reads a row's owners from the field that carries them: a user
// field's own attrs, or for a template the live user field linked to it. Rows
// of any other object type have none.
func listingOwners(field *model.PropertyField, linked []*model.PropertyField) []model.PropertyOwner {
	var owners []model.PropertyOwner
	switch field.ObjectType {
	case model.PropertyFieldObjectTypeUser:
		owners = model.GetPropertyFieldOwners(field)
	case model.PropertyFieldObjectTypeTemplate:
		for _, linkedField := range linked {
			if linkedField.ObjectType != model.PropertyFieldObjectTypeUser {
				continue
			}
			if owners = model.GetPropertyFieldOwners(linkedField); len(owners) > 0 {
				break
			}
		}
	}

	if len(owners) == 0 {
		return []model.PropertyOwner{}
	}
	return slices.Clone(owners)
}

// listingSourceKind classifies where a row's definition comes from, the way the
// Source column does: a plugin-created protected field, a field synced from an
// identity source, or neither. Owners do not change it. The protected column
// counts as well as the attr so the kind agrees with the source filter, which
// reads both.
func listingSourceKind(field *model.PropertyField) string {
	sourcePluginID, _ := field.Attrs[model.PropertyAttrsSourcePluginID].(string)
	if sourcePluginID != "" && (model.IsPropertyFieldProtected(field) || field.Protected) {
		return model.GlobalAttributeSourceKindPlugin
	}
	if model.IsPropertyFieldSynced(field) {
		return model.GlobalAttributeSourceKindExternal
	}
	return model.GlobalAttributeSourceKindManaged
}

func listingSyncSources(field *model.PropertyField) []string {
	sources := model.GetPropertyFieldSyncSources(field)
	if sources == nil {
		return []string{}
	}
	return sources
}

// nameConflicts finds, for each template and user row among fields, the live
// user field that shares its name ignoring case without belonging to it. CEL
// names user fields as user.attributes.<name>, so such a field is read by a
// policy that means the row. Channel and post rows are another namespace and
// never conflict.
func (ps *PropertyService) nameConflicts(rctx request.CTX, groupID string, fields []*model.PropertyField) (map[string]*model.GlobalAttributeNameConflict, error) {
	var names []string
	for _, field := range fields {
		if sharesUserNamespace(field) {
			names = append(names, field.Name)
		}
	}
	if len(names) == 0 {
		return nil, nil
	}

	userFields, err := ps.fieldStore.GetLiveUserFieldsByNames(groupID, names)
	if err != nil {
		return nil, fmt.Errorf("failed to get the user fields sharing a name: %w", err)
	}

	byName := make(map[string][]*model.PropertyField, len(userFields))
	for _, userField := range userFields {
		lowered := strings.ToLower(userField.Name)
		byName[lowered] = append(byName[lowered], userField)
	}

	found := make(map[string]*model.PropertyField, len(fields))
	templateIDs := map[string]struct{}{}
	for _, field := range fields {
		if !sharesUserNamespace(field) {
			continue
		}
		conflicting := conflictingUserField(field, byName[strings.ToLower(field.Name)])
		if conflicting == nil {
			continue
		}
		found[field.ID] = conflicting
		if conflicting.LinkedFieldID != nil && *conflicting.LinkedFieldID != "" {
			templateIDs[*conflicting.LinkedFieldID] = struct{}{}
		}
	}

	templates, err := ps.liveTemplatesByID(rctx, groupID, templateIDs)
	if err != nil {
		return nil, err
	}

	conflicts := make(map[string]*model.GlobalAttributeNameConflict, len(found))
	for rowID, conflicting := range found {
		conflict := &model.GlobalAttributeNameConflict{Field: conflicting}
		if conflicting.LinkedFieldID != nil {
			conflict.OwnerTemplate = templates[*conflicting.LinkedFieldID]
		}
		conflicts[rowID] = conflict
	}
	for _, field := range fields {
		if conflict := conflicts[field.ID]; conflict != nil {
			conflict.Exact = conflict.Field.Name == field.Name
		}
	}
	return conflicts, nil
}

func sharesUserNamespace(field *model.PropertyField) bool {
	return field.ObjectType == model.PropertyFieldObjectTypeTemplate || field.ObjectType == model.PropertyFieldObjectTypeUser
}

// conflictingUserField picks the field of candidates, all sharing the row's name
// ignoring case, that the row conflicts with. The row itself and any field linked
// to it do not count. An exact match wins over a case-only one, since that is the
// one the server's case-sensitive uniqueness check would refuse; ties go to the
// lowest ID so the choice is stable.
func conflictingUserField(row *model.PropertyField, candidates []*model.PropertyField) *model.PropertyField {
	var best *model.PropertyField
	for _, candidate := range candidates {
		if candidate.ID == row.ID || (candidate.LinkedFieldID != nil && *candidate.LinkedFieldID == row.ID) {
			continue
		}
		if best == nil {
			best = candidate
			continue
		}
		candidateExact, bestExact := candidate.Name == row.Name, best.Name == row.Name
		if (candidateExact && !bestExact) || (candidateExact == bestExact && candidate.ID < best.ID) {
			best = candidate
		}
	}
	return best
}

// liveTemplatesByID reads the live templates with the given IDs. A template that
// is gone, whether deleted or removed, is absent from the result rather than an
// error: a live linked field can outlive its template.
func (ps *PropertyService) liveTemplatesByID(rctx request.CTX, groupID string, ids map[string]struct{}) (map[string]*model.PropertyField, error) {
	templates := make(map[string]*model.PropertyField, len(ids))
	if len(ids) == 0 {
		return templates, nil
	}

	idList := make([]string, 0, len(ids))
	for id := range ids {
		idList = append(idList, id)
	}

	found, err := ps.fieldStore.GetMany(rctx, groupID, idList)
	if err != nil {
		if _, ok := errors.AsType[*store.ErrResultsMismatch](err); !ok {
			return nil, fmt.Errorf("failed to get the owning templates: %w", err)
		}

		// At least one is missing, and GetMany does not say which.
		found = found[:0]
		for _, id := range idList {
			template, err := ps.fieldStore.Get(rctx, groupID, id)
			if err != nil {
				if _, ok := errors.AsType[*store.ErrNotFound](err); ok {
					continue
				}
				return nil, fmt.Errorf("failed to get the owning template %s: %w", id, err)
			}
			found = append(found, template)
		}
	}

	for _, template := range found {
		if template.DeleteAt == 0 && template.ObjectType == model.PropertyFieldObjectTypeTemplate {
			templates[template.ID] = template
		}
	}
	return templates, nil
}

// applyListingReadHooks runs the read hooks every field the listing returns
// would pass through on the generic endpoints, so the caller sees the same
// fields, with the same options masking, as a GET of them. The fields are run
// as one batch, once each, and the masked copies are put back in place.
func (ps *PropertyService) applyListingReadHooks(rctx request.CTX, listing *model.GlobalAttributeListing) error {
	var batch []*model.PropertyField
	index := map[string]int{}
	add := func(field *model.PropertyField) {
		if _, ok := index[field.ID]; !ok {
			index[field.ID] = len(batch)
			batch = append(batch, field)
		}
	}
	for _, row := range listing.Rows {
		add(row.Field)
		if row.NameConflict != nil {
			add(row.NameConflict.Field)
			if row.NameConflict.OwnerTemplate != nil {
				add(row.NameConflict.OwnerTemplate)
			}
		}
	}

	batch, err := ps.runPostGetPropertyFields(rctx, batch)
	if err != nil {
		return err
	}

	for _, row := range listing.Rows {
		row.Field = batch[index[row.Field.ID]]
		if row.NameConflict != nil {
			row.NameConflict.Field = batch[index[row.NameConflict.Field.ID]]
			if row.NameConflict.OwnerTemplate != nil {
				row.NameConflict.OwnerTemplate = batch[index[row.NameConflict.OwnerTemplate.ID]]
			}
		}
	}
	return nil
}
