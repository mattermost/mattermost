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
	wantOk := []string{"prop1=hello | prop2:there"}

	//fieldsTooLong := logr.Fields{"prop1": strings.Repeat("z", MaxExtraInfoLen)}

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
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := getExtraInfos(tt.args.fields, tt.args.maxlen, tt.args.skips...); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("getExtraInfos() = %v, want %v", got, tt.want)
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
