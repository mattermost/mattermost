// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

import (
	"testing"

	"github.com/mattermost/logr"
	"github.com/mattermost/logr/format"
	"github.com/stretchr/testify/require"
)

func Test_sortAuditFields(t *testing.T) {
	type args struct {
		fields logr.Fields
	}
	tests := []struct {
		name string
		args args
		want []format.ContextField
	}{
		{name: "empty list",
			args: args{fields: logr.Fields{}},
			want: []format.ContextField{},
		},
		{name: "partial list",
			args: args{fields: logr.Fields{"zProp": "x", "xProp": "x", "yProp": "x", KeyClusterID: "x", KeyEvent: "x"}},
			want: []format.ContextField{
				{Key: KeyEvent, Val: "x"},
				{Key: "xProp", Val: "x"},
				{Key: "yProp", Val: "x"},
				{Key: "zProp", Val: "x"},
				{Key: KeyClusterID, Val: "x"},
			},
		},
		{name: "append/prepend only list",
			args: args{fields: logr.Fields{KeyClusterID: "x", KeyEvent: "x", KeySessionID: "x", KeyIPAddress: "x", KeyClient: "x",
				KeyUserID: "x", KeyStatus: "x"}},
			want: []format.ContextField{
				// prepend: KeyEvent, KeyStatus, KeyUserID, KeySessionID, KeyIPAddress
				// append: KeyClusterID, KeyClient
				{Key: KeyEvent, Val: "x"},
				{Key: KeyStatus, Val: "x"},
				{Key: KeyUserID, Val: "x"},
				{Key: KeySessionID, Val: "x"},
				{Key: KeyIPAddress, Val: "x"},
				{Key: KeyClusterID, Val: "x"},
				{Key: KeyClient, Val: "x"},
			},
		},
		{name: "sortables only list",
			args: args{fields: logr.Fields{"zProp": "x", "xProp": "x", "yProp": "x"}},
			want: []format.ContextField{
				{Key: "xProp", Val: "x"},
				{Key: "yProp", Val: "x"},
				{Key: "zProp", Val: "x"},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := sortAuditFields(tt.args.fields)
			require.Equal(t, tt.want, got)
		})
	}
}
