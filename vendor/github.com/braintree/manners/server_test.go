package manners

import (
	"net"
	"net/http"
	"testing"
	"time"

	helpers "github.com/braintree/manners/test_helpers"
)

type httpInterface interface {
	ListenAndServe() error
	ListenAndServeTLS(certFile, keyFile string) error
	Serve(listener net.Listener) error
}

// Test that the method signatures of the methods we override from net/http/Server match those of the original.
func TestInterface(t *testing.T) {
	var original, ours interface{}
	original = &http.Server{}
	ours = &GracefulServer{}
	if _, ok := original.(httpInterface); !ok {
		t.Errorf("httpInterface definition does not match the canonical server!")
	}
	if _, ok := ours.(httpInterface); !ok {
		t.Errorf("GracefulServer does not implement httpInterface")
	}
}

// Tests that the server allows in-flight requests to complete
// before shutting down.
func TestGracefulness(t *testing.T) {
	server := NewServer()
	wg := helpers.NewWaitGroup()
	server.wg = wg
	statechanged := make(chan http.ConnState)
	listener, exitchan := startServer(t, server, statechanged)

	client := newClient(listener.Addr(), false)
	client.Run()

	// wait for client to connect, but don't let it send the request yet
	if err := <-client.connected; err != nil {
		t.Fatal("Client failed to connect to server", err)
	}
	// Even though the client is connected, the server ConnState handler may
	// not know about that yet. So wait until it is called.
	waitForState(t, statechanged, http.StateNew, "Request not received")

	server.Close()

	waiting := <-wg.WaitCalled
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

// Tests that starting the server and closing in 2 new, separate goroutines doesnot
// get flagged by the race detector (need to run 'go test' w/the -race flag)
func TestRacyClose(t *testing.T) {
	go func() {
		ListenAndServe(":9000", nil)
	}()

	go func() {
		Close()
	}()
}

// Tests that the server begins to shut down when told to and does not accept
// new requests once shutdown has begun
func TestShutdown(t *testing.T) {
	server := NewServer()
	wg := helpers.NewWaitGroup()
	server.wg = wg
	statechanged := make(chan http.ConnState)
	listener, exitchan := startServer(t, server, statechanged)

	client1 := newClient(listener.Addr(), false)
	client1.Run()

	// wait for client1 to connect
	if err := <-client1.connected; err != nil {
		t.Fatal("Client failed to connect to server", err)
	}
	// Even though the client is connected, the server ConnState handler may
	// not know about that yet. So wait until it is called.
	waitForState(t, statechanged, http.StateNew, "Request not received")

	// start the shutdown; once it hits waitgroup.Wait()
	// the listener should of been closed, though client1 is still connected
	if server.Close() != true {
		t.Fatal("first call to Close returned false")
	}
	if server.Close() != false {
		t.Fatal("second call to Close returned true")
	}

	waiting := <-wg.WaitCalled
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

// If a request is sent to a closed server via a kept alive connection then
// the server closes the connection upon receiving the request.
func TestRequestAfterClose(t *testing.T) {
	// Given
	server := NewServer()
	srvStateChangedCh := make(chan http.ConnState, 100)
	listener, srvClosedCh := startServer(t, server, srvStateChangedCh)

	client := newClient(listener.Addr(), false)
	client.Run()
	<-client.connected
	client.sendrequest <- true
	<-client.response

	server.Close()
	if err := <-srvClosedCh; err != nil {
		t.Error("Unexpected error during shutdown", err)
	}

	// When
	client.sendrequest <- true
	rr := <-client.response

	// Then
	if rr.body != nil || rr.err != nil {
		t.Errorf("Request should be rejected, body=%v, err=%v", rr.body, rr.err)
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
	server := NewServer()
	wg := helpers.NewWaitGroup()
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
		<-client.response
		waitForState(t, statechanged, http.StateIdle, "Client failed to reach idle state")
	}

	// client is now in an idle state

	server.Close()
	waiting := <-wg.WaitCalled
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

	keyFile, err1 := helpers.NewTempFile(helpers.Key)
	certFile, err2 := helpers.NewTempFile(helpers.Cert)
	defer keyFile.Unlink()
	defer certFile.Unlink()

	if err1 != nil || err2 != nil {
		t.Fatal("Failed to create temporary files", err1, err2)
	}

	for _, withTLS := range []bool{false, true} {
		server := NewServer()
		wg := helpers.NewWaitGroup()
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

		rr := <-client.response
		if rr.err != nil {
			t.Fatalf("tls=%t unexpected error from client %s", withTLS, rr.err)
		}

		waitForState(t, statechanged, http.StateIdle, "Client failed to reach idle state")

		// client is now in an idle state
		close(client.sendrequest)
		<-client.closed
		waitForState(t, statechanged, http.StateClosed, "Client failed to reach closed state")

		server.Close()
		waiting := <-wg.WaitCalled
		if waiting != 0 {
			t.Errorf("Waitcount should be zero, got %d", waiting)
		}

		if err := <-exitchan; err != nil {
			t.Error("Unexpected error during shutdown", err)
		}
	}
}

func TestRoutinesCount(t *testing.T) {
	var count int
	server := NewServer()

	count = server.RoutinesCount()
	if count != 0 {
		t.Errorf("Expected the routines count to equal 0; actually %d", count)
	}

	server.StartRoutine()
	count = server.RoutinesCount()
	if count != 1 {
		t.Errorf("Expected the routines count to equal 1; actually %d", count)
	}

	server.FinishRoutine()
	count = server.RoutinesCount()
	if count != 0 {
		t.Errorf("Expected the routines count to equal 0; actually %d", count)
	}
}
