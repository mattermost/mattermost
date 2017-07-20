package memberlist

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
	"log"
	"net"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/hashicorp/go-msgpack/codec"
)

// As a regression we left this test very low-level and network-ey, even after
// we abstracted the transport. We added some basic network-free transport tests
// in transport_test.go to prove that we didn't hard code some network stuff
// outside of NetTransport.

func TestHandleCompoundPing(t *testing.T) {
	m := GetMemberlist(t)
	m.config.EnableCompression = false
	defer m.Shutdown()

	var udp *net.UDPConn
	for port := 60000; port < 61000; port++ {
		udpAddr := fmt.Sprintf("127.0.0.1:%d", port)
		udpLn, err := net.ListenPacket("udp", udpAddr)
		if err == nil {
			udp = udpLn.(*net.UDPConn)
			break
		}
	}

	if udp == nil {
		t.Fatalf("no udp listener")
	}

	// Encode a ping
	ping := ping{SeqNo: 42}
	buf, err := encode(pingMsg, ping)
	if err != nil {
		t.Fatalf("unexpected err %s", err)
	}

	// Make a compound message
	compound := makeCompoundMessage([][]byte{buf.Bytes(), buf.Bytes(), buf.Bytes()})

	// Send compound version
	addr := &net.UDPAddr{IP: net.ParseIP(m.config.BindAddr), Port: m.config.BindPort}
	udp.WriteTo(compound.Bytes(), addr)

	// Wait for responses
	doneCh := make(chan struct{}, 1)
	go func() {
		select {
		case <-doneCh:
		case <-time.After(2 * time.Second):
			panic("timeout")
		}
	}()

	for i := 0; i < 3; i++ {
		in := make([]byte, 1500)
		n, _, err := udp.ReadFrom(in)
		if err != nil {
			t.Fatalf("unexpected err %s", err)
		}
		in = in[0:n]

		msgType := messageType(in[0])
		if msgType != ackRespMsg {
			t.Fatalf("bad response %v", in)
		}

		var ack ackResp
		if err := decode(in[1:], &ack); err != nil {
			t.Fatalf("unexpected err %s", err)
		}

		if ack.SeqNo != 42 {
			t.Fatalf("bad sequence no")
		}
	}

	doneCh <- struct{}{}
}

func TestHandlePing(t *testing.T) {
	m := GetMemberlist(t)
	m.config.EnableCompression = false
	defer m.Shutdown()

	var udp *net.UDPConn
	for port := 60000; port < 61000; port++ {
		udpAddr := fmt.Sprintf("127.0.0.1:%d", port)
		udpLn, err := net.ListenPacket("udp", udpAddr)
		if err == nil {
			udp = udpLn.(*net.UDPConn)
			break
		}
	}

	if udp == nil {
		t.Fatalf("no udp listener")
	}

	// Encode a ping
	ping := ping{SeqNo: 42}
	buf, err := encode(pingMsg, ping)
	if err != nil {
		t.Fatalf("unexpected err %s", err)
	}

	// Send
	addr := &net.UDPAddr{IP: net.ParseIP(m.config.BindAddr), Port: m.config.BindPort}
	udp.WriteTo(buf.Bytes(), addr)

	// Wait for response
	doneCh := make(chan struct{}, 1)
	go func() {
		select {
		case <-doneCh:
		case <-time.After(2 * time.Second):
			panic("timeout")
		}
	}()

	in := make([]byte, 1500)
	n, _, err := udp.ReadFrom(in)
	if err != nil {
		t.Fatalf("unexpected err %s", err)
	}
	in = in[0:n]

	msgType := messageType(in[0])
	if msgType != ackRespMsg {
		t.Fatalf("bad response %v", in)
	}

	var ack ackResp
	if err := decode(in[1:], &ack); err != nil {
		t.Fatalf("unexpected err %s", err)
	}

	if ack.SeqNo != 42 {
		t.Fatalf("bad sequence no")
	}

	doneCh <- struct{}{}
}

func TestHandlePing_WrongNode(t *testing.T) {
	m := GetMemberlist(t)
	m.config.EnableCompression = false
	defer m.Shutdown()

	var udp *net.UDPConn
	for port := 60000; port < 61000; port++ {
		udpAddr := fmt.Sprintf("127.0.0.1:%d", port)
		udpLn, err := net.ListenPacket("udp", udpAddr)
		if err == nil {
			udp = udpLn.(*net.UDPConn)
			break
		}
	}

	if udp == nil {
		t.Fatalf("no udp listener")
	}

	// Encode a ping, wrong node!
	ping := ping{SeqNo: 42, Node: m.config.Name + "-bad"}
	buf, err := encode(pingMsg, ping)
	if err != nil {
		t.Fatalf("unexpected err %s", err)
	}

	// Send
	addr := &net.UDPAddr{IP: net.ParseIP(m.config.BindAddr), Port: m.config.BindPort}
	udp.WriteTo(buf.Bytes(), addr)

	// Wait for response
	udp.SetDeadline(time.Now().Add(50 * time.Millisecond))
	in := make([]byte, 1500)
	_, _, err = udp.ReadFrom(in)

	// Should get an i/o timeout
	if err == nil {
		t.Fatalf("expected err %s", err)
	}
}

func TestHandleIndirectPing(t *testing.T) {
	m := GetMemberlist(t)
	m.config.EnableCompression = false
	defer m.Shutdown()

	var udp *net.UDPConn
	for port := 60000; port < 61000; port++ {
		udpAddr := fmt.Sprintf("127.0.0.1:%d", port)
		udpLn, err := net.ListenPacket("udp", udpAddr)
		if err == nil {
			udp = udpLn.(*net.UDPConn)
			break
		}
	}

	if udp == nil {
		t.Fatalf("no udp listener")
	}

	// Encode an indirect ping
	ind := indirectPingReq{
		SeqNo:  100,
		Target: net.ParseIP(m.config.BindAddr),
		Port:   uint16(m.config.BindPort),
	}
	buf, err := encode(indirectPingMsg, &ind)
	if err != nil {
		t.Fatalf("unexpected err %s", err)
	}

	// Send
	addr := &net.UDPAddr{IP: net.ParseIP(m.config.BindAddr), Port: m.config.BindPort}
	udp.WriteTo(buf.Bytes(), addr)

	// Wait for response
	doneCh := make(chan struct{}, 1)
	go func() {
		select {
		case <-doneCh:
		case <-time.After(2 * time.Second):
			panic("timeout")
		}
	}()

	in := make([]byte, 1500)
	n, _, err := udp.ReadFrom(in)
	if err != nil {
		t.Fatalf("unexpected err %s", err)
	}
	in = in[0:n]

	msgType := messageType(in[0])
	if msgType != ackRespMsg {
		t.Fatalf("bad response %v", in)
	}

	var ack ackResp
	if err := decode(in[1:], &ack); err != nil {
		t.Fatalf("unexpected err %s", err)
	}

	if ack.SeqNo != 100 {
		t.Fatalf("bad sequence no")
	}

	doneCh <- struct{}{}
}

func TestTCPPing(t *testing.T) {
	var tcp *net.TCPListener
	var tcpAddr *net.TCPAddr
	for port := 60000; port < 61000; port++ {
		tcpAddr = &net.TCPAddr{IP: net.ParseIP("127.0.0.1"), Port: port}
		tcpLn, err := net.ListenTCP("tcp", tcpAddr)
		if err == nil {
			tcp = tcpLn
			break
		}
	}
	if tcp == nil {
		t.Fatalf("no tcp listener")
	}

	// Note that tcp gets closed in the last test, so we avoid a deferred
	// Close() call here.

	m := GetMemberlist(t)
	defer m.Shutdown()
	pingTimeout := m.config.ProbeInterval
	pingTimeMax := m.config.ProbeInterval + 10*time.Millisecond

	// Do a normal round trip.
	pingOut := ping{SeqNo: 23, Node: "mongo"}
	go func() {
		tcp.SetDeadline(time.Now().Add(pingTimeMax))
		conn, err := tcp.AcceptTCP()
		if err != nil {
			t.Fatalf("failed to connect: %s", err)
		}
		defer conn.Close()

		msgType, _, dec, err := m.readStream(conn)
		if err != nil {
			t.Fatalf("failed to read ping: %s", err)
		}

		if msgType != pingMsg {
			t.Fatalf("expecting ping, got message type (%d)", msgType)
		}

		var pingIn ping
		if err := dec.Decode(&pingIn); err != nil {
			t.Fatalf("failed to decode ping: %s", err)
		}

		if pingIn.SeqNo != pingOut.SeqNo {
			t.Fatalf("sequence number isn't correct (%d) vs (%d)", pingIn.SeqNo, pingOut.SeqNo)
		}

		if pingIn.Node != pingOut.Node {
			t.Fatalf("node name isn't correct (%s) vs (%s)", pingIn.Node, pingOut.Node)
		}

		ack := ackResp{pingIn.SeqNo, nil}
		out, err := encode(ackRespMsg, &ack)
		if err != nil {
			t.Fatalf("failed to encode ack: %s", err)
		}

		err = m.rawSendMsgStream(conn, out.Bytes())
		if err != nil {
			t.Fatalf("failed to send ack: %s", err)
		}
	}()
	deadline := time.Now().Add(pingTimeout)
	didContact, err := m.sendPingAndWaitForAck(tcpAddr.String(), pingOut, deadline)
	if err != nil {
		t.Fatalf("error trying to ping: %s", err)
	}
	if !didContact {
		t.Fatalf("expected successful ping")
	}

	// Make sure a mis-matched sequence number is caught.
	go func() {
		tcp.SetDeadline(time.Now().Add(pingTimeMax))
		conn, err := tcp.AcceptTCP()
		if err != nil {
			t.Fatalf("failed to connect: %s", err)
		}
		defer conn.Close()

		_, _, dec, err := m.readStream(conn)
		if err != nil {
			t.Fatalf("failed to read ping: %s", err)
		}

		var pingIn ping
		if err := dec.Decode(&pingIn); err != nil {
			t.Fatalf("failed to decode ping: %s", err)
		}

		ack := ackResp{pingIn.SeqNo + 1, nil}
		out, err := encode(ackRespMsg, &ack)
		if err != nil {
			t.Fatalf("failed to encode ack: %s", err)
		}

		err = m.rawSendMsgStream(conn, out.Bytes())
		if err != nil {
			t.Fatalf("failed to send ack: %s", err)
		}
	}()
	deadline = time.Now().Add(pingTimeout)
	didContact, err = m.sendPingAndWaitForAck(tcpAddr.String(), pingOut, deadline)
	if err == nil || !strings.Contains(err.Error(), "Sequence number") {
		t.Fatalf("expected an error from mis-matched sequence number")
	}
	if didContact {
		t.Fatalf("expected failed ping")
	}

	// Make sure an unexpected message type is handled gracefully.
	go func() {
		tcp.SetDeadline(time.Now().Add(pingTimeMax))
		conn, err := tcp.AcceptTCP()
		if err != nil {
			t.Fatalf("failed to connect: %s", err)
		}
		defer conn.Close()

		_, _, _, err = m.readStream(conn)
		if err != nil {
			t.Fatalf("failed to read ping: %s", err)
		}

		bogus := indirectPingReq{}
		out, err := encode(indirectPingMsg, &bogus)
		if err != nil {
			t.Fatalf("failed to encode bogus msg: %s", err)
		}

		err = m.rawSendMsgStream(conn, out.Bytes())
		if err != nil {
			t.Fatalf("failed to send bogus msg: %s", err)
		}
	}()
	deadline = time.Now().Add(pingTimeout)
	didContact, err = m.sendPingAndWaitForAck(tcpAddr.String(), pingOut, deadline)
	if err == nil || !strings.Contains(err.Error(), "Unexpected msgType") {
		t.Fatalf("expected an error from bogus message")
	}
	if didContact {
		t.Fatalf("expected failed ping")
	}

	// Make sure failed I/O respects the deadline. In this case we try the
	// common case of the receiving node being totally down.
	tcp.Close()
	deadline = time.Now().Add(pingTimeout)
	startPing := time.Now()
	didContact, err = m.sendPingAndWaitForAck(tcpAddr.String(), pingOut, deadline)
	pingTime := time.Now().Sub(startPing)
	if err != nil {
		t.Fatalf("expected no error during ping on closed socket, got: %s", err)
	}
	if didContact {
		t.Fatalf("expected failed ping")
	}
	if pingTime > pingTimeMax {
		t.Fatalf("took too long to fail ping, %9.6f", pingTime.Seconds())
	}
}

func TestTCPPushPull(t *testing.T) {
	m := GetMemberlist(t)
	defer m.Shutdown()
	m.nodes = append(m.nodes, &nodeState{
		Node: Node{
			Name: "Test 0",
			Addr: net.ParseIP(m.config.BindAddr),
			Port: uint16(m.config.BindPort),
		},
		Incarnation: 0,
		State:       stateSuspect,
		StateChange: time.Now().Add(-1 * time.Second),
	})

	addr := fmt.Sprintf("%s:%d", m.config.BindAddr, m.config.BindPort)
	conn, err := net.Dial("tcp", addr)
	if err != nil {
		t.Fatalf("unexpected err %s", err)
	}
	defer conn.Close()

	localNodes := make([]pushNodeState, 3)
	localNodes[0].Name = "Test 0"
	localNodes[0].Addr = net.ParseIP(m.config.BindAddr)
	localNodes[0].Port = uint16(m.config.BindPort)
	localNodes[0].Incarnation = 1
	localNodes[0].State = stateAlive
	localNodes[1].Name = "Test 1"
	localNodes[1].Addr = net.ParseIP(m.config.BindAddr)
	localNodes[1].Port = uint16(m.config.BindPort)
	localNodes[1].Incarnation = 1
	localNodes[1].State = stateAlive
	localNodes[2].Name = "Test 2"
	localNodes[2].Addr = net.ParseIP(m.config.BindAddr)
	localNodes[2].Port = uint16(m.config.BindPort)
	localNodes[2].Incarnation = 1
	localNodes[2].State = stateAlive

	// Send our node state
	header := pushPullHeader{Nodes: 3}
	hd := codec.MsgpackHandle{}
	enc := codec.NewEncoder(conn, &hd)

	// Send the push/pull indicator
	conn.Write([]byte{byte(pushPullMsg)})

	if err := enc.Encode(&header); err != nil {
		t.Fatalf("unexpected err %s", err)
	}
	for i := 0; i < header.Nodes; i++ {
		if err := enc.Encode(&localNodes[i]); err != nil {
			t.Fatalf("unexpected err %s", err)
		}
	}

	// Read the message type
	var msgType messageType
	if err := binary.Read(conn, binary.BigEndian, &msgType); err != nil {
		t.Fatalf("unexpected err %s", err)
	}

	var bufConn io.Reader = conn
	msghd := codec.MsgpackHandle{}
	dec := codec.NewDecoder(bufConn, &msghd)

	// Check if we have a compressed message
	if msgType == compressMsg {
		var c compress
		if err := dec.Decode(&c); err != nil {
			t.Fatalf("unexpected err %s", err)
		}
		decomp, err := decompressBuffer(&c)
		if err != nil {
			t.Fatalf("unexpected err %s", err)
		}

		// Reset the message type
		msgType = messageType(decomp[0])

		// Create a new bufConn
		bufConn = bytes.NewReader(decomp[1:])

		// Create a new decoder
		dec = codec.NewDecoder(bufConn, &hd)
	}

	// Quit if not push/pull
	if msgType != pushPullMsg {
		t.Fatalf("bad message type")
	}

	if err := dec.Decode(&header); err != nil {
		t.Fatalf("unexpected err %s", err)
	}

	// Allocate space for the transfer
	remoteNodes := make([]pushNodeState, header.Nodes)

	// Try to decode all the states
	for i := 0; i < header.Nodes; i++ {
		if err := dec.Decode(&remoteNodes[i]); err != nil {
			t.Fatalf("unexpected err %s", err)
		}
	}

	if len(remoteNodes) != 1 {
		t.Fatalf("bad response")
	}

	n := &remoteNodes[0]
	if n.Name != "Test 0" {
		t.Fatalf("bad name")
	}
	if bytes.Compare(n.Addr, net.ParseIP(m.config.BindAddr)) != 0 {
		t.Fatal("bad addr")
	}
	if n.Incarnation != 0 {
		t.Fatal("bad incarnation")
	}
	if n.State != stateSuspect {
		t.Fatal("bad state")
	}
}

func TestSendMsg_Piggyback(t *testing.T) {
	m := GetMemberlist(t)
	defer m.Shutdown()

	// Add a message to be broadcast
	a := alive{
		Incarnation: 10,
		Node:        "rand",
		Addr:        []byte{127, 0, 0, 255},
		Meta:        nil,
	}
	m.encodeAndBroadcast("rand", aliveMsg, &a)

	var udp *net.UDPConn
	for port := 60000; port < 61000; port++ {
		udpAddr := fmt.Sprintf("127.0.0.1:%d", port)
		udpLn, err := net.ListenPacket("udp", udpAddr)
		if err == nil {
			udp = udpLn.(*net.UDPConn)
			break
		}
	}

	// Encode a ping
	ping := ping{SeqNo: 42}
	buf, err := encode(pingMsg, ping)
	if err != nil {
		t.Fatalf("unexpected err %s", err)
	}

	// Send
	addr := &net.UDPAddr{IP: net.ParseIP(m.config.BindAddr), Port: m.config.BindPort}
	udp.WriteTo(buf.Bytes(), addr)

	// Wait for response
	doneCh := make(chan struct{}, 1)
	go func() {
		select {
		case <-doneCh:
		case <-time.After(2 * time.Second):
			panic("timeout")
		}
	}()

	in := make([]byte, 1500)
	n, _, err := udp.ReadFrom(in)
	if err != nil {
		t.Fatalf("unexpected err %s", err)
	}
	in = in[0:n]

	msgType := messageType(in[0])
	if msgType != compoundMsg {
		t.Fatalf("bad response %v", in)
	}

	// get the parts
	trunc, parts, err := decodeCompoundMessage(in[1:])
	if trunc != 0 {
		t.Fatalf("unexpected truncation")
	}
	if len(parts) != 2 {
		t.Fatalf("unexpected parts %v", parts)
	}
	if err != nil {
		t.Fatalf("unexpected err %s", err)
	}

	var ack ackResp
	if err := decode(parts[0][1:], &ack); err != nil {
		t.Fatalf("unexpected err %s", err)
	}

	if ack.SeqNo != 42 {
		t.Fatalf("bad sequence no")
	}

	var aliveout alive
	if err := decode(parts[1][1:], &aliveout); err != nil {
		t.Fatalf("unexpected err %s", err)
	}

	if aliveout.Node != "rand" || aliveout.Incarnation != 10 {
		t.Fatalf("bad mesg")
	}

	doneCh <- struct{}{}
}

func TestEncryptDecryptState(t *testing.T) {
	state := []byte("this is our internal state...")
	config := &Config{
		SecretKey:       []byte{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15},
		ProtocolVersion: ProtocolVersionMax,
	}

	m, err := Create(config)
	if err != nil {
		t.Fatalf("err: %s", err)
	}
	defer m.Shutdown()

	crypt, err := m.encryptLocalState(state)
	if err != nil {
		t.Fatalf("err: %v", err)
	}

	// Create reader, seek past the type byte
	buf := bytes.NewReader(crypt)
	buf.Seek(1, 0)

	plain, err := m.decryptRemoteState(buf)
	if err != nil {
		t.Fatalf("err: %v", err)
	}

	if !reflect.DeepEqual(state, plain) {
		t.Fatalf("Decrypt failed: %v", plain)
	}
}

func TestRawSendUdp_CRC(t *testing.T) {
	m := GetMemberlist(t)
	m.config.EnableCompression = false
	defer m.Shutdown()

	var udp *net.UDPConn
	for port := 60000; port < 61000; port++ {
		udpAddr := fmt.Sprintf("127.0.0.1:%d", port)
		udpLn, err := net.ListenPacket("udp", udpAddr)
		if err == nil {
			udp = udpLn.(*net.UDPConn)
			break
		}
	}

	if udp == nil {
		t.Fatalf("no udp listener")
	}

	// Pass a nil node with no nodes registered, should result in no checksum
	payload := []byte{3, 3, 3, 3}
	m.rawSendMsgPacket(udp.LocalAddr().String(), nil, payload)

	in := make([]byte, 1500)
	n, _, err := udp.ReadFrom(in)
	if err != nil {
		t.Fatalf("unexpected err %s", err)
	}
	in = in[0:n]

	if len(in) != 4 {
		t.Fatalf("bad: %v", in)
	}

	// Pass a non-nil node with PMax >= 5, should result in a checksum
	m.rawSendMsgPacket(udp.LocalAddr().String(), &Node{PMax: 5}, payload)

	in = make([]byte, 1500)
	n, _, err = udp.ReadFrom(in)
	if err != nil {
		t.Fatalf("unexpected err %s", err)
	}
	in = in[0:n]

	if len(in) != 9 {
		t.Fatalf("bad: %v", in)
	}

	// Register a node with PMax >= 5 to be looked up, should result in a checksum
	m.nodeMap["127.0.0.1"] = &nodeState{
		Node: Node{PMax: 5},
	}
	m.rawSendMsgPacket(udp.LocalAddr().String(), nil, payload)

	in = make([]byte, 1500)
	n, _, err = udp.ReadFrom(in)
	if err != nil {
		t.Fatalf("unexpected err %s", err)
	}
	in = in[0:n]

	if len(in) != 9 {
		t.Fatalf("bad: %v", in)
	}
}

func TestIngestPacket_CRC(t *testing.T) {
	m := GetMemberlist(t)
	m.config.EnableCompression = false
	defer m.Shutdown()

	var udp *net.UDPConn
	for port := 60000; port < 61000; port++ {
		udpAddr := fmt.Sprintf("127.0.0.1:%d", port)
		udpLn, err := net.ListenPacket("udp", udpAddr)
		if err == nil {
			udp = udpLn.(*net.UDPConn)
			break
		}
	}

	if udp == nil {
		t.Fatalf("no udp listener")
	}

	// Get a message with a checksum
	payload := []byte{3, 3, 3, 3}
	m.rawSendMsgPacket(udp.LocalAddr().String(), &Node{PMax: 5}, payload)

	in := make([]byte, 1500)
	n, _, err := udp.ReadFrom(in)
	if err != nil {
		t.Fatalf("unexpected err %s", err)
	}
	in = in[0:n]

	if len(in) != 9 {
		t.Fatalf("bad: %v", in)
	}

	// Corrupt the checksum
	in[1] <<= 1

	logs := &bytes.Buffer{}
	logger := log.New(logs, "", 0)
	m.logger = logger
	m.ingestPacket(in, udp.LocalAddr(), time.Now())

	if !strings.Contains(logs.String(), "invalid checksum") {
		t.Fatalf("bad: %s", logs.String())
	}
}

func TestGossip_MismatchedKeys(t *testing.T) {
	c1 := testConfig()
	c2 := testConfig()

	// Create two agents with different gossip keys
	c1.SecretKey = []byte("4W6DGn2VQVqDEceOdmuRTQ==")
	c2.SecretKey = []byte("XhX/w702/JKKK7/7OtM9Ww==")

	m1, err := Create(c1)
	if err != nil {
		t.Fatalf("err: %s", err)
	}
	defer m1.Shutdown()

	m2, err := Create(c2)
	if err != nil {
		t.Fatalf("err: %s", err)
	}
	defer m2.Shutdown()

	// Make sure we get this error on the joining side
	_, err = m2.Join([]string{c1.BindAddr})
	if err == nil || !strings.Contains(err.Error(), "No installed keys could decrypt the message") {
		t.Fatalf("bad: %s", err)
	}
}
