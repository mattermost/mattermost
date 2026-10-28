// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"
	"strings"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func listingWhere(opts model.GlobalAttributeListingOpts) sq.Sqlizer {
	where := sq.And{
		sq.Eq{"GroupID": opts.GroupID},
		sq.Eq{"DeleteAt": 0},
		sq.Eq{"TargetType": string(model.PropertyFieldTargetLevelSystem)},
		sq.Or{
			sq.Eq{"ObjectType": model.PropertyFieldObjectTypeTemplate},
			sq.And{
				sq.Eq{"ObjectType": opts.AllowedResourceTypes},
				sq.Or{sq.Eq{"LinkedFieldID": nil}, sq.Eq{"LinkedFieldID": ""}},
			},
		},
	}

	if len(opts.ExcludeIDs) > 0 {
		where = append(where, sq.NotEq{"ID": opts.ExcludeIDs})
	}

	if opts.Term != "" {
		pattern := "%" + sanitizeSearchTerm(opts.Term, "*") + "%"
		where = append(where, sq.Or{
			sq.Expr("LOWER(Attrs->>?) LIKE LOWER(?) ESCAPE '*'", model.PropertyFieldAttrDisplayName, pattern),
			sq.Expr("LOWER(Name) LIKE LOWER(?) ESCAPE '*'", pattern),
		})
	}

	return where
}

// SearchGlobalAttributeListing returns the Global Attributes listing rows
// matching the term: every live system-level template in the group plus the live
// system-level fields of an allowed resource type that link to no template.
func (s *SqlPropertyFieldStore) SearchGlobalAttributeListing(rctx request.CTX, opts model.GlobalAttributeListingOpts) ([]*model.PropertyField, error) {
	if err := opts.IsValid(); err != nil {
		return nil, fmt.Errorf("opts is invalid: %w", err)
	}

	db := s.DBXFromContext(rctx.Context())
	builder := s.tableSelectQuery.
		Where(listingWhere(opts)).
		OrderByClause("LOWER(COALESCE(NULLIF(Attrs->>?, ''), Name)) ASC, ID ASC", model.PropertyFieldAttrDisplayName)

	fields := []*model.PropertyField{}
	if err := db.SelectBuilder(&fields, builder); err != nil {
		return nil, errors.Wrap(err, "property_field_search_global_attribute_listing_query")
	}

	if err := s.hydratePropertyFieldOptions(db, fields); err != nil {
		return nil, errors.Wrap(err, "property_field_search_global_attribute_listing_hydrate_options")
	}

	return fields, nil
}

// GetLiveLinkedFieldsByObjectTypes returns the live fields of the given object
// types that link to any of the given fields. Unlike GetLinkedFields it reads
// the replica and leaves option sets unhydrated, since a read-only listing needs
// only each linked field's object type and Attrs.
func (s *SqlPropertyFieldStore) GetLiveLinkedFieldsByObjectTypes(fieldIDs, objectTypes []string) ([]*model.PropertyField, error) {
	if len(fieldIDs) == 0 || len(objectTypes) == 0 {
		return []*model.PropertyField{}, nil
	}

	builder := s.tableSelectQuery.
		Where(sq.Eq{"LinkedFieldID": fieldIDs}).
		Where(sq.Eq{"ObjectType": objectTypes}).
		Where(sq.Eq{"DeleteAt": 0})

	fields := []*model.PropertyField{}
	if err := s.GetReplica().SelectBuilder(&fields, builder); err != nil {
		return nil, errors.Wrap(err, "property_field_get_live_linked_fields_by_object_types")
	}
	return fields, nil
}

// GetLiveUserFieldsByNames returns the live system-level user fields in the
// group whose name matches one of the given names, ignoring case.
func (s *SqlPropertyFieldStore) GetLiveUserFieldsByNames(groupID string, names []string) ([]*model.PropertyField, error) {
	if len(names) == 0 {
		return []*model.PropertyField{}, nil
	}

	lowered := make([]string, len(names))
	for i, name := range names {
		lowered[i] = strings.ToLower(name)
	}

	builder := s.tableSelectQuery.
		Where(sq.Eq{"GroupID": groupID}).
		Where(sq.Eq{"ObjectType": model.PropertyFieldObjectTypeUser}).
		Where(sq.Eq{"TargetType": string(model.PropertyFieldTargetLevelSystem)}).
		Where(sq.Eq{"DeleteAt": 0}).
		Where(sq.Eq{"LOWER(Name)": lowered})

	db := s.GetReplica()
	fields := []*model.PropertyField{}
	if err := db.SelectBuilder(&fields, builder); err != nil {
		return nil, errors.Wrap(err, "property_field_get_live_user_fields_by_names")
	}
	if err := s.hydratePropertyFieldOptions(db, fields); err != nil {
		return nil, errors.Wrap(err, "property_field_get_live_user_fields_by_names_hydrate_options")
	}
	return fields, nil
}
