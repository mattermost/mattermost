// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package importer

import (
	"encoding/json"
	"fmt"
	"strings"
)

type ImportFileInfo struct {
	Source      string `json:"archive_name"`
	FileName    string `json:"file_name,omitempty"`
	CurrentLine uint64 `json:"current_line,omitempty"`
	TotalLines  uint64 `json:"total_lines,omitempty"`
}

type ImportValidationError struct { //nolint:govet
	ImportFileInfo
	FieldName       string
	Err             error
	Suggestion      string
	SuggestedValues []any
	ApplySuggestion func(any) error
}

func (e *ImportValidationError) MarshalJSON() ([]byte, error) {
	t := struct { //nolint:govet
		ImportFileInfo
		FieldName       string `json:"field_name,omitempty"`
		Err             string `json:"error,omitempty"`
		Suggestion      string `json:"suggestion,omitempty"`
		SuggestedValues []any  `json:"suggested_values,omitempty"`
	}{
		ImportFileInfo:  e.ImportFileInfo,
		FieldName:       e.FieldName,
		Suggestion:      e.Suggestion,
		SuggestedValues: e.SuggestedValues,
	}

	if e.Err != nil {
		t.Err = e.Err.Error()
	}

	return json.Marshal(t)
}

func (e *ImportValidationError) Error() string {
	msg := &strings.Builder{}
	msg.WriteString("import validation error")

	if e.FileName != "" || e.Source != "" {
		fmt.Fprintf(msg, " in %s->%s:%d", e.Source, e.FileName, e.CurrentLine)
	}

	if e.FieldName != "" {
		fmt.Fprintf(msg, " field %q", e.FieldName)
	}

	if e.Err != nil {
		fmt.Fprintf(msg, ": %s", e.Err)
	}

	return msg.String()
}
