// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestThreadMembershipIsValid(t *testing.T) {
	cases := map[string]struct {
		Member        *ThreadMembership
		ShouldBeValid bool
	}{
		"valid member": {
			Member:        &ThreadMembership{PostId: NewId(), UserId: NewId()},
			ShouldBeValid: true,
		},
		"empty post id": {
			Member:        &ThreadMembership{PostId: "", UserId: NewId()},
			ShouldBeValid: false,
		},
		"empty user id": {
			Member:        &ThreadMembership{PostId: NewId(), UserId: ""},
			ShouldBeValid: false,
		},
		"invalid post id": {
			Member:        &ThreadMembership{PostId: "invalid", UserId: NewId()},
			ShouldBeValid: false,
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			require.Equal(t, tc.ShouldBeValid, (tc.Member.IsValid() == nil))
		})
	}
}
