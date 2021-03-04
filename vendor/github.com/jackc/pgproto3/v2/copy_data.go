package pgproto3

import (
	"encoding/hex"
	"encoding/json"

	"github.com/jackc/pgio"
)

type CopyData struct {
	Data []byte
}

// Backend identifies this message as sendable by the PostgreSQL backend.
func (*CopyData) Backend() {}

// Frontend identifies this message as sendable by a PostgreSQL frontend.
func (*CopyData) Frontend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *CopyData) Decode(src []byte) error {
	dst.Data = src
	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *CopyData) Encode(dst []byte) []byte {
	dst = append(dst, 'd')
	dst = pgio.AppendInt32(dst, int32(4+len(src.Data)))
	dst = append(dst, src.Data...)
	return dst
}

// MarshalJSON implements encoding/json.Marshaler.
func (src CopyData) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type string
		Data string
	}{
		Type: "CopyData",
		Data: hex.EncodeToString(src.Data),
	})
}
