package pgproto3

import (
	"bytes"
	"encoding/binary"
	"errors"

	"github.com/jackc/pgio"
)

// AuthenticationSASL is a message sent from the backend indicating that SASL authentication is required.
type AuthenticationSASL struct {
	AuthMechanisms []string
}

// Backend identifies this message as sendable by the PostgreSQL backend.
func (*AuthenticationSASL) Backend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *AuthenticationSASL) Decode(src []byte) error {
	if len(src) < 4 {
		return errors.New("authentication message too short")
	}

	authType := binary.BigEndian.Uint32(src)

	if authType != AuthTypeSASL {
		return errors.New("bad auth type")
	}

	authMechanisms := src[4:]
	for len(authMechanisms) > 1 {
		idx := bytes.IndexByte(authMechanisms, 0)
		if idx > 0 {
			dst.AuthMechanisms = append(dst.AuthMechanisms, string(authMechanisms[:idx]))
			authMechanisms = authMechanisms[idx+1:]
		}
	}

	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *AuthenticationSASL) Encode(dst []byte) []byte {
	dst = append(dst, 'R')
	sp := len(dst)
	dst = pgio.AppendInt32(dst, -1)
	dst = pgio.AppendUint32(dst, AuthTypeSASL)

	for _, s := range src.AuthMechanisms {
		dst = append(dst, []byte(s)...)
		dst = append(dst, 0)
	}
	dst = append(dst, 0)

	pgio.SetInt32(dst[sp:], int32(len(dst[sp:])))

	return dst
}
