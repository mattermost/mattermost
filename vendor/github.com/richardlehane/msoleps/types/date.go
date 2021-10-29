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
	"time"
)

// http://msdn.microsoft.com/en-us/library/cc237601.aspx
type Date float64

func (d Date) Time() time.Time {
	start := time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC)
	day := float64(time.Hour * 24)
	dur := time.Duration(day * float64(d))
	return start.Add(dur)
}

func (d Date) String() string {
	return d.Time().String()
}

func (d Date) Type() string {
	return "Date"
}

func (d Date) Length() int {
	return 8
}

func MakeDate(b []byte) (Type, error) {
	if len(b) < 8 {
		return Date(0), ErrType
	}
	return Date(binary.LittleEndian.Uint64(b[:8])), nil
}
