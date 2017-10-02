package redis

import (
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"net/url"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/go-redis/redis/internal/pool"
)

type Options struct {
	// The network type, either tcp or unix.
	// Default is tcp.
	Network string
	// host:port address.
	Addr string

	// Dialer creates new network connection and has priority over
	// Network and Addr options.
	Dialer func() (net.Conn, error)

	// Hook that is called when new connection is established.
	OnConnect func(*Conn) error

	// Optional password. Must match the password specified in the
	// requirepass server configuration option.
	Password string
	// Database to be selected after connecting to the server.
	DB int

	// Maximum number of retries before giving up.
	// Default is to not retry failed commands.
	MaxRetries int
	// Minimum backoff between each retry.
	// Default is 8 milliseconds; -1 disables backoff.
	MinRetryBackoff time.Duration
	// Maximum backoff between each retry.
	// Default is 512 milliseconds; -1 disables backoff.
	MaxRetryBackoff time.Duration

	// Dial timeout for establishing new connections.
	// Default is 5 seconds.
	DialTimeout time.Duration
	// Timeout for socket reads. If reached, commands will fail
	// with a timeout instead of blocking.
	// Default is 3 seconds.
	ReadTimeout time.Duration
	// Timeout for socket writes. If reached, commands will fail
	// with a timeout instead of blocking.
	// Default is ReadTimeout.
	WriteTimeout time.Duration

	// Maximum number of socket connections.
	// Default is 10 connections per every CPU as reported by runtime.NumCPU.
	PoolSize int
	// Amount of time client waits for connection if all connections
	// are busy before returning an error.
	// Default is ReadTimeout + 1 second.
	PoolTimeout time.Duration
	// Amount of time after which client closes idle connections.
	// Should be less than server's timeout.
	// Default is 5 minutes.
	IdleTimeout time.Duration
	// Frequency of idle checks.
	// Default is 1 minute.
	// When minus value is set, then idle check is disabled.
	IdleCheckFrequency time.Duration

	// Enables read only queries on slave nodes.
	readOnly bool

	// TLS Config to use. When set TLS will be negotiated.
	TLSConfig *tls.Config
}

func (opt *Options) init() {
	if opt.Network == "" {
		opt.Network = "tcp"
	}
	if opt.Dialer == nil {
		opt.Dialer = func() (net.Conn, error) {
			conn, err := net.DialTimeout(opt.Network, opt.Addr, opt.DialTimeout)
			if opt.TLSConfig == nil || err != nil {
				return conn, err
			}
			t := tls.Client(conn, opt.TLSConfig)
			return t, t.Handshake()
		}
	}
	if opt.PoolSize == 0 {
		opt.PoolSize = 10 * runtime.NumCPU()
	}
	if opt.DialTimeout == 0 {
		opt.DialTimeout = 5 * time.Second
	}
	switch opt.ReadTimeout {
	case -1:
		opt.ReadTimeout = 0
	case 0:
		opt.ReadTimeout = 3 * time.Second
	}
	switch opt.WriteTimeout {
	case -1:
		opt.WriteTimeout = 0
	case 0:
		opt.WriteTimeout = opt.ReadTimeout
	}
	if opt.PoolTimeout == 0 {
		opt.PoolTimeout = opt.ReadTimeout + time.Second
	}
	if opt.IdleTimeout == 0 {
		opt.IdleTimeout = 5 * time.Minute
	}
	if opt.IdleCheckFrequency == 0 {
		opt.IdleCheckFrequency = time.Minute
	}

	switch opt.MinRetryBackoff {
	case -1:
		opt.MinRetryBackoff = 0
	case 0:
		opt.MinRetryBackoff = 8 * time.Millisecond
	}
	switch opt.MaxRetryBackoff {
	case -1:
		opt.MaxRetryBackoff = 0
	case 0:
		opt.MaxRetryBackoff = 512 * time.Millisecond
	}
}

// ParseURL parses an URL into Options that can be used to connect to Redis.
func ParseURL(redisURL string) (*Options, error) {
	o := &Options{Network: "tcp"}
	u, err := url.Parse(redisURL)
	if err != nil {
		return nil, err
	}

	if u.Scheme != "redis" && u.Scheme != "rediss" {
		return nil, errors.New("invalid redis URL scheme: " + u.Scheme)
	}

	if u.User != nil {
		if p, ok := u.User.Password(); ok {
			o.Password = p
		}
	}

	if len(u.Query()) > 0 {
		return nil, errors.New("no options supported")
	}

	h, p, err := net.SplitHostPort(u.Host)
	if err != nil {
		h = u.Host
	}
	if h == "" {
		h = "localhost"
	}
	if p == "" {
		p = "6379"
	}
	o.Addr = net.JoinHostPort(h, p)

	f := strings.FieldsFunc(u.Path, func(r rune) bool {
		return r == '/'
	})
	switch len(f) {
	case 0:
		o.DB = 0
	case 1:
		if o.DB, err = strconv.Atoi(f[0]); err != nil {
			return nil, fmt.Errorf("invalid redis database number: %q", f[0])
		}
	default:
		return nil, errors.New("invalid redis URL path: " + u.Path)
	}

	if u.Scheme == "rediss" {
		o.TLSConfig = &tls.Config{ServerName: h}
	}
	return o, nil
}

func newConnPool(opt *Options) *pool.ConnPool {
	return pool.NewConnPool(&pool.Options{
		Dialer:             opt.Dialer,
		PoolSize:           opt.PoolSize,
		PoolTimeout:        opt.PoolTimeout,
		IdleTimeout:        opt.IdleTimeout,
		IdleCheckFrequency: opt.IdleCheckFrequency,
	})
}
