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

package msoleps

import (
	"encoding/binary"
	"github.com/richardlehane/msoleps/types"
)

type Property struct {
	Name string
	T    types.Type
}

func (p *Property) String() string {
	return p.T.String()
}

func (p *Property) Type() string {
	return p.T.Type()
}

type propertySetStream struct {
	byteOrder       uint16
	version         uint16
	SystemID        uint32
	CLSID           types.Guid
	numPropertySets uint32
	fmtidA          types.Guid
	offsetA         uint32
	fmtidB          types.Guid // This can be absent (i.e. not null)
	offsetB         uint32
}

func makePropertySetStream(b []byte) (*propertySetStream, error) {
	if len(b) < 48 {
		return nil, ErrFormat
	}
	ps := &propertySetStream{}
	ps.byteOrder = binary.LittleEndian.Uint16(b[:2])
	ps.version = binary.LittleEndian.Uint16(b[2:4])
	ps.SystemID = binary.LittleEndian.Uint32(b[4:8])
	g, _ := types.MakeGuid(b[8:])
	ps.CLSID = g.(types.Guid)
	ps.numPropertySets = binary.LittleEndian.Uint32(b[24:28])
	g, _ = types.MakeGuid(b[28:])
	ps.fmtidA, _ = g.(types.Guid)
	ps.offsetA = binary.LittleEndian.Uint32(b[44:48])
	if ps.numPropertySets != 2 {
		return ps, nil
	}
	if len(b) < 68 {
		return nil, ErrFormat
	}
	g, _ = types.MakeGuid(b[48:])
	ps.fmtidB = g.(types.Guid)
	ps.offsetB = binary.LittleEndian.Uint32(b[64:68])
	return ps, nil
}

type propertySet struct {
	size          uint32
	numProperties uint32
	idsOffs       []propertyIDandOffset
	dict          map[uint32]string
	code          types.CodePageID
}

type propertyIDandOffset struct {
	id     uint32
	offset uint32
}
