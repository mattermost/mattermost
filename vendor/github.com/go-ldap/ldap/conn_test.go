package ldap

import (
	"bytes"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"runtime"
	"sync"
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
	packet := ber.Encode(ber.ClassUniversal, ber.TypeConstructed, ber.TagSequence, nil, "LDAP Request")
	packet.AppendChild(ber.NewInteger(ber.ClassUniversal, ber.TypePrimitive, ber.TagInteger, conn.nextMessageID(), "MessageID"))
	bindRequest := ber.Encode(ber.ClassApplication, ber.TypeConstructed, ApplicationBindRequest, nil, "Bind Request")
	bindRequest.AppendChild(ber.NewInteger(ber.ClassUniversal, ber.TypePrimitive, ber.TagInteger, 3, "Version"))
	packet.AppendChild(bindRequest)

	// Send packet and test response
	msgCtx, err := conn.sendMessage(packet)
	if err != nil {
		t.Fatalf("error sending message: %v", err)
	}
	defer conn.finishMessage(msgCtx)

	packetResponse, ok := <-msgCtx.responses
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

// TestFinishMessage tests that we do not enter deadlock when a goroutine makes
// a request but does not handle all responses from the server.
func TestFinishMessage(t *testing.T) {
	ptc := newPacketTranslatorConn()
	defer ptc.Close()

	conn := NewConn(ptc, false)
	conn.Start()

	// Test sending 5 different requests in series. Ensure that we can
	// get a response packet from the underlying connection and also
	// ensure that we can gracefully ignore unhandled responses.
	for i := 0; i < 5; i++ {
		t.Logf("serial request %d", i)
		// Create a message and make sure we can receive responses.
		msgCtx := testSendRequest(t, ptc, conn)
		testReceiveResponse(t, ptc, msgCtx)

		// Send a few unhandled responses and finish the message.
		testSendUnhandledResponsesAndFinish(t, ptc, conn, msgCtx, 5)
		t.Logf("serial request %d done", i)
	}

	// Test sending 5 different requests in parallel.
	var wg sync.WaitGroup
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			t.Logf("parallel request %d", i)
			// Create a message and make sure we can receive responses.
			msgCtx := testSendRequest(t, ptc, conn)
			testReceiveResponse(t, ptc, msgCtx)

			// Send a few unhandled responses and finish the message.
			testSendUnhandledResponsesAndFinish(t, ptc, conn, msgCtx, 5)
			t.Logf("parallel request %d done", i)
		}(i)
	}
	wg.Wait()

	// We cannot run Close() in a defer because t.FailNow() will run it and
	// it will block if the processMessage Loop is in a deadlock.
	conn.Close()
}

func testSendRequest(t *testing.T, ptc *packetTranslatorConn, conn *Conn) (msgCtx *messageContext) {
	var msgID int64
	runWithTimeout(t, time.Second, func() {
		msgID = conn.nextMessageID()
	})

	requestPacket := ber.Encode(ber.ClassUniversal, ber.TypeConstructed, ber.TagSequence, nil, "LDAP Request")
	requestPacket.AppendChild(ber.NewInteger(ber.ClassUniversal, ber.TypePrimitive, ber.TagInteger, msgID, "MessageID"))

	var err error

	runWithTimeout(t, time.Second, func() {
		msgCtx, err = conn.sendMessage(requestPacket)
		if err != nil {
			t.Fatalf("unable to send request message: %s", err)
		}
	})

	// We should now be able to get this request packet out from the other
	// side.
	runWithTimeout(t, time.Second, func() {
		if _, err = ptc.ReceiveRequest(); err != nil {
			t.Fatalf("unable to receive request packet: %s", err)
		}
	})

	return msgCtx
}

func testReceiveResponse(t *testing.T, ptc *packetTranslatorConn, msgCtx *messageContext) {
	// Send a mock response packet.
	responsePacket := ber.Encode(ber.ClassUniversal, ber.TypeConstructed, ber.TagSequence, nil, "LDAP Response")
	responsePacket.AppendChild(ber.NewInteger(ber.ClassUniversal, ber.TypePrimitive, ber.TagInteger, msgCtx.id, "MessageID"))

	runWithTimeout(t, time.Second, func() {
		if err := ptc.SendResponse(responsePacket); err != nil {
			t.Fatalf("unable to send response packet: %s", err)
		}
	})

	// We should be able to receive the packet from the connection.
	runWithTimeout(t, time.Second, func() {
		if _, ok := <-msgCtx.responses; !ok {
			t.Fatal("response channel closed")
		}
	})
}

func testSendUnhandledResponsesAndFinish(t *testing.T, ptc *packetTranslatorConn, conn *Conn, msgCtx *messageContext, numResponses int) {
	// Send a mock response packet.
	responsePacket := ber.Encode(ber.ClassUniversal, ber.TypeConstructed, ber.TagSequence, nil, "LDAP Response")
	responsePacket.AppendChild(ber.NewInteger(ber.ClassUniversal, ber.TypePrimitive, ber.TagInteger, msgCtx.id, "MessageID"))

	// Send extra responses but do not attempt to receive them on the
	// client side.
	for i := 0; i < numResponses; i++ {
		runWithTimeout(t, time.Second, func() {
			if err := ptc.SendResponse(responsePacket); err != nil {
				t.Fatalf("unable to send response packet: %s", err)
			}
		})
	}

	// Finally, attempt to finish this message.
	runWithTimeout(t, time.Second, func() {
		conn.finishMessage(msgCtx)
	})
}

func runWithTimeout(t *testing.T, timeout time.Duration, f func()) {
	done := make(chan struct{})
	go func() {
		f()
		close(done)
	}()

	select {
	case <-done: // Success!
	case <-time.After(timeout):
		_, file, line, _ := runtime.Caller(1)
		t.Fatalf("%s:%d timed out", file, line)
	}
}

// packetTranslatorConn is a helpful type which can be used with various tests
// in this package. It implements the net.Conn interface to be used as an
// underlying connection for a *ldap.Conn. Most methods are no-ops but the
// Read() and Write() methods are able to translate ber-encoded packets for
// testing LDAP requests and responses.
//
// Test cases can simulate an LDAP server sending a response by calling the
// SendResponse() method with a ber-encoded LDAP response packet. Test cases
// can simulate an LDAP server receiving a request from a client by calling the
// ReceiveRequest() method which returns a ber-encoded LDAP request packet.
type packetTranslatorConn struct {
	lock     sync.Mutex
	isClosed bool

	responseCond sync.Cond
	requestCond  sync.Cond

	responseBuf bytes.Buffer
	requestBuf  bytes.Buffer
}

var errPacketTranslatorConnClosed = errors.New("connection closed")

func newPacketTranslatorConn() *packetTranslatorConn {
	conn := &packetTranslatorConn{}
	conn.responseCond = sync.Cond{L: &conn.lock}
	conn.requestCond = sync.Cond{L: &conn.lock}

	return conn
}

// Read is called by the reader() loop to receive response packets. It will
// block until there are more packet bytes available or this connection is
// closed.
func (c *packetTranslatorConn) Read(b []byte) (n int, err error) {
	c.lock.Lock()
	defer c.lock.Unlock()

	for !c.isClosed {
		// Attempt to read data from the response buffer. If it fails
		// with an EOF, wait and try again.
		n, err = c.responseBuf.Read(b)
		if err != io.EOF {
			return n, err
		}

		c.responseCond.Wait()
	}

	return 0, errPacketTranslatorConnClosed
}

// SendResponse writes the given response packet to the response buffer for
// this connection, signalling any goroutine waiting to read a response.
func (c *packetTranslatorConn) SendResponse(packet *ber.Packet) error {
	c.lock.Lock()
	defer c.lock.Unlock()

	if c.isClosed {
		return errPacketTranslatorConnClosed
	}

	// Signal any goroutine waiting to read a response.
	defer c.responseCond.Broadcast()

	// Writes to the buffer should always succeed.
	c.responseBuf.Write(packet.Bytes())

	return nil
}

// Write is called by the processMessages() loop to send request packets.
func (c *packetTranslatorConn) Write(b []byte) (n int, err error) {
	c.lock.Lock()
	defer c.lock.Unlock()

	if c.isClosed {
		return 0, errPacketTranslatorConnClosed
	}

	// Signal any goroutine waiting to read a request.
	defer c.requestCond.Broadcast()

	// Writes to the buffer should always succeed.
	return c.requestBuf.Write(b)
}

// ReceiveRequest attempts to read a request packet from this connection. It
// will block until it is able to read a full request packet or until this
// connection is closed.
func (c *packetTranslatorConn) ReceiveRequest() (*ber.Packet, error) {
	c.lock.Lock()
	defer c.lock.Unlock()

	for !c.isClosed {
		// Attempt to parse a request packet from the request buffer.
		// If it fails with an unexpected EOF, wait and try again.
		requestReader := bytes.NewReader(c.requestBuf.Bytes())
		packet, err := ber.ReadPacket(requestReader)
		switch err {
		case io.EOF, io.ErrUnexpectedEOF:
			c.requestCond.Wait()
		case nil:
			// Advance the request buffer by the number of bytes
			// read to decode the request packet.
			c.requestBuf.Next(c.requestBuf.Len() - requestReader.Len())
			return packet, nil
		default:
			return nil, err
		}
	}

	return nil, errPacketTranslatorConnClosed
}

// Close closes this connection causing Read() and Write() calls to fail.
func (c *packetTranslatorConn) Close() error {
	c.lock.Lock()
	defer c.lock.Unlock()

	c.isClosed = true
	c.responseCond.Broadcast()
	c.requestCond.Broadcast()

	return nil
}

func (c *packetTranslatorConn) LocalAddr() net.Addr {
	return (*net.TCPAddr)(nil)
}

func (c *packetTranslatorConn) RemoteAddr() net.Addr {
	return (*net.TCPAddr)(nil)
}

func (c *packetTranslatorConn) SetDeadline(t time.Time) error {
	return nil
}

func (c *packetTranslatorConn) SetReadDeadline(t time.Time) error {
	return nil
}

func (c *packetTranslatorConn) SetWriteDeadline(t time.Time) error {
	return nil
}
