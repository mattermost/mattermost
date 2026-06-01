// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package webhook_template

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAssertNoDisallowedDirectives(t *testing.T) {
	tests := []struct {
		name    string
		tpl     string
		wantErr bool
	}{
		// Blocked
		{"call", `{{call .Fn}}`, true},
		{"template invocation", `{{ template "x" . }}`, true},
		{"define block", `{{define "y"}}body{{end}}`, true},
		{"call with trim-left", `{{- call .Fn}}`, true},
		{"call with trim-right", `{{call .Fn -}}`, true},
		{"call with both trims", `{{- call .Fn -}}`, true},
		{"template with extra whitespace", `{{   template "x" . }}`, true},
		{"call embedded in text", `prefix {{call .Fn}} suffix`, true},
		// Allowed
		{"empty", "", false},
		{"plain text", "hello world", false},
		{"simple field", `{{.foo}}`, false},
		{"nested field", `{{.a.b.c}}`, false},
		{"range", `{{range .xs}}{{.}}{{end}}`, false},
		{"if", `{{if .x}}yes{{end}}`, false},
		{"field named template", `{{.template}}`, false},
		{"field named call", `{{.call}}`, false},
		{"field named define", `{{.define}}`, false},
		{"function calling-look-alike", `{{calling .Fn}}`, false}, // word-boundary
		{"sprig default", `{{default "x" .y}}`, false},
		{"pipe", `{{.s | upper}}`, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := AssertNoDisallowedDirectives(tt.tpl)
			if tt.wantErr {
				require.Error(t, err)
				require.True(t, errors.Is(err, ErrDisallowedDirective),
					"expected ErrDisallowedDirective, got %v", err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
