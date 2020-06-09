package ldap

import (
	"bytes"
	"log"

	ber "github.com/go-asn1-ber/asn1-ber"
)

const LDAP_TRACE_PREFIX = "ldap-trace: "

// debugging type
//     - has a Printf method to write the debug output
type debugging bool

// Enable controls debugging mode.
func (debug *debugging) Enable(b bool) {
	*debug = debugging(b)
}

// Printf writes debug output.
func (debug debugging) Printf(format string, args ...interface{}) {
	if debug {
		format = LDAP_TRACE_PREFIX + format
		log.Printf(format, args...)
	}
}

// PrintPacket dumps a packet.
func (debug debugging) PrintPacket(packet *ber.Packet) {
	if debug {
		var b bytes.Buffer
		ber.WritePacket(&b, packet)
		textToPrint := LDAP_TRACE_PREFIX + b.String()
		log.Printf(textToPrint)
	}
}
