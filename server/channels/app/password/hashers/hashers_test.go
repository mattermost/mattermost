// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package hashers

import (
	"testing"

	"github.com/mattermost/mattermost/server/v8/channels/app/password/parser"
	"github.com/stretchr/testify/require"
)

func TestGetHasherFromPHCString(t *testing.T) {
	testCases := []struct {
		testName       string
		input          string
		expectedHasher PasswordHasher
		expectedPHC    parser.PHC
		expectedErr    bool
	}{
		{
			testName:       "valid PBKDF2",
			input:          "$pbkdf2$f=SHA256,w=600000,l=32$5Zq8TvET7nMrXof49Rp4Sw$d0Mx8467kv+3ylbGrkyu4jTd8O8SP51k4s1RuWb9S/o",
			expectedHasher: latestHasher,
			expectedPHC: parser.PHC{
				Id:      "pbkdf2",
				Version: "",
				Params: map[string]string{
					"f": "SHA256",
					"w": "600000",
					"l": "32",
				},
				Salt: "5Zq8TvET7nMrXof49Rp4Sw",
				Hash: "d0Mx8467kv+3ylbGrkyu4jTd8O8SP51k4s1RuWb9S/o",
			},
		},
		{
			testName:       "valid bcrypt",
			input:          "$2a$10$z0OlN1MpiLVlLTyE1xtEjOJ6/xV95RAwwIUaYKQBAqoeyvPgLEnUa",
			expectedHasher: NewBCrypt(),
			expectedPHC: parser.PHC{
				Hash: "$2a$10$z0OlN1MpiLVlLTyE1xtEjOJ6/xV95RAwwIUaYKQBAqoeyvPgLEnUa",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.testName, func(t *testing.T) {
			actualHasher, actualPHC := GetHasherFromPHCString(tc.input)
			require.Equal(t, tc.expectedHasher, actualHasher)
			require.Equal(t, tc.expectedPHC, actualPHC)
		})
	}
}
