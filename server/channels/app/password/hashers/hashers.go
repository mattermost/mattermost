// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package hashers provides several implementations of password hashing functions.
//
// This package allows for seamless migrations of password hashing methods. To
// migrate to a new hasher in the future, the steps needed are:
//  1. Add a new type that implements the [PasswordHasher] interface. Let's call
//     it `NewHasher`.
//  2. Update the [latestHasher] variable so that it points to a `NewHasher`
//     instance:
//
// ``` diff
// var (
//
//	// latestHasher is the hasher currently in use.
//	// Any password hashed with a different hasher must be migrated to this one.
//
// -	latestHasher PasswordHasher = DefaultPBKDF2()
// +	latestHasher PasswordHasher = DefaultNewHasher()
// ```
//  3. Modify [GetHasherFromPHCString] to add a new case in the switch to
//     identify the new function ID.
//
// If what is needed is to upgrade to a new set of parameters for the same
// hashing method (let's say keep using PBKDF2 but increase the work factor
// from 60,000 to 120,000), then no modification to [GetHasherFromPHCString]
// is needed. Simply update the [latestHasher] varible with the new parameter,
// and [IsPHCValid] will detect the difference in the parameter.
//
// Note that the migration happens in [App.migratePassword], which is triggered
// whenever the user enters their password and an old hashing method is
// identified when parsing their stored hashed password.
// This means that the older password hashers can *never* be removed, unless all
// users whose passwords are not migrated are either forced to re-login, or
// forced to generate a new password.
//
// Another important note is that once a server upgrades to a version with an
// updated hashing method, downgrading to any previous version will break the
// login flow for users whose passwords were migrated to the newer method.
package hashers

import (
	"fmt"
	"strings"

	"github.com/mattermost/mattermost/server/v8/channels/app/password/phcparser"
)

// PasswordHasher is a password hasher compliant with the PHC string format:
// https://github.com/P-H-C/phc-string-format/blob/master/phc-sf-spec.md
//
// Implementations of this interface need to make sure that all of the methods
// are thread-safe.
type PasswordHasher interface {
	// Hash computes a hash of the provided password, returning a PHC string
	// containing all the information that was needed to compute it: the function
	// used to generate it, its version, parameters and salt, if needed.
	//
	// If an implementation of Hash needs a salt to generate the hash, it will
	// create one, so that callers don't need to provide it.
	Hash(password string) (string, error)

	// CompareHashAndPassword compares the parsed PHC and a provided password,
	// returning an error if and only if the hashes do not match.
	//
	// Implementations need to make sure that the comparisons are done in constant
	// time; e.g., using crypto/internal/fips140/subtle.ConstantTimeCompare.
	CompareHashAndPassword(hash phcparser.PHC, password string) error

	// IsPHCValid validates whether a parsed PHC string conforms to the parameters
	// of the hasher.
	IsPHCValid(hash phcparser.PHC) bool
}

const (
	// Maximum password length for all password hashers
	PasswordMaxLengthBytes = 72
)

var (
	// latestHasher is the hasher currently in use.
	// Any password hashed with a different hasher must be migrated to this one.
	latestHasher PasswordHasher = DefaultPBKDF2()

	// ErrPasswordTooLong is the error returned when the provided password is
	// longer than [PasswordMaxLengthBytes].
	ErrPasswordTooLong = fmt.Errorf("password too long; maximum length in bytes: %d", PasswordMaxLengthBytes)

	// ErrMismatchedHashAndPassword is the error returned when the provided
	// password does not match the stored hash
	ErrMismatchedHashAndPassword = fmt.Errorf("hash and password do not match")
)

// getOriginalHasher returns a [BCrypt] hasher, the first hasher used in the
// codebase.
func getOriginalHasher(phcString string) (PasswordHasher, phcparser.PHC) {
	// [BCrypt] is somewhat of an edge case, since it is not PHC-compliant, and
	// needs the whole PHC string in its Hash field
	return NewBCrypt(), phcparser.PHC{Hash: phcString}
}

// GetHasherFromPHC returns the password hasher that was used to generate the
// provided PHC string.
// If the PHC string is not valid, or the function ID is unknown, this function
// defaults to the first hasher ever used, which did not properly implement PHC:
// the [BCrypt] hasher.
func GetHasherFromPHCString(phcString string) (PasswordHasher, phcparser.PHC, error) {
	phc, err := phcparser.New(strings.NewReader(phcString)).Parse()
	if err != nil {
		// If the PHC string is invalid, return the original hasher, bcrypt
		bcrypt, bcryptPhc := getOriginalHasher(phcString)
		return bcrypt, bcryptPhc, nil
	}

	// First check whether PHC conforms to the latest hasher
	if latestHasher.IsPHCValid(phc) {
		return latestHasher, phc, nil
	}

	// If not, check the function ID and create a new one depending on it
	switch phc.Id {
	case PBKDF2FunctionId:
		pbkdf2, err := NewPBKDF2FromPHC(phc)
		if err != nil {
			return PBKDF2{}, phcparser.PHC{}, fmt.Errorf("the provided PHC string is PBKDF2, but is not valid: %w", err)
		}
		return pbkdf2, phc, nil
	// If the function ID is unknown, return the original hasher
	default:
		bcrypt, phc := getOriginalHasher(phcString)
		return bcrypt, phc, nil
	}
}

// Hash hashes the provided password with the latest hashing method.
func Hash(password string) (string, error) {
	return latestHasher.Hash(password)
}

// CompareHashAndPassword compares the parsed [phcparser.PHC] and the provided
// password using the latest hashing method.
func CompareHashAndPassword(phc phcparser.PHC, password string) error {
	return latestHasher.CompareHashAndPassword(phc, password)
}

// IsLatestHasher verifies that the provided hasher is the latest one. This
// function is useful for identifying stored hashes that require a migration.
func IsLatestHasher(hasher PasswordHasher) bool {
	return latestHasher == hasher
}
