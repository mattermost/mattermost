package pgproto3

import (
	"encoding/binary"
	"errors"

	"github.com/jackc/pgio"
)

// AuthenticationSASLFinal is a message sent from the backend indicating a SASL authentication has completed.
type AuthenticationSASLFinal struct {
	Data []byte
}

// Backend identifies this message as sendable by the PostgreSQL backend.
func (*AuthenticationSASLFinal) Backend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *AuthenticationSASLFinal) Decode(src []byte) error {
	if len(src) < 4 {
		return errors.New("authentication message too short")
	}

	authType := binary.BigEndian.Uint32(src)

	if authType != AuthTypeSASLFinal {
		return errors.New("bad auth type")
	}

	dst.Data = src[4:]

	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *AuthenticationSASLFinal) Encode(dst []byte) []byte {
	dst = append(dst, 'R')
	sp := len(dst)
	dst = pgio.AppendInt32(dst, -1)
	dst = pgio.AppendUint32(dst, AuthTypeSASLFinal)

	dst = pgio.AppendInt32(dst, int32(len(src.Data)))
	dst = append(dst, src.Data...)

	pgio.SetInt32(dst[sp:], int32(len(dst[sp:])))

	return dst
}
