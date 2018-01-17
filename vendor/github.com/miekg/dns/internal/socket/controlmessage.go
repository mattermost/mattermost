package socket

import (
	"errors"
	"unsafe"
)

func controlHeaderLen() int {
	return roundup(sizeofCmsghdr)
}

func controlMessageLen(dataLen int) int {
	return roundup(sizeofCmsghdr) + dataLen
}

// returns the whole length of control message.
func ControlMessageSpace(dataLen int) int {
	return roundup(sizeofCmsghdr) + roundup(dataLen)
}

// A ControlMessage represents the head message in a stream of control
// messages.
//
// A control message comprises of a header, data and a few padding
// fields to conform to the interface to the kernel.
//
// See RFC 3542 for further information.
type ControlMessage []byte

// Data returns the data field of the control message at the head.
func (m ControlMessage) Data(dataLen int) []byte {
	l := controlHeaderLen()
	if len(m) < l || len(m) < l+dataLen {
		return nil
	}
	return m[l : l+dataLen]
}

// ParseHeader parses and returns the header fields of the control
// message at the head.
func (m ControlMessage) ParseHeader() (lvl, typ, dataLen int, err error) {
	l := controlHeaderLen()
	if len(m) < l {
		return 0, 0, 0, errors.New("short message")
	}
	h := (*cmsghdr)(unsafe.Pointer(&m[0]))
	return h.lvl(), h.typ(), int(uint64(h.len()) - uint64(l)), nil
}

// Next returns the control message at the next.
func (m ControlMessage) Next(dataLen int) ControlMessage {
	l := ControlMessageSpace(dataLen)
	if len(m) < l {
		return nil
	}
	return m[l:]
}

// MarshalHeader marshals the header fields of the control message at
// the head.
func (m ControlMessage) MarshalHeader(lvl, typ, dataLen int) error {
	if len(m) < controlHeaderLen() {
		return errors.New("short message")
	}
	h := (*cmsghdr)(unsafe.Pointer(&m[0]))
	h.set(controlMessageLen(dataLen), lvl, typ)
	return nil
}

// Marshal marshals the control message at the head, and returns the next
// control message.
func (m ControlMessage) Marshal(lvl, typ int, data []byte) (ControlMessage, error) {
	l := len(data)
	if len(m) < ControlMessageSpace(l) {
		return nil, errors.New("short message")
	}
	h := (*cmsghdr)(unsafe.Pointer(&m[0]))
	h.set(controlMessageLen(l), lvl, typ)
	if l > 0 {
		copy(m.Data(l), data)
	}
	return m.Next(l), nil
}

// Parse parses as a single or multiple control messages.
func (m ControlMessage) Parse() ([]ControlMessage, error) {
	var ms []ControlMessage
	for len(m) >= controlHeaderLen() {
		h := (*cmsghdr)(unsafe.Pointer(&m[0]))
		l := h.len()
		if l <= 0 {
			return nil, errors.New("invalid header length")
		}
		if uint64(l) < uint64(controlHeaderLen()) {
			return nil, errors.New("invalid message length")
		}
		if uint64(l) > uint64(len(m)) {
			return nil, errors.New("short buffer")
		}
		ms = append(ms, ControlMessage(m[:l]))
		ll := l - controlHeaderLen()
		if len(m) >= ControlMessageSpace(ll) {
			m = m[ControlMessageSpace(ll):]
		} else {
			m = m[controlMessageLen(ll):]
		}
	}
	return ms, nil
}

// NewControlMessage returns a new stream of control messages.
func NewControlMessage(dataLen []int) ControlMessage {
	var l int
	for i := range dataLen {
		l += ControlMessageSpace(dataLen[i])
	}
	return make([]byte, l)
}
