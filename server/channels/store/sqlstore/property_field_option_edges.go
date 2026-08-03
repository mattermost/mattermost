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

// CreateOptionEdges records parent links between options of a graph field. An
// edge that already exists is left alone, so a caller asserting an option's
// parents does not have to work out which of them are new.
//
// Two structural invariants are enforced, both of which an edge is meaningless
// without: the edge's field is a live graph field -- no other type's options
// have a hierarchy for an edge to be part of -- and both endpoints are live
// options that field owns itself. An option inherited from a link source
// belongs to the template that owns it, and its parents are recorded there.
//
// Nothing here checks the shape of the resulting graph. Adding an edge can still
// produce a cycle or a hierarchy deeper than anything can usefully walk; those
// are properties of the whole edge set rather than of one row, and no caller
// creates edges yet.
func (s *SqlPropertyFieldStore) CreateOptionEdges(edges []*model.PropertyOptionEdge) (err error) {
	if len(edges) == 0 {
		return nil
	}

	// fieldOrder keeps the fields in the order they first appear in the payload,
	// so which failure a caller is told about does not depend on map iteration
	// order: the error names the earliest offending edge, run after run.
	var fieldOrder []string
	endpointsByField := map[string][]string{}
	for i, edge := range edges {
		if vErr := edge.IsValid(); vErr != nil {
			return store.NewErrInvalidInput("PropertyOptionEdge", fmt.Sprintf("edges[%d]", i), vErr.Error()).Wrap(vErr)
		}
		if _, seen := endpointsByField[edge.FieldID]; !seen {
			fieldOrder = append(fieldOrder, edge.FieldID)
		}
		for _, endpoint := range []string{edge.ChildOptionID, edge.ParentOptionID} {
			if !slices.Contains(endpointsByField[edge.FieldID], endpoint) {
				endpointsByField[edge.FieldID] = append(endpointsByField[edge.FieldID], endpoint)
			}
		}
	}

	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return errors.Wrap(err, "property_option_edges_create_begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	for _, fieldID := range fieldOrder {
		if err = s.requireOwnedGraphOptions(transaction, fieldID, endpointsByField[fieldID]); err != nil {
			return err
		}
	}

	now := model.GetMillis()
	builder := s.getQueryBuilder().
		Insert("PropertyOptionEdges").
		Columns(propertyOptionEdgeColumns...)
	for _, edge := range edges {
		builder = builder.Values(edge.FieldID, edge.ChildOptionID, edge.ParentOptionID, now)
	}
	// DO NOTHING rather than DO UPDATE: an edge has nothing to update, and the
	// same edge listed twice in one payload conflicts with itself, which only
	// DO NOTHING tolerates. The edges the caller passed in are left as they are
	// -- stamping CreateAt onto them would be wrong for one that already existed.
	builder = builder.Suffix("ON CONFLICT (FieldID, ChildOptionID, ParentOptionID) DO NOTHING")

	if _, err = transaction.ExecBuilder(builder); err != nil {
		return errors.Wrap(err, "property_option_edges_create_insert")
	}

	if err = transaction.Commit(); err != nil {
		return errors.Wrap(err, "property_option_edges_create_commit_transaction")
	}

	return nil
}

// DeleteOptionEdges removes the given parent links. An edge that is not there is
// not an error: the caller is asking for a state the field already holds.
//
// The options themselves are untouched. An option left with no parents is a root
// of its field's hierarchy, which is a legitimate position for one to be in.
func (s *SqlPropertyFieldStore) DeleteOptionEdges(edges []*model.PropertyOptionEdge) error {
	if len(edges) == 0 {
		return nil
	}

	matches := sq.Or{}
	for _, edge := range edges {
		matches = append(matches, sq.Eq{
			"FieldID":        edge.FieldID,
			"ChildOptionID":  edge.ChildOptionID,
			"ParentOptionID": edge.ParentOptionID,
		})
	}

	builder := s.getQueryBuilder().
		Delete("PropertyOptionEdges").
		Where(matches)

	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return errors.Wrap(err, "property_option_edges_delete_exec")
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
func (s *SqlPropertyFieldStore) GetOptionChildEdges(fieldID string, parentOptionIDs []string) ([]*model.PropertyOptionEdge, error) {
	if len(parentOptionIDs) == 0 {
		return nil, nil
	}

	builder := s.getQueryBuilder().
		Select(propertyOptionEdgeColumns...).
		From("PropertyOptionEdges").
		Where(sq.Eq{"FieldID": fieldID}).
		Where(sq.Eq{"ParentOptionID": parentOptionIDs})

	edges := []*model.PropertyOptionEdge{}
	if err := s.GetMaster().SelectBuilder(&edges, builder); err != nil {
		return nil, errors.Wrap(err, "property_option_child_edges_select_query")
	}
	return edges, nil
}

// requireOwnedGraphOptions checks that fieldID names a live graph field and that
// every one of the given options is a live option of that field's own.
func (s *SqlPropertyFieldStore) requireOwnedGraphOptions(db sqlxExecutor, fieldID string, optionIDs []string) error {
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

	// The field's own options, not its effective set: an option it inherits from
	// a link source is the template's, and so are that option's parents.
	existing, err := s.getExistingOptionIDs(db, []string{fieldID}, optionIDs)
	if err != nil {
		return err
	}

	for _, optionID := range optionIDs {
		if !slices.Contains(existing, optionID) {
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

	builder := s.getQueryBuilder().
		Delete("PropertyOptionEdges").
		Where(sq.Eq{"FieldID": fieldID}).
		Where(sq.Or{
			sq.Eq{"ChildOptionID": optionIDs},
			sq.Eq{"ParentOptionID": optionIDs},
		})

	if _, err := transaction.ExecBuilder(builder); err != nil {
		return errors.Wrap(err, "property_option_edges_delete_for_options_exec")
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
