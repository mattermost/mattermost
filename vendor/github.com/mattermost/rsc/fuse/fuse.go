// Copyright 2011 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Adapted from Plan 9 from User Space's src/cmd/9pfuse/fuse.c,
// which carries this notice:
//
// The files in this directory are subject to the following license.
// 
// The author of this software is Russ Cox.
// 
//         Copyright (c) 2006 Russ Cox
// 
// Permission to use, copy, modify, and distribute this software for any
// purpose without fee is hereby granted, provided that this entire notice
// is included in all copies of any software which is or includes a copy
// or modification of this software and in all copies of the supporting
// documentation for such software.
// 
// THIS SOFTWARE IS BEING PROVIDED "AS IS", WITHOUT ANY EXPRESS OR IMPLIED
// WARRANTY.  IN PARTICULAR, THE AUTHOR MAKES NO REPRESENTATION OR WARRANTY
// OF ANY KIND CONCERNING THE MERCHANTABILITY OF THIS SOFTWARE OR ITS
// FITNESS FOR ANY PARTICULAR PURPOSE.

// Package fuse enables writing FUSE file systems on FreeBSD, Linux, and OS X.
//
// On OS X, it requires OSXFUSE (http://osxfuse.github.com/).
//
// There are two approaches to writing a FUSE file system.  The first is to speak
// the low-level message protocol, reading from a Conn using ReadRequest and
// writing using the various Respond methods.  This approach is closest to
// the actual interaction with the kernel and can be the simplest one in contexts
// such as protocol translators.
//
// Servers of synthesized file systems tend to share common bookkeeping
// abstracted away by the second approach, which is to call the Conn's
// Serve method to serve the FUSE protocol using
// an implementation of the service methods in the interfaces
// FS (file system), Node (file or directory), and Handle (opened file or directory).
// There are a daunting number of such methods that can be written,
// but few are required.
// The specific methods are described in the documentation for those interfaces.
//
// The hellofs subdirectory contains a simple illustration of the ServeFS approach.
//
// Service Methods
//
// The required and optional methods for the FS, Node, and Handle interfaces
// have the general form
//
//	Op(req *OpRequest, resp *OpResponse, intr Intr) Error
//
// where Op is the name of a FUSE operation.  Op reads request parameters
// from req and writes results to resp.  An operation whose only result is
// the error result omits the resp parameter.  Multiple goroutines may call
// service methods simultaneously; the methods being called are responsible
// for appropriate synchronization.
//
// Interrupted Operations
//
// In some file systems, some operations
// may take an undetermined amount of time.  For example, a Read waiting for
// a network message or a matching Write might wait indefinitely.  If the request
// is cancelled and no longer needed, the package will close intr, a chan struct{}.
// Blocking operations should select on a receive from intr and attempt to
// abort the operation early if the receive succeeds (meaning the channel is closed).
// To indicate that the operation failed because it was aborted, return fuse.EINTR.
//
// If an operation does not block for an indefinite amount of time, the intr parameter
// can be ignored.
//
// Authentication
//
// All requests types embed a Header, meaning that the method can inspect
// req.Pid, req.Uid, and req.Gid as necessary to implement permission checking.
// Alternately, XXX.
//
// Mount Options
//
// XXX
// 
package fuse

// BUG(rsc): The mount code for FreeBSD has not been written yet.

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"runtime"
	"sync"
	"syscall"
	"time"
	"unsafe"
)

// A Conn represents a connection to a mounted FUSE file system.
type Conn struct {
	fd  int
	buf []byte
	wio sync.Mutex

	serveConn
}

// Mount mounts a new FUSE connection on the named directory
// and returns a connection for reading and writing FUSE messages.
func Mount(dir string) (*Conn, error) {
	// TODO(rsc): mount options (...string?)
	fd, errstr := mount(dir)
	if errstr != "" {
		return nil, errors.New(errstr)
	}

	return &Conn{fd: fd}, nil
}

// A Request represents a single FUSE request received from the kernel.
// Use a type switch to determine the specific kind.
// A request of unrecognized type will have concrete type *Header.
type Request interface {
	// Hdr returns the Header associated with this request.
	Hdr() *Header

	// RespondError responds to the request with the given error.
	RespondError(Error)

	String() string

	// handle returns the HandleID for the request, or 0.
	handle() HandleID
}

// A RequestID identifies an active FUSE request.
type RequestID uint64

// A NodeID is a number identifying a directory or file.
// It must be unique among IDs returned in LookupResponses
// that have not yet been forgotten by ForgetRequests.
type NodeID uint64

// A HandleID is a number identifying an open directory or file.
// It only needs to be unique while the directory or file is open.
type HandleID uint64

// The RootID identifies the root directory of a FUSE file system.
const RootID NodeID = rootID

// A Header describes the basic information sent in every request.
type Header struct {
	Conn *Conn     // connection this request was received on
	ID   RequestID // unique ID for request
	Node NodeID    // file or directory the request is about
	Uid  uint32    // user ID of process making request
	Gid  uint32    // group ID of process making request
	Pid  uint32    // process ID of process making request
}

func (h *Header) String() string {
	return fmt.Sprintf("ID=%#x Node=%#x Uid=%d Gid=%d Pid=%d", h.ID, h.Node, h.Uid, h.Gid, h.Pid)
}

func (h *Header) Hdr() *Header {
	return h
}

func (h *Header) handle() HandleID {
	return 0
}

// An Error is a FUSE error.
type Error interface {
	errno() int32
}

const (
	// ENOSYS indicates that the call is not supported.
	ENOSYS = Errno(syscall.ENOSYS)

	// ESTALE is used by Serve to respond to violations of the FUSE protocol.
	ESTALE = Errno(syscall.ESTALE)

	ENOENT = Errno(syscall.ENOENT)
	EIO    = Errno(syscall.EIO)
	EPERM  = Errno(syscall.EPERM)
)

type errno int

func (e errno) errno() int32 {
	return int32(e)
}

// Errno implements Error using a syscall.Errno.
type Errno syscall.Errno

func (e Errno) errno() int32 {
	return int32(e)
}

func (e Errno) String() string {
	return syscall.Errno(e).Error()
}

func (h *Header) RespondError(err Error) {
	// FUSE uses negative errors!
	// TODO: File bug report against OSXFUSE: positive error causes kernel panic.
	out := &outHeader{Error: -err.errno(), Unique: uint64(h.ID)}
	h.Conn.respond(out, unsafe.Sizeof(*out))
}

var maxWrite = syscall.Getpagesize()
var bufSize = 4096 + maxWrite

// a message represents the bytes of a single FUSE message
type message struct {
	conn *Conn
	buf  []byte    // all bytes
	hdr  *inHeader // header
	off  int       // offset for reading additional fields
}

func newMessage(c *Conn) *message {
	m := &message{conn: c, buf: make([]byte, bufSize)}
	m.hdr = (*inHeader)(unsafe.Pointer(&m.buf[0]))
	return m
}

func (m *message) len() uintptr {
	return uintptr(len(m.buf) - m.off)
}

func (m *message) data() unsafe.Pointer {
	var p unsafe.Pointer
	if m.off < len(m.buf) {
		p = unsafe.Pointer(&m.buf[m.off])
	}
	return p
}

func (m *message) bytes() []byte {
	return m.buf[m.off:]
}

func (m *message) Header() Header {
	h := m.hdr
	return Header{Conn: m.conn, ID: RequestID(h.Unique), Node: NodeID(h.Nodeid), Uid: h.Uid, Gid: h.Gid, Pid: h.Pid}
}

// fileMode returns a Go os.FileMode from a Unix mode.
func fileMode(unixMode uint32) os.FileMode {
	mode := os.FileMode(unixMode & 0777)
	switch unixMode & syscall.S_IFMT {
	case syscall.S_IFREG:
		// nothing
	case syscall.S_IFDIR:
		mode |= os.ModeDir
	case syscall.S_IFCHR:
		mode |= os.ModeCharDevice | os.ModeDevice
	case syscall.S_IFBLK:
		mode |= os.ModeDevice
	case syscall.S_IFIFO:
		mode |= os.ModeNamedPipe
	case syscall.S_IFLNK:
		mode |= os.ModeSymlink
	case syscall.S_IFSOCK:
		mode |= os.ModeSocket
	default:
		// no idea
		mode |= os.ModeDevice
	}
	if unixMode&syscall.S_ISUID != 0 {
		mode |= os.ModeSetuid
	}
	if unixMode&syscall.S_ISGID != 0 {
		mode |= os.ModeSetgid
	}
	return mode
}

func (c *Conn) ReadRequest() (Request, error) {
	// TODO: Some kind of buffer reuse.
	m := newMessage(c)
	n, err := syscall.Read(c.fd, m.buf)
	if err != nil && err != syscall.ENODEV {
		return nil, err
	}
	if n <= 0 {
		return nil, io.EOF
	}
	m.buf = m.buf[:n]

	if n < inHeaderSize {
		return nil, errors.New("fuse: message too short")
	}

	// FreeBSD FUSE sends a short length in the header
	// for FUSE_INIT even though the actual read length is correct.
	if n == inHeaderSize+initInSize && m.hdr.Opcode == opInit && m.hdr.Len < uint32(n) {
		m.hdr.Len = uint32(n)
	}

	// OSXFUSE sometimes sends the wrong m.hdr.Len in a FUSE_WRITE message.
	if m.hdr.Len < uint32(n) && m.hdr.Len >= uint32(unsafe.Sizeof(writeIn{})) && m.hdr.Opcode == opWrite {
		m.hdr.Len = uint32(n)
	}

	if m.hdr.Len != uint32(n) {
		return nil, fmt.Errorf("fuse: read %d opcode %d but expected %d", n, m.hdr.Opcode, m.hdr.Len)
	}

	m.off = inHeaderSize

	// Convert to data structures.
	// Do not trust kernel to hand us well-formed data.
	var req Request
	switch m.hdr.Opcode {
	default:
		println("No opcode", m.hdr.Opcode)
		goto unrecognized

	case opLookup:
		buf := m.bytes()
		n := len(buf)
		if n == 0 || buf[n-1] != '\x00' {
			goto corrupt
		}
		req = &LookupRequest{
			Header: m.Header(),
			Name:   string(buf[:n-1]),
		}

	case opForget:
		in := (*forgetIn)(m.data())
		if m.len() < unsafe.Sizeof(*in) {
			goto corrupt
		}
		req = &ForgetRequest{
			Header: m.Header(),
			N:      in.Nlookup,
		}

	case opGetattr:
		req = &GetattrRequest{
			Header: m.Header(),
		}

	case opSetattr:
		in := (*setattrIn)(m.data())
		if m.len() < unsafe.Sizeof(*in) {
			goto corrupt
		}
		req = &SetattrRequest{
			Header:   m.Header(),
			Valid:    SetattrValid(in.Valid),
			Handle:   HandleID(in.Fh),
			Size:     in.Size,
			Atime:    time.Unix(int64(in.Atime), int64(in.AtimeNsec)),
			Mtime:    time.Unix(int64(in.Mtime), int64(in.MtimeNsec)),
			Mode:     fileMode(in.Mode),
			Uid:      in.Uid,
			Gid:      in.Gid,
			Bkuptime: in.BkupTime(),
			Chgtime:  in.Chgtime(),
			Flags:    in.Flags(),
		}

	case opReadlink:
		if len(m.bytes()) > 0 {
			goto corrupt
		}
		req = &ReadlinkRequest{
			Header: m.Header(),
		}

	case opSymlink:
		// m.bytes() is "newName\0target\0"
		names := m.bytes()
		if len(names) == 0 || names[len(names)-1] != 0 {
			goto corrupt
		}
		i := bytes.IndexByte(names, '\x00')
		if i < 0 {
			goto corrupt
		}
		newName, target := names[0:i], names[i+1:len(names)-1]
		req = &SymlinkRequest{
			Header:  m.Header(),
			NewName: string(newName),
			Target:  string(target),
		}

	case opLink:
		in := (*linkIn)(m.data())
		if m.len() < unsafe.Sizeof(*in) {
			goto corrupt
		}
		newName := m.bytes()[unsafe.Sizeof(*in):]
		if len(newName) < 2 || newName[len(newName)-1] != 0 {
			goto corrupt
		}
		newName = newName[:len(newName)-1]
		req = &LinkRequest{
			Header:  m.Header(),
			OldNode: NodeID(in.Oldnodeid),
			NewName: string(newName),
		}

	case opMknod:
		in := (*mknodIn)(m.data())
		if m.len() < unsafe.Sizeof(*in) {
			goto corrupt
		}
		name := m.bytes()[unsafe.Sizeof(*in):]
		if len(name) < 2 || name[len(name)-1] != '\x00' {
			goto corrupt
		}
		name = name[:len(name)-1]
		req = &MknodRequest{
			Header: m.Header(),
			Mode:   fileMode(in.Mode),
			Rdev:   in.Rdev,
			Name:   string(name),
		}

	case opMkdir:
		in := (*mkdirIn)(m.data())
		if m.len() < unsafe.Sizeof(*in) {
			goto corrupt
		}
		name := m.bytes()[unsafe.Sizeof(*in):]
		i := bytes.IndexByte(name, '\x00')
		if i < 0 {
			goto corrupt
		}
		req = &MkdirRequest{
			Header: m.Header(),
			Name:   string(name[:i]),
			Mode:   fileMode(in.Mode) | os.ModeDir,
		}

	case opUnlink, opRmdir:
		buf := m.bytes()
		n := len(buf)
		if n == 0 || buf[n-1] != '\x00' {
			goto corrupt
		}
		req = &RemoveRequest{
			Header: m.Header(),
			Name:   string(buf[:n-1]),
			Dir:    m.hdr.Opcode == opRmdir,
		}

	case opRename:
		in := (*renameIn)(m.data())
		if m.len() < unsafe.Sizeof(*in) {
			goto corrupt
		}
		newDirNodeID := NodeID(in.Newdir)
		oldNew := m.bytes()[unsafe.Sizeof(*in):]
		// oldNew should be "old\x00new\x00"
		if len(oldNew) < 4 {
			goto corrupt
		}
		if oldNew[len(oldNew)-1] != '\x00' {
			goto corrupt
		}
		i := bytes.IndexByte(oldNew, '\x00')
		if i < 0 {
			goto corrupt
		}
		oldName, newName := string(oldNew[:i]), string(oldNew[i+1:len(oldNew)-1])
		// log.Printf("RENAME: newDirNode = %d; old = %q, new = %q", newDirNodeID, oldName, newName)
		req = &RenameRequest{
			Header:  m.Header(),
			NewDir:  newDirNodeID,
			OldName: oldName,
			NewName: newName,
		}

	case opOpendir, opOpen:
		in := (*openIn)(m.data())
		if m.len() < unsafe.Sizeof(*in) {
			goto corrupt
		}
		req = &OpenRequest{
			Header: m.Header(),
			Dir:    m.hdr.Opcode == opOpendir,
			Flags:  in.Flags,
			Mode:   fileMode(in.Mode),
		}

	case opRead, opReaddir:
		in := (*readIn)(m.data())
		if m.len() < unsafe.Sizeof(*in) {
			goto corrupt
		}
		req = &ReadRequest{
			Header: m.Header(),
			Dir:    m.hdr.Opcode == opReaddir,
			Handle: HandleID(in.Fh),
			Offset: int64(in.Offset),
			Size:   int(in.Size),
		}

	case opWrite:
		in := (*writeIn)(m.data())
		if m.len() < unsafe.Sizeof(*in) {
			goto corrupt
		}
		r := &WriteRequest{
			Header: m.Header(),
			Handle: HandleID(in.Fh),
			Offset: int64(in.Offset),
			Flags:  WriteFlags(in.WriteFlags),
		}
		buf := m.bytes()[unsafe.Sizeof(*in):]
		if uint32(len(buf)) < in.Size {
			goto corrupt
		}
		r.Data = buf
		req = r

	case opStatfs:
		req = &StatfsRequest{
			Header: m.Header(),
		}

	case opRelease, opReleasedir:
		in := (*releaseIn)(m.data())
		if m.len() < unsafe.Sizeof(*in) {
			goto corrupt
		}
		req = &ReleaseRequest{
			Header:       m.Header(),
			Dir:          m.hdr.Opcode == opReleasedir,
			Handle:       HandleID(in.Fh),
			Flags:        in.Flags,
			ReleaseFlags: ReleaseFlags(in.ReleaseFlags),
			LockOwner:    in.LockOwner,
		}

	case opFsync:
		in := (*fsyncIn)(m.data())
		if m.len() < unsafe.Sizeof(*in) {
			goto corrupt
		}
		req = &FsyncRequest{
			Header: m.Header(),
			Handle: HandleID(in.Fh),
			Flags:  in.FsyncFlags,
		}

	case opSetxattr:
		var size uint32
		var r *SetxattrRequest
		if runtime.GOOS == "darwin" {
			in := (*setxattrInOSX)(m.data())
			if m.len() < unsafe.Sizeof(*in) {
				goto corrupt
			}
			r = &SetxattrRequest{
				Flags:    in.Flags,
				Position: in.Position,
			}
			size = in.Size
			m.off += int(unsafe.Sizeof(*in))
		} else {
			in := (*setxattrIn)(m.data())
			if m.len() < unsafe.Sizeof(*in) {
				goto corrupt
			}
			r = &SetxattrRequest{}
			size = in.Size
			m.off += int(unsafe.Sizeof(*in))
		}
		r.Header = m.Header()
		name := m.bytes()
		i := bytes.IndexByte(name, '\x00')
		if i < 0 {
			goto corrupt
		}
		r.Name = string(name[:i])
		r.Xattr = name[i+1:]
		if uint32(len(r.Xattr)) < size {
			goto corrupt
		}
		r.Xattr = r.Xattr[:size]
		req = r

	case opGetxattr:
		if runtime.GOOS == "darwin" {
			in := (*getxattrInOSX)(m.data())
			if m.len() < unsafe.Sizeof(*in) {
				goto corrupt
			}
			req = &GetxattrRequest{
				Header:   m.Header(),
				Size:     in.Size,
				Position: in.Position,
			}
		} else {
			in := (*getxattrIn)(m.data())
			if m.len() < unsafe.Sizeof(*in) {
				goto corrupt
			}
			req = &GetxattrRequest{
				Header: m.Header(),
				Size:   in.Size,
			}
		}

	case opListxattr:
		if runtime.GOOS == "darwin" {
			in := (*getxattrInOSX)(m.data())
			if m.len() < unsafe.Sizeof(*in) {
				goto corrupt
			}
			req = &ListxattrRequest{
				Header:   m.Header(),
				Size:     in.Size,
				Position: in.Position,
			}
		} else {
			in := (*getxattrIn)(m.data())
			if m.len() < unsafe.Sizeof(*in) {
				goto corrupt
			}
			req = &ListxattrRequest{
				Header: m.Header(),
				Size:   in.Size,
			}
		}

	case opRemovexattr:
		buf := m.bytes()
		n := len(buf)
		if n == 0 || buf[n-1] != '\x00' {
			goto corrupt
		}
		req = &RemovexattrRequest{
			Header: m.Header(),
			Name:   string(buf[:n-1]),
		}

	case opFlush:
		in := (*flushIn)(m.data())
		if m.len() < unsafe.Sizeof(*in) {
			goto corrupt
		}
		req = &FlushRequest{
			Header:    m.Header(),
			Handle:    HandleID(in.Fh),
			Flags:     in.FlushFlags,
			LockOwner: in.LockOwner,
		}

	case opInit:
		in := (*initIn)(m.data())
		if m.len() < unsafe.Sizeof(*in) {
			goto corrupt
		}
		req = &InitRequest{
			Header:       m.Header(),
			Major:        in.Major,
			Minor:        in.Minor,
			MaxReadahead: in.MaxReadahead,
			Flags:        InitFlags(in.Flags),
		}

	case opFsyncdir:
		panic("opFsyncdir")
	case opGetlk:
		panic("opGetlk")
	case opSetlk:
		panic("opSetlk")
	case opSetlkw:
		panic("opSetlkw")

	case opAccess:
		in := (*accessIn)(m.data())
		if m.len() < unsafe.Sizeof(*in) {
			goto corrupt
		}
		req = &AccessRequest{
			Header: m.Header(),
			Mask:   in.Mask,
		}

	case opCreate:
		in := (*openIn)(m.data())
		if m.len() < unsafe.Sizeof(*in) {
			goto corrupt
		}
		name := m.bytes()[unsafe.Sizeof(*in):]
		i := bytes.IndexByte(name, '\x00')
		if i < 0 {
			goto corrupt
		}
		req = &CreateRequest{
			Header: m.Header(),
			Flags:  in.Flags,
			Mode:   fileMode(in.Mode),
			Name:   string(name[:i]),
		}

	case opInterrupt:
		panic("opInterrupt")
	case opBmap:
		panic("opBmap")

	case opDestroy:
		req = &DestroyRequest{
			Header: m.Header(),
		}

	// OS X
	case opSetvolname:
		panic("opSetvolname")
	case opGetxtimes:
		panic("opGetxtimes")
	case opExchange:
		panic("opExchange")
	}

	return req, nil

corrupt:
	println("malformed message")
	return nil, fmt.Errorf("fuse: malformed message")

unrecognized:
	// Unrecognized message.
	// Assume higher-level code will send a "no idea what you mean" error.
	h := m.Header()
	return &h, nil
}

func (c *Conn) respond(out *outHeader, n uintptr) {
	c.wio.Lock()
	defer c.wio.Unlock()
	out.Len = uint32(n)
	msg := (*[1 << 30]byte)(unsafe.Pointer(out))[:n]
	nn, err := syscall.Write(c.fd, msg)
	if nn != len(msg) || err != nil {
		log.Printf("RESPOND WRITE: %d %v", nn, err)
		log.Printf("with stack: %s", stack())
	}
}

func (c *Conn) respondData(out *outHeader, n uintptr, data []byte) {
	c.wio.Lock()
	defer c.wio.Unlock()
	// TODO: use writev
	out.Len = uint32(n + uintptr(len(data)))
	msg := make([]byte, out.Len)
	copy(msg, (*[1 << 30]byte)(unsafe.Pointer(out))[:n])
	copy(msg[n:], data)
	syscall.Write(c.fd, msg)
}

// An InitRequest is the first request sent on a FUSE file system.
type InitRequest struct {
	Header
	Major        uint32
	Minor        uint32
	MaxReadahead uint32
	Flags        InitFlags
}

func (r *InitRequest) String() string {
	return fmt.Sprintf("Init [%s] %d.%d ra=%d fl=%v", &r.Header, r.Major, r.Minor, r.MaxReadahead, r.Flags)
}

// An InitResponse is the response to an InitRequest.
type InitResponse struct {
	MaxReadahead uint32
	Flags        InitFlags
	MaxWrite     uint32
}

func (r *InitResponse) String() string {
	return fmt.Sprintf("Init %+v", *r)
}

// Respond replies to the request with the given response.
func (r *InitRequest) Respond(resp *InitResponse) {
	out := &initOut{
		outHeader:    outHeader{Unique: uint64(r.ID)},
		Major:        kernelVersion,
		Minor:        kernelMinorVersion,
		MaxReadahead: resp.MaxReadahead,
		Flags:        uint32(resp.Flags),
		MaxWrite:     resp.MaxWrite,
	}
	r.Conn.respond(&out.outHeader, unsafe.Sizeof(*out))
}

// A StatfsRequest requests information about the mounted file system.
type StatfsRequest struct {
	Header
}

func (r *StatfsRequest) String() string {
	return fmt.Sprintf("Statfs [%s]\n", &r.Header)
}

// Respond replies to the request with the given response.
func (r *StatfsRequest) Respond(resp *StatfsResponse) {
	out := &statfsOut{
		outHeader: outHeader{Unique: uint64(r.ID)},
		St: kstatfs{
			Blocks:  resp.Blocks,
			Bfree:   resp.Bfree,
			Bavail:  resp.Bavail,
			Files:   resp.Files,
			Bsize:   resp.Bsize,
			Namelen: resp.Namelen,
			Frsize:  resp.Frsize,
		},
	}
	r.Conn.respond(&out.outHeader, unsafe.Sizeof(*out))
}

// A StatfsResponse is the response to a StatfsRequest.
type StatfsResponse struct {
	Blocks  uint64 // Total data blocks in file system.
	Bfree   uint64 // Free blocks in file system.
	Bavail  uint64 // Free blocks in file system if you're not root.
	Files   uint64 // Total files in file system.
	Ffree   uint64 // Free files in file system.
	Bsize   uint32 // Block size
	Namelen uint32 // Maximum file name length?
	Frsize  uint32 // ?
}

func (r *StatfsResponse) String() string {
	return fmt.Sprintf("Statfs %+v", *r)
}

// An AccessRequest asks whether the file can be accessed
// for the purpose specified by the mask.
type AccessRequest struct {
	Header
	Mask uint32
}

func (r *AccessRequest) String() string {
	return fmt.Sprintf("Access [%s] mask=%#x", &r.Header, r.Mask)
}

// Respond replies to the request indicating that access is allowed.
// To deny access, use RespondError.
func (r *AccessRequest) Respond() {
	out := &outHeader{Unique: uint64(r.ID)}
	r.Conn.respond(out, unsafe.Sizeof(*out))
}

// An Attr is the metadata for a single file or directory.
type Attr struct {
	Inode  uint64      // inode number
	Size   uint64      // size in bytes
	Blocks uint64      // size in blocks
	Atime  time.Time   // time of last access
	Mtime  time.Time   // time of last modification
	Ctime  time.Time   // time of last inode change
	Crtime time.Time   // time of creation (OS X only)
	Mode   os.FileMode // file mode
	Nlink  uint32      // number of links
	Uid    uint32      // owner uid
	Gid    uint32      // group gid
	Rdev   uint32      // device numbers
	Flags  uint32      // chflags(2) flags (OS X only)
}

func unix(t time.Time) (sec uint64, nsec uint32) {
	nano := t.UnixNano()
	sec = uint64(nano / 1e9)
	nsec = uint32(nano % 1e9)
	return
}

func (a *Attr) attr() (out attr) {
	out.Ino = a.Inode
	out.Size = a.Size
	out.Blocks = a.Blocks
	out.Atime, out.AtimeNsec = unix(a.Atime)
	out.Mtime, out.MtimeNsec = unix(a.Mtime)
	out.Ctime, out.CtimeNsec = unix(a.Ctime)
	out.SetCrtime(unix(a.Crtime))
	out.Mode = uint32(a.Mode) & 0777
	switch {
	default:
		out.Mode |= syscall.S_IFREG
	case a.Mode&os.ModeDir != 0:
		out.Mode |= syscall.S_IFDIR
	case a.Mode&os.ModeDevice != 0:
		if a.Mode&os.ModeCharDevice != 0 {
			out.Mode |= syscall.S_IFCHR
		} else {
			out.Mode |= syscall.S_IFBLK
		}
	case a.Mode&os.ModeNamedPipe != 0:
		out.Mode |= syscall.S_IFIFO
	case a.Mode&os.ModeSymlink != 0:
		out.Mode |= syscall.S_IFLNK
	case a.Mode&os.ModeSocket != 0:
		out.Mode |= syscall.S_IFSOCK
	}
	if a.Mode&os.ModeSetuid != 0 {
		out.Mode |= syscall.S_ISUID
	}
	if a.Mode&os.ModeSetgid != 0 {
		out.Mode |= syscall.S_ISGID
	}
	out.Nlink = a.Nlink
	if out.Nlink < 1 {
		out.Nlink = 1
	}
	out.Uid = a.Uid
	out.Gid = a.Gid
	out.Rdev = a.Rdev
	out.SetFlags(a.Flags)

	return
}

// A GetattrRequest asks for the metadata for the file denoted by r.Node.
type GetattrRequest struct {
	Header
}

func (r *GetattrRequest) String() string {
	return fmt.Sprintf("Getattr [%s]", &r.Header)
}

// Respond replies to the request with the given response.
func (r *GetattrRequest) Respond(resp *GetattrResponse) {
	out := &attrOut{
		outHeader:     outHeader{Unique: uint64(r.ID)},
		AttrValid:     uint64(resp.AttrValid / time.Second),
		AttrValidNsec: uint32(resp.AttrValid % time.Second / time.Nanosecond),
		Attr:          resp.Attr.attr(),
	}
	r.Conn.respond(&out.outHeader, unsafe.Sizeof(*out))
}

// A GetattrResponse is the response to a GetattrRequest.
type GetattrResponse struct {
	AttrValid time.Duration // how long Attr can be cached
	Attr      Attr          // file attributes
}

func (r *GetattrResponse) String() string {
	return fmt.Sprintf("Getattr %+v", *r)
}

// A GetxattrRequest asks for the extended attributes associated with r.Node.
type GetxattrRequest struct {
	Header
	Size     uint32 // maximum size to return
	Position uint32 // offset within extended attributes
}

func (r *GetxattrRequest) String() string {
	return fmt.Sprintf("Getxattr [%s] %d @%d", &r.Header, r.Size, r.Position)
}

// Respond replies to the request with the given response.
func (r *GetxattrRequest) Respond(resp *GetxattrResponse) {
	out := &getxattrOut{
		outHeader: outHeader{Unique: uint64(r.ID)},
		Size:      uint32(len(resp.Xattr)),
	}
	r.Conn.respondData(&out.outHeader, unsafe.Sizeof(*out), resp.Xattr)
}

// A GetxattrResponse is the response to a GetxattrRequest.
type GetxattrResponse struct {
	Xattr []byte
}

func (r *GetxattrResponse) String() string {
	return fmt.Sprintf("Getxattr %x", r.Xattr)
}

// A ListxattrRequest asks to list the extended attributes associated with r.Node.
type ListxattrRequest struct {
	Header
	Size     uint32 // maximum size to return
	Position uint32 // offset within attribute list
}

func (r *ListxattrRequest) String() string {
	return fmt.Sprintf("Listxattr [%s] %d @%d", &r.Header, r.Size, r.Position)
}

// Respond replies to the request with the given response.
func (r *ListxattrRequest) Respond(resp *ListxattrResponse) {
	out := &getxattrOut{
		outHeader: outHeader{Unique: uint64(r.ID)},
		Size:      uint32(len(resp.Xattr)),
	}
	r.Conn.respondData(&out.outHeader, unsafe.Sizeof(*out), resp.Xattr)
}

// A ListxattrResponse is the response to a ListxattrRequest.
type ListxattrResponse struct {
	Xattr []byte
}

func (r *ListxattrResponse) String() string {
	return fmt.Sprintf("Listxattr %x", r.Xattr)
}

// A RemovexattrRequest asks to remove an extended attribute associated with r.Node.
type RemovexattrRequest struct {
	Header
	Name string // name of extended attribute
}

func (r *RemovexattrRequest) String() string {
	return fmt.Sprintf("Removexattr [%s] %q", &r.Header, r.Name)
}

// Respond replies to the request, indicating that the attribute was removed.
func (r *RemovexattrRequest) Respond() {
	out := &outHeader{Unique: uint64(r.ID)}
	r.Conn.respond(out, unsafe.Sizeof(*out))
}

// A SetxattrRequest asks to set an extended attribute associated with a file.
type SetxattrRequest struct {
	Header
	Flags    uint32
	Position uint32 // OS X only
	Name     string
	Xattr    []byte
}

func (r *SetxattrRequest) String() string {
	return fmt.Sprintf("Setxattr [%s] %q %x fl=%v @%#x", &r.Header, r.Name, r.Xattr, r.Flags, r.Position)
}

// Respond replies to the request, indicating that the extended attribute was set.
func (r *SetxattrRequest) Respond() {
	out := &outHeader{Unique: uint64(r.ID)}
	r.Conn.respond(out, unsafe.Sizeof(*out))
}

// A LookupRequest asks to look up the given name in the directory named by r.Node.
type LookupRequest struct {
	Header
	Name string
}

func (r *LookupRequest) String() string {
	return fmt.Sprintf("Lookup [%s] %q", &r.Header, r.Name)
}

// Respond replies to the request with the given response.
func (r *LookupRequest) Respond(resp *LookupResponse) {
	out := &entryOut{
		outHeader:      outHeader{Unique: uint64(r.ID)},
		Nodeid:         uint64(resp.Node),
		Generation:     resp.Generation,
		EntryValid:     uint64(resp.EntryValid / time.Second),
		EntryValidNsec: uint32(resp.EntryValid % time.Second / time.Nanosecond),
		AttrValid:      uint64(resp.AttrValid / time.Second),
		AttrValidNsec:  uint32(resp.AttrValid % time.Second / time.Nanosecond),
		Attr:           resp.Attr.attr(),
	}
	r.Conn.respond(&out.outHeader, unsafe.Sizeof(*out))
}

// A LookupResponse is the response to a LookupRequest.
type LookupResponse struct {
	Node       NodeID
	Generation uint64
	EntryValid time.Duration
	AttrValid  time.Duration
	Attr       Attr
}

func (r *LookupResponse) String() string {
	return fmt.Sprintf("Lookup %+v", *r)
}

// An OpenRequest asks to open a file or directory
type OpenRequest struct {
	Header
	Dir   bool // is this Opendir?
	Flags uint32
	Mode  os.FileMode
}

func (r *OpenRequest) String() string {
	return fmt.Sprintf("Open [%s] dir=%v fl=%v mode=%v", &r.Header, r.Dir, r.Flags, r.Mode)
}

// Respond replies to the request with the given response.
func (r *OpenRequest) Respond(resp *OpenResponse) {
	out := &openOut{
		outHeader: outHeader{Unique: uint64(r.ID)},
		Fh:        uint64(resp.Handle),
		OpenFlags: uint32(resp.Flags),
	}
	r.Conn.respond(&out.outHeader, unsafe.Sizeof(*out))
}

// A OpenResponse is the response to a OpenRequest.
type OpenResponse struct {
	Handle HandleID
	Flags  OpenFlags
}

func (r *OpenResponse) String() string {
	return fmt.Sprintf("Open %+v", *r)
}

// A CreateRequest asks to create and open a file (not a directory).
type CreateRequest struct {
	Header
	Name  string
	Flags uint32
	Mode  os.FileMode
}

func (r *CreateRequest) String() string {
	return fmt.Sprintf("Create [%s] %q fl=%v mode=%v", &r.Header, r.Name, r.Flags, r.Mode)
}

// Respond replies to the request with the given response.
func (r *CreateRequest) Respond(resp *CreateResponse) {
	out := &createOut{
		outHeader: outHeader{Unique: uint64(r.ID)},

		Nodeid:         uint64(resp.Node),
		Generation:     resp.Generation,
		EntryValid:     uint64(resp.EntryValid / time.Second),
		EntryValidNsec: uint32(resp.EntryValid % time.Second / time.Nanosecond),
		AttrValid:      uint64(resp.AttrValid / time.Second),
		AttrValidNsec:  uint32(resp.AttrValid % time.Second / time.Nanosecond),
		Attr:           resp.Attr.attr(),

		Fh:        uint64(resp.Handle),
		OpenFlags: uint32(resp.Flags),
	}
	r.Conn.respond(&out.outHeader, unsafe.Sizeof(*out))
}

// A CreateResponse is the response to a CreateRequest.
// It describes the created node and opened handle.
type CreateResponse struct {
	LookupResponse
	OpenResponse
}

func (r *CreateResponse) String() string {
	return fmt.Sprintf("Create %+v", *r)
}

// A MkdirRequest asks to create (but not open) a directory.
type MkdirRequest struct {
	Header
	Name string
	Mode os.FileMode
}

func (r *MkdirRequest) String() string {
	return fmt.Sprintf("Mkdir [%s] %q mode=%v", &r.Header, r.Name, r.Mode)
}

// Respond replies to the request with the given response.
func (r *MkdirRequest) Respond(resp *MkdirResponse) {
	out := &entryOut{
		outHeader:      outHeader{Unique: uint64(r.ID)},
		Nodeid:         uint64(resp.Node),
		Generation:     resp.Generation,
		EntryValid:     uint64(resp.EntryValid / time.Second),
		EntryValidNsec: uint32(resp.EntryValid % time.Second / time.Nanosecond),
		AttrValid:      uint64(resp.AttrValid / time.Second),
		AttrValidNsec:  uint32(resp.AttrValid % time.Second / time.Nanosecond),
		Attr:           resp.Attr.attr(),
	}
	r.Conn.respond(&out.outHeader, unsafe.Sizeof(*out))
}

// A MkdirResponse is the response to a MkdirRequest.
type MkdirResponse struct {
	LookupResponse
}

func (r *MkdirResponse) String() string {
	return fmt.Sprintf("Mkdir %+v", *r)
}

// A ReadRequest asks to read from an open file.
type ReadRequest struct {
	Header
	Dir    bool // is this Readdir?
	Handle HandleID
	Offset int64
	Size   int
}

func (r *ReadRequest) handle() HandleID {
	return r.Handle
}

func (r *ReadRequest) String() string {
	return fmt.Sprintf("Read [%s] %#x %d @%#x dir=%v", &r.Header, r.Handle, r.Size, r.Offset, r.Dir)
}

// Respond replies to the request with the given response.
func (r *ReadRequest) Respond(resp *ReadResponse) {
	out := &outHeader{Unique: uint64(r.ID)}
	r.Conn.respondData(out, unsafe.Sizeof(*out), resp.Data)
}

// A ReadResponse is the response to a ReadRequest.
type ReadResponse struct {
	Data []byte
}

func (r *ReadResponse) String() string {
	return fmt.Sprintf("Read %x", r.Data)
}

// A ReleaseRequest asks to release (close) an open file handle.
type ReleaseRequest struct {
	Header
	Dir          bool // is this Releasedir?
	Handle       HandleID
	Flags        uint32 // flags from OpenRequest
	ReleaseFlags ReleaseFlags
	LockOwner    uint32
}

func (r *ReleaseRequest) handle() HandleID {
	return r.Handle
}

func (r *ReleaseRequest) String() string {
	return fmt.Sprintf("Release [%s] %#x fl=%v rfl=%v owner=%#x", &r.Header, r.Handle, r.Flags, r.ReleaseFlags, r.LockOwner)
}

// Respond replies to the request, indicating that the handle has been released.
func (r *ReleaseRequest) Respond() {
	out := &outHeader{Unique: uint64(r.ID)}
	r.Conn.respond(out, unsafe.Sizeof(*out))
}

// A DestroyRequest is sent by the kernel when unmounting the file system.
// No more requests will be received after this one, but it should still be
// responded to.
type DestroyRequest struct {
	Header
}

func (r *DestroyRequest) String() string {
	return fmt.Sprintf("Destroy [%s]", &r.Header)
}

// Respond replies to the request.
func (r *DestroyRequest) Respond() {
	out := &outHeader{Unique: uint64(r.ID)}
	r.Conn.respond(out, unsafe.Sizeof(*out))
}

// A ForgetRequest is sent by the kernel when forgetting about r.Node
// as returned by r.N lookup requests.
type ForgetRequest struct {
	Header
	N uint64
}

func (r *ForgetRequest) String() string {
	return fmt.Sprintf("Forget [%s] %d", &r.Header, r.N)
}

// Respond replies to the request, indicating that the forgetfulness has been recorded.
func (r *ForgetRequest) Respond() {
	// Don't reply to forget messages.
}

// A Dirent represents a single directory entry.
type Dirent struct {
	Inode uint64 // inode this entry names
	Type  uint32 // ?
	Name  string // name of entry
}

// AppendDirent appends the encoded form of a directory entry to data
// and returns the resulting slice.
func AppendDirent(data []byte, dir Dirent) []byte {
	de := dirent{
		Ino:     dir.Inode,
		Namelen: uint32(len(dir.Name)),
		Type:    dir.Type,
	}
	de.Off = uint64(len(data) + direntSize + (len(dir.Name)+7)&^7)
	data = append(data, (*[direntSize]byte)(unsafe.Pointer(&de))[:]...)
	data = append(data, dir.Name...)
	n := direntSize + uintptr(len(dir.Name))
	if n%8 != 0 {
		var pad [8]byte
		data = append(data, pad[:8-n%8]...)
	}
	return data
}

// A WriteRequest asks to write to an open file.
type WriteRequest struct {
	Header
	Handle HandleID
	Offset int64
	Data   []byte
	Flags  WriteFlags
}

func (r *WriteRequest) String() string {
	return fmt.Sprintf("Write [%s] %#x %d @%d fl=%v", &r.Header, r.Handle, len(r.Data), r.Offset, r.Flags)
}

// Respond replies to the request with the given response.
func (r *WriteRequest) Respond(resp *WriteResponse) {
	out := &writeOut{
		outHeader: outHeader{Unique: uint64(r.ID)},
		Size:      uint32(resp.Size),
	}
	r.Conn.respond(&out.outHeader, unsafe.Sizeof(*out))
}

func (r *WriteRequest) handle() HandleID {
	return r.Handle
}

// A WriteResponse replies to a write indicating how many bytes were written.
type WriteResponse struct {
	Size int
}

func (r *WriteResponse) String() string {
	return fmt.Sprintf("Write %+v", *r)
}

// A SetattrRequest asks to change one or more attributes associated with a file,
// as indicated by Valid.
type SetattrRequest struct {
	Header
	Valid  SetattrValid
	Handle HandleID
	Size   uint64
	Atime  time.Time
	Mtime  time.Time
	Mode   os.FileMode
	Uid    uint32
	Gid    uint32

	// OS X only
	Bkuptime time.Time
	Chgtime  time.Time
	Crtime   time.Time
	Flags    uint32 // see chflags(2)
}

func (r *SetattrRequest) String() string {
	var buf bytes.Buffer
	fmt.Fprintf(&buf, "Setattr [%s]", &r.Header)
	if r.Valid.Mode() {
		fmt.Fprintf(&buf, " mode=%v", r.Mode)
	}
	if r.Valid.Uid() {
		fmt.Fprintf(&buf, " uid=%d", r.Uid)
	}
	if r.Valid.Gid() {
		fmt.Fprintf(&buf, " gid=%d", r.Gid)
	}
	if r.Valid.Size() {
		fmt.Fprintf(&buf, " size=%d", r.Size)
	}
	if r.Valid.Atime() {
		fmt.Fprintf(&buf, " atime=%v", r.Atime)
	}
	if r.Valid.Mtime() {
		fmt.Fprintf(&buf, " mtime=%v", r.Mtime)
	}
	if r.Valid.Handle() {
		fmt.Fprintf(&buf, " handle=%#x", r.Handle)
	} else {
		fmt.Fprintf(&buf, " handle=INVALID-%#x", r.Handle)
	}
	if r.Valid.Crtime() {
		fmt.Fprintf(&buf, " crtime=%v", r.Crtime)
	}
	if r.Valid.Chgtime() {
		fmt.Fprintf(&buf, " chgtime=%v", r.Chgtime)
	}
	if r.Valid.Bkuptime() {
		fmt.Fprintf(&buf, " bkuptime=%v", r.Bkuptime)
	}
	if r.Valid.Flags() {
		fmt.Fprintf(&buf, " flags=%#x", r.Flags)
	}
	return buf.String()
}

func (r *SetattrRequest) handle() HandleID {
	if r.Valid.Handle() {
		return r.Handle
	}
	return 0
}

// Respond replies to the request with the given response,
// giving the updated attributes.
func (r *SetattrRequest) Respond(resp *SetattrResponse) {
	out := &attrOut{
		outHeader:     outHeader{Unique: uint64(r.ID)},
		AttrValid:     uint64(resp.AttrValid / time.Second),
		AttrValidNsec: uint32(resp.AttrValid % time.Second / time.Nanosecond),
		Attr:          resp.Attr.attr(),
	}
	r.Conn.respond(&out.outHeader, unsafe.Sizeof(*out))
}

// A SetattrResponse is the response to a SetattrRequest.
type SetattrResponse struct {
	AttrValid time.Duration // how long Attr can be cached
	Attr      Attr          // file attributes
}

func (r *SetattrResponse) String() string {
	return fmt.Sprintf("Setattr %+v", *r)
}

// A FlushRequest asks for the current state of an open file to be flushed
// to storage, as when a file descriptor is being closed.  A single opened Handle
// may receive multiple FlushRequests over its lifetime.
type FlushRequest struct {
	Header
	Handle    HandleID
	Flags     uint32
	LockOwner uint64
}

func (r *FlushRequest) String() string {
	return fmt.Sprintf("Flush [%s] %#x fl=%#x lk=%#x", &r.Header, r.Handle, r.Flags, r.LockOwner)
}

func (r *FlushRequest) handle() HandleID {
	return r.Handle
}

// Respond replies to the request, indicating that the flush succeeded.
func (r *FlushRequest) Respond() {
	out := &outHeader{Unique: uint64(r.ID)}
	r.Conn.respond(out, unsafe.Sizeof(*out))
}

// A RemoveRequest asks to remove a file or directory.
type RemoveRequest struct {
	Header
	Name string // name of extended attribute
	Dir  bool   // is this rmdir?
}

func (r *RemoveRequest) String() string {
	return fmt.Sprintf("Remove [%s] %q dir=%v", &r.Header, r.Name, r.Dir)
}

// Respond replies to the request, indicating that the file was removed.
func (r *RemoveRequest) Respond() {
	out := &outHeader{Unique: uint64(r.ID)}
	r.Conn.respond(out, unsafe.Sizeof(*out))
}

// A SymlinkRequest is a request to create a symlink making NewName point to Target.
type SymlinkRequest struct {
	Header
	NewName, Target string
}

func (r *SymlinkRequest) String() string {
	return fmt.Sprintf("Symlink [%s] from %q to target %q", &r.Header, r.NewName, r.Target)
}

func (r *SymlinkRequest) handle() HandleID {
	return 0
}

// Respond replies to the request, indicating that the symlink was created.
func (r *SymlinkRequest) Respond(resp *SymlinkResponse) {
	out := &entryOut{
		outHeader:      outHeader{Unique: uint64(r.ID)},
		Nodeid:         uint64(resp.Node),
		Generation:     resp.Generation,
		EntryValid:     uint64(resp.EntryValid / time.Second),
		EntryValidNsec: uint32(resp.EntryValid % time.Second / time.Nanosecond),
		AttrValid:      uint64(resp.AttrValid / time.Second),
		AttrValidNsec:  uint32(resp.AttrValid % time.Second / time.Nanosecond),
		Attr:           resp.Attr.attr(),
	}
	r.Conn.respond(&out.outHeader, unsafe.Sizeof(*out))
}

// A SymlinkResponse is the response to a SymlinkRequest.
type SymlinkResponse struct {
	LookupResponse
}

// A ReadlinkRequest is a request to read a symlink's target.
type ReadlinkRequest struct {
	Header
}

func (r *ReadlinkRequest) String() string {
	return fmt.Sprintf("Readlink [%s]", &r.Header)
}

func (r *ReadlinkRequest) handle() HandleID {
	return 0
}

func (r *ReadlinkRequest) Respond(target string) {
	out := &outHeader{Unique: uint64(r.ID)}
	r.Conn.respondData(out, unsafe.Sizeof(*out), []byte(target))
}

// A LinkRequest is a request to create a hard link.
type LinkRequest struct {
	Header
	OldNode NodeID
	NewName string
}

func (r *LinkRequest) Respond(resp *LookupResponse) {
	out := &entryOut{
		outHeader:      outHeader{Unique: uint64(r.ID)},
		Nodeid:         uint64(resp.Node),
		Generation:     resp.Generation,
		EntryValid:     uint64(resp.EntryValid / time.Second),
		EntryValidNsec: uint32(resp.EntryValid % time.Second / time.Nanosecond),
		AttrValid:      uint64(resp.AttrValid / time.Second),
		AttrValidNsec:  uint32(resp.AttrValid % time.Second / time.Nanosecond),
		Attr:           resp.Attr.attr(),
	}
	r.Conn.respond(&out.outHeader, unsafe.Sizeof(*out))
}

// A RenameRequest is a request to rename a file.
type RenameRequest struct {
	Header
	NewDir           NodeID
	OldName, NewName string
}

func (r *RenameRequest) handle() HandleID {
	return 0
}

func (r *RenameRequest) String() string {
	return fmt.Sprintf("Rename [%s] from %q to dirnode %d %q", &r.Header, r.OldName, r.NewDir, r.NewName)
}

func (r *RenameRequest) Respond() {
	out := &outHeader{Unique: uint64(r.ID)}
	r.Conn.respond(out, unsafe.Sizeof(*out))
}

type MknodRequest struct {
	Header
	Name string
	Mode os.FileMode
	Rdev uint32
}

func (r *MknodRequest) String() string {
	return fmt.Sprintf("Mknod [%s] Name %q mode %v rdev %d", &r.Header, r.Name, r.Mode, r.Rdev)
}

func (r *MknodRequest) Respond(resp *LookupResponse) {
	out := &entryOut{
		outHeader:      outHeader{Unique: uint64(r.ID)},
		Nodeid:         uint64(resp.Node),
		Generation:     resp.Generation,
		EntryValid:     uint64(resp.EntryValid / time.Second),
		EntryValidNsec: uint32(resp.EntryValid % time.Second / time.Nanosecond),
		AttrValid:      uint64(resp.AttrValid / time.Second),
		AttrValidNsec:  uint32(resp.AttrValid % time.Second / time.Nanosecond),
		Attr:           resp.Attr.attr(),
	}
	r.Conn.respond(&out.outHeader, unsafe.Sizeof(*out))
}

type FsyncRequest struct {
	Header
	Handle HandleID
	Flags  uint32
}

func (r *FsyncRequest) String() string {
	return fmt.Sprintf("Fsync [%s] Handle %v Flags %v", &r.Header, r.Handle, r.Flags)
}

func (r *FsyncRequest) Respond() {
	out := &outHeader{Unique: uint64(r.ID)}
	r.Conn.respond(out, unsafe.Sizeof(*out))
}

/*{

// A XXXRequest xxx.
type XXXRequest struct {
	Header
	xxx
}

func (r *XXXRequest) String() string {
	return fmt.Sprintf("XXX [%s] xxx", &r.Header)
}

func (r *XXXRequest) handle() HandleID {
	return r.Handle
}

// Respond replies to the request with the given response.
func (r *XXXRequest) Respond(resp *XXXResponse) {
	out := &xxxOut{
		outHeader: outHeader{Unique: uint64(r.ID)},
		xxx,
	}
	r.Conn.respond(&out.outHeader, unsafe.Sizeof(*out))
}

// A XXXResponse is the response to a XXXRequest.
type XXXResponse struct {
	xxx
}

func (r *XXXResponse) String() string {
	return fmt.Sprintf("XXX %+v", *r)
}

 }
*/
