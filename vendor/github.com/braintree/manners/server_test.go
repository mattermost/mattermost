package manners

import (
	"net"
	"net/http"
	"testing"
	"time"
)

// Tests that the server allows in-flight requests to complete
// before shutting down.
func TestGracefulness(t *testing.T) {
	server := newServer()
	wg := newTestWg()
	server.wg = wg
	statechanged := make(chan http.ConnState)
	listener, exitchan := startServer(t, server, statechanged)

	client := newClient(listener.Addr(), false)
	client.Run()

	// wait for client to connect, but don't let it send the request yet
	if err := <-client.connected; err != nil {
		t.Fatal("Client failed to connect to server", err)
	}
	// avoid a race between the client connection and the server accept
	if state := <-statechanged; state != http.StateNew {
		t.Fatal("Unexpected state", state)
	}

	server.Close()

	waiting := <-wg.waitCalled
	if waiting < 1 {
		t.Errorf("Expected the waitgroup to equal 1 at shutdown; actually %d", waiting)
	}

	// allow the client to finish sending the request and make sure the server exits after
	// (client will be in connected but idle state at that point)
	client.sendrequest <- true
	close(client.sendrequest)
	if err := <-exitchan; err != nil {
		t.Error("Unexpected error during shutdown", err)
	}
}

// Tests that the server begins to shut down when told to and does not accept
// new requests once shutdown has begun
func TestShutdown(t *testing.T) {
	server := newServer()
	wg := newTestWg()
	server.wg = wg
	statechanged := make(chan http.ConnState)
	listener, exitchan := startServer(t, server, statechanged)

	client1 := newClient(listener.Addr(), false)
	client1.Run()

	// wait for client1 to connect
	if err := <-client1.connected; err != nil {
		t.Fatal("Client failed to connect to server", err)
	}
	// avoid a race between the client connection and the server accept
	if state := <-statechanged; state != http.StateNew {
		t.Fatal("Unexpected state", state)
	}

	// start the shutdown; once it hits waitgroup.Wait()
	// the listener should of been closed, though client1 is still connected
	if server.Close() != true {
		t.Fatal("first call to Close returned false")
	}
	if server.Close() != false {
		t.Fatal("second call to Close returned true")
	}

	waiting := <-wg.waitCalled
	if waiting != 1 {
		t.Errorf("Waitcount should be one, got %d", waiting)
	}

	// should get connection refused at this point
	client2 := newClient(listener.Addr(), false)
	client2.Run()

	if err := <-client2.connected; err == nil {
		t.Fatal("client2 connected when it should of received connection refused")
	}

	// let client1 finish so the server can exit
	close(client1.sendrequest) // don't bother sending an actual request

	<-exitchan
}

// Test that a connection is closed upon reaching an idle state if and only if the server
// is shutting down.
func TestCloseOnIdle(t *testing.T) {
	server := newServer()
	wg := newTestWg()
	server.wg = wg
	fl := newFakeListener()
	runner := func() error {
		return server.Serve(fl)
	}

	startGenericServer(t, server, nil, runner)

	// Change to idle state while server is not closing; Close should not be called
	conn := &fakeConn{}
	server.ConnState(conn, http.StateIdle)
	if conn.closeCalled {
		t.Error("Close was called unexpected")
	}

	server.Close()

	// wait until the server calls Close() on the listener
	// by that point the atomic closing variable will have been updated, avoiding a race.
	<-fl.closeCalled

	conn = &fakeConn{}
	server.ConnState(conn, http.StateIdle)
	if !conn.closeCalled {
		t.Error("Close was not called")
	}
}

func waitForState(t *testing.T, waiter chan http.ConnState, state http.ConnState, errmsg string) {
	for {
		select {
		case ns := <-waiter:
			if ns == state {
				return
			}
		case <-time.After(time.Second):
			t.Fatal(errmsg)
		}
	}
}

// Test that a request moving from active->idle->active using an actual
// network connection still results in a corect shutdown
func TestStateTransitionActiveIdleActive(t *testing.T) {
	server := newServer()
	wg := newTestWg()
	statechanged := make(chan http.ConnState)
	server.wg = wg
	listener, exitchan := startServer(t, server, statechanged)

	client := newClient(listener.Addr(), false)
	client.Run()

	// wait for client to connect, but don't let it send the request
	if err := <-client.connected; err != nil {
		t.Fatal("Client failed to connect to server", err)
	}

	for i := 0; i < 2; i++ {
		client.sendrequest <- true
		waitForState(t, statechanged, http.StateActive, "Client failed to reach active state")
		<-client.idle
		client.idlerelease <- true
		waitForState(t, statechanged, http.StateIdle, "Client failed to reach idle state")
	}

	// client is now in an idle state

	server.Close()
	waiting := <-wg.waitCalled
	if waiting != 0 {
		t.Errorf("Waitcount should be zero, got %d", waiting)
	}

	if err := <-exitchan; err != nil {
		t.Error("Unexpected error during shutdown", err)
	}
}

// Test state transitions from new->active->-idle->closed using an actual
// network connection and make sure the waitgroup count is correct at the end.
func TestStateTransitionActiveIdleClosed(t *testing.T) {
	var (
		listener net.Listener
		exitchan chan error
	)

	keyFile, err1 := newTempFile(localhostKey)
	certFile, err2 := newTempFile(localhostCert)
	defer keyFile.Unlink()
	defer certFile.Unlink()

	if err1 != nil || err2 != nil {
		t.Fatal("Failed to create temporary files", err1, err2)
	}

	for _, withTLS := range []bool{false, true} {
		server := newServer()
		wg := newTestWg()
		statechanged := make(chan http.ConnState)
		server.wg = wg
		if withTLS {
			listener, exitchan = startTLSServer(t, server, certFile.Name(), keyFile.Name(), statechanged)
		} else {
			listener, exitchan = startServer(t, server, statechanged)
		}

		client := newClient(listener.Addr(), withTLS)
		client.Run()

		// wait for client to connect, but don't let it send the request
		if err := <-client.connected; err != nil {
			t.Fatal("Client failed to connect to server", err)
		}

		client.sendrequest <- true
		waitForState(t, statechanged, http.StateActive, "Client failed to reach active state")

		err := <-client.idle
		if err != nil {
			t.Fatalf("tls=%t unexpected error from client %s", withTLS, err)
		}

		client.idlerelease <- true
		waitForState(t, statechanged, http.StateIdle, "Client failed to reach idle state")

		// client is now in an idle state
		close(client.sendrequest)
		<-client.closed
		waitForState(t, statechanged, http.StateClosed, "Client failed to reach closed state")

		server.Close()
		waiting := <-wg.waitCalled
		if waiting != 0 {
			t.Errorf("Waitcount should be zero, got %d", waiting)
		}

		if err := <-exitchan; err != nil {
			t.Error("Unexpected error during shutdown", err)
		}
	}
}
