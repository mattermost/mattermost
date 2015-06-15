package manners

import (
	"net"
	"sync"
)

func NewListener(l net.Listener, s *GracefulServer) *GracefulListener {
	return &GracefulListener{l, true, s, sync.RWMutex{}}
}

// A GracefulListener differs from a standard net.Listener in one way: if
// Accept() is called after it is gracefully closed, it returns a
// listenerAlreadyClosed error. The GracefulServer will ignore this
// error.
type GracefulListener struct {
	net.Listener
	open   bool
	server *GracefulServer
	rw     sync.RWMutex
}

func (l *GracefulListener) Accept() (net.Conn, error) {
	conn, err := l.Listener.Accept()
	if err != nil {
		l.rw.RLock()
		defer l.rw.RUnlock()
		if !l.open {
			err = listenerAlreadyClosed{err}
		}
		return nil, err
	}
	return conn, nil
}

func (l *GracefulListener) Close() error {
	l.rw.Lock()
	defer l.rw.Unlock()
	if !l.open {
		return nil
	}
	l.open = false
	err := l.Listener.Close()
	return err
}

type listenerAlreadyClosed struct {
	error
}
