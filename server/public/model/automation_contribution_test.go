// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"math"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAutomationValueValidate(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		value         *AutomationValue
		declared      AutomationValueType
		textMaxRunes  int
		allowTextarea bool
		wantErr       string
	}{
		{
			name:     "nil value",
			value:    nil,
			declared: AutomationValueText,
			wantErr:  "missing",
		},
		{
			name:     "type mismatch",
			value:    &AutomationValue{Type: AutomationValueBool, Bool: true},
			declared: AutomationValueText,
			wantErr:  "does not match",
		},
		{
			name:          "textarea refused for signals",
			value:         &AutomationValue{Type: AutomationValueTextarea, Text: "long"},
			declared:      AutomationValueTextarea,
			allowTextarea: false,
			wantErr:       "textarea",
		},
		{
			name:         "text too long",
			value:        &AutomationValue{Type: AutomationValueText, Text: strings.Repeat("á", 5)},
			declared:     AutomationValueText,
			textMaxRunes: 4,
			wantErr:      "too long",
		},
		{
			name:         "text within rune cap",
			value:        &AutomationValue{Type: AutomationValueText, Text: strings.Repeat("á", 4)},
			declared:     AutomationValueText,
			textMaxRunes: 4,
		},
		{
			name:     "bool with text",
			value:    &AutomationValue{Type: AutomationValueBool, Bool: true, Text: "x"},
			declared: AutomationValueBool,
			wantErr:  "must not carry text",
		},
		{
			name:     "int with text",
			value:    &AutomationValue{Type: AutomationValueInt, Int: 3, Text: "x"},
			declared: AutomationValueInt,
			wantErr:  "must not carry text",
		},
		{
			name:     "float nan",
			value:    &AutomationValue{Type: AutomationValueFloat, Float: math.NaN()},
			declared: AutomationValueFloat,
			wantErr:  "finite",
		},
		{
			name:          "textarea allowed for actions",
			value:         &AutomationValue{Type: AutomationValueTextarea, Text: "body"},
			declared:      AutomationValueTextarea,
			allowTextarea: true,
		},
		{
			name:     "bool ok",
			value:    &AutomationValue{Type: AutomationValueBool, Bool: true},
			declared: AutomationValueBool,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			err := tc.value.Validate(tc.declared, tc.textMaxRunes, tc.allowTextarea)
			if tc.wantErr == "" {
				require.NoError(t, err)
				return
			}
			require.Error(t, err)
			require.Contains(t, err.Error(), tc.wantErr)
		})
	}
}

func TestAutomationValueTypeNormalizeAndIsKnown(t *testing.T) {
	t.Parallel()
	require.Equal(t, AutomationValueText, AutomationValueType("").Normalize())
	require.True(t, AutomationValueInt.IsKnown())
	require.False(t, AutomationValueType("uuid").IsKnown())
}
