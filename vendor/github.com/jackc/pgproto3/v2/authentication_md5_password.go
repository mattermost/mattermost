package pgproto3

import (
	"encoding/binary"
	"errors"

	"github.com/jackc/pgio"
)

// AuthenticationMD5Password is a message sent from the backend indicating that an MD5 hashed password is required.
type AuthenticationMD5Password struct {
	Salt [4]byte
}

// Backend identifies this message as sendable by the PostgreSQL backend.
func (*AuthenticationMD5Password) Backend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *AuthenticationMD5Password) Decode(src []byte) error {
	if len(src) != 8 {
		return errors.New("bad authentication message size")
	}

	authType := binary.BigEndian.Uint32(src)

	if authType != AuthTypeMD5Password {
		return errors.New("bad auth type")
	}

	copy(dst.Salt[:], src[4:8])

	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *AuthenticationMD5Password) Encode(dst []byte) []byte {
	dst = append(dst, 'R')
	dst = pgio.AppendInt32(dst, 12)
	dst = pgio.AppendUint32(dst, AuthTypeOk)
	dst = append(dst, src.Salt[:]...)
	return dst
}
