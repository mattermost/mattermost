// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package hashers provides several implementations of password hashing functions.
//
// This package allows for seamless migrations of password hashing methods. To
// migrate to a new hasher in the future, the steps needed are:
//  1. Add a new type that implements the [PasswordHasher] interface. Let's call
//     it `NewHasher`.
//  2. Update the [LatestHasher] variable so that it points to a `NewHasher`
//     instance:
//
// ``` diff
// var (
//
//	// LatestHasher is the hasher currently in use.
//	// Any password hashed with a different hasher must be migrated to this one.
//
// -	LatestHasher PasswordHasher = DefaultPBKDF2()
// +	LatestHasher PasswordHasher = DefaultNewHasher()
// ```
//  3. Modify [GetHasherFromPHCString] so that it returns [LatestHasher] when the
//     PHC's ID is the one specified by `NewHasher`, and move the current hasher
//     to return a normal instance:
//
// ``` diff
//
//		switch phc.Id {
//	  - case PBKDF2FunctionId:
//	  - case NewHasherFunctionId:
//	    return LatestHasher, phc
//	  - case PBKDF2FunctionId:
//	  - return DefaultPBKDF2()
//	    // If the function ID is unknown, return the default hasher
//	    default:
//	    return getDefaultHasher(phcString)
//
// ```
//
// Note that the migration happens in [users.MigratePassword], which is triggered
// whenever the user enters their password and an old hashing method is
// identified when parsing their stored hashed password: the
// [users.OutdatedPasswordHashingError] is thrown by [users.CheckUserPassword].
// This means that the older password hashers can *never* be removed, unless all
// users whose passwords are not migrated are either forced to re-login, or
// forced to generate a new password.
package hashers

import (
	"fmt"
	"strings"

	"github.com/mattermost/mattermost/server/v8/channels/app/password/parser"
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
	CompareHashAndPassword(hash parser.PHC, password string) error
}

const (
	// Maximum password length for all password hashers
	PasswordMaxLengthBytes = 72
)

var (
	// LatestHasher is the hasher currently in use.
	// Any password hashed with a different hasher must be migrated to this one.
	LatestHasher PasswordHasher = DefaultPBKDF2()

	// ErrPasswordTooLong is the error returned when the provided password is
	// longer than [PasswordMaxLengthBytes].
	ErrPasswordTooLong = fmt.Errorf("password too long; maximum length in bytes: %d", PasswordMaxLengthBytes)

	// ErrMismatchedHashAndPassword is the error returned when the provided
	// password does not match the stored hash
	ErrMismatchedHashAndPassword = fmt.Errorf("hash and password do not match")
)

// getOriginalHasher returns a [BCrypt] hasher, the first hasher used in the
// codebase.
func getOriginalHasher(phcString string) (PasswordHasher, parser.PHC) {
	// [BCrypt] is somewhat of an edge case, since it is not PHC-compliant, and
	// needs the whole PHC string in its Hash field
	return NewBCrypt(), parser.PHC{Hash: phcString}
}

// GetHasherFromPHC returns the password hasher that was used to generate the
// provided PHC string.
// If the PHC string is not valid, or the function ID is unknown, this function
// defaults to the first hasher ever used, which did not properly implement PHC:
// the [BCrypt] hasher.
func GetHasherFromPHCString(phcString string) (PasswordHasher, parser.PHC) {
	phc, err := parser.New(strings.NewReader(phcString)).Parse()
	if err != nil {
		// If the PHC string is invalid, return the default hasher
		return getOriginalHasher(phcString)
	}

	switch phc.Id {
	case PBKDF2FunctionId:
		return LatestHasher, phc
	// If the function ID is unknown, return the default hasher
	default:
		return getOriginalHasher(phcString)
	}
}

func Hash(password string) (string, error) {
	return LatestHasher.Hash(password)
}

func CompareHashAndPassword(phc parser.PHC, password string) error {
	return LatestHasher.CompareHashAndPassword(phc, password)
}

func IsLatestHasher(hasher PasswordHasher) bool {
	return LatestHasher == hasher
}
