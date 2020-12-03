// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

const (
	validJSON = `{"file":{ "Type":"file"}}`
	badJSON   = `{"file":{ Type="file"}}`
)

type fgetFunc func(string) ([]byte, error)

func (f fgetFunc) GetFile(path string) ([]byte, error) {
	return f(path)
}

func getValidFile(path string) ([]byte, error) {
	return []byte(validJSON), nil
}

func getInvalidFile(path string) ([]byte, error) {
	return nil, os.ErrNotExist
}

func TestNewLogConfigSrc(t *testing.T) {
	tests := []struct {
		name     string
		dsn      string
		fget     FileGetter
		wantErr  bool
		wantType LogConfigSrc
	}{
		{name: "empty dsn", dsn: "", fget: fgetFunc(getInvalidFile), wantErr: true, wantType: nil},
		{name: "garbage dsn", dsn: "!@wfejwcevioj", fget: fgetFunc(getInvalidFile), wantErr: true, wantType: nil},
		{name: "valid json dsn", dsn: validJSON, fget: fgetFunc(getInvalidFile), wantErr: false, wantType: &jsonSrc{}},
		{name: "invalid json dsn", dsn: badJSON, fget: fgetFunc(getInvalidFile), wantErr: true, wantType: nil},
		{name: "valid filespec dsn", dsn: "advancedlogging.conf", fget: fgetFunc(getValidFile), wantErr: false, wantType: &fileSrc{}},
		{name: "invalid filespec dsn", dsn: "/nobody/here.conf", fget: fgetFunc(getInvalidFile), wantErr: true, wantType: nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NewLogConfigSrc(tt.dsn, IsJsonMap(tt.dsn), tt.fget)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.IsType(t, tt.wantType, got)
			}
		})
	}
}
