package ber

import (
	"bytes"
	"io"
	"math"
	"testing"
)

func TestReadLength(t *testing.T) {
	testcases := map[string]struct {
		Data []byte

		ExpectedLength    int64
		ExpectedBytesRead int
		ExpectedError     string
	}{
		"empty": {
			Data:              []byte{},
			ExpectedBytesRead: 0,
			ExpectedError:     io.ErrUnexpectedEOF.Error(),
		},
		"invalid first byte": {
			Data:              []byte{0xFF},
			ExpectedBytesRead: 1,
			ExpectedError:     "invalid length byte 0xff",
		},

		"indefinite form": {
			Data:              []byte{LengthLongFormBitmask},
			ExpectedLength:    LengthIndefinite,
			ExpectedBytesRead: 1,
		},

		"short-definite-form zero length": {
			Data:              []byte{0},
			ExpectedLength:    0,
			ExpectedBytesRead: 1,
		},
		"short-definite-form length 1": {
			Data:              []byte{1},
			ExpectedLength:    1,
			ExpectedBytesRead: 1,
		},
		"short-definite-form max length": {
			Data:              []byte{127},
			ExpectedLength:    127,
			ExpectedBytesRead: 1,
		},

		"long-definite-form missing bytes": {
			Data:              []byte{LengthLongFormBitmask | 1},
			ExpectedBytesRead: 1,
			ExpectedError:     io.ErrUnexpectedEOF.Error(),
		},
		"long-definite-form overflow": {
			Data:              []byte{LengthLongFormBitmask | 9},
			ExpectedBytesRead: 1,
			ExpectedError:     "long-form length overflow",
		},
		"long-definite-form zero length": {
			Data:              []byte{LengthLongFormBitmask | 1, 0x0},
			ExpectedLength:    0,
			ExpectedBytesRead: 2,
		},
		"long-definite-form length 127": {
			Data:              []byte{LengthLongFormBitmask | 1, 127},
			ExpectedLength:    127,
			ExpectedBytesRead: 2,
		},
		"long-definite-form max length (32-bit)": {
			Data: []byte{
				LengthLongFormBitmask | 4,
				0x7F,
				0xFF,
				0xFF,
				0xFF,
				0xFF,
			},
			ExpectedLength:    math.MaxInt32,
			ExpectedBytesRead: 5,
		},
		"long-definite-form max length (64-bit)": {
			Data: []byte{
				LengthLongFormBitmask | 8,
				0x7F,
				0xFF,
				0xFF,
				0xFF,
				0xFF,
				0xFF,
				0xFF,
				0xFF,
			},
			ExpectedLength:    math.MaxInt64,
			ExpectedBytesRead: 9,
		},
	}

	for k, tc := range testcases {
		// Skip tests requiring 64-bit integers on platforms that don't support them
		if tc.ExpectedLength != int64(int(tc.ExpectedLength)) {
			continue
		}

		reader := bytes.NewBuffer(tc.Data)
		length, read, err := readLength(reader)

		if err != nil {
			if tc.ExpectedError == "" {
				t.Errorf("%s: unexpected error: %v", k, err)
			} else if err.Error() != tc.ExpectedError {
				t.Errorf("%s: expected error %v, got %v", k, tc.ExpectedError, err)
			}
		} else if tc.ExpectedError != "" {
			t.Errorf("%s: expected error %v, got none", k, tc.ExpectedError)
			continue
		}

		if read != tc.ExpectedBytesRead {
			t.Errorf("%s: expected read %d, got %d", k, tc.ExpectedBytesRead, read)
		}

		if int64(length) != tc.ExpectedLength {
			t.Errorf("%s: expected length %d, got %d", k, tc.ExpectedLength, length)
		}
	}
}

func TestEncodeLength(t *testing.T) {
	testcases := map[string]struct {
		Length        int64
		ExpectedBytes []byte
	}{
		"0": {
			Length:        0,
			ExpectedBytes: []byte{0},
		},
		"1": {
			Length:        1,
			ExpectedBytes: []byte{1},
		},

		"max short-form length": {
			Length:        127,
			ExpectedBytes: []byte{127},
		},
		"min long-form length": {
			Length:        128,
			ExpectedBytes: []byte{LengthLongFormBitmask | 1, 128},
		},

		"max long-form length (32-bit)": {
			Length: math.MaxInt32,
			ExpectedBytes: []byte{
				LengthLongFormBitmask | 4,
				0x7F,
				0xFF,
				0xFF,
				0xFF,
			},
		},

		"max long-form length (64-bit)": {
			Length: math.MaxInt64,
			ExpectedBytes: []byte{
				LengthLongFormBitmask | 8,
				0x7F,
				0xFF,
				0xFF,
				0xFF,
				0xFF,
				0xFF,
				0xFF,
				0xFF,
			},
		},
	}

	for k, tc := range testcases {
		// Skip tests requiring 64-bit integers on platforms that don't support them
		if tc.Length != int64(int(tc.Length)) {
			continue
		}

		b := encodeLength(int(tc.Length))
		if bytes.Compare(tc.ExpectedBytes, b) != 0 {
			t.Errorf("%s: Expected\n\t%#v\ngot\n\t%#v", k, tc.ExpectedBytes, b)
		}
	}
}
