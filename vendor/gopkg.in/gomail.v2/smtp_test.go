package gomail

import (
	"bytes"
	"crypto/tls"
	"io"
	"net"
	"net/smtp"
	"reflect"
	"testing"
)

const (
	testPort    = 587
	testSSLPort = 465
)

var (
	testTLSConn = &tls.Conn{}
	testConfig  = &tls.Config{InsecureSkipVerify: true}
)

func TestDialer(t *testing.T) {
	d := NewPlainDialer(testHost, testPort, "user", "pwd")
	testSendMail(t, d, []string{
		"Extension STARTTLS",
		"StartTLS",
		"Extension AUTH",
		"Auth",
		"Mail " + testFrom,
		"Rcpt " + testTo1,
		"Rcpt " + testTo2,
		"Data",
		"Write message",
		"Close writer",
		"Quit",
		"Close",
	})
}

func TestDialerSSL(t *testing.T) {
	d := NewPlainDialer(testHost, testSSLPort, "user", "pwd")
	testSendMail(t, d, []string{
		"Extension AUTH",
		"Auth",
		"Mail " + testFrom,
		"Rcpt " + testTo1,
		"Rcpt " + testTo2,
		"Data",
		"Write message",
		"Close writer",
		"Quit",
		"Close",
	})
}

func TestDialerConfig(t *testing.T) {
	d := NewPlainDialer(testHost, testPort, "user", "pwd")
	d.TLSConfig = testConfig
	testSendMail(t, d, []string{
		"Extension STARTTLS",
		"StartTLS",
		"Extension AUTH",
		"Auth",
		"Mail " + testFrom,
		"Rcpt " + testTo1,
		"Rcpt " + testTo2,
		"Data",
		"Write message",
		"Close writer",
		"Quit",
		"Close",
	})
}

func TestDialerSSLConfig(t *testing.T) {
	d := NewPlainDialer(testHost, testSSLPort, "user", "pwd")
	d.TLSConfig = testConfig
	testSendMail(t, d, []string{
		"Extension AUTH",
		"Auth",
		"Mail " + testFrom,
		"Rcpt " + testTo1,
		"Rcpt " + testTo2,
		"Data",
		"Write message",
		"Close writer",
		"Quit",
		"Close",
	})
}

func TestDialerNoAuth(t *testing.T) {
	d := &Dialer{
		Host: testHost,
		Port: testPort,
	}
	testSendMail(t, d, []string{
		"Extension STARTTLS",
		"StartTLS",
		"Mail " + testFrom,
		"Rcpt " + testTo1,
		"Rcpt " + testTo2,
		"Data",
		"Write message",
		"Close writer",
		"Quit",
		"Close",
	})
}

type mockClient struct {
	t      *testing.T
	i      int
	want   []string
	addr   string
	auth   smtp.Auth
	config *tls.Config
}

func (c *mockClient) Extension(ext string) (bool, string) {
	c.do("Extension " + ext)
	return true, ""
}

func (c *mockClient) StartTLS(config *tls.Config) error {
	assertConfig(c.t, config, c.config)
	c.do("StartTLS")
	return nil
}

func (c *mockClient) Auth(a smtp.Auth) error {
	assertAuth(c.t, a, c.auth)
	c.do("Auth")
	return nil
}

func (c *mockClient) Mail(from string) error {
	c.do("Mail " + from)
	return nil
}

func (c *mockClient) Rcpt(to string) error {
	c.do("Rcpt " + to)
	return nil
}

func (c *mockClient) Data() (io.WriteCloser, error) {
	c.do("Data")
	return &mockWriter{c: c, want: testMsg}, nil
}

func (c *mockClient) Quit() error {
	c.do("Quit")
	return nil
}

func (c *mockClient) Close() error {
	c.do("Close")
	return nil
}

func (c *mockClient) do(cmd string) {
	if c.i >= len(c.want) {
		c.t.Fatalf("Invalid command %q", cmd)
	}

	if cmd != c.want[c.i] {
		c.t.Fatalf("Invalid command, got %q, want %q", cmd, c.want[c.i])
	}
	c.i++
}

type mockWriter struct {
	want string
	c    *mockClient
	buf  bytes.Buffer
}

func (w *mockWriter) Write(p []byte) (int, error) {
	if w.buf.Len() == 0 {
		w.c.do("Write message")
	}
	w.buf.Write(p)
	return len(p), nil
}

func (w *mockWriter) Close() error {
	compareBodies(w.c.t, w.buf.String(), w.want)
	w.c.do("Close writer")
	return nil
}

func testSendMail(t *testing.T, d *Dialer, want []string) {
	testClient := &mockClient{
		t:      t,
		want:   want,
		addr:   addr(d.Host, d.Port),
		auth:   testAuth,
		config: d.TLSConfig,
	}

	smtpDial = func(addr string) (smtpClient, error) {
		assertAddr(t, addr, testClient.addr)
		return testClient, nil
	}

	tlsDial = func(network, addr string, config *tls.Config) (*tls.Conn, error) {
		if network != "tcp" {
			t.Errorf("Invalid network, got %q, want tcp", network)
		}
		assertAddr(t, addr, testClient.addr)
		assertConfig(t, config, testClient.config)
		return testTLSConn, nil
	}

	newClient = func(conn net.Conn, host string) (smtpClient, error) {
		if conn != testTLSConn {
			t.Error("Invalid TLS connection used")
		}
		if host != testHost {
			t.Errorf("Invalid host, got %q, want %q", host, testHost)
		}
		return testClient, nil
	}

	if err := d.DialAndSend(getTestMessage()); err != nil {
		t.Error(err)
	}
}

func assertAuth(t *testing.T, got, want smtp.Auth) {
	if !reflect.DeepEqual(got, want) {
		t.Errorf("Invalid auth, got %#v, want %#v", got, want)
	}
}

func assertAddr(t *testing.T, got, want string) {
	if got != want {
		t.Errorf("Invalid addr, got %q, want %q", got, want)
	}
}

func assertConfig(t *testing.T, got, want *tls.Config) {
	if want == nil {
		want = &tls.Config{ServerName: testHost}
	}
	if got.ServerName != want.ServerName {
		t.Errorf("Invalid field ServerName in config, got %q, want %q", got.ServerName, want.ServerName)
	}
	if got.InsecureSkipVerify != want.InsecureSkipVerify {
		t.Errorf("Invalid field InsecureSkipVerify in config, got %v, want %v", got.InsecureSkipVerify, want.InsecureSkipVerify)
	}
}
