// +build linux,!appengine

package dns

// See:
// * http://stackoverflow.com/questions/3062205/setting-the-source-ip-for-a-udp-socket and
// * http://blog.powerdns.com/2012/10/08/on-binding-datagram-udp-sockets-to-the-any-addresses/
//
// Why do we need this: When listening on 0.0.0.0 with UDP so kernel decides what is the outgoing
// interface, this might not always be the correct one. This code will make sure the egress
// packet's interface matched the ingress' one.

import (
	"net"
	"syscall"
	"unsafe"

	"github.com/miekg/dns/internal/socket"
)

const (
	sizeofInet6Pktinfo = 0x14
	sizeofInetPktinfo  = 0xc
	protocolIP         = 0
	protocolIPv6       = 41
)

type inetPktinfo struct {
	Ifindex  int32
	Spec_dst [4]byte /* in_addr */
	Addr     [4]byte /* in_addr */
}

type inet6Pktinfo struct {
	Addr    [16]byte /* in6_addr */
	Ifindex int32
}

type inetControlMessage struct {
	Src net.IP // source address, specifying only
	Dst net.IP // destination address, receiving only
}

// setUDPSocketOptions sets the UDP socket options.
// This function is implemented on a per platform basis. See udp_*.go for more details
func setUDPSocketOptions(conn *net.UDPConn) error {
	sa, err := getUDPSocketName(conn)
	if err != nil {
		return err
	}
	switch sa.(type) {
	case *syscall.SockaddrInet6:
		v6only, err := getUDPSocketOptions6Only(conn)
		if err != nil {
			return err
		}
		setUDPSocketOptions6(conn)
		if !v6only {
			setUDPSocketOptions4(conn)
		}
	case *syscall.SockaddrInet4:
		setUDPSocketOptions4(conn)
	}
	return nil
}

// setUDPSocketOptions4 prepares the v4 socket for sessions.
func setUDPSocketOptions4(conn *net.UDPConn) error {
	file, err := conn.File()
	if err != nil {
		return err
	}
	if err := syscall.SetsockoptInt(int(file.Fd()), syscall.IPPROTO_IP, syscall.IP_PKTINFO, 1); err != nil {
		file.Close()
		return err
	}
	// Calling File() above results in the connection becoming blocking, we must fix that.
	// See https://github.com/miekg/dns/issues/279
	err = syscall.SetNonblock(int(file.Fd()), true)
	if err != nil {
		file.Close()
		return err
	}
	file.Close()
	return nil
}

// setUDPSocketOptions6 prepares the v6 socket for sessions.
func setUDPSocketOptions6(conn *net.UDPConn) error {
	file, err := conn.File()
	if err != nil {
		return err
	}
	if err := syscall.SetsockoptInt(int(file.Fd()), syscall.IPPROTO_IPV6, syscall.IPV6_RECVPKTINFO, 1); err != nil {
		file.Close()
		return err
	}
	err = syscall.SetNonblock(int(file.Fd()), true)
	if err != nil {
		file.Close()
		return err
	}
	file.Close()
	return nil
}

// getUDPSocketOption6Only return true if the socket is v6 only and false when it is v4/v6 combined
// (dualstack).
func getUDPSocketOptions6Only(conn *net.UDPConn) (bool, error) {
	file, err := conn.File()
	if err != nil {
		return false, err
	}
	// dual stack. See http://stackoverflow.com/questions/1618240/how-to-support-both-ipv4-and-ipv6-connections
	v6only, err := syscall.GetsockoptInt(int(file.Fd()), syscall.IPPROTO_IPV6, syscall.IPV6_V6ONLY)
	if err != nil {
		file.Close()
		return false, err
	}
	file.Close()
	return v6only == 1, nil
}

func getUDPSocketName(conn *net.UDPConn) (syscall.Sockaddr, error) {
	file, err := conn.File()
	if err != nil {
		return nil, err
	}
	defer file.Close()
	return syscall.Getsockname(int(file.Fd()))
}

// marshalInetPacketInfo marshals a ipv4 control message, returning
// the byte slice for the next marshal, if any
func marshalInetPacketInfo(b []byte, cm *inetControlMessage) []byte {
	m := socket.ControlMessage(b)
	m.MarshalHeader(protocolIP, syscall.IP_PKTINFO, sizeofInetPktinfo)
	if cm != nil {
		pi := (*inetPktinfo)(unsafe.Pointer(&m.Data(sizeofInetPktinfo)[0]))
		if ip := cm.Src.To4(); ip != nil {
			copy(pi.Spec_dst[:], ip)
		}
	}
	return m.Next(sizeofInetPktinfo)
}

// marshalInet6PacketInfo marshals a ipv6 control message, returning
// the byte slice for the next marshal, if any
func marshalInet6PacketInfo(b []byte, cm *inetControlMessage) []byte {
	m := socket.ControlMessage(b)
	m.MarshalHeader(protocolIPv6, syscall.IPV6_PKTINFO, sizeofInet6Pktinfo)
	if cm != nil {
		pi := (*inet6Pktinfo)(unsafe.Pointer(&m.Data(sizeofInet6Pktinfo)[0]))
		if ip := cm.Src.To16(); ip != nil && ip.To4() == nil {
			copy(pi.Addr[:], ip)
		}
	}
	return m.Next(sizeofInet6Pktinfo)
}

func parseInetPacketInfo(cm *inetControlMessage, b []byte) {
	pi := (*inetPktinfo)(unsafe.Pointer(&b[0]))
	if len(cm.Dst) < net.IPv4len {
		cm.Dst = make(net.IP, net.IPv4len)
	}
	copy(cm.Dst, pi.Addr[:])
}

func parseInet6PacketInfo(cm *inetControlMessage, b []byte) {
	pi := (*inet6Pktinfo)(unsafe.Pointer(&b[0]))
	if len(cm.Dst) < net.IPv6len {
		cm.Dst = make(net.IP, net.IPv6len)
	}
	copy(cm.Dst, pi.Addr[:])
}

// parseUDPSocketDst takes out-of-band data from ReadMsgUDP and parses it for
// the Dst address
func parseUDPSocketDst(oob []byte) (net.IP, error) {
	cm := new(inetControlMessage)
	ms, err := socket.ControlMessage(oob).Parse()
	if err != nil {
		return nil, err
	}
	for _, m := range ms {
		lvl, typ, l, err := m.ParseHeader()
		if err != nil {
			return nil, err
		}
		if lvl == protocolIPv6 { // IPv6
			if typ == syscall.IPV6_PKTINFO && l >= sizeofInet6Pktinfo {
				parseInet6PacketInfo(cm, m.Data(l))
			}
		} else if lvl == protocolIP { // IPv4
			if typ == syscall.IP_PKTINFO && l >= sizeofInetPktinfo {
				parseInetPacketInfo(cm, m.Data(l))
			}
		}
	}
	return cm.Dst, nil
}

// marshalUDPSocketSrc takes the given src address and returns out-of-band data
// to give to WriteMsgUDP
func marshalUDPSocketSrc(src net.IP) []byte {
	var oob []byte
	// If the dst is definitely an ipv6, then use ipv6 control to respond
	// otherwise use ipv4 because the ipv6 marshal ignores ipv4 messages.
	// See marshalInet6PacketInfo
	cm := new(inetControlMessage)
	cm.Src = src
	if src.To4() == nil {
		oob = make([]byte, socket.ControlMessageSpace(sizeofInet6Pktinfo))
		marshalInet6PacketInfo(oob, cm)
	} else {
		oob = make([]byte, socket.ControlMessageSpace(sizeofInetPktinfo))
		marshalInetPacketInfo(oob, cm)
	}
	return oob
}
