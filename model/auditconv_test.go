// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

type Sample struct {
	flag bool
	name string
}

func TestAuditModelTypeConv(t *testing.T) {
	sample := &Sample{flag: true, name: "sample"}
	sample2 := &Sample{name: "sample2"}
	sampleArr := []*Sample{sample, sample2}

	user := &User{}

	type args struct {
		val interface{}
	}
	tests := []struct {
		name          string
		args          args
		wantConverted bool
		wantNewVal    interface{}
	}{
		{name: "nil value", args: args{val: nil}, wantConverted: false, wantNewVal: nil},
		{name: "string value", args: args{val: "hello"}, wantConverted: false, wantNewVal: "hello"},
		{name: "string array", args: args{val: []string{"hello", "there"}}, wantConverted: false, wantNewVal: []string{"hello", "there"}},
		{name: "int value", args: args{val: 77}, wantConverted: false, wantNewVal: 77},
		{name: "int array", args: args{val: []int{77, 68}}, wantConverted: false, wantNewVal: []int{77, 68}},
		{name: "struct pointer value", args: args{val: sample}, wantConverted: false, wantNewVal: sample},
		{name: "struct pointer array", args: args{val: sampleArr}, wantConverted: false, wantNewVal: sampleArr},
		{name: "model user", args: args{val: user}, wantConverted: true, wantNewVal: "XXX"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotNewVal, gotConverted := AuditModelTypeConv(tt.args.val)
			assert.Equal(t, tt.wantConverted, gotConverted)
			if !tt.wantConverted {
				assert.Equal(t, tt.wantNewVal, gotNewVal)
			}
		})
	}
}
