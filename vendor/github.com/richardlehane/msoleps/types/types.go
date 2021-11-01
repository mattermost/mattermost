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
	"errors"
)

// MakeVariant is defined in vectorArray.go. It calls Evaluate, which refers to the MakeTypes map, so must add at runtime
func init() { MakeTypes[VT_VARIANT] = MakeVariant }

var (
	ErrType        = errors.New("msoleps: error coercing byte stream to type")
	ErrUnknownType = errors.New("msoleps: unknown type error")
)

type Type interface {
	String() string
	Type() string
	Length() int
}

const (
	vector uint16 = iota + 1
	array
)

func Evaluate(b []byte) (Type, error) {
	if len(b) < 4 {
		return I1(0), ErrType
	}
	id := TypeID(binary.LittleEndian.Uint16(b[:2]))
	f, ok := MakeTypes[id]
	if !ok {
		return I1(0), ErrUnknownType
	}
	switch binary.LittleEndian.Uint16(b[2:4]) {
	case vector:
		return MakeVector(f, b[4:])
	case array:
		return MakeArray(f, b[4:])
	}
	return f(b[4:])
}

type TypeID uint16

const (
	VT_EMPTY TypeID = iota // 0x00
	VT_NULL
	VT_I2
	VT_I4
	VT_R4
	VT_R8
	VT_CY
	VT_DATE
	VT_BSTR
	_
	VT_ERROR
	VT_BOOL
	VT_VARIANT
	_
	VT_DECIMAL
	_
	VT_I1
	VT_U1
	VT_UI2
	VT_UI4
	VT_I8
	VT_UI8
	VT_INT
	VT_UINT  //0x17
	_        = iota + 5
	VT_LPSTR //0x1E
	VT_LPWSTR
	VT_FILETIME = iota + 0x25 // 0x40
	VT_BLOB
	VT_STREAM
	VT_STORAGE
	VT_STREAMED_OBJECT
	VT_STORED_OBJECT
	VT_BLOB_OBJECT
	VT_CF
	VT_CLSID
	VT_VERSIONED_STREAM // 0x49
)

type MakeType func([]byte) (Type, error)

var MakeTypes map[TypeID]MakeType = map[TypeID]MakeType{
	VT_I2:       MakeI2,
	VT_I4:       MakeI4,
	VT_R4:       MakeR4,
	VT_R8:       MakeR8,
	VT_CY:       MakeCurrency,
	VT_DATE:     MakeDate,
	VT_BSTR:     MakeCodeString,
	VT_BOOL:     MakeBool,
	VT_DECIMAL:  MakeDecimal,
	VT_I1:       MakeI1,
	VT_U1:       MakeUI1,
	VT_UI2:      MakeUI2,
	VT_UI4:      MakeUI4,
	VT_I8:       MakeI8,
	VT_UI8:      MakeUI8,
	VT_INT:      MakeI4,
	VT_UINT:     MakeUI4,
	VT_LPSTR:    MakeCodeString,
	VT_LPWSTR:   MakeUnicode,
	VT_FILETIME: MakeFileTime,
	VT_CLSID:    MakeGuid,
}
