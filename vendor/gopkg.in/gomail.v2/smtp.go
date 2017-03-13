package gomail

import (
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"net/smtp"
)

// A Dialer is a dialer to an SMTP server.
type Dialer struct {
	// Host represents the host of the SMTP server.
	Host string
	// Port represents the port of the SMTP server.
	Port int
	// Auth represents the authentication mechanism used to authenticate to the
	// SMTP server.
	Auth smtp.Auth
	// SSL defines whether an SSL connection is used. It should be false in
	// most cases since the authentication mechanism should use the STARTTLS
	// extension instead.
	SSL bool
	// TSLConfig represents the TLS configuration used for the TLS (when the
	// STARTTLS extension is used) or SSL connection.
	TLSConfig *tls.Config
}

// NewPlainDialer returns a Dialer. The given parameters are used to connect to
// the SMTP server via a PLAIN authentication mechanism.
//
// It fallbacks to the LOGIN mechanism if it is the only mechanism advertised by
// the server.
func NewPlainDialer(host string, port int, username, password string) *Dialer {
	return &Dialer{
		Host: host,
		Port: port,
		Auth: &plainAuth{
			username: username,
			password: password,
			host:     host,
		},
		SSL: port == 465,
	}
}

// Dial dials and authenticates to an SMTP server. The returned SendCloser
// should be closed when done using it.
func (d *Dialer) Dial() (SendCloser, error) {
	c, err := d.dial()
	if err != nil {
		return nil, err
	}

	if d.Auth != nil {
		if ok, _ := c.Extension("AUTH"); ok {
			if err = c.Auth(d.Auth); err != nil {
				c.Close()
				return nil, err
			}
		}
	}

	return &smtpSender{c}, nil
}

func (d *Dialer) dial() (smtpClient, error) {
	if d.SSL {
		return d.sslDial()
	}
	return d.starttlsDial()
}

func (d *Dialer) starttlsDial() (smtpClient, error) {
	c, err := smtpDial(addr(d.Host, d.Port))
	if err != nil {
		return nil, err
	}

	if ok, _ := c.Extension("STARTTLS"); ok {
		if err := c.StartTLS(d.tlsConfig()); err != nil {
			c.Close()
			return nil, err
		}
	}

	return c, nil
}

func (d *Dialer) sslDial() (smtpClient, error) {
	conn, err := tlsDial("tcp", addr(d.Host, d.Port), d.tlsConfig())
	if err != nil {
		return nil, err
	}

	return newClient(conn, d.Host)
}

func (d *Dialer) tlsConfig() *tls.Config {
	if d.TLSConfig == nil {
		return &tls.Config{ServerName: d.Host}
	}

	return d.TLSConfig
}

func addr(host string, port int) string {
	return fmt.Sprintf("%s:%d", host, port)
}

// DialAndSend opens a connection to the SMTP server, sends the given emails and
// closes the connection.
func (d *Dialer) DialAndSend(m ...*Message) error {
	s, err := d.Dial()
	if err != nil {
		return err
	}
	defer s.Close()

	return Send(s, m...)
}

type smtpSender struct {
	smtpClient
}

func (c *smtpSender) Send(from string, to []string, msg io.WriterTo) error {
	if err := c.Mail(from); err != nil {
		return err
	}

	for _, addr := range to {
		if err := c.Rcpt(addr); err != nil {
			return err
		}
	}

	w, err := c.Data()
	if err != nil {
		return err
	}

	if _, err = msg.WriteTo(w); err != nil {
		w.Close()
		return err
	}

	return w.Close()
}

func (c *smtpSender) Close() error {
	return c.Quit()
}

// Stubbed out for tests.
var (
	smtpDial = func(addr string) (smtpClient, error) {
		return smtp.Dial(addr)
	}
	tlsDial   = tls.Dial
	newClient = func(conn net.Conn, host string) (smtpClient, error) {
		return smtp.NewClient(conn, host)
	}
)

type smtpClient interface {
	Extension(string) (bool, string)
	StartTLS(*tls.Config) error
	Auth(smtp.Auth) error
	Mail(string) error
	Rcpt(string) error
	Data() (io.WriteCloser, error)
	Quit() error
	Close() error
}
