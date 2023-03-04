// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package auth

import (
	"fmt"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

const (
	PasswordMaximumLength    = 64
	PasswordSpecialChars     = "!\"\\#$%&'()*+,-./:;<=>?@[]^_`|~" //nolint:gosec
	PasswordNumbers          = "0123456789"
	PasswordUpperCaseLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	PasswordLowerCaseLetters = "abcdefghijklmnopqrstuvwxyz"
	PasswordAllChars         = PasswordSpecialChars + PasswordNumbers + PasswordUpperCaseLetters + PasswordLowerCaseLetters

	InvalidLowercasePassword = "lowercase"
	InvalidMinLengthPassword = "min-length"
	InvalidMaxLengthPassword = "max-length"
	InvalidNumberPassword    = "number"
	InvalidUppercasePassword = "uppercase"
	InvalidSymbolPassword    = "symbol"
)

var PasswordHashStrength = 10

// HashPassword generates a hash using the bcrypt.GenerateFromPassword.
func HashPassword(password string) string {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), PasswordHashStrength)
	if err != nil {
		panic(err)
	}

	return string(hash)
}

// ComparePassword compares the hash.
func ComparePassword(hash, password string) bool {
	if password == "" || hash == "" {
		return false
	}

	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

type InvalidPasswordError struct {
	FailingCriterias []string
}

func (ipe *InvalidPasswordError) Error() string {
	return fmt.Sprintf("invalid password, failing criteria: %s", strings.Join(ipe.FailingCriterias, ", "))
}

type PasswordSettings struct {
	MinimumLength int
	Lowercase     bool
	Number        bool
	Uppercase     bool
	Symbol        bool
}

func IsPasswordValid(password string, settings PasswordSettings) error {
	err := &InvalidPasswordError{
		FailingCriterias: []string{},
	}

	if len(password) < settings.MinimumLength {
		err.FailingCriterias = append(err.FailingCriterias, InvalidMinLengthPassword)
	}

	if len(password) > PasswordMaximumLength {
		err.FailingCriterias = append(err.FailingCriterias, InvalidMaxLengthPassword)
	}

	if settings.Lowercase {
		if !strings.ContainsAny(password, PasswordLowerCaseLetters) {
			err.FailingCriterias = append(err.FailingCriterias, InvalidLowercasePassword)
		}
	}

	if settings.Uppercase {
		if !strings.ContainsAny(password, PasswordUpperCaseLetters) {
			err.FailingCriterias = append(err.FailingCriterias, InvalidUppercasePassword)
		}
	}

	if settings.Number {
		if !strings.ContainsAny(password, PasswordNumbers) {
			err.FailingCriterias = append(err.FailingCriterias, InvalidNumberPassword)
		}
	}

	if settings.Symbol {
		if !strings.ContainsAny(password, PasswordSpecialChars) {
			err.FailingCriterias = append(err.FailingCriterias, InvalidSymbolPassword)
		}
	}

	if len(err.FailingCriterias) > 0 {
		return err
	}

	return nil
}
