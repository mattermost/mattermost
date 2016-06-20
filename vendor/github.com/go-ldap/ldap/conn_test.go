package ldap

import (
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"gopkg.in/asn1-ber.v1"
)

func TestUnresponsiveConnection(t *testing.T) {
	// The do-nothing server that accepts requests and does nothing
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	}))
	defer ts.Close()
	c, err := net.Dial(ts.Listener.Addr().Network(), ts.Listener.Addr().String())
	if err != nil {
		t.Fatalf("error connecting to localhost tcp: %v", err)
	}

	// Create an Ldap connection
	conn := NewConn(c, false)
	conn.SetTimeout(time.Millisecond)
	conn.Start()
	defer conn.Close()

	// Mock a packet
	messageID := conn.nextMessageID()
	packet := ber.Encode(ber.ClassUniversal, ber.TypeConstructed, ber.TagSequence, nil, "LDAP Request")
	packet.AppendChild(ber.NewInteger(ber.ClassUniversal, ber.TypePrimitive, ber.TagInteger, messageID, "MessageID"))
	bindRequest := ber.Encode(ber.ClassApplication, ber.TypeConstructed, ApplicationBindRequest, nil, "Bind Request")
	bindRequest.AppendChild(ber.NewInteger(ber.ClassUniversal, ber.TypePrimitive, ber.TagInteger, 3, "Version"))
	packet.AppendChild(bindRequest)

	// Send packet and test response
	channel, err := conn.sendMessage(packet)
	if err != nil {
		t.Fatalf("error sending message: %v", err)
	}
	packetResponse, ok := <-channel
	if !ok {
		t.Fatalf("no PacketResponse in response channel")
	}
	packet, err = packetResponse.ReadPacket()
	if err == nil {
		t.Fatalf("expected timeout error")
	}
	if err.Error() != "ldap: connection timed out" {
		t.Fatalf("unexpected error: %v", err)
	}
}
