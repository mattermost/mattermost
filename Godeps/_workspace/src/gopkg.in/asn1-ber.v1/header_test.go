package ber

import (
	"bytes"
	"io"
	"testing"
)

func TestReadHeader(t *testing.T) {
	testcases := map[string]struct {
		Data               []byte
		ExpectedIdentifier Identifier
		ExpectedLength     int
		ExpectedBytesRead  int
		ExpectedError      string
	}{
		"empty": {
			Data:               []byte{},
			ExpectedIdentifier: Identifier{},
			ExpectedLength:     0,
			ExpectedBytesRead:  0,
			ExpectedError:      io.ErrUnexpectedEOF.Error(),
		},

		"valid short form": {
			Data: []byte{
				byte(ClassUniversal) | byte(TypePrimitive) | byte(TagCharacterString),
				127,
			},
			ExpectedIdentifier: Identifier{
				ClassType: ClassUniversal,
				TagType:   TypePrimitive,
				Tag:       TagCharacterString,
			},
			ExpectedLength:    127,
			ExpectedBytesRead: 2,
			ExpectedError:     "",
		},

		"valid long form": {
			Data: []byte{
				// 2-byte encoding of tag
				byte(ClassUniversal) | byte(TypePrimitive) | byte(HighTag),
				byte(TagCharacterString),

				// 2-byte encoding of length
				LengthLongFormBitmask | 1,
				127,
			},
			ExpectedIdentifier: Identifier{
				ClassType: ClassUniversal,
				TagType:   TypePrimitive,
				Tag:       TagCharacterString,
			},
			ExpectedLength:    127,
			ExpectedBytesRead: 4,
			ExpectedError:     "",
		},

		"valid indefinite length": {
			Data: []byte{
				byte(ClassUniversal) | byte(TypeConstructed) | byte(TagCharacterString),
				LengthLongFormBitmask,
			},
			ExpectedIdentifier: Identifier{
				ClassType: ClassUniversal,
				TagType:   TypeConstructed,
				Tag:       TagCharacterString,
			},
			ExpectedLength:    LengthIndefinite,
			ExpectedBytesRead: 2,
			ExpectedError:     "",
		},

		"invalid indefinite length": {
			Data: []byte{
				byte(ClassUniversal) | byte(TypePrimitive) | byte(TagCharacterString),
				LengthLongFormBitmask,
			},
			ExpectedIdentifier: Identifier{},
			ExpectedLength:     0,
			ExpectedBytesRead:  2,
			ExpectedError:      "indefinite length used with primitive type",
		},
	}

	for k, tc := range testcases {
		reader := bytes.NewBuffer(tc.Data)
		identifier, length, read, err := readHeader(reader)

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

		if identifier.ClassType != tc.ExpectedIdentifier.ClassType {
			t.Errorf("%s: expected class type %d (%s), got %d (%s)", k,
				tc.ExpectedIdentifier.ClassType,
				ClassMap[tc.ExpectedIdentifier.ClassType],
				identifier.ClassType,
				ClassMap[identifier.ClassType],
			)
		}
		if identifier.TagType != tc.ExpectedIdentifier.TagType {
			t.Errorf("%s: expected tag type %d (%s), got %d (%s)", k,
				tc.ExpectedIdentifier.TagType,
				TypeMap[tc.ExpectedIdentifier.TagType],
				identifier.TagType,
				TypeMap[identifier.TagType],
			)
		}
		if identifier.Tag != tc.ExpectedIdentifier.Tag {
			t.Errorf("%s: expected tag %d (%s), got %d (%s)", k,
				tc.ExpectedIdentifier.Tag,
				tagMap[tc.ExpectedIdentifier.Tag],
				identifier.Tag,
				tagMap[identifier.Tag],
			)
		}

		if length != tc.ExpectedLength {
			t.Errorf("%s: expected length %d, got %d", k, tc.ExpectedLength, length)
		}
	}
}
