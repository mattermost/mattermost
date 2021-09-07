// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	validJSON = `{"file":{ "Type":"file"}}`
	badJSON   = `{"file":{ Type="file"}}`
)

func TestNewLogConfigSrc(t *testing.T) {
	store := NewTestMemoryStore()
	require.NotNil(t, store)
	err := store.SetFile("advancedlogging.conf", []byte(validJSON))
	require.NoError(t, err)

	tests := []struct {
		name        string
		dsn         string
		configStore *Store
		wantErr     bool
		wantType    LogConfigSrc
	}{
		{name: "empty dsn", dsn: "", configStore: store, wantErr: true, wantType: nil},
		{name: "garbage dsn", dsn: "!@wfejwcevioj", configStore: store, wantErr: true, wantType: nil},
		{name: "valid json dsn", dsn: validJSON, configStore: store, wantErr: false, wantType: &jsonSrc{}},
		{name: "invalid json dsn", dsn: badJSON, configStore: store, wantErr: true, wantType: nil},
		{name: "valid filespec dsn", dsn: "advancedlogging.conf", configStore: store, wantErr: false, wantType: &fileSrc{}},
		{name: "invalid filespec dsn", dsn: "/nobody/here.conf", configStore: store, wantErr: true, wantType: nil},
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
