// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"slices"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// The options of a graph field form a hierarchy: each PropertyOptionEdges row
// says that one option sits directly below another. Two rules hold everything
// here together, and every query below assumes both:
//
//  1. An edge never crosses fields. Both endpoints are options owned by the
//     field named in the edge's FieldID, so a field's whole hierarchy is the set
//     of rows carrying its ID -- nothing has to be joined to find the rest of it.
//  2. An edge is a link, not an entity. There is no delete marker: removing a
//     parent deletes the row, and deleting an option deletes every edge it
//     appears in, in the same transaction.
//
// The second rule is why nothing here filters edges on the state of their
// endpoints: an option that is gone has no edges left to find.

var propertyOptionEdgeColumns = []string{"FieldID", "ChildOptionID", "ParentOptionID", "CreateAt"}

// maxOptionIDsPerQuery bounds how many option identifiers one statement carries.
//
// Postgres accepts at most 65,535 bind parameters per statement -- the wire
// protocol counts them in an int16 -- and exceeding it is a hard failure, not a
// slow query: `pq: got 65536 parameters but PostgreSQL only supports 65535
// parameters`. A field may hold far more options than that, so a query given one
// parameter per option of a large field cannot execute at all. The queries below
// that can be handed an unbounded number of identifiers batch them instead.
//
// The batch is well under the ceiling because those statements carry other
// parameters too, and because a statement with tens of thousands of parameters is
// worth avoiding on its own account.
const maxOptionIDsPerQuery = 10000

// bumpFieldForOptionChange marks a field as changed because something about its
// options changed, and refuses to do so if the row no longer carries the UpdateAt
// the caller read.
//
// UpdateAt is moved to at least one past what the row held rather than simply to
// the current time. Two changes in the same millisecond would otherwise both
// swap successfully -- the second would compare against a value the first had
// rewritten to the same number -- and each having been checked against a
// hierarchy without the other is exactly the case the swap exists to refuse. The
// value stays a timestamp that only moves forwards, which is all the clients
// paging on it need.
func (s *SqlPropertyFieldStore) bumpFieldForOptionChange(transaction *sqlxTxWrapper, groupID, fieldID string, expectedUpdateAt int64) error {
	builder := s.getQueryBuilder().
		Update("PropertyFields").
		Set("UpdateAt", sq.Expr("GREATEST(?, UpdateAt + 1)", model.GetMillis())).
		Where(sq.Eq{"ID": fieldID})

	if groupID != "" {
		builder = builder.Where(sq.Eq{"GroupID": groupID})
	}

	if expectedUpdateAt != 0 {
		builder = builder.Where(sq.Eq{"UpdateAt": expectedUpdateAt})
	}

	result, err := transaction.ExecBuilder(builder)
	if err != nil {
		return errors.Wrap(err, "property_option_edges_bump_field_exec")
	}
	count, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "property_option_edges_bump_field_rowsaffected")
	}
	if count == 0 {
		if expectedUpdateAt != 0 {
			return store.NewErrConflict("PropertyField", nil, "concurrent modification detected; retry the change")
		}
		return store.NewErrNotFound("PropertyField", fieldID)
	}
	return nil
}

// GetOptionEdges loads a field's whole hierarchy.
//
// Reads from the master, like GetExistingOptionIDs: the reason to want a whole
// hierarchy is to work out what a mutation would do to it, and replication lag
// would answer that from a version of the graph that no longer exists.
func (s *SqlPropertyFieldStore) GetOptionEdges(fieldID string) ([]*model.PropertyOptionEdge, error) {
	builder := s.getQueryBuilder().
		Select(propertyOptionEdgeColumns...).
		From("PropertyOptionEdges").
		Where(sq.Eq{"FieldID": fieldID})

	edges := []*model.PropertyOptionEdge{}
	if err := s.GetMaster().SelectBuilder(&edges, builder); err != nil {
		return nil, errors.Wrap(err, "property_option_edges_select_query")
	}
	return edges, nil
}

// GetOptionChildEdges returns every edge whose parent is one of the given
// options. An option that appears as a parent has options below it, so an empty
// result is what makes the listed options leaves.
//
// It takes a set of options and returns edges rather than answering yes or no
// per option, because the question is asked of a set: removing a whole subtree
// is legitimate even though every option in it above the lowest has children, so
// what matters is whether each reported child is itself in the set. Served by
// idx_propertyoptionedges_fieldid_parent_child.
//
// Scoped to the field it is given, not to the field that owns the hierarchy. That
// is the point of it: the question is about the rows this field may delete.
// GetOptionChildren is the same step taken for the other reason -- to walk the
// hierarchy a field serves, wherever it is owned.
//
// It batches, like its mirror GetOptionParentEdges: a caller deleting a branch of
// a hierarchy holds as many options as the branch has (see maxOptionIDsPerQuery).
func (s *SqlPropertyFieldStore) GetOptionChildEdges(fieldID string, parentOptionIDs []string) ([]*model.PropertyOptionEdge, error) {
	if len(parentOptionIDs) == 0 {
		return nil, nil
	}

	edges := []*model.PropertyOptionEdge{}
	for batch := range slices.Chunk(parentOptionIDs, maxOptionIDsPerQuery) {
		builder := s.getQueryBuilder().
			Select(propertyOptionEdgeColumns...).
			From("PropertyOptionEdges").
			Where(sq.Eq{"FieldID": fieldID}).
			Where(sq.Eq{"ParentOptionID": batch})

		found := []*model.PropertyOptionEdge{}
		if err := s.GetMaster().SelectBuilder(&found, builder); err != nil {
			return nil, errors.Wrap(err, "property_option_child_edges_select_query")
		}
		edges = append(edges, found...)
	}
	return edges, nil
}

// GetOptionParentEdges returns every edge whose child is one of the given
// options: the parents each of them currently has. The mirror of
// GetOptionChildEdges, and scoped the same way -- to the field it is given rather
// than to the field that owns the hierarchy -- because its caller is deciding
// what may become of that field's own rows.
//
// Served by the primary key, which leads with FieldID and ChildOptionID. It
// batches, like the walks below: a caller may hold as many options as a whole
// change touches (see maxOptionIDsPerQuery).
func (s *SqlPropertyFieldStore) GetOptionParentEdges(fieldID string, childOptionIDs []string) ([]*model.PropertyOptionEdge, error) {
	return s.optionParentEdges(s.GetMaster(), fieldID, childOptionIDs)
}

// optionParentEdges is GetOptionParentEdges against a given connection. The
// caller picks the connection because it is the one that knows whether the
// answer has to include its own uncommitted work (applyOptionParentLinks, inside
// the transaction it is about to write in), has to match the master
// (GetOptionsByID), or may lag (GetFieldOptions, reading a page from a
// replica).
func (s *SqlPropertyFieldStore) optionParentEdges(db sqlxExecutor, fieldID string, childOptionIDs []string) ([]*model.PropertyOptionEdge, error) {
	if len(childOptionIDs) == 0 {
		return nil, nil
	}

	edges := []*model.PropertyOptionEdge{}
	for batch := range slices.Chunk(childOptionIDs, maxOptionIDsPerQuery) {
		builder := s.getQueryBuilder().
			Select(propertyOptionEdgeColumns...).
			From("PropertyOptionEdges").
			Where(sq.Eq{"FieldID": fieldID}).
			Where(sq.Eq{"ChildOptionID": batch})

		found := []*model.PropertyOptionEdge{}
		if err := db.SelectBuilder(&found, builder); err != nil {
			return nil, errors.Wrap(err, "property_option_parent_edges_select_query")
		}
		edges = append(edges, found...)
	}
	return edges, nil
}

// CountOptionEdges returns how many parent links a field's hierarchy is made of.
// A count rather than the rows: its caller checks the total against a limit, and
// a hierarchy at that limit is a million rows to load in order to count them.
func (s *SqlPropertyFieldStore) CountOptionEdges(fieldID string) (int, error) {
	builder := s.getQueryBuilder().
		Select("COUNT(*)").
		From("PropertyOptionEdges").
		Where(sq.Eq{"FieldID": fieldID})

	var count int
	if err := s.GetMaster().GetBuilder(&count, builder); err != nil {
		return 0, errors.Wrap(err, "property_option_edges_count_query")
	}
	return count, nil
}

// GetOptionAncestorsOrSelf returns, for each of the given options, that option
// together with every option above it: its parents, their parents, and so on.
// GetOptionDescendantsOrSelf is the same question downwards.
//
// Both are keyed by the option asked about rather than returning one merged set,
// because the callers ask about a set of options at once -- masking one object's
// values, deciding one policy -- and a per-option answer is what those questions
// need. Seeding one walk with the whole set costs no more than seeding it with a
// single option.
//
// An option with nothing above it maps to just itself, and an option that is not
// a live option of the field is **absent from the result** rather than present
// and empty. Callers can tell those apart, and every question asked about an
// absent option is answered "no".
func (s *SqlPropertyFieldStore) GetOptionAncestorsOrSelf(field *model.PropertyField, optionIDs []string) (map[string][]string, error) {
	return s.walkOptionHierarchy(field, optionIDs, towardsParents)
}

func (s *SqlPropertyFieldStore) GetOptionDescendantsOrSelf(field *model.PropertyField, optionIDs []string) (map[string][]string, error) {
	return s.walkOptionHierarchy(field, optionIDs, towardsChildren)
}

// hierarchyDirection is the way a walk moves through the edges. A walk matches
// the option it is standing on against one endpoint column and steps to the
// other, so walking up and walking down are one query with the columns swapped.
type hierarchyDirection struct {
	standingOn string
	stepTo     string
}

var (
	towardsParents  = hierarchyDirection{standingOn: "ChildOptionID", stepTo: "ParentOptionID"}
	towardsChildren = hierarchyDirection{standingOn: "ParentOptionID", stepTo: "ChildOptionID"}
)

// walkOptionHierarchy follows the edges from each of the given options as far as
// they go in one direction, and reports which options each one reached.
//
// Three things about the query are load-bearing, and none of them are visible
// from reading it:
//
//  1. It is scoped to the field that owns the hierarchy -- for a linked field its
//     template, see graphOptionOwnerID -- and to that field alone. Option IDs are
//     unique within a field and not across fields, so an unscoped walk steps into
//     another field's hierarchy the moment two fields use the same identifier,
//     which the unlink takeover deliberately makes them do.
//
//  2. The seeds come from PropertyOptions rather than straight from the given
//     IDs, so an ID naming nothing live reaches nothing. The seeds are the only
//     place a deleted option could enter a walk: every edge touching an option is
//     deleted with it, so no step can land on one, and the recursive term needs
//     no join to PropertyOptions to keep them out.
//
//  3. UNION, not UNION ALL. UNION drops a row the walk has already produced, so
//     the walk enumerates the options each seed reaches; UNION ALL would
//     enumerate the paths to them, and where paths recombine there are
//     combinatorially many. On a grid of 121 options and 220 edges -- the shape
//     an overlay dimension produces, every option gaining a second parent -- one
//     seed reaches 121 options along 705,431 distinct paths. That dedup is also
//     what stops the walk if the edges ever do form a cycle: the options in it
//     are produced once and then repeat, so the walk ends instead of running
//     forever, though what it reports of a cyclic hierarchy is not meaningful.
//     For the same reason nothing may be added to the recursive term that varies
//     along a path -- a depth counter is the tempting one -- because the dedup
//     compares whole rows, and an option reached at two depths would become two
//     rows and bring the explosion back. SeedID is safe precisely because it does
//     not vary: it is carried unchanged from the seed to every option reached.
//
// Reads from the master, like every other query in this file. A walk decides
// either what a mutation may do to a hierarchy or whether somebody may see
// something, and replication lag would answer both from a hierarchy that is no
// longer there.
func (s *SqlPropertyFieldStore) walkOptionHierarchy(field *model.PropertyField, optionIDs []string, direction hierarchyDirection) (map[string][]string, error) {
	if field == nil || len(optionIDs) == 0 {
		return nil, nil
	}
	ownerID := graphOptionOwnerID(field)

	step := fmt.Sprintf(
		`SELECT walk.SeedID, edge.%s
		FROM PropertyOptionEdges edge
		JOIN hierarchy walk ON walk.OptionID = edge.%s
		WHERE edge.FieldID = ?`,
		direction.stepTo, direction.standingOn)

	type reached struct {
		SeedID   string
		OptionID string
	}

	// One statement per batch of seeds. Seeds are independent of each other -- what
	// one reaches does not depend on what another was asked about -- so the results
	// merge by concatenation.
	resolved := map[string][]string{}
	for batch := range slices.Chunk(optionIDs, maxOptionIDsPerQuery) {
		seeds := s.getSubQueryBuilder().
			Select("opt.ID", "opt.ID").
			From("PropertyOptions opt").
			Where(sq.Eq{"opt.FieldID": ownerID}).
			Where(sq.Eq{"opt.ID": batch}).
			Where(sq.Eq{"opt.DeleteAt": 0})

		builder := s.getQueryBuilder().
			Select("SeedID", "OptionID").
			From("hierarchy").
			Prefix("WITH RECURSIVE hierarchy (SeedID, OptionID) AS (? UNION "+step+")", seeds, ownerID)

		rows := []*reached{}
		if err := s.GetMaster().SelectBuilder(&rows, builder); err != nil {
			return nil, errors.Wrap(err, "property_option_hierarchy_select_query")
		}
		for _, row := range rows {
			resolved[row.SeedID] = append(resolved[row.SeedID], row.OptionID)
		}
	}
	return resolved, nil
}

// GetOptionChildren returns the options directly below each of the given ones,
// in the hierarchy the field exposes -- the template's when the field links to
// one. An option with nothing below it is absent from the result.
//
// This is one step, not the whole subtree below: a caller descending a hierarchy
// with a reason to stop early asks for a level at a time, and asking for the
// subtree instead would load the part it was going to stop before. Use
// GetOptionDescendantsOrSelf when the whole subtree is what is wanted.
//
// Not to be confused with GetOptionChildEdges, which asks the ownership
// question -- are these options leaves among the rows this field owns -- and so
// stays on the field it was given rather than following it to its template.
//
// Unlike the other queries here it is asked about however many options a caller
// has in hand, which can be a whole level of a hierarchy rather than one object's
// values, so it batches (see maxOptionIDsPerQuery).
func (s *SqlPropertyFieldStore) GetOptionChildren(field *model.PropertyField, optionIDs []string) (map[string][]string, error) {
	if field == nil || len(optionIDs) == 0 {
		return nil, nil
	}

	type link struct {
		ParentOptionID string
		ChildOptionID  string
	}

	children := map[string][]string{}
	for batch := range slices.Chunk(optionIDs, maxOptionIDsPerQuery) {
		builder := s.getQueryBuilder().
			Select("ParentOptionID", "ChildOptionID").
			From("PropertyOptionEdges").
			Where(sq.Eq{"FieldID": graphOptionOwnerID(field)}).
			Where(sq.Eq{"ParentOptionID": batch})

		rows := []*link{}
		if err := s.GetMaster().SelectBuilder(&rows, builder); err != nil {
			return nil, errors.Wrap(err, "property_option_children_select_query")
		}
		for _, row := range rows {
			children[row.ParentOptionID] = append(children[row.ParentOptionID], row.ChildOptionID)
		}
	}
	return children, nil
}

// requireLiveGraphField checks that fieldID names a field that still exists and
// whose options form a hierarchy at all.
func (s *SqlPropertyFieldStore) requireLiveGraphField(db sqlxExecutor, fieldID string) error {
	builder := s.getQueryBuilder().
		Select("Type").
		From("PropertyFields").
		Where(sq.Eq{"ID": fieldID}).
		Where(sq.Eq{"DeleteAt": 0})

	var fieldType model.PropertyFieldType
	if err := db.GetBuilder(&fieldType, builder); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.NewErrNotFound("PropertyField", fieldID)
		}
		return errors.Wrap(err, "property_option_edges_field_type_query")
	}

	if fieldType != model.PropertyFieldTypeGraph {
		return store.NewErrInvalidInput("PropertyOptionEdge", "field_id", fieldID).
			Wrap(errors.Errorf("options of a %s field have no hierarchy to link", fieldType))
	}

	return nil
}

// requireOwnedOptions checks that every one of the given options is a live option
// the field owns itself. It runs after any options the same change creates have
// been written, so a change may put a brand-new option under a parent.
func (s *SqlPropertyFieldStore) requireOwnedOptions(db sqlxExecutor, fieldID string, optionIDs []string) error {
	if len(optionIDs) == 0 {
		return nil
	}

	// The field's own options, not its effective set: an option it inherits from
	// a link source is the template's, and so are that option's parents.
	existing, err := s.getExistingOptionIDs(db, []string{fieldID}, optionIDs)
	if err != nil {
		return err
	}
	existingSet := make(map[string]bool, len(existing))
	for _, id := range existing {
		existingSet[id] = true
	}

	for _, optionID := range optionIDs {
		if !existingSet[optionID] {
			return store.NewErrInvalidInput("PropertyOptionEdge", "option_id", optionID).
				Wrap(errors.Errorf("field %s has no live option %s of its own", fieldID, optionID))
		}
	}

	return nil
}

// deletePropertyOptionEdgesForOptions removes every edge touching one of the
// given options, in either direction. It runs wherever an option is deleted: the
// option is not part of the hierarchy any more, so neither are its links, and
// there is no delete marker on an edge to record that with.
//
// Both directions are indexed -- the primary key covers the child side and
// idx_propertyoptionedges_fieldid_parent_child the parent side.
func (s *SqlPropertyFieldStore) deletePropertyOptionEdgesForOptions(transaction *sqlxTxWrapper, fieldID string, optionIDs []string) error {
	if len(optionIDs) == 0 {
		return nil
	}

	// Each option ID is bound twice (child and parent) plus FieldID once, so the
	// chunk has to stay under half of maxOptionIDsPerQuery.
	chunkSize := (maxOptionIDsPerQuery - 1) / 2
	for batch := range slices.Chunk(optionIDs, chunkSize) {
		builder := s.getQueryBuilder().
			Delete("PropertyOptionEdges").
			Where(sq.Eq{"FieldID": fieldID}).
			Where(sq.Or{
				sq.Eq{"ChildOptionID": batch},
				sq.Eq{"ParentOptionID": batch},
			})

		if _, err := transaction.ExecBuilder(builder); err != nil {
			return errors.Wrap(err, "property_option_edges_delete_for_options_exec")
		}
	}
	return nil
}

// takeOverLinkSourceOptionEdges copies the hierarchy of the options a field has
// just taken over from its link source, and runs immediately after
// takeOverLinkSourceOptions for the same field.
//
// Without it a graph field that stops linking keeps every option and loses every
// relationship between them, leaving a flat list of roots -- a shape that is
// structurally valid and semantically wrong, and that an access rule reads as
// "this option covers nothing but itself". It would start denying access with no
// visible cause.
//
// Only edges both of whose endpoints the field now owns are copied, which keeps
// every edge within one field. A field of any other type has no edges to copy,
// so this is a no-op for it.
func (s *SqlPropertyFieldStore) takeOverLinkSourceOptionEdges(transaction *sqlxTxWrapper, field *model.PropertyField, sourceID string) error {
	// CreateAt is carried over rather than restamped: the copy stands for the
	// same relationship, made when the template recorded it.
	const query = `INSERT INTO PropertyOptionEdges
		(FieldID, ChildOptionID, ParentOptionID, CreateAt)
		SELECT ?, edge.ChildOptionID, edge.ParentOptionID, edge.CreateAt
		FROM PropertyOptionEdges edge
		WHERE edge.FieldID = ?
		  AND EXISTS (SELECT 1 FROM PropertyOptions own WHERE own.FieldID = ? AND own.ID = edge.ChildOptionID AND own.DeleteAt = 0)
		  AND EXISTS (SELECT 1 FROM PropertyOptions own WHERE own.FieldID = ? AND own.ID = edge.ParentOptionID AND own.DeleteAt = 0)
		ON CONFLICT (FieldID, ChildOptionID, ParentOptionID) DO NOTHING`

	if _, err := transaction.Exec(query, field.ID, sourceID, field.ID, field.ID); err != nil {
		return errors.Wrap(err, "property_option_edges_take_over_exec")
	}
	return nil
}
