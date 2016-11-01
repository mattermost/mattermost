/*
Package manners provides a wrapper for a standard net/http server that
ensures all active HTTP client have completed their current request
before the server shuts down.

It can be used a drop-in replacement for the standard http package,
or can wrap a pre-configured Server.

eg.

	http.Handle("/hello", func(w http.ResponseWriter, r *http.Request) {
	  w.Write([]byte("Hello\n"))
	})

	log.Fatal(manners.ListenAndServe(":8080", nil))

or for a customized server:

	s := manners.NewWithServer(&http.Server{
		Addr:           ":8080",
		Handler:        myHandler,
		ReadTimeout:    10 * time.Second,
		WriteTimeout:   10 * time.Second,
		MaxHeaderBytes: 1 << 20,
	})
	log.Fatal(s.ListenAndServe())

The server will shut down cleanly when the Close() method is called:

	go func() {
		sigchan := make(chan os.Signal, 1)
		signal.Notify(sigchan, os.Interrupt, os.Kill)
		<-sigchan
		log.Info("Shutting down...")
		manners.Close()
	}()

	http.Handle("/hello", myHandler)
	log.Fatal(manners.ListenAndServe(":8080", nil))
*/
package manners

import (
	"crypto/tls"
	"net"
	"net/http"
	"sync"
	"sync/atomic"
)

// A GracefulServer maintains a WaitGroup that counts how many in-flight
// requests the server is handling. When it receives a shutdown signal,
// it stops accepting new requests but does not actually shut down until
// all in-flight requests terminate.
//
// GracefulServer embeds the underlying net/http.Server making its non-override
// methods and properties avaiable.
//
// It must be initialized by calling NewWithServer.
type GracefulServer struct {
	*http.Server

	shutdown chan bool
	wg       waitGroup

	lcsmu         sync.RWMutex
	lastConnState map[net.Conn]http.ConnState

	up chan net.Listener // Only used by test code.
}

type waitGroup interface {
	Add(int)
	Done()
	Wait()
}

// NewWithServer wraps an existing http.Server object and returns a
// GracefulServer that supports all of the original Server operations.
func NewWithServer(s *http.Server) *GracefulServer {
	return &GracefulServer{
		Server:        s,
		shutdown:      make(chan bool),
		wg:            new(sync.WaitGroup),
		lastConnState: make(map[net.Conn]http.ConnState),
	}
}

// Close stops the server from accepting new requets and begins shutting down.
// It returns true if it's the first time Close is called.
func (s *GracefulServer) Close() bool {
	return <-s.shutdown
}

// ListenAndServe provides a graceful equivalent of net/http.Serve.ListenAndServe.
func (s *GracefulServer) ListenAndServe() error {
	addr := s.Addr
	if addr == "" {
		addr = ":http"
	}
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}

	return s.Serve(listener)
}

// ListenAndServeTLS provides a graceful equivalent of net/http.Serve.ListenAndServeTLS.
func (s *GracefulServer) ListenAndServeTLS(certFile, keyFile string) error {
	// direct lift from net/http/server.go
	addr := s.Addr
	if addr == "" {
		addr = ":https"
	}
	config := &tls.Config{}
	if s.TLSConfig != nil {
		*config = *s.TLSConfig
	}
	if config.NextProtos == nil {
		config.NextProtos = []string{"http/1.1"}
	}

	var err error
	config.Certificates = make([]tls.Certificate, 1)
	config.Certificates[0], err = tls.LoadX509KeyPair(certFile, keyFile)
	if err != nil {
		return err
	}

	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}

	return s.Serve(tls.NewListener(ln, config))
}

// Serve provides a graceful equivalent net/http.Server.Serve.
func (s *GracefulServer) Serve(listener net.Listener) error {
	var closing int32

	go func() {
		s.shutdown <- true
		close(s.shutdown)
		atomic.StoreInt32(&closing, 1)
		s.Server.SetKeepAlivesEnabled(false)
		listener.Close()
	}()

	originalConnState := s.Server.ConnState
	s.ConnState = func(conn net.Conn, newState http.ConnState) {
		s.lcsmu.RLock()
		lastConnState := s.lastConnState[conn]
		s.lcsmu.RUnlock()

		switch newState {
		case http.StateNew:
			// New connection -> StateNew
			s.StartRoutine()

		case http.StateActive:
			// (StateNew, StateIdle) -> StateActive
			if lastConnState == http.StateIdle {
				// The connection transitioned from idle back to active
				s.StartRoutine()
			}

		case http.StateIdle:
			// StateActive -> StateIdle
			// Immediately close newly idle connections; if not they may make
			// one more request before SetKeepAliveEnabled(false) takes effect.
			if atomic.LoadInt32(&closing) == 1 {
				conn.Close()
			}
			s.FinishRoutine()

		case http.StateClosed, http.StateHijacked:
			// (StateNew, StateActive, StateIdle) -> (StateClosed, StateHiJacked)
			// If the connection was idle we do not need to decrement the counter.
			if lastConnState != http.StateIdle {
				s.FinishRoutine()
			}
		}

		s.lcsmu.Lock()
		if newState == http.StateClosed || newState == http.StateHijacked {
			delete(s.lastConnState, conn)
		} else {
			s.lastConnState[conn] = newState
		}
		s.lcsmu.Unlock()

		if originalConnState != nil {
			originalConnState(conn, newState)
		}
	}

	// A hook to allow the server to notify others when it is ready to receive
	// requests; only used by tests.
	if s.up != nil {
		s.up <- listener
	}
	err := s.Server.Serve(listener)

	// This block is reached when the server has received a shut down command
	// or a real error happened.
	if err == nil || atomic.LoadInt32(&closing) == 1 {
		s.wg.Wait()
		return nil
	}

	return err
}

// StartRoutine increments the server's WaitGroup. Use this if a web request
// starts more goroutines and these goroutines are not guaranteed to finish
// before the request.
func (s *GracefulServer) StartRoutine() {
	s.wg.Add(1)
}

// FinishRoutine decrements the server's WaitGroup. Use this to complement
// StartRoutine().
func (s *GracefulServer) FinishRoutine() {
	s.wg.Done()
}
