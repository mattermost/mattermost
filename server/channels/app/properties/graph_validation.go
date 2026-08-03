// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"fmt"
	"slices"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
)

// A change to a graph field's option hierarchy is checked as a whole and written
// as a whole. Every limit here bounds something about the hierarchy the change
// produces rather than about one link in it, so there is no per-link version of
// any of them: half a change can break a limit that no single link in it breaks.
//
// The limits themselves are in model, next to the hierarchy they bound. Three of
// them are checked against a figure for the change rather than for the whole
// field, which is sound because each is maintained inductively -- a hierarchy
// every change left within a limit is within it:
//
//   - Depth is the longest chain the added links create. An insert cannot
//     lengthen a chain that does not run through one of them.
//   - The parent count is checked for the options the change gives parents to.
//     No other option's parents move.
//   - The edge total is the field's current total plus what the change adds and
//     minus what it takes away.
//
// The two other ways a hierarchy comes into being preserve the limits without
// being checked here: unlinking a field copies its template's hierarchy, which
// was within them, and deleting an option only removes links.

// ValidateOptionEdges checks a change to a graph field's option hierarchy: the
// parent links in add to be created, and the links in remove to go at the same
// time. It reads the hierarchy as stored, so a caller has to write the change
// under the field's UpdateAt -- see ApplyOptionEdges -- for what is checked here
// to still be true when it lands.
//
// Failures wrap ErrInvalidFieldAttrs, so a caller mapping them to a response
// reports a bad request with the reason.
func (ps *PropertyService) ValidateOptionEdges(field *model.PropertyField, add, remove []*model.PropertyOptionEdge) error {
	if err := requireGraphField(field); err != nil {
		return fmt.Errorf("%s: %w", err, ErrInvalidFieldAttrs)
	}

	// The links are the field's own, whichever list they are in: an option
	// inherited from a template is the template's to link, and a change spanning
	// two fields could not be written under one field's UpdateAt.
	for _, group := range []struct {
		what  string
		edges []*model.PropertyOptionEdge
	}{{"add", add}, {"remove", remove}} {
		for i, edge := range group.edges {
			if edge.FieldID != field.ID {
				return fmt.Errorf("invalid options: %s[%d] belongs to field %s rather than to %s: %w", group.what, i, edge.FieldID, field.ID, ErrInvalidFieldAttrs)
			}
		}
	}

	// Removing links breaks none of the limits: each of them bounds something a
	// link adds. An option left with no parents becomes a root, which is a
	// legitimate position for one to be in.
	if len(add) == 0 {
		return nil
	}

	// One read serves both counted limits. The links currently landing on every
	// option the change touches say what each of those options ends up with, and
	// the difference between what they have and what they end up with is how far
	// the field's total moves.
	var touched []string
	for _, edge := range slices.Concat(add, remove) {
		if !slices.Contains(touched, edge.ChildOptionID) {
			touched = append(touched, edge.ChildOptionID)
		}
	}
	stored, err := ps.fieldStore.GetOptionParentEdges(field.ID, touched)
	if err != nil {
		return errors.Wrap(err, "failed to read the parents of a graph property field's options")
	}
	parentsAfter, delta := optionEdgeChange(stored, add, remove)

	for _, edge := range add {
		if count := len(parentsAfter[edge.ChildOptionID]); count > model.PropertyGraphMaxParentsPerOption {
			return fmt.Errorf("invalid options: option %s would have %d options directly above it, and no option may have more than %d: %w", edge.ChildOptionID, count, model.PropertyGraphMaxParentsPerOption, ErrInvalidFieldAttrs)
		}
	}

	total, err := ps.fieldStore.CountOptionEdges(field.ID)
	if err != nil {
		return errors.Wrap(err, "failed to count the parent links of a graph property field's options")
	}
	if total+delta > model.PropertyGraphMaxEdges {
		return fmt.Errorf("invalid options: the field would hold %d parent links between its options, and no field may hold more than %d: %w", total+delta, model.PropertyGraphMaxEdges, ErrInvalidFieldAttrs)
	}

	// Acyclicity before depth: a hierarchy with a cycle has no longest chain, and
	// the depth check reports that as a failure to compute rather than as a number.
	cycle, err := ps.WouldCreateCycle(field, add, remove)
	if err != nil {
		return errors.Wrap(err, "failed to check a graph property field's option hierarchy for cycles")
	}
	if cycle {
		return fmt.Errorf("invalid options: the change would put an option below itself: %w", ErrInvalidFieldAttrs)
	}

	depth, err := ps.DepthAfterAdding(field, add, remove)
	if err != nil {
		return errors.Wrap(err, "failed to measure a graph property field's option hierarchy")
	}
	if depth > model.PropertyGraphMaxDepth {
		return fmt.Errorf("invalid options: the change would put %d options on one chain, and no chain may be longer than %d: %w", depth, model.PropertyGraphMaxDepth, ErrInvalidFieldAttrs)
	}

	return nil
}

// ApplyOptionEdges changes a graph field's option hierarchy, or changes nothing
// at all: the links in add are created and the links in remove go, once the whole
// change has been checked.
//
// The field is the caller's own read of it, and the change is written under the
// UpdateAt that read saw. Everything ValidateOptionEdges checked was decided
// against the hierarchy as of that read, so a change somebody else committed in
// the meantime makes this a conflict rather than a write -- which is what stops
// two changes that are each acyclic and jointly cyclic from both landing.
func (ps *PropertyService) ApplyOptionEdges(field *model.PropertyField, add, remove []*model.PropertyOptionEdge) error {
	if field == nil || field.UpdateAt == 0 {
		return fmt.Errorf("a property field's option hierarchy can only be changed through a field read from the store: %w", ErrInvalidFieldAttrs)
	}

	if err := ps.ValidateOptionEdges(field, add, remove); err != nil {
		return err
	}

	return ps.fieldStore.MutateOptionEdges(field.GroupID, field.ID, field.UpdateAt, add, remove)
}

// optionEdgeChange works out what a change does to the parent links of the
// options it touches: the parents each of them ends up with, and how many links
// the field gains or loses overall.
//
// stored has to hold the current parents of every option named as a child
// anywhere in the change, or the total is wrong. Both directions are idempotent,
// which is where the two figures come from: a link already stored is not one the
// change adds, a link that is not stored is not one it removes, and a link in
// both lists ends up present because the store applies the removals first.
func optionEdgeChange(stored, add, remove []*model.PropertyOptionEdge) (parentsAfter map[string]map[string]bool, delta int) {
	parentsAfter = make(map[string]map[string]bool, len(stored))
	before := 0
	for _, edge := range stored {
		if parentsAfter[edge.ChildOptionID] == nil {
			parentsAfter[edge.ChildOptionID] = map[string]bool{}
		}
		if !parentsAfter[edge.ChildOptionID][edge.ParentOptionID] {
			parentsAfter[edge.ChildOptionID][edge.ParentOptionID] = true
			before++
		}
	}

	for _, edge := range remove {
		delete(parentsAfter[edge.ChildOptionID], edge.ParentOptionID)
	}
	for _, edge := range add {
		if parentsAfter[edge.ChildOptionID] == nil {
			parentsAfter[edge.ChildOptionID] = map[string]bool{}
		}
		parentsAfter[edge.ChildOptionID][edge.ParentOptionID] = true
	}

	after := 0
	for _, parents := range parentsAfter {
		after += len(parents)
	}
	return parentsAfter, after - before
}
