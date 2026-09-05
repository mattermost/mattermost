// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"testing"
)

func TestRandIntFromRange(t *testing.T) {
	// Test basic range
	r := Range{Begin: 1, End: 10}
	for i := 0; i < 100; i++ {
		val := RandIntFromRange(r)
		if val < 1 || val > 10 {
			t.Errorf("RandIntFromRange returned %d, expected between 1 and 10", val)
		}
	}

	// Test edge case: begin == end
	r2 := Range{Begin: 5, End: 5}
	val := RandIntFromRange(r2)
	if val != 5 {
		t.Errorf("RandIntFromRange for equal range returned %d, expected 5", val)
	}

	// Test invalid range: begin > end
	r3 := Range{Begin: 10, End: 5}
	val = RandIntFromRange(r3)
	if val != 10 {
		t.Errorf("RandIntFromRange for invalid range returned %d, expected 10", val)
	}
}