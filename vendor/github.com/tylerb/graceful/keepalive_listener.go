package graceful

import (
	"net"
	"time"
)

type keepAliveConn interface {
	SetKeepAlive(bool) error
	SetKeepAlivePeriod(d time.Duration) error
}

// keepAliveListener sets TCP keep-alive timeouts on accepted
// connections. It's used by ListenAndServe and ListenAndServeTLS so
// dead TCP connections (e.g. closing laptop mid-download) eventually
// go away.
type keepAliveListener struct {
	net.Listener
	keepAlivePeriod time.Duration
}

func (ln keepAliveListener) Accept() (net.Conn, error) {
	c, err := ln.Listener.Accept()
	if err != nil {
		return nil, err
	}

	kac := c.(keepAliveConn)
	kac.SetKeepAlive(true)
	kac.SetKeepAlivePeriod(ln.keepAlivePeriod)
	return c, nil
}
