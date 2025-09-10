// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package hashers

import (
	"crypto/pbkdf2"
	"crypto/sha256"
	"encoding/base64"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/v8/channels/app/password/phcparser"
	"github.com/stretchr/testify/require"
)

func TestPBKDF2Hash(t *testing.T) {
	password := "^a v3ery c0mp_ex Passw∙rd$"
	workFactor := 600000
	keyLength := 32

	hasher, err := NewPBKDF2(workFactor, keyLength)
	require.NoError(t, err)

	str, err := hasher.Hash(password)
	require.NoError(t, err)

	phc, err := phcparser.New(strings.NewReader(str)).Parse()
	require.NoError(t, err)
	require.Equal(t, "pbkdf2", phc.Id)
	require.Equal(t, "", phc.Version)
	require.Equal(t, map[string]string{
		"f": "SHA256",
		"w": "600000",
		"l": "32",
	}, phc.Params)

	salt, err := base64.RawStdEncoding.DecodeString(phc.Salt)
	require.NoError(t, err)

	hash, err := pbkdf2.Key(sha256.New, password, salt, workFactor, keyLength)
	require.NoError(t, err)

	expectedHash := base64.RawStdEncoding.EncodeToString(hash)
	require.Equal(t, expectedHash, phc.Hash)
}

func TestPBKDF2CompareHashAndPassword(t *testing.T) {
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

	hasher := DefaultPBKDF2()

	for _, tc := range testCases {
		t.Run(tc.testName, func(t *testing.T) {
			storedPHCStr, err := hasher.Hash(tc.storedPwd)
			require.NoError(t, err)

			storedPHC, err := phcparser.New(strings.NewReader(storedPHCStr)).Parse()
			require.NoError(t, err)

			err = hasher.CompareHashAndPassword(storedPHC, tc.inputPwd)
			if tc.expectedErr != nil {
				require.ErrorIs(t, err, tc.expectedErr)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
