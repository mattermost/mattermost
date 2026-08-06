// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

// TestCreateUserPasswordLength ensures all generated sampledata passwords meet the
// FIPS minimum length requirement (14 chars) for every user type and index range.
func TestCreateUserPasswordLength(t *testing.T) {
	const minLen = model.PasswordFIPSMinimumLength

	indices := []int{0, 1, 9, 10, 99, 100, 999, 1000}
	userTypes := []string{guestUser, deactivatedUser, ""}

	for _, userType := range userTypes {
		for _, idx := range indices {
			data := createUser(idx, 0, 0, map[string][]string{}, nil, userType)
			pwd := *data.User.Password
			require.GreaterOrEqualf(t, len(pwd), minLen,
				"password %q (userType=%q idx=%d) is shorter than FIPS minimum %d",
				pwd, userType, idx, minLen)
		}
	}
}
