// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"math"
	"slices"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
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
//	anything else -> the option's own Attrs
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
	for key, value := range r.Attrs {
		opt[key] = value
	}
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

	promoted := []string{optionKeyID}
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

// optionsWithheld reports whether a field's attrs came from a read that left the
// option list out because the field has too many. Writing such a field back must
// not be read as "this field now has no options".
func optionsWithheld(field *model.PropertyField) bool {
	if field.Attrs == nil {
		return false
	}
	withheld, _ := field.Attrs[model.PropertyFieldAttributeOptionsOmitted].(bool)
	return withheld
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
	}

	return changedFieldIDs, nil
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
