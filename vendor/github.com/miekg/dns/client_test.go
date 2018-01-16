package dns

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestDialUDP(t *testing.T) {
	HandleFunc("miek.nl.", HelloServer)
	defer HandleRemove("miek.nl.")

	s, addrstr, err := RunLocalUDPServer(":0")
	if err != nil {
		t.Fatalf("unable to run test server: %v", err)
	}
	defer s.Shutdown()

	m := new(Msg)
	m.SetQuestion("miek.nl.", TypeSOA)

	c := new(Client)
	conn, err := c.Dial(addrstr)
	if err != nil {
		t.Fatalf("failed to dial: %v", err)
	}
	if conn == nil {
		t.Fatalf("conn is nil")
	}
}

func TestClientSync(t *testing.T) {
	HandleFunc("miek.nl.", HelloServer)
	defer HandleRemove("miek.nl.")

	s, addrstr, err := RunLocalUDPServer(":0")
	if err != nil {
		t.Fatalf("unable to run test server: %v", err)
	}
	defer s.Shutdown()

	m := new(Msg)
	m.SetQuestion("miek.nl.", TypeSOA)

	c := new(Client)
	r, _, err := c.Exchange(m, addrstr)
	if err != nil {
		t.Fatalf("failed to exchange: %v", err)
	}
	if r == nil {
		t.Fatal("response is nil")
	}
	if r.Rcode != RcodeSuccess {
		t.Errorf("failed to get an valid answer\n%v", r)
	}
	// And now with plain Exchange().
	r, err = Exchange(m, addrstr)
	if err != nil {
		t.Errorf("failed to exchange: %v", err)
	}
	if r == nil || r.Rcode != RcodeSuccess {
		t.Errorf("failed to get an valid answer\n%v", r)
	}
}

func TestClientLocalAddress(t *testing.T) {
	HandleFunc("miek.nl.", HelloServerEchoAddrPort)
	defer HandleRemove("miek.nl.")

	s, addrstr, err := RunLocalUDPServer(":0")
	if err != nil {
		t.Fatalf("unable to run test server: %v", err)
	}
	defer s.Shutdown()

	m := new(Msg)
	m.SetQuestion("miek.nl.", TypeSOA)

	c := new(Client)
	laddr := net.UDPAddr{IP: net.ParseIP("0.0.0.0"), Port: 12345, Zone: ""}
	c.Dialer = &net.Dialer{LocalAddr: &laddr}
	r, _, err := c.Exchange(m, addrstr)
	if err != nil {
		t.Fatalf("failed to exchange: %v", err)
	}
	if r != nil && r.Rcode != RcodeSuccess {
		t.Errorf("failed to get an valid answer\n%v", r)
	}
	if len(r.Extra) != 1 {
		t.Errorf("failed to get additional answers\n%v", r)
	}
	txt := r.Extra[0].(*TXT)
	if txt == nil {
		t.Errorf("invalid TXT response\n%v", txt)
	}
	if len(txt.Txt) != 1 || !strings.Contains(txt.Txt[0], ":12345") {
		t.Errorf("invalid TXT response\n%v", txt.Txt)
	}
}

func TestClientTLSSyncV4(t *testing.T) {
	HandleFunc("miek.nl.", HelloServer)
	defer HandleRemove("miek.nl.")

	cert, err := tls.X509KeyPair(CertPEMBlock, KeyPEMBlock)
	if err != nil {
		t.Fatalf("unable to build certificate: %v", err)
	}

	config := tls.Config{
		Certificates: []tls.Certificate{cert},
	}

	s, addrstr, err := RunLocalTLSServer(":0", &config)
	if err != nil {
		t.Fatalf("unable to run test server: %v", err)
	}
	defer s.Shutdown()

	m := new(Msg)
	m.SetQuestion("miek.nl.", TypeSOA)

	c := new(Client)

	// test tcp-tls
	c.Net = "tcp-tls"
	c.TLSConfig = &tls.Config{
		InsecureSkipVerify: true,
	}

	r, _, err := c.Exchange(m, addrstr)
	if err != nil {
		t.Fatalf("failed to exchange: %v", err)
	}
	if r == nil {
		t.Fatal("response is nil")
	}
	if r.Rcode != RcodeSuccess {
		t.Errorf("failed to get an valid answer\n%v", r)
	}

	// test tcp4-tls
	c.Net = "tcp4-tls"
	c.TLSConfig = &tls.Config{
		InsecureSkipVerify: true,
	}

	r, _, err = c.Exchange(m, addrstr)
	if err != nil {
		t.Fatalf("failed to exchange: %v", err)
	}
	if r == nil {
		t.Fatal("response is nil")
	}
	if r.Rcode != RcodeSuccess {
		t.Errorf("failed to get an valid answer\n%v", r)
	}
}

func TestClientSyncBadID(t *testing.T) {
	HandleFunc("miek.nl.", HelloServerBadID)
	defer HandleRemove("miek.nl.")

	s, addrstr, err := RunLocalUDPServer(":0")
	if err != nil {
		t.Fatalf("unable to run test server: %v", err)
	}
	defer s.Shutdown()

	m := new(Msg)
	m.SetQuestion("miek.nl.", TypeSOA)

	c := new(Client)
	if _, _, err := c.Exchange(m, addrstr); err != ErrId {
		t.Errorf("did not find a bad Id")
	}
	// And now with plain Exchange().
	if _, err := Exchange(m, addrstr); err != ErrId {
		t.Errorf("did not find a bad Id")
	}
}

func TestClientEDNS0(t *testing.T) {
	HandleFunc("miek.nl.", HelloServer)
	defer HandleRemove("miek.nl.")

	s, addrstr, err := RunLocalUDPServer(":0")
	if err != nil {
		t.Fatalf("unable to run test server: %v", err)
	}
	defer s.Shutdown()

	m := new(Msg)
	m.SetQuestion("miek.nl.", TypeDNSKEY)

	m.SetEdns0(2048, true)

	c := new(Client)
	r, _, err := c.Exchange(m, addrstr)
	if err != nil {
		t.Fatalf("failed to exchange: %v", err)
	}

	if r != nil && r.Rcode != RcodeSuccess {
		t.Errorf("failed to get a valid answer\n%v", r)
	}
}

// Validates the transmission and parsing of local EDNS0 options.
func TestClientEDNS0Local(t *testing.T) {
	optStr1 := "1979:0x0707"
	optStr2 := strconv.Itoa(EDNS0LOCALSTART) + ":0x0601"

	handler := func(w ResponseWriter, req *Msg) {
		m := new(Msg)
		m.SetReply(req)

		m.Extra = make([]RR, 1, 2)
		m.Extra[0] = &TXT{Hdr: RR_Header{Name: m.Question[0].Name, Rrtype: TypeTXT, Class: ClassINET, Ttl: 0}, Txt: []string{"Hello local edns"}}

		// If the local options are what we expect, then reflect them back.
		ec1 := req.Extra[0].(*OPT).Option[0].(*EDNS0_LOCAL).String()
		ec2 := req.Extra[0].(*OPT).Option[1].(*EDNS0_LOCAL).String()
		if ec1 == optStr1 && ec2 == optStr2 {
			m.Extra = append(m.Extra, req.Extra[0])
		}

		w.WriteMsg(m)
	}

	HandleFunc("miek.nl.", handler)
	defer HandleRemove("miek.nl.")

	s, addrstr, err := RunLocalUDPServer(":0")
	if err != nil {
		t.Fatalf("unable to run test server: %s", err)
	}
	defer s.Shutdown()

	m := new(Msg)
	m.SetQuestion("miek.nl.", TypeTXT)

	// Add two local edns options to the query.
	ec1 := &EDNS0_LOCAL{Code: 1979, Data: []byte{7, 7}}
	ec2 := &EDNS0_LOCAL{Code: EDNS0LOCALSTART, Data: []byte{6, 1}}
	o := &OPT{Hdr: RR_Header{Name: ".", Rrtype: TypeOPT}, Option: []EDNS0{ec1, ec2}}
	m.Extra = append(m.Extra, o)

	c := new(Client)
	r, _, err := c.Exchange(m, addrstr)
	if err != nil {
		t.Fatalf("failed to exchange: %s", err)
	}

	if r == nil {
		t.Fatal("response is nil")
	}
	if r.Rcode != RcodeSuccess {
		t.Fatal("failed to get a valid answer")
	}

	txt := r.Extra[0].(*TXT).Txt[0]
	if txt != "Hello local edns" {
		t.Error("Unexpected result for miek.nl", txt, "!= Hello local edns")
	}

	// Validate the local options in the reply.
	got := r.Extra[1].(*OPT).Option[0].(*EDNS0_LOCAL).String()
	if got != optStr1 {
		t.Errorf("failed to get local edns0 answer; got %s, expected %s", got, optStr1)
	}

	got = r.Extra[1].(*OPT).Option[1].(*EDNS0_LOCAL).String()
	if got != optStr2 {
		t.Errorf("failed to get local edns0 answer; got %s, expected %s", got, optStr2)
	}
}

func TestClientConn(t *testing.T) {
	HandleFunc("miek.nl.", HelloServer)
	defer HandleRemove("miek.nl.")

	// This uses TCP just to make it slightly different than TestClientSync
	s, addrstr, err := RunLocalTCPServer(":0")
	if err != nil {
		t.Fatalf("unable to run test server: %v", err)
	}
	defer s.Shutdown()

	m := new(Msg)
	m.SetQuestion("miek.nl.", TypeSOA)

	cn, err := Dial("tcp", addrstr)
	if err != nil {
		t.Errorf("failed to dial %s: %v", addrstr, err)
	}

	err = cn.WriteMsg(m)
	if err != nil {
		t.Errorf("failed to exchange: %v", err)
	}
	r, err := cn.ReadMsg()
	if err != nil {
		t.Errorf("failed to get a valid answer: %v", err)
	}
	if r == nil || r.Rcode != RcodeSuccess {
		t.Errorf("failed to get an valid answer\n%v", r)
	}

	err = cn.WriteMsg(m)
	if err != nil {
		t.Errorf("failed to exchange: %v", err)
	}
	h := new(Header)
	buf, err := cn.ReadMsgHeader(h)
	if buf == nil {
		t.Errorf("failed to get an valid answer\n%v", r)
	}
	if err != nil {
		t.Errorf("failed to get a valid answer: %v", err)
	}
	if int(h.Bits&0xF) != RcodeSuccess {
		t.Errorf("failed to get an valid answer in ReadMsgHeader\n%v", r)
	}
	if h.Ancount != 0 || h.Qdcount != 1 || h.Nscount != 0 || h.Arcount != 1 {
		t.Errorf("expected to have question and additional in response; got something else: %+v", h)
	}
	if err = r.Unpack(buf); err != nil {
		t.Errorf("unable to unpack message fully: %v", err)
	}
}

func TestTruncatedMsg(t *testing.T) {
	m := new(Msg)
	m.SetQuestion("miek.nl.", TypeSRV)
	cnt := 10
	for i := 0; i < cnt; i++ {
		r := &SRV{
			Hdr:    RR_Header{Name: m.Question[0].Name, Rrtype: TypeSRV, Class: ClassINET, Ttl: 0},
			Port:   uint16(i + 8000),
			Target: "target.miek.nl.",
		}
		m.Answer = append(m.Answer, r)

		re := &A{
			Hdr: RR_Header{Name: m.Question[0].Name, Rrtype: TypeA, Class: ClassINET, Ttl: 0},
			A:   net.ParseIP(fmt.Sprintf("127.0.0.%d", i)).To4(),
		}
		m.Extra = append(m.Extra, re)
	}
	buf, err := m.Pack()
	if err != nil {
		t.Errorf("failed to pack: %v", err)
	}

	r := new(Msg)
	if err = r.Unpack(buf); err != nil {
		t.Errorf("unable to unpack message: %v", err)
	}
	if len(r.Answer) != cnt {
		t.Errorf("answer count after regular unpack doesn't match: %d", len(r.Answer))
	}
	if len(r.Extra) != cnt {
		t.Errorf("extra count after regular unpack doesn't match: %d", len(r.Extra))
	}

	m.Truncated = true
	buf, err = m.Pack()
	if err != nil {
		t.Errorf("failed to pack truncated: %v", err)
	}

	r = new(Msg)
	if err = r.Unpack(buf); err != nil && err != ErrTruncated {
		t.Errorf("unable to unpack truncated message: %v", err)
	}
	if !r.Truncated {
		t.Errorf("truncated message wasn't unpacked as truncated")
	}
	if len(r.Answer) != cnt {
		t.Errorf("answer count after truncated unpack doesn't match: %d", len(r.Answer))
	}
	if len(r.Extra) != cnt {
		t.Errorf("extra count after truncated unpack doesn't match: %d", len(r.Extra))
	}

	// Now we want to remove almost all of the extra records
	// We're going to loop over the extra to get the count of the size of all
	// of them
	off := 0
	buf1 := make([]byte, m.Len())
	for i := 0; i < len(m.Extra); i++ {
		off, err = PackRR(m.Extra[i], buf1, off, nil, m.Compress)
		if err != nil {
			t.Errorf("failed to pack extra: %v", err)
		}
	}

	// Remove all of the extra bytes but 10 bytes from the end of buf
	off -= 10
	buf1 = buf[:len(buf)-off]

	r = new(Msg)
	if err = r.Unpack(buf1); err != nil && err != ErrTruncated {
		t.Errorf("unable to unpack cutoff message: %v", err)
	}
	if !r.Truncated {
		t.Error("truncated cutoff message wasn't unpacked as truncated")
	}
	if len(r.Answer) != cnt {
		t.Errorf("answer count after cutoff unpack doesn't match: %d", len(r.Answer))
	}
	if len(r.Extra) != 0 {
		t.Errorf("extra count after cutoff unpack is not zero: %d", len(r.Extra))
	}

	// Now we want to remove almost all of the answer records too
	buf1 = make([]byte, m.Len())
	as := 0
	for i := 0; i < len(m.Extra); i++ {
		off1 := off
		off, err = PackRR(m.Extra[i], buf1, off, nil, m.Compress)
		as = off - off1
		if err != nil {
			t.Errorf("failed to pack extra: %v", err)
		}
	}

	// Keep exactly one answer left
	// This should still cause Answer to be nil
	off -= as
	buf1 = buf[:len(buf)-off]

	r = new(Msg)
	if err = r.Unpack(buf1); err != nil && err != ErrTruncated {
		t.Errorf("unable to unpack cutoff message: %v", err)
	}
	if !r.Truncated {
		t.Error("truncated cutoff message wasn't unpacked as truncated")
	}
	if len(r.Answer) != 0 {
		t.Errorf("answer count after second cutoff unpack is not zero: %d", len(r.Answer))
	}

	// Now leave only 1 byte of the question
	// Since the header is always 12 bytes, we just need to keep 13
	buf1 = buf[:13]

	r = new(Msg)
	err = r.Unpack(buf1)
	if err == nil || err == ErrTruncated {
		t.Errorf("error should not be ErrTruncated from question cutoff unpack: %v", err)
	}

	// Finally, if we only have the header, we don't return an error.
	buf1 = buf[:12]

	r = new(Msg)
	if err = r.Unpack(buf1); err != nil {
		t.Errorf("from header-only unpack should not return an error: %v", err)
	}
}

func TestTimeout(t *testing.T) {
	// Set up a dummy UDP server that won't respond
	addr, err := net.ResolveUDPAddr("udp", ":0")
	if err != nil {
		t.Fatalf("unable to resolve local udp address: %v", err)
	}
	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		t.Fatalf("unable to run test server: %v", err)
	}
	defer conn.Close()
	addrstr := conn.LocalAddr().String()

	// Message to send
	m := new(Msg)
	m.SetQuestion("miek.nl.", TypeTXT)

	// Use a channel + timeout to ensure we don't get stuck if the
	// Client Timeout is not working properly
	done := make(chan struct{}, 2)

	timeout := time.Millisecond
	allowable := timeout + (10 * time.Millisecond)
	abortAfter := timeout + (100 * time.Millisecond)

	start := time.Now()

	go func() {
		c := &Client{Timeout: timeout}
		_, _, err := c.Exchange(m, addrstr)
		if err == nil {
			t.Error("no timeout using Client.Exchange")
		}
		done <- struct{}{}
	}()

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()
		c := &Client{}
		_, _, err := c.ExchangeContext(ctx, m, addrstr)
		if err == nil {
			t.Error("no timeout using Client.ExchangeContext")
		}
		done <- struct{}{}
	}()

	// Wait for both the Exchange and ExchangeContext tests to be done.
	for i := 0; i < 2; i++ {
		select {
		case <-done:
		case <-time.After(abortAfter):
		}
	}

	length := time.Since(start)

	if length > allowable {
		t.Errorf("exchange took longer %v than specified Timeout %v", length, allowable)
	}
}

// Check that responses from deduplicated requests aren't shared between callers
func TestConcurrentExchanges(t *testing.T) {
	cases := make([]*Msg, 2)
	cases[0] = new(Msg)
	cases[1] = new(Msg)
	cases[1].Truncated = true
	for _, m := range cases {
		block := make(chan struct{})
		waiting := make(chan struct{})

		handler := func(w ResponseWriter, req *Msg) {
			r := m.Copy()
			r.SetReply(req)

			waiting <- struct{}{}
			<-block
			w.WriteMsg(r)
		}

		HandleFunc("miek.nl.", handler)
		defer HandleRemove("miek.nl.")

		s, addrstr, err := RunLocalUDPServer(":0")
		if err != nil {
			t.Fatalf("unable to run test server: %s", err)
		}
		defer s.Shutdown()

		m := new(Msg)
		m.SetQuestion("miek.nl.", TypeSRV)
		c := &Client{
			SingleInflight: true,
		}
		r := make([]*Msg, 2)

		var wg sync.WaitGroup
		wg.Add(len(r))
		for i := 0; i < len(r); i++ {
			go func(i int) {
				defer wg.Done()
				r[i], _, _ = c.Exchange(m.Copy(), addrstr)
				if r[i] == nil {
					t.Errorf("response %d is nil", i)
				}
			}(i)
		}
		select {
		case <-waiting:
		case <-time.After(time.Second):
			t.FailNow()
		}
		close(block)
		wg.Wait()

		if r[0] == r[1] {
			t.Errorf("got same response, expected non-shared responses")
		}
	}
}
