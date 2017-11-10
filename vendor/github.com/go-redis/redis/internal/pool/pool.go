package pool

import (
	"errors"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"github.com/go-redis/redis/internal"
)

var ErrClosed = errors.New("redis: client is closed")
var ErrPoolTimeout = errors.New("redis: connection pool timeout")

var timers = sync.Pool{
	New: func() interface{} {
		t := time.NewTimer(time.Hour)
		t.Stop()
		return t
	},
}

// Stats contains pool state information and accumulated stats.
type Stats struct {
	Hits     uint32 // number of times free connection was found in the pool
	Misses   uint32 // number of times free connection was NOT found in the pool
	Timeouts uint32 // number of times a wait timeout occurred

	TotalConns uint32 // number of total connections in the pool
	FreeConns  uint32 // number of free connections in the pool
	StaleConns uint32 // number of stale connections removed from the pool
}

type Pooler interface {
	NewConn() (*Conn, error)
	CloseConn(*Conn) error

	Get() (*Conn, bool, error)
	Put(*Conn) error
	Remove(*Conn) error

	Len() int
	FreeLen() int
	Stats() *Stats

	Close() error
}

type Options struct {
	Dialer  func() (net.Conn, error)
	OnClose func(*Conn) error

	PoolSize           int
	PoolTimeout        time.Duration
	IdleTimeout        time.Duration
	IdleCheckFrequency time.Duration
}

type ConnPool struct {
	opt *Options

	dialErrorsNum uint32 // atomic

	lastDialError   error
	lastDialErrorMu sync.RWMutex

	queue chan struct{}

	connsMu sync.Mutex
	conns   []*Conn

	freeConnsMu sync.Mutex
	freeConns   []*Conn

	stats Stats

	_closed uint32 // atomic
}

var _ Pooler = (*ConnPool)(nil)

func NewConnPool(opt *Options) *ConnPool {
	p := &ConnPool{
		opt: opt,

		queue:     make(chan struct{}, opt.PoolSize),
		conns:     make([]*Conn, 0, opt.PoolSize),
		freeConns: make([]*Conn, 0, opt.PoolSize),
	}
	if opt.IdleTimeout > 0 && opt.IdleCheckFrequency > 0 {
		go p.reaper(opt.IdleCheckFrequency)
	}
	return p
}

func (p *ConnPool) NewConn() (*Conn, error) {
	if p.closed() {
		return nil, ErrClosed
	}

	if atomic.LoadUint32(&p.dialErrorsNum) >= uint32(p.opt.PoolSize) {
		return nil, p.getLastDialError()
	}

	netConn, err := p.opt.Dialer()
	if err != nil {
		p.setLastDialError(err)
		if atomic.AddUint32(&p.dialErrorsNum, 1) == uint32(p.opt.PoolSize) {
			go p.tryDial()
		}
		return nil, err
	}

	cn := NewConn(netConn)
	p.connsMu.Lock()
	p.conns = append(p.conns, cn)
	p.connsMu.Unlock()

	return cn, nil
}

func (p *ConnPool) tryDial() {
	for {
		if p.closed() {
			return
		}

		conn, err := p.opt.Dialer()
		if err != nil {
			p.setLastDialError(err)
			time.Sleep(time.Second)
			continue
		}

		atomic.StoreUint32(&p.dialErrorsNum, 0)
		_ = conn.Close()
		return
	}
}

func (p *ConnPool) setLastDialError(err error) {
	p.lastDialErrorMu.Lock()
	p.lastDialError = err
	p.lastDialErrorMu.Unlock()
}

func (p *ConnPool) getLastDialError() error {
	p.lastDialErrorMu.RLock()
	err := p.lastDialError
	p.lastDialErrorMu.RUnlock()
	return err
}

// Get returns existed connection from the pool or creates a new one.
func (p *ConnPool) Get() (*Conn, bool, error) {
	if p.closed() {
		return nil, false, ErrClosed
	}

	select {
	case p.queue <- struct{}{}:
	default:
		timer := timers.Get().(*time.Timer)
		timer.Reset(p.opt.PoolTimeout)

		select {
		case p.queue <- struct{}{}:
			if !timer.Stop() {
				<-timer.C
			}
			timers.Put(timer)
		case <-timer.C:
			timers.Put(timer)
			atomic.AddUint32(&p.stats.Timeouts, 1)
			return nil, false, ErrPoolTimeout
		}
	}

	for {
		p.freeConnsMu.Lock()
		cn := p.popFree()
		p.freeConnsMu.Unlock()

		if cn == nil {
			break
		}

		if cn.IsStale(p.opt.IdleTimeout) {
			p.CloseConn(cn)
			continue
		}

		atomic.AddUint32(&p.stats.Hits, 1)
		return cn, false, nil
	}

	atomic.AddUint32(&p.stats.Misses, 1)

	newcn, err := p.NewConn()
	if err != nil {
		<-p.queue
		return nil, false, err
	}

	return newcn, true, nil
}

func (p *ConnPool) popFree() *Conn {
	if len(p.freeConns) == 0 {
		return nil
	}

	idx := len(p.freeConns) - 1
	cn := p.freeConns[idx]
	p.freeConns = p.freeConns[:idx]
	return cn
}

func (p *ConnPool) Put(cn *Conn) error {
	if data := cn.Rd.PeekBuffered(); data != nil {
		internal.Logf("connection has unread data: %q", data)
		return p.Remove(cn)
	}
	p.freeConnsMu.Lock()
	p.freeConns = append(p.freeConns, cn)
	p.freeConnsMu.Unlock()
	<-p.queue
	return nil
}

func (p *ConnPool) Remove(cn *Conn) error {
	_ = p.CloseConn(cn)
	<-p.queue
	return nil
}

func (p *ConnPool) CloseConn(cn *Conn) error {
	p.connsMu.Lock()
	for i, c := range p.conns {
		if c == cn {
			p.conns = append(p.conns[:i], p.conns[i+1:]...)
			break
		}
	}
	p.connsMu.Unlock()

	return p.closeConn(cn)
}

func (p *ConnPool) closeConn(cn *Conn) error {
	if p.opt.OnClose != nil {
		_ = p.opt.OnClose(cn)
	}
	return cn.Close()
}

// Len returns total number of connections.
func (p *ConnPool) Len() int {
	p.connsMu.Lock()
	l := len(p.conns)
	p.connsMu.Unlock()
	return l
}

// FreeLen returns number of free connections.
func (p *ConnPool) FreeLen() int {
	p.freeConnsMu.Lock()
	l := len(p.freeConns)
	p.freeConnsMu.Unlock()
	return l
}

func (p *ConnPool) Stats() *Stats {
	return &Stats{
		Hits:     atomic.LoadUint32(&p.stats.Hits),
		Misses:   atomic.LoadUint32(&p.stats.Misses),
		Timeouts: atomic.LoadUint32(&p.stats.Timeouts),

		TotalConns: uint32(p.Len()),
		FreeConns:  uint32(p.FreeLen()),
		StaleConns: atomic.LoadUint32(&p.stats.StaleConns),
	}
}

func (p *ConnPool) closed() bool {
	return atomic.LoadUint32(&p._closed) == 1
}

func (p *ConnPool) Filter(fn func(*Conn) bool) error {
	var firstErr error
	p.connsMu.Lock()
	for _, cn := range p.conns {
		if fn(cn) {
			if err := p.closeConn(cn); err != nil && firstErr == nil {
				firstErr = err
			}
		}
	}
	p.connsMu.Unlock()
	return firstErr
}

func (p *ConnPool) Close() error {
	if !atomic.CompareAndSwapUint32(&p._closed, 0, 1) {
		return ErrClosed
	}

	var firstErr error
	p.connsMu.Lock()
	for _, cn := range p.conns {
		if err := p.closeConn(cn); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	p.conns = nil
	p.connsMu.Unlock()

	p.freeConnsMu.Lock()
	p.freeConns = nil
	p.freeConnsMu.Unlock()

	return firstErr
}

func (p *ConnPool) reapStaleConn() bool {
	if len(p.freeConns) == 0 {
		return false
	}

	cn := p.freeConns[0]
	if !cn.IsStale(p.opt.IdleTimeout) {
		return false
	}

	p.CloseConn(cn)
	p.freeConns = append(p.freeConns[:0], p.freeConns[1:]...)

	return true
}

func (p *ConnPool) ReapStaleConns() (int, error) {
	var n int
	for {
		p.queue <- struct{}{}
		p.freeConnsMu.Lock()

		reaped := p.reapStaleConn()

		p.freeConnsMu.Unlock()
		<-p.queue

		if reaped {
			n++
		} else {
			break
		}
	}
	return n, nil
}

func (p *ConnPool) reaper(frequency time.Duration) {
	ticker := time.NewTicker(frequency)
	defer ticker.Stop()

	for range ticker.C {
		if p.closed() {
			break
		}
		n, err := p.ReapStaleConns()
		if err != nil {
			internal.Logf("ReapStaleConns failed: %s", err)
			continue
		}
		atomic.AddUint32(&p.stats.StaleConns, uint32(n))
	}
}
