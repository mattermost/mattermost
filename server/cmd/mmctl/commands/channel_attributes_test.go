// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
	"github.com/pkg/errors"
	"github.com/spf13/cobra"
	"go.uber.org/mock/gomock"
)

type channelAttributeFixture struct {
	classification *model.PropertyField
	program        *model.PropertyField
	region         *model.PropertyField
	notes          *model.PropertyField
	due            *model.PropertyField
}

func newChannelAttributeOptions(names ...string) []*model.PropertyFieldOption {
	options := make([]*model.PropertyFieldOption, 0, len(names))
	for _, name := range names {
		options = append(options, &model.PropertyFieldOption{ID: model.NewId(), Name: name})
	}
	return options
}

func newChannelAttributeFixture() channelAttributeFixture {
	return channelAttributeFixture{
		classification: &model.PropertyField{
			ID:    model.NewId(),
			Name:  "Classification",
			Type:  model.PropertyFieldTypeSelect,
			Attrs: model.StringInterface{"required": true, "options": newChannelAttributeOptions("Unclassified", "Secret", "Top Secret")},
		},
		program: &model.PropertyField{
			ID:    model.NewId(),
			Name:  "Program",
			Type:  model.PropertyFieldTypeSelect,
			Attrs: model.StringInterface{"options": newChannelAttributeOptions("Borealis", "Aurora")},
		},
		region: &model.PropertyField{
			ID:    model.NewId(),
			Name:  "Region",
			Type:  model.PropertyFieldTypeMultiselect,
			Attrs: model.StringInterface{"options": newChannelAttributeOptions("EMEA", "APAC", "AMER")},
		},
		notes: &model.PropertyField{ID: model.NewId(), Name: "Notes", Type: model.PropertyFieldTypeText},
		due:   &model.PropertyField{ID: model.NewId(), Name: "Due", Type: model.PropertyFieldTypeDate},
	}
}

func (f channelAttributeFixture) fields() []*model.PropertyField {
	return []*model.PropertyField{f.classification, f.program, f.region, f.notes, f.due}
}

func optionIDOf(field *model.PropertyField, name string) string {
	for _, option := range field.Attrs["options"].([]*model.PropertyFieldOption) {
		if option.Name == name {
			return option.ID
		}
	}
	return ""
}

func (s *MmctlUnitTestSuite) expectChannelAttributeFieldSearch(fields []*model.PropertyField) {
	s.client.
		EXPECT().
		SearchPropertyFields(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldSearch{
			ObjectTypes: []string{model.PropertyFieldObjectTypeChannel},
			TargetType:  model.PropertyValueTargetTypeSystem,
			PerPage:     model.AccessControlGroupFieldLimit + 5,
		}).
		Return(fields, &model.Response{StatusCode: http.StatusOK}, nil).
		Times(1)
}

func (s *MmctlUnitTestSuite) TestParseAttributeFlags() {
	tests := []struct {
		name    string
		flags   []string
		want    []attributeArg
		wantErr string
	}{
		{name: "no flags", flags: nil, want: nil},
		{name: "name and value", flags: []string{"Program=Borealis"}, want: []attributeArg{{Field: "Program", Value: "Borealis"}}},
		{name: "splits on the first equals sign", flags: []string{"Notes=a=b=c"}, want: []attributeArg{{Field: "Notes", Value: "a=b=c"}}},
		{name: "commas stay in the value", flags: []string{"Notes=one, two,three"}, want: []attributeArg{{Field: "Notes", Value: "one, two,three"}}},
		{name: "attribute and value are trimmed", flags: []string{"  Top Level  =  spaced value "}, want: []attributeArg{{Field: "Top Level", Value: "spaced value"}}},
		{name: "empty value", flags: []string{"Notes="}, wantErr: `attribute "Notes" has no value; clearing values isn't supported`},
		{name: "blank value", flags: []string{" Notes =   "}, wantErr: `attribute "Notes" has no value; clearing values isn't supported`},
		{name: "repeats keep their order", flags: []string{"Region=EMEA", "Program=Aurora", "Region=APAC"}, want: []attributeArg{
			{Field: "Region", Value: "EMEA"},
			{Field: "Program", Value: "Aurora"},
			{Field: "Region", Value: "APAC"},
		}},
		{name: "no equals sign", flags: []string{"Program"}, wantErr: `invalid --attribute "Program": expected "<attribute>=<value>"`},
		{name: "empty attribute", flags: []string{"=Borealis"}, wantErr: `invalid --attribute "=Borealis": the attribute is empty`},
		{name: "blank attribute", flags: []string{"   =Borealis"}, wantErr: `invalid --attribute "   =Borealis": the attribute is empty`},
		{name: "one bad flag among good ones", flags: []string{"Program=Aurora", "Region"}, wantErr: `invalid --attribute "Region": expected "<attribute>=<value>"`},
	}

	for _, tc := range tests {
		s.Run(tc.name, func() {
			cmd := newTestCmd(s.T(), ChannelAttributesSetCmd)
			for _, flag := range tc.flags {
				s.Require().NoError(cmd.Flags().Set("attribute", flag))
			}

			got, err := parseAttributeFlags(cmd)
			if tc.wantErr != "" {
				s.Require().EqualError(err, tc.wantErr)
				s.Nil(got)
				return
			}
			s.Require().NoError(err)
			s.Equal(tc.want, got)
		})
	}
}

func (s *MmctlUnitTestSuite) TestChannelAttributeResolver() {
	f := newChannelAttributeFixture()

	newResolver := func() *channelAttributeResolver {
		s.expectChannelAttributeFieldSearch(f.fields())
		resolver, err := newChannelAttributeResolver(s.client)
		s.Require().NoError(err)
		return resolver
	}

	s.Run("field search not found means the feature is off", func() {
		s.client.
			EXPECT().
			SearchPropertyFields(context.TODO(), model.AccessControlPropertyGroupName, gomock.Any()).
			Return(nil, &model.Response{StatusCode: http.StatusNotFound}, errors.New("not found")).
			Times(1)

		resolver, err := newChannelAttributeResolver(s.client)
		s.Require().EqualError(err, "channel attributes aren't enabled on this server")
		s.Nil(resolver)
	})

	s.Run("other field search errors are surfaced", func() {
		s.client.
			EXPECT().
			SearchPropertyFields(context.TODO(), model.AccessControlPropertyGroupName, gomock.Any()).
			Return(nil, &model.Response{StatusCode: http.StatusForbidden}, errors.New("forbidden by server")).
			Times(1)

		_, err := newChannelAttributeResolver(s.client)
		s.Require().ErrorContains(err, "forbidden by server")
		s.Require().NotContains(err.Error(), "aren't enabled")
	})

	hiddenOptionID := model.NewId()
	successes := []struct {
		name string
		args []attributeArg
		want [][2]string
	}{
		{
			name: "attribute by ID",
			args: []attributeArg{{Field: f.program.ID, Value: "Aurora"}},
			want: [][2]string{{f.program.ID, `"` + optionIDOf(f.program, "Aurora") + `"`}},
		},
		{
			name: "attribute by exact name",
			args: []attributeArg{{Field: "Program", Value: "Aurora"}},
			want: [][2]string{{f.program.ID, `"` + optionIDOf(f.program, "Aurora") + `"`}},
		},
		{
			name: "attribute by case-insensitive name",
			args: []attributeArg{{Field: "program", Value: "Aurora"}},
			want: [][2]string{{f.program.ID, `"` + optionIDOf(f.program, "Aurora") + `"`}},
		},
		{
			name: "select option by ID",
			args: []attributeArg{{Field: "Classification", Value: optionIDOf(f.classification, "Secret")}},
			want: [][2]string{{f.classification.ID, `"` + optionIDOf(f.classification, "Secret") + `"`}},
		},
		{
			name: "select option by case-insensitive name",
			args: []attributeArg{{Field: "Classification", Value: "top secret"}},
			want: [][2]string{{f.classification.ID, `"` + optionIDOf(f.classification, "Top Secret") + `"`}},
		},
		{
			name: "multiselect collects repeats in order and drops duplicates",
			args: []attributeArg{
				{Field: "Region", Value: "APAC"},
				{Field: "Region", Value: "emea"},
				{Field: "region", Value: optionIDOf(f.region, "APAC")},
				{Field: "Region", Value: "APAC"},
			},
			want: [][2]string{{f.region.ID, `["` + optionIDOf(f.region, "APAC") + `","` + optionIDOf(f.region, "EMEA") + `"]`}},
		},
		{
			name: "an option ID the caller can't see is passed through",
			args: []attributeArg{{Field: "Program", Value: hiddenOptionID}, {Field: "Region", Value: "EMEA"}, {Field: "Region", Value: hiddenOptionID}},
			want: [][2]string{
				{f.program.ID, `"` + hiddenOptionID + `"`},
				{f.region.ID, `["` + optionIDOf(f.region, "EMEA") + `","` + hiddenOptionID + `"]`},
			},
		},
		{
			name: "text is a JSON string",
			args: []attributeArg{{Field: "Notes", Value: `say "hi", then\go`}},
			want: [][2]string{{f.notes.ID, `"say \"hi\", then\\go"`}},
		},
		{
			name: "items follow the order each field first appears",
			args: []attributeArg{
				{Field: "Notes", Value: "n"},
				{Field: "Region", Value: "AMER"},
				{Field: "Program", Value: "Borealis"},
				{Field: "Region", Value: "EMEA"},
			},
			want: [][2]string{
				{f.notes.ID, `"n"`},
				{f.region.ID, `["` + optionIDOf(f.region, "AMER") + `","` + optionIDOf(f.region, "EMEA") + `"]`},
				{f.program.ID, `"` + optionIDOf(f.program, "Borealis") + `"`},
			},
		},
	}
	for _, tc := range successes {
		s.Run(tc.name, func() {
			items, err := newResolver().resolve(tc.args)
			s.Require().NoError(err)

			got := make([][2]string, 0, len(items))
			for _, item := range items {
				got = append(got, [2]string{item.FieldID, string(item.Value)})
			}
			s.Equal(tc.want, got)
		})
	}

	failures := []struct {
		name    string
		args    []attributeArg
		wantErr string
	}{
		{
			name:    "unknown attribute points at the fields command",
			args:    []attributeArg{{Field: "Nope", Value: "x"}},
			wantErr: `unknown channel attribute "Nope"; run "mmctl channel attributes fields" to see them`,
		},
		{
			name:    "unknown option lists the field's options",
			args:    []attributeArg{{Field: "Program", Value: "Zephyr"}},
			wantErr: `unknown option "Zephyr" for attribute "Program"; the options are: Borealis, Aurora`,
		},
		{
			name:    "select given twice",
			args:    []attributeArg{{Field: "Program", Value: "Aurora"}, {Field: "Program", Value: "Aurora"}},
			wantErr: `attribute "Program" is a select and can only be given once`,
		},
		{
			name:    "select given twice under different spellings",
			args:    []attributeArg{{Field: "Program", Value: "Aurora"}, {Field: f.program.ID, Value: "Borealis"}},
			wantErr: `attribute "` + f.program.ID + `" is a select and can only be given once`,
		},
		{
			name:    "text given twice",
			args:    []attributeArg{{Field: "Notes", Value: "a"}, {Field: "Notes", Value: "b"}},
			wantErr: `attribute "Notes" is a text and can only be given once`,
		},
		{
			name:    "unsupported type",
			args:    []attributeArg{{Field: "Due", Value: "2026-01-01"}},
			wantErr: `attribute "Due" has type date, which mmctl can't set`,
		},
		{
			name:    "a later bad argument rejects the whole request",
			args:    []attributeArg{{Field: "Program", Value: "Aurora"}, {Field: "Region", Value: "LATAM"}},
			wantErr: `unknown option "LATAM" for attribute "Region"; the options are: EMEA, APAC, AMER`,
		},
	}
	for _, tc := range failures {
		s.Run(tc.name, func() {
			items, err := newResolver().resolve(tc.args)
			s.Require().EqualError(err, tc.wantErr)
			s.Nil(items)
		})
	}

	s.Run("ambiguous attribute lists the IDs to use", func() {
		upper := &model.PropertyField{ID: model.NewId(), Name: "Program", Type: model.PropertyFieldTypeText}
		lower := &model.PropertyField{ID: model.NewId(), Name: "PROGRAM", Type: model.PropertyFieldTypeText}
		s.expectChannelAttributeFieldSearch([]*model.PropertyField{upper, lower})
		resolver, err := newChannelAttributeResolver(s.client)
		s.Require().NoError(err)

		_, err = resolver.resolve([]attributeArg{{Field: "pRoGrAm", Value: "x"}})
		s.Require().EqualError(err, `channel attribute "pRoGrAm" matches more than one attribute; use one of these IDs instead: `+upper.ID+", "+lower.ID)

		items, err := resolver.resolve([]attributeArg{{Field: "Program", Value: "x"}})
		s.Require().NoError(err)
		s.Require().Len(items, 1)
		s.Equal(upper.ID, items[0].FieldID)
	})

	s.Run("ambiguous option asks for the exact name or ID", func() {
		field := &model.PropertyField{
			ID:    model.NewId(),
			Name:  "Level",
			Type:  model.PropertyFieldTypeSelect,
			Attrs: model.StringInterface{"options": newChannelAttributeOptions("High", "HIGH")},
		}
		s.expectChannelAttributeFieldSearch([]*model.PropertyField{field})
		resolver, err := newChannelAttributeResolver(s.client)
		s.Require().NoError(err)

		_, err = resolver.resolve([]attributeArg{{Field: "Level", Value: "high"}})
		s.Require().EqualError(err, `option "high" of attribute "Level" matches more than one option (High, HIGH); use the exact name or the option ID`)

		items, err := resolver.resolve([]attributeArg{{Field: "Level", Value: "HIGH"}})
		s.Require().NoError(err)
		s.Require().Len(items, 1)
	})

	s.Run("options left out by the server are paged once per field", func() {
		field := &model.PropertyField{
			ID:    model.NewId(),
			Name:  "Tags",
			Type:  model.PropertyFieldTypeMultiselect,
			Attrs: model.StringInterface{"options_omitted": true, "options_count": 3},
		}
		first := &model.PropertyFieldOption{ID: model.NewId(), Name: "one"}
		second := &model.PropertyFieldOption{ID: model.NewId(), Name: "two"}
		third := &model.PropertyFieldOption{ID: model.NewId(), Name: "three"}
		s.expectChannelAttributeFieldSearch([]*model.PropertyField{field})

		gomock.InOrder(
			s.client.
				EXPECT().
				GetPropertyFieldOptions(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeChannel, field.ID, int64(0), "", channelAttributeOptionsPageSize).
				Return(&model.PropertyFieldOptionPage{Options: []*model.PropertyFieldOption{first, second}, HasMore: true, NextCursorCreateAt: 42, NextCursorID: second.ID}, &model.Response{}, nil),
			s.client.
				EXPECT().
				GetPropertyFieldOptions(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeChannel, field.ID, int64(42), second.ID, channelAttributeOptionsPageSize).
				Return(&model.PropertyFieldOptionPage{Options: []*model.PropertyFieldOption{third}}, &model.Response{}, nil),
		)

		resolver, err := newChannelAttributeResolver(s.client)
		s.Require().NoError(err)
		items, err := resolver.resolve([]attributeArg{
			{Field: "Tags", Value: "three"},
			{Field: "Tags", Value: "one"},
		})
		s.Require().NoError(err)
		s.Require().Len(items, 1)
		s.JSONEq(`["`+third.ID+`","`+first.ID+`"]`, string(items[0].Value))

		// The pages are remembered: no further request for the same field.
		_, err = resolver.resolve([]attributeArg{{Field: "Tags", Value: "two"}})
		s.Require().NoError(err)
	})

	s.Run("a failing options page is surfaced", func() {
		field := &model.PropertyField{
			ID:    model.NewId(),
			Name:  "Tags",
			Type:  model.PropertyFieldTypeSelect,
			Attrs: model.StringInterface{"options_omitted": true},
		}
		s.expectChannelAttributeFieldSearch([]*model.PropertyField{field})
		s.client.
			EXPECT().
			GetPropertyFieldOptions(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeChannel, field.ID, int64(0), "", channelAttributeOptionsPageSize).
			Return(nil, &model.Response{}, errors.New("options unavailable")).
			Times(1)

		resolver, err := newChannelAttributeResolver(s.client)
		s.Require().NoError(err)
		_, err = resolver.resolve([]attributeArg{{Field: "Tags", Value: "one"}})
		s.Require().ErrorContains(err, "options unavailable")
	})

	s.Run("a select field with no options asks for none and lists none", func() {
		field := &model.PropertyField{ID: model.NewId(), Name: "Empty", Type: model.PropertyFieldTypeSelect}
		s.expectChannelAttributeFieldSearch([]*model.PropertyField{field})
		resolver, err := newChannelAttributeResolver(s.client)
		s.Require().NoError(err)

		_, err = resolver.resolve([]attributeArg{{Field: "Empty", Value: "x"}})
		s.Require().EqualError(err, `unknown option "x" for attribute "Empty"; the options are: `)
	})
}

func (s *MmctlUnitTestSuite) TestChannelAttributesFieldsCmd() {
	f := newChannelAttributeFixture()

	s.Run("plain output lists type, required and options", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		s.expectChannelAttributeFieldSearch(f.fields())

		err := channelAttributesFieldsCmdF(s.client, newTestCmd(s.T(), ChannelAttributesFieldsCmd), nil)
		s.Require().NoError(err)
		s.Equal([]any{
			"Classification (select, required): Unclassified, Secret, Top Secret",
			"Program (select): Borealis, Aurora",
			"Region (multiselect): EMEA, APAC, AMER",
			"Notes (text)",
			"Due (date)",
		}, printer.GetLines())
		s.Empty(printer.GetErrorLines())
	})

	s.Run("json output carries IDs, required and options", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatJSON)
		s.expectChannelAttributeFieldSearch(f.fields())

		err := channelAttributesFieldsCmdF(s.client, newTestCmd(s.T(), ChannelAttributesFieldsCmd), nil)
		s.Require().NoError(err)

		lines := printer.GetLines()
		s.Require().Len(lines, 5)
		raw, err := json.Marshal(lines[0])
		s.Require().NoError(err)
		s.JSONEq(`{
			"id": "`+f.classification.ID+`",
			"name": "Classification",
			"type": "select",
			"required": true,
			"options": [
				{"id": "`+optionIDOf(f.classification, "Unclassified")+`", "name": "Unclassified"},
				{"id": "`+optionIDOf(f.classification, "Secret")+`", "name": "Secret"},
				{"id": "`+optionIDOf(f.classification, "Top Secret")+`", "name": "Top Secret"}
			]
		}`, string(raw))

		raw, err = json.Marshal(lines[3])
		s.Require().NoError(err)
		s.JSONEq(`{"id": "`+f.notes.ID+`", "name": "Notes", "type": "text", "required": false, "options": []}`, string(raw))
	})

	s.Run("options the server left out are paged in", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		field := &model.PropertyField{ID: model.NewId(), Name: "Tags", Type: model.PropertyFieldTypeSelect, Attrs: model.StringInterface{"options_omitted": true}}
		s.expectChannelAttributeFieldSearch([]*model.PropertyField{field})
		s.client.
			EXPECT().
			GetPropertyFieldOptions(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeChannel, field.ID, int64(0), "", channelAttributeOptionsPageSize).
			Return(&model.PropertyFieldOptionPage{Options: []*model.PropertyFieldOption{{ID: model.NewId(), Name: "one"}, {ID: model.NewId(), Name: "two"}}}, &model.Response{}, nil).
			Times(1)

		err := channelAttributesFieldsCmdF(s.client, newTestCmd(s.T(), ChannelAttributesFieldsCmd), nil)
		s.Require().NoError(err)
		s.Equal([]any{"Tags (select): one, two"}, printer.GetLines())
	})

	s.Run("server 403 is surfaced", func() {
		printer.Clean()
		s.client.
			EXPECT().
			SearchPropertyFields(context.TODO(), model.AccessControlPropertyGroupName, gomock.Any()).
			Return(nil, &model.Response{StatusCode: http.StatusForbidden}, errors.New("no permission")).
			Times(1)

		err := channelAttributesFieldsCmdF(s.client, newTestCmd(s.T(), ChannelAttributesFieldsCmd), nil)
		s.Require().ErrorContains(err, "no permission")
		s.Empty(printer.GetLines())
	})

	s.Run("feature off gives the disabled message", func() {
		printer.Clean()
		s.client.
			EXPECT().
			SearchPropertyFields(context.TODO(), model.AccessControlPropertyGroupName, gomock.Any()).
			Return(nil, &model.Response{StatusCode: http.StatusNotFound}, errors.New("not found")).
			Times(1)

		err := channelAttributesFieldsCmdF(s.client, newTestCmd(s.T(), ChannelAttributesFieldsCmd), nil)
		s.Require().EqualError(err, "channel attributes aren't enabled on this server")
	})
}

func (s *MmctlUnitTestSuite) TestChannelAttributesListCmd() {
	f := newChannelAttributeFixture()
	channel := &model.Channel{Id: model.NewId(), Name: "ops"}

	expectValues := func(values []*model.PropertyValue) {
		s.client.
			EXPECT().
			GetChannel(context.TODO(), channel.Id).
			Return(channel, &model.Response{}, nil).
			Times(1)
		s.expectChannelAttributeFieldSearch(f.fields())
		s.client.
			EXPECT().
			GetPropertyValues(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeChannel, channel.Id, model.PropertyValueSearch{PerPage: channelAttributeValuesPageSize}).
			Return(values, &model.Response{}, nil).
			Times(1)
	}

	secret := optionIDOf(f.classification, "Secret")
	emea := optionIDOf(f.region, "EMEA")
	apac := optionIDOf(f.region, "APAC")
	values := func() []*model.PropertyValue {
		return []*model.PropertyValue{
			{ID: model.NewId(), FieldID: f.classification.ID, Value: json.RawMessage(`"` + secret + `"`)},
			{ID: model.NewId(), FieldID: f.region.ID, Value: json.RawMessage(`["` + emea + `","` + apac + `"]`)},
			{ID: model.NewId(), FieldID: f.notes.ID, Value: json.RawMessage(`"keep"`)},
			{ID: model.NewId(), FieldID: f.program.ID, Value: json.RawMessage(`""`)},
		}
	}

	s.Run("plain output shows names and skips cleared values", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		expectValues(values())

		err := channelAttributesListCmdF(s.client, newTestCmd(s.T(), ChannelAttributesListCmd), []string{channel.Id})
		s.Require().NoError(err)
		s.Equal([]any{
			"Classification: Secret",
			"Region: EMEA, APAC",
			"Notes: keep",
		}, printer.GetLines())
	})

	s.Run("json output resolves option IDs to id and name", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatJSON)
		expectValues(values())

		err := channelAttributesListCmdF(s.client, newTestCmd(s.T(), ChannelAttributesListCmd), []string{channel.Id})
		s.Require().NoError(err)

		lines := printer.GetLines()
		s.Require().Len(lines, 3)
		expected := []string{
			`{"field_id": "` + f.classification.ID + `", "field_name": "Classification", "value": {"id": "` + secret + `", "name": "Secret"}}`,
			`{"field_id": "` + f.region.ID + `", "field_name": "Region", "value": [{"id": "` + emea + `", "name": "EMEA"}, {"id": "` + apac + `", "name": "APAC"}]}`,
			`{"field_id": "` + f.notes.ID + `", "field_name": "Notes", "value": "keep"}`,
		}
		for i, want := range expected {
			raw, err := json.Marshal(lines[i])
			s.Require().NoError(err)
			s.JSONEq(want, string(raw))
		}
	})

	s.Run("a value of a field the caller can't see keeps its raw form", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		hidden := model.NewId()
		expectValues([]*model.PropertyValue{{ID: model.NewId(), FieldID: hidden, Value: json.RawMessage(`"x"`)}})

		err := channelAttributesListCmdF(s.client, newTestCmd(s.T(), ChannelAttributesListCmd), []string{channel.Id})
		s.Require().NoError(err)
		s.Equal([]any{hidden + ": x"}, printer.GetLines())
	})

	s.Run("channel not found", func() {
		printer.Clean()
		s.client.
			EXPECT().
			GetChannel(context.TODO(), "missing").
			Return(nil, &model.Response{StatusCode: http.StatusNotFound}, errors.New("not found")).
			Times(1)

		err := channelAttributesListCmdF(s.client, newTestCmd(s.T(), ChannelAttributesListCmd), []string{"missing"})
		s.Require().EqualError(err, `channel "missing" was not found`)
		s.Empty(printer.GetLines())
	})

	s.Run("server 403 on the values is surfaced", func() {
		printer.Clean()
		s.client.
			EXPECT().
			GetChannel(context.TODO(), channel.Id).
			Return(channel, &model.Response{}, nil).
			Times(1)
		s.expectChannelAttributeFieldSearch(f.fields())
		s.client.
			EXPECT().
			GetPropertyValues(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeChannel, channel.Id, gomock.Any()).
			Return(nil, &model.Response{StatusCode: http.StatusForbidden}, errors.New("no permission to read values")).
			Times(1)

		err := channelAttributesListCmdF(s.client, newTestCmd(s.T(), ChannelAttributesListCmd), []string{channel.Id})
		s.Require().ErrorContains(err, "no permission to read values")
		s.Empty(printer.GetLines())
	})

	s.Run("values are read page by page", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		s.client.
			EXPECT().
			GetChannel(context.TODO(), channel.Id).
			Return(channel, &model.Response{}, nil).
			Times(1)
		s.expectChannelAttributeFieldSearch(f.fields())

		firstPage := make([]*model.PropertyValue, 0, channelAttributeValuesPageSize)
		for range channelAttributeValuesPageSize {
			firstPage = append(firstPage, &model.PropertyValue{ID: model.NewId(), CreateAt: 7, FieldID: f.notes.ID, Value: json.RawMessage(`"n"`)})
		}
		last := firstPage[len(firstPage)-1]
		gomock.InOrder(
			s.client.
				EXPECT().
				GetPropertyValues(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeChannel, channel.Id, model.PropertyValueSearch{PerPage: channelAttributeValuesPageSize}).
				Return(firstPage, &model.Response{}, nil),
			s.client.
				EXPECT().
				GetPropertyValues(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeChannel, channel.Id, model.PropertyValueSearch{PerPage: channelAttributeValuesPageSize, CursorID: last.ID, CursorCreateAt: 7}).
				Return([]*model.PropertyValue{{ID: model.NewId(), FieldID: f.program.ID, Value: json.RawMessage(`"` + optionIDOf(f.program, "Aurora") + `"`)}}, &model.Response{}, nil),
		)

		err := channelAttributesListCmdF(s.client, newTestCmd(s.T(), ChannelAttributesListCmd), []string{channel.Id})
		s.Require().NoError(err)
		lines := printer.GetLines()
		s.Require().Len(lines, channelAttributeValuesPageSize+1)
		s.Equal("Program: Aurora", lines[len(lines)-1])
	})
}

func (s *MmctlUnitTestSuite) TestChannelAttributesSetCmd() {
	f := newChannelAttributeFixture()
	channel := &model.Channel{Id: model.NewId(), Name: "ops"}
	secret := optionIDOf(f.classification, "Secret")
	emea := optionIDOf(f.region, "EMEA")
	apac := optionIDOf(f.region, "APAC")

	newSetCmd := func(attributes ...string) *cobra.Command {
		cmd := newTestCmd(s.T(), ChannelAttributesSetCmd)
		for _, attribute := range attributes {
			s.Require().NoError(cmd.Flags().Set("attribute", attribute))
		}
		return cmd
	}

	expectChannel := func() {
		s.client.
			EXPECT().
			GetChannel(context.TODO(), channel.Id).
			Return(channel, &model.Response{}, nil).
			Times(1)
	}

	expectedItems := []model.PropertyValuePatchItem{
		{FieldID: f.classification.ID, Value: json.RawMessage(`"` + secret + `"`)},
		{FieldID: f.region.ID, Value: json.RawMessage(`["` + emea + `","` + apac + `"]`)},
	}
	stored := func() []*model.PropertyValue {
		return []*model.PropertyValue{
			{ID: model.NewId(), FieldID: f.classification.ID, Value: expectedItems[0].Value},
			{ID: model.NewId(), FieldID: f.region.ID, Value: expectedItems[1].Value},
		}
	}

	s.Run("sends the resolved items and prints what was stored", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		expectChannel()
		s.expectChannelAttributeFieldSearch(f.fields())
		s.client.
			EXPECT().
			PatchPropertyValues(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeChannel, channel.Id, expectedItems).
			Return(stored(), &model.Response{}, nil).
			Times(1)

		err := channelAttributesSetCmdF(s.client, newSetCmd("classification=secret", "Region=EMEA", "Region=apac"), []string{channel.Id})
		s.Require().NoError(err)
		s.Equal([]any{"Classification: Secret", "Region: EMEA, APAC"}, printer.GetLines())
	})

	s.Run("json output resolves option IDs", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatJSON)
		expectChannel()
		s.expectChannelAttributeFieldSearch(f.fields())
		s.client.
			EXPECT().
			PatchPropertyValues(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeChannel, channel.Id, expectedItems).
			Return(stored(), &model.Response{}, nil).
			Times(1)

		err := channelAttributesSetCmdF(s.client, newSetCmd("Classification=Secret", "Region=EMEA", "Region=APAC"), []string{channel.Id})
		s.Require().NoError(err)

		lines := printer.GetLines()
		s.Require().Len(lines, 2)
		raw, err := json.Marshal(lines[0])
		s.Require().NoError(err)
		s.JSONEq(`{"field_id": "`+f.classification.ID+`", "field_name": "Classification", "value": {"id": "`+secret+`", "name": "Secret"}}`, string(raw))
	})

	s.Run("requires --attribute", func() {
		printer.Clean()
		cmd := newSetCmd()
		s.Require().EqualError(cmd.ValidateRequiredFlags(), `required flag(s) "attribute" not set`)
	})

	s.Run("a malformed attribute sends nothing", func() {
		printer.Clean()
		err := channelAttributesSetCmdF(s.client, newSetCmd("Classification"), []string{channel.Id})
		s.Require().EqualError(err, `invalid --attribute "Classification": expected "<attribute>=<value>"`)
	})

	s.Run("channel not found", func() {
		printer.Clean()
		s.client.
			EXPECT().
			GetChannel(context.TODO(), "missing").
			Return(nil, &model.Response{StatusCode: http.StatusNotFound}, errors.New("not found")).
			Times(1)

		err := channelAttributesSetCmdF(s.client, newSetCmd("Program=Aurora"), []string{"missing"})
		s.Require().EqualError(err, `channel "missing" was not found`)
	})

	s.Run("an unknown option sends nothing", func() {
		printer.Clean()
		expectChannel()
		s.expectChannelAttributeFieldSearch(f.fields())

		err := channelAttributesSetCmdF(s.client, newSetCmd("Program=Zephyr"), []string{channel.Id})
		s.Require().EqualError(err, `unknown option "Zephyr" for attribute "Program"; the options are: Borealis, Aurora`)
		s.Empty(printer.GetLines())
	})

	s.Run("feature off gives the disabled message and sends nothing", func() {
		printer.Clean()
		expectChannel()
		s.client.
			EXPECT().
			SearchPropertyFields(context.TODO(), model.AccessControlPropertyGroupName, gomock.Any()).
			Return(nil, &model.Response{StatusCode: http.StatusNotFound}, errors.New("not found")).
			Times(1)

		err := channelAttributesSetCmdF(s.client, newSetCmd("Program=Aurora"), []string{channel.Id})
		s.Require().EqualError(err, "channel attributes aren't enabled on this server")
	})

	s.Run("server 403 is surfaced", func() {
		printer.Clean()
		expectChannel()
		s.expectChannelAttributeFieldSearch(f.fields())
		s.client.
			EXPECT().
			PatchPropertyValues(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeChannel, channel.Id, gomock.Any()).
			Return(nil, &model.Response{StatusCode: http.StatusForbidden}, errors.New("no permission to set values")).
			Times(1)

		err := channelAttributesSetCmdF(s.client, newSetCmd("Program=Aurora"), []string{channel.Id})
		s.Require().ErrorContains(err, "no permission to set values")
		s.Empty(printer.GetLines())
	})
}

func (s *MmctlUnitTestSuite) TestMissingRequiredHint() {
	f := newChannelAttributeFixture()
	f.program.Attrs["required"] = true
	missingRequired := model.NewAppError("restoreChannel", missingRequiredAttributesErrorID, nil, "", http.StatusBadRequest)
	channelID := model.NewId()

	newResolver := func() *channelAttributeResolver {
		s.expectChannelAttributeFieldSearch(f.fields())
		resolver, err := newChannelAttributeResolver(s.client)
		s.Require().NoError(err)
		return resolver
	}
	expectValues := func(values ...*model.PropertyValue) {
		s.client.
			EXPECT().
			GetPropertyValues(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeChannel, channelID, model.PropertyValueSearch{PerPage: channelAttributeValuesPageSize}).
			Return(values, &model.Response{}, nil).
			Times(1)
	}

	s.Run("names only the required attributes the channel doesn't hold and that weren't sent", func() {
		resolver := newResolver()
		expectValues(&model.PropertyValue{FieldID: f.classification.ID, Value: json.RawMessage(`"x"`)})

		err := missingRequiredHint(s.client, resolver, missingRequired, nil, channelID)
		s.Require().ErrorIs(err, missingRequired)
		s.Require().Contains(err.Error(), "Required channel attributes that may be missing: Program\n")
	})

	s.Run("an empty stored value still counts as missing", func() {
		resolver := newResolver()
		expectValues(&model.PropertyValue{FieldID: f.classification.ID, Value: json.RawMessage(`""`)})

		err := missingRequiredHint(s.client, resolver, missingRequired, nil, channelID)
		s.Require().Contains(err.Error(), "Required channel attributes that may be missing: Classification, Program\n")
	})

	s.Run("a masked field the channel may hold isn't named", func() {
		f.program.Permissions = &model.Permissions{Masking: &model.Masking{}}
		defer func() { f.program.Permissions = nil }()
		resolver := newResolver()
		expectValues(&model.PropertyValue{FieldID: f.classification.ID, Value: json.RawMessage(`"x"`)})

		s.Require().Equal(missingRequired, missingRequiredHint(s.client, resolver, missingRequired, nil, channelID))
	})

	s.Run("a masked field is named when the channel doesn't exist yet", func() {
		f.program.Permissions = &model.Permissions{Masking: &model.Masking{}}
		defer func() { f.program.Permissions = nil }()
		resolver := newResolver()

		err := missingRequiredHint(s.client, resolver, missingRequired, nil, "")
		s.Require().Contains(err.Error(), "Required channel attributes that may be missing: Classification, Program\n")
	})

	s.Run("an error that isn't the missing attributes one is returned untouched", func() {
		resolver := newResolver()
		other := errors.New("boom")

		s.Require().Equal(other, missingRequiredHint(s.client, resolver, other, nil, channelID))
	})

	s.Run("a failed read of the channel values leaves only the server message", func() {
		resolver := newResolver()
		s.client.
			EXPECT().
			GetPropertyValues(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeChannel, channelID, gomock.Any()).
			Return(nil, &model.Response{}, errors.New("boom")).
			Times(1)

		s.Require().Equal(missingRequired, missingRequiredHint(s.client, resolver, missingRequired, nil, channelID))
	})
}

func (s *MmctlUnitTestSuite) TestVerifySavedSkipsMaskedFields() {
	f := newChannelAttributeFixture()
	f.program.Permissions = &model.Permissions{Masking: &model.Masking{}}
	s.expectChannelAttributeFieldSearch(f.fields())
	resolver, err := newChannelAttributeResolver(s.client)
	s.Require().NoError(err)

	channelID := model.NewId()
	secret := optionIDOf(f.classification, "Secret")
	borealis := optionIDOf(f.program, "Borealis")
	sent := []model.PropertyValuePatchItem{
		{FieldID: f.classification.ID, Value: json.RawMessage(`"` + secret + `"`)},
		{FieldID: f.program.ID, Value: json.RawMessage(`"` + borealis + `"`)},
	}
	expectValues := func(values ...*model.PropertyValue) {
		s.client.
			EXPECT().
			GetPropertyValues(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeChannel, channelID, model.PropertyValueSearch{PerPage: channelAttributeValuesPageSize}).
			Return(values, &model.Response{}, nil).
			Times(1)
	}

	s.Run("a masked value that reads back absent is not a failure", func() {
		expectValues(&model.PropertyValue{FieldID: f.classification.ID, Value: json.RawMessage(`"` + secret + `"`)})
		s.Require().NoError(verifySaved(s.client, resolver, channelID, sent, "created"))
	})

	s.Run("an unmasked value that reads back absent still fails", func() {
		f.classification.Permissions = &model.Permissions{}
		defer func() { f.classification.Permissions = nil }()
		expectValues(&model.PropertyValue{FieldID: f.program.ID, Value: json.RawMessage(`"` + borealis + `"`)})
		s.Require().ErrorContains(verifySaved(s.client, resolver, channelID, sent, "created"), "the server didn't save the attribute values")
	})
}

func (s *MmctlUnitTestSuite) TestVerifySavedWithoutPermissions() {
	f := newChannelAttributeFixture()
	s.expectChannelAttributeFieldSearch(f.fields())
	resolver, err := newChannelAttributeResolver(s.client)
	s.Require().NoError(err)

	channelID := model.NewId()
	secret := optionIDOf(f.classification, "Secret")
	emea := optionIDOf(f.region, "EMEA")
	apac := optionIDOf(f.region, "APAC")
	sent := []model.PropertyValuePatchItem{
		{FieldID: f.classification.ID, Value: json.RawMessage(`"` + secret + `"`)},
		{FieldID: f.region.ID, Value: json.RawMessage(`["` + emea + `","` + apac + `"]`)},
	}
	expectValues := func(values ...*model.PropertyValue) {
		s.client.
			EXPECT().
			GetPropertyValues(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeChannel, channelID, model.PropertyValueSearch{PerPage: channelAttributeValuesPageSize}).
			Return(values, &model.Response{}, nil).
			Times(1)
	}

	s.Run("values that read back missing or narrowed warn and succeed", func() {
		printer.Clean()
		expectValues(&model.PropertyValue{FieldID: f.region.ID, Value: json.RawMessage(`["` + apac + `"]`)})

		s.Require().NoError(verifySaved(s.client, resolver, channelID, sent, "updated"))
		s.Equal([]string{"Warning: the channel was updated, but the values of Classification, Region could not be checked: the server either hides them from you or is older than this mmctl and ignored them"}, printer.GetErrorLines())
	})

	s.Run("values that read back in full need no warning", func() {
		printer.Clean()
		expectValues(
			&model.PropertyValue{FieldID: f.classification.ID, Value: sent[0].Value},
			&model.PropertyValue{FieldID: f.region.ID, Value: sent[1].Value},
		)

		s.Require().NoError(verifySaved(s.client, resolver, channelID, sent, "updated"))
		s.Empty(printer.GetErrorLines())
	})

	s.Run("a different value still fails", func() {
		printer.Clean()
		expectValues(&model.PropertyValue{FieldID: f.classification.ID, Value: json.RawMessage(`"` + optionIDOf(f.classification, "Unclassified") + `"`)})

		s.Require().ErrorContains(verifySaved(s.client, resolver, channelID, sent, "updated"), "the server didn't save the attribute values")
	})
}

func newGraphChannelAttribute() *model.PropertyField {
	return &model.PropertyField{
		ID:    model.NewId(),
		Name:  "Org",
		Type:  model.PropertyFieldTypeGraph,
		Attrs: model.StringInterface{"options": newChannelAttributeOptions("Company", "Engineering", "Sales", "Sales")},
	}
}

func (s *MmctlUnitTestSuite) TestChannelAttributeGraph() {
	field := newGraphChannelAttribute()
	company := optionIDOf(field, "Company")
	engineering := optionIDOf(field, "Engineering")

	newResolver := func() *channelAttributeResolver {
		s.expectChannelAttributeFieldSearch([]*model.PropertyField{field})
		resolver, err := newChannelAttributeResolver(s.client)
		s.Require().NoError(err)
		return resolver
	}

	s.Run("resolves by ID, exact name and case-insensitive name, deduped in order", func() {
		items, err := newResolver().resolve([]attributeArg{
			{Field: "Org", Value: "engineering"},
			{Field: "Org", Value: company},
			{Field: "Org", Value: "Engineering"},
		})
		s.Require().NoError(err)
		s.Require().Len(items, 1)
		s.Equal(field.ID, items[0].FieldID)
		s.JSONEq(`["`+engineering+`","`+company+`"]`, string(items[0].Value))
	})

	s.Run("a single node is still an array", func() {
		items, err := newResolver().resolve([]attributeArg{{Field: "Org", Value: "Company"}})
		s.Require().NoError(err)
		s.JSONEq(`["`+company+`"]`, string(items[0].Value))
	})

	s.Run("unknown node lists the names", func() {
		_, err := newResolver().resolve([]attributeArg{{Field: "Org", Value: "Legal"}})
		s.Require().EqualError(err, `unknown option "Legal" for attribute "Org"; the options are: Company, Engineering, Sales, Sales`)
	})

	s.Run("an ambiguous name asks for the ID", func() {
		_, err := newResolver().resolve([]attributeArg{{Field: "Org", Value: "sales"}})
		s.Require().EqualError(err, `option "sales" of attribute "Org" matches more than one option (Sales, Sales); use the exact name or the option ID`)

		items, err := newResolver().resolve([]attributeArg{{Field: "Org", Value: field.Attrs["options"].([]*model.PropertyFieldOption)[2].ID}})
		s.Require().NoError(err)
		s.Require().Len(items, 1)
	})

	s.Run("fields shows the nodes", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		s.expectChannelAttributeFieldSearch([]*model.PropertyField{field})

		err := channelAttributesFieldsCmdF(s.client, newTestCmd(s.T(), ChannelAttributesFieldsCmd), nil)
		s.Require().NoError(err)
		s.Equal([]any{"Org (graph): Company, Engineering, Sales, Sales"}, printer.GetLines())
	})

	s.Run("list shows node names in plain and JSON output", func() {
		channel := &model.Channel{Id: model.NewId(), Name: "ops"}
		raw := json.RawMessage(`["` + company + `","` + engineering + `"]`)
		expect := func() {
			s.client.EXPECT().GetChannel(context.TODO(), channel.Id).Return(channel, &model.Response{}, nil).Times(1)
			s.expectChannelAttributeFieldSearch([]*model.PropertyField{field})
			s.client.
				EXPECT().
				GetPropertyValues(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeChannel, channel.Id, model.PropertyValueSearch{PerPage: channelAttributeValuesPageSize}).
				Return([]*model.PropertyValue{{ID: model.NewId(), FieldID: field.ID, Value: raw}}, &model.Response{}, nil).
				Times(1)
		}

		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		expect()
		s.Require().NoError(channelAttributesListCmdF(s.client, newTestCmd(s.T(), ChannelAttributesListCmd), []string{channel.Id}))
		s.Equal([]any{"Org: Company, Engineering"}, printer.GetLines())

		printer.Clean()
		printer.SetFormat(printer.FormatJSON)
		expect()
		s.Require().NoError(channelAttributesListCmdF(s.client, newTestCmd(s.T(), ChannelAttributesListCmd), []string{channel.Id}))
		lines := printer.GetLines()
		s.Require().Len(lines, 1)
		out, err := json.Marshal(lines[0])
		s.Require().NoError(err)
		s.JSONEq(`{"field_id": "`+field.ID+`", "field_name": "Org", "value": [{"id": "`+company+`", "name": "Company"}, {"id": "`+engineering+`", "name": "Engineering"}]}`, string(out))
	})

	s.Run("read-back compares graph arrays", func() {
		field.Permissions = &model.Permissions{}
		defer func() { field.Permissions = nil }()
		resolver := newResolver()
		channelID := model.NewId()
		sent := []model.PropertyValuePatchItem{{FieldID: field.ID, Value: json.RawMessage(`["` + company + `","` + engineering + `"]`)}}
		expect := func(value string) {
			s.client.
				EXPECT().
				GetPropertyValues(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeChannel, channelID, model.PropertyValueSearch{PerPage: channelAttributeValuesPageSize}).
				Return([]*model.PropertyValue{{FieldID: field.ID, Value: json.RawMessage(value)}}, &model.Response{}, nil).
				Times(1)
		}

		expect(`["` + company + `", "` + engineering + `"]`)
		s.Require().NoError(verifySaved(s.client, resolver, channelID, sent, "created"))

		expect(`["` + company + `"]`)
		s.Require().ErrorContains(verifySaved(s.client, resolver, channelID, sent, "created"), "the server didn't save the attribute values")
	})
}

func (s *MmctlUnitTestSuite) TestVerifySavedReadBackErrors() {
	f := newChannelAttributeFixture()
	s.expectChannelAttributeFieldSearch(f.fields())
	resolver, err := newChannelAttributeResolver(s.client)
	s.Require().NoError(err)

	channelID := model.NewId()
	sent := []model.PropertyValuePatchItem{{FieldID: f.notes.ID, Value: json.RawMessage(`"x"`)}}
	expectReadFailure := func(status int) {
		s.client.
			EXPECT().
			GetPropertyValues(context.TODO(), model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeChannel, channelID, gomock.Any()).
			Return(nil, &model.Response{StatusCode: status}, errors.New("boom")).
			Times(1)
	}

	s.Run("a 403 on the read-back warns and succeeds", func() {
		printer.Clean()
		expectReadFailure(http.StatusForbidden)

		s.Require().NoError(verifySaved(s.client, resolver, channelID, sent, "unarchived"))
		s.Equal([]string{"Warning: the channel was unarchived, but its attribute values could not be checked because you don't have permission to read them"}, printer.GetErrorLines())
	})

	s.Run("another read-back error still fails", func() {
		printer.Clean()
		expectReadFailure(http.StatusInternalServerError)

		err := verifySaved(s.client, resolver, channelID, sent, "unarchived")
		s.Require().ErrorContains(err, "the channel was unarchived, but its attribute values could not be checked")
		s.Empty(printer.GetErrorLines())
	})
}
