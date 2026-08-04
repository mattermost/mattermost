// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// A field's options can be read and changed one at a time here, addressed
// individually, rather than only as the whole list the field carries inline. That
// is what a graph field needs: its hierarchy is meant to reach thousands of
// options, far past the point where the field serves the list at all, so every
// change after the first has to name the options it touches.
//
// Three rules run through all of it:
//
//   - A field's *effective* option set is what it owns plus what it inherits from
//     the template it links to. Reads cover the whole of it; writes only ever
//     touch the options the field owns itself, and an inherited option is
//     reported read-only. Changing one means changing it on the template, which
//     every field linking to that template then serves.
//   - An option name identifies an option. Parents are named rather than
//     identified because a name is the only reference available where options are
//     written as part of the field, and names are unique across the effective set,
//     which is what makes the reference unambiguous.
//   - A change is checked as a whole and written as a whole, under the field's
//     UpdateAt as the caller read it. The first thing wrong with it is reported
//     with the position it was in, and nothing is written.

// A rejected change answers with the reason in the *message*, not only in the
// detail. An option payload is refused for one reason at a time and the caller
// has to be able to act on which one -- there is no fixing a payload from "the
// options are not valid" -- and a detail does not reach a caller at all: the HTTP
// layer strips it from the response unless the server is in developer mode. So
// the reason is a message parameter, alongside the position of the item at fault.
//
// It is passed as the detail as well, which is what puts it in the server log and
// what a test can assert against without translating it first.
//
// It follows that these do not wrap ErrInvalidFieldAttrs, whose mapping would
// discard the shaped error and put the reason back in the detail alone. Anything
// reaching here from code that does -- the shared graph validation -- goes
// through optionsChangeFromValidation.
const optionsChangeWhere = "PropertyFieldOptions"

// optionsChangeError reports something wrong with the item at the given position
// of an options payload.
func optionsChangeError(index int, format string, args ...any) error {
	reason := fmt.Sprintf(format, args...)
	return model.NewAppError(optionsChangeWhere, "app.property_field.options.invalid_item.app_error",
		map[string]any{"Index": index, "Reason": reason}, fmt.Sprintf("options[%d] %s", index, reason), http.StatusBadRequest)
}

// optionsChangeRefused reports something wrong with an options payload as a
// whole, or with the field it is aimed at.
func optionsChangeRefused(format string, args ...any) error {
	reason := fmt.Sprintf(format, args...)
	return model.NewAppError(optionsChangeWhere, "app.property_field.options.invalid.app_error",
		map[string]any{"Reason": reason}, reason, http.StatusBadRequest)
}

// optionsChangeFromValidation restates a rejection from the shared graph
// validation so that its reason reaches the caller. That validation reports why
// it refused in the error text, wrapped in ErrInvalidFieldAttrs, which the error
// mapping carries as a detail -- and a detail is not in the response. The
// sentinel is what identifies a rejection, so it is also what is trimmed off the
// end of the reason.
//
// Anything that is not a rejection -- a hierarchy that could not be read -- is
// passed through unchanged, to become a server error as it should.
func optionsChangeFromValidation(err error) error {
	if err == nil || !errors.Is(err, ErrInvalidFieldAttrs) {
		return err
	}
	return optionsChangeRefused("%s", strings.TrimSuffix(err.Error(), ": "+ErrInvalidFieldAttrs.Error()))
}

// writableField re-reads the field a change is aimed at and checks that its
// options may be changed one at a time. The re-read field is what the change is
// then validated and written against.
//
// The re-read is not redundant. A caller hands in the field as it read it, and
// that read may have gone to a replica -- every option change is written under
// the UpdateAt it saw, so replication lag alone would make a caller lose a race
// against a write that had already finished, and the answer would be a conflict
// on a request that was never in conflict with anything. Reading the row the
// change is about to swap on narrows the window to the same one the rest of this
// path already has: every other query behind an option change goes to the master
// for the same reason.
//
// It also means the type and the link this decides on are the field's current
// ones, so a field converted or unlinked since the caller read it is judged as it
// is now -- and the same for the attributes the hooks decide access from.
func (ps *PropertyService) writableField(rctx request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	if field == nil {
		return nil, optionsChangeRefused("no property field to change the options of")
	}

	current, err := ps.getPropertyFieldFromMaster(field.GroupID, field.ID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read the property field an option change is aimed at")
	}

	// Asked before anything else about the field, so a caller with no authority
	// over its options is told that rather than being told what shape it is in.
	// This is where a change to a field's options meets the checks a change
	// stated as the field's own option list meets on the field write path.
	if err := ps.runPreChangePropertyFieldOptions(rctx, current); err != nil {
		return nil, err
	}
	if err := requireWritableOptions(current); err != nil {
		return nil, err
	}
	return current, nil
}

// requireWritableOptions refuses a field whose options cannot be changed one at a
// time through this seam.
func requireWritableOptions(field *model.PropertyField) error {
	if field == nil || field.UpdateAt == 0 {
		return optionsChangeRefused("a field's options can only be changed through a field read from the store")
	}
	if err := requireOptionsAddressable(field); err != nil {
		return err
	}

	// A deleted field takes its options with it and there is no undeleting one, so
	// an option written to it is written nowhere anybody will look. Refused rather
	// than quietly accepted, and refused for every type: an edge change on a graph
	// field is already refused deeper down, and one shape of a request answering
	// differently from another is worse than either answer.
	if field.DeleteAt != 0 {
		return optionsChangeRefused("field %s has been deleted", field.ID)
	}

	// A rank field's options are the one kind this cannot write. Every option on
	// one has to carry a positive rank unique within the field, which
	// PropertyFieldOption does not model and this seam has no way to choose: an
	// option created here would have none, and the field would be left in the state
	// the rank validation exists to keep it out of -- unwritable through its own
	// option list, and read as covering nothing where a policy clamps against it.
	// A rank field's options are authored as the field's option list, where the
	// ranks are validated together.
	if field.Type == model.PropertyFieldTypeRank {
		return optionsChangeRefused("the options of a rank field carry an order that is set by writing them as the field's option list")
	}

	// A graph field's option set is owned by exactly one field, and this is one of
	// the two checks that make it so -- the other being that an edge never crosses
	// fields. A local option on a field linking to a graph template could never be
	// given a parent from the template's hierarchy, so it could only form a second
	// hierarchy permanently disconnected from the one the field exists to serve:
	// covered by nothing but itself, and therefore granting nothing.
	//
	// field.Type is read from the field as stored, which matters: a field created
	// with a link to a graph template arrives with no mention of the graph type
	// anywhere in the request, because its type is copied from the template later.
	// A check reading the type from a request would not see this case at all.
	if field.Type == model.PropertyFieldTypeGraph && optionSourceID(field) != "" {
		return optionsChangeRefused(
			"field %s serves the option hierarchy of the template it links to and cannot own options of its own; change them on field %s instead",
			field.ID, optionSourceID(field))
	}
	return nil
}

// requireOptionsAddressable refuses a field whose options cannot be reached one
// at a time at all, for reading or for writing.
//
// A legacy field is refused because it predates everything the rest of this path
// decides with: it carries no object type, no permission levels, and none of the
// access attributes the hooks read, so there is nothing to gate its options by.
// Its options are reachable as the field's own list, which is how they were
// written.
func requireOptionsAddressable(field *model.PropertyField) error {
	if field.IsPSAv1() {
		return optionsChangeRefused("field %s predates addressable options; its option list is part of the field", field.ID)
	}
	if !field.Type.SupportsOptions() {
		return optionsChangeRefused("a %s field has no options", field.Type)
	}
	return nil
}

// requireOptionCount refuses a payload naming no options or more of them than one
// call may carry.
func requireOptionCount(count int, verb string) error {
	if count == 0 {
		return optionsChangeRefused("no options to %s", verb)
	}
	if count > model.PropertyFieldOptionsMaxPerRequest {
		return optionsChangeRefused("names %d options to %s, and no more than %d may be named in one call", count, verb, model.PropertyFieldOptionsMaxPerRequest)
	}
	return nil
}

// optionSourceID returns the template a field inherits options from, or an empty
// string when it inherits none.
func optionSourceID(field *model.PropertyField) string {
	if field.LinkedFieldID == nil {
		return ""
	}
	return *field.LinkedFieldID
}

// GetFieldOptions returns one page of a field's effective option set, ordered by
// creation and continuing after the option the cursor names. Options inherited
// from a template come back flagged read-only, and a graph field's options carry
// the names of the options directly above them.
//
// A page size has to be asked for. Reporting an empty page for a caller that
// forgot one would be indistinguishable from a field with no options, which is
// the mistake the option rows exist to stop being possible.
//
// What comes back is what this caller may see, which on a field whose options are
// access-controlled is less than the rows hold — so filling one page can take
// several pages of rows. A page shorter than the size asked for is therefore the
// end of what the caller may see, which is what a caller paging until a short page
// needs it to be.
func (ps *PropertyService) GetFieldOptions(rctx request.CTX, field *model.PropertyField, cursorCreateAt int64, cursorID string, perPage int) ([]*model.PropertyFieldOption, error) {
	if perPage <= 0 {
		return nil, optionsChangeRefused("a page of options has to be asked for with a positive page size")
	}
	if perPage > model.PropertyFieldOptionsMaxPerRequest {
		return nil, optionsChangeRefused("asks for %d options, and no page may be larger than %d", perPage, model.PropertyFieldOptionsMaxPerRequest)
	}
	// Both halves of the cursor or neither: a page continues after one particular
	// option, and an option's place in the order is its creation time as well as
	// its identifier. Half a cursor would quietly start from the beginning again,
	// which for a caller paging until a short page is a loop that never ends.
	if (cursorID == "") != (cursorCreateAt == 0) {
		return nil, optionsChangeRefused("a cursor names the option a page continues after, by its identifier and its creation time together")
	}
	if field == nil {
		return nil, optionsChangeRefused("no property field to list the options of")
	}
	if err := requireOptionsAddressable(field); err != nil {
		return nil, err
	}

	// A page a caller may see only part of is filled from the rows behind it, not
	// answered short. A caller pages until a page comes back shorter than the size
	// it asked for, so a page that lost most of its options to the hooks would end
	// the listing early and one that lost all of them would end it immediately --
	// and the options the caller may see further down would never be reached. Read
	// on until the page is full or the rows run out, so a short page means what a
	// caller reads it as.
	//
	// The cost of that is a scan: a caller who may see a handful of a large field's
	// options pays for the rows in between to find them, and so does a caller who
	// may see none of them at all -- the answer a source_only field gives everyone
	// but its source plugin, which used to cost one page. Telling those two apart
	// would need a hook able to say "nothing here, ever" as distinct from "nothing
	// on this page", which none of them can express. The scan goes away entirely by
	// asking the rows for the options the caller may see rather than filtering them
	// afterwards, which for a hierarchy means paging the options below the ones the
	// caller holds.
	//
	// An empty page and no page are not the same answer: a hook building its result
	// by appending returns nil when it keeps nothing, and nil serializes as null
	// rather than [], which a caller looping over the page cannot read. Starting
	// from an empty slice settles it for every path out of here.
	options := []*model.PropertyFieldOption{}
	for {
		page, err := ps.fieldStore.GetFieldOptions(field, cursorCreateAt, cursorID, perPage)
		if err != nil {
			return nil, errors.Wrap(err, "failed to read a property field's options")
		}

		visible, err := ps.runPostGetPropertyFieldOptions(rctx, field, page)
		if err != nil {
			return nil, err
		}
		options = append(options, visible...)

		// A page the store answered short is the end of the field's options.
		// Anything else, and the answer is full once perPage of them survived.
		if len(page) < perPage || len(options) >= perPage {
			break
		}
		last := page[len(page)-1]
		cursorCreateAt, cursorID = last.CreateAt, last.ID
	}

	// The last read can carry the answer past the size asked for. The surplus is
	// dropped rather than kept, because the caller continues from the option they
	// were last shown and will be given it on the next page.
	if len(options) > perPage {
		options = options[:perPage]
	}
	return options, nil
}

// CreateFieldOptions adds options to a field, optionally placing each of them
// under options already there or under others in the same payload. Every option
// is created or none is.
func (ps *PropertyService) CreateFieldOptions(rctx request.CTX, field *model.PropertyField, options []*model.PropertyFieldOption) ([]*model.PropertyFieldOption, error) {
	field, err := ps.writableField(rctx, field)
	if err != nil {
		return nil, err
	}
	if err := prepareOptionPayload(field, options, false); err != nil {
		return nil, err
	}

	// The option limit is enforced where options are created, not once per field,
	// because a field grown one option at a time never has a list for
	// PropertyField.IsValid to measure. Only a graph field has a limit: it is the
	// only type whose options something has to traverse.
	if field.Type == model.PropertyFieldTypeGraph {
		held, cErr := ps.fieldStore.CountOptions(field.ID)
		if cErr != nil {
			return nil, errors.Wrap(cErr, "failed to count a property field's options")
		}
		if held+len(options) > model.PropertyGraphMaxOptions {
			return nil, optionsChangeRefused("the field would hold %d options, and no field may hold more than %d", held+len(options), model.PropertyGraphMaxOptions)
		}
	}

	// Every name in the payload is new, so any option already carrying one is a
	// collision. Checked against the effective set: a name that an inherited option
	// already has would make the two indistinguishable as a reference.
	names := make([]string, 0, len(options))
	for _, option := range options {
		names = append(names, option.Name)
	}
	taken, tErr := ps.fieldStore.GetOptionsByName(field, names)
	if tErr != nil {
		return nil, errors.Wrap(tErr, "failed to look up a property field's options by name")
	}
	byName := optionsByName(taken)
	for i, option := range options {
		if existing := byName[option.Name]; existing != nil {
			return nil, optionsChangeError(i, "names option %q, which field %s already has", option.Name, ownerOf(field, existing))
		}
		option.SetID(model.NewId())
	}
	if err := ps.requireNamesFreeOfDependents(field, names); err != nil {
		return nil, err
	}

	add, rErr := ps.resolveOptionParents(field, options, nil)
	if rErr != nil {
		return nil, rErr
	}

	if len(add) > 0 {
		if err := ps.ValidateOptionEdges(field, add, nil); err != nil {
			return nil, optionsChangeFromValidation(err)
		}
	}

	if err := ps.fieldStore.MutateOptions(field.GroupID, field.ID, field.UpdateAt, options, add, nil); err != nil {
		return nil, err
	}

	return ps.readBackOptions(field, options)
}

// UpdateFieldOptions rewrites options a field owns. Each option is replaced by
// what the payload says about it, except that a part the payload leaves out is
// left as it was -- so changing one option's name does not discard its colour, or
// silently detach it from the options above it.
//
// The options as they stood before the change are returned alongside the result.
// A parent link is deleted outright rather than marked, so unless a caller records
// what a change replaced there is nothing left to say the link was ever there.
func (ps *PropertyService) UpdateFieldOptions(rctx request.CTX, field *model.PropertyField, options []*model.PropertyFieldOption) ([]*model.PropertyFieldOption, []*model.PropertyFieldOption, error) {
	field, err := ps.writableField(rctx, field)
	if err != nil {
		return nil, nil, err
	}
	if err := prepareOptionPayload(field, options, true); err != nil {
		return nil, nil, err
	}

	optionIDs := make([]string, 0, len(options))
	for _, option := range options {
		optionIDs = append(optionIDs, option.ID)
	}
	stored, sErr := ps.fieldStore.GetOptionsByID(field, optionIDs)
	if sErr != nil {
		return nil, nil, errors.Wrap(sErr, "failed to read a property field's options")
	}
	byID := make(map[string]*model.PropertyFieldOption, len(stored))
	for _, option := range stored {
		byID[option.ID] = option
	}

	for i, option := range options {
		current := byID[option.ID]
		if current == nil {
			return nil, nil, optionsChangeError(i, "names option %q, which field %s does not have", option.ID, field.ID)
		}
		if current.ReadOnly {
			return nil, nil, optionsChangeError(i, "names option %q, which field %s inherits from field %s; change it there instead", option.ID, field.ID, optionSourceID(field))
		}
		if option.Color == nil {
			option.Color = current.Color
		}
		if option.Attrs == nil {
			option.Attrs = current.Attrs
		}
	}

	// Only a name that is actually changing can collide -- an option keeping its
	// own name would otherwise collide with itself.
	renamed := make([]string, 0, len(options))
	for _, option := range options {
		if byID[option.ID].Name != option.Name {
			renamed = append(renamed, option.Name)
		}
	}
	if len(renamed) > 0 {
		taken, tErr := ps.fieldStore.GetOptionsByName(field, renamed)
		if tErr != nil {
			return nil, nil, errors.Wrap(tErr, "failed to look up a property field's options by name")
		}
		byName := optionsByName(taken)
		for i, option := range options {
			existing := byName[option.Name]
			if existing != nil && existing.ID != option.ID {
				return nil, nil, optionsChangeError(i, "renames option %q to %q, which field %s already has", option.ID, option.Name, ownerOf(field, existing))
			}
		}
		if err := ps.requireNamesFreeOfDependents(field, renamed); err != nil {
			return nil, nil, err
		}
	}

	add, rErr := ps.resolveOptionParents(field, options, byID)
	if rErr != nil {
		return nil, nil, rErr
	}
	remove, dErr := ps.parentsToDetach(field, options, add)
	if dErr != nil {
		return nil, nil, dErr
	}

	if len(add) > 0 || len(remove) > 0 {
		if err := ps.ValidateOptionEdges(field, add, remove); err != nil {
			return nil, nil, optionsChangeFromValidation(err)
		}
	}

	if err := ps.fieldStore.MutateOptions(field.GroupID, field.ID, field.UpdateAt, options, add, remove); err != nil {
		return nil, nil, err
	}

	updated, uErr := ps.readBackOptions(field, options)
	if uErr != nil {
		return nil, nil, uErr
	}
	return updated, inPayloadOrder(options, stored), nil
}

// DeleteFieldOptions removes options a field owns, together with every parent
// link they were part of. The set is judged as a whole, so removing a whole
// branch of a hierarchy is one call even though every option in it but the
// lowest has options below it.
//
// Values pointing at a removed option are left alone. A value naming an option
// that no longer exists is ignored everywhere it is read, which is how the
// property system has always treated one.
func (ps *PropertyService) DeleteFieldOptions(rctx request.CTX, field *model.PropertyField, optionIDs []string) ([]*model.PropertyFieldOption, error) {
	field, err := ps.writableField(rctx, field)
	if err != nil {
		return nil, err
	}
	if err := requireOptionCount(len(optionIDs), "delete"); err != nil {
		return nil, err
	}

	seen := make(map[string]bool, len(optionIDs))
	for i, optionID := range optionIDs {
		if optionID == "" {
			return nil, optionsChangeError(i, "names no option")
		}
		if seen[optionID] {
			return nil, optionsChangeError(i, "names option %q, which is already in the list", optionID)
		}
		seen[optionID] = true
	}

	stored, sErr := ps.fieldStore.GetOptionsByID(field, optionIDs)
	if sErr != nil {
		return nil, errors.Wrap(sErr, "failed to read a property field's options")
	}
	byID := make(map[string]*model.PropertyFieldOption, len(stored))
	for _, option := range stored {
		byID[option.ID] = option
	}
	for i, optionID := range optionIDs {
		option := byID[optionID]
		if option == nil {
			return nil, optionsChangeError(i, "names option %q, which field %s does not have", optionID, field.ID)
		}
		if option.ReadOnly {
			return nil, optionsChangeError(i, "names option %q, which field %s inherits from field %s; delete it there instead", optionID, field.ID, optionSourceID(field))
		}
	}

	at, childID, cErr := ps.blockingChildBelow(field, optionIDs)
	if cErr != nil {
		return nil, cErr
	}
	if at >= 0 {
		return nil, optionsChangeError(at, "names option %q, which option %q is still below; remove that one too or move it first", optionIDs[at], childID)
	}

	if err := ps.fieldStore.DeleteOptions(field.GroupID, field.ID, field.UpdateAt, optionIDs); err != nil {
		return nil, err
	}

	// What was removed, as it stood: an option is soft-deleted and can be read
	// again, but the links it was part of are gone without a trace.
	deleted := make([]*model.PropertyFieldOption, 0, len(optionIDs))
	for _, optionID := range optionIDs {
		deleted = append(deleted, byID[optionID])
	}
	return deleted, nil
}

// FieldWithDependents re-reads a field whose options have just changed, together
// with every live field linking to it -- between them, every field whose readers
// see those options: the one that owns them, and the ones deriving them.
//
// Both halves are read from the master, because a change to them is what prompts
// the read: a replica could answer with the option list from before it, and the
// point of reading at all is to have the list the change left behind. The caller's
// own copy of the field is not that list either -- it was read before the change,
// so its option list and its UpdateAt are both stale.
//
// The two are kept apart rather than returned as one list because they are not
// interchangeable to a caller: the field is the one the request named, and the
// dependents are fields the requester may not even know exist.
func (ps *PropertyService) FieldWithDependents(field *model.PropertyField) (*model.PropertyField, []*model.PropertyField, error) {
	if field == nil {
		return nil, nil, errors.New("no property field to read the dependents of")
	}

	current, err := ps.getPropertyFieldFromMaster(field.GroupID, field.ID)
	if err != nil {
		return nil, nil, errors.Wrap(err, "failed to re-read a property field whose options changed")
	}

	// The field itself is excluded, so that a field somehow linking to itself is
	// reported once rather than twice.
	dependents, err := ps.fieldStore.GetLinkedFields([]string{field.ID}, []string{field.ID})
	if err != nil {
		return nil, nil, errors.Wrap(err, "failed to read the property fields linking to one whose options changed")
	}

	return current, dependents, nil
}

// prepareOptionPayload normalizes and checks an options payload on its own terms:
// everything that can be judged without asking what the field already holds.
// requireID separates the two verbs -- creating an option assigns its identifier,
// changing one names it.
func prepareOptionPayload(field *model.PropertyField, options []*model.PropertyFieldOption, requireID bool) error {
	if err := requireOptionCount(len(options), "write"); err != nil {
		return err
	}

	seen := make(map[string]bool, len(options))
	for i, option := range options {
		if option == nil {
			return optionsChangeError(i, "is not an option")
		}
		option.Name = strings.TrimSpace(option.Name)

		switch {
		case requireID && option.ID == "":
			return optionsChangeError(i, "names no option")
		case !requireID && option.ID != "":
			return optionsChangeError(i, "carries the id %q; an option's identifier is assigned when it is created", option.ID)
		}
		if requireID {
			if seen[option.ID] {
				return optionsChangeError(i, "names option %q, which is already in the list", option.ID)
			}
			seen[option.ID] = true
		}

		if option.Parents != nil && field.Type != model.PropertyFieldTypeGraph {
			return optionsChangeError(i, "carries parents, and the options of a %s field form no hierarchy", field.Type)
		}

		// Reported here rather than by the shape check below so the answer carries
		// the position, which is the whole point of failing on one item.
		if err := option.IsValid(); err != nil {
			return optionsChangeError(i, "is not a valid option: %s", err.Error())
		}
	}

	// Two options sharing a name are refused here, as they are for the option list
	// a field is written with. Its empty-payload check is reached only through the
	// count above, which answers first and says which verb was asked for.
	if err := model.PropertyOptions[*model.PropertyFieldOption](options).IsValid(); err != nil {
		return optionsChangeRefused("%s", err.Error())
	}
	return nil
}

// resolveOptionParents turns the parent names in a payload into the parent links
// they stand for. Only the options that named parents at all are represented: a
// payload that says nothing about an option's parents leaves them alone.
//
// A name resolves against the options the field owns, plus the names the payload
// itself gives its options -- so a hierarchy can be built in one call, and an
// option can be moved under one that is being renamed in the same call. stored
// carries what the payload's options currently look like, and is nil when they
// are being created.
func (ps *PropertyService) resolveOptionParents(field *model.PropertyField, options []*model.PropertyFieldOption, stored map[string]*model.PropertyFieldOption) ([]*model.PropertyOptionEdge, error) {
	var names []string
	for _, option := range options {
		if option.Parents != nil {
			names = append(names, *option.Parents...)
		}
	}
	if len(names) == 0 {
		return nil, nil
	}

	existing, err := ps.fieldStore.GetOptionsByName(field, names)
	if err != nil {
		return nil, errors.Wrap(err, "failed to look up a property field's options by name")
	}
	byName := optionsByName(existing)
	// The payload's own names win, because they are what the options will be called
	// once the change lands. An option renamed here is no longer findable under the
	// name it had.
	for _, option := range options {
		byName[option.Name] = option
	}
	for _, option := range options {
		if current := stored[option.ID]; current != nil && current.Name != option.Name {
			delete(byName, current.Name)
		}
	}

	var add []*model.PropertyOptionEdge
	for i, option := range options {
		if option.Parents == nil {
			continue
		}
		for _, name := range *option.Parents {
			parent := byName[name]
			switch {
			case parent == nil:
				return nil, optionsChangeError(i, "puts option %q under %q, which field %s has no option called", option.Name, name, field.ID)
			case parent.ReadOnly:
				return nil, optionsChangeError(i, "puts option %q under %q, which field %s inherits from field %s; an option can only sit under one of the same field's options", option.Name, name, field.ID, optionSourceID(field))
			case parent.ID == option.ID:
				return nil, optionsChangeError(i, "puts option %q under itself", option.Name)
			}
			add = append(add, &model.PropertyOptionEdge{
				FieldID:        field.ID,
				ChildOptionID:  option.ID,
				ParentOptionID: parent.ID,
			})
		}
	}
	return add, nil
}

// parentsToDetach returns the parent links to remove so that each option the
// payload gave a parent list ends up with exactly that list. add is what the same
// payload resolved to, so a link named in both places stays put rather than being
// dropped and recreated.
func (ps *PropertyService) parentsToDetach(field *model.PropertyField, options []*model.PropertyFieldOption, add []*model.PropertyOptionEdge) ([]*model.PropertyOptionEdge, error) {
	var replacing []string
	for _, option := range options {
		if option.Parents != nil {
			replacing = append(replacing, option.ID)
		}
	}
	return ps.parentsToDetachFor(field, replacing, add)
}

// parentsToDetachFor is parentsToDetach given the options whose parent lists are
// being replaced, for the caller that has those rather than a payload of options.
func (ps *PropertyService) parentsToDetachFor(field *model.PropertyField, replacing []string, add []*model.PropertyOptionEdge) ([]*model.PropertyOptionEdge, error) {
	if len(replacing) == 0 {
		return nil, nil
	}

	// Scoped to the field's own rows: these are the links it may change, and for a
	// field owning its options that is the whole of its hierarchy.
	current, err := ps.fieldStore.GetOptionParentEdges(field.ID, replacing)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read the parents of a graph property field's options")
	}

	keep := make(map[[2]string]bool, len(add))
	for _, edge := range add {
		keep[[2]string{edge.ChildOptionID, edge.ParentOptionID}] = true
	}

	var remove []*model.PropertyOptionEdge
	for _, edge := range current {
		if !keep[[2]string{edge.ChildOptionID, edge.ParentOptionID}] {
			remove = append(remove, edge)
		}
	}
	return remove, nil
}

// readBackOptions returns the options a change wrote as they now stand, rather
// than as the payload described them: the identifiers assigned, the parts left
// untouched, and for a graph field the options each one ended up under.
func (ps *PropertyService) readBackOptions(field *model.PropertyField, written []*model.PropertyFieldOption) ([]*model.PropertyFieldOption, error) {
	optionIDs := make([]string, 0, len(written))
	for _, option := range written {
		optionIDs = append(optionIDs, option.ID)
	}

	// The field's UpdateAt has moved, and GetOptionsByID reads options through the
	// field only to work out which of them are inherited -- which has not changed.
	options, err := ps.fieldStore.GetOptionsByID(field, optionIDs)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read back a property field's options")
	}
	return inPayloadOrder(written, options), nil
}

// inPayloadOrder returns the stored options in the order the payload named them,
// so a record of what a change replaced lines up with the change itself.
func inPayloadOrder(payload, stored []*model.PropertyFieldOption) []*model.PropertyFieldOption {
	byID := make(map[string]*model.PropertyFieldOption, len(stored))
	for _, option := range stored {
		byID[option.ID] = option
	}
	ordered := make([]*model.PropertyFieldOption, 0, len(payload))
	for _, option := range payload {
		if found := byID[option.ID]; found != nil {
			ordered = append(ordered, found)
		}
	}
	return ordered
}

// The option list a field is written with states its hierarchy too: an inline
// option carries the options directly above it by name, under "parents". That is
// the only way to create a hierarchy in one call, and it is the reason the checks
// below exist twice over -- what they check is what the endpoints above check,
// asked of an open-shaped option list instead of a payload of options.
//
// The links themselves are written by the store, inside the same transaction as
// the option rows they join, so an option never exists without the links the same
// write gave it. Everything here only decides whether that write may proceed.
//
// What is checked against the stored hierarchy stays true when the write lands
// for the same reason it does at the endpoints: the field write swaps on the
// UpdateAt of a master read taken before any of this, and every change to a
// field's options or hierarchy moves that UpdateAt. A field being created has
// nothing to race with.

// blockingChildBelow reports the first of the given options that cannot be
// removed, as its position in the list and the identifier of the option still
// below it. The position is -1 when the whole set can go.
//
// An option with something still below it cannot go, because whatever is under it
// would be left hanging off nothing: that turns it into a root -- an option covered
// by nothing but itself -- so every rule that reached it through an option above
// stops matching. Removing the whole branch at once is the supported way, which is
// why this is asked of the set rather than of each option: every option in a branch
// above the lowest has something below it, and what settles the question is whether
// each of those is itself on the way out.
//
// Both ways of deleting an option come through here -- naming it on the options
// endpoint, and leaving it out of the field's option list -- so the rule cannot
// answer differently depending on which was used.
//
// Scoped to the field's own hierarchy, so an option the field merely inherits from
// a template never blocks: it is not this field's to remove, and its children are
// the template's rows.
//
// This is not what keeps a deleted option out of the middle of a hierarchy, and
// nothing relies on it for that. What does, on every path, is that every edge
// touching an option is deleted in the same transaction as the option and that both
// endpoints of a new link have to be live options. So a deleted option has no links
// on either side of it, and no hierarchy walk needs a rule for whether a deleted
// option conducts reachability from what is above it to what is below.
func (ps *PropertyService) blockingChildBelow(field *model.PropertyField, optionIDs []string) (int, string, error) {
	if field.Type != model.PropertyFieldTypeGraph || len(optionIDs) == 0 {
		return -1, "", nil
	}

	edges, err := ps.fieldStore.GetOptionChildEdges(field.ID, optionIDs)
	if err != nil {
		return -1, "", errors.Wrap(err, "failed to read the options below a graph property field's options")
	}

	going := make(map[string]bool, len(optionIDs))
	for _, optionID := range optionIDs {
		going[optionID] = true
	}
	staying := make(map[string]string, len(edges))
	for _, edge := range edges {
		if !going[edge.ChildOptionID] {
			staying[edge.ParentOptionID] = edge.ChildOptionID
		}
	}

	// Walked in the order given, so which refusal a caller is told about is the same
	// run after run.
	for i, optionID := range optionIDs {
		if childID, ok := staying[optionID]; ok {
			return i, childID, nil
		}
	}
	return -1, "", nil
}

// requireDroppedOptionsAreLeaves refuses a field update whose option list leaves
// out an option that still has options below it.
//
// A field write states the field's option list in full, so an option missing from
// the list is an option being deleted: the store soft-deletes every option of the
// field's own that the list no longer carries, and deletes that option's parent
// links with it. Asking for that is asking for the removal the options endpoint
// refuses, by omission rather than by name, and it gets the same answer.
//
// Only for a field that already exists. A field being created has no options to
// leave out.
func (ps *PropertyService) requireDroppedOptionsAreLeaves(submitted, stored *model.PropertyField) error {
	if submitted == nil || stored == nil || stored.Type != model.PropertyFieldTypeGraph {
		return nil
	}

	// A field with more options than are inlined reads back without its option list,
	// and writing that copy back is not a request to drop every option. The store
	// skips the option reconciliation entirely for one, so nothing is dropped and
	// there is nothing to check.
	if model.PropertyFieldOptionsOmitted(submitted.Attrs) {
		return nil
	}

	keeping := make(map[string]bool)
	for _, option := range asOptionSlice(submitted.Attrs) {
		if id, _ := option["id"].(string); id != "" {
			keeping[id] = true
		}
	}

	// The stored list is the field's effective option set, so it includes options
	// owned by a template this field links to. Those are left in: blockingChildBelow
	// asks only about the field's own hierarchy, where an inherited option has no
	// children, so they cannot block -- and a write to this field cannot delete them
	// either.
	var dropped []string
	for _, option := range asOptionSlice(stored.Attrs) {
		if id, _ := option["id"].(string); id != "" && !keeping[id] {
			dropped = append(dropped, id)
		}
	}

	at, childID, err := ps.blockingChildBelow(stored, dropped)
	if err != nil {
		return err
	}
	if at >= 0 {
		return optionsChangeRefused(
			"the option list leaves out option %q, which option %q is still below; leave that one out as well or move it first",
			dropped[at], childID)
	}
	return nil
}

// validateOptionBlobLinks checks the hierarchy a field's inline option list asks
// for. stored is the field as the store has it, and is nil for a field being
// created.
func (ps *PropertyService) validateOptionBlobLinks(submitted, stored *model.PropertyField) error {
	// Assigns an identifier to every option that arrived without one, which is what
	// the links are between. The store runs it again before writing the rows and
	// finds nothing left to do.
	if err := submitted.EnsureOptionIDs(); err != nil {
		return errors.Wrapf(err, "failed to read the options of field %s", submitted.ID)
	}

	add, replacing, err := submitted.OptionParentLinks()
	if err != nil {
		return optionsChangeRefused("%s", err)
	}
	if len(add) == 0 && len(replacing) == 0 {
		return nil
	}

	// Decided against the field as stored wherever there is one, because that is
	// where the field's real type is: a field created by linking to a graph
	// template arrives with no mention of the graph type anywhere in the request.
	// For a field being created the submitted copy is all there is, and by this
	// point it carries the type its link source gave it.
	field := stored
	if field == nil {
		field = submitted
	}

	remove, err := ps.parentsToDetachFor(field, replacing, add)
	if err != nil {
		return err
	}

	// The same validation the endpoints use, including for a field that does not
	// exist yet: it has no hierarchy stored, so every read behind the validation
	// answers empty and what is measured is the list alone -- which is the whole of
	// the hierarchy the field is created with.
	if err := ps.ValidateOptionEdges(field, add, remove); err != nil {
		return optionsChangeFromValidation(err)
	}
	return nil
}

// requireNamesFreeOfDependents refuses a name that an option local to a field
// linking to this one already has. It is the half of option-name uniqueness that
// cannot be judged from the field being written: a name identifies one option
// across a field's whole effective set, and a dependent's set is its own options
// plus this field's, so a name free here can still be taken there.
//
// Refused rather than resolved in either field's favour, because either way a
// dependent would end up serving two options answering to one name -- the state
// that makes every reference by name ambiguous, including the parent references
// above. A write to a field with dependents is rare and deliberate, so failing it
// and leaving the caller to decide which option keeps the name loses nothing.
func (ps *PropertyService) requireNamesFreeOfDependents(field *model.PropertyField, names []string) error {
	if field == nil || len(names) == 0 {
		return nil
	}

	taken, err := ps.fieldStore.GetLinkedFieldOptionNames(field.ID, names)
	if err != nil {
		return errors.Wrap(err, "failed to look up the options of the fields linking to a property field")
	}
	// Walked in the order the names were given, so which collision a caller is
	// told about is the same run after run.
	for _, name := range names {
		if owner, ok := taken[name]; ok {
			return optionsChangeRefused("names option %q, which field %s already has as a local option of its own; that field serves this field's options as well, so the name would answer to two options there", name, owner)
		}
	}
	return nil
}

// optionNamesAddedBy returns the names a submitted option list introduces: the
// ones the field's stored list does not already have under the same identifier.
//
// A name the field already had is left out deliberately. It cannot start
// colliding with anything, and asking about it would make a field whose options
// collided with a dependent's before any of this was checked unwritable until
// somebody found the collision.
func optionNamesAddedBy(submitted, stored model.StringInterface) []string {
	held := make(map[string]string)
	for _, option := range asOptionSlice(stored) {
		if id, _ := option["id"].(string); id != "" {
			held[id], _ = option["name"].(string)
		}
	}

	var added []string
	for _, option := range asOptionSlice(submitted) {
		name, _ := option["name"].(string)
		id, _ := option["id"].(string)
		if name == "" || held[id] == name {
			continue
		}
		added = append(added, name)
	}
	return added
}

// optionsByName indexes options by name. A name is unique across a field's
// effective option set, so at most one option answers to each.
func optionsByName(options []*model.PropertyFieldOption) map[string]*model.PropertyFieldOption {
	byName := make(map[string]*model.PropertyFieldOption, len(options))
	for _, option := range options {
		byName[option.Name] = option
	}
	return byName
}

// ownerOf names the field an option belongs to, for a message that has to
// distinguish the field asked about from the template it inherits from.
func ownerOf(field *model.PropertyField, option *model.PropertyFieldOption) string {
	if option.ReadOnly {
		return optionSourceID(field)
	}
	return field.ID
}
