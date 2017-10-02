// +build !windows

package dns

import (
	"net"
)

// SessionUDP holds the remote address and the associated
// out-of-band data.
type SessionUDP struct {
	raddr   *net.UDPAddr
	context []byte
}

// RemoteAddr returns the remote network address.
func (s *SessionUDP) RemoteAddr() net.Addr { return s.raddr }

// ReadFromSessionUDP acts just like net.UDPConn.ReadFrom(), but returns a session object instead of a
// net.UDPAddr.
func ReadFromSessionUDP(conn *net.UDPConn, b []byte) (int, *SessionUDP, error) {
	oob := make([]byte, 40)
	n, oobn, _, raddr, err := conn.ReadMsgUDP(b, oob)
	if err != nil {
		return n, nil, err
	}
	return n, &SessionUDP{raddr, oob[:oobn]}, err
}

// WriteToSessionUDP acts just like net.UDPConn.WriteTo(), but uses a *SessionUDP instead of a net.Addr.
func WriteToSessionUDP(conn *net.UDPConn, b []byte, session *SessionUDP) (int, error) {
	oob := correctSource(session.context)
	n, _, err := conn.WriteMsgUDP(b, oob, session.raddr)
	return n, err
}

// correctSource takes oob data and returns new oob data with the Src equal to the Dst
func correctSource(oob []byte) []byte {
	dst, err := parseUDPSocketDst(oob)
	// If the destination could not be determined, ignore.
	if err != nil || dst == nil {
		return nil
	}
	return marshalUDPSocketSrc(dst)
}
