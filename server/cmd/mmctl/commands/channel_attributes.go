// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"slices"
	"strings"

	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

const (
	channelAttributeOptionsPageSize = 200
	channelAttributeValuesPageSize  = 200

	missingRequiredAttributesErrorID = "api.channel.create_channel.missing_required_attributes.app_error"
)

var ChannelAttributesCmd = &cobra.Command{
	Use:   "attributes",
	Short: "Management of channel attribute values",
	Long:  "Show the channel attributes defined on the server and list or set the values a channel holds.",
}

var ChannelAttributesFieldsCmd = &cobra.Command{
	Use:   "fields",
	Short: "List the channel attributes",
	Long: `List the channel attributes you can see, with their type, whether they are required, and their options.

Use these names and options with --attribute.`,
	Example: `  channel attributes fields
  channel attributes fields --json`,
	Args: cobra.NoArgs,
	RunE: withClient(channelAttributesFieldsCmdF),
}

var ChannelAttributesListCmd = &cobra.Command{
	Use:   "list [channel]",
	Short: "List the attribute values of a channel",
	Long: `List the attribute values a channel holds.
Channel can be specified by [team]:[channel]. ie. myteam:mychannel or by channel ID.`,
	Example: `  channel attributes list myteam:mychannel
  channel attributes list myteam:mychannel --json`,
	Args: cobra.ExactArgs(1),
	RunE: withClient(channelAttributesListCmdF),
}

var ChannelAttributesSetCmd = &cobra.Command{
	Use:   "set [channel]",
	Short: "Set attribute values on a channel",
	Long: `Set attribute values on a channel. The values you pass replace the ones the channel holds for those attributes.

Pass each value with --attribute "<attribute>=<value>". The attribute can be its name or its ID, and a select value can be an option name or option ID. Quote the argument when it contains spaces. The text splits on the first "=", so a value may contain "=" and commas.

An attribute that holds one value (select, text) can be passed only once. Repeat --attribute to set several values on a multiselect attribute. Run "mmctl channel attributes fields" to see the attributes and their options.

Channel can be specified by [team]:[channel]. ie. myteam:mychannel or by channel ID.`,
	Example: `  channel attributes set myteam:mychannel --attribute "Classification=Secret"
  channel attributes set myteam:mychannel --attribute "Region=EMEA" --attribute "Region=APAC"
  channel attributes set myteam:mychannel --attribute "Notes=Review in Q3, then archive"`,
	Args: cobra.ExactArgs(1),
	RunE: withClient(channelAttributesSetCmdF),
}

func init() {
	ChannelAttributesSetCmd.Flags().StringArray("attribute", nil, `Attribute value to set, as "<attribute>=<value>". Repeat the flag to set several attributes or several values of a multiselect attribute`)
	_ = ChannelAttributesSetCmd.MarkFlagRequired("attribute")

	ChannelAttributesCmd.AddCommand(
		ChannelAttributesFieldsCmd,
		ChannelAttributesListCmd,
		ChannelAttributesSetCmd,
	)

	ChannelCmd.AddCommand(ChannelAttributesCmd)
}

// attributeArg is one --attribute flag, split on its first "=".
type attributeArg struct {
	Field string
	Value string
}

func parseAttributeFlags(cmd *cobra.Command) ([]attributeArg, error) {
	raw, err := cmd.Flags().GetStringArray("attribute")
	if err != nil {
		return nil, err
	}

	var args []attributeArg
	for _, text := range raw {
		name, value, found := strings.Cut(text, "=")
		if !found {
			return nil, fmt.Errorf(`invalid --attribute %q: expected "<attribute>=<value>"`, text)
		}
		name = strings.TrimSpace(name)
		if name == "" {
			return nil, fmt.Errorf("invalid --attribute %q: the attribute is empty", text)
		}
		value = strings.TrimSpace(value)
		if value == "" {
			return nil, fmt.Errorf("attribute %q has no value; clearing values isn't supported", name)
		}
		args = append(args, attributeArg{Field: name, Value: value})
	}
	return args, nil
}

// channelAttributeResolver turns the attribute and option names a person typed
// into the IDs the server stores. It reads the fields once and each field's
// options at most once.
type channelAttributeResolver struct {
	client  client.Client
	fields  []*model.PropertyField
	options map[string][]*model.PropertyFieldOption
}

func newChannelAttributeResolver(c client.Client) (*channelAttributeResolver, error) {
	fields, resp, err := c.SearchPropertyFields(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldSearch{
		ObjectTypes: []string{model.PropertyFieldObjectTypeChannel},
		TargetType:  model.PropertyValueTargetTypeSystem,
		PerPage:     model.AccessControlGroupFieldLimit + 5,
	})
	if err != nil {
		if resp != nil && resp.StatusCode == http.StatusNotFound {
			return nil, errors.New("channel attributes aren't enabled on this server")
		}
		return nil, fmt.Errorf("failed to get the channel attributes: %w", err)
	}

	return &channelAttributeResolver{
		client:  c,
		fields:  fields,
		options: make(map[string][]*model.PropertyFieldOption),
	}, nil
}

// isMasked reports whether the server masks the field's values, so a read can
// leave out a value the channel holds. The server reports it in
// permissions.masking, which it serves only when property field permissions are
// enabled; without it a masked field looks like any other.
func isMasked(field *model.PropertyField) bool {
	return field != nil && field.Permissions != nil && field.Permissions.Masking != nil
}

// fieldByID returns the field the search returned for id, or nil.
func (r *channelAttributeResolver) fieldByID(id string) *model.PropertyField {
	for _, field := range r.fields {
		if field.ID == id {
			return field
		}
	}
	return nil
}

// findField matches typed against the field IDs, then the exact names, then the
// names ignoring case when exactly one field matches.
func (r *channelAttributeResolver) findField(typed string) (*model.PropertyField, error) {
	for _, field := range r.fields {
		if field.ID == typed {
			return field, nil
		}
	}

	matches := make([]*model.PropertyField, 0, 1)
	for _, field := range r.fields {
		if field.Name == typed {
			matches = append(matches, field)
		}
	}
	if len(matches) == 0 {
		for _, field := range r.fields {
			if strings.EqualFold(field.Name, typed) {
				matches = append(matches, field)
			}
		}
	}

	switch len(matches) {
	case 0:
		return nil, fmt.Errorf(`unknown channel attribute %q; run "mmctl channel attributes fields" to see them`, typed)
	case 1:
		return matches[0], nil
	}

	ids := make([]string, 0, len(matches))
	for _, field := range matches {
		ids = append(ids, field.ID)
	}
	return nil, fmt.Errorf("channel attribute %q matches more than one attribute; use one of these IDs instead: %s", typed, strings.Join(ids, ", "))
}

// optionsOf returns the field's options from attrs.options, or pages through the
// options endpoint when the server left them out because there are too many.
func (r *channelAttributeResolver) optionsOf(field *model.PropertyField) ([]*model.PropertyFieldOption, error) {
	if options, ok := r.options[field.ID]; ok {
		return options, nil
	}

	var options []*model.PropertyFieldOption
	if model.PropertyFieldOptionsOmitted(field.Attrs) {
		paged, err := r.listOptions(field)
		if err != nil {
			return nil, err
		}
		options = paged
	} else if raw, ok := field.Attrs[model.PropertyFieldAttributeOptions]; ok {
		decoded, err := model.NewPropertyOptionsFromFieldAttrs[*model.PropertyFieldOption](raw)
		if err != nil {
			return nil, fmt.Errorf("failed to read the options of attribute %q: %w", field.Name, err)
		}
		options = decoded
	}

	r.options[field.ID] = options
	return options, nil
}

func (r *channelAttributeResolver) listOptions(field *model.PropertyField) ([]*model.PropertyFieldOption, error) {
	var options []*model.PropertyFieldOption
	var cursorCreateAt int64
	var cursorID string
	for {
		page, _, err := r.client.GetPropertyFieldOptions(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeChannel, field.ID, cursorCreateAt, cursorID, channelAttributeOptionsPageSize)
		if err != nil {
			return nil, fmt.Errorf("failed to get the options of attribute %q: %w", field.Name, err)
		}
		options = append(options, page.Options...)
		if !page.HasMore {
			return options, nil
		}
		if page.NextCursorCreateAt == cursorCreateAt && page.NextCursorID == cursorID {
			return nil, fmt.Errorf("failed to get the options of attribute %q: the server returned the same page twice", field.Name)
		}
		cursorCreateAt, cursorID = page.NextCursorCreateAt, page.NextCursorID
	}
}

// findOption matches typed against the option IDs, then the exact names, then
// the names ignoring case when exactly one option matches.
func (r *channelAttributeResolver) findOption(field *model.PropertyField, fieldTyped, typed string) (*model.PropertyFieldOption, error) {
	options, err := r.optionsOf(field)
	if err != nil {
		return nil, err
	}

	for _, option := range options {
		if option.ID == typed {
			return option, nil
		}
	}

	matches := make([]*model.PropertyFieldOption, 0, 1)
	for _, option := range options {
		if option.Name == typed {
			matches = append(matches, option)
		}
	}
	if len(matches) == 0 {
		for _, option := range options {
			if strings.EqualFold(option.Name, typed) {
				matches = append(matches, option)
			}
		}
	}

	switch len(matches) {
	case 0:
		return nil, fmt.Errorf("unknown option %q for attribute %q; the options are: %s", typed, fieldTyped, strings.Join(optionNames(options), ", "))
	case 1:
		return matches[0], nil
	}
	return nil, fmt.Errorf("option %q of attribute %q matches more than one option (%s); use the exact name or the option ID", typed, fieldTyped, strings.Join(optionNames(matches), ", "))
}

func optionNames(options []*model.PropertyFieldOption) []string {
	names := make([]string, 0, len(options))
	for _, option := range options {
		names = append(names, option.Name)
	}
	return names
}

type pendingChannelAttribute struct {
	field  *model.PropertyField
	typed  []string
	values []string
}

// resolve turns the typed arguments into the items of a values request, one per
// field in the order each field first appears. It sends nothing, so a failure
// here leaves the server untouched.
func (r *channelAttributeResolver) resolve(args []attributeArg) ([]model.PropertyValuePatchItem, error) {
	var pending []*pendingChannelAttribute
	byField := make(map[string]*pendingChannelAttribute, len(args))
	for _, arg := range args {
		field, err := r.findField(arg.Field)
		if err != nil {
			return nil, err
		}
		entry, ok := byField[field.ID]
		if !ok {
			entry = &pendingChannelAttribute{field: field}
			byField[field.ID] = entry
			pending = append(pending, entry)
		}
		entry.typed = append(entry.typed, arg.Field)
		entry.values = append(entry.values, arg.Value)
	}

	items := make([]model.PropertyValuePatchItem, 0, len(pending))
	for _, entry := range pending {
		value, err := r.encode(entry)
		if err != nil {
			return nil, err
		}
		items = append(items, model.PropertyValuePatchItem{FieldID: entry.field.ID, Value: value})
	}
	return items, nil
}

func (r *channelAttributeResolver) encode(entry *pendingChannelAttribute) (json.RawMessage, error) {
	field := entry.field
	switch field.Type {
	case model.PropertyFieldTypeSelect, model.PropertyFieldTypeRank:
		if len(entry.values) > 1 {
			return nil, fmt.Errorf("attribute %q is a %s and can only be given once", entry.typed[1], field.Type)
		}
		option, err := r.findOption(field, entry.typed[0], entry.values[0])
		if err != nil {
			return nil, err
		}
		return json.Marshal(option.ID)

	case model.PropertyFieldTypeMultiselect:
		ids := make([]string, 0, len(entry.values))
		for i, value := range entry.values {
			option, err := r.findOption(field, entry.typed[i], value)
			if err != nil {
				return nil, err
			}
			if !slices.Contains(ids, option.ID) {
				ids = append(ids, option.ID)
			}
		}
		return json.Marshal(ids)

	case model.PropertyFieldTypeText:
		if len(entry.values) > 1 {
			return nil, fmt.Errorf("attribute %q is a text and can only be given once", entry.typed[1])
		}
		return json.Marshal(entry.values[0])
	}

	return nil, fmt.Errorf("attribute %q has type %s, which mmctl can't set", entry.typed[0], field.Type)
}

type channelAttributeOptionOutput struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type channelAttributeFieldOutput struct {
	ID       string                         `json:"id"`
	Name     string                         `json:"name"`
	Type     string                         `json:"type"`
	Required bool                           `json:"required"`
	Options  []channelAttributeOptionOutput `json:"options"`
}

func (f channelAttributeFieldOutput) PlainLine() string {
	kind := f.Type
	if f.Required {
		kind += ", required"
	}
	line := fmt.Sprintf("%s (%s)", f.Name, kind)
	if len(f.Options) > 0 {
		names := make([]string, 0, len(f.Options))
		for _, option := range f.Options {
			names = append(names, option.Name)
		}
		line += ": " + strings.Join(names, ", ")
	}
	return line
}

type channelAttributeValueOutput struct {
	FieldID   string `json:"field_id"`
	FieldName string `json:"field_name"`
	Value     any    `json:"value"`
	display   string
}

func (v channelAttributeValueOutput) PlainLine() string {
	return v.FieldName + ": " + v.display
}

// describeValue reads a stored value for output: option IDs become {id, name}.
// A value whose field the caller can't see keeps its raw form.
func (r *channelAttributeResolver) describeValue(value *model.PropertyValue) (channelAttributeValueOutput, error) {
	output := channelAttributeValueOutput{FieldID: value.FieldID, FieldName: value.FieldID}

	var field *model.PropertyField
	for _, candidate := range r.fields {
		if candidate.ID == value.FieldID {
			field = candidate
			break
		}
	}

	var decoded any
	rawDisplay := string(value.Value)
	if err := json.Unmarshal(value.Value, &decoded); err != nil {
		output.Value, output.display = rawDisplay, rawDisplay
		return output, nil
	}
	if text, ok := decoded.(string); ok {
		rawDisplay = text
	}
	output.Value, output.display = decoded, rawDisplay
	if field == nil {
		return output, nil
	}
	output.FieldName = field.Name

	if field.Type != model.PropertyFieldTypeSelect && field.Type != model.PropertyFieldTypeRank && field.Type != model.PropertyFieldTypeMultiselect {
		return output, nil
	}

	options, err := r.optionsOf(field)
	if err != nil {
		return output, err
	}
	named := func(id string) channelAttributeOptionOutput {
		for _, option := range options {
			if option.ID == id {
				return channelAttributeOptionOutput{ID: id, Name: option.Name}
			}
		}
		return channelAttributeOptionOutput{ID: id, Name: id}
	}

	switch ids := decoded.(type) {
	case string:
		option := named(ids)
		output.Value, output.display = option, option.Name
	case []any:
		resolved := make([]channelAttributeOptionOutput, 0, len(ids))
		names := make([]string, 0, len(ids))
		for _, id := range ids {
			text, ok := id.(string)
			if !ok {
				return output, nil
			}
			option := named(text)
			resolved = append(resolved, option)
			names = append(names, option.Name)
		}
		output.Value, output.display = resolved, strings.Join(names, ", ")
	}
	return output, nil
}

func (r *channelAttributeResolver) printValues(values []*model.PropertyValue) error {
	for _, value := range values {
		output, err := r.describeValue(value)
		if err != nil {
			return err
		}
		printer.PrintT("{{.PlainLine}}", output)
	}
	return nil
}

func channelAttributesFieldsCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	resolver, err := newChannelAttributeResolver(c)
	if err != nil {
		return err
	}

	for _, field := range resolver.fields {
		output := channelAttributeFieldOutput{
			ID:       field.ID,
			Name:     field.Name,
			Type:     string(field.Type),
			Required: model.IsPropertyFieldRequired(field),
			Options:  []channelAttributeOptionOutput{},
		}
		if field.Type.SupportsOptions() {
			options, err := resolver.optionsOf(field)
			if err != nil {
				return err
			}
			for _, option := range options {
				output.Options = append(output.Options, channelAttributeOptionOutput{ID: option.ID, Name: option.Name})
			}
		}
		printer.PrintT("{{.PlainLine}}", output)
	}
	return nil
}

func channelAttributesListCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	channel := getChannelFromChannelArg(c, args[0])
	if channel == nil {
		return fmt.Errorf("channel %q was not found", args[0])
	}

	resolver, err := newChannelAttributeResolver(c)
	if err != nil {
		return err
	}

	values, err := listChannelAttributeValues(c, channel.Id)
	if err != nil {
		return err
	}

	held := make([]*model.PropertyValue, 0, len(values))
	for _, value := range values {
		if !model.IsEmptyPropertyValue(value.Value) {
			held = append(held, value)
		}
	}
	return resolver.printValues(held)
}

func channelAttributesSetCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	attrArgs, err := parseAttributeFlags(cmd)
	if err != nil {
		return err
	}

	channel := getChannelFromChannelArg(c, args[0])
	if channel == nil {
		return fmt.Errorf("channel %q was not found", args[0])
	}

	resolver, err := newChannelAttributeResolver(c)
	if err != nil {
		return err
	}

	items, err := resolver.resolve(attrArgs)
	if err != nil {
		return err
	}

	stored, _, err := c.PatchPropertyValues(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeChannel, channel.Id, items)
	if err != nil {
		return fmt.Errorf("failed to set the channel attribute values: %w", err)
	}
	return resolver.printValues(stored)
}

// listChannelAttributeValues reads every value the channel holds, page by page.
func listChannelAttributeValues(c client.Client, channelID string) ([]*model.PropertyValue, error) {
	var values []*model.PropertyValue
	search := model.PropertyValueSearch{PerPage: channelAttributeValuesPageSize}
	for {
		page, _, err := c.GetPropertyValues(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeChannel, channelID, search)
		if err != nil {
			return nil, fmt.Errorf("failed to get the channel attribute values: %w", err)
		}
		values = append(values, page...)
		if len(page) < channelAttributeValuesPageSize {
			return values, nil
		}
		last := page[len(page)-1]
		search.CursorID, search.CursorCreateAt = last.ID, last.CreateAt
	}
}

// createChannelWithAttributes creates the channel with the --attribute values.
// The values are resolved before anything is sent.
func createChannelWithAttributes(c client.Client, cmd *cobra.Command, channel *model.Channel) (*model.Channel, error) {
	attrArgs, err := parseAttributeFlags(cmd)
	if err != nil {
		return nil, err
	}

	resolver, err := newChannelAttributeResolver(c)
	if err != nil {
		return nil, err
	}

	items, err := resolver.resolve(attrArgs)
	if err != nil {
		return nil, err
	}

	newChannel, _, err := c.CreateChannelWithPropertyValues(context.TODO(), &model.ChannelCreateRequest{Channel: *channel, PropertyValues: items})
	if err != nil {
		return nil, missingRequiredHint(c, resolver, err, items, "")
	}

	// The channel exists whatever the read-back finds, so it is returned with
	// the error and the caller still reports the creation.
	return newChannel, verifySaved(c, resolver, newChannel.Id, items, "created")
}

// makeChannelPrivateWithAttributes makes the channel private with the
// --attribute values. The values are resolved before anything is sent.
func makeChannelPrivateWithAttributes(c client.Client, cmd *cobra.Command, channel *model.Channel) error {
	attrArgs, err := parseAttributeFlags(cmd)
	if err != nil {
		return err
	}

	resolver, err := newChannelAttributeResolver(c)
	if err != nil {
		return err
	}

	items, err := resolver.resolve(attrArgs)
	if err != nil {
		return err
	}

	if _, _, err := c.UpdateChannelPrivacyWithPropertyValues(context.TODO(), channel.Id, model.ChannelTypePrivate, items); err != nil {
		return missingRequiredHint(c, resolver, err, items, channel.Id)
	}

	return verifySaved(c, resolver, channel.Id, items, "updated")
}

// restoreChannelWithAttributes resolves the --attribute values once, before
// anything is sent, and returns a function that unarchives one channel with
// them.
func restoreChannelWithAttributes(c client.Client, cmd *cobra.Command) (func(channel *model.Channel) error, error) {
	attrArgs, err := parseAttributeFlags(cmd)
	if err != nil {
		return nil, err
	}

	resolver, err := newChannelAttributeResolver(c)
	if err != nil {
		return nil, err
	}

	items, err := resolver.resolve(attrArgs)
	if err != nil {
		return nil, err
	}

	return func(channel *model.Channel) error {
		if _, _, err := c.RestoreChannelWithPropertyValues(context.TODO(), channel.Id, items); err != nil {
			return missingRequiredHint(c, resolver, err, items, channel.Id)
		}
		return verifySaved(c, resolver, channel.Id, items, "unarchived")
	}, nil
}

func isMissingRequiredError(err error) bool {
	var appErr *model.AppError
	return errors.As(err, &appErr) && appErr.Id == missingRequiredAttributesErrorID
}

// missingRequiredHint returns err unchanged unless the server refused because
// required attributes are missing. In that case it adds the names of the
// required attributes the caller didn't pass, taken from the fields the server
// returns to this caller. Pass the channel's ID when the channel exists, so
// attributes it already holds aren't named. With nothing to name, only the
// server's message is left.
//
// A nil resolver means the command ran without --attribute and nothing was
// looked up before the request; the fields are fetched now. If they can't be
// fetched, err is returned unchanged.
func missingRequiredHint(c client.Client, resolver *channelAttributeResolver, err error, sent []model.PropertyValuePatchItem, channelID string) error {
	if !isMissingRequiredError(err) {
		return err
	}

	if resolver == nil {
		created, resolverErr := newChannelAttributeResolver(c)
		if resolverErr != nil {
			return err
		}
		resolver = created
	}

	held := make(map[string]bool, len(sent))
	for _, item := range sent {
		held[item.FieldID] = true
	}
	if channelID != "" {
		values, listErr := listChannelAttributeValues(c, channelID)
		if listErr != nil {
			return err
		}
		for _, value := range values {
			if !model.IsEmptyPropertyValue(value.Value) {
				held[value.FieldID] = true
			}
		}
		// The read can't show a value the server masks, so a masked field
		// that wasn't sent may be held or missing; it isn't named.
		for _, field := range resolver.fields {
			if isMasked(field) {
				held[field.ID] = true
			}
		}
	}

	var names []string
	for _, field := range resolver.fields {
		if model.IsPropertyFieldRequired(field) && !held[field.ID] {
			names = append(names, field.Name)
		}
	}
	if len(names) == 0 {
		return err
	}

	return fmt.Errorf("%w\nRequired channel attributes not passed: %s\nPass each one with --attribute \"<attribute>=<value>\". Run \"mmctl channel attributes fields\" to see them.", err, strings.Join(names, ", "))
}

// verifySaved reads the channel's values once and checks that every field that
// was sent holds what was sent, leaving out masked fields, which the read may
// not show. A server that predates the request body ignores
// it and answers success. done is the past tense of what happened to the
// channel: "created", "updated" or "unarchived".
func verifySaved(c client.Client, resolver *channelAttributeResolver, channelID string, sent []model.PropertyValuePatchItem, done string) error {
	values, err := listChannelAttributeValues(c, channelID)
	if err != nil {
		return fmt.Errorf("the channel was %s, but its attribute values could not be checked: %w", done, err)
	}

	stored := make(map[string]json.RawMessage, len(values))
	for _, value := range values {
		stored[value.FieldID] = value.Value
	}

	for _, item := range sent {
		if isMasked(resolver.fieldByID(item.FieldID)) {
			continue
		}
		if !jsonEqual(stored[item.FieldID], item.Value) {
			return fmt.Errorf("the channel was %s, but the server didn't save the attribute values; the server may be older than this mmctl", done)
		}
	}
	return nil
}

func jsonEqual(a, b json.RawMessage) bool {
	var left, right any
	if json.Unmarshal(a, &left) != nil || json.Unmarshal(b, &right) != nil {
		return false
	}
	return reflect.DeepEqual(left, right)
}
