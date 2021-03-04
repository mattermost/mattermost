package pgproto3

import (
	"bytes"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"

	"github.com/jackc/pgio"
)

type Bind struct {
	DestinationPortal    string
	PreparedStatement    string
	ParameterFormatCodes []int16
	Parameters           [][]byte
	ResultFormatCodes    []int16
}

// Frontend identifies this message as sendable by a PostgreSQL frontend.
func (*Bind) Frontend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *Bind) Decode(src []byte) error {
	*dst = Bind{}

	idx := bytes.IndexByte(src, 0)
	if idx < 0 {
		return &invalidMessageFormatErr{messageType: "Bind"}
	}
	dst.DestinationPortal = string(src[:idx])
	rp := idx + 1

	idx = bytes.IndexByte(src[rp:], 0)
	if idx < 0 {
		return &invalidMessageFormatErr{messageType: "Bind"}
	}
	dst.PreparedStatement = string(src[rp : rp+idx])
	rp += idx + 1

	if len(src[rp:]) < 2 {
		return &invalidMessageFormatErr{messageType: "Bind"}
	}
	parameterFormatCodeCount := int(binary.BigEndian.Uint16(src[rp:]))
	rp += 2

	if parameterFormatCodeCount > 0 {
		dst.ParameterFormatCodes = make([]int16, parameterFormatCodeCount)

		if len(src[rp:]) < len(dst.ParameterFormatCodes)*2 {
			return &invalidMessageFormatErr{messageType: "Bind"}
		}
		for i := 0; i < parameterFormatCodeCount; i++ {
			dst.ParameterFormatCodes[i] = int16(binary.BigEndian.Uint16(src[rp:]))
			rp += 2
		}
	}

	if len(src[rp:]) < 2 {
		return &invalidMessageFormatErr{messageType: "Bind"}
	}
	parameterCount := int(binary.BigEndian.Uint16(src[rp:]))
	rp += 2

	if parameterCount > 0 {
		dst.Parameters = make([][]byte, parameterCount)

		for i := 0; i < parameterCount; i++ {
			if len(src[rp:]) < 4 {
				return &invalidMessageFormatErr{messageType: "Bind"}
			}

			msgSize := int(int32(binary.BigEndian.Uint32(src[rp:])))
			rp += 4

			// null
			if msgSize == -1 {
				continue
			}

			if len(src[rp:]) < msgSize {
				return &invalidMessageFormatErr{messageType: "Bind"}
			}

			dst.Parameters[i] = src[rp : rp+msgSize]
			rp += msgSize
		}
	}

	if len(src[rp:]) < 2 {
		return &invalidMessageFormatErr{messageType: "Bind"}
	}
	resultFormatCodeCount := int(binary.BigEndian.Uint16(src[rp:]))
	rp += 2

	dst.ResultFormatCodes = make([]int16, resultFormatCodeCount)
	if len(src[rp:]) < len(dst.ResultFormatCodes)*2 {
		return &invalidMessageFormatErr{messageType: "Bind"}
	}
	for i := 0; i < resultFormatCodeCount; i++ {
		dst.ResultFormatCodes[i] = int16(binary.BigEndian.Uint16(src[rp:]))
		rp += 2
	}

	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *Bind) Encode(dst []byte) []byte {
	dst = append(dst, 'B')
	sp := len(dst)
	dst = pgio.AppendInt32(dst, -1)

	dst = append(dst, src.DestinationPortal...)
	dst = append(dst, 0)
	dst = append(dst, src.PreparedStatement...)
	dst = append(dst, 0)

	dst = pgio.AppendUint16(dst, uint16(len(src.ParameterFormatCodes)))
	for _, fc := range src.ParameterFormatCodes {
		dst = pgio.AppendInt16(dst, fc)
	}

	dst = pgio.AppendUint16(dst, uint16(len(src.Parameters)))
	for _, p := range src.Parameters {
		if p == nil {
			dst = pgio.AppendInt32(dst, -1)
			continue
		}

		dst = pgio.AppendInt32(dst, int32(len(p)))
		dst = append(dst, p...)
	}

	dst = pgio.AppendUint16(dst, uint16(len(src.ResultFormatCodes)))
	for _, fc := range src.ResultFormatCodes {
		dst = pgio.AppendInt16(dst, fc)
	}

	pgio.SetInt32(dst[sp:], int32(len(dst[sp:])))

	return dst
}

// MarshalJSON implements encoding/json.Marshaler.
func (src Bind) MarshalJSON() ([]byte, error) {
	formattedParameters := make([]map[string]string, len(src.Parameters))
	for i, p := range src.Parameters {
		if p == nil {
			continue
		}

		if src.ParameterFormatCodes[i] == 0 {
			formattedParameters[i] = map[string]string{"text": string(p)}
		} else {
			formattedParameters[i] = map[string]string{"binary": hex.EncodeToString(p)}
		}
	}

	return json.Marshal(struct {
		Type                 string
		DestinationPortal    string
		PreparedStatement    string
		ParameterFormatCodes []int16
		Parameters           []map[string]string
		ResultFormatCodes    []int16
	}{
		Type:                 "Bind",
		DestinationPortal:    src.DestinationPortal,
		PreparedStatement:    src.PreparedStatement,
		ParameterFormatCodes: src.ParameterFormatCodes,
		Parameters:           formattedParameters,
		ResultFormatCodes:    src.ResultFormatCodes,
	})
}
