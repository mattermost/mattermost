package pgproto3

import (
	"bytes"
	"encoding/json"

	"github.com/jackc/pgio"
)

type PasswordMessage struct {
	Password string
}

// Frontend identifies this message as sendable by a PostgreSQL frontend.
func (*PasswordMessage) Frontend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *PasswordMessage) Decode(src []byte) error {
	buf := bytes.NewBuffer(src)

	b, err := buf.ReadBytes(0)
	if err != nil {
		return err
	}
	dst.Password = string(b[:len(b)-1])

	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *PasswordMessage) Encode(dst []byte) []byte {
	dst = append(dst, 'p')
	dst = pgio.AppendInt32(dst, int32(4+len(src.Password)+1))

	dst = append(dst, src.Password...)
	dst = append(dst, 0)

	return dst
}

// MarshalJSON implements encoding/json.Marshaler.
func (src PasswordMessage) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type     string
		Password string
	}{
		Type:     "PasswordMessage",
		Password: src.Password,
	})
}
