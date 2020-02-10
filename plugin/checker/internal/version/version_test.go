// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package version

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestVersionComparison(t *testing.T) {
	testCases := []struct {
		a, b V
	}{
		{
			a: V("1.2"),
			b: V("1.10"),
		},
		{
			a: V("1.2.1"),
			b: V("1.2.3"),
		},
		{
			a: V("1.2"),
			b: V("1.2.3"),
		},
		{
			a: V("1.2.1"),
			b: V("1.2.3"),
		},
		{
			a: V("1.1"),
			b: V("1.2.3"),
		},
		{
			a: V("1.2.3"),
			b: V("1.3"),
		},
		{
			a: V("1.2.1-rc2"),
			b: V("1.2.1-rc10"),
		},
	}

	for _, tc := range testCases {
		t.Run(fmt.Sprintf("%+v", tc), func(t *testing.T) {
			assert.True(t, tc.a.LessThan(tc.b))
			assert.False(t, tc.b.LessThan(tc.a))

			assert.True(t, tc.b.GreaterThanOrEqualTo(tc.a))
			assert.False(t, tc.a.GreaterThanOrEqualTo(tc.b))
		})
	}

	assert.True(t, V("1.2").GreaterThanOrEqualTo("1.2"))
}
