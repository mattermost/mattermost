// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNodeDiagnosticsJSON(t *testing.T) {
	t.Run("section errors travel as strings", func(t *testing.T) {
		var diag SupportPacketDiagnostics
		diag.Server.Hostname = NewPointer("app-1")
		in := NodeDiagnostics{
			Diagnostics: &diag,
			Errors: SectionErrors{
				SectionServerHost: nil,
				SectionSMTPProbe:  errors.New("dial tcp: timeout"),
			},
		}

		data, err := json.Marshal(in)
		require.NoError(t, err)
		assert.Contains(t, string(data), `"dial tcp: timeout"`)

		var out NodeDiagnostics
		require.NoError(t, json.Unmarshal(data, &out))
		assert.Equal(t, in.Diagnostics, out.Diagnostics)
		require.Len(t, out.Errors, 2)
		require.Contains(t, out.Errors, SectionServerHost)
		assert.NoError(t, out.Errors[SectionServerHost])
		assert.EqualError(t, out.Errors[SectionSMTPProbe], "dial tcp: timeout")
	})

	t.Run("a pointer encodes the same as a value", func(t *testing.T) {
		in := &NodeDiagnostics{Diagnostics: &SupportPacketDiagnostics{}, Errors: SectionErrors{SectionServerHost: nil}}

		byPointer, err := json.Marshal(in)
		require.NoError(t, err)
		byValue, err := json.Marshal(*in)
		require.NoError(t, err)
		assert.JSONEq(t, string(byValue), string(byPointer))
	})

	t.Run("no diagnostics", func(t *testing.T) {
		data, err := json.Marshal(NodeDiagnostics{})
		require.NoError(t, err)

		var out NodeDiagnostics
		require.NoError(t, json.Unmarshal(data, &out))
		assert.Nil(t, out.Diagnostics)
		assert.Empty(t, out.Errors)
	})
}
