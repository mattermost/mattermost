// +build go1.6

package graceful

import (
	"crypto/tls"
	"fmt"
	"net/http"
	"os"
	"sync"
	"testing"
	"time"

	"golang.org/x/net/http2"
)

func createServer() *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(rw http.ResponseWriter, r *http.Request) {
		rw.WriteHeader(http.StatusOK)
	})

	server := &http.Server{Addr: fmt.Sprintf(":%d", port), Handler: mux}

	return server
}

func checkIfConnectionToServerIsHTTP2(t *testing.T, wg *sync.WaitGroup, c chan os.Signal) {

	defer wg.Done()

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}

	err := http2.ConfigureTransport(tr)

	if err != nil {
		t.Fatal("Unable to upgrade client transport to HTTP/2")
	}

	client := http.Client{Transport: tr}
	r, err := client.Get(fmt.Sprintf("https://localhost:%d", port))

	c <- os.Interrupt

	if err != nil {
		t.Fatalf("Error encountered while connecting to test server: %s", err)
	}

	if !r.ProtoAtLeast(2, 0) {
		t.Fatalf("Expected HTTP/2 connection to server, but connection was using %s", r.Proto)
	}
}

func TestHTTP2ListenAndServeTLS(t *testing.T) {

	c := make(chan os.Signal, 1)

	var wg sync.WaitGroup
	wg.Add(1)

	server := createServer()

	var srv *Server
	go func() {
		// set timeout of 0 to test idle connection closing
		srv = &Server{Timeout: 0, TCPKeepAlive: 1 * time.Minute, Server: server, interrupt: c}
		srv.ListenAndServeTLS("test-fixtures/cert.crt", "test-fixtures/key.pem")
		wg.Done()
	}()

	time.Sleep(waitTime) // Wait for the server to start

	wg.Add(1)
	go checkIfConnectionToServerIsHTTP2(t, &wg, c)
	wg.Wait()

	c <- os.Interrupt // kill the server to close idle connections

	// block on the stopChan until the server has shut down
	select {
	case <-srv.StopChan():
	case <-time.After(killTime * 2):
		t.Fatal("Timed out while waiting for explicit stop to complete")
	}

}

func TestHTTP2ListenAndServeTLSConfig(t *testing.T) {

	c := make(chan os.Signal, 1)

	var wg sync.WaitGroup

	wg.Add(1)

	server2 := createServer()

	go func() {
		srv := &Server{Timeout: killTime, TCPKeepAlive: 1 * time.Minute, Server: server2, interrupt: c}

		cert, err := tls.LoadX509KeyPair("test-fixtures/cert.crt", "test-fixtures/key.pem")

		if err != nil {
			t.Fatalf("Unexpected error: %s", err)
		}

		tlsConf := &tls.Config{
			Certificates: []tls.Certificate{cert},
			NextProtos:   []string{"h2"}, // We need to explicitly enable http/2 in Go 1.7+
		}

		tlsConf.BuildNameToCertificate()

		srv.ListenAndServeTLSConfig(tlsConf)
		wg.Done()
	}()

	time.Sleep(waitTime) // Wait for the server to start

	wg.Add(1)
	go checkIfConnectionToServerIsHTTP2(t, &wg, c)
	wg.Wait()
}
