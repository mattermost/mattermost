// Copyright 2015 Richard Lehane. All rights reserved.
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
)

type Vector []Type

func (v Vector) String() string {
	return ""
}

func (v Vector) Type() string {
	if len(v) > 0 {
		return "Vector of " + v[0].Type()
	}
	return "Vector (empty)"
}

func (v Vector) Length() int {
	ret := 4
	for _, t := range v {
		ret += t.Length()
	}
	return ret
}

func MakeVector(f MakeType, b []byte) (Type, error) {
	if len(b) < 4 {
		return Vector{}, ErrType
	}
	l := int(binary.LittleEndian.Uint32(b[:4]))
	v := make(Vector, l)
	place := 4
	for i := 0; i < l; i++ {
		t, err := f(b[place:])
		if err != nil {
			return Vector{}, ErrType
		}
		v[i] = t
		place += t.Length()
	}
	return v, nil
}

type Array [][]Type

func (a Array) String() string {
	return ""
}

func (a Array) Type() string {
	if len(a) > 0 && len(a[0]) > 0 {
		return "Array of " + a[0][0].Type()
	}
	return "Array (empty)"
}

func (a Array) Length() int {
	return 0
}

func MakeArray(f MakeType, b []byte) (Type, error) {
	return Array{}, nil
}

type Variant struct {
	t Type
}

func (v Variant) String() string {
	return "Typed Property Value containing " + v.t.String()
}

func (v Variant) Type() string {
	return "Typed Property Value containing " + v.t.Type()
}

func (v Variant) Length() int {
	return 4 + v.t.Length()
}

func MakeVariant(b []byte) (Type, error) {
	t, err := Evaluate(b)
	if err != nil {
		return Variant{}, err
	}
	return Variant{t}, nil
}
