package pgproto3

import (
	"bytes"
	"encoding/json"

	"github.com/jackc/pgio"
)

type CommandComplete struct {
	CommandTag []byte
}

// Backend identifies this message as sendable by the PostgreSQL backend.
func (*CommandComplete) Backend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *CommandComplete) Decode(src []byte) error {
	idx := bytes.IndexByte(src, 0)
	if idx != len(src)-1 {
		return &invalidMessageFormatErr{messageType: "CommandComplete"}
	}

	dst.CommandTag = src[:idx]

	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *CommandComplete) Encode(dst []byte) []byte {
	dst = append(dst, 'C')
	sp := len(dst)
	dst = pgio.AppendInt32(dst, -1)

	dst = append(dst, src.CommandTag...)
	dst = append(dst, 0)

	pgio.SetInt32(dst[sp:], int32(len(dst[sp:])))

	return dst
}

// MarshalJSON implements encoding/json.Marshaler.
func (src CommandComplete) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type       string
		CommandTag string
	}{
		Type:       "CommandComplete",
		CommandTag: string(src.CommandTag),
	})
}
