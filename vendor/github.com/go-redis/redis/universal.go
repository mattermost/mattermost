package redis

import "time"

// UniversalOptions information is required by UniversalClient to establish
// connections.
type UniversalOptions struct {
	// Either a single address or a seed list of host:port addresses
	// of cluster/sentinel nodes.
	Addrs []string

	// The sentinel master name.
	// Only failover clients.
	MasterName string

	// Database to be selected after connecting to the server.
	// Only single-node and failover clients.
	DB int

	// Enables read only queries on slave nodes.
	// Only cluster and single-node clients.
	ReadOnly bool

	// Only cluster clients.

	MaxRedirects   int
	RouteByLatency bool

	// Common options

	MaxRetries         int
	Password           string
	DialTimeout        time.Duration
	ReadTimeout        time.Duration
	WriteTimeout       time.Duration
	PoolSize           int
	PoolTimeout        time.Duration
	IdleTimeout        time.Duration
	IdleCheckFrequency time.Duration
}

func (o *UniversalOptions) cluster() *ClusterOptions {
	if len(o.Addrs) == 0 {
		o.Addrs = []string{"127.0.0.1:6379"}
	}

	return &ClusterOptions{
		Addrs:          o.Addrs,
		MaxRedirects:   o.MaxRedirects,
		RouteByLatency: o.RouteByLatency,
		ReadOnly:       o.ReadOnly,

		MaxRetries:         o.MaxRetries,
		Password:           o.Password,
		DialTimeout:        o.DialTimeout,
		ReadTimeout:        o.ReadTimeout,
		WriteTimeout:       o.WriteTimeout,
		PoolSize:           o.PoolSize,
		PoolTimeout:        o.PoolTimeout,
		IdleTimeout:        o.IdleTimeout,
		IdleCheckFrequency: o.IdleCheckFrequency,
	}
}

func (o *UniversalOptions) failover() *FailoverOptions {
	if len(o.Addrs) == 0 {
		o.Addrs = []string{"127.0.0.1:26379"}
	}

	return &FailoverOptions{
		SentinelAddrs: o.Addrs,
		MasterName:    o.MasterName,
		DB:            o.DB,

		MaxRetries:         o.MaxRetries,
		Password:           o.Password,
		DialTimeout:        o.DialTimeout,
		ReadTimeout:        o.ReadTimeout,
		WriteTimeout:       o.WriteTimeout,
		PoolSize:           o.PoolSize,
		PoolTimeout:        o.PoolTimeout,
		IdleTimeout:        o.IdleTimeout,
		IdleCheckFrequency: o.IdleCheckFrequency,
	}
}

func (o *UniversalOptions) simple() *Options {
	addr := "127.0.0.1:6379"
	if len(o.Addrs) > 0 {
		addr = o.Addrs[0]
	}

	return &Options{
		Addr:     addr,
		DB:       o.DB,
		ReadOnly: o.ReadOnly,

		MaxRetries:         o.MaxRetries,
		Password:           o.Password,
		DialTimeout:        o.DialTimeout,
		ReadTimeout:        o.ReadTimeout,
		WriteTimeout:       o.WriteTimeout,
		PoolSize:           o.PoolSize,
		PoolTimeout:        o.PoolTimeout,
		IdleTimeout:        o.IdleTimeout,
		IdleCheckFrequency: o.IdleCheckFrequency,
	}
}

// --------------------------------------------------------------------

// UniversalClient is an abstract client which - based on the provided options -
// can connect to either clusters, or sentinel-backed failover instances or simple
// single-instance servers. This can be useful for testing cluster-specific
// applications locally.
type UniversalClient interface {
	Cmdable
	Process(cmd Cmder) error
	Close() error
}

// NewUniversalClient returns a new multi client. The type of client returned depends
// on the following three conditions:
//
// 1. if a MasterName is passed a sentinel-backed FailoverClient will be returned
// 2. if the number of Addrs is two or more, a ClusterClient will be returned
// 3. otherwise, a single-node redis Client will be returned.
func NewUniversalClient(opts *UniversalOptions) UniversalClient {
	if opts.MasterName != "" {
		return NewFailoverClient(opts.failover())
	} else if len(opts.Addrs) > 1 {
		return NewClusterClient(opts.cluster())
	}
	return NewClient(opts.simple())
}
