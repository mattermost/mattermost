// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"reflect"
	"strings"
	"testing"

	"github.com/wiggin77/logr"
)

const (
	TestMaxExtraInfoLen = 50
)

func Test_getExtraInfos(t *testing.T) {
	fieldsOk := logr.Fields{"prop1": "Hello", "prop2": "there"}
	wantOk := []string{"prop1=Hello | prop2=there"}

	fldTooLong, wantFldTooLong := makeString("prop1", TestMaxExtraInfoLen+1)
	fieldsTooLong := logr.Fields{"prop1": fldTooLong, "prop2": "test data"}
	wantTooLong := []string{wantFldTooLong, "prop2=test data"}

	fieldsEmpty := logr.Fields{}
	wantEmpty := []string{""}

	fldMany0, wantFldMany0 := makeString("prop0", TestMaxExtraInfoLen+2)
	fldManyZ, wantFldManyZ := makeString("propZ", TestMaxExtraInfoLen+2)

	fieldsMany := logr.Fields{"prop0": fldMany0, "prop1": "one", "prop2": "two", "prop3": "three", "prop4": "four", "prop5": "five",
		"prop6": "six", "prop7": "seven", "prop8": "eight", "prop9": "nine", "prop10": "ten", "prop11": "eleven",
		"prop12": "twelve", "prop13": "thirteen", "prop14": "fourteen", "prop15": "fifteen", "prop16": "sixteen",
		"prop17": "seventeen", "prop18": "eighteen", "prop19": "nineteen", "prop20": "twenty", "propZ": fldManyZ}
	wantMany := []string{
		//                                                |50
		wantFldMany0,
		"prop1=one | prop10=ten | prop11=eleven",
		"prop12=twelve | prop13=thirteen | prop14=fourteen",
		"prop15=fifteen | prop16=sixteen | prop17=seventeen",
		"prop18=eighteen | prop19=nineteen | prop2=two",
		"prop20=twenty | prop3=three | prop4=four",
		"prop5=five | prop6=six | prop7=seven | prop8=eight",
		"prop9=nine",
		wantFldManyZ,
	}

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
		{name: "ok", args: args{fields: fieldsOk, maxlen: TestMaxExtraInfoLen}, want: wantOk},
		{name: "tooLong", args: args{fields: fieldsTooLong, maxlen: TestMaxExtraInfoLen}, want: wantTooLong},
		{name: "empty", args: args{fields: fieldsEmpty, maxlen: TestMaxExtraInfoLen}, want: wantEmpty},
		{name: "many", args: args{fields: fieldsMany, maxlen: TestMaxExtraInfoLen}, want: wantMany},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := getExtraInfos(tt.args.fields, tt.args.maxlen, tt.args.skips...)

			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("got %v, want %v", printStringArray(got), printStringArray(tt.want))
			}

			for i, s := range got {
				if len(s) > TestMaxExtraInfoLen {
					t.Errorf("idx %d len is %d, expected len %d", i, len(s), TestMaxExtraInfoLen)
				}
			}

			for i, s := range tt.want {
				if got[i] != s || len(got[i]) > TestMaxExtraInfoLen {
					t.Errorf("Len idx %d = %d, want len %d", i, len(got[i]), len(s))
				}
			}
		})
	}
}

func makeString(key string, length int) (str string, strTrunc string) {
	str = strings.Repeat("z", length)
	strTrunc = key + "=" + str
	if len(str) > TestMaxExtraInfoLen {
		strTrunc = strTrunc[:TestMaxExtraInfoLen-3] + "..."
	}
	return
}

func printStringArray(arr []string) string {
	sb := strings.Builder{}
	sb.WriteString("[")
	for _, s := range arr {
		sb.WriteString("\"")
		sb.WriteString(s)
		sb.WriteString("\", ")
	}
	sb.WriteString("]")
	return sb.String()
}
