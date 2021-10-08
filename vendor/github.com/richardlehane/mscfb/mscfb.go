// Copyright 2013 Richard Lehane. All rights reserved.
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

// Package mscfb implements a reader for Microsoft's Compound File Binary File Format (http://msdn.microsoft.com/en-us/library/dd942138.aspx).
//
// The Compound File Binary File Format is also known as the Object Linking and Embedding (OLE) or Component Object Model (COM) format and was used by many
// early MS software such as MS Office.
//
// Example:
//   file, _ := os.Open("test/test.doc")
//   defer file.Close()
//   doc, err := mscfb.New(file)
//   if err != nil {
//     log.Fatal(err)
//   }
//   for entry, err := doc.Next(); err == nil; entry, err = doc.Next() {
//     buf := make([]byte, 512)
//     i, _ := entry.Read(buf)
//     if i > 0 {
//       fmt.Println(buf[:i])
//     }
//     fmt.Println(entry.Name)
//   }
package mscfb

import (
	"encoding/binary"
	"io"
	"strconv"
	"time"
)

func fileOffset(ss, sn uint32) int64 {
	return int64((sn + 1) * ss)
}

const (
	signature            uint64 = 0xE11AB1A1E011CFD0
	miniStreamSectorSize uint32 = 64
	miniStreamCutoffSize int64  = 4096
	dirEntrySize         uint32 = 128 //128 bytes
)

const (
	maxRegSect     uint32 = 0xFFFFFFFA // Maximum regular sector number
	difatSect      uint32 = 0xFFFFFFFC //Specifies a DIFAT sector in the FAT
	fatSect        uint32 = 0xFFFFFFFD // Specifies a FAT sector in the FAT
	endOfChain     uint32 = 0xFFFFFFFE // End of linked chain of sectors
	freeSect       uint32 = 0xFFFFFFFF // Speficies unallocated sector in the FAT, Mini FAT or DIFAT
	maxRegStreamID uint32 = 0xFFFFFFFA // maximum regular stream ID
	noStream       uint32 = 0xFFFFFFFF // empty pointer
)

const lenHeader int = 8 + 16 + 10 + 6 + 12 + 8 + 16 + 109*4

type headerFields struct {
	signature           uint64
	_                   [16]byte    //CLSID - ignore, must be null
	minorVersion        uint16      //Version number for non-breaking changes. This field SHOULD be set to 0x003E if the major version field is either 0x0003 or 0x0004.
	majorVersion        uint16      //Version number for breaking changes. This field MUST be set to either 0x0003 (version 3) or 0x0004 (version 4).
	_                   [2]byte     //byte order - ignore, must be little endian
	sectorSize          uint16      //This field MUST be set to 0x0009, or 0x000c, depending on the Major Version field. This field specifies the sector size of the compound file as a power of 2. If Major Version is 3, then the Sector Shift MUST be 0x0009, specifying a sector size of 512 bytes. If Major Version is 4, then the Sector Shift MUST be 0x000C, specifying a sector size of 4096 bytes.
	_                   [2]byte     // ministream sector size - ignore, must be 64 bytes
	_                   [6]byte     // reserved - ignore, not used
	numDirectorySectors uint32      //This integer field contains the count of the number of directory sectors in the compound file. If Major Version is 3, then the Number of Directory Sectors MUST be zero. This field is not supported for version 3 compound files.
	numFatSectors       uint32      //This integer field contains the count of the number of FAT sectors in the compound file.
	directorySectorLoc  uint32      //This integer field contains the starting sector number for the directory stream.
	_                   [4]byte     // transaction - ignore, not used
	_                   [4]byte     // mini stream size cutooff - ignore, must be 4096 bytes
	miniFatSectorLoc    uint32      //This integer field contains the starting sector number for the mini FAT.
	numMiniFatSectors   uint32      //This integer field contains the count of the number of mini FAT sectors in the compound file.
	difatSectorLoc      uint32      //This integer field contains the starting sector number for the DIFAT.
	numDifatSectors     uint32      //This integer field contains the count of the number of DIFAT sectors in the compound file.
	initialDifats       [109]uint32 //The first 109 difat sectors are included in the header
}

func makeHeader(b []byte) *headerFields {
	h := &headerFields{}
	h.signature = binary.LittleEndian.Uint64(b[:8])
	h.minorVersion = binary.LittleEndian.Uint16(b[24:26])
	h.majorVersion = binary.LittleEndian.Uint16(b[26:28])
	h.sectorSize = binary.LittleEndian.Uint16(b[30:32])
	h.numDirectorySectors = binary.LittleEndian.Uint32(b[40:44])
	h.numFatSectors = binary.LittleEndian.Uint32(b[44:48])
	h.directorySectorLoc = binary.LittleEndian.Uint32(b[48:52])
	h.miniFatSectorLoc = binary.LittleEndian.Uint32(b[60:64])
	h.numMiniFatSectors = binary.LittleEndian.Uint32(b[64:68])
	h.difatSectorLoc = binary.LittleEndian.Uint32(b[68:72])
	h.numDifatSectors = binary.LittleEndian.Uint32(b[72:76])
	var idx int
	for i := 76; i < 512; i = i + 4 {
		h.initialDifats[idx] = binary.LittleEndian.Uint32(b[i : i+4])
		idx++
	}
	return h
}

type header struct {
	*headerFields
	difats         []uint32
	miniFatLocs    []uint32
	miniStreamLocs []uint32 // chain of sectors containing the ministream
}

func (r *Reader) setHeader() error {
	buf, err := r.readAt(0, lenHeader)
	if err != nil {
		return err
	}
	r.header = &header{headerFields: makeHeader(buf)}
	// sanity check - check signature
	if r.header.signature != signature {
		return Error{ErrFormat, "bad signature", int64(r.header.signature)}
	}
	// check for legal sector size
	if r.header.sectorSize == 0x0009 || r.header.sectorSize == 0x000c {
		r.sectorSize = uint32(1 << r.header.sectorSize)
	} else {
		return Error{ErrFormat, "illegal sector size", int64(r.header.sectorSize)}
	}
	// check for DIFAT overflow
	if r.header.numDifatSectors > 0 {
		sz := (r.sectorSize / 4) - 1
		if int(r.header.numDifatSectors*sz+109) < 0 {
			return Error{ErrFormat, "DIFAT int overflow", int64(r.header.numDifatSectors)}
		}
		if r.header.numDifatSectors*sz+109 > r.header.numFatSectors+sz {
			return Error{ErrFormat, "num DIFATs exceeds FAT sectors", int64(r.header.numDifatSectors)}
		}
	}
	// check for mini FAT overflow
	if r.header.numMiniFatSectors > 0 {
		if int(r.sectorSize/4*r.header.numMiniFatSectors) < 0 {
			return Error{ErrFormat, "mini FAT int overflow", int64(r.header.numMiniFatSectors)}
		}
		if r.header.numMiniFatSectors > r.header.numFatSectors*(r.sectorSize/miniStreamSectorSize) {
			return Error{ErrFormat, "num mini FATs exceeds FAT sectors", int64(r.header.numFatSectors)}
		}
	}
	return nil
}

func (r *Reader) setDifats() error {
	r.header.difats = r.header.initialDifats[:]
	// return early if no extra DIFAT sectors
	if r.header.numDifatSectors == 0 {
		return nil
	}
	sz := (r.sectorSize / 4) - 1
	n := make([]uint32, 109, r.header.numDifatSectors*sz+109)
	copy(n, r.header.difats)
	r.header.difats = n
	off := r.header.difatSectorLoc
	for i := 0; i < int(r.header.numDifatSectors); i++ {
		buf, err := r.readAt(fileOffset(r.sectorSize, off), int(r.sectorSize))
		if err != nil {
			return Error{ErrFormat, "error setting DIFAT(" + err.Error() + ")", int64(off)}
		}
		for j := 0; j < int(sz); j++ {
			r.header.difats = append(r.header.difats, binary.LittleEndian.Uint32(buf[j*4:j*4+4]))
		}
		off = binary.LittleEndian.Uint32(buf[len(buf)-4:])
	}
	return nil
}

// set the ministream FAT and sector slices in the header
func (r *Reader) setMiniStream() error {
	// do nothing if there is no ministream
	if r.direntries[0].startingSectorLoc == endOfChain || r.header.miniFatSectorLoc == endOfChain || r.header.numMiniFatSectors == 0 {
		return nil
	}
	// build a slice of minifat sectors (akin to the DIFAT slice)
	c := int(r.header.numMiniFatSectors)
	r.header.miniFatLocs = make([]uint32, c)
	r.header.miniFatLocs[0] = r.header.miniFatSectorLoc
	for i := 1; i < c; i++ {
		loc, err := r.findNext(r.header.miniFatLocs[i-1], false)
		if err != nil {
			return Error{ErrFormat, "setting mini stream (" + err.Error() + ")", int64(r.header.miniFatLocs[i-1])}
		}
		r.header.miniFatLocs[i] = loc
	}
	// build a slice of ministream sectors
	c = int(r.sectorSize / 4 * r.header.numMiniFatSectors)
	r.header.miniStreamLocs = make([]uint32, 0, c)
	sn := r.direntries[0].startingSectorLoc
	var err error
	for sn != endOfChain {
		r.header.miniStreamLocs = append(r.header.miniStreamLocs, sn)
		sn, err = r.findNext(sn, false)
		if err != nil {
			return Error{ErrFormat, "setting mini stream (" + err.Error() + ")", int64(sn)}
		}
	}
	return nil
}

func (r *Reader) readAt(offset int64, length int) ([]byte, error) {
	if r.slicer {
		b, err := r.ra.(slicer).Slice(offset, length)
		if err != nil {
			return nil, Error{ErrRead, "slicer read error (" + err.Error() + ")", offset}
		}
		return b, nil
	}
	if length > len(r.buf) {
		return nil, Error{ErrRead, "read length greater than read buffer", int64(length)}
	}
	if _, err := r.ra.ReadAt(r.buf[:length], offset); err != nil {
		return nil, Error{ErrRead, err.Error(), offset}
	}
	return r.buf[:length], nil
}

func (r *Reader) getOffset(sn uint32, mini bool) (int64, error) {
	if mini {
		num := r.sectorSize / 64
		sec := int(sn / num)
		if sec >= len(r.header.miniStreamLocs) {
			return 0, Error{ErrRead, "minisector number is outside minisector range", int64(sec)}
		}
		dif := sn % num
		return int64((r.header.miniStreamLocs[sec]+1)*r.sectorSize + dif*64), nil
	}
	return fileOffset(r.sectorSize, sn), nil
}

// check the FAT sector for the next sector in a chain
func (r *Reader) findNext(sn uint32, mini bool) (uint32, error) {
	entries := r.sectorSize / 4
	index := int(sn / entries) // find position in DIFAT or minifat array
	var sect uint32
	if mini {
		if index < 0 || index >= len(r.header.miniFatLocs) {
			return 0, Error{ErrRead, "minisector index is outside miniFAT range", int64(index)}
		}
		sect = r.header.miniFatLocs[index]
	} else {
		if index < 0 || index >= len(r.header.difats) {
			return 0, Error{ErrRead, "FAT index is outside DIFAT range", int64(index)}
		}
		sect = r.header.difats[index]
	}
	fatIndex := sn % entries // find position within FAT or MiniFAT sector
	offset := fileOffset(r.sectorSize, sect) + int64(fatIndex*4)
	buf, err := r.readAt(offset, 4)
	if err != nil {
		return 0, Error{ErrRead, "bad read finding next sector (" + err.Error() + ")", offset}
	}
	return binary.LittleEndian.Uint32(buf), nil
}

// Reader provides sequential access to the contents of a MS compound file (MSCFB)
type Reader struct {
	slicer     bool
	sectorSize uint32
	buf        []byte
	header     *header
	File       []*File // File is an ordered slice of final directory entries.
	direntries []*File // unordered raw directory entries
	entry      int

	ra io.ReaderAt
	wa io.WriterAt
}

// New returns a MSCFB reader
func New(ra io.ReaderAt) (*Reader, error) {
	r := &Reader{ra: ra}
	if _, ok := ra.(slicer); ok {
		r.slicer = true
	} else {
		r.buf = make([]byte, lenHeader)
	}
	if err := r.setHeader(); err != nil {
		return nil, err
	}
	// resize the buffer to 4096 if sector size isn't 512
	if !r.slicer && int(r.sectorSize) > len(r.buf) {
		r.buf = make([]byte, r.sectorSize)
	}
	if err := r.setDifats(); err != nil {
		return nil, err
	}
	if err := r.setDirEntries(); err != nil {
		return nil, err
	}
	if err := r.setMiniStream(); err != nil {
		return nil, err
	}
	if err := r.traverse(); err != nil {
		return nil, err
	}
	return r, nil
}

// ID returns the CLSID (class ID) field from the root directory entry
func (r *Reader) ID() string {
	return r.File[0].ID()
}

// Created returns the created field from the root directory entry
func (r *Reader) Created() time.Time {
	return r.File[0].Created()
}

// Modified returns the last modified field from the root directory entry
func (r *Reader) Modified() time.Time {
	return r.File[0].Modified()
}

// Next iterates to the next directory entry.
// This isn't necessarily an adjacent *File within the File slice, but is based on the Left Sibling, Right Sibling and Child information in directory entries.
func (r *Reader) Next() (*File, error) {
	r.entry++
	if r.entry >= len(r.File) {
		return nil, io.EOF
	}
	return r.File[r.entry], nil
}

// Read the current directory entry
func (r *Reader) Read(b []byte) (n int, err error) {
	if r.entry >= len(r.File) {
		return 0, io.EOF
	}
	return r.File[r.entry].Read(b)
}

// Debug provides granular information from an mscfb file to assist with debugging
func (r *Reader) Debug() map[string][]uint32 {
	ret := map[string][]uint32{
		"sector size":            []uint32{r.sectorSize},
		"mini fat locs":          r.header.miniFatLocs,
		"mini stream locs":       r.header.miniStreamLocs,
		"directory sector":       []uint32{r.header.directorySectorLoc},
		"mini stream start/size": []uint32{r.File[0].startingSectorLoc, binary.LittleEndian.Uint32(r.File[0].streamSize[:])},
	}
	for f, err := r.Next(); err == nil; f, err = r.Next() {
		ret[f.Name+" start/size"] = []uint32{f.startingSectorLoc, binary.LittleEndian.Uint32(f.streamSize[:])}
	}
	return ret
}

const (
	// ErrFormat reports issues with the MSCFB's header structures
	ErrFormat = iota
	// ErrRead reports issues attempting to read MSCFB streams
	ErrRead
	// ErrSeek reports seek issues
	ErrSeek
	// ErrWrite reports write issues
	ErrWrite
	// ErrTraverse reports issues attempting to traverse the child-parent-sibling relations
	// between MSCFB storage objects
	ErrTraverse
)

type Error struct {
	typ int
	msg string
	val int64
}

func (e Error) Error() string {
	return "mscfb: " + e.msg + "; " + strconv.FormatInt(e.val, 10)
}

// Typ gives the type of MSCFB error
func (e Error) Typ() int {
	return e.typ
}

// Slicer interface avoids a copy by obtaining a byte slice directly from the underlying reader
type slicer interface {
	Slice(offset int64, length int) ([]byte, error)
}
