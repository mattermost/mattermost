// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package hashers

import (
	"crypto/pbkdf2"
	"crypto/sha256"
	"encoding/base64"
	"math/rand"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
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
	passwordTooLong := make([]byte, PasswordMaxLengthBytes+1)
	_, err := rand.Read(passwordTooLong)
	require.NoError(t, err)

	testCases := []struct {
		testName    string
		storedPwd   string
		inputPwd    string
		expectedErr error
		skipFIPS    bool
	}{
		{
			testName:    "empty password",
			storedPwd:   "",
			inputPwd:    "",
			expectedErr: nil,
			skipFIPS:    true,
		},
		{
			testName:    "same password",
			storedPwd:   "one password!!!",
			inputPwd:    "one password!!!",
			expectedErr: nil,
		},
		{
			testName:    "different password",
			storedPwd:   "one password!!!",
			inputPwd:    "another password",
			expectedErr: ErrMismatchedHashAndPassword,
		},
		{
			testName:    "password too long",
			storedPwd:   "stored password",
			inputPwd:    string(passwordTooLong),
			expectedErr: ErrPasswordTooLong,
		},
	}

	hasher := DefaultPBKDF2()

	for _, tc := range testCases {
		t.Run(tc.testName, func(t *testing.T) {
			if tc.skipFIPS && model.FIPSEnabled {
				t.Skip("skipping under FIPS: PBKDF2 requires keys >= 14 bytes")
			}
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
