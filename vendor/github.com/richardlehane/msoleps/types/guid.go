// Copyright 2014 Richard Lehane. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package types

import (
	"encoding/binary"
	"encoding/hex"
	"errors"
	"strings"
)

// Win GUID and UUID type
// http://msdn.microsoft.com/en-us/library/cc230326.aspx
type Guid struct {
	DataA uint32
	DataB uint16
	DataC uint16
	DataD [8]byte
}

func (g Guid) String() string {
	buf := make([]byte, 8)
	binary.BigEndian.PutUint32(buf[:4], g.DataA)
	binary.BigEndian.PutUint16(buf[4:6], g.DataB)
	binary.BigEndian.PutUint16(buf[6:], g.DataC)
	return strings.ToUpper("{" +
		hex.EncodeToString(buf[:4]) +
		"-" +
		hex.EncodeToString(buf[4:6]) +
		"-" +
		hex.EncodeToString(buf[6:]) +
		"-" +
		hex.EncodeToString(g.DataD[:2]) +
		"-" +
		hex.EncodeToString(g.DataD[2:]) +
		"}")
}

func (g Guid) Type() string {
	return "Guid"
}

func (g Guid) Length() int {
	return 16
}

func GuidFromString(str string) (Guid, error) {
	gerr := "Invalid GUID: expecting in format {F29F85E0-4FF9-1068-AB91-08002B27B3D9}, got " + str
	if len(str) != 38 {
		return Guid{}, errors.New(gerr + "; bad length, should be 38 chars")
	}
	trimmed := strings.Trim(str, "{}")
	parts := strings.Split(trimmed, "-")
	if len(parts) != 5 {
		return Guid{}, errors.New(gerr + "; expecting should five '-' separators")
	}
	buf, err := hex.DecodeString(strings.Join(parts, ""))
	if err != nil {
		return Guid{}, errors.New(gerr + "; error decoding hex: " + err.Error())
	}
	return makeGuid(buf, binary.BigEndian), nil
}

func MakeGuid(b []byte) (Type, error) {
	if len(b) < 16 {
		return Guid{}, ErrType
	}
	return makeGuid(b, binary.LittleEndian), nil
}

func makeGuid(b []byte, order binary.ByteOrder) Guid {
	g := Guid{
		DataA: order.Uint32(b[:4]),
		DataB: order.Uint16(b[4:6]),
		DataC: order.Uint16(b[6:8]),
		DataD: [8]byte{},
	}
	copy(g.DataD[:], b[8:])
	return g
}

func MustGuidFromString(str string) Guid {
	g, err := GuidFromString(str)
	if err != nil {
		panic(err)
	}
	return g
}

func MustGuid(b []byte) Guid {
	return makeGuid(b, binary.LittleEndian)
}

func GuidFromName(n string) (Guid, error) {
	n = strings.ToLower(n)
	buf, err := charConvert([]byte(n))
	if err != nil {
		return Guid{}, err
	}
	return makeGuid(buf, binary.LittleEndian), nil
}

func charConvert(in []byte) ([]byte, error) {
	if len(in) != 26 {
		return nil, errors.New("invalid GUID: expecting 26 characters")
	}
	out := make([]byte, 16)
	var idx, shift uint
	var b byte
	for _, v := range in {
		this, ok := characterMapping[v]
		if !ok {
			return nil, errors.New("invalid Guid: invalid character")
		}
		b = b | this<<shift
		if shift >= 3 {
			out[idx] = b
			idx++
			b = this >> (8 - shift) // write any remainder back to b, or 0 if shift is 3
		}
		shift = shift + 5
		if shift > 7 {
			shift = shift - 8
		}
	}
	return out, nil
}

const (
	charA byte = iota
	charB
	charC
	charD
	charE
	charF
	charG
	charH
	charI
	charJ
	charK
	charL
	charM
	charN
	charO
	charP
	charQ
	charR
	charS
	charT
	charU
	charV
	charW
	charX
	charY
	charZ
	char0
	char1
	char2
	char3
	char4
	char5
)

var characterMapping = map[byte]byte{
	'a': charA,
	'b': charB,
	'c': charC,
	'd': charD,
	'e': charE,
	'f': charF,
	'g': charG,
	'h': charH,
	'i': charI,
	'j': charJ,
	'k': charK,
	'l': charL,
	'm': charM,
	'n': charN,
	'o': charO,
	'p': charP,
	'q': charQ,
	'r': charR,
	's': charS,
	't': charT,
	'u': charU,
	'v': charV,
	'w': charW,
	'x': charX,
	'y': charY,
	'z': charZ,
	'0': char0,
	'1': char1,
	'2': char2,
	'3': char3,
	'4': char4,
	'5': char5,
}
