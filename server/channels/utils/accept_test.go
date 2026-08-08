// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestExpectsJSON(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		accept string
		want   bool
	}{
		{
			name:   "empty accept header",
			accept: "",
			want:   false,
		},
		{
			name:   "json only",
			accept: "application/json",
			want:   true,
		},
		{
			name:   "browser accept header",
			accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			want:   false,
		},
		{
			name:   "json with html",
			accept: "application/json, text/html;q=0.9",
			want:   true,
		},
		{
			name:   "html with json",
			accept: "text/html, application/json;q=0.8",
			want:   true,
		},
		{
			name:   "wildcard only",
			accept: "*/*",
			want:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			r, err := http.NewRequest(http.MethodGet, "http://localhost", nil)
			assert.NoError(t, err)
			if tt.accept != "" {
				r.Header.Set("Accept", tt.accept)
			}

			assert.Equal(t, tt.want, ExpectsJSON(r))
		})
	}
}
