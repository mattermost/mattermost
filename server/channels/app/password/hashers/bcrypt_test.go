// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package hashers

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/v8/channels/app/password/phcparser"
	"github.com/stretchr/testify/require"
)

func TestBCryptHash(t *testing.T) {
	testCases := []struct {
		testName    string
		pwd         string
		expectedErr error
	}{
		// BCrypt.Hash is a very thing wrapper over crypto/bcrypt, so we only test
		// the differences with that method
		{
			testName:    "valid password",
			pwd:         "^a v3ery c0mp_ex Passw∙rd$",
			expectedErr: nil,
		},
		{
			testName:    "very long password",
			pwd:         strings.Repeat("verylong", 72),
			expectedErr: ErrPasswordTooLong,
		},
	}

	for _, tc := range testCases {
		hasher := NewBCrypt()

		_, err := hasher.Hash(tc.pwd)
		if tc.expectedErr != nil {
			require.ErrorIs(t, err, tc.expectedErr)
		} else {
			require.NoError(t, err)
		}
	}
}

func TestBCryptCompareHashAndPassword(t *testing.T) {
	testCases := []struct {
		testName    string
		storedPwd   string
		inputPwd    string
		expectedErr error
	}{
		{
			"empty password",
			"",
			"",
			nil,
		},
		{
			"same password",
			"one password",
			"one password",
			nil,
		},
		{
			"different password",
			"one password",
			"another password",
			ErrMismatchedHashAndPassword,
		},
	}

	hasher := NewBCrypt()

	for _, tc := range testCases {
		t.Run(tc.testName, func(t *testing.T) {
			hash, err := hasher.Hash(tc.storedPwd)
			require.NoError(t, err)

			err = hasher.CompareHashAndPassword(phcparser.PHC{Hash: hash}, tc.inputPwd)
			if tc.expectedErr != nil {
				require.ErrorIs(t, err, tc.expectedErr)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
