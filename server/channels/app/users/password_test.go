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
