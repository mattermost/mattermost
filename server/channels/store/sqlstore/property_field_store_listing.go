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

// SQL predicates over a field's stored Attrs, mirroring the webapp's
// getSourceKind, getPropertyFieldSyncSources and getFieldOwners. Each is
// wrapped so a missing or mistyped key reads as false rather than NULL, which
// would otherwise drop the row from a negated filter.
const (
	listingPluginSourceSQL = "COALESCE((jsonb_typeof(Attrs->'" + model.PropertyAttrsSourcePluginID + "') = 'string' AND Attrs->>'" + model.PropertyAttrsSourcePluginID + "' <> '' AND (Attrs->'" + model.PropertyAttrsProtected + "' = 'true'::jsonb OR COALESCE(Protected, FALSE))), FALSE)"

	listingDisplayNameSQL = "COALESCE(NULLIF(Attrs->>'" + model.PropertyFieldAttrDisplayName + "', ''), Name)"
)

func listingSyncMappingSQL(source string) string {
	attr := model.PropertySyncSourceAttr(source)
	return "COALESCE((jsonb_typeof(Attrs->'" + attr + "') = 'string' AND Attrs->>'" + attr + "' <> ''), FALSE)"
}

func listingAnyOwnerSQL(alias string) string {
	owners := alias + ".Attrs->'" + model.PropertyAttrsOwners + "'"
	return "COALESCE((jsonb_typeof(" + owners + ") = 'array' AND " + owners + " <> '[]'::jsonb), FALSE)"
}

func listingPluginOwnerSQL(alias string) string {
	return "COALESCE(" + alias + ".Attrs->'" + model.PropertyAttrsOwners + "' @> '[{\"type\":\"" + model.PropertyOwnerTypePlugin + "\"}]'::jsonb, FALSE)"
}

// listingRowOwnerSQL applies an owners predicate to the field that carries a
// row's owners: a user field's own Attrs, or for a template the live user
// field linked to it. Rows of any other object type have no owners.
func listingRowOwnerSQL(ownerPredicate func(alias string) string) string {
	return "CASE" +
		" WHEN ObjectType = '" + model.PropertyFieldObjectTypeUser + "' THEN " + ownerPredicate("PropertyFields") +
		" WHEN ObjectType = '" + model.PropertyFieldObjectTypeTemplate + "' THEN EXISTS (" +
		"SELECT 1 FROM PropertyFields lf WHERE lf.LinkedFieldID = PropertyFields.ID AND lf.DeleteAt = 0 AND lf.ObjectType = '" + model.PropertyFieldObjectTypeUser + "' AND " + ownerPredicate("lf") + ")" +
		" ELSE FALSE END"
}

func listingSourceCondition(source string) sq.Sqlizer {
	pluginSQL := "(" + listingPluginSourceSQL + " OR " + listingRowOwnerSQL(listingPluginOwnerSQL) + ")"

	switch source {
	case model.GlobalAttributeSourcePlugin:
		return sq.Expr(pluginSQL)
	case model.GlobalAttributeSourceManaged:
		clauses := []string{"NOT " + pluginSQL, "NOT " + listingRowOwnerSQL(listingAnyOwnerSQL)}
		for _, syncSource := range model.PropertySyncSources() {
			clauses = append(clauses, "NOT "+listingSyncMappingSQL(syncSource))
		}
		return sq.Expr("(" + strings.Join(clauses, " AND ") + ")")
	default:
		return sq.Expr(listingSyncMappingSQL(source))
	}
}

func listingWhere(opts model.GlobalAttributeListingOpts) sq.Sqlizer {
	where := sq.And{
		sq.Eq{"GroupID": opts.GroupID},
		sq.Eq{"DeleteAt": 0},
		sq.Or{
			sq.Eq{"ObjectType": model.PropertyFieldObjectTypeTemplate},
			sq.And{
				sq.Eq{"ObjectType": opts.AllowedResourceTypes},
				sq.Eq{"TargetType": string(model.PropertyFieldTargetLevelSystem)},
				sq.Expr("COALESCE(LinkedFieldID, '') = ''"),
			},
		},
	}

	if len(opts.ExcludeIDs) > 0 {
		where = append(where, sq.NotEq{"ID": opts.ExcludeIDs})
	}

	if opts.Term != "" {
		pattern := "%" + sanitizeSearchTerm(opts.Term, "*") + "%"
		where = append(where, sq.Expr(
			"(LOWER("+listingDisplayNameSQL+") LIKE LOWER(?) ESCAPE '*' OR LOWER(Name) LIKE LOWER(?) ESCAPE '*')",
			pattern, pattern,
		))
	}

	if opts.ResourceType != "" {
		// A template is a resource type through its live linked fields, anything
		// else through its own object type.
		where = append(where, sq.Or{
			sq.And{
				sq.Eq{"ObjectType": model.PropertyFieldObjectTypeTemplate},
				sq.Expr("EXISTS (SELECT 1 FROM PropertyFields lf WHERE lf.LinkedFieldID = PropertyFields.ID AND lf.DeleteAt = 0 AND lf.ObjectType = ?)", opts.ResourceType),
			},
			sq.And{
				sq.NotEq{"ObjectType": model.PropertyFieldObjectTypeTemplate},
				sq.Eq{"ObjectType": opts.ResourceType},
			},
		})
		// A resource type the caller is not allowed never lists, however the
		// field comes to carry it.
		allowed := false
		for _, resourceType := range opts.AllowedResourceTypes {
			allowed = allowed || resourceType == opts.ResourceType
		}
		if !allowed {
			where = append(where, sq.Expr("1 = 0"))
		}
	}

	if opts.Source != "" {
		where = append(where, listingSourceCondition(opts.Source))
	}

	return where
}

// SearchGlobalAttributeListing returns one page of the Global Attributes listing
// rows and the number of rows matching the filters across all pages. The rows
// are every live template in the group plus the live system-level fields of an
// allowed resource type that link to no template.
func (s *SqlPropertyFieldStore) SearchGlobalAttributeListing(rctx request.CTX, opts model.GlobalAttributeListingOpts) ([]*model.PropertyField, int64, error) {
	if err := opts.IsValid(); err != nil {
		return nil, 0, fmt.Errorf("opts is invalid: %w", err)
	}

	where := listingWhere(opts)
	db := s.DBXFromContext(rctx.Context())

	var total int64
	countBuilder := s.getQueryBuilder().Select("COUNT(*)").From("PropertyFields").Where(where)
	if err := db.GetBuilder(&total, countBuilder); err != nil {
		return nil, 0, errors.Wrap(err, "property_field_search_global_attribute_listing_count")
	}

	fields := []*model.PropertyField{}
	if total > int64(opts.Offset) {
		builder := s.tableSelectQuery.
			Where(where).
			OrderBy("LOWER("+listingDisplayNameSQL+") ASC", "ID ASC").
			Limit(uint64(opts.Limit)).
			Offset(uint64(opts.Offset))
		if err := db.SelectBuilder(&fields, builder); err != nil {
			return nil, 0, errors.Wrap(err, "property_field_search_global_attribute_listing_query")
		}

		if err := s.hydratePropertyFieldOptions(s.GetReplica(), fields); err != nil {
			return nil, 0, errors.Wrap(err, "property_field_search_global_attribute_listing_hydrate_options")
		}
	}

	return fields, total, nil
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

	fields := []*model.PropertyField{}
	if err := s.GetReplica().SelectBuilder(&fields, builder); err != nil {
		return nil, errors.Wrap(err, "property_field_get_live_user_fields_by_names")
	}
	return fields, nil
}
