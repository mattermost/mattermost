package pgproto3

import (
	"bytes"
	"encoding/json"

	"github.com/jackc/pgio"
)

type Close struct {
	ObjectType byte // 'S' = prepared statement, 'P' = portal
	Name       string
}

// Frontend identifies this message as sendable by a PostgreSQL frontend.
func (*Close) Frontend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *Close) Decode(src []byte) error {
	if len(src) < 2 {
		return &invalidMessageFormatErr{messageType: "Close"}
	}

	dst.ObjectType = src[0]
	rp := 1

	idx := bytes.IndexByte(src[rp:], 0)
	if idx != len(src[rp:])-1 {
		return &invalidMessageFormatErr{messageType: "Close"}
	}

	dst.Name = string(src[rp : len(src)-1])

	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *Close) Encode(dst []byte) []byte {
	dst = append(dst, 'C')
	sp := len(dst)
	dst = pgio.AppendInt32(dst, -1)

	dst = append(dst, src.ObjectType)
	dst = append(dst, src.Name...)
	dst = append(dst, 0)

	pgio.SetInt32(dst[sp:], int32(len(dst[sp:])))

	return dst
}

// MarshalJSON implements encoding/json.Marshaler.
func (src Close) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type       string
		ObjectType string
		Name       string
	}{
		Type:       "Close",
		ObjectType: string(src.ObjectType),
		Name:       src.Name,
	})
}
