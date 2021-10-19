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

package mscfb

import (
	"encoding/binary"
	"io"
	"os"
	"time"
	"unicode"
	"unicode/utf16"

	"github.com/richardlehane/msoleps/types"
)

//objectType types
const (
	unknown     uint8 = 0x0 // this means unallocated - typically zeroed dir entries
	storage     uint8 = 0x1 // this means dir
	stream      uint8 = 0x2 // this means file
	rootStorage uint8 = 0x5 // this means root
)

// color flags
const (
	red   uint8 = 0x0
	black uint8 = 0x1
)

const lenDirEntry int = 64 + 4*4 + 16 + 4 + 8*2 + 4 + 8

type directoryEntryFields struct {
	rawName           [32]uint16     //64 bytes, unicode string encoded in UTF-16. If root, "Root Entry\0" w
	nameLength        uint16         //2 bytes
	objectType        uint8          //1 byte Must be one of the types specified above
	color             uint8          //1 byte Must be 0x00 RED or 0x01 BLACK
	leftSibID         uint32         //4 bytes, Dir? Stream ID of left sibling, if none set to NOSTREAM
	rightSibID        uint32         //4 bytes, Dir? Stream ID of right sibling, if none set to NOSTREAM
	childID           uint32         //4 bytes, Dir? Stream ID of child object, if none set to NOSTREAM
	clsid             types.Guid     // Contains an object class GUID (must be set to zeroes for stream object)
	stateBits         [4]byte        // user-defined flags for storage object
	create            types.FileTime // Windows FILETIME structure
	modify            types.FileTime // Windows FILETIME structure
	startingSectorLoc uint32         // if a stream object, first sector location. If root, first sector of ministream
	streamSize        [8]byte        // if a stream, size of user-defined data. If root, size of ministream
}

func makeDirEntry(b []byte) *directoryEntryFields {
	d := &directoryEntryFields{}
	for i := range d.rawName {
		d.rawName[i] = binary.LittleEndian.Uint16(b[i*2 : i*2+2])
	}
	d.nameLength = binary.LittleEndian.Uint16(b[64:66])
	d.objectType = uint8(b[66])
	d.color = uint8(b[67])
	d.leftSibID = binary.LittleEndian.Uint32(b[68:72])
	d.rightSibID = binary.LittleEndian.Uint32(b[72:76])
	d.childID = binary.LittleEndian.Uint32(b[76:80])
	d.clsid = types.MustGuid(b[80:96])
	copy(d.stateBits[:], b[96:100])
	d.create = types.MustFileTime(b[100:108])
	d.modify = types.MustFileTime(b[108:116])
	d.startingSectorLoc = binary.LittleEndian.Uint32(b[116:120])
	copy(d.streamSize[:], b[120:128])
	return d
}

func (r *Reader) setDirEntries() error {
	c := 20
	if r.header.numDirectorySectors > 0 {
		c = int(r.header.numDirectorySectors)
	}
	de := make([]*File, 0, c)
	cycles := make(map[uint32]bool)
	num := int(r.sectorSize / 128)
	sn := r.header.directorySectorLoc
	for sn != endOfChain {
		buf, err := r.readAt(fileOffset(r.sectorSize, sn), int(r.sectorSize))
		if err != nil {
			return Error{ErrRead, "directory entries read error (" + err.Error() + ")", fileOffset(r.sectorSize, sn)}
		}
		for i := 0; i < num; i++ {
			f := &File{r: r}
			f.directoryEntryFields = makeDirEntry(buf[i*128:])
			fixFile(r.header.majorVersion, f)
			f.curSector = f.startingSectorLoc
			de = append(de, f)
		}
		nsn, err := r.findNext(sn, false)
		if err != nil {
			return Error{ErrRead, "directory entries error finding sector (" + err.Error() + ")", int64(nsn)}
		}
		if nsn <= sn {
			if nsn == sn || cycles[nsn] {
				return Error{ErrRead, "directory entries sector cycle", int64(nsn)}
			}
			cycles[nsn] = true
		}
		sn = nsn
	}
	r.direntries = de
	return nil
}

func fixFile(v uint16, f *File) {
	fixName(f)
	if f.objectType != stream {
		return
	}
	// if the MSCFB major version is 4, then this can be a uint64 otherwise is a uint32 and the least signficant bits can contain junk
	if v > 3 {
		f.Size = int64(binary.LittleEndian.Uint64(f.streamSize[:]))
	} else {
		f.Size = int64(binary.LittleEndian.Uint32(f.streamSize[:4]))
	}
}

func fixName(f *File) {
	// From the spec:
	// "The length [name] MUST be a multiple of 2, and include the terminating null character in the count.
	// This length MUST NOT exceed 64, the maximum size of the Directory Entry Name field."
	if f.nameLength < 4 || f.nameLength > 64 {
		return
	}
	nlen := int(f.nameLength/2 - 1)
	f.Initial = f.rawName[0]
	var slen int
	if !unicode.IsPrint(rune(f.Initial)) {
		slen = 1
	}
	f.Name = string(utf16.Decode(f.rawName[slen:nlen]))
}

func (r *Reader) traverse() error {
	r.File = make([]*File, 0, len(r.direntries))
	var (
		recurse func(int, []string)
		err     error
		counter int
	)
	recurse = func(i int, path []string) {
		// prevent cycles, number of recurse calls can't exceed number of directory entries
		counter++
		if counter > len(r.direntries) {
			err = Error{ErrTraverse, "traversal counter overflow", int64(i)}
			return
		}
		if i < 0 || i >= len(r.direntries) {
			err = Error{ErrTraverse, "illegal traversal index", int64(i)}
			return
		}
		file := r.direntries[i]
		if file.leftSibID != noStream {
			recurse(int(file.leftSibID), path)
		}
		r.File = append(r.File, file)
		file.Path = path
		if file.childID != noStream {
			if i > 0 {
				recurse(int(file.childID), append(path, file.Name))
			} else {
				recurse(int(file.childID), path)
			}
		}
		if file.rightSibID != noStream {
			recurse(int(file.rightSibID), path)
		}
		return
	}
	recurse(0, []string{})
	return err
}

// File represents a MSCFB directory entry
type File struct {
	Name      string   // stream or directory name
	Initial   uint16   // the first character in the name (identifies special streams such as MSOLEPS property sets)
	Path      []string // file path
	Size      int64    // size of stream
	i         int64    // bytes read
	curSector uint32   // next sector for Read | Write
	rem       int64    // offset in current sector remaining previous Read | Write
	*directoryEntryFields
	r *Reader
}

type fileInfo struct{ *File }

func (fi fileInfo) Name() string { return fi.File.Name }
func (fi fileInfo) Size() int64 {
	if fi.objectType != stream {
		return 0
	}
	return fi.File.Size
}
func (fi fileInfo) IsDir() bool        { return fi.mode().IsDir() }
func (fi fileInfo) ModTime() time.Time { return fi.Modified() }
func (fi fileInfo) Mode() os.FileMode  { return fi.File.mode() }
func (fi fileInfo) Sys() interface{}   { return nil }

func (f *File) mode() os.FileMode {
	if f.objectType != stream {
		return os.ModeDir | 0777
	}
	return 0666
}

// FileInfo for this directory entry. Useful for IsDir() (whether a directory entry is a stream (file) or a storage object (dir))
func (f *File) FileInfo() os.FileInfo {
	return fileInfo{f}
}

// ID returns this directory entry's CLSID field
func (f *File) ID() string {
	return f.clsid.String()
}

// Created returns this directory entry's created field
func (f *File) Created() time.Time {
	return f.create.Time()
}

// Created returns this directory entry's modified field
func (f *File) Modified() time.Time {
	return f.modify.Time()
}

// Read this directory entry
// Returns 0, io.EOF if no stream is available (i.e. for a storage object)
func (f *File) Read(b []byte) (int, error) {
	if f.Size < 1 || f.i >= f.Size {
		return 0, io.EOF
	}
	sz := len(b)
	if int64(sz) > f.Size-f.i {
		sz = int(f.Size - f.i)
	}
	// get sectors and lengths for reads
	str, err := f.stream(sz)
	if err != nil {
		return 0, err
	}
	// now read
	var idx, i int
	for _, v := range str {
		jdx := idx + int(v[1])
		if jdx < idx || jdx > sz {
			return 0, Error{ErrRead, "bad read length", int64(jdx)}
		}
		j, err := f.r.ra.ReadAt(b[idx:jdx], v[0])
		i = i + j
		if err != nil {
			f.i += int64(i)
			return i, Error{ErrRead, "underlying reader fail (" + err.Error() + ")", int64(idx)}
		}
		idx = jdx
	}
	f.i += int64(i)
	if i != sz {
		err = Error{ErrRead, "bytes read do not match expected read size", int64(i)}
	} else if i < len(b) {
		err = io.EOF
	}
	return i, err
}

// Write to this directory entry
// Depends on the io.ReaderAt supplied to mscfb.New() being a WriterAt too
// Returns 0, io.EOF if no stream is available (i.e. for a storage object)
func (f *File) Write(b []byte) (int, error) {
	if f.Size < 1 || f.i >= f.Size {
		return 0, io.EOF
	}
	if f.r.wa == nil {
		wa, ok := f.r.ra.(io.WriterAt)
		if !ok {
			return 0, Error{ErrWrite, "mscfb.New must be given ReaderAt convertible to a io.WriterAt in order to write", 0}
		}
		f.r.wa = wa
	}
	sz := len(b)
	if int64(sz) > f.Size-f.i {
		sz = int(f.Size - f.i)
	}
	// get sectors and lengths for writes
	str, err := f.stream(sz)
	if err != nil {
		return 0, err
	}
	// now read
	var idx, i int
	for _, v := range str {
		jdx := idx + int(v[1])
		if jdx < idx || jdx > sz {
			return 0, Error{ErrWrite, "bad write length", int64(jdx)}
		}
		j, err := f.r.wa.WriteAt(b[idx:jdx], v[0])
		i = i + j
		if err != nil {
			f.i += int64(i)
			return i, Error{ErrWrite, "underlying writer fail (" + err.Error() + ")", int64(idx)}
		}
		idx = jdx
	}
	f.i += int64(i)
	if i != sz {
		err = Error{ErrWrite, "bytes written do not match expected write size", int64(i)}
	} else if i < len(b) {
		err = io.EOF
	}
	return i, err
}

// ReadAt reads p bytes at offset off from start of file. Does not affect seek place for other reads/writes.
func (f *File) ReadAt(p []byte, off int64) (n int, err error) {
	// memorize place
	mi, mrem, mcur := f.i, f.rem, f.curSector
	_, err = f.Seek(off, 0)
	if err == nil {
		n, err = f.Read(p)
	}
	f.i, f.rem, f.curSector = mi, mrem, mcur
	return n, err
}

// WriteAt reads p bytes at offset off from start of file. Does not affect seek place for other reads/writes.
func (f *File) WriteAt(p []byte, off int64) (n int, err error) {
	// memorize place
	mi, mrem, mcur := f.i, f.rem, f.curSector
	_, err = f.Seek(off, 0)
	if err == nil {
		n, err = f.Write(p)
	}
	f.i, f.rem, f.curSector = mi, mrem, mcur
	return n, err
}

// Seek sets the offset for the next Read or Write to offset, interpreted according to whence: 0 means relative to the
// start of the file, 1 means relative to the current offset, and 2 means relative to the end. Seek returns the new
// offset relative to the start of the file and an error, if any.
func (f *File) Seek(offset int64, whence int) (int64, error) {
	var abs int64
	switch whence {
	default:
		return 0, Error{ErrSeek, "invalid whence", int64(whence)}
	case 0:
		abs = offset
	case 1:
		abs = f.i + offset
	case 2:
		abs = f.Size - offset
	}
	switch {
	case abs < 0:
		return f.i, Error{ErrSeek, "can't seek before start of File", abs}
	case abs >= f.Size:
		return f.i, Error{ErrSeek, "can't seek past File length", abs}
	case abs == f.i:
		return abs, nil
	case abs > f.i:
		t := f.i
		f.i = abs
		return f.i, f.seek(abs - t)
	}
	if f.rem >= f.i-abs {
		f.rem = f.rem - (f.i - abs)
		f.i = abs
		return f.i, nil
	}
	f.rem = 0
	f.curSector = f.startingSectorLoc
	f.i = abs
	return f.i, f.seek(abs)
}

func (f *File) seek(sz int64) error {
	// calculate ministream and sector size
	var mini bool
	var ss int64
	if f.Size < miniStreamCutoffSize {
		mini = true
		ss = 64
	} else {
		ss = int64(f.r.sectorSize)
	}

	var j int64
	var err error
	// if we have a remainder in the current sector, use it first
	if f.rem > 0 {
		if ss-f.rem <= sz {
			f.curSector, err = f.r.findNext(f.curSector, mini)
			if err != nil {
				return err
			}
			j += ss - f.rem
			f.rem = 0
			if j == sz {
				return nil
			}
		} else {
			f.rem += sz
			return nil
		}
		if f.curSector == endOfChain {
			return Error{ErrRead, "unexpected early end of chain", int64(f.curSector)}
		}
	}

	for {
		// check if we are at the last sector
		if sz-j < ss {
			f.rem = sz - j
			return nil
		} else {
			j += ss
			f.curSector, err = f.r.findNext(f.curSector, mini)
			if err != nil {
				return err
			}
			// we might be at the last sector if there is no remainder, if so can return
			if j == sz {
				return nil
			}
		}
	}
}

// return offsets and lengths for read or write
func (f *File) stream(sz int) ([][2]int64, error) {
	// calculate ministream, cap for sector slice, and sector size
	var mini bool
	var l int
	var ss int64
	if f.Size < miniStreamCutoffSize {
		mini = true
		l = sz/64 + 2
		ss = 64
	} else {
		l = sz/int(f.r.sectorSize) + 2
		ss = int64(f.r.sectorSize)
	}

	sectors := make([][2]int64, 0, l)
	var i, j int

	// if we have a remainder from a previous read, use it first
	if f.rem > 0 {
		offset, err := f.r.getOffset(f.curSector, mini)
		if err != nil {
			return nil, err
		}
		if ss-f.rem >= int64(sz) {
			sectors = append(sectors, [2]int64{offset + f.rem, int64(sz)})
		} else {
			sectors = append(sectors, [2]int64{offset + f.rem, ss - f.rem})
		}
		if ss-f.rem <= int64(sz) {
			f.curSector, err = f.r.findNext(f.curSector, mini)
			if err != nil {
				return nil, err
			}
			j += int(ss - f.rem)
			f.rem = 0
		} else {
			f.rem += int64(sz)
		}
		if sectors[0][1] == int64(sz) {
			return sectors, nil
		}
		if f.curSector == endOfChain {
			return nil, Error{ErrRead, "unexpected early end of chain", int64(f.curSector)}
		}
		i++
	}

	for {
		// emergency brake!
		if i >= cap(sectors) {
			return nil, Error{ErrRead, "index overruns sector length", int64(i)}
		}
		// grab the next offset
		offset, err := f.r.getOffset(f.curSector, mini)
		if err != nil {
			return nil, err
		}
		// check if we are at the last sector
		if sz-j < int(ss) {
			sectors = append(sectors, [2]int64{offset, int64(sz - j)})
			f.rem = int64(sz - j)
			return compressChain(sectors), nil
		} else {
			sectors = append(sectors, [2]int64{offset, ss})
			j += int(ss)
			f.curSector, err = f.r.findNext(f.curSector, mini)
			if err != nil {
				return nil, err
			}
			// we might be at the last sector if there is no remainder, if so can return
			if j == sz {
				return compressChain(sectors), nil
			}
		}
		i++
	}
}

func compressChain(locs [][2]int64) [][2]int64 {
	l := len(locs)
	for i, x := 0, 0; i < l && x+1 < len(locs); i++ {
		if locs[x][0]+locs[x][1] == locs[x+1][0] {
			locs[x][1] = locs[x][1] + locs[x+1][1]
			for j := range locs[x+1 : len(locs)-1] {
				locs[x+1+j] = locs[j+x+2]
			}
			locs = locs[:len(locs)-1]
		} else {
			x += 1
		}
	}
	return locs
}
