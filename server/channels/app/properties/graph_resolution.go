// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"maps"
	"slices"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

// The options of a graph property field form a hierarchy, and this is where
// questions about it are answered: which options sit above or below which, and
// whether a proposed change to the hierarchy leaves it usable. Everything here
// reads the edge rows through the store on every call, with nothing held
// between them, so every server in a cluster answers from the same rows and
// there is no per-node state to keep in step.
//
// The one relation underneath all of it is "at or above": option a is at-or-above
// option b when a is b, or a is reachable by following parent links upwards from
// b. It is reflexive on purpose -- an option covers itself -- and it is partial:
// two options on separate branches are simply unrelated, which is an ordinary
// "no" and not a failure.
//
// Two rules hold throughout, because this is an access-control input:
//
//   - Nothing to compare means no. An option set that is empty, or that names
//     options the field does not have, answers every question below with "no"
//     rather than with "everything". Anything else would turn missing data into
//     a grant.
//   - Every answer that could not be computed is the negative one, and the error
//     is returned alongside it. A caller that drops the error still denies.

// AncestorsOrSelf returns, for each of the given options, that option together
// with every option at-or-above it. An option the field does not have is left
// out of the result rather than mapped to an empty set.
func (ps *PropertyService) AncestorsOrSelf(rctx request.CTX, field *model.PropertyField, optionIDs []string) (map[string][]string, error) {
	if err := requireGraphField(field); err != nil {
		return nil, err
	}

	resolved, err := ps.fieldStore.GetOptionAncestorsOrSelf(field, optionIDs)
	if err != nil {
		return nil, errors.Wrap(err, "failed to resolve the options above a graph property field's options")
	}
	logUnresolvedOptions(rctx, field, optionIDs, resolved)
	return resolved, nil
}

// CoveredBy walks up from each of the given options and reports, for each one,
// whether one of the holders is at-or-above it. Every option asked about has an
// entry, so a false is an answer and not a gap. A field of any type other than
// graph is refused by requireGraphField, through AncestorsOrSelf, and an option
// the field does not have is covered by nothing.
//
// One walk for the whole set, because the question built on this is asked about
// several options at once -- which of the options one object is marked with may
// be shown to another, and which of the option names a policy names may be
// shown to the caller reading the policy -- and a walk seeded with a set costs
// what a walk seeded with one of them costs.
func (ps *PropertyService) CoveredBy(rctx request.CTX, field *model.PropertyField, optionIDs, holders []string) (map[string]bool, error) {
	above, err := ps.AncestorsOrSelf(rctx, field, optionIDs)
	if err != nil {
		return nil, err
	}

	// The holders go into a set, because the options above one option are bounded
	// only by the size of the hierarchy while the holders are one object's values.
	holderSet := make(map[string]bool, len(holders))
	for _, optionID := range holders {
		holderSet[optionID] = true
	}

	covered := make(map[string]bool, len(optionIDs))
	for _, optionID := range optionIDs {
		// An option the field does not have reaches nothing, itself included, so
		// nothing covers it.
		covered[optionID] = slices.ContainsFunc(above[optionID], func(holderID string) bool {
			return holderSet[holderID]
		})
	}
	return covered, nil
}

// clampToCoverage returns what a holder of the given options may be told about
// another object's: each of the object's options the holder covers, unchanged,
// and each one they do not replaced by the options below it that they do cover
// and that nothing else in that replacement sits above. An option with nothing
// covered below it contributes nothing, so an empty result means none of it may
// be seen at all.
//
// This is the read-masking rule for a hierarchy, and the reason it is a
// replacement rather than a yes-or-no: a holder of one program in a family has
// no business learning that an object is marked with the whole family, but
// hiding the mark outright would also hide the part of it they are entitled to.
// The replacement says as much as the holder's own options account for and no
// more.
//
// An option the field does not have is covered by nothing and has nothing below
// it, so it drops out -- a value naming an option that has since been deleted
// masks to nothing rather than to itself.
func (ps *PropertyService) clampToCoverage(rctx request.CTX, field *model.PropertyField, optionIDs, held []string) ([]string, error) {
	if err := requireGraphField(field); err != nil {
		return nil, err
	}
	// A holder of nothing covers nothing, and there is nothing to say about an
	// object that is marked with nothing.
	if len(optionIDs) == 0 || len(held) == 0 {
		return nil, nil
	}

	covered, err := ps.CoveredBy(rctx, field, optionIDs, held)
	if err != nil {
		return nil, err
	}

	visible := map[string]bool{}
	for _, optionID := range optionIDs {
		if covered[optionID] {
			visible[optionID] = true
			continue
		}
		below, err := ps.coveredBelow(rctx, field, optionID, held)
		if err != nil {
			return nil, err
		}
		for _, coveredID := range below {
			visible[coveredID] = true
		}
	}

	// Sorted so that the same holdings mask the same value to the same answer
	// every time it is read: the options come out of a walk over rows and then a
	// map, and neither promises an order. A masked value that reshuffles between
	// two reads reads as the value having changed.
	return slices.Sorted(maps.Keys(visible)), nil
}

// coveredBelow returns the options below the given one that a holder of held
// covers and that no other such option sits above: what the holder may be told
// about an option they do not cover themselves.
//
// It descends and stops each branch at the first option the holder covers, which
// is what leaves the result maximal without materializing anything. Be clear
// about what stopping does and does not save: it prunes the branch the covered
// option is on and no other, so a holder whose clearance is narrow -- one option
// among a wide level -- still sends the walk down every other branch to the
// bottom. What bounds this is the size of the subtree below the option, not how
// far down the holder's own options sit, in one query per level. Measured on a
// 1,110-option subtree, masking its root costs the same whether the holder covers
// nothing below it or holds an option one level down.
//
// Nothing is capped, because a cap would mask a value to less than the holder may
// see with nothing anywhere to say why. The subtree bounds it already, and the
// holder who would make that subtree largest -- one holding a root -- covers the
// option outright and never arrives here.
//
// The other way to compute it is to intersect everything below the option with
// everything the holder covers: three queries rather than one per level, at the
// price of holding both sets in memory. On the same fixture that measured about
// four times faster, so it is the upgrade path if masking ever shows up in a read
// profile. Both formulations sit on the same store primitives and agree option for
// option.
func (ps *PropertyService) coveredBelow(rctx request.CTX, field *model.PropertyField, optionID string, held []string) ([]string, error) {
	// The option itself is never a candidate -- whoever asks has established that
	// the holder does not cover it -- and having it here also keeps a branch that
	// rejoins the hierarchy above from walking back onto it.
	seen := map[string]bool{optionID: true}

	frontier, err := ps.levelBelow(field, []string{optionID}, seen)
	if err != nil {
		return nil, err
	}

	var candidates []string
	for len(frontier) > 0 {
		var covered map[string]bool
		covered, err = ps.CoveredBy(rctx, field, frontier, held)
		if err != nil {
			return nil, err
		}

		var uncovered []string
		for _, reachedID := range frontier {
			if covered[reachedID] {
				// Everything below a covered option is covered too, and this one is
				// above all of it, so the branch has nothing to add below here.
				candidates = append(candidates, reachedID)
				continue
			}
			uncovered = append(uncovered, reachedID)
		}

		frontier, err = ps.levelBelow(field, uncovered, seen)
		if err != nil {
			return nil, err
		}
	}

	if len(candidates) < 2 {
		return candidates, nil
	}

	// Stopping at the first covered option on each branch does not by itself make
	// the result maximal: where branches rejoin, an option can be reached by a
	// route that never crossed one of the options already taken, and so be
	// reported alongside something that is above it.
	above, err := ps.AncestorsOrSelf(rctx, field, candidates)
	if err != nil {
		return nil, err
	}
	return maximalElements(candidates, above), nil
}

// levelBelow returns the options one step below the given ones, leaving out any
// option a walk has already reached and recording the ones it returns as
// reached. A hierarchy where branches rejoin is therefore walked once per option
// rather than once per route to it -- and one that somehow held a cycle stops
// instead of descending forever, which is why the caller passes the option it
// started from in as already reached.
func (ps *PropertyService) levelBelow(field *model.PropertyField, optionIDs []string, seen map[string]bool) ([]string, error) {
	if len(optionIDs) == 0 {
		return nil, nil
	}

	children, err := ps.fieldStore.GetOptionChildren(field, optionIDs)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read the options below a graph property field's options")
	}

	var below []string
	for _, optionID := range optionIDs {
		for _, childID := range children[optionID] {
			if seen[childID] {
				continue
			}
			seen[childID] = true
			below = append(below, childID)
		}
	}
	return below, nil
}

// maximalElements drops every one of the given options that another of them sits
// above, leaving the ones nothing else accounts for. above must say, for each
// option, which options are at-or-above it.
//
// coveredBelow stops a branch as soon as it reaches an option worth reporting,
// which leaves this as the place its results are compared against each other.
func maximalElements(optionIDs []string, above map[string][]string) []string {
	if len(optionIDs) < 2 {
		return optionIDs
	}

	candidates := make(map[string]bool, len(optionIDs))
	for _, optionID := range optionIDs {
		candidates[optionID] = true
	}

	maximal := make([]string, 0, len(optionIDs))
	for _, optionID := range optionIDs {
		if slices.ContainsFunc(above[optionID], func(ancestorID string) bool {
			return ancestorID != optionID && candidates[ancestorID]
		}) {
			continue
		}
		maximal = append(maximal, optionID)
	}
	return maximal
}

// WouldCreateCycle reports whether the edges in add would put an option above
// itself, given that the edges in remove go at the same time. A hierarchy with a
// cycle has no roots and no meaningful ordering, so this is the check a change has
// to pass before any other.
//
// It asks about the edges being added, not about the whole hierarchy: a cycle that
// is somehow already stored elsewhere in the field is not one this change creates,
// and is not reported here. Removals are taken out of the stored hierarchy before
// the question is asked, so a change that re-parents an option -- dropping a link
// and adding one that would have closed a cycle against the link it drops -- is
// judged against what it actually leaves behind.
//
// Refusing is the answer on any failure: the returned bool is true whenever the
// error is non-nil, so a caller that drops the error rejects the change.
func (ps *PropertyService) WouldCreateCycle(field *model.PropertyField, add, remove []*model.PropertyOptionEdge) (bool, error) {
	if err := requireGraphField(field); err != nil {
		return true, err
	}
	if len(add) == 0 {
		return false, nil
	}

	hierarchy, err := ps.loadGraphNeighbourhood(field, add, remove)
	if err != nil {
		return true, err
	}

	// An edge puts its child below its parent, so it closes a cycle exactly when
	// the child is already at-or-above the parent -- whether through stored edges,
	// through other edges in this payload, or through a mixture of the two.
	reachedUp := map[string]map[string]bool{}
	for _, edge := range add {
		above, resolved := reachedUp[edge.ParentOptionID]
		if !resolved {
			above = hierarchy.reachable(edge.ParentOptionID, hierarchy.parents)
			reachedUp[edge.ParentOptionID] = above
		}
		if above[edge.ChildOptionID] {
			return true, nil
		}
	}
	return false, nil
}

// DepthAfterAdding returns how many options lie on the longest chain the edges in
// add create, counted from a root: an edge between two options that had none makes
// a chain of two. Existing chains are not lengthened by an insert, so a caller
// enforcing a maximum depth compares this against it and needs no separate figure
// for the rest of the hierarchy.
//
// It reads the hierarchy as stored, minus the edges in remove, plus the edges in
// add -- so a change that lifts a subtree to a shallower parent is measured
// against the chains it leaves, not against the ones it is taking away.
//
// Run WouldCreateCycle first: a hierarchy with a cycle has no longest chain, and
// this reports that as an error rather than choosing a number.
func (ps *PropertyService) DepthAfterAdding(field *model.PropertyField, add, remove []*model.PropertyOptionEdge) (int, error) {
	if err := requireGraphField(field); err != nil {
		return 0, err
	}
	if len(add) == 0 {
		return 0, nil
	}

	hierarchy, err := ps.loadGraphNeighbourhood(field, add, remove)
	if err != nil {
		return 0, err
	}

	deepest := 0
	for _, edge := range add {
		// The longest chain through an edge is everything above its parent, the
		// parent, the child, and everything below the child. Neither half can
		// contain an option from the other unless the edge closes a cycle, which
		// is the caller's earlier check.
		above, err := hierarchy.longestChain(edge.ParentOptionID, hierarchy.parents, hierarchy.longestUp)
		if err != nil {
			return 0, err
		}
		below, err := hierarchy.longestChain(edge.ChildOptionID, hierarchy.children, hierarchy.longestDown)
		if err != nil {
			return 0, err
		}
		deepest = max(deepest, above+below)
	}
	return deepest, nil
}

// graphNeighbourhood is the part of a field's hierarchy that a set of proposed
// edges can change, as adjacency in both directions with those edges already
// folded in, so the checks over it run without going back to the database.
type graphNeighbourhood struct {
	parents  map[string][]string
	children map[string][]string

	longestUp   map[string]int
	longestDown map[string]int
}

// loadGraphNeighbourhood reads the part of the hierarchy the edges in add can
// change: everything at-or-above the options they name as parents, everything
// at-or-below the options they name as children, and the stored edges among
// those, less the edges in remove. A new edge joins those two regions, so it can
// only lengthen or close a chain inside their union.
//
// The removals are left out here rather than in each check, because both checks
// are about the hierarchy the change produces and the store applies the removals
// before the additions. Leaving them in would report a chain, or a cycle, through
// a link the change is taking away.
//
// Three queries, whatever the payload, and no second round even though the
// proposed edges reach past what is stored: leaving the upper region on the way
// up means crossing a proposed edge, and that edge's parent is already one of the
// options the upper region was collected from, so everything above it is in hand
// -- and the same downwards.
//
// The cost is that the region's edges are held in memory, and re-parenting
// something near a root makes the region the whole hierarchy. That is the trade
// against walking a level at a time, which would hold one number per option
// instead of every edge but would need a round trip per level and could not see
// the proposed edges. If the memory ever matters, the level walk is the upgrade,
// and only these two checks would change.
//
// Endpoints the field does not have are not reported here. The store refuses to
// write an edge whose endpoints are not live options of the field, so this can
// treat them as options with nothing around them and let that refusal stand.
func (ps *PropertyService) loadGraphNeighbourhood(field *model.PropertyField, add, remove []*model.PropertyOptionEdge) (*graphNeighbourhood, error) {
	// Both lists are deduplicated through a map rather than by scanning what is
	// already collected: a whole hierarchy can arrive in one change, and at tens of
	// thousands of edges the scan costs more than every query below put together.
	children := make([]string, 0, len(add))
	parents := make([]string, 0, len(add))
	for _, edge := range add {
		children = append(children, edge.ChildOptionID)
		parents = append(parents, edge.ParentOptionID)
	}
	childIDs := utils.RemoveDuplicatesFromStringArray(children)
	parentIDs := utils.RemoveDuplicatesFromStringArray(parents)

	// Read through the store rather than through AncestorsOrSelf: an endpoint the
	// field does not have is the write path's error to report, and logging it here
	// as an unresolvable option would describe it as a stale reference.
	above, err := ps.fieldStore.GetOptionAncestorsOrSelf(field, parentIDs)
	if err != nil {
		return nil, errors.Wrap(err, "failed to resolve the options above a graph property field's options")
	}
	below, err := ps.fieldStore.GetOptionDescendantsOrSelf(field, childIDs)
	if err != nil {
		return nil, errors.Wrap(err, "failed to resolve the options below a graph property field's options")
	}

	var region []string
	inRegion := map[string]bool{}
	for _, reached := range []map[string][]string{above, below} {
		for _, optionIDs := range reached {
			for _, optionID := range optionIDs {
				if !inRegion[optionID] {
					inRegion[optionID] = true
					region = append(region, optionID)
				}
			}
		}
	}

	// Every edge inside the upper region has its parent there, since the region
	// holds everything above the options it was collected from, and the same is
	// true of the lower region -- so asking by parent reaches every edge either
	// region contains.
	stored, err := ps.fieldStore.GetOptionChildren(field, region)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read the options below a graph property field's options")
	}

	// A link is identified here by the two options it joins. Option IDs are unique
	// within the field whose hierarchy is being read, so a pair names one link in
	// it; that every edge passed in belongs to that field is the caller's to
	// establish, and ValidateOptionEdges is where it is established.
	removed := make(map[[2]string]bool, len(remove))
	for _, edge := range remove {
		removed[[2]string{edge.ChildOptionID, edge.ParentOptionID}] = true
	}

	hierarchy := &graphNeighbourhood{
		parents:     map[string][]string{},
		children:    map[string][]string{},
		longestUp:   map[string]int{},
		longestDown: map[string]int{},
	}
	for parentID, storedChildren := range stored {
		for _, childID := range storedChildren {
			if removed[[2]string{childID, parentID}] {
				continue
			}
			hierarchy.link(childID, parentID)
		}
	}
	// After the removals, so an edge the change both removes and adds is present:
	// that is the order the store applies them in.
	for _, edge := range add {
		hierarchy.link(edge.ChildOptionID, edge.ParentOptionID)
	}
	return hierarchy, nil
}

func (n *graphNeighbourhood) link(childID, parentID string) {
	n.parents[childID] = append(n.parents[childID], parentID)
	n.children[parentID] = append(n.children[parentID], childID)
}

// reachable returns every option reachable from the given one by following the
// given adjacency, excluding the option itself unless something leads back to it.
// It tolerates a cycle: an option already reached is not followed again.
func (n *graphNeighbourhood) reachable(from string, adjacency map[string][]string) map[string]bool {
	reached := map[string]bool{}
	pending := slices.Clone(adjacency[from])
	for len(pending) > 0 {
		optionID := pending[len(pending)-1]
		pending = pending[:len(pending)-1]
		if reached[optionID] {
			continue
		}
		reached[optionID] = true
		pending = append(pending, adjacency[optionID]...)
	}
	return reached
}

// longestChain returns how many options lie on the longest chain that starts at
// the given one and follows the given adjacency. An option with nothing in that
// direction is a chain of one. Results are memoized because a hierarchy where
// branches rejoin would otherwise be walked once per route into it.
//
// A cycle has no longest chain, so one is reported as an error instead of being
// counted; the memo doubles as the record of what is currently being walked.
func (n *graphNeighbourhood) longestChain(from string, adjacency map[string][]string, memo map[string]int) (int, error) {
	const walking = -1

	if length := memo[from]; length == walking {
		return 0, errors.Errorf("option %s sits above itself", from)
	} else if length > 0 {
		return length, nil
	}

	memo[from] = walking
	longest := 1
	for _, nextID := range adjacency[from] {
		reached, err := n.longestChain(nextID, adjacency, memo)
		if err != nil {
			return 0, err
		}
		longest = max(longest, reached+1)
	}
	memo[from] = longest
	return longest, nil
}

// requireGraphField refuses a field whose options are not meant to form a
// hierarchy. Nothing links the options of a select or multiselect field, so a
// walk over one would find every option alone and answer by exact equality
// instead -- a plausible-looking answer to a question that does not apply to the
// field, which is worse than a refusal.
func requireGraphField(field *model.PropertyField) error {
	if field == nil {
		return errors.New("no property field to resolve options against")
	}
	if field.Type != model.PropertyFieldTypeGraph {
		return errors.Errorf("property field %s is of type %s, whose options form no hierarchy", field.ID, field.Type)
	}
	return nil
}

// logUnresolvedOptions reports the options a walk found nothing for. They are not
// an error -- a value pointing at an option that has since been deleted is
// tolerated throughout the property system -- but they answer every question
// about themselves with "no". Logged at debug: this fires on every read of a
// value naming a deleted option, for as long as the value stays.
func logUnresolvedOptions(rctx request.CTX, field *model.PropertyField, requested []string, resolved map[string][]string) {
	var unresolved []string
	for _, optionID := range requested {
		if _, ok := resolved[optionID]; !ok && !slices.Contains(unresolved, optionID) {
			unresolved = append(unresolved, optionID)
		}
	}
	if len(unresolved) == 0 {
		return
	}

	rctx.Logger().Debug(
		"Property field options could not be resolved in the field's hierarchy; every question asked about them is answered no",
		mlog.String("field_id", field.ID),
		mlog.Array("option_ids", unresolved),
	)
}
