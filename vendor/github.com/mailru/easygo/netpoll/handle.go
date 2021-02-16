package netpoll

import (
	"net"
	"os"
)

// filer describes an object that has ability to return os.File.
type filer interface {
	// File returns a copy of object's file descriptor.
	File() (*os.File, error)
}

// Desc is a network connection within netpoll descriptor.
// It's methods are not goroutine safe.
type Desc struct {
	file  *os.File
	event Event
}

// NewDesc creates descriptor from custom fd.
func NewDesc(fd uintptr, ev Event) *Desc {
	return &Desc{os.NewFile(fd, ""), ev}
}

// Close closes underlying file.
func (h *Desc) Close() error {
	return h.file.Close()
}

func (h *Desc) fd() int {
	return int(h.file.Fd())
}

// Must is a helper that wraps a call to a function returning (*Desc, error).
// It panics if the error is non-nil and returns desc if not.
// It is intended for use in short Desc initializations.
func Must(desc *Desc, err error) *Desc {
	if err != nil {
		panic(err)
	}
	return desc
}

// HandleRead creates read descriptor for further use in Poller methods.
// It is the same as Handle(conn, EventRead|EventEdgeTriggered).
func HandleRead(conn net.Conn) (*Desc, error) {
	return Handle(conn, EventRead|EventEdgeTriggered)
}

// HandleReadOnce creates read descriptor for further use in Poller methods.
// It is the same as Handle(conn, EventRead|EventOneShot).
func HandleReadOnce(conn net.Conn) (*Desc, error) {
	return Handle(conn, EventRead|EventOneShot)
}

// HandleWrite creates write descriptor for further use in Poller methods.
// It is the same as Handle(conn, EventWrite|EventEdgeTriggered).
func HandleWrite(conn net.Conn) (*Desc, error) {
	return Handle(conn, EventWrite|EventEdgeTriggered)
}

// HandleWriteOnce creates write descriptor for further use in Poller methods.
// It is the same as Handle(conn, EventWrite|EventOneShot).
func HandleWriteOnce(conn net.Conn) (*Desc, error) {
	return Handle(conn, EventWrite|EventOneShot)
}

// HandleReadWrite creates read and write descriptor for further use in Poller
// methods.
// It is the same as Handle(conn, EventRead|EventWrite|EventEdgeTriggered).
func HandleReadWrite(conn net.Conn) (*Desc, error) {
	return Handle(conn, EventRead|EventWrite|EventEdgeTriggered)
}

// Handle creates new Desc with given conn and event.
// Returned descriptor could be used as argument to Start(), Resume() and
// Stop() methods of some Poller implementation.
func Handle(conn net.Conn, event Event) (*Desc, error) {
	desc, err := handle(conn, event)
	if err != nil {
		return nil, err
	}

	// Set the file back to non blocking mode since conn.File() sets underlying
	// os.File to blocking mode. This is useful to get conn.Set{Read}Deadline
	// methods still working on source Conn.
	//
	// See https://golang.org/pkg/net/#TCPConn.File
	// See /usr/local/go/src/net/net.go: conn.File()
	if err = setNonblock(desc.fd(), true); err != nil {
		return nil, os.NewSyscallError("setnonblock", err)
	}

	return desc, nil
}

// HandleListener returns descriptor for a net.Listener.
func HandleListener(ln net.Listener, event Event) (*Desc, error) {
	return handle(ln, event)
}

func handle(x interface{}, event Event) (*Desc, error) {
	f, ok := x.(filer)
	if !ok {
		return nil, ErrNotFiler
	}

	// Get a copy of fd.
	file, err := f.File()
	if err != nil {
		return nil, err
	}

	return &Desc{
		file:  file,
		event: event,
	}, nil
}
