// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"sort"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestResponse_String(t *testing.T) {
	tests := []struct {
		name    string
		r       Response
		key     string
		want    string
		wantErr bool
	}{
		{name: "Key missing", r: Response{"status": "OK"}, key: "bogus", want: "", wantErr: true},
		{name: "Key empty", r: Response{"status": "OK"}, key: "", want: "", wantErr: true},
		{name: "Response empty", r: Response{}, key: "", want: "", wantErr: true},
		{name: "String", r: Response{"status": "OK"}, key: "status", want: "OK", wantErr: false},
		{name: "Int", r: Response{"code": 77}, key: "code", want: "77", wantErr: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := tt.r.String(tt.key)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestResponse_Int64(t *testing.T) {
	now := model.GetMillis()
	tests := []struct {
		name    string
		r       Response
		key     string
		want    int64
		wantErr bool
	}{
		{name: "Key missing", r: Response{"code": 77}, key: "bogus", want: 0, wantErr: true},
		{name: "Key empty", r: Response{"code": 77}, key: "", want: 0, wantErr: true},
		{name: "Response empty", r: Response{}, key: "", want: 0, wantErr: true},
		{name: "String", r: Response{"code": "77"}, key: "code", want: 77, wantErr: false},
		{name: "Int", r: Response{"code": 77}, key: "code", want: 77, wantErr: false},
		{name: "Int64", r: Response{"now": now}, key: "now", want: now, wantErr: false},
		{name: "Float", r: Response{"code": 77.77}, key: "code", want: 78, wantErr: false},
		{name: "Float64", r: Response{"code": float64(77.77)}, key: "code", want: 78, wantErr: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := tt.r.Int64(tt.key)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestResponse_StringSlice(t *testing.T) {
	tests := []struct {
		name    string
		r       Response
		key     string
		want    []string
		wantErr bool
	}{
		{name: "Key missing", r: Response{"status": []string{"aa", "bb"}}, key: "bogus", want: nil, wantErr: true},
		{name: "Key empty", r: Response{"status": []string{"aa", "bb"}}, key: "", want: nil, wantErr: true},
		{name: "Response empty", r: Response{}, key: "", want: nil, wantErr: true},
		{name: "[]String", r: Response{"data": []string{"aa", "bb"}}, key: "data", want: []string{"aa", "bb"}, wantErr: false},
		{name: "[]interface{}", r: Response{"data": []interface{}{"aa", 77}}, key: "data", want: []string{"aa", "77"}, wantErr: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := tt.r.StringSlice(tt.key)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			sort.Strings(got)
			sort.Strings(tt.want)

			assert.Equal(t, tt.want, got)
		})
	}
}
