// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package hashers

import (
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"io"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/v8/channels/app/password/phcparser"
)

const (
	// PBKDF2FunctionId is the name of the PBKDF2 hasher.
	PBKDF2FunctionId string = "pbkdf2"
)

const (
	// Default parameter values
	defaultPRFName    = "SHA256"
	defaultWorkFactor = 600000
	defaultKeyLength  = 32

	// Length of the salt, in bytes
	saltLenBytes = 16
)

var (
	defaultPRF = sha256.New
)

// PBKDF2 implements the [PasswordHasher] interface using [crypto/pbkdf2] as the
// hashing method.
//
// It is parametrized by:
//   - The work factor: the number of iterations performed during hashing. The
//     larger this number, the longer and more costly the hashing process. OWASP
//     has some recommendations on what number to use here:
//     https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#pbkdf2
//   - The key length: the desired length, in bytes, of the resulting hash.
//
// The internal hashing function is always set to SHA256.
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
	hasher, err := NewPBKDF2(defaultWorkFactor, defaultKeyLength)
	if err != nil {
		panic("DefaultPBKDF2 implementation is incorrect")
	}
	return hasher
}

// NewPBKDF2 returns a [PBKDF2] initialized with the provided parameters
func NewPBKDF2(workFactor int, keyLength int) (PBKDF2, error) {
	if workFactor <= 0 {
		return PBKDF2{}, fmt.Errorf("work factor must be strictly positive")
	}

	if keyLength <= 0 {
		return PBKDF2{}, fmt.Errorf("key length must be strictly positive")
	}
	// Precompute and store the PHC header, since it is common to every hashed
	// password; it will be something like:
	// $pbkdf2$f=SHA256,w=600000,l=32$
	phcHeader := new(strings.Builder)

	// First, the function ID
	phcHeader.WriteRune('$')
	phcHeader.WriteString(PBKDF2FunctionId)

	// Then, the parameters
	phcHeader.WriteString("$f=")
	phcHeader.WriteString(defaultPRFName)
	phcHeader.WriteString(",w=")
	phcHeader.WriteString(strconv.Itoa(workFactor))
	phcHeader.WriteString(",l=")
	phcHeader.WriteString(strconv.Itoa(keyLength))

	// Finish with the '$' that will mark the start of the salt
	phcHeader.WriteRune('$')

	return PBKDF2{
		workFactor: workFactor,
		keyLength:  keyLength,
		phcHeader:  phcHeader.String(),
	}, nil
}

// NewPBKDF2FromPHC returns a [PBKDF2] that conforms to the provided parsed PHC,
// using the same parameters (if valid) present there.
func NewPBKDF2FromPHC(phc phcparser.PHC) (PBKDF2, error) {
	workFactor, err := strconv.Atoi(phc.Params["w"])
	if err != nil {
		return PBKDF2{}, fmt.Errorf("invalid work factor parameter 'w=%s'", phc.Params["w"])
	}

	keyLength, err := strconv.Atoi(phc.Params["l"])
	if err != nil {
		return PBKDF2{}, fmt.Errorf("invalid key length parameter 'l=%s'", phc.Params["l"])
	}

	return NewPBKDF2(workFactor, keyLength)
}

// hashWithSalt calls crypto/pbkdf2.Key with the provided salt and the stored
// parameters.
func (p PBKDF2) hashWithSalt(password string, salt []byte) (string, error) {
	hash, err := pbkdf2.Key(defaultPRF, password, salt, p.workFactor, p.keyLength)
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

// CompareHashAndPassword compares the provided [phcparser.PHC] with the plain-text
// password.
//
// The provided [phcparser.PHC] is validated to double-check it was generated with
// this hasher and parameters.
func (p PBKDF2) CompareHashAndPassword(hash phcparser.PHC, password string) error {
	// Validate parameters
	if !p.IsPHCValid(hash) {
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

// IsPHCValid validates that the provided [phcparser.PHC] is valid, meaning:
//   - The function used to generate it was [PBKDF2FunctionId].
//   - The parameters used to generate it were the same as the ones used to
//     create this hasher.
func (p PBKDF2) IsPHCValid(phc phcparser.PHC) bool {
	return phc.Id == PBKDF2FunctionId &&
		len(phc.Params) == 3 &&
		phc.Params["f"] == defaultPRFName &&
		phc.Params["w"] == strconv.Itoa(p.workFactor) &&
		phc.Params["l"] == strconv.Itoa(p.keyLength)
}
