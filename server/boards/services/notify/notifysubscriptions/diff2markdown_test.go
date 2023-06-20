// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package notifysubscriptions

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_reverse(t *testing.T) {
	tests := []struct {
		name string
		ss   []string
		want []string
	}{
		{name: "even", ss: []string{"one", "two", "three", "four"}, want: []string{"four", "three", "two", "one"}},
		{name: "odd", ss: []string{"one", "two", "three"}, want: []string{"three", "two", "one"}},
		{name: "one", ss: []string{"one"}, want: []string{"one"}},
		{name: "empty", ss: []string{}, want: []string{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reverse(tt.ss)
			assert.Equal(t, tt.want, tt.ss)
		})
	}
}
