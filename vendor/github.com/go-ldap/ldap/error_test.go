package ldap

import (
	"testing"

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
		&ber.Packet{}, // Unused
		nil,           // Can't be nil
	}
	pack := &ber.Packet{Children: kids}
	code, _ = getLDAPResultCode(pack)

	if code != ErrorUnexpectedResponse {
		t.Errorf("Should have an 'ErrorUnexpectedResponse' error in nil packets, got: %v", code)
	}

}
