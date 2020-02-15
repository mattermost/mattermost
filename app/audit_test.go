// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"reflect"
	"strings"
	"testing"

	"github.com/wiggin77/logr"
)

func Test_getExtraInfos(t *testing.T) {
	fieldsOk := logr.Fields{"prop1": "Hello", "prop2": "there"}
	wantOk := []string{"prop1=Hello | prop2=there"}

	fldTooLong, wantFldTooLong := makeString(MaxExtraInfoLen + 1)
	fieldsTooLong := logr.Fields{"prop1": fldTooLong, "prop2": "test data"}
	wantTooLong := []string{wantFldTooLong, "prop2=test data"}

	type args struct {
		fields logr.Fields
		maxlen int
		skips  []string
	}
	tests := []struct {
		name string
		args args
		want []string
	}{
		// TODO: Add test cases.
		{name: "ok", args: args{fields: fieldsOk, maxlen: MaxExtraInfoLen}, want: wantOk},
		{name: "tooLong", args: args{fields: fieldsTooLong, maxlen: MaxExtraInfoLen}, want: wantTooLong},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := getExtraInfos(tt.args.fields, tt.args.maxlen, tt.args.skips...); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("getExtraInfos() = %v, want %v", got, tt.want)
				for i, s := range tt.want {
					if got[i] != s {
						t.Errorf("Len idx %d = %d, want len %d", i, len(got[i]), len(s))
					}
				}
			}
		})
	}
}

func makeString(length int) (str string, strTrunc string) {
	str = strings.Repeat("z", length)
	strTrunc = str
	if len(str) > MaxExtraInfoLen {
		strTrunc = str[:MaxExtraInfoLen-3] + "..."
	}
	return
}
