package test_helpers

import "net"

type Conn struct {
	net.Conn
	CloseCalled bool
}

func (c *Conn) Close() error {
	c.CloseCalled = true
	return nil
}
