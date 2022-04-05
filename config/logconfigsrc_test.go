// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	validJSON               = `{"file":{ "Type":"file"}}`
	badJSON                 = `{"file":{ Type="file"}}`
	validEmbeddedJSON       = `{\"file\":{\"Type\":\"file\"}}`
	validEmbeddedQuotedJSON = `"{\"file\":{\"Type\":\"file\"}}"`
	badEmbeddedJSON         = `"{\"file\":{ Type=\"file\"}}"`
)

func TestNewLogConfigSrc(t *testing.T) {
	store := NewTestMemoryStore()
	require.NotNil(t, store)
	err := store.SetFile("advancedlogging.conf", []byte(validJSON))
	require.NoError(t, err)
	err = store.SetFile("/home/user/test/logging.conf", []byte(validJSON))
	require.NoError(t, err)

	tests := []struct {
		name        string
		dsn         json.RawMessage
		configStore *Store
		wantErr     bool
		wantType    LogConfigSrc
	}{
		{name: "empty dsn", dsn: json.RawMessage(""), configStore: store, wantErr: true, wantType: nil},
		{name: "garbage dsn", dsn: json.RawMessage("!@wfejwcevioj"), configStore: store, wantErr: true, wantType: nil},
		{name: "valid json dsn", dsn: json.RawMessage(validJSON), configStore: store, wantErr: false, wantType: &jsonSrc{}},
		{name: "invalid json dsn", dsn: json.RawMessage(badJSON), configStore: store, wantErr: true, wantType: nil},
		{name: "valid embedded json dsn", dsn: json.RawMessage(validEmbeddedJSON), configStore: store, wantErr: false, wantType: &jsonSrc{}},
		{name: "valid embedded quoted json dsn", dsn: json.RawMessage(validEmbeddedQuotedJSON), configStore: store, wantErr: false, wantType: &jsonSrc{}},
		{name: "invalid embedded json dsn", dsn: json.RawMessage(badEmbeddedJSON), configStore: store, wantErr: true, wantType: nil},
		{name: "valid relative filespec dsn", dsn: json.RawMessage("advancedlogging.conf"), configStore: store, wantErr: false, wantType: &fileSrc{}},
		{name: "valid absolute filespec dsn", dsn: json.RawMessage("/home/user/test/logging.conf"), configStore: store, wantErr: false, wantType: &fileSrc{}},
		{name: "invalid filespec dsn", dsn: json.RawMessage("/nobody/here.conf"), configStore: store, wantErr: true, wantType: nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NewLogConfigSrc(tt.dsn, tt.configStore)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.IsType(t, tt.wantType, got)
			}
		})
	}
}
