// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package targets

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"sync"
	"time"

	"github.com/mattermost/logr/v2"
)

const (
	DialTimeoutSecs             = 30
	WriteTimeoutSecs            = 30
	RetryBackoffMillis    int64 = 100
	MaxRetryBackoffMillis int64 = 30 * 1000 // 30 seconds
)

// Tcp outputs log records to raw socket server.
type Tcp struct {
	options *TcpOptions
	addy    string

	mutex    sync.Mutex
	conn     net.Conn
	monitor  chan struct{}
	shutdown chan struct{}
}

// TcpOptions provides parameters for dialing a socket server.
type TcpOptions struct {
	IP       string `json:"ip,omitempty"` // deprecated
	Host     string `json:"host"`
	Port     int    `json:"port"`
	TLS      bool   `json:"tls"`
	Cert     string `json:"cert"`
	Insecure bool   `json:"insecure"`
}

func (to TcpOptions) CheckValid() error {
	if to.Host == "" && to.IP == "" {
		return errors.New("missing host")
	}
	if to.Port == 0 {
		return errors.New("missing port")
	}
	return nil
}

// NewTcpTarget creates a target capable of outputting log records to a raw socket, with or without TLS.
func NewTcpTarget(options *TcpOptions) *Tcp {
	tcp := &Tcp{
		options:  options,
		addy:     fmt.Sprintf("%s:%d", options.IP, options.Port),
		monitor:  make(chan struct{}),
		shutdown: make(chan struct{}),
	}
	return tcp
}

// Init is called once to initialize the target.
func (tcp *Tcp) Init() error {
	return nil
}

// getConn provides a net.Conn.  If a connection already exists, it is returned immediately,
// otherwise this method blocks until a new connection is created, timeout or shutdown.
func (tcp *Tcp) getConn(reporter func(err interface{})) (net.Conn, error) {
	tcp.mutex.Lock()
	defer tcp.mutex.Unlock()

	if tcp.conn != nil {
		return tcp.conn, nil
	}

	type result struct {
		conn net.Conn
		err  error
	}

	connChan := make(chan result)
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*DialTimeoutSecs)
	defer cancel()

	go func(ctx context.Context, ch chan result) {
		conn, err := tcp.dial(ctx)
		if err != nil {
			reporter(fmt.Errorf("log target %s connection error: %w", tcp.String(), err))
			return
		}
		tcp.conn = conn
		tcp.monitor = make(chan struct{})
		go monitor(tcp.conn, tcp.monitor)
		ch <- result{conn: conn, err: err}
	}(ctx, connChan)

	select {
	case <-tcp.shutdown:
		return nil, errors.New("shutdown")
	case res := <-connChan:
		return res.conn, res.err
	}
}

// dial connects to a TCP socket, and optionally performs a TLS handshake.
// A non-nil context must be provided which can cancel the dial.
func (tcp *Tcp) dial(ctx context.Context) (net.Conn, error) {
	var dialer net.Dialer
	dialer.Timeout = time.Second * DialTimeoutSecs
	conn, err := dialer.DialContext(ctx, "tcp", fmt.Sprintf("%s:%d", tcp.options.IP, tcp.options.Port))
	if err != nil {
		return nil, err
	}

	if !tcp.options.TLS {
		return conn, nil
	}

	tlsconfig := &tls.Config{
		ServerName:         tcp.options.IP,
		InsecureSkipVerify: tcp.options.Insecure,
	}
	if tcp.options.Cert != "" {
		pool, err := GetCertPool(tcp.options.Cert)
		if err != nil {
			return nil, err
		}
		tlsconfig.RootCAs = pool
	}

	tlsConn := tls.Client(conn, tlsconfig)
	if err := tlsConn.Handshake(); err != nil {
		return nil, err
	}
	return tlsConn, nil
}

func (tcp *Tcp) close() error {
	tcp.mutex.Lock()
	defer tcp.mutex.Unlock()

	var err error
	if tcp.conn != nil {
		close(tcp.monitor)
		err = tcp.conn.Close()
		tcp.conn = nil
	}
	return err
}

// Shutdown stops processing log records after making best effort to flush queue.
func (tcp *Tcp) Shutdown() error {
	err := tcp.close()
	close(tcp.shutdown)
	return err
}

// Write converts the log record to bytes, via the Formatter, and outputs to the socket.
// Called by dedicated target goroutine and will block until success or shutdown.
func (tcp *Tcp) Write(p []byte, rec *logr.LogRec) (int, error) {
	try := 1
	backoff := RetryBackoffMillis
	for {
		select {
		case <-tcp.shutdown:
			return 0, nil
		default:
		}

		reporter := rec.Logger().Logr().ReportError

		conn, err := tcp.getConn(reporter)
		if err != nil {
			reporter(fmt.Errorf("log target %s connection error: %w", tcp.String(), err))
			backoff = tcp.sleep(backoff)
			continue
		}

		err = conn.SetWriteDeadline(time.Now().Add(time.Second * WriteTimeoutSecs))
		if err != nil {
			reporter(fmt.Errorf("log target %s set write deadline error: %w", tcp.String(), err))
		}

		count, err := conn.Write(p)
		if err == nil {
			return count, nil
		}

		reporter(fmt.Errorf("log target %s write error: %w", tcp.String(), err))

		_ = tcp.close()

		backoff = tcp.sleep(backoff)
		try++
	}
}

// monitor continuously tries to read from the connection to detect socket close.
// This is needed because TCP target uses a write only socket and Linux systems
// take a long time to detect a loss of connectivity on a socket when only writing;
// the writes simply fail without an error returned.
func monitor(conn net.Conn, done <-chan struct{}) {
	buf := make([]byte, 1)
	for {
		select {
		case <-done:
			return
		case <-time.After(1 * time.Second):
		}

		err := conn.SetReadDeadline(time.Now().Add(time.Second * 30))
		if err != nil {
			continue
		}

		_, err = conn.Read(buf)

		if errt, ok := err.(net.Error); ok && errt.Timeout() {
			// read timeout is expected, keep looping.
			continue
		}

		// Any other error closes the connection, forcing a reconnect.
		conn.Close()
		return
	}
}

// String returns a string representation of this target.
func (tcp *Tcp) String() string {
	return fmt.Sprintf("TcpTarget[%s:%d]", tcp.options.IP, tcp.options.Port)
}

func (tcp *Tcp) sleep(backoff int64) int64 {
	select {
	case <-tcp.shutdown:
	case <-time.After(time.Millisecond * time.Duration(backoff)):
	}

	nextBackoff := backoff + (backoff >> 1)
	if nextBackoff > MaxRetryBackoffMillis {
		nextBackoff = MaxRetryBackoffMillis
	}
	return nextBackoff
}
