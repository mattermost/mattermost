package ldap

import (
	"errors"
	"net"
	"strings"
	"testing"
	"time"

	"gopkg.in/asn1-ber.v1"
)

// TestNilPacket tests that nil packets don't cause a panic.
func TestNilPacket(t *testing.T) {
	// Test for nil packet
	code, _ := getLDAPResultCode(nil)
	if code != ErrorUnexpectedResponse {
		t.Errorf("Should have an 'ErrorUnexpectedResponse' error in nil packets, got: %v", code)
	}

	// Test for nil result
	kids := []*ber.Packet{
		{},  // Unused
		nil, // Can't be nil
	}
	pack := &ber.Packet{Children: kids}
	code, _ = getLDAPResultCode(pack)

	if code != ErrorUnexpectedResponse {
		t.Errorf("Should have an 'ErrorUnexpectedResponse' error in nil packets, got: %v", code)
	}
}

// TestConnReadErr tests that an unexpected error reading from underlying
// connection bubbles up to the goroutine which makes a request.
func TestConnReadErr(t *testing.T) {
	conn := &signalErrConn{
		signals: make(chan error),
	}

	ldapConn := NewConn(conn, false)
	ldapConn.Start()

	// Make a dummy search request.
	searchReq := NewSearchRequest("dc=example,dc=com", ScopeWholeSubtree, DerefAlways, 0, 0, false, "(objectClass=*)", nil, nil)

	expectedError := errors.New("this is the error you are looking for")

	// Send the signal after a short amount of time.
	time.AfterFunc(10*time.Millisecond, func() { conn.signals <- expectedError })

	// This should block until the underlyiny conn gets the error signal
	// which should bubble up through the reader() goroutine, close the
	// connection, and
	_, err := ldapConn.Search(searchReq)
	if err == nil || !strings.Contains(err.Error(), expectedError.Error()) {
		t.Errorf("not the expected error: %s", err)
	}
}

// signalErrConn is a helful type used with TestConnReadErr. It implements the
// net.Conn interface to be used as a connection for the test. Most methods are
// no-ops but the Read() method blocks until it receives a signal which it
// returns as an error.
type signalErrConn struct {
	signals chan error
}

// Read blocks until an error is sent on the internal signals channel. That
// error is returned.
func (c *signalErrConn) Read(b []byte) (n int, err error) {
	return 0, <-c.signals
}

func (c *signalErrConn) Write(b []byte) (n int, err error) {
	return len(b), nil
}

func (c *signalErrConn) Close() error {
	close(c.signals)
	return nil
}

func (c *signalErrConn) LocalAddr() net.Addr {
	return (*net.TCPAddr)(nil)
}

func (c *signalErrConn) RemoteAddr() net.Addr {
	return (*net.TCPAddr)(nil)
}

func (c *signalErrConn) SetDeadline(t time.Time) error {
	return nil
}

func (c *signalErrConn) SetReadDeadline(t time.Time) error {
	return nil
}

func (c *signalErrConn) SetWriteDeadline(t time.Time) error {
	return nil
}
