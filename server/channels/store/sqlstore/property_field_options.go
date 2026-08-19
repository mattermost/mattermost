// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"
	"maps"
	"math"
	"slices"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

// The options of a select-style property field are rows in PropertyOptions, but
// the field's wire format still carries them inline under Attrs["options"]:
// reads coalesce the rows back into that key, writes take the key apart into
// rows. The two directions have to be exact inverses, so the promotion rule is
// stated once here and implemented by newPropertyOptionRow and
// propertyOptionRow.wireOption:
//
//	id            -> the ID column, always
//	name          -> the Name column, when the value is a string
//	color         -> the Color column, when the value is a string
//	rank          -> the Rank column, when the value is a whole number
//	parents       -> rows in PropertyOptionEdges, on the way in only
//	anything else -> the option's own Attrs
//
// The parents key is the one asymmetric part: a write may state the options an
// option sits under, and a read leaves them out. An option's place in a hierarchy
// is reported by the endpoints that address options one at a time, and leaving it
// out here is what makes a read-modify-write of a field leave the hierarchy alone
// rather than flatten it.
//
// The promotions are conditional because an option object is open-shaped — it is
// not even required to carry a name, and a plugin may store anything under any of
// these keys — and coercing a value would change what the caller reads back. A
// NULL column means the key was absent, which is how an option that never carried
// a color avoids growing one.
//
// A field's *effective* option set is the options it owns plus the options
// owned by the template named in its LinkedFieldID. Nothing copies a template's
// options into its linked fields; the union is recomputed on every read, so a
// template edit is visible through every linked field with no write to them.

const (
	optionKeyID    = "id"
	optionKeyName  = "name"
	optionKeyColor = "color"
	optionKeyRank  = "rank"
)

// propertyOptionRow is one PropertyOptions row.
type propertyOptionRow struct {
	ID        string
	GroupID   string
	FieldID   string
	Name      *string
	Color     *string
	Rank      *int64
	SortOrder int
	Attrs     model.StringInterface
	CreateAt  int64
	UpdateAt  int64
	DeleteAt  int64
}

var propertyOptionColumns = []string{"ID", "GroupID", "FieldID", "Name", "Color", "Rank", "SortOrder", "Attrs", "CreateAt", "UpdateAt", "DeleteAt"}

// insertValues returns the row in propertyOptionColumns order. Attrs is passed
// as an untyped nil when empty so the column holds SQL NULL rather than a JSON
// null, which keeps "has extra keys" a single test everywhere.
func (r *propertyOptionRow) insertValues() []any {
	var attrs any
	if len(r.Attrs) > 0 {
		attrs = r.Attrs
	}
	return []any{r.ID, r.GroupID, r.FieldID, r.Name, r.Color, r.Rank, r.SortOrder, attrs, r.CreateAt, r.UpdateAt, r.DeleteAt}
}

// wireOption rebuilds the option object the caller originally wrote.
func (r *propertyOptionRow) wireOption() map[string]any {
	opt := make(map[string]any, len(r.Attrs)+4)
	maps.Copy(opt, r.Attrs)
	opt[optionKeyID] = r.ID
	if r.Name != nil {
		opt[optionKeyName] = *r.Name
	}
	if r.Color != nil {
		opt[optionKeyColor] = *r.Color
	}
	if r.Rank != nil {
		// float64, not int64: an option that arrived as JSON had a float64 here,
		// and a caller that type-asserts on the value must keep working. Both
		// marshal to the same JSON for whole numbers, which is all Rank holds.
		opt[optionKeyRank] = float64(*r.Rank)
	}
	return opt
}

// newPropertyOptionRow splits one option object into a row. sortOrder is the
// option's position in the field's option array, which is the order clients
// render options in.
func newPropertyOptionRow(field *model.PropertyField, opt map[string]any, sortOrder int, now int64) (*propertyOptionRow, error) {
	// Any non-empty string is an ID: PropertyField.EnsureOptionIDs generates one
	// for an option that has none, but an option written straight to the store
	// keeps whatever it was given, and property values already point at it.
	id, _ := opt[optionKeyID].(string)
	if id == "" {
		return nil, errors.Errorf("option at index %d of field %s has no id", sortOrder, field.ID)
	}

	row := &propertyOptionRow{
		ID:        id,
		GroupID:   field.GroupID,
		FieldID:   field.ID,
		SortOrder: sortOrder,
		CreateAt:  now,
		UpdateAt:  now,
	}

	// The parents key is promoted without a column of its own: it becomes edge
	// rows, written by applyOptionParentLinks. Listing it here is what keeps it
	// out of the option's Attrs, where it would be served back as an attribute
	// alongside the hierarchy it had already been turned into.
	promoted := []string{optionKeyID, model.PropertyFieldOptionKeyParents}
	if name, ok := opt[optionKeyName].(string); ok {
		row.Name = &name
		promoted = append(promoted, optionKeyName)
	}
	if color, ok := opt[optionKeyColor].(string); ok {
		row.Color = &color
		promoted = append(promoted, optionKeyColor)
	}
	if rank, ok := optionRank(opt[optionKeyRank]); ok {
		row.Rank = &rank
		promoted = append(promoted, optionKeyRank)
	}

	for key, value := range opt {
		if slices.Contains(promoted, key) {
			continue
		}
		if row.Attrs == nil {
			row.Attrs = model.StringInterface{}
		}
		row.Attrs[key] = value
	}

	return row, nil
}

// optionRank reports whether an option's rank value can be held in the Rank
// column without changing it. Anything else — a string, a fraction, a magnitude
// beyond exact float64 integers — stays in the option's Attrs instead.
func optionRank(raw any) (int64, bool) {
	var f float64
	switch v := raw.(type) {
	case float64:
		f = v
	case float32:
		f = float64(v)
	case int:
		f = float64(v)
	case int32:
		f = float64(v)
	case int64:
		f = float64(v)
	default:
		return 0, false
	}

	const maxExactInteger = 1 << 53
	if f != math.Trunc(f) || f < -maxExactInteger || f > maxExactInteger {
		return 0, false
	}
	return int64(f), true
}

// optionSourceID returns the template this field derives options from, or an
// empty string when it derives none.
func optionSourceID(field *model.PropertyField) string {
	if field.LinkedFieldID == nil {
		return ""
	}
	return *field.LinkedFieldID
}

// optionOwnerIDs returns the fields whose options make up this field's
// effective option set: itself, plus the template it links to.
func optionOwnerIDs(field *model.PropertyField) []string {
	if sourceID := optionSourceID(field); sourceID != "" {
		return []string{field.ID, sourceID}
	}
	return []string{field.ID}
}

// graphOptionOwnerID returns the single field whose rows carry the hierarchy a
// graph field exposes: the template it links to, or itself when it links to
// nothing.
//
// One field rather than both, because an edge never crosses fields: a linked
// field owns no copy of its template's options and so no copy of the edges
// between them, and the parent links it serves are the template's rows,
// carrying the template's FieldID. Scoping a walk to a linked field's own ID
// would find no edges at all and report every option as unrelated to every
// other -- which reads as "covers nothing", so it denies access rather than
// granting it, and leaves no trace.
//
// A linked field may still own local options of its own, and this deliberately
// does not walk them: with no cross-field edges they could only form a second
// hierarchy disconnected from the template's, and the option a caller means when
// it names a linked field's hierarchy is the inherited one.
func graphOptionOwnerID(field *model.PropertyField) string {
	if sourceID := optionSourceID(field); sourceID != "" {
		return sourceID
	}
	return field.ID
}

// fieldOption projects a row into the option the options endpoints carry. The
// field asked about decides which options are read-only: one belonging to
// another field is inherited from a template, and only the template may change
// it.
//
// Rank has no counterpart on PropertyFieldOption and is dropped here -- see the
// type for why. Nothing else about the row is lost.
func (r *propertyOptionRow) fieldOption(askedAboutFieldID string) *model.PropertyFieldOption {
	option := &model.PropertyFieldOption{
		ID:       r.ID,
		ReadOnly: r.FieldID != askedAboutFieldID,
		CreateAt: r.CreateAt,
	}
	if r.Name != nil {
		option.Name = *r.Name
	}
	if r.Color != nil {
		color := *r.Color
		option.Color = &color
	}
	if len(r.Attrs) > 0 {
		attrs := r.Attrs
		option.Attrs = &attrs
	}
	return option
}

// flatOption renders an option the options endpoints carry into the open-shaped
// object a field's inline option list holds, which newPropertyOptionRow takes
// apart. Going through that one function is deliberate: the promotion rule
// between an option and its row is stated and implemented once, so the two ways
// of writing an option cannot drift into storing the same option differently.
//
// The named parts are written after the attrs rather than before, so an attrs
// map that carries one of their keys anyway cannot shadow them. Nothing should
// send that -- PropertyFieldOption.IsValid refuses it -- but which value wins
// should not depend on it.
func flatOption(option *model.PropertyFieldOption) map[string]any {
	flat := make(map[string]any, 3)
	if option.Attrs != nil {
		maps.Copy(flat, *option.Attrs)
	}
	flat[optionKeyID] = option.ID
	flat[optionKeyName] = option.Name
	if option.Color != nil {
		flat[optionKeyColor] = *option.Color
	}
	return flat
}

// GetFieldOptions returns one page of a field's effective option set -- the
// options it owns plus the ones it inherits from the template it links to --
// ordered by creation and keyed off the last option of the previous page.
//
// The page is ordered by (CreateAt, ID) rather than by the order the field's
// inline option list uses, which additionally leads with the position an option
// held in the list it was written with. The two therefore disagree for a field
// whose options were written out of creation order, and deliberately so: this
// order is the one the (FieldID, CreateAt, ID) index serves, which is what makes
// paging a hierarchy of a hundred thousand options possible at all, and it is
// stable under an option being added -- a keyset including the position would
// move every later option when one is inserted in the middle. A caller
// rendering options for a person to choose from wants the field's list; this
// endpoint is for reconstructing a hierarchy.
//
// Parents are reported by name, and only for a field whose options form a
// hierarchy. A name is the only reference the write side accepts, and an option
// name is unique across a field's effective set, so a page of options carries
// enough to rebuild the part of the hierarchy it covers.
func (s *SqlPropertyFieldStore) GetFieldOptions(field *model.PropertyField, cursorCreateAt int64, cursorID string, perPage int) ([]*model.PropertyFieldOption, error) {
	if field == nil || perPage <= 0 {
		return nil, nil
	}

	builder := s.getQueryBuilder().
		Select(propertyOptionColumns...).
		From("PropertyOptions").
		Where(sq.Eq{"FieldID": optionOwnerIDs(field)}).
		Where(sq.Eq{"DeleteAt": 0}).
		OrderBy("CreateAt ASC", "ID ASC").
		Limit(uint64(perPage))

	if cursorID != "" {
		builder = builder.Where(sq.Or{
			sq.Gt{"CreateAt": cursorCreateAt},
			sq.And{
				sq.Eq{"CreateAt": cursorCreateAt},
				sq.Gt{"ID": cursorID},
			},
		})
	}

	rows := []*propertyOptionRow{}
	if err := s.GetMaster().SelectBuilder(&rows, builder); err != nil {
		return nil, errors.Wrap(err, "property_options_page_query")
	}

	options := make([]*model.PropertyFieldOption, 0, len(rows))
	for _, row := range rows {
		options = append(options, row.fieldOption(field.ID))
	}

	if field.Type != model.PropertyFieldTypeGraph {
		return options, nil
	}
	if err := s.attachOptionParentNames(field, options); err != nil {
		return nil, err
	}
	return options, nil
}

// attachOptionParentNames fills in the parents of each of the given options, by
// name. Every option comes back with a parent list even when it is empty: a
// root option having nothing above it is the answer, and a caller writing the
// option back has to be able to tell that from having left the key out.
func (s *SqlPropertyFieldStore) attachOptionParentNames(field *model.PropertyField, options []*model.PropertyFieldOption) error {
	optionIDs := make([]string, 0, len(options))
	for _, option := range options {
		optionIDs = append(optionIDs, option.ID)
	}

	ownerID := graphOptionOwnerID(field)
	edges, err := s.GetOptionParentEdges(ownerID, optionIDs)
	if err != nil {
		return err
	}

	parentIDs := make([]string, 0, len(edges))
	for _, edge := range edges {
		parentIDs = append(parentIDs, edge.ParentOptionID)
	}
	names, err := s.getOptionNames(s.GetMaster(), ownerID, utils.RemoveDuplicatesFromStringArray(parentIDs))
	if err != nil {
		return err
	}

	parentsByChild := make(map[string][]string, len(options))
	for _, edge := range edges {
		// An edge whose parent has no name is not skipped silently: the name is
		// what a caller would have to send to keep the link, so reporting the
		// option without it would make a write-back drop the parent. Options
		// predating the options table can be nameless, and one of those cannot be
		// part of a hierarchy authored through these endpoints anyway.
		name, ok := names[edge.ParentOptionID]
		if !ok || name == "" {
			return errors.Errorf("option %s of field %s is above option %s but has no name to report it by", edge.ParentOptionID, ownerID, edge.ChildOptionID)
		}
		parentsByChild[edge.ChildOptionID] = append(parentsByChild[edge.ChildOptionID], name)
	}

	for _, option := range options {
		parents := parentsByChild[option.ID]
		// Sorted so a page reads the same way twice: the edge rows come back in
		// whatever order the index walk produced them.
		slices.Sort(parents)
		if parents == nil {
			parents = []string{}
		}
		option.Parents = &parents
	}
	return nil
}

// getOptionNames returns the names of the given options, as option ID -> name.
// An option with no name at all is absent rather than mapped to an empty string.
func (s *SqlPropertyFieldStore) getOptionNames(db sqlxExecutor, fieldID string, optionIDs []string) (map[string]string, error) {
	type named struct {
		ID   string
		Name *string
	}

	names := make(map[string]string, len(optionIDs))
	for batch := range slices.Chunk(optionIDs, maxOptionIDsPerQuery) {
		builder := s.getQueryBuilder().
			Select("ID", "Name").
			From("PropertyOptions").
			Where(sq.Eq{"FieldID": fieldID}).
			Where(sq.Eq{"ID": batch}).
			Where(sq.Eq{"DeleteAt": 0})

		rows := []*named{}
		if err := db.SelectBuilder(&rows, builder); err != nil {
			return nil, errors.Wrap(err, "property_options_names_query")
		}
		for _, row := range rows {
			if row.Name != nil {
				names[row.ID] = *row.Name
			}
		}
	}
	return names, nil
}

// GetOptionsByID returns the options among the given IDs that are live in the
// field's effective option set, in full. Anything not returned is either not an
// option of the field or has been deleted, which its caller has to tell apart
// from an inherited option it may not change -- hence the effective set rather
// than the field's own options, and the ReadOnly flag on what comes back.
func (s *SqlPropertyFieldStore) GetOptionsByID(field *model.PropertyField, optionIDs []string) ([]*model.PropertyFieldOption, error) {
	options, err := s.getFieldOptionsWhere(field, "ID", optionIDs)
	if err != nil || len(options) == 0 || field.Type != model.PropertyFieldTypeGraph {
		return options, err
	}
	if err := s.attachOptionParentNames(field, options); err != nil {
		return nil, err
	}
	return options, nil
}

// GetOptionsByName returns the live options of the field's effective set whose
// name is one of the given ones. It answers both questions the write path asks
// about a name: whether an option already has it -- names are unique across a
// field's effective set -- and, for a name used to reference a parent, which
// option it refers to.
//
// Unlike GetOptionsByID it reports no parents. A name is asked about to find the
// option behind it, and a caller may ask about as many names as a whole change
// carries, so resolving the hierarchy around every answer would be work no caller
// has a use for.
func (s *SqlPropertyFieldStore) GetOptionsByName(field *model.PropertyField, names []string) ([]*model.PropertyFieldOption, error) {
	return s.getFieldOptionsWhere(field, "Name", names)
}

// getFieldOptionsWhere runs one lookup over a field's effective option set,
// matching the given column against the given keys, with no parent information.
//
// It batches the keys because a caller may hold as many of them as a whole change
// carries -- one option name per option plus one per parent named -- and a
// statement has a hard limit on how many parameters it can take (see
// maxOptionIDsPerQuery). The batches merge by concatenation: each key stands on
// its own.
func (s *SqlPropertyFieldStore) getFieldOptionsWhere(field *model.PropertyField, column string, keys []string) ([]*model.PropertyFieldOption, error) {
	if field == nil || len(keys) == 0 {
		return nil, nil
	}

	var options []*model.PropertyFieldOption
	for batch := range slices.Chunk(keys, maxOptionIDsPerQuery) {
		builder := s.getQueryBuilder().
			Select(propertyOptionColumns...).
			From("PropertyOptions").
			Where(sq.Eq{"FieldID": optionOwnerIDs(field)}).
			Where(sq.Eq{column: batch}).
			Where(sq.Eq{"DeleteAt": 0})

		rows := []*propertyOptionRow{}
		if err := s.GetMaster().SelectBuilder(&rows, builder); err != nil {
			return nil, errors.Wrap(err, "property_options_lookup_query")
		}
		for _, row := range rows {
			options = append(options, row.fieldOption(field.ID))
		}
	}
	return options, nil
}

// GetLinkedFieldOptionNames reports which of the given names an option local to a
// field linking to this one already has, as name -> that field's ID.
//
// A name has to identify one option across everything a field serves, and a field
// linking to a template serves that template's options beside its own. So a name
// the template is about to use is only free if no dependent has a local option
// called that -- a question about rows belonging to fields the write does not
// name, which is why it cannot be answered from the field being written.
//
// Only the types whose linked fields may own local options can collide: a field
// linking to a graph template owns no options at all. Nothing here special-cases
// that -- there is simply nothing to find for one.
//
// Reads from the master, like every other query the option write path makes:
// replication lag would clear a name that a dependent has just taken.
func (s *SqlPropertyFieldStore) GetLinkedFieldOptionNames(fieldID string, names []string) (map[string]string, error) {
	if fieldID == "" || len(names) == 0 {
		return nil, nil
	}

	type ownedName struct {
		FieldID string
		Name    string
	}

	taken := map[string]string{}
	for batch := range slices.Chunk(names, maxOptionIDsPerQuery) {
		builder := s.getQueryBuilder().
			Select("opt.FieldID", "opt.Name").
			From("PropertyOptions opt").
			Join("PropertyFields dependent ON dependent.ID = opt.FieldID").
			Where(sq.Eq{"dependent.LinkedFieldID": fieldID}).
			Where(sq.Eq{"dependent.DeleteAt": 0}).
			Where(sq.Eq{"opt.Name": batch}).
			Where(sq.Eq{"opt.DeleteAt": 0})

		rows := []*ownedName{}
		if err := s.GetMaster().SelectBuilder(&rows, builder); err != nil {
			return nil, errors.Wrap(err, "property_options_linked_field_names_query")
		}
		for _, row := range rows {
			taken[row.Name] = row.FieldID
		}
	}
	return taken, nil
}

// CountOptions returns how many live options a field owns itself. Options it
// inherits from a template are not counted: they are the template's, and the
// limit on how many options a field may have is about the ones it holds.
func (s *SqlPropertyFieldStore) CountOptions(fieldID string) (int, error) {
	counts, err := s.countPropertyOptions(s.GetMaster(), []string{fieldID})
	if err != nil {
		return 0, err
	}
	return counts[fieldID], nil
}

// MutateOptions changes one field's options and, for a graph field, the
// hierarchy between them: the options in upsert are created or rewritten, the
// parent links in remove go, and the links in add are created -- all together or
// not at all. A caller that gets an error changed nothing.
//
// An option in upsert is written whole. Its row is replaced except for the two
// columns PropertyFieldOption does not model -- the rank and the position in the
// field's option list -- which an existing option keeps and a new one gets
// appended after the options already there. A soft-deleted option named in
// upsert comes back, as it does when a field is written with it in its option
// list again.
//
// Every option is written under this field's ID, so a caller must not name an
// option the field merely inherits: that would shadow the template's option with
// a local copy rather than edit it. Nothing here can tell the two apart -- the
// unlink path deliberately copies a template's options into a field under the
// same identifiers -- so refusing it is the caller's job, which the options
// endpoints do by refusing to change an option they report as read-only.
//
// groupID scopes the change to the property group the field is expected to be
// in, as it does on Update and Delete, and an empty one leaves it unscoped.
//
// expectedUpdateAt is the field's UpdateAt as the caller read it before deciding
// what the change should be, and the write only lands on a row still carrying
// that value. Two changes that are each fine and jointly form a cycle therefore
// cannot both land: the second was decided against a hierarchy the first has
// moved, and it is refused as a conflict instead. Passing zero asserts nothing
// and is for a caller that has no earlier read to compare against.
//
// The field's UpdateAt is bumped either way, because an option or hierarchy
// change alters what the field serves without altering a single column of it,
// and clients syncing on UpdateAt would otherwise never hear about it.
//
// The ceiling of this scheme is that the loser of a race discards the work it did
// deciding what to write. Option changes are rare enough for that to be the
// right trade; a per-group advisory lock taken before the caller validates is the
// upgrade if concurrent hierarchy editing ever becomes ordinary.
//
// Two structural invariants are enforced here, both of which an edge is
// meaningless without: the edge's field is a live graph field -- no other type's
// options have a hierarchy for an edge to be part of -- and both endpoints of an
// added edge are live options that field owns itself. The endpoint check runs
// after the options are written, so one change may create an option and put it
// under a parent.
//
// The shape of the resulting hierarchy -- no cycles, bounded depth, bounded
// numbers of parents and edges -- is not checked here and cannot be: every one of
// those is a property of the whole hierarchy rather than of the rows in front of
// it. A caller puts its change through PropertyService.ValidateOptionEdges
// first, which is what ApplyOptionEdges and the options endpoints do.
func (s *SqlPropertyFieldStore) MutateOptions(groupID, fieldID string, expectedUpdateAt int64, upsert []*model.PropertyFieldOption, add, remove []*model.PropertyOptionEdge) (err error) {
	if len(upsert) == 0 && len(add) == 0 && len(remove) == 0 {
		return nil
	}

	// Both lists are walked in payload order, and the additions before the
	// removals, so which failure a caller is told about is the same run after run.
	for _, group := range []struct {
		what  string
		edges []*model.PropertyOptionEdge
	}{{"add", add}, {"remove", remove}} {
		for i, edge := range group.edges {
			at := fmt.Sprintf("%s[%d]", group.what, i)
			if vErr := edge.IsValid(); vErr != nil {
				return store.NewErrInvalidInput("PropertyOptionEdge", at, vErr.Error()).Wrap(vErr)
			}
			// One field per change: a cycle is confined to one field's options, so
			// the compare-and-swap below only closes the race it exists for if
			// everything being changed belongs to the field it swaps on.
			if edge.FieldID != fieldID {
				return store.NewErrInvalidInput("PropertyOptionEdge", at, edge.FieldID).
					Wrap(errors.Errorf("edge belongs to field %s, not to %s", edge.FieldID, fieldID))
			}
		}
	}

	// Only an added edge's endpoints have to be options the field still has. A
	// removal names a link that is either there, in which case its endpoints are,
	// or already gone.
	//
	// Deduplicated through a map rather than by scanning what is already collected:
	// a whole hierarchy can arrive in one change, and at tens of thousands of edges
	// the scan is the slowest thing in the request by orders of magnitude.
	endpoints := make([]string, 0, len(add)*2)
	for _, edge := range add {
		endpoints = append(endpoints, edge.ChildOptionID, edge.ParentOptionID)
	}
	addEndpoints := utils.RemoveDuplicatesFromStringArray(endpoints)

	// An option row carries the group of the field it belongs to, and the only
	// place that group is known here is the caller's scope: after a successful
	// swap below, a non-empty groupID is by definition the field's own.
	if len(upsert) > 0 && groupID == "" {
		return store.NewErrInvalidInput("PropertyOption", "group_id", groupID).
			Wrap(errors.New("options can only be written through a change scoped to the field's property group"))
	}

	now := model.GetMillis()

	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return errors.Wrap(err, "property_options_mutate_begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	// Before the swap, so a caller changing links on a field that is gone or was
	// never a graph field is told that rather than being told it lost a race.
	if len(add) > 0 || len(remove) > 0 {
		if err = s.requireLiveGraphField(transaction, fieldID); err != nil {
			return err
		}
	}

	if err = s.bumpFieldForOptionChange(transaction, groupID, fieldID, expectedUpdateAt); err != nil {
		return err
	}

	if len(upsert) > 0 {
		if err = s.upsertFieldOptions(transaction, groupID, fieldID, upsert, now); err != nil {
			return err
		}
	}

	if err = s.requireOwnedOptions(transaction, fieldID, addEndpoints); err != nil {
		return err
	}

	if len(remove) > 0 {
		matches := sq.Or{}
		for _, edge := range remove {
			matches = append(matches, sq.Eq{
				"ChildOptionID":  edge.ChildOptionID,
				"ParentOptionID": edge.ParentOptionID,
			})
		}
		builder := s.getQueryBuilder().
			Delete("PropertyOptionEdges").
			Where(sq.Eq{"FieldID": fieldID}).
			Where(matches)

		if _, err = transaction.ExecBuilder(builder); err != nil {
			return errors.Wrap(err, "property_option_edges_delete_exec")
		}
	}

	if len(add) > 0 {
		builder := s.getQueryBuilder().
			Insert("PropertyOptionEdges").
			Columns(propertyOptionEdgeColumns...)
		for _, edge := range add {
			builder = builder.Values(edge.FieldID, edge.ChildOptionID, edge.ParentOptionID, now)
		}
		// DO NOTHING rather than DO UPDATE: an edge has nothing to update, and the
		// same edge listed twice in one payload conflicts with itself, which only
		// DO NOTHING tolerates. The edges the caller passed in are left as they are
		// -- stamping CreateAt onto them would be wrong for one that already existed.
		builder = builder.Suffix("ON CONFLICT (FieldID, ChildOptionID, ParentOptionID) DO NOTHING")

		if _, err = transaction.ExecBuilder(builder); err != nil {
			return errors.Wrap(err, "property_option_edges_insert_exec")
		}
	}

	if err = transaction.Commit(); err != nil {
		return errors.Wrap(err, "property_options_mutate_commit_transaction")
	}

	return nil
}

// DeleteOptions soft-deletes options a field owns and hard-deletes every parent
// link they were part of, bumping the field's UpdateAt under the same
// compare-and-swap MutateOptions uses.
//
// An option the field only inherits matches nothing and is silently left alone:
// it is the template's to delete. Its caller refuses one rather than relying on
// that, so that a caller naming an option it may not touch is told.
//
// Nothing here checks that the options being removed have nothing below them.
// That is a question about the whole set being removed -- taking out a subtree is
// legitimate even though every option in it but the lowest has children -- so it
// belongs to the caller assembling the set.
func (s *SqlPropertyFieldStore) DeleteOptions(groupID, fieldID string, expectedUpdateAt int64, optionIDs []string) (err error) {
	if len(optionIDs) == 0 {
		return nil
	}

	now := model.GetMillis()

	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return errors.Wrap(err, "property_options_delete_begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	if err = s.bumpFieldForOptionChange(transaction, groupID, fieldID, expectedUpdateAt); err != nil {
		return err
	}

	for batch := range slices.Chunk(optionIDs, maxOptionIDsPerQuery) {
		builder := s.getQueryBuilder().
			Update("PropertyOptions").
			Set("DeleteAt", now).
			Set("UpdateAt", now).
			Where(sq.Eq{"FieldID": fieldID}).
			Where(sq.Eq{"ID": batch}).
			Where(sq.Eq{"DeleteAt": 0})
		if _, err = transaction.ExecBuilder(builder); err != nil {
			return errors.Wrap(err, "property_options_delete_exec")
		}

		// An option that is gone cannot be part of a hierarchy, and an edge has no
		// delete marker of its own to carry that with.
		if err = s.deletePropertyOptionEdgesForOptions(transaction, fieldID, batch); err != nil {
			return err
		}
	}

	if err = transaction.Commit(); err != nil {
		return errors.Wrap(err, "property_options_delete_commit_transaction")
	}

	return nil
}

// deleteOwnedOptions soft-deletes every live option a field owns and deletes the
// whole hierarchy between them. It runs when the field itself is being deleted,
// which is why it is told the field rather than a list of options: all of them
// are going, so none of the questions DeleteOptions' caller has to answer -- is
// this one inherited, is anything still below it -- arise.
//
// Only the field's own rows. The options a field derives from a template belong
// to the template and outlive any number of fields linking to it, and an edge
// never crosses fields, so scoping both statements to this field's ID is what
// keeps a dependent's deletion from emptying the template.
//
// The edges are deleted rather than marked, because an edge has no delete marker:
// it is a link between two options, and an option that is gone is not in the
// hierarchy for it to link. Deleting the field is therefore not reversible for
// the hierarchy even though the options keep their rows -- which matches
// PropertyService.requireWritableOptions, where a deleted field is refused
// outright rather than treated as something that could come back.
func (s *SqlPropertyFieldStore) deleteOwnedOptions(transaction *sqlxTxWrapper, fieldID string, now int64) error {
	builder := s.getQueryBuilder().
		Update("PropertyOptions").
		Set("DeleteAt", now).
		Set("UpdateAt", now).
		Where(sq.Eq{"FieldID": fieldID}).
		Where(sq.Eq{"DeleteAt": 0})
	if _, err := transaction.ExecBuilder(builder); err != nil {
		return errors.Wrap(err, "property_options_delete_owned_exec")
	}

	edges := s.getQueryBuilder().
		Delete("PropertyOptionEdges").
		Where(sq.Eq{"FieldID": fieldID})
	if _, err := transaction.ExecBuilder(edges); err != nil {
		return errors.Wrap(err, "property_option_edges_delete_owned_exec")
	}

	return nil
}

// upsertFieldOptions writes the given options as rows of the field, creating the
// ones it does not have and replacing the ones it does.
//
// Rank and SortOrder are left out of the conflict update, because
// PropertyFieldOption does not carry either: an existing option keeps the rank
// and the list position it had. A new option is appended -- the highest position
// among the field's options, plus one per option here. An option already there
// consumes a position it does not use, which leaves a gap in the sequence and
// changes nothing: the column is only ever compared, never counted.
func (s *SqlPropertyFieldStore) upsertFieldOptions(transaction *sqlxTxWrapper, groupID, fieldID string, options []*model.PropertyFieldOption, now int64) error {
	query := s.getQueryBuilder().
		Select("COALESCE(MAX(SortOrder), 0)").
		From("PropertyOptions").
		Where(sq.Eq{"FieldID": fieldID})

	var appendAfter int
	if err := transaction.GetBuilder(&appendAfter, query); err != nil {
		return errors.Wrap(err, "property_options_upsert_position_query")
	}

	field := &model.PropertyField{ID: fieldID, GroupID: groupID}
	rows := make([]*propertyOptionRow, 0, len(options))
	for i, option := range options {
		row, err := newPropertyOptionRow(field, flatOption(option), appendAfter+i+1, now)
		if err != nil {
			return err
		}
		rows = append(rows, row)
	}

	builder := s.getQueryBuilder().
		Insert("PropertyOptions").
		Columns(propertyOptionColumns...)
	for _, row := range rows {
		builder = builder.Values(row.insertValues()...)
	}
	builder = builder.Suffix(`ON CONFLICT (FieldID, ID) DO UPDATE SET
	Name = EXCLUDED.Name,
	Color = EXCLUDED.Color,
	Attrs = EXCLUDED.Attrs,
	UpdateAt = EXCLUDED.UpdateAt,
	DeleteAt = 0`)

	if _, err := transaction.ExecBuilder(builder); err != nil {
		return errors.Wrap(err, "property_options_upsert_exec")
	}
	return nil
}

// wireOptions reads a field's inline option array. It runs after
// PropertyField.EnsureOptionIDs, which normalizes any option list to []any of
// map[string]any, so anything else is a caller that bypassed it.
func wireOptions(field *model.PropertyField) ([]map[string]any, error) {
	if field.Attrs == nil {
		return nil, nil
	}
	raw, ok := field.Attrs[model.PropertyFieldAttributeOptions]
	if !ok || raw == nil {
		return nil, nil
	}
	arr, ok := raw.([]any)
	if !ok {
		return nil, errors.Errorf("options of field %s are not a list", field.ID)
	}
	options := make([]map[string]any, 0, len(arr))
	for i, item := range arr {
		opt, ok := item.(map[string]any)
		if !ok {
			return nil, errors.Errorf("option at index %d of field %s is not an object", i, field.ID)
		}
		options = append(options, opt)
	}
	return options, nil
}

// storedFieldAttrs returns the attrs to persist on the PropertyFields row:
// everything except the three keys that only exist to carry options over the
// wire. For a type that does not support options the attrs are stored as-is,
// because whatever sits under "options" there was never an option list and was
// never read as one.
func storedFieldAttrs(field *model.PropertyField) model.StringInterface {
	if !field.Type.SupportsOptions() || field.Attrs == nil {
		return field.Attrs
	}

	stored := make(model.StringInterface, len(field.Attrs))
	for key, value := range field.Attrs {
		switch key {
		case model.PropertyFieldAttributeOptions,
			model.PropertyFieldAttributeOptionsCount,
			model.PropertyFieldAttributeOptionsOmitted:
		default:
			stored[key] = value
		}
	}
	return stored
}

// storedFieldPermissions encodes field.Permissions to JSONB for storage. If
// Permissions is nil, returns nil for database NULL; otherwise marshals to JSON.
func storedFieldPermissions(field *model.PropertyField) any {
	if field.Permissions == nil {
		return nil
	}
	return model.ToJSON(field.Permissions)
}

// optionsWithheld reports whether a field's attrs came from a read that left the
// option list out because the field has too many. Writing such a field back must
// not be read as "this field now has no options".
func optionsWithheld(field *model.PropertyField) bool {
	return model.PropertyFieldOptionsOmitted(field.Attrs)
}

// hydratePropertyFieldOptions inlines each field's effective option set into
// Attrs["options"], in the order the options were last written in. Fields whose
// type carries no options are left untouched.
//
// The options key is present exactly when there are options to show: a field
// with none does not gain an empty list, and a field with more than
// model.PropertyFieldMaxHydratedOptions reports its count under
// options_count/options_omitted instead. Callers that must tell those two apart
// have to check options_omitted.
func (s *SqlPropertyFieldStore) hydratePropertyFieldOptions(db sqlxExecutor, fields []*model.PropertyField) error {
	var targets []*model.PropertyField
	var ownerIDs []string
	for _, field := range fields {
		if field == nil || !field.Type.SupportsOptions() {
			continue
		}
		targets = append(targets, field)
		for _, ownerID := range optionOwnerIDs(field) {
			if !slices.Contains(ownerIDs, ownerID) {
				ownerIDs = append(ownerIDs, ownerID)
			}
		}
	}
	if len(targets) == 0 {
		return nil
	}

	counts, err := s.countPropertyOptions(db, ownerIDs)
	if err != nil {
		return err
	}

	// Decide which fields fit before loading anything, so an oversized field
	// costs a count rather than its whole option list. The count and the load
	// below are separate statements: a write landing between them can at worst
	// make a field sitting exactly on the boundary report withheld options that
	// would now fit, which the next read corrects.
	effectiveCounts := make(map[string]int, len(targets))
	var loadIDs []string
	for _, field := range targets {
		total := 0
		for _, ownerID := range optionOwnerIDs(field) {
			total += counts[ownerID]
		}
		effectiveCounts[field.ID] = total

		if total == 0 || total > model.PropertyFieldMaxHydratedOptions {
			continue
		}
		for _, ownerID := range optionOwnerIDs(field) {
			if !slices.Contains(loadIDs, ownerID) {
				loadIDs = append(loadIDs, ownerID)
			}
		}
	}

	rowsByOwner := map[string][]*propertyOptionRow{}
	if len(loadIDs) > 0 {
		rows, rErr := s.getPropertyOptions(db, loadIDs, false)
		if rErr != nil {
			return rErr
		}
		for _, row := range rows {
			rowsByOwner[row.FieldID] = append(rowsByOwner[row.FieldID], row)
		}
	}

	for _, field := range targets {
		// Deleting from a nil map is a no-op, and the map is allocated only where
		// there is something to put in it: a field with no attrs at all must not
		// come back carrying an empty object it never had.
		delete(field.Attrs, model.PropertyFieldAttributeOptions)
		delete(field.Attrs, model.PropertyFieldAttributeOptionsCount)
		delete(field.Attrs, model.PropertyFieldAttributeOptionsOmitted)

		total := effectiveCounts[field.ID]
		if total == 0 {
			continue
		}
		if field.Attrs == nil {
			field.Attrs = model.StringInterface{}
		}
		if total > model.PropertyFieldMaxHydratedOptions {
			field.Attrs[model.PropertyFieldAttributeOptionsCount] = total
			field.Attrs[model.PropertyFieldAttributeOptionsOmitted] = true
			continue
		}

		var rows []*propertyOptionRow
		for _, ownerID := range optionOwnerIDs(field) {
			rows = append(rows, rowsByOwner[ownerID]...)
		}
		slices.SortFunc(rows, comparePropertyOptionRows)

		options := make([]any, 0, len(rows))
		for _, row := range rows {
			options = append(options, row.wireOption())
		}
		field.Attrs[model.PropertyFieldAttributeOptions] = options
	}

	return nil
}

// comparePropertyOptionRows orders options for display: the position they were
// written in, then creation order, then ID so the result is total. The last two
// matter for a linked field, whose effective set interleaves two fields' rows
// and so can hold the same position twice.
func comparePropertyOptionRows(a, b *propertyOptionRow) int {
	if a.SortOrder != b.SortOrder {
		return a.SortOrder - b.SortOrder
	}
	if a.CreateAt != b.CreateAt {
		if a.CreateAt < b.CreateAt {
			return -1
		}
		return 1
	}
	if a.ID == b.ID {
		return 0
	}
	if a.ID < b.ID {
		return -1
	}
	return 1
}

func (s *SqlPropertyFieldStore) countPropertyOptions(db sqlxExecutor, fieldIDs []string) (map[string]int, error) {
	type ownerCount struct {
		FieldID string
		Total   int
	}

	builder := s.getQueryBuilder().
		Select("FieldID", "COUNT(ID) AS Total").
		From("PropertyOptions").
		Where(sq.Eq{"FieldID": fieldIDs}).
		Where(sq.Eq{"DeleteAt": 0}).
		GroupBy("FieldID")

	rows := []*ownerCount{}
	if err := db.SelectBuilder(&rows, builder); err != nil {
		return nil, errors.Wrap(err, "property_options_count_query")
	}

	counts := make(map[string]int, len(rows))
	for _, row := range rows {
		counts[row.FieldID] = row.Total
	}
	return counts, nil
}

// linkSourcesBeingCleared returns, for each submitted field that is no longer
// linked, the template it was linked to before this write. Only fields that were
// linked appear, so an empty result means no field is being unlinked.
func (s *SqlPropertyFieldStore) linkSourcesBeingCleared(db sqlxExecutor, fields []*model.PropertyField) (map[string]string, error) {
	var clearing []string
	for _, field := range fields {
		if optionSourceID(field) == "" && field.Type.SupportsOptions() {
			clearing = append(clearing, field.ID)
		}
	}
	if len(clearing) == 0 {
		return nil, nil
	}

	type link struct {
		ID            string
		LinkedFieldID *string
	}

	builder := s.getQueryBuilder().
		Select("ID", "LinkedFieldID").
		From("PropertyFields").
		Where(sq.Eq{"ID": clearing}).
		Where(sq.NotEq{"LinkedFieldID": nil})

	rows := []*link{}
	if err := db.SelectBuilder(&rows, builder); err != nil {
		return nil, errors.Wrap(err, "property_field_link_sources_query")
	}

	sources := make(map[string]string, len(rows))
	for _, row := range rows {
		if row.LinkedFieldID != nil && *row.LinkedFieldID != "" {
			sources[row.ID] = *row.LinkedFieldID
		}
	}
	return sources, nil
}

// getExistingOptionIDs returns which of the given option IDs exist, and are not
// deleted, among the options owned by ownerIDs.
//
// This is the option check for a caller holding identifiers rather than a field:
// the inlined list a field reads back with is absent above
// model.PropertyFieldMaxHydratedOptions options, so a caller that validates
// against the list refuses every identifier once a field grows past the cap.
// Asking the rows costs one indexed query and has no such ceiling.
//
// The owners are passed in rather than derived from a field because the two
// callers want different sets of them: validating a value asks about the field's
// whole effective set, while linking two options asks only about the options one
// field owns itself.
func (s *SqlPropertyFieldStore) getExistingOptionIDs(db sqlxExecutor, ownerIDs []string, optionIDs []string) ([]string, error) {
	if len(optionIDs) == 0 {
		return nil, nil
	}

	builder := s.getQueryBuilder().
		Select("ID").
		From("PropertyOptions").
		Where(sq.Eq{"FieldID": ownerIDs}).
		Where(sq.Eq{"ID": optionIDs}).
		Where(sq.Eq{"DeleteAt": 0})

	ids := []string{}
	if err := db.SelectBuilder(&ids, builder); err != nil {
		return nil, errors.Wrap(err, "property_options_exist_query")
	}
	return ids, nil
}

// takeOverLinkSourceOptions copies the options a field was deriving into rows of
// its own. It runs for a field that has just stopped linking to a template: the
// field's property values point at those option IDs, so it has to keep serving
// them under the same identifiers once it no longer derives them.
//
// The rows are copied from the link source rather than rebuilt from the option
// list on the submitted field. A field with more than
// model.PropertyFieldMaxHydratedOptions options reads back without its list, so
// a caller unlinking such a field has no list to send and the takeover would
// otherwise leave the field owning nothing at all while its values still pointed
// at the template's options.
//
// An option the field somehow already owns under the same ID is left alone: its
// own row is the more specific one.
func (s *SqlPropertyFieldStore) takeOverLinkSourceOptions(transaction *sqlxTxWrapper, field *model.PropertyField, sourceID string, now int64) error {
	// CreateAt is carried over so the options keep the display order they had.
	const query = `INSERT INTO PropertyOptions
		(ID, GroupID, FieldID, Name, Color, Rank, SortOrder, Attrs, CreateAt, UpdateAt, DeleteAt)
		SELECT ID, ?, ?, Name, Color, Rank, SortOrder, Attrs, CreateAt, ?, 0
		FROM PropertyOptions
		WHERE FieldID = ? AND DeleteAt = 0
		ON CONFLICT (FieldID, ID) DO NOTHING`

	if _, err := transaction.Exec(query, field.GroupID, field.ID, now, sourceID); err != nil {
		return errors.Wrap(err, "property_options_take_over_exec")
	}
	return nil
}

// getPropertyOptions loads the options owned by the given fields. Soft-deleted
// rows are included only for the write path, which has to see them to tell a
// re-added option from a new one.
func (s *SqlPropertyFieldStore) getPropertyOptions(db sqlxExecutor, fieldIDs []string, includeDeleted bool) ([]*propertyOptionRow, error) {
	builder := s.getQueryBuilder().
		Select(propertyOptionColumns...).
		From("PropertyOptions").
		Where(sq.Eq{"FieldID": fieldIDs})

	if !includeDeleted {
		builder = builder.Where(sq.Eq{"DeleteAt": 0})
	}

	rows := []*propertyOptionRow{}
	if err := db.SelectBuilder(&rows, builder); err != nil {
		return nil, errors.Wrap(err, "property_options_select_query")
	}
	return rows, nil
}

// syncPropertyFieldOptions makes the PropertyOptions rows match the option
// lists on the given fields, and returns the IDs of the fields whose options
// actually changed.
//
// An option already owned by a field's link source is left alone: it is
// inherited, the linked field only derives it, and rewriting it here would
// either duplicate it or let a linked field edit its template. That is also why
// a linked field created with a copy of its template's list — as every linked
// field is — produces no rows at all.
func (s *SqlPropertyFieldStore) syncPropertyFieldOptions(transaction *sqlxTxWrapper, fields []*model.PropertyField, now int64) ([]string, error) {
	var ownerIDs []string
	for _, field := range fields {
		if !field.Type.SupportsOptions() || optionsWithheld(field) {
			continue
		}
		for _, ownerID := range optionOwnerIDs(field) {
			if !slices.Contains(ownerIDs, ownerID) {
				ownerIDs = append(ownerIDs, ownerID)
			}
		}
	}
	if len(ownerIDs) == 0 {
		return nil, nil
	}

	existing, err := s.getPropertyOptions(transaction, ownerIDs, true)
	if err != nil {
		return nil, err
	}
	byField := map[string]map[string]*propertyOptionRow{}
	for _, row := range existing {
		if byField[row.FieldID] == nil {
			byField[row.FieldID] = map[string]*propertyOptionRow{}
		}
		byField[row.FieldID][row.ID] = row
	}

	var upserts []*propertyOptionRow
	deletesByField := map[string][]string{}
	var linkChanges []optionParentLinks
	var changedFieldIDs []string
	markChanged := func(fieldID string) {
		if !slices.Contains(changedFieldIDs, fieldID) {
			changedFieldIDs = append(changedFieldIDs, fieldID)
		}
	}

	for _, field := range fields {
		// A field whose type carries no options is skipped rather than having
		// its rows removed: the store cannot tell a type conversion from a
		// field that never had options, and dropping rows on the guess would
		// lose the option list of a field converted away and back again.
		if !field.Type.SupportsOptions() || optionsWithheld(field) {
			continue
		}

		options, wErr := wireOptions(field)
		if wErr != nil {
			return nil, wErr
		}

		// Read from the same list, before any of it is written: the links refer to
		// options by name, and the names are the ones the list is about to give them.
		// A rejection here describes the request, so it is not a server error --
		// PropertyService.validateOptionBlobLinks reports the same thing with the
		// position at fault, and gets there first for every caller that goes through
		// the service.
		add, replacing, lErr := field.OptionParentLinks()
		if lErr != nil {
			return nil, store.NewErrInvalidInput("PropertyOption", model.PropertyFieldOptionKeyParents, field.ID).Wrap(lErr)
		}
		if len(add) > 0 || len(replacing) > 0 {
			linkChanges = append(linkChanges, optionParentLinks{field: field, add: add, replacing: replacing})
		}

		own := byField[field.ID]
		inherited := byField[optionSourceID(field)]

		keep := make(map[string]bool, len(options))
		for i, opt := range options {
			row, rErr := newPropertyOptionRow(field, opt, i+1, now)
			if rErr != nil {
				return nil, rErr
			}
			keep[row.ID] = true

			current := own[row.ID]
			if current == nil {
				// Owned by the link source, deleted there or not: inherited, and
				// not this field's to store or to bring back.
				if inherited[row.ID] != nil {
					continue
				}
			} else {
				row.CreateAt = current.CreateAt
				if current.DeleteAt == 0 && !propertyOptionRowChanged(current, row) {
					continue
				}
			}
			upserts = append(upserts, row)
			markChanged(field.ID)
		}

		for _, row := range own {
			if row.DeleteAt != 0 || keep[row.ID] {
				continue
			}
			deletesByField[field.ID] = append(deletesByField[field.ID], row.ID)
			markChanged(field.ID)
		}
	}

	if len(upserts) > 0 {
		if err := s.upsertPropertyOptions(transaction, upserts); err != nil {
			return nil, err
		}
	}

	for fieldID, ids := range deletesByField {
		builder := s.getQueryBuilder().
			Update("PropertyOptions").
			Set("DeleteAt", now).
			Set("UpdateAt", now).
			Where(sq.Eq{"FieldID": fieldID}).
			Where(sq.Eq{"ID": ids})
		if _, err := transaction.ExecBuilder(builder); err != nil {
			return nil, errors.Wrap(err, "property_options_delete_exec")
		}

		// An option that is gone cannot be part of a hierarchy, and an edge has
		// no delete marker of its own to carry that with.
		if err := s.deletePropertyOptionEdgesForOptions(transaction, fieldID, ids); err != nil {
			return nil, err
		}
	}

	// Last: an option can only be linked once its row exists, and the rows of the
	// options the list dropped are already gone, so nothing here can link to one.
	for _, links := range linkChanges {
		changed, err := s.applyOptionParentLinks(transaction, links, now)
		if err != nil {
			return nil, err
		}
		if changed {
			markChanged(links.field.ID)
		}
	}

	return changedFieldIDs, nil
}

// optionParentLinks is what one field's option list says about the hierarchy
// between its options: the links to create, and the options whose links the list
// states in full. See PropertyField.OptionParentLinks, which reads it off the
// list.
type optionParentLinks struct {
	field     *model.PropertyField
	add       []*model.PropertyOptionEdge
	replacing []string
}

// applyOptionParentLinks makes a field's hierarchy match what its option list
// asked for: every option whose parents the list stated ends up with exactly
// those, and no other option's links are touched. It reports whether anything
// actually moved, so a list that restated the hierarchy it already had is not
// broadcast as a change.
//
// A link the list restated keeps the row it already had rather than being deleted
// and written again, which is what makes CreateAt on an edge mean when the
// relationship was recorded.
//
// Nothing here checks the shape the resulting hierarchy has -- no cycles, bounded
// depth, bounded fan-in -- for the same reason MutateOptions does not: each is a
// property of the whole hierarchy rather than of the rows in front of it, and
// PropertyService.validateOptionBlobLinks is where a field write has them
// checked.
func (s *SqlPropertyFieldStore) applyOptionParentLinks(transaction *sqlxTxWrapper, links optionParentLinks, now int64) (bool, error) {
	field := links.field

	// The type of the field as it is being written, which for a field created by
	// linking to a template is the template's: the request that created it need not
	// have mentioned the graph type at all.
	if field.Type != model.PropertyFieldTypeGraph {
		return false, store.NewErrInvalidInput("PropertyOptionEdge", "field_id", field.ID).
			Wrap(errors.Errorf("options of a %s field have no hierarchy to link", field.Type))
	}

	endpoints := make([]string, 0, len(links.add)*2)
	for _, edge := range links.add {
		endpoints = append(endpoints, edge.ChildOptionID, edge.ParentOptionID)
	}
	if err := s.requireOwnedOptions(transaction, field.ID, utils.RemoveDuplicatesFromStringArray(endpoints)); err != nil {
		return false, err
	}

	keep := make(map[[2]string]bool, len(links.add))
	for _, edge := range links.add {
		keep[[2]string{edge.ChildOptionID, edge.ParentOptionID}] = true
	}

	current, err := s.optionParentEdges(transaction, field.ID, links.replacing)
	if err != nil {
		return false, err
	}
	var remove []*model.PropertyOptionEdge
	stored := make(map[[2]string]bool, len(current))
	for _, edge := range current {
		pair := [2]string{edge.ChildOptionID, edge.ParentOptionID}
		stored[pair] = true
		if !keep[pair] {
			remove = append(remove, edge)
		}
	}

	// Batched for the same reason every other statement carrying option
	// identifiers is: one option list can describe a hierarchy of any size, and a
	// statement has a hard ceiling on how many parameters it may take (see
	// maxOptionIDsPerQuery). Each edge costs two parameters here and four below.
	for batch := range slices.Chunk(remove, maxOptionIDsPerQuery) {
		matches := sq.Or{}
		for _, edge := range batch {
			matches = append(matches, sq.Eq{
				"ChildOptionID":  edge.ChildOptionID,
				"ParentOptionID": edge.ParentOptionID,
			})
		}
		builder := s.getQueryBuilder().
			Delete("PropertyOptionEdges").
			Where(sq.Eq{"FieldID": field.ID}).
			Where(matches)

		if _, err := transaction.ExecBuilder(builder); err != nil {
			return false, errors.Wrap(err, "property_option_links_delete_exec")
		}
	}

	var added int
	for batch := range slices.Chunk(links.add, maxOptionIDsPerQuery) {
		builder := s.getQueryBuilder().
			Insert("PropertyOptionEdges").
			Columns(propertyOptionEdgeColumns...)
		for _, edge := range batch {
			builder = builder.Values(field.ID, edge.ChildOptionID, edge.ParentOptionID, now)
			if !stored[[2]string{edge.ChildOptionID, edge.ParentOptionID}] {
				added++
			}
		}
		// DO NOTHING rather than DO UPDATE, as in MutateOptions: an edge has nothing
		// to update, and the same link stated twice in one list conflicts with itself.
		builder = builder.Suffix("ON CONFLICT (FieldID, ChildOptionID, ParentOptionID) DO NOTHING")

		if _, err := transaction.ExecBuilder(builder); err != nil {
			return false, errors.Wrap(err, "property_option_links_insert_exec")
		}
	}

	return added > 0 || len(remove) > 0, nil
}

func equalStringPtr(a, b *string) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

// propertyOptionRowChanged compares everything a write can alter. CreateAt,
// GroupID, and FieldID are excluded: the first is carried over from the existing
// row and the other two cannot change without the option being a different one.
func propertyOptionRowChanged(current, next *propertyOptionRow) bool {
	if current.SortOrder != next.SortOrder || len(current.Attrs) != len(next.Attrs) {
		return true
	}
	if !equalStringPtr(current.Name, next.Name) || !equalStringPtr(current.Color, next.Color) {
		return true
	}
	if (current.Rank == nil) != (next.Rank == nil) || (current.Rank != nil && *current.Rank != *next.Rank) {
		return true
	}

	// No extra keys either side. Worth its own case because a scanned row's Attrs
	// is an allocated empty map while a decomposed option's is nil, and the two
	// do not marshal alike.
	if len(next.Attrs) == 0 {
		return false
	}

	// Attrs holds whatever a caller put on the option, so it is compared as the
	// JSON it will be stored as rather than key by key: a value that arrived as a
	// Go int and one that arrived as JSON are the same stored option.
	currentAttrs, err := current.Attrs.Value()
	if err != nil {
		return true
	}
	nextAttrs, err := next.Attrs.Value()
	if err != nil {
		return true
	}
	return currentAttrs != nextAttrs
}

// upsertPropertyOptions writes new options and updates changed ones in a single
// statement. The conflict target is the primary key, so an option a caller
// re-submits under an ID the field already used keeps its identity and its
// CreateAt, and a re-added option comes back from being soft-deleted.
func (s *SqlPropertyFieldStore) upsertPropertyOptions(transaction *sqlxTxWrapper, rows []*propertyOptionRow) error {
	builder := s.getQueryBuilder().
		Insert("PropertyOptions").
		Columns(propertyOptionColumns...)
	for _, row := range rows {
		builder = builder.Values(row.insertValues()...)
	}
	builder = builder.Suffix(`ON CONFLICT (FieldID, ID) DO UPDATE SET
	Name = EXCLUDED.Name,
	Color = EXCLUDED.Color,
	Rank = EXCLUDED.Rank,
	SortOrder = EXCLUDED.SortOrder,
	Attrs = EXCLUDED.Attrs,
	UpdateAt = EXCLUDED.UpdateAt,
	DeleteAt = 0`)

	if _, err := transaction.ExecBuilder(builder); err != nil {
		return errors.Wrap(err, "property_options_upsert_exec")
	}
	return nil
}
