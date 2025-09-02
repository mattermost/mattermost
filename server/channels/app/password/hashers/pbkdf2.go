// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package hashers

import (
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/sha512"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"hash"
	"io"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/v8/channels/app/password/parser"
)

// PseudoRandomFunction is the type of any string specifying a pseudo-random
// function used as the internal hashing algorithm for the [PBKDF2] hasher.
type PseudoRandomFunction string

const (
	// PBKDF2SHA1 specifies the [crypto/sha1] pseudo-random function.
	PBKDF2SHA1 PseudoRandomFunction = "SHA1"
	// PBKDF2SHA1 specifies the [crypto/sha256] pseudo-random function, which is the one used in [DefaultPBKDF2].
	PBKDF2SHA256 PseudoRandomFunction = "SHA256"
	// PBKDF2SHA1 specifies the [crypto/sha512] pseudo-random function.
	PBKDF2SHA512 PseudoRandomFunction = "SHA512"

	// PBKDF2FunctionId is the name of the PBKDF2 hasher.
	PBKDF2FunctionId string = "pbkdf2"
)

const (
	// Default parameter values
	defaultPRF        = PBKDF2SHA256
	defaultWorkFactor = 600000
	defaultKeyLength  = 32

	// Length of the salt, in bytes
	saltLenBytes = 16
)

// PBKDF2 implements the [PasswordHasher] interface using [crypto/pbkdf2] as the
// hashing method.
//
// It is parametrized by:
//   - Internal hashing function: a pseudo-random function used as the internal
//     hashing method. It can be [PBKDF2SHA1], [PBKDF2SHA256] or [PBKDF2SHA512].
//   - The work factor: the number of iterations performed during hashing. The
//     larger this number, the longer and more costly the hashing process. OWASP
//     has some recommendations on what number to use here:
//     https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#pbkdf2
//   - The key length: the desired length, in bytes, of the resulting hash.
//
// Its PHC string is of the form:
//
//	$pbkdf2$f=<F>,w=<W>,l=<L>$<salt>$<hash>
//
// Where:
//   - <F> is a string specifying the internal hashing function (defaults to SHA256).
//   - <W> is an integer specifying the work factor (defaults to 600000).
//   - <L> is an integer specifying the key length (defaults to 32).
//   - <salt> is the base64-encoded salt.
//   - <hash> is the base64-encoded hash.
type PBKDF2 struct {
	hashFunc   PseudoRandomFunction
	workFactor int
	keyLength  int

	phcHeader string
}

// DefaultPBKDF2 returns a [PBKDF2] already initialized with the following
// parameters:
//   - Internal hashing function: SHA256
//   - Work factor: 600,000
//   - Key length: 32 bytes
func DefaultPBKDF2() PBKDF2 {
	return NewPBKDF2(defaultPRF, defaultWorkFactor, defaultKeyLength)
}

// NewPBKDF2 returns a [PBKDF2] initialized with the provided parameters
func NewPBKDF2(hashFunc PseudoRandomFunction, workFactor int, keyLength int) PBKDF2 {
	// Precompute and store the PHC header, since it is common to every hashed
	// password; it will be something like:
	// $pbkdf2$f=SHA256,w=600000,l=32$
	phcHeader := new(strings.Builder)

	// First, the function ID
	phcHeader.WriteRune('$')
	phcHeader.WriteString(PBKDF2FunctionId)

	// Then, the parameters
	phcHeader.WriteString("$f=")
	phcHeader.WriteString(string(hashFunc))
	phcHeader.WriteString(",w=")
	phcHeader.WriteString(strconv.Itoa(workFactor))
	phcHeader.WriteString(",l=")
	phcHeader.WriteString(strconv.Itoa(keyLength))

	// Finish with the '$' that will mark the start of the salt
	phcHeader.WriteRune('$')

	return PBKDF2{
		hashFunc:   hashFunc,
		workFactor: workFactor,
		keyLength:  keyLength,
		phcHeader:  phcHeader.String(),
	}
}

// getFunction returns the [hash.Hash] function specified by the
// [PseudoRandomFunction] parameter.
func getFunction(prf PseudoRandomFunction) func() hash.Hash {
	switch prf {
	case PBKDF2SHA1:
		return sha1.New
	case PBKDF2SHA256:
		return sha256.New
	case PBKDF2SHA512:
		return sha512.New
	}

	// Default to SHA256
	return sha256.New
}

// hashWithSalt calls crypto/pbkdf2.Key with the provided salt and the stored
// parameters.
func (p PBKDF2) hashWithSalt(password string, salt []byte) (string, error) {
	hash, err := pbkdf2.Key(getFunction(p.hashFunc), password, salt, p.workFactor, p.keyLength)
	if err != nil {
		return "", fmt.Errorf("failed hashing the password: %w", err)
	}

	encodedHash := base64.RawStdEncoding.EncodeToString(hash)
	return encodedHash, nil
}

// Hash hashes the provided password using the PBKDF2 algorithm with the stored
// parameters, returning a PHC-compliant string.
//
// The salt is generated randomly and stored in the returned PHC string. If the
// provided password is longer than [PasswordMaxLengthBytes], [ErrPasswordTooLong]
// is returned.
func (p PBKDF2) Hash(password string) (string, error) {
	// Enforce a maximum length, even if PBKDF2 can theoretically accept *any* length
	if len(password) > PasswordMaxLengthBytes {
		return "", ErrPasswordTooLong
	}

	// Create random salt
	salt := make([]byte, saltLenBytes)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return "", fmt.Errorf("unable to generate salt for user: %w", err)
	}

	// Compute hash
	hash, err := p.hashWithSalt(password, salt)
	if err != nil {
		return "", fmt.Errorf("failed to hash the password: %w", err)
	}

	// Initialize string builder and base64 encoder
	phcString := new(strings.Builder)
	b64Encoder := base64.RawStdEncoding

	// Now, start writing: first, the stored header: function ID and parameters
	phcString.WriteString(p.phcHeader)

	// Next, the encoded salt (the header already contains the initial $, so we
	// can skip it)
	// If we were to use a real encoder using an io.Writer, we would need to
	// call Close after the salt, otherwise the last block doesn't get written;
	// but we don't want to close it yet, because we want to write the hash later;
	// so I think it's not worth using an encoder, and it's better to call
	// EncodeToString directly, here and when writing the hash
	phcString.WriteString(b64Encoder.EncodeToString(salt))

	// Finally, the encoded hash
	phcString.WriteRune('$')
	phcString.WriteString(hash)

	return phcString.String(), nil
}

// CompareHashAndPassword compares the provided [parser.PHC] with the plain-text
// password.
//
// The provided [parser.PHC] is validated to double-check it was generated with
// this hasher and parameters.
func (p PBKDF2) CompareHashAndPassword(hash parser.PHC, password string) error {
	// Validate parameters
	if !p.isPHCValid(hash) {
		return fmt.Errorf("the stored password does not comply with the PBKDF2 parser's PHC serialization")
	}

	salt, err := base64.RawStdEncoding.DecodeString(hash.Salt)
	if err != nil {
		return fmt.Errorf("failed decoding hash's salt: %w", err)
	}

	// Hash the new password with the stored hash's salt
	newHash, err := p.hashWithSalt(password, salt)
	if err != nil {
		return fmt.Errorf("failed to hash the password: %w", err)
	}

	// Compare both hashes
	if subtle.ConstantTimeCompare([]byte(hash.Hash), []byte(newHash)) != 1 {
		return ErrMismatchedHashAndPassword
	}

	return nil
}

// isPHCValid validates that the provided [parser.PHC] is valid, meaning:
//   - The function used to generate it was [PBKDF2FunctionId].
//   - The parameters used to generate it were []
func (p PBKDF2) isPHCValid(phc parser.PHC) bool {
	return phc.Id == PBKDF2FunctionId &&
		len(phc.Params) == 3 &&
		phc.Params["f"] == string(p.hashFunc) &&
		phc.Params["w"] == strconv.Itoa(p.workFactor) &&
		phc.Params["l"] == strconv.Itoa(p.keyLength)
}
