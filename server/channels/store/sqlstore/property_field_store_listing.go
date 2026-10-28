// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"
	"slices"
	"strings"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// listingTable is a table reference in the listing query. It is the only value
// the predicates below put into SQL text; everything else is a bound
// parameter. Only the two constants exist, and name rejects any other value.
type listingTable int

const (
	// listingRowTable is the listing row itself.
	listingRowTable listingTable = iota
	// listingChildTable is a field linked to a template row, aliased lf.
	listingChildTable
)

func (t listingTable) name() string {
	switch t {
	case listingRowTable:
		return "PropertyFields"
	case listingChildTable:
		return "lf"
	}
	panic(fmt.Sprintf("unknown listing table %d", int(t)))
}

// The predicates below read a field's stored Attrs, mirroring the webapp's
// getSourceKind, getPropertyFieldSyncSources and getFieldOwners. Each ends in
// IS TRUE so a missing or mistyped key reads as false rather than NULL, which
// would otherwise drop the row from a negated filter.

func attrIsNonEmptyString(table listingTable, key string) sq.Sqlizer {
	attrs := table.name() + ".Attrs"
	return sq.Expr("(jsonb_typeof("+attrs+"->?) = 'string' AND "+attrs+"->>? <> '') IS TRUE", key, key)
}

func ownersIsNonEmpty(table listingTable) sq.Sqlizer {
	attrs := table.name() + ".Attrs"
	return sq.Expr("(jsonb_typeof("+attrs+"->?) = 'array' AND "+attrs+"->? <> '[]'::jsonb) IS TRUE",
		model.PropertyAttrsOwners, model.PropertyAttrsOwners)
}

func ownersHasPlugin(table listingTable) sq.Sqlizer {
	return sq.Expr("("+table.name()+".Attrs->? @> ?::jsonb) IS TRUE",
		model.PropertyAttrsOwners, `[{"type":"`+model.PropertyOwnerTypePlugin+`"}]`)
}

// liveLinkedChild matches a template with a live linked field of the given
// object type, optionally also satisfying extra predicates on that field (lf).
func liveLinkedChild(objectType string, extra ...sq.Sqlizer) sq.Sqlizer {
	cond := sq.And{
		sq.Expr("lf.LinkedFieldID = PropertyFields.ID"),
		sq.Expr("lf.GroupID = PropertyFields.GroupID"),
		sq.Eq{"lf.DeleteAt": 0, "lf.ObjectType": objectType},
	}
	return sq.Expr("EXISTS (SELECT 1 FROM PropertyFields lf WHERE ?)", append(cond, extra...))
}

// rowOwners applies an owners predicate to the field that carries a row's
// owners: a user field's own Attrs, or for a template the live user field
// linked to it. Rows of any other object type have no owners.
func rowOwners(predicate func(table listingTable) sq.Sqlizer) sq.Sqlizer {
	return sq.Or{
		sq.And{sq.Eq{"ObjectType": model.PropertyFieldObjectTypeUser}, predicate(listingRowTable)},
		sq.And{sq.Eq{"ObjectType": model.PropertyFieldObjectTypeTemplate}, liveLinkedChild(model.PropertyFieldObjectTypeUser, predicate(listingChildTable))},
	}
}

func listingSourceCondition(source string) sq.Sqlizer {
	pluginSource := sq.And{
		attrIsNonEmptyString(listingRowTable, model.PropertyAttrsSourcePluginID),
		sq.Expr("(Attrs->? = 'true'::jsonb) IS TRUE", model.PropertyAttrsProtected),
	}

	switch source {
	case model.GlobalAttributeSourcePlugin:
		return sq.Or{pluginSource, rowOwners(ownersHasPlugin)}
	case model.GlobalAttributeSourceManaged:
		// Any owner already covers a plugin owner.
		managed := sq.And{
			sq.Expr("NOT (?)", pluginSource),
			sq.Expr("NOT (?)", rowOwners(ownersIsNonEmpty)),
		}
		for _, syncSource := range model.PropertySyncSources() {
			managed = append(managed, sq.Expr("NOT (?)", attrIsNonEmptyString(listingRowTable, model.PropertySyncSourceAttr(syncSource))))
		}
		return managed
	default:
		return attrIsNonEmptyString(listingRowTable, model.PropertySyncSourceAttr(source))
	}
}

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

	if opts.ResourceType != "" {
		// A template is a resource type through its live linked fields, anything
		// else through its own object type.
		where = append(where, sq.Or{
			sq.Eq{"ObjectType": opts.ResourceType},
			sq.And{sq.Eq{"ObjectType": model.PropertyFieldObjectTypeTemplate}, liveLinkedChild(opts.ResourceType)},
		})
	}

	if opts.Source != "" {
		where = append(where, listingSourceCondition(opts.Source))
	}

	return where
}

// SearchGlobalAttributeListing returns the Global Attributes listing rows
// matching the filters: every live system-level template in the group plus the
// live system-level fields of an allowed resource type that link to no template.
func (s *SqlPropertyFieldStore) SearchGlobalAttributeListing(rctx request.CTX, opts model.GlobalAttributeListingOpts) ([]*model.PropertyField, error) {
	if err := opts.IsValid(); err != nil {
		return nil, fmt.Errorf("opts is invalid: %w", err)
	}

	// A resource type the caller is not allowed never lists, however the field
	// comes to carry it.
	if opts.ResourceType != "" && !slices.Contains(opts.AllowedResourceTypes, opts.ResourceType) {
		return []*model.PropertyField{}, nil
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
