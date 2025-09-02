// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package users

import (
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/password/hashers"
)

func CheckUserPassword(user *model.User, password string) error {
	if password == "" || user.Password == "" {
		return InvalidPasswordError
	}

	// Validate the stored hash is compliant with the currently used password
	// hasher, and fail early if it is not
	hasher, phc := hashers.GetHasherFromPHCString(user.Password)
	if hasher != hashers.LatestHasher {
		return OutdatedPasswordHashingError
	}

	// Run the actual comparison
	if err := hashers.LatestHasher.CompareHashAndPassword(phc, password); err != nil {
		return InvalidPasswordError
	}

	return nil
}

func MigratePassword(user *model.User, password string) (string, error) {
	// First, validate that the stored hash and the provided password match
	hasher, phc := hashers.GetHasherFromPHCString(user.Password)
	if err := hasher.CompareHashAndPassword(phc, password); err != nil {
		return "", InvalidPasswordError
	}

	// If the password is valid, hash the password with the latest hasher
	return hashers.LatestHasher.Hash(password)
}

func (us *UserService) isPasswordValid(password string) error {
	return IsPasswordValidWithSettings(password, &us.config().PasswordSettings)
}

// IsPasswordValidWithSettings is a utility functions that checks if the given password
// conforms to the password settings. It returns the error id as error value.
func IsPasswordValidWithSettings(password string, settings *model.PasswordSettings) error {
	id := "model.user.is_valid.pwd"
	isError := false
	isMinMaxError := false

	if len(password) < *settings.MinimumLength {
		isError = true
		isMinMaxError = true
		id = id + "_min_length"
	}

	if len(password) > model.PasswordMaximumLength {
		isError = true
		isMinMaxError = true
		id = id + "_max_length"
	}

	if !isMinMaxError {
		if *settings.Lowercase {
			if !strings.ContainsAny(password, model.LowercaseLetters) {
				isError = true
				id = id + "_lowercase"
			}
		}

		if *settings.Uppercase {
			if !strings.ContainsAny(password, model.UppercaseLetters) {
				isError = true
				id = id + "_uppercase"
			}
		}

		if *settings.Number {
			if !strings.ContainsAny(password, model.NUMBERS) {
				isError = true
				id = id + "_number"
			}
		}

		if *settings.Symbol {
			if !strings.ContainsAny(password, model.SYMBOLS) {
				isError = true
				id = id + "_symbol"
			}
		}
	}

	if isError {
		return NewErrInvalidPassword(id + ".app_error")
	}

	return nil
}
