// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

import (
	"crypto/x509"
	"reflect"
	"testing"
)

func Test_getCertPool(t *testing.T) {
	type args struct {
		cert string
	}
	tests := []struct {
		name string
		args args
		want *x509.CertPool
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := getCertPool(tt.args.cert); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("getCertPool() = %v, want %v", got, tt.want)
			}
		})
	}
}
