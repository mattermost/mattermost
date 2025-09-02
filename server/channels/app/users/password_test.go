// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package users

import (
	"crypto/rand"
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/argon2"
	"golang.org/x/crypto/bcrypt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/password/hashers"
	"github.com/mattermost/mattermost/server/v8/channels/app/password/parser"
)

func TestIsPasswordValidWithSettings(t *testing.T) {
	for name, tc := range map[string]struct {
		Password      string
		Settings      *model.PasswordSettings
		ExpectedError string
	}{
		"Short": {
			Password: strings.Repeat("x", 3),
			Settings: &model.PasswordSettings{
				MinimumLength: model.NewPointer(3),
				Lowercase:     model.NewPointer(false),
				Uppercase:     model.NewPointer(false),
				Number:        model.NewPointer(false),
				Symbol:        model.NewPointer(false),
			},
		},
		"Long": {
			Password: strings.Repeat("x", model.PasswordMaximumLength),
			Settings: &model.PasswordSettings{
				Lowercase: model.NewPointer(false),
				Uppercase: model.NewPointer(false),
				Number:    model.NewPointer(false),
				Symbol:    model.NewPointer(false),
			},
		},
		"TooShort": {
			Password: strings.Repeat("x", 2),
			Settings: &model.PasswordSettings{
				MinimumLength: model.NewPointer(3),
				Lowercase:     model.NewPointer(false),
				Uppercase:     model.NewPointer(false),
				Number:        model.NewPointer(false),
				Symbol:        model.NewPointer(false),
			},
			ExpectedError: "model.user.is_valid.pwd_min_length.app_error",
		},
		"TooLong": {
			Password: strings.Repeat("x", model.PasswordMaximumLength+1),
			Settings: &model.PasswordSettings{
				Lowercase: model.NewPointer(false),
				Uppercase: model.NewPointer(false),
				Number:    model.NewPointer(false),
				Symbol:    model.NewPointer(false),
			},
			ExpectedError: "model.user.is_valid.pwd_max_length.app_error",
		},
		"MissingLower": {
			Password: "AAAAAAAAAAASD123!@#",
			Settings: &model.PasswordSettings{
				Lowercase: model.NewPointer(true),
				Uppercase: model.NewPointer(false),
				Number:    model.NewPointer(false),
				Symbol:    model.NewPointer(false),
			},
			ExpectedError: "model.user.is_valid.pwd_lowercase.app_error",
		},
		"MissingUpper": {
			Password: "aaaaaaaaaaaaasd123!@#",
			Settings: &model.PasswordSettings{
				Uppercase: model.NewPointer(true),
				Lowercase: model.NewPointer(false),
				Number:    model.NewPointer(false),
				Symbol:    model.NewPointer(false),
			},
			ExpectedError: "model.user.is_valid.pwd_uppercase.app_error",
		},
		"MissingNumber": {
			Password: "asasdasdsadASD!@#",
			Settings: &model.PasswordSettings{
				Number:    model.NewPointer(true),
				Lowercase: model.NewPointer(false),
				Uppercase: model.NewPointer(false),
				Symbol:    model.NewPointer(false),
			},
			ExpectedError: "model.user.is_valid.pwd_number.app_error",
		},
		"MissingSymbol": {
			Password: "asdasdasdasdasdASD123",
			Settings: &model.PasswordSettings{
				Symbol:    model.NewPointer(true),
				Lowercase: model.NewPointer(false),
				Uppercase: model.NewPointer(false),
				Number:    model.NewPointer(false),
			},
			ExpectedError: "model.user.is_valid.pwd_symbol.app_error",
		},
		"MissingMultiple": {
			Password: "asdasdasdasdasdasd",
			Settings: &model.PasswordSettings{
				Lowercase: model.NewPointer(true),
				Uppercase: model.NewPointer(true),
				Number:    model.NewPointer(true),
				Symbol:    model.NewPointer(true),
			},
			ExpectedError: "model.user.is_valid.pwd_uppercase_number_symbol.app_error",
		},
		"Everything": {
			Password: "asdASD!@#123",
			Settings: &model.PasswordSettings{
				Lowercase: model.NewPointer(true),
				Uppercase: model.NewPointer(true),
				Number:    model.NewPointer(true),
				Symbol:    model.NewPointer(true),
			},
		},
	} {
		tc.Settings.SetDefaults()
		t.Run(name, func(t *testing.T) {
			if err := IsPasswordValidWithSettings(tc.Password, tc.Settings); tc.ExpectedError == "" {
				assert.NoError(t, err)
			} else {
				invErr, ok := err.(*ErrInvalidPassword)
				require.True(t, ok)
				assert.Equal(t, tc.ExpectedError, invErr.Id())
			}
		})
	}
}

func TestCheckUserPassword(t *testing.T) {
	// Create random salt
	salt := make([]byte, 16)
	_, err := io.ReadFull(rand.Reader, salt)
	require.NoError(t, err)

	// Prepare a pwd and its old hash, generated with bcrypt and argon2i
	pwd := "testPass123$"
	pwdBcryptBytes, err := bcrypt.GenerateFromPassword([]byte(pwd), 10)
	require.NoError(t, err)
	pwdBcrypt := string(pwdBcryptBytes)
	pwdArgon2Bytes := argon2.Key([]byte(pwd), salt, 3, 32*1024, 4, 32)
	pwdArgon2 := string(pwdArgon2Bytes)
	pwdPbkdf2, err := hashers.LatestHasher.Hash(pwd)
	require.NoError(t, err)

	testCases := []struct {
		testName         string
		storedPassword   string
		providedPassword string
		expectedErr      error
	}{
		{
			testName:         "old password hashed with bcrypt errors as outdated",
			storedPassword:   pwdBcrypt,
			providedPassword: pwd,
			expectedErr:      OutdatedPasswordHashingError,
		},
		{
			testName:         "old password hashed with an unknow hasher errors as outdated",
			storedPassword:   pwdArgon2,
			providedPassword: pwd,
			expectedErr:      OutdatedPasswordHashingError,
		},
		{
			testName:         "empty password errors as invalid password",
			storedPassword:   pwdBcrypt,
			providedPassword: "",
			expectedErr:      InvalidPasswordError,
		},
		{
			testName:         "empty hash errors as invalid password",
			storedPassword:   "",
			providedPassword: pwd,
			expectedErr:      InvalidPasswordError,
		},
		{
			testName:         "updated hash with wrong password errors as invalid password",
			storedPassword:   pwdPbkdf2,
			providedPassword: "invalid password",
			expectedErr:      InvalidPasswordError,
		},
		{
			testName:         "updated hash with correct password succeeds",
			storedPassword:   pwdPbkdf2,
			providedPassword: pwd,
			expectedErr:      nil,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.testName, func(t *testing.T) {
			// Initialize the user with the stored password
			user := &model.User{
				Password: tc.storedPassword,
			}

			// Check the user's password
			err := CheckUserPassword(user, tc.providedPassword)
			if tc.expectedErr != nil {
				require.Error(t, err)
				require.ErrorIs(t, err, tc.expectedErr)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestMigratePassword(t *testing.T) {
	// Create random salt
	salt := make([]byte, 16)
	_, err := io.ReadFull(rand.Reader, salt)
	require.NoError(t, err)

	// Prepare a pwd and its old hash, generated with bcrypt and argon2i
	pwd := "testPass123$"
	pwdBcryptBytes, err := bcrypt.GenerateFromPassword([]byte(pwd), 10)
	require.NoError(t, err)
	pwdBcrypt := string(pwdBcryptBytes)
	pwdArgon2Bytes := argon2.Key([]byte(pwd), salt, 3, 32*1024, 4, 32)
	pwdArgon2 := string(pwdArgon2Bytes)
	pwdPbkdf2, err := hashers.LatestHasher.Hash(pwd)
	require.NoError(t, err)

	testCases := []struct {
		testName         string
		storedPassword   string
		providedPassword string
		expectedErr      error
	}{
		{
			testName:         "old password hashed with bcrypt is migrated",
			storedPassword:   pwdBcrypt,
			providedPassword: pwd,
			expectedErr:      nil,
		},
		{
			testName:         "migrating an already migrated password does nothing",
			storedPassword:   pwdPbkdf2,
			providedPassword: pwd,
			expectedErr:      nil,
		},
		{
			testName:         "old password hashed with anything other than bcrypt is not migrated",
			storedPassword:   pwdArgon2,
			providedPassword: pwd,
			expectedErr:      InvalidPasswordError,
		},
		{
			testName:         "incorrect password is not migrated",
			storedPassword:   pwdPbkdf2,
			providedPassword: "another password",
			expectedErr:      InvalidPasswordError,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.testName, func(t *testing.T) {
			// Initialize the user with the stored password
			user := &model.User{
				Password: tc.storedPassword,
			}

			// Migrate the user's password
			newHash, err := MigratePassword(user, tc.providedPassword)
			if tc.expectedErr != nil {
				require.Error(t, err)
				require.ErrorIs(t, err, tc.expectedErr)
				return
			}

			require.NoError(t, err)

			// If no error is expected, test now whether the created hash is:
			// 1. parseable
			phc, err := parser.New(strings.NewReader(newHash)).Parse()
			require.NoError(t, err)
			// 2. it is indeed the hash (with the latest hasher) of the original password
			err = hashers.LatestHasher.CompareHashAndPassword(phc, tc.providedPassword)
			require.NoError(t, err)
		})
	}
}
