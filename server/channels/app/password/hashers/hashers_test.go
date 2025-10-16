// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package hashers

import (
	"testing"

	"github.com/mattermost/mattermost/server/v8/channels/app/password/phcparser"
	"github.com/stretchr/testify/require"
)

func TestGetHasherFromPHCString(t *testing.T) {
	testCases := []struct {
		testName       string
		input          string
		expectedHasher PasswordHasher
		expectedPHC    phcparser.PHC
		expectedErr    bool
	}{
		{
			testName:       "latest hasher (PBKDF2)",
			input:          "$pbkdf2$f=SHA256,w=600000,l=32$5Zq8TvET7nMrXof49Rp4Sw$d0Mx8467kv+3ylbGrkyu4jTd8O8SP51k4s1RuWb9S/o",
			expectedHasher: latestHasher,
			expectedPHC: phcparser.PHC{
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
			expectedErr: false,
		},
		{
			testName: "valid, non-default PBKDF2",
			input:    "$pbkdf2$f=SHA256,w=10000,l=10$5Zq8TvET7nMrXof49Rp4Sw$d0Mx8467kv+3ylbGrkyu4jTd8O8SP51k4s1RuWb9S/o",
			expectedHasher: PBKDF2{
				workFactor: 10000,
				keyLength:  10,
				phcHeader:  "$pbkdf2$f=SHA256,w=10000,l=10$",
			},
			expectedPHC: phcparser.PHC{
				Id:      "pbkdf2",
				Version: "",
				Params: map[string]string{
					"f": "SHA256",
					"w": "10000",
					"l": "10",
				},
				Salt: "5Zq8TvET7nMrXof49Rp4Sw",
				Hash: "d0Mx8467kv+3ylbGrkyu4jTd8O8SP51k4s1RuWb9S/o",
			},
			expectedErr: false,
		},
		{
			testName:       "valid bcrypt",
			input:          "$2a$10$z0OlN1MpiLVlLTyE1xtEjOJ6/xV95RAwwIUaYKQBAqoeyvPgLEnUa",
			expectedHasher: NewBCrypt(),
			expectedPHC: phcparser.PHC{
				Hash: "$2a$10$z0OlN1MpiLVlLTyE1xtEjOJ6/xV95RAwwIUaYKQBAqoeyvPgLEnUa",
			},
			expectedErr: false,
		},
		{
			testName:       "invalid phc - default to bcrypt",
			input:          "invalid",
			expectedHasher: NewBCrypt(),
			expectedPHC: phcparser.PHC{
				Hash: "invalid",
			},
			expectedErr: false,
		},
		{
			testName: "valid PBKDF2 with invalid parameters",
			input:    "$pbkdf2$f=SHA256,w=-50,l=0$5Zq8TvET7nMrXof49Rp4Sw$d0Mx8467kv+3ylbGrkyu4jTd8O8SP51k4s1RuWb9S/o",
			expectedHasher: PBKDF2{
				workFactor: 10000,
				keyLength:  10,
				phcHeader:  "$pbkdf2$f=SHA256,w=10000,l=10$",
			},
			expectedPHC: phcparser.PHC{},
			expectedErr: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.testName, func(t *testing.T) {
			actualHasher, actualPHC, err := GetHasherFromPHCString(tc.input)
			if tc.expectedErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.expectedHasher, actualHasher)
			require.Equal(t, tc.expectedPHC, actualPHC)
		})
	}
}

func TestIsLatestHasher(t *testing.T) {
	pbkdf2WithOtherParams, err := NewPBKDF2(10000, 16)
	require.NoError(t, err)

	testCases := []struct {
		testName       string
		inputHasher    PasswordHasher
		expectedOutput bool
	}{
		{
			"latestHasher is the latest hasher",
			latestHasher,
			true,
		},
		{
			"DefaultPBKDF2 is the latest hasher",
			DefaultPBKDF2(),
			true,
		},
		{
			"PBKDF2 with other parameters is not the latest hasher",
			pbkdf2WithOtherParams,
			false,
		},
		{
			"bcrypt is not the latest hasher",
			NewBCrypt(),
			false,
		},
	}
	for _, tc := range testCases {
		actualOutput := IsLatestHasher(tc.inputHasher)
		require.Equal(t, tc.expectedOutput, actualOutput)
	}
}
