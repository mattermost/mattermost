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
	"math"
	"math/big"
)

// http://msdn.microsoft.com/en-us/library/cc237603.aspx
type Decimal struct {
	res    [2]byte
	scale  byte
	sign   byte
	high32 uint32
	low64  uint64
}

func (d Decimal) Type() string {
	return "Decimal"
}

func (d Decimal) Length() int {
	return 16
}

func (d Decimal) String() string {
	h, l, b := new(big.Int), new(big.Int), new(big.Int)
	l.SetUint64(d.low64)
	h.Lsh(big.NewInt(int64(d.high32)), 64)
	b.Add(h, l)
	q, f, r := new(big.Rat), new(big.Rat), new(big.Rat)
	q.SetFloat64(math.Pow10(int(d.scale)))
	r.Quo(f.SetInt(b), q)
	if d.sign == 0x80 {
		r.Neg(r)
	}
	return r.FloatString(20)
}

func MakeDecimal(b []byte) (Type, error) {
	if len(b) < 16 {
		return Decimal{}, ErrType
	}
	return Decimal{
		res:    [2]byte{b[0], b[1]},
		scale:  b[2],
		sign:   b[3],
		high32: binary.LittleEndian.Uint32(b[4:8]),
		low64:  binary.LittleEndian.Uint64(b[8:16]),
	}, nil
}
