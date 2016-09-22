package manners

import (
	"bufio"
	"crypto/tls"
	"errors"
	"io/ioutil"
	"net"
	"net/http"
	"os"
	"sync"
	"testing"
)

func newServer() *GracefulServer {
	return NewWithServer(new(http.Server))
}

// a simple step-controllable http client
type client struct {
	tls         bool
	addr        net.Addr
	connected   chan error
	sendrequest chan bool
	idle        chan error
	idlerelease chan bool
	closed      chan bool
}

func (c *client) Run() {
	go func() {
		var err error
		conn, err := net.Dial(c.addr.Network(), c.addr.String())
		if err != nil {
			c.connected <- err
			return
		}
		if c.tls {
			conn = tls.Client(conn, &tls.Config{InsecureSkipVerify: true})
		}
		c.connected <- nil
		for <-c.sendrequest {
			_, err = conn.Write([]byte("GET / HTTP/1.1\nHost: localhost:8000\n\n"))
			if err != nil {
				c.idle <- err
			}
			// Read response; no content
			scanner := bufio.NewScanner(conn)
			for scanner.Scan() {
				// our null handler doesn't send a body, so we know the request is
				// done when we reach the blank line after the headers
				if scanner.Text() == "" {
					break
				}
			}
			c.idle <- scanner.Err()
			<-c.idlerelease
		}
		conn.Close()
		ioutil.ReadAll(conn)
		c.closed <- true
	}()
}

func newClient(addr net.Addr, tls bool) *client {
	return &client{
		addr:        addr,
		tls:         tls,
		connected:   make(chan error),
		sendrequest: make(chan bool),
		idle:        make(chan error),
		idlerelease: make(chan bool),
		closed:      make(chan bool),
	}
}

// a handler that returns 200 ok with no body
var nullHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})

func startGenericServer(t *testing.T, server *GracefulServer, statechanged chan http.ConnState, runner func() error) (l net.Listener, errc chan error) {
	server.Addr = "localhost:0"
	server.Handler = nullHandler
	if statechanged != nil {
		// Wrap the ConnState handler with something that will notify
		// the statechanged channel when a state change happens
		server.ConnState = func(conn net.Conn, newState http.ConnState) {
			statechanged <- newState
		}
	}

	//server.up = make(chan chan bool))
	server.up = make(chan net.Listener)
	exitchan := make(chan error)

	go func() {
		exitchan <- runner()
	}()

	// wait for server socket to be bound
	select {
	case l = <-server.up:
		// all good

	case err := <-exitchan:
		// all bad
		t.Fatal("Server failed to start", err)
	}
	return l, exitchan
}

func startServer(t *testing.T, server *GracefulServer, statechanged chan http.ConnState) (
	l net.Listener, errc chan error) {
	return startGenericServer(t, server, statechanged, server.ListenAndServe)
}

func startTLSServer(t *testing.T, server *GracefulServer, certFile, keyFile string, statechanged chan http.ConnState) (l net.Listener, errc chan error) {
	runner := func() error {
		return server.ListenAndServeTLS(certFile, keyFile)
	}

	return startGenericServer(t, server, statechanged, runner)
}

type tempFile struct {
	*os.File
}

func newTempFile(content []byte) (*tempFile, error) {
	f, err := ioutil.TempFile("", "graceful-test")
	if err != nil {
		return nil, err
	}

	f.Write(content)
	return &tempFile{f}, nil
}

func (tf *tempFile) Unlink() {
	if tf.File != nil {
		os.Remove(tf.Name())
		tf.File = nil
	}
}

type testWg struct {
	sync.Mutex
	count      int
	waitCalled chan int
}

func newTestWg() *testWg {
	return &testWg{
		waitCalled: make(chan int, 1),
	}
}

func (wg *testWg) Add(delta int) {
	wg.Lock()
	wg.count++
	wg.Unlock()
}

func (wg *testWg) Done() {
	wg.Lock()
	wg.count--
	wg.Unlock()
}

func (wg *testWg) Wait() {
	wg.Lock()
	wg.waitCalled <- wg.count
	wg.Unlock()
}

type fakeConn struct {
	net.Conn
	closeCalled bool
}

func (c *fakeConn) Close() error {
	c.closeCalled = true
	return nil
}

type fakeListener struct {
	acceptRelease chan bool
	closeCalled   chan bool
}

func newFakeListener() *fakeListener { return &fakeListener{make(chan bool, 1), make(chan bool, 1)} }

func (l *fakeListener) Addr() net.Addr {
	addr, _ := net.ResolveTCPAddr("tcp", "127.0.0.1:8080")
	return addr
}

func (l *fakeListener) Close() error {
	l.closeCalled <- true
	l.acceptRelease <- true
	return nil
}

func (l *fakeListener) Accept() (net.Conn, error) {
	<-l.acceptRelease
	return nil, errors.New("connection closed")
}

// localhostCert is a PEM-encoded TLS cert with SAN IPs
// "127.0.0.1" and "[::1]", expiring at the last second of 2049 (the end
// of ASN.1 time).
// generated from src/pkg/crypto/tls:
// go run generate_cert.go  --rsa-bits 512 --host 127.0.0.1,::1,example.com --ca --start-date "Jan 1 00:00:00 1970" --duration=1000000h
var (
	localhostCert = []byte(`-----BEGIN CERTIFICATE-----
MIIBdzCCASOgAwIBAgIBADALBgkqhkiG9w0BAQUwEjEQMA4GA1UEChMHQWNtZSBD
bzAeFw03MDAxMDEwMDAwMDBaFw00OTEyMzEyMzU5NTlaMBIxEDAOBgNVBAoTB0Fj
bWUgQ28wWjALBgkqhkiG9w0BAQEDSwAwSAJBAN55NcYKZeInyTuhcCwFMhDHCmwa
IUSdtXdcbItRB/yfXGBhiex00IaLXQnSU+QZPRZWYqeTEbFSgihqi1PUDy8CAwEA
AaNoMGYwDgYDVR0PAQH/BAQDAgCkMBMGA1UdJQQMMAoGCCsGAQUFBwMBMA8GA1Ud
EwEB/wQFMAMBAf8wLgYDVR0RBCcwJYILZXhhbXBsZS5jb22HBH8AAAGHEAAAAAAA
AAAAAAAAAAAAAAEwCwYJKoZIhvcNAQEFA0EAAoQn/ytgqpiLcZu9XKbCJsJcvkgk
Se6AbGXgSlq+ZCEVo0qIwSgeBqmsJxUu7NCSOwVJLYNEBO2DtIxoYVk+MA==
-----END CERTIFICATE-----`)

	localhostKey = []byte(`-----BEGIN RSA PRIVATE KEY-----
MIIBPAIBAAJBAN55NcYKZeInyTuhcCwFMhDHCmwaIUSdtXdcbItRB/yfXGBhiex0
0IaLXQnSU+QZPRZWYqeTEbFSgihqi1PUDy8CAwEAAQJBAQdUx66rfh8sYsgfdcvV
NoafYpnEcB5s4m/vSVe6SU7dCK6eYec9f9wpT353ljhDUHq3EbmE4foNzJngh35d
AekCIQDhRQG5Li0Wj8TM4obOnnXUXf1jRv0UkzE9AHWLG5q3AwIhAPzSjpYUDjVW
MCUXgckTpKCuGwbJk7424Nb8bLzf3kllAiA5mUBgjfr/WtFSJdWcPQ4Zt9KTMNKD
EUO0ukpTwEIl6wIhAMbGqZK3zAAFdq8DD2jPx+UJXnh0rnOkZBzDtJ6/iN69AiEA
1Aq8MJgTaYsDQWyU/hDq5YkDJc9e9DSCvUIzqxQWMQE=
-----END RSA PRIVATE KEY-----`)
)
