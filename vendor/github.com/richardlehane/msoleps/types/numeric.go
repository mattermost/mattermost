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
	"strconv"
)

type Null struct{}

func (i Null) Type() string {
	return "Null"
}

func (i Null) Length() int {
	return 0
}

func (i Null) String() string {
	return ""
}

type Bool bool

func (i Bool) Type() string {
	return "Boolean"
}

func (i Bool) Length() int {
	return 2
}

func (i Bool) String() string {
	if i {
		return "true"
	}
	return "false"
}

func MakeBool(b []byte) (Type, error) {
	if len(b) < 2 {
		return Bool(false), ErrType
	}
	switch binary.LittleEndian.Uint16(b[:2]) {
	case 0xFFFF:
		return Bool(true), nil
	case 0x0000:
		return Bool(false), nil
	}
	return Bool(false), ErrType
}

type I1 int8

func (i I1) Type() string {
	return "Int8"
}

func (i I1) String() string {
	return strconv.Itoa(int(i))
}

func (i I1) Length() int {
	return 1
}

func MakeI1(b []byte) (Type, error) {
	if len(b) < 1 {
		return I1(0), ErrType
	}
	return I1(b[0]), nil
}

type I2 int16

func (i I2) Type() string {
	return "Int16"
}

func (i I2) Length() int {
	return 2
}

func (i I2) String() string {
	return strconv.Itoa(int(i))
}

func MakeI2(b []byte) (Type, error) {
	if len(b) < 2 {
		return I2(0), ErrType
	}
	return I2(binary.LittleEndian.Uint16(b[:2])), nil
}

type I4 int32

func (i I4) Type() string {
	return "Int32"
}

func (i I4) Length() int {
	return 4
}

func (i I4) String() string {
	return strconv.Itoa(int(i))
}

func MakeI4(b []byte) (Type, error) {
	if len(b) < 4 {
		return I4(0), ErrType
	}
	return I4(binary.LittleEndian.Uint32(b[:4])), nil
}

type I8 int64

func (i I8) Type() string {
	return "Int64"
}

func (i I8) Length() int {
	return 8
}

func (i I8) String() string {
	return strconv.FormatInt(int64(i), 10)
}

func MakeI8(b []byte) (Type, error) {
	if len(b) < 8 {
		return I8(0), ErrType
	}
	return I8(binary.LittleEndian.Uint64(b[:8])), nil
}

type UI1 uint8

func (i UI1) Type() string {
	return "Uint8"
}

func (i UI1) Length() int {
	return 1
}

func (i UI1) String() string {
	return strconv.Itoa(int(i))
}

func MakeUI1(b []byte) (Type, error) {
	if len(b) < 1 {
		return UI1(0), ErrType
	}
	return UI1(b[0]), nil
}

type UI2 uint16

func (i UI2) Type() string {
	return "Uint16"
}

func (i UI2) Length() int {
	return 2
}

func (i UI2) String() string {
	return strconv.Itoa(int(i))
}

func MakeUI2(b []byte) (Type, error) {
	if len(b) < 2 {
		return UI2(0), ErrType
	}
	return UI2(binary.LittleEndian.Uint16(b[:2])), nil
}

type UI4 uint32

func (i UI4) Type() string {
	return "Uint32"
}

func (i UI4) Length() int {
	return 4
}

func (i UI4) String() string {
	return strconv.FormatUint(uint64(i), 10)
}

func MakeUI4(b []byte) (Type, error) {
	if len(b) < 4 {
		return UI4(0), ErrType
	}
	return UI4(binary.LittleEndian.Uint32(b[:4])), nil
}

type UI8 uint64

func (i UI8) Type() string {
	return "Uint64"
}

func (i UI8) Length() int {
	return 8
}

func (i UI8) String() string {
	return strconv.FormatUint(uint64(i), 10)
}

func MakeUI8(b []byte) (Type, error) {
	if len(b) < 8 {
		return UI8(0), ErrType
	}
	return UI8(binary.LittleEndian.Uint64(b[:8])), nil
}

type R4 float32

func (r R4) Type() string {
	return "Float32"
}

func (r R4) Length() int {
	return 4
}

func (r R4) String() string {
	return strconv.FormatFloat(float64(r), 'f', -1, 32)
}

func MakeR4(b []byte) (Type, error) {
	if len(b) < 4 {
		return R4(0), ErrType
	}
	return R4(binary.LittleEndian.Uint32(b[:4])), nil
}

type R8 float64

func (r R8) Type() string {
	return "Float64"
}

func (r R8) Length() int {
	return 8
}

func (r R8) String() string {
	return strconv.FormatFloat(float64(r), 'f', -1, 64)
}

func MakeR8(b []byte) (Type, error) {
	if len(b) < 8 {
		return R8(0), ErrType
	}
	return R8(binary.LittleEndian.Uint64(b[:8])), nil
}
