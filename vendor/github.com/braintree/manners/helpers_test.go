package manners

import (
	"bufio"
	"crypto/tls"
	"io/ioutil"
	"net"
	"net/http"
	"testing"
)

// a simple step-controllable http client
type client struct {
	tls         bool
	addr        net.Addr
	connected   chan error
	sendrequest chan bool
	response    chan *rawResponse
	closed      chan bool
}

type rawResponse struct {
	body []string
	err  error
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
				c.response <- &rawResponse{err: err}
			}
			// Read response; no content
			scanner := bufio.NewScanner(conn)
			var lines []string
			for scanner.Scan() {
				// our null handler doesn't send a body, so we know the request is
				// done when we reach the blank line after the headers
				line := scanner.Text()
				if line == "" {
					break
				}
				lines = append(lines, line)
			}
			c.response <- &rawResponse{lines, scanner.Err()}
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
		response:    make(chan *rawResponse),
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
