// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

import (
	"testing"

	"github.com/stretchr/testify/require"
)

type bloated struct {
	fld1 string
	fld2 string
	fld3 string
	fld4 string
}

type wilted struct {
	wilt1 string
}

func conv(val interface{}) (interface{}, bool) {
	if b, ok := val.(*bloated); ok {
		return &wilted{wilt1: b.fld1}, true
	}
	return val, false
}

func TestRecord_AddMeta(t *testing.T) {
	type fields struct {
		metaConv []FuncMetaTypeConv
	}
	type args struct {
		name string
		val  interface{}
	}
	tests := []struct {
		name     string
		fields   fields
		args     args
		wantWilt bool
		wantVal  string
	}{
		{name: "no converter", wantWilt: false, wantVal: "ok", fields: fields{}, args: args{name: "prop", val: "ok"}},
		{name: "don't convert", wantWilt: false, wantVal: "ok", fields: fields{metaConv: []FuncMetaTypeConv{conv}}, args: args{name: "prop", val: "ok"}},
		{name: "convert", wantWilt: true, wantVal: "1", fields: fields{metaConv: []FuncMetaTypeConv{conv}}, args: args{name: "prop", val: &bloated{
			fld1: "1", fld2: "2", fld3: "3", fld4: "4"}},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := &Record{
				metaConv: tt.fields.metaConv,
			}
			rec.AddMeta(tt.args.name, tt.args.val)

			// fetch the prop store in auditRecord meta data
			var ok bool
			var got interface{}
			for _, meta := range rec.Meta {
				if meta.K == "prop" {
					ok = true
					got = meta.V
					break
				}
			}
			require.True(t, ok)

			// check if conversion was expected
			val, ok := got.(*wilted)
			require.Equal(t, tt.wantWilt, ok)

			if ok {
				// if converted to wilt then make sure field was copied
				require.Equal(t, tt.wantVal, val.wilt1)
			} else {
				// if not converted, make sure val is unchanged
				require.Equal(t, tt.wantVal, got)
			}
		})
	}
}
