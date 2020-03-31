// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSanitizeUnicode(t *testing.T) {
	buf := bytes.Buffer{}
	buf.WriteString("Hello")
	buf.WriteRune(0x1d173)
	buf.WriteRune(0x1d17a)
	buf.WriteString(" there.")

	musicArg := buf.String()
	musicWant := "Hello there."

	tests := []struct {
		name string
		arg  string
		want string
	}{
		{name: "empty string", arg: "", want: ""},
		{name: "ascii only", arg: "Hello There", want: "Hello There"},
		{name: "allowed unicode", arg: "Ādam likes Iñtërnâtiônàližætiøn", want: "Ādam likes Iñtërnâtiônàližætiøn"},
		{name: "blacklist char, don't reverse string", arg: "\u202E2resu", want: "2resu"},
		{name: "blacklist chars, scoping musical notation", arg: musicArg, want: musicWant},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SanitizeUnicode(tt.arg)
			assert.Equal(t, tt.want, got)
		})
	}
}
