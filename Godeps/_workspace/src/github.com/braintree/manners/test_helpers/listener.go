package test_helpers

import (
	"errors"
	"net"
)

type Listener struct {
	AcceptRelease chan bool
	CloseCalled   chan bool
}

func NewListener() *Listener {
	return &Listener{
		make(chan bool, 1),
		make(chan bool, 1),
	}
}

func (l *Listener) Addr() net.Addr {
	addr, _ := net.ResolveTCPAddr("tcp", "127.0.0.1:8080")
	return addr
}

func (l *Listener) Close() error {
	l.CloseCalled <- true
	l.AcceptRelease <- true
	return nil
}

func (l *Listener) Accept() (net.Conn, error) {
	<-l.AcceptRelease
	return nil, errors.New("connection closed")
}
