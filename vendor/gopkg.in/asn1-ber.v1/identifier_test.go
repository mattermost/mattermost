package ber

import (
	"bytes"
	"io"
	"math"
	"testing"
)

func TestReadIdentifier(t *testing.T) {
	testcases := map[string]struct {
		Data []byte

		ExpectedIdentifier Identifier
		ExpectedBytesRead  int
		ExpectedError      string
	}{
		"empty": {
			Data:              []byte{},
			ExpectedBytesRead: 0,
			ExpectedError:     io.ErrUnexpectedEOF.Error(),
		},

		"universal primitive eoc": {
			Data: []byte{byte(ClassUniversal) | byte(TypePrimitive) | byte(TagEOC)},
			ExpectedIdentifier: Identifier{
				ClassType: ClassUniversal,
				TagType:   TypePrimitive,
				Tag:       TagEOC,
			},
			ExpectedBytesRead: 1,
		},
		"universal primitive character string": {
			Data: []byte{byte(ClassUniversal) | byte(TypePrimitive) | byte(TagCharacterString)},
			ExpectedIdentifier: Identifier{
				ClassType: ClassUniversal,
				TagType:   TypePrimitive,
				Tag:       TagCharacterString,
			},
			ExpectedBytesRead: 1,
		},

		"universal constructed bit string": {
			Data: []byte{byte(ClassUniversal) | byte(TypeConstructed) | byte(TagBitString)},
			ExpectedIdentifier: Identifier{
				ClassType: ClassUniversal,
				TagType:   TypeConstructed,
				Tag:       TagBitString,
			},
			ExpectedBytesRead: 1,
		},
		"universal constructed character string": {
			Data: []byte{byte(ClassUniversal) | byte(TypeConstructed) | byte(TagCharacterString)},
			ExpectedIdentifier: Identifier{
				ClassType: ClassUniversal,
				TagType:   TypeConstructed,
				Tag:       TagCharacterString,
			},
			ExpectedBytesRead: 1,
		},

		"application constructed object descriptor": {
			Data: []byte{byte(ClassApplication) | byte(TypeConstructed) | byte(TagObjectDescriptor)},
			ExpectedIdentifier: Identifier{
				ClassType: ClassApplication,
				TagType:   TypeConstructed,
				Tag:       TagObjectDescriptor,
			},
			ExpectedBytesRead: 1,
		},
		"context constructed object descriptor": {
			Data: []byte{byte(ClassContext) | byte(TypeConstructed) | byte(TagObjectDescriptor)},
			ExpectedIdentifier: Identifier{
				ClassType: ClassContext,
				TagType:   TypeConstructed,
				Tag:       TagObjectDescriptor,
			},
			ExpectedBytesRead: 1,
		},
		"private constructed object descriptor": {
			Data: []byte{byte(ClassPrivate) | byte(TypeConstructed) | byte(TagObjectDescriptor)},
			ExpectedIdentifier: Identifier{
				ClassType: ClassPrivate,
				TagType:   TypeConstructed,
				Tag:       TagObjectDescriptor,
			},
			ExpectedBytesRead: 1,
		},

		"high-tag-number tag missing bytes": {
			Data:              []byte{byte(ClassUniversal) | byte(TypeConstructed) | byte(HighTag)},
			ExpectedError:     io.ErrUnexpectedEOF.Error(),
			ExpectedBytesRead: 1,
		},
		"high-tag-number tag invalid first byte": {
			Data:              []byte{byte(ClassUniversal) | byte(TypeConstructed) | byte(HighTag), 0x0},
			ExpectedError:     "invalid first high-tag-number tag byte",
			ExpectedBytesRead: 2,
		},
		"high-tag-number tag invalid first byte with continue bit": {
			Data:              []byte{byte(ClassUniversal) | byte(TypeConstructed) | byte(HighTag), byte(HighTagContinueBitmask)},
			ExpectedError:     "invalid first high-tag-number tag byte",
			ExpectedBytesRead: 2,
		},
		"high-tag-number tag continuation missing bytes": {
			Data:              []byte{byte(ClassUniversal) | byte(TypeConstructed) | byte(HighTag), byte(HighTagContinueBitmask | 0x1)},
			ExpectedError:     io.ErrUnexpectedEOF.Error(),
			ExpectedBytesRead: 2,
		},
		"high-tag-number tag overflow": {
			Data: []byte{
				byte(ClassUniversal) | byte(TypeConstructed) | byte(HighTag),
				byte(HighTagContinueBitmask | 0x1),
				byte(HighTagContinueBitmask | 0x1),
				byte(HighTagContinueBitmask | 0x1),
				byte(HighTagContinueBitmask | 0x1),
				byte(HighTagContinueBitmask | 0x1),
				byte(HighTagContinueBitmask | 0x1),
				byte(HighTagContinueBitmask | 0x1),
				byte(HighTagContinueBitmask | 0x1),
				byte(HighTagContinueBitmask | 0x1),
				byte(0x1),
			},
			ExpectedError:     "high-tag-number tag overflow",
			ExpectedBytesRead: 11,
		},
		"max high-tag-number tag": {
			Data: []byte{
				byte(ClassUniversal) | byte(TypeConstructed) | byte(HighTag),
				byte(HighTagContinueBitmask | 0x7f),
				byte(HighTagContinueBitmask | 0x7f),
				byte(HighTagContinueBitmask | 0x7f),
				byte(HighTagContinueBitmask | 0x7f),
				byte(HighTagContinueBitmask | 0x7f),
				byte(HighTagContinueBitmask | 0x7f),
				byte(HighTagContinueBitmask | 0x7f),
				byte(HighTagContinueBitmask | 0x7f),
				byte(0x7f),
			},
			ExpectedIdentifier: Identifier{
				ClassType: ClassUniversal,
				TagType:   TypeConstructed,
				Tag:       Tag(0x7FFFFFFFFFFFFFFF), // 01111111...(63)...11111b
			},
			ExpectedBytesRead: 10,
		},
		"high-tag-number encoding of low-tag value": {
			Data: []byte{
				byte(ClassUniversal) | byte(TypeConstructed) | byte(HighTag),
				byte(TagObjectDescriptor),
			},
			ExpectedIdentifier: Identifier{
				ClassType: ClassUniversal,
				TagType:   TypeConstructed,
				Tag:       TagObjectDescriptor,
			},
			ExpectedBytesRead: 2,
		},
		"max high-tag-number tag ignores extra data": {
			Data: []byte{
				byte(ClassUniversal) | byte(TypeConstructed) | byte(HighTag),
				byte(HighTagContinueBitmask | 0x7f),
				byte(HighTagContinueBitmask | 0x7f),
				byte(HighTagContinueBitmask | 0x7f),
				byte(HighTagContinueBitmask | 0x7f),
				byte(HighTagContinueBitmask | 0x7f),
				byte(HighTagContinueBitmask | 0x7f),
				byte(HighTagContinueBitmask | 0x7f),
				byte(HighTagContinueBitmask | 0x7f),
				byte(0x7f),
				byte(0x01), // extra data, shouldn't be read
				byte(0x02), // extra data, shouldn't be read
				byte(0x03), // extra data, shouldn't be read
			},
			ExpectedIdentifier: Identifier{
				ClassType: ClassUniversal,
				TagType:   TypeConstructed,
				Tag:       Tag(0x7FFFFFFFFFFFFFFF), // 01111111...(63)...11111b
			},
			ExpectedBytesRead: 10,
		},
	}

	for k, tc := range testcases {
		reader := bytes.NewBuffer(tc.Data)
		identifier, read, err := readIdentifier(reader)

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
	}
}

func TestEncodeIdentifier(t *testing.T) {
	testcases := map[string]struct {
		Identifier    Identifier
		ExpectedBytes []byte
	}{
		"universal primitive eoc": {
			Identifier: Identifier{
				ClassType: ClassUniversal,
				TagType:   TypePrimitive,
				Tag:       TagEOC,
			},
			ExpectedBytes: []byte{byte(ClassUniversal) | byte(TypePrimitive) | byte(TagEOC)},
		},
		"universal primitive character string": {
			Identifier: Identifier{
				ClassType: ClassUniversal,
				TagType:   TypePrimitive,
				Tag:       TagCharacterString,
			},
			ExpectedBytes: []byte{byte(ClassUniversal) | byte(TypePrimitive) | byte(TagCharacterString)},
		},

		"universal constructed bit string": {
			Identifier: Identifier{
				ClassType: ClassUniversal,
				TagType:   TypeConstructed,
				Tag:       TagBitString,
			},
			ExpectedBytes: []byte{byte(ClassUniversal) | byte(TypeConstructed) | byte(TagBitString)},
		},
		"universal constructed character string": {
			Identifier: Identifier{
				ClassType: ClassUniversal,
				TagType:   TypeConstructed,
				Tag:       TagCharacterString,
			},
			ExpectedBytes: []byte{byte(ClassUniversal) | byte(TypeConstructed) | byte(TagCharacterString)},
		},

		"application constructed object descriptor": {
			Identifier: Identifier{
				ClassType: ClassApplication,
				TagType:   TypeConstructed,
				Tag:       TagObjectDescriptor,
			},
			ExpectedBytes: []byte{byte(ClassApplication) | byte(TypeConstructed) | byte(TagObjectDescriptor)},
		},
		"context constructed object descriptor": {
			Identifier: Identifier{
				ClassType: ClassContext,
				TagType:   TypeConstructed,
				Tag:       TagObjectDescriptor,
			},
			ExpectedBytes: []byte{byte(ClassContext) | byte(TypeConstructed) | byte(TagObjectDescriptor)},
		},
		"private constructed object descriptor": {
			Identifier: Identifier{
				ClassType: ClassPrivate,
				TagType:   TypeConstructed,
				Tag:       TagObjectDescriptor,
			},
			ExpectedBytes: []byte{byte(ClassPrivate) | byte(TypeConstructed) | byte(TagObjectDescriptor)},
		},

		"max low-tag-number tag": {
			Identifier: Identifier{
				ClassType: ClassUniversal,
				TagType:   TypeConstructed,
				Tag:       TagBMPString,
			},
			ExpectedBytes: []byte{
				byte(ClassUniversal) | byte(TypeConstructed) | byte(TagBMPString),
			},
		},

		"min high-tag-number tag": {
			Identifier: Identifier{
				ClassType: ClassUniversal,
				TagType:   TypeConstructed,
				Tag:       TagBMPString + 1,
			},
			ExpectedBytes: []byte{
				byte(ClassUniversal) | byte(TypeConstructed) | byte(HighTag),
				byte(TagBMPString + 1),
			},
		},

		"max high-tag-number tag": {
			Identifier: Identifier{
				ClassType: ClassUniversal,
				TagType:   TypeConstructed,
				Tag:       Tag(math.MaxInt64),
			},
			ExpectedBytes: []byte{
				byte(ClassUniversal) | byte(TypeConstructed) | byte(HighTag),
				byte(HighTagContinueBitmask | 0x7f),
				byte(HighTagContinueBitmask | 0x7f),
				byte(HighTagContinueBitmask | 0x7f),
				byte(HighTagContinueBitmask | 0x7f),
				byte(HighTagContinueBitmask | 0x7f),
				byte(HighTagContinueBitmask | 0x7f),
				byte(HighTagContinueBitmask | 0x7f),
				byte(HighTagContinueBitmask | 0x7f),
				byte(0x7f),
			},
		},
	}

	for k, tc := range testcases {
		b := encodeIdentifier(tc.Identifier)
		if bytes.Compare(tc.ExpectedBytes, b) != 0 {
			t.Errorf("%s: Expected\n\t%#v\ngot\n\t%#v", k, tc.ExpectedBytes, b)
		}
	}
}
