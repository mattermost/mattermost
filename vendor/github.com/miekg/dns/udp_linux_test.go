// +build linux,!appengine

package dns

import (
	"bytes"
	"net"
	"testing"
)

func TestParseUDPSocketDst(t *testing.T) {
	// dst is :ffff:100.100.100.100
	oob := []byte{36, 0, 0, 0, 0, 0, 0, 0, 41, 0, 0, 0, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 100, 100, 100, 100, 2, 0, 0, 0}
	dst, err := parseUDPSocketDst(oob)
	if err != nil {
		t.Fatalf("error parsing ipv6 oob: %v", err)
	}
	dst4 := dst.To4()
	if dst4 == nil {
		t.Errorf("failed to parse ipv4: %v", dst)
	} else if dst4.String() != "100.100.100.100" {
		t.Errorf("unexpected ipv4: %v", dst4)
	}

	// dst is 2001:db8::1
	oob = []byte{36, 0, 0, 0, 0, 0, 0, 0, 41, 0, 0, 0, 50, 0, 0, 0, 32, 1, 13, 184, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0}
	dst, err = parseUDPSocketDst(oob)
	if err != nil {
		t.Fatalf("error parsing ipv6 oob: %v", err)
	}
	dst6 := dst.To16()
	if dst6 == nil {
		t.Errorf("failed to parse ipv6: %v", dst)
	} else if dst6.String() != "2001:db8::1" {
		t.Errorf("unexpected ipv6: %v", dst4)
	}

	// dst is 100.100.100.100 but was received on 10.10.10.10
	oob = []byte{28, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 2, 0, 0, 0, 10, 10, 10, 10, 100, 100, 100, 100, 0, 0, 0, 0}
	dst, err = parseUDPSocketDst(oob)
	if err != nil {
		t.Fatalf("error parsing ipv4 oob: %v", err)
	}
	dst4 = dst.To4()
	if dst4 == nil {
		t.Errorf("failed to parse ipv4: %v", dst)
	} else if dst4.String() != "100.100.100.100" {
		t.Errorf("unexpected ipv4: %v", dst4)
	}
}

func TestMarshalUDPSocketSrc(t *testing.T) {
	// src is 100.100.100.100
	exoob := []byte{28, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0, 0, 0}
	oob := marshalUDPSocketSrc(net.ParseIP("100.100.100.100"))
	if !bytes.Equal(exoob, oob) {
		t.Errorf("expected ipv4 oob:\n%v", exoob)
		t.Errorf("actual ipv4 oob:\n%v", oob)
	}

	// src is 2001:db8::1
	exoob = []byte{36, 0, 0, 0, 0, 0, 0, 0, 41, 0, 0, 0, 50, 0, 0, 0, 32, 1, 13, 184, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0}
	oob = marshalUDPSocketSrc(net.ParseIP("2001:db8::1"))
	if !bytes.Equal(exoob, oob) {
		t.Errorf("expected ipv6 oob:\n%v", exoob)
		t.Errorf("actual ipv6 oob:\n%v", oob)
	}
}
