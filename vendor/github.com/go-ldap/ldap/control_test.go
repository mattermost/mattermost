package ldap

import (
	"bytes"
	"fmt"
	"reflect"
	"runtime"
	"testing"

	"gopkg.in/asn1-ber.v1"
)

func TestControlPaging(t *testing.T) {
	runControlTest(t, NewControlPaging(0))
	runControlTest(t, NewControlPaging(100))
}

func TestControlManageDsaIT(t *testing.T) {
	runControlTest(t, NewControlManageDsaIT(true))
	runControlTest(t, NewControlManageDsaIT(false))
}

func TestControlString(t *testing.T) {
	runControlTest(t, NewControlString("x", true, "y"))
	runControlTest(t, NewControlString("x", true, ""))
	runControlTest(t, NewControlString("x", false, "y"))
	runControlTest(t, NewControlString("x", false, ""))
}

func runControlTest(t *testing.T, originalControl Control) {
	header := ""
	if callerpc, _, line, ok := runtime.Caller(1); ok {
		if caller := runtime.FuncForPC(callerpc); caller != nil {
			header = fmt.Sprintf("%s:%d: ", caller.Name(), line)
		}
	}

	encodedPacket := originalControl.Encode()
	encodedBytes := encodedPacket.Bytes()

	// Decode directly from the encoded packet (ensures Value is correct)
	fromPacket := DecodeControl(encodedPacket)
	if !bytes.Equal(encodedBytes, fromPacket.Encode().Bytes()) {
		t.Errorf("%sround-trip from encoded packet failed", header)
	}
	if reflect.TypeOf(originalControl) != reflect.TypeOf(fromPacket) {
		t.Errorf("%sgot different type decoding from encoded packet: %T vs %T", header, fromPacket, originalControl)
	}

	// Decode from the wire bytes (ensures ber-encoding is correct)
	fromBytes := DecodeControl(ber.DecodePacket(encodedBytes))
	if !bytes.Equal(encodedBytes, fromBytes.Encode().Bytes()) {
		t.Errorf("%sround-trip from encoded bytes failed", header)
	}
	if reflect.TypeOf(originalControl) != reflect.TypeOf(fromPacket) {
		t.Errorf("%sgot different type decoding from encoded bytes: %T vs %T", header, fromBytes, originalControl)
	}
}
