// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package users

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestIsPasswordValidWithSettings(t *testing.T) {
	for name, tc := range map[string]struct {
		Password      string
		Settings      *model.PasswordSettings
		ExpectedError string
	}{
		"Short": {
			Password: strings.Repeat("x", model.PasswordFIPSMinimumLength),
			Settings: &model.PasswordSettings{
				MinimumLength: model.NewPointer(model.PasswordFIPSMinimumLength),
				Lowercase:     new(false),
				Uppercase:     new(false),
				Number:        new(false),
				Symbol:        new(false),
			},
		},
		"Long": {
			Password: strings.Repeat("x", model.PasswordMaximumLength),
			Settings: &model.PasswordSettings{
				Lowercase: new(false),
				Uppercase: new(false),
				Number:    new(false),
				Symbol:    new(false),
			},
		},
		"TooShort": {
			Password: strings.Repeat("x", 2),
			Settings: &model.PasswordSettings{
				MinimumLength: model.NewPointer(model.PasswordFIPSMinimumLength),
				Lowercase:     new(false),
				Uppercase:     new(false),
				Number:        new(false),
				Symbol:        new(false),
			},
			ExpectedError: "model.user.is_valid.pwd_min_length.app_error",
		},
		"TooLong": {
			Password: strings.Repeat("x", model.PasswordMaximumLength+1),
			Settings: &model.PasswordSettings{
				Lowercase: new(false),
				Uppercase: new(false),
				Number:    new(false),
				Symbol:    new(false),
			},
			ExpectedError: "model.user.is_valid.pwd_max_length.app_error",
		},
		"MissingLower": {
			Password: "AAAAAAAAAAASD123!@#",
			Settings: &model.PasswordSettings{
				Lowercase: new(true),
				Uppercase: new(false),
				Number:    new(false),
				Symbol:    new(false),
			},
			ExpectedError: "model.user.is_valid.pwd_lowercase.app_error",
		},
		"MissingUpper": {
			Password: "aaaaaaaaaaaaasd123!@#",
			Settings: &model.PasswordSettings{
				Uppercase: new(true),
				Lowercase: new(false),
				Number:    new(false),
				Symbol:    new(false),
			},
			ExpectedError: "model.user.is_valid.pwd_uppercase.app_error",
		},
		"MissingNumber": {
			Password: "asasdasdsadASD!@#",
			Settings: &model.PasswordSettings{
				Number:    new(true),
				Lowercase: new(false),
				Uppercase: new(false),
				Symbol:    new(false),
			},
			ExpectedError: "model.user.is_valid.pwd_number.app_error",
		},
		"MissingSymbol": {
			Password: "asdasdasdasdasdASD123",
			Settings: &model.PasswordSettings{
				Symbol:    new(true),
				Lowercase: new(false),
				Uppercase: new(false),
				Number:    new(false),
			},
			ExpectedError: "model.user.is_valid.pwd_symbol.app_error",
		},
		"MissingMultiple": {
			Password: "asdasdasdasdasdasd",
			Settings: &model.PasswordSettings{
				Lowercase: new(true),
				Uppercase: new(true),
				Number:    new(true),
				Symbol:    new(true),
			},
			ExpectedError: "model.user.is_valid.pwd_uppercase_number_symbol.app_error",
		},
		"Everything": {
			Password: "asdASDasd!@#123",
			Settings: &model.PasswordSettings{
				Lowercase: new(true),
				Uppercase: new(true),
				Number:    new(true),
				Symbol:    new(true),
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
