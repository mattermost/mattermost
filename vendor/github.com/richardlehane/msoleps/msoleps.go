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

// Package msoleps implements a reader for Microsoft OLE Property Set Data structures,
// (http://msdn.microsoft.com/en-au/library/dd942421.aspx) a generic persistence format
// for simple typed metadata

// Example:
//   file, _ := os.Open("test/test.doc")
//   defer file.Close()
//   doc, err := mscfb.NewReader(file)
//   if err != nil {
//    log.Fatal(err)
//   }
//   props := msoleps.New()
//   for entry, err := doc.Next(); err == nil; entry, err = doc.Next() {
//     if msoleps.IsMSOLEPS(entry.Initial) {
//       if oerr := props.Reset(doc); oerr != nil {
//         log.Fatal(oerr)
//       }
//       for prop := range props.Property {
//         fmt.Printf("Name: %s; Type: %s; Value: %v", prop.Name, prop.Type(), prop)
//       }
//     }
//   }
package msoleps

import (
	"bytes"
	"encoding/binary"
	"errors"
	"io"

	"github.com/richardlehane/msoleps/types"
)

var (
	ErrFormat = errors.New("msoleps: not a valid msoleps stream")
	ErrRead   = errors.New("msoleps: error reading msoleps stream")
	ErrSeek   = errors.New("msoleps: can't seek backwards")
)

// IsMSOLEPS checks the first uint16 character of an mscfb name to test if it is a MSOLEPS stream
func IsMSOLEPS(i uint16) bool {
	if i == 0x0005 {
		return true
	}
	return false
}

// Reader is a reader for MS OLE Property Set Data structures
type Reader struct {
	Property []*Property
	b        *bytes.Buffer
	buf      []byte
	*propertySetStream
	pSets [2]*propertySet
}

func New() *Reader {
	r := &Reader{}
	r.b = &bytes.Buffer{}
	return r
}

func (r *Reader) Reset(rdr io.Reader) error {
	r.b.Reset()
	return r.start(rdr)
}

func NewFrom(rdr io.Reader) (*Reader, error) {
	r := &Reader{}
	r.b = &bytes.Buffer{}
	return r, r.start(rdr)
}

func (r *Reader) start(rdr io.Reader) error {
	if _, err := r.b.ReadFrom(rdr); err != nil {
		return ErrRead
	}
	r.buf = r.b.Bytes()
	// read the header (property stream details)
	pss, err := makePropertySetStream(r.buf)
	if err != nil {
		return err
	}
	// sanity checks to find obvious errors
	switch {
	case pss.byteOrder != 0xFFFE, pss.version > 0x0001, pss.numPropertySets > 0x00000002:
		return ErrFormat
	}
	r.propertySetStream = pss
	// identify the property identifiers and offsets
	ps, err := r.getPropertySet(pss.offsetA)
	if err != nil {
		return err
	}
	plen := len(ps.idsOffs)
	r.pSets[0] = ps
	var psb *propertySet
	if pss.numPropertySets == 2 {
		psb, err = r.getPropertySet(pss.offsetB)
		if err != nil {
			return err
		}
		r.pSets[1] = psb
		plen += len(psb.idsOffs)
	}
	r.Property = make([]*Property, plen)
	dict, ok := propertySets[pss.fmtidA]
	if !ok {
		dict = ps.dict
		if dict == nil {
			dict = make(map[uint32]string)
		}
	}
	dict = addDefaults(dict)
	for i, v := range ps.idsOffs {
		r.Property[i] = &Property{}
		r.Property[i].Name = dict[v.id]
		// don't try to evaluate dictionary property
		if v.id == 0x00000000 {
			r.Property[i].T = types.Null{}
			continue
		}
		t, _ := types.Evaluate(r.buf[int(v.offset+pss.offsetA):])
		if t.Type() == "CodeString" {
			cs := t.(*types.CodeString)
			cs.SetId(ps.code)
			t = types.Type(cs)
		}
		r.Property[i].T = t
	}
	if pss.numPropertySets != 2 {
		return nil
	}
	dict, ok = propertySets[pss.fmtidB]
	if !ok {
		dict = psb.dict
		if dict == nil {
			dict = make(map[uint32]string)
		}
	}
	dict = addDefaults(dict)
	for i, v := range psb.idsOffs {
		i += len(ps.idsOffs)
		r.Property[i] = &Property{}
		r.Property[i].Name = dict[v.id]
		// don't try to evaluate dictionary property
		if v.id == 0x00000000 {
			r.Property[i].T = types.Null{}
			continue
		}
		t, _ := types.Evaluate(r.buf[int(v.offset+pss.offsetB):])
		if t.Type() == "CodeString" {
			cs := t.(*types.CodeString)
			cs.SetId(psb.code)
			t = types.Type(cs)
		}
		r.Property[i].T = t
	}
	return nil
}

func (r *Reader) getPropertySet(o uint32) (*propertySet, error) {
	pSet := &propertySet{}
	pSet.size = binary.LittleEndian.Uint32(r.buf[int(o) : int(o)+4])
	pSet.numProperties = binary.LittleEndian.Uint32(r.buf[int(o)+4 : int(o)+8])
	pSet.idsOffs = make([]propertyIDandOffset, int(pSet.numProperties))
	var dictOff uint32
	for i := range pSet.idsOffs {
		this := i*8 + 8 + int(o)
		pSet.idsOffs[i].id = binary.LittleEndian.Uint32(r.buf[this : this+4])
		pSet.idsOffs[i].offset = binary.LittleEndian.Uint32(r.buf[this+4 : this+8])
		switch pSet.idsOffs[i].id {
		case 0x00000000:
			dictOff = pSet.idsOffs[i].offset
		case 0x00000001:
			off := int(pSet.idsOffs[i].offset + o)
			pSet.code = types.CodePageID(binary.LittleEndian.Uint16(r.buf[off+4 : off+6]))
		}
	}
	if dictOff > 0 {
		var err error
		pSet.dict, err = r.getDictionary(dictOff+o, pSet.code)
		if err != nil {
			return nil, err
		}
	}
	return pSet, nil
}

func (r *Reader) getDictionary(o uint32, code types.CodePageID) (map[uint32]string, error) {
	b := r.buf[int(o):]
	e := 4
	if len(b) < e {
		return nil, ErrFormat
	}
	num := int(binary.LittleEndian.Uint32(b[:e]))
	if num == 0 {
		return nil, nil
	}
	dict := make(map[uint32]string)
	for i := 0; i < num; i++ {
		if len(b[e:]) < 8 {
			return nil, ErrFormat
		}
		id, l := binary.LittleEndian.Uint32(b[e:e+4]), binary.LittleEndian.Uint32(b[e+4:e+8])
		var s types.Type
		var err error
		if code == 0x04B0 {
			var pad int
			if l%2 != 0 {
				pad = 2
			}
			s, err = types.MakeUnicode(b[e+4:])
			if err != nil {
				return nil, ErrFormat
			}
			e = e + 8 + pad + int(l)*2
		} else {
			s, err = types.MakeCodeString(b[e+4:])
			if err != nil {
				return nil, ErrFormat
			}
			cs := s.(*types.CodeString)
			cs.SetId((code))
			s = cs
			e = e + 8 + int(l)
		}
		dict[id] = s.String()
	}
	return dict, nil
}
