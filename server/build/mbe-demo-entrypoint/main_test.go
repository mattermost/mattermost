// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"reflect"
	"testing"
)

func TestResolveCommandArgs(t *testing.T) {
	tests := []struct {
		name    string
		args    []string
		want    []string
		wantErr bool
	}{
		{
			name: "operator command",
			args: []string{"mattermost"},
			want: []string{defaultMattermostBinary},
		},
		{
			name: "operator command with arguments",
			args: []string{"mattermost", "version"},
			want: []string{defaultMattermostBinary, "version"},
		},
		{
			name: "docker entrypoint with absolute command",
			args: []string{"/mattermost/bin/mbe-demo-entrypoint", "/mattermost/bin/mattermost"},
			want: []string{defaultMattermostBinary},
		},
		{
			name: "docker entrypoint with PATH command",
			args: []string{"/mattermost/bin/mbe-demo-entrypoint", "mattermost", "version"},
			want: []string{defaultMattermostBinary, "version"},
		},
		{
			name: "different command",
			args: []string{"/mattermost/bin/mbe-demo-entrypoint", "true"},
			want: []string{"true"},
		},
		{
			name:    "missing command",
			args:    []string{"/mattermost/bin/mbe-demo-entrypoint"},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := resolveCommandArgs(tt.args)
			if (err != nil) != tt.wantErr {
				t.Fatalf("resolveCommandArgs() error = %v, wantErr %v", err, tt.wantErr)
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("resolveCommandArgs() = %v, want %v", got, tt.want)
			}
		})
	}
}
