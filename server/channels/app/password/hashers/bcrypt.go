// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package hashers

import (
	"errors"

	"github.com/mattermost/mattermost/server/v8/channels/app/password/phcparser"
	"golang.org/x/crypto/bcrypt"
)

// BCrypt implements the [PasswordHasher] interface using the
// golang.org/x/crypto/bcrypt as the hashing method.
//
// This is the first hashing method used to hash passwords in the codebase, and so
// it predates the implementation of the PHC string format for passwords. This means
// that this hasher is *not* PHC-compliant, although its output kind of look like
// PHC:
//
//	$2a$10$z0OlN1MpiLVlLTyE1xtEjOJ6/xV95RAwwIUaYKQBAqoeyvPgLEnUa
//
// The format is $xy$n$salthash, where:
//   - $ is the literal '$' (1 byte)
//   - x is the major version (1 byte)
//   - y is the minor version (0 or 1 byte)
//   - $ is the literal '$' (1 byte)
//   - n is the cost (2 bytes)
//   - $ is the literal '$' (1 byte)
//   - salt is the encoded salt (22 bytes)
//   - hash is the encoded hash (31 bytes)
//
// In total, 60 bytes (59 if there is no minor version)
//
// But this is not PHC-compliant: xy is not the function id, n is not
// a parameter name=value, nor the version, and there is no '$'
// separating the salt and the hash.
type BCrypt struct{}

const (
	// BCryptCost is the value of the cost parameter used throughout the history
	// of the codebase.
	BCryptCost = 10
)

// NewBCrypt returns a new BCrypt instance
func NewBCrypt() BCrypt {
	return BCrypt{}
}

// Hash is a wrapper over golang.org/x/crypto/bcrypt.GenerateFromPassword, with
// two main differences:
//   - If the password is too long, it returns [ErrPasswordTooLong] instead of
//     bcrypt.ErrPasswordTooLong, in order to comply with the rest of the hashers
//     in this package.
//   - It returns a string instead of a byte slice, so that [BCrypt] implements
//     the [PasswordHasher] interface.
func (b BCrypt) Hash(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), BCryptCost)
	if err != nil {
		if errors.Is(err, bcrypt.ErrPasswordTooLong) {
			return "", ErrPasswordTooLong
		}
		return "", err
	}

	return string(hash), nil
}

// CompareHashAndPassword is a wrapper over
// golang.org/x/crypto/bcrypt.CompareHashAndPassword, using the PHC's Hash field
// as the input for its first argument: this is why [BCrypt] is an edge case for
// a [PasswordHasher]: it only uses the [PHC.Hash] field, and ignores anything
// else in there.
func (b BCrypt) CompareHashAndPassword(hash phcparser.PHC, password string) error {
	err := bcrypt.CompareHashAndPassword([]byte(hash.Hash), []byte(password))
	if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
		return ErrMismatchedHashAndPassword
	}

	return err
}

// IsPHCValid returns always false: [BCrypt] is not PHC compliant
func (b BCrypt) IsPHCValid(hash phcparser.PHC) bool {
	return false
}
