package redis

import (
	"context"
	"errors"
	"fmt"
	"math"
	"math/rand"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"github.com/go-redis/redis/internal"
	"github.com/go-redis/redis/internal/hashtag"
	"github.com/go-redis/redis/internal/pool"
	"github.com/go-redis/redis/internal/proto"
	"github.com/go-redis/redis/internal/singleflight"
)

var errClusterNoNodes = fmt.Errorf("redis: cluster has no nodes")

// ClusterOptions are used to configure a cluster client and should be
// passed to NewClusterClient.
type ClusterOptions struct {
	// A seed list of host:port addresses of cluster nodes.
	Addrs []string

	// The maximum number of retries before giving up. Command is retried
	// on network errors and MOVED/ASK redirects.
	// Default is 8.
	MaxRedirects int

	// Enables read-only commands on slave nodes.
	ReadOnly bool
	// Allows routing read-only commands to the closest master or slave node.
	RouteByLatency bool
	// Allows routing read-only commands to the random master or slave node.
	RouteRandomly bool

	// Following options are copied from Options struct.

	OnConnect func(*Conn) error

	MaxRetries      int
	MinRetryBackoff time.Duration
	MaxRetryBackoff time.Duration
	Password        string

	DialTimeout  time.Duration
	ReadTimeout  time.Duration
	WriteTimeout time.Duration

	// PoolSize applies per cluster node and not for the whole cluster.
	PoolSize           int
	PoolTimeout        time.Duration
	IdleTimeout        time.Duration
	IdleCheckFrequency time.Duration
}

func (opt *ClusterOptions) init() {
	if opt.MaxRedirects == -1 {
		opt.MaxRedirects = 0
	} else if opt.MaxRedirects == 0 {
		opt.MaxRedirects = 8
	}

	if opt.RouteByLatency {
		opt.ReadOnly = true
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

func (opt *ClusterOptions) clientOptions() *Options {
	const disableIdleCheck = -1

	return &Options{
		OnConnect: opt.OnConnect,

		MaxRetries:      opt.MaxRetries,
		MinRetryBackoff: opt.MinRetryBackoff,
		MaxRetryBackoff: opt.MaxRetryBackoff,
		Password:        opt.Password,
		readOnly:        opt.ReadOnly,

		DialTimeout:  opt.DialTimeout,
		ReadTimeout:  opt.ReadTimeout,
		WriteTimeout: opt.WriteTimeout,

		PoolSize:    opt.PoolSize,
		PoolTimeout: opt.PoolTimeout,
		IdleTimeout: opt.IdleTimeout,

		IdleCheckFrequency: disableIdleCheck,
	}
}

//------------------------------------------------------------------------------

type clusterNode struct {
	Client *Client

	latency    uint32 // atomic
	generation uint32 // atomic
	loading    uint32 // atomic
}

func newClusterNode(clOpt *ClusterOptions, addr string) *clusterNode {
	opt := clOpt.clientOptions()
	opt.Addr = addr
	node := clusterNode{
		Client: NewClient(opt),
	}

	node.latency = math.MaxUint32
	if clOpt.RouteByLatency {
		go node.updateLatency()
	}

	return &node
}

func (n *clusterNode) Close() error {
	return n.Client.Close()
}

func (n *clusterNode) Test() error {
	return n.Client.ClusterInfo().Err()
}

func (n *clusterNode) updateLatency() {
	const probes = 10

	var latency uint32
	for i := 0; i < probes; i++ {
		start := time.Now()
		n.Client.Ping()
		probe := uint32(time.Since(start) / time.Microsecond)
		latency = (latency + probe) / 2
	}
	atomic.StoreUint32(&n.latency, latency)
}

func (n *clusterNode) Latency() time.Duration {
	latency := atomic.LoadUint32(&n.latency)
	return time.Duration(latency) * time.Microsecond
}

func (n *clusterNode) MarkAsLoading() {
	atomic.StoreUint32(&n.loading, uint32(time.Now().Unix()))
}

func (n *clusterNode) Loading() bool {
	const minute = int64(time.Minute / time.Second)

	loading := atomic.LoadUint32(&n.loading)
	if loading == 0 {
		return false
	}
	if time.Now().Unix()-int64(loading) < minute {
		return true
	}
	atomic.StoreUint32(&n.loading, 0)
	return false
}

func (n *clusterNode) Generation() uint32 {
	return atomic.LoadUint32(&n.generation)
}

func (n *clusterNode) SetGeneration(gen uint32) {
	for {
		v := atomic.LoadUint32(&n.generation)
		if gen < v || atomic.CompareAndSwapUint32(&n.generation, v, gen) {
			break
		}
	}
}

//------------------------------------------------------------------------------

type clusterNodes struct {
	opt *ClusterOptions

	mu           sync.RWMutex
	allAddrs     []string
	allNodes     map[string]*clusterNode
	clusterAddrs []string
	closed       bool

	nodeCreateGroup singleflight.Group

	generation uint32
}

func newClusterNodes(opt *ClusterOptions) *clusterNodes {
	return &clusterNodes{
		opt: opt,

		allAddrs: opt.Addrs,
		allNodes: make(map[string]*clusterNode),
	}
}

func (c *clusterNodes) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return nil
	}
	c.closed = true

	var firstErr error
	for _, node := range c.allNodes {
		if err := node.Client.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}

	c.allNodes = nil
	c.clusterAddrs = nil

	return firstErr
}

func (c *clusterNodes) Addrs() ([]string, error) {
	var addrs []string
	c.mu.RLock()
	closed := c.closed
	if !closed {
		if len(c.clusterAddrs) > 0 {
			addrs = c.clusterAddrs
		} else {
			addrs = c.allAddrs
		}
	}
	c.mu.RUnlock()

	if closed {
		return nil, pool.ErrClosed
	}
	if len(addrs) == 0 {
		return nil, errClusterNoNodes
	}
	return addrs, nil
}

func (c *clusterNodes) NextGeneration() uint32 {
	c.generation++
	return c.generation
}

// GC removes unused nodes.
func (c *clusterNodes) GC(generation uint32) {
	var collected []*clusterNode
	c.mu.Lock()
	for addr, node := range c.allNodes {
		if node.Generation() >= generation {
			continue
		}

		c.clusterAddrs = remove(c.clusterAddrs, addr)
		delete(c.allNodes, addr)
		collected = append(collected, node)
	}
	c.mu.Unlock()

	for _, node := range collected {
		_ = node.Client.Close()
	}
}

func (c *clusterNodes) GetOrCreate(addr string) (*clusterNode, error) {
	var node *clusterNode
	var err error

	c.mu.RLock()
	if c.closed {
		err = pool.ErrClosed
	} else {
		node = c.allNodes[addr]
	}
	c.mu.RUnlock()
	if err != nil {
		return nil, err
	}
	if node != nil {
		return node, nil
	}

	v, err := c.nodeCreateGroup.Do(addr, func() (interface{}, error) {
		node := newClusterNode(c.opt, addr)
		return node, node.Test()
	})

	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return nil, pool.ErrClosed
	}

	node, ok := c.allNodes[addr]
	if ok {
		_ = v.(*clusterNode).Close()
		return node, err
	}
	node = v.(*clusterNode)

	c.allAddrs = appendIfNotExists(c.allAddrs, addr)
	if err == nil {
		c.clusterAddrs = append(c.clusterAddrs, addr)
	}
	c.allNodes[addr] = node

	return node, err
}

func (c *clusterNodes) All() ([]*clusterNode, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.closed {
		return nil, pool.ErrClosed
	}

	cp := make([]*clusterNode, 0, len(c.allNodes))
	for _, node := range c.allNodes {
		cp = append(cp, node)
	}
	return cp, nil
}

func (c *clusterNodes) Random() (*clusterNode, error) {
	addrs, err := c.Addrs()
	if err != nil {
		return nil, err
	}

	n := rand.Intn(len(addrs))
	return c.GetOrCreate(addrs[n])
}

//------------------------------------------------------------------------------

type clusterState struct {
	nodes   *clusterNodes
	masters []*clusterNode
	slaves  []*clusterNode

	slots [][]*clusterNode

	generation uint32
}

func newClusterState(nodes *clusterNodes, slots []ClusterSlot, origin string) (*clusterState, error) {
	c := clusterState{
		nodes:      nodes,
		generation: nodes.NextGeneration(),

		slots: make([][]*clusterNode, hashtag.SlotNumber),
	}

	isLoopbackOrigin := isLoopbackAddr(origin)
	for _, slot := range slots {
		var nodes []*clusterNode
		for i, slotNode := range slot.Nodes {
			addr := slotNode.Addr
			if !isLoopbackOrigin && isLoopbackAddr(addr) {
				addr = origin
			}

			node, err := c.nodes.GetOrCreate(addr)
			if err != nil {
				return nil, err
			}

			node.SetGeneration(c.generation)
			nodes = append(nodes, node)

			if i == 0 {
				c.masters = appendNode(c.masters, node)
			} else {
				c.slaves = appendNode(c.slaves, node)
			}
		}

		for i := slot.Start; i <= slot.End; i++ {
			c.slots[i] = nodes
		}
	}

	time.AfterFunc(time.Minute, func() {
		nodes.GC(c.generation)
	})

	return &c, nil
}

func (c *clusterState) slotMasterNode(slot int) (*clusterNode, error) {
	nodes := c.slotNodes(slot)
	if len(nodes) > 0 {
		return nodes[0], nil
	}
	return c.nodes.Random()
}

func (c *clusterState) slotSlaveNode(slot int) (*clusterNode, error) {
	nodes := c.slotNodes(slot)
	switch len(nodes) {
	case 0:
		return c.nodes.Random()
	case 1:
		return nodes[0], nil
	case 2:
		if slave := nodes[1]; !slave.Loading() {
			return slave, nil
		}
		return nodes[0], nil
	default:
		var slave *clusterNode
		for i := 0; i < 10; i++ {
			n := rand.Intn(len(nodes)-1) + 1
			slave = nodes[n]
			if !slave.Loading() {
				break
			}
		}
		return slave, nil
	}
}

func (c *clusterState) slotClosestNode(slot int) (*clusterNode, error) {
	const threshold = time.Millisecond

	nodes := c.slotNodes(slot)
	if len(nodes) == 0 {
		return c.nodes.Random()
	}

	var node *clusterNode
	for _, n := range nodes {
		if n.Loading() {
			continue
		}
		if node == nil || node.Latency()-n.Latency() > threshold {
			node = n
		}
	}
	return node, nil
}

func (c *clusterState) slotRandomNode(slot int) *clusterNode {
	nodes := c.slotNodes(slot)
	n := rand.Intn(len(nodes))
	return nodes[n]
}

func (c *clusterState) slotNodes(slot int) []*clusterNode {
	if slot >= 0 && slot < len(c.slots) {
		return c.slots[slot]
	}
	return nil
}

//------------------------------------------------------------------------------

type clusterStateHolder struct {
	load func() (*clusterState, error)

	state atomic.Value

	lastErrMu sync.RWMutex
	lastErr   error

	reloading uint32 // atomic
}

func newClusterStateHolder(fn func() (*clusterState, error)) *clusterStateHolder {
	return &clusterStateHolder{
		load: fn,
	}
}

func (c *clusterStateHolder) Load() (*clusterState, error) {
	state, err := c.load()
	if err != nil {
		c.lastErrMu.Lock()
		c.lastErr = err
		c.lastErrMu.Unlock()
		return nil, err
	}
	c.state.Store(state)
	return state, nil
}

func (c *clusterStateHolder) LazyReload() {
	if !atomic.CompareAndSwapUint32(&c.reloading, 0, 1) {
		return
	}
	go func() {
		defer atomic.StoreUint32(&c.reloading, 0)

		_, err := c.Load()
		if err == nil {
			time.Sleep(time.Second)
		}
	}()
}

func (c *clusterStateHolder) Get() (*clusterState, error) {
	v := c.state.Load()
	if v != nil {
		return v.(*clusterState), nil
	}

	c.lastErrMu.RLock()
	err := c.lastErr
	c.lastErrMu.RUnlock()
	if err != nil {
		return nil, err
	}

	return nil, errors.New("redis: cluster has no state")
}

//------------------------------------------------------------------------------

// ClusterClient is a Redis Cluster client representing a pool of zero
// or more underlying connections. It's safe for concurrent use by
// multiple goroutines.
type ClusterClient struct {
	cmdable

	ctx context.Context

	opt           *ClusterOptions
	nodes         *clusterNodes
	state         *clusterStateHolder
	cmdsInfoCache *cmdsInfoCache

	process           func(Cmder) error
	processPipeline   func([]Cmder) error
	processTxPipeline func([]Cmder) error
}

// NewClusterClient returns a Redis Cluster client as described in
// http://redis.io/topics/cluster-spec.
func NewClusterClient(opt *ClusterOptions) *ClusterClient {
	opt.init()

	c := &ClusterClient{
		opt:           opt,
		nodes:         newClusterNodes(opt),
		cmdsInfoCache: newCmdsInfoCache(),
	}
	c.state = newClusterStateHolder(c.loadState)

	c.process = c.defaultProcess
	c.processPipeline = c.defaultProcessPipeline
	c.processTxPipeline = c.defaultProcessTxPipeline

	c.cmdable.setProcessor(c.Process)

	_, _ = c.state.Load()
	if opt.IdleCheckFrequency > 0 {
		go c.reaper(opt.IdleCheckFrequency)
	}

	return c
}

func (c *ClusterClient) Context() context.Context {
	if c.ctx != nil {
		return c.ctx
	}
	return context.Background()
}

func (c *ClusterClient) WithContext(ctx context.Context) *ClusterClient {
	if ctx == nil {
		panic("nil context")
	}
	c2 := c.copy()
	c2.ctx = ctx
	return c2
}

func (c *ClusterClient) copy() *ClusterClient {
	cp := *c
	return &cp
}

// Options returns read-only Options that were used to create the client.
func (c *ClusterClient) Options() *ClusterOptions {
	return c.opt
}

func (c *ClusterClient) retryBackoff(attempt int) time.Duration {
	return internal.RetryBackoff(attempt, c.opt.MinRetryBackoff, c.opt.MaxRetryBackoff)
}

func (c *ClusterClient) cmdInfo(name string) *CommandInfo {
	cmdsInfo, err := c.cmdsInfoCache.Do(func() (map[string]*CommandInfo, error) {
		node, err := c.nodes.Random()
		if err != nil {
			return nil, err
		}
		return node.Client.Command().Result()
	})
	if err != nil {
		return nil
	}
	info := cmdsInfo[name]
	if info == nil {
		internal.Logf("info for cmd=%s not found", name)
	}
	return info
}

func cmdSlot(cmd Cmder, pos int) int {
	if pos == 0 {
		return hashtag.RandomSlot()
	}
	firstKey := cmd.stringArg(pos)
	return hashtag.Slot(firstKey)
}

func (c *ClusterClient) cmdSlot(cmd Cmder) int {
	cmdInfo := c.cmdInfo(cmd.Name())
	return cmdSlot(cmd, cmdFirstKeyPos(cmd, cmdInfo))
}

func (c *ClusterClient) cmdSlotAndNode(cmd Cmder) (int, *clusterNode, error) {
	state, err := c.state.Get()
	if err != nil {
		return 0, nil, err
	}

	cmdInfo := c.cmdInfo(cmd.Name())
	slot := cmdSlot(cmd, cmdFirstKeyPos(cmd, cmdInfo))

	if cmdInfo != nil && cmdInfo.ReadOnly && c.opt.ReadOnly {
		if c.opt.RouteByLatency {
			node, err := state.slotClosestNode(slot)
			return slot, node, err
		}

		if c.opt.RouteRandomly {
			node := state.slotRandomNode(slot)
			return slot, node, nil
		}

		node, err := state.slotSlaveNode(slot)
		return slot, node, err
	}

	node, err := state.slotMasterNode(slot)
	return slot, node, err
}

func (c *ClusterClient) slotMasterNode(slot int) (*clusterNode, error) {
	state, err := c.state.Get()
	if err != nil {
		return nil, err
	}

	nodes := state.slotNodes(slot)
	if len(nodes) > 0 {
		return nodes[0], nil
	}
	return c.nodes.Random()
}

func (c *ClusterClient) Watch(fn func(*Tx) error, keys ...string) error {
	if len(keys) == 0 {
		return fmt.Errorf("redis: keys don't hash to the same slot")
	}

	slot := hashtag.Slot(keys[0])
	for _, key := range keys[1:] {
		if hashtag.Slot(key) != slot {
			return fmt.Errorf("redis: Watch requires all keys to be in the same slot")
		}
	}

	node, err := c.slotMasterNode(slot)
	if err != nil {
		return err
	}

	for attempt := 0; attempt <= c.opt.MaxRedirects; attempt++ {
		if attempt > 0 {
			time.Sleep(c.retryBackoff(attempt))
		}

		err = node.Client.Watch(fn, keys...)
		if err == nil {
			break
		}

		if internal.IsRetryableError(err, true) {
			continue
		}

		moved, ask, addr := internal.IsMovedError(err)
		if moved || ask {
			c.state.LazyReload()
			node, err = c.nodes.GetOrCreate(addr)
			if err != nil {
				return err
			}
			continue
		}

		if err == pool.ErrClosed {
			node, err = c.slotMasterNode(slot)
			if err != nil {
				return err
			}
			continue
		}

		return err
	}

	return err
}

// Close closes the cluster client, releasing any open resources.
//
// It is rare to Close a ClusterClient, as the ClusterClient is meant
// to be long-lived and shared between many goroutines.
func (c *ClusterClient) Close() error {
	return c.nodes.Close()
}

func (c *ClusterClient) WrapProcess(
	fn func(oldProcess func(Cmder) error) func(Cmder) error,
) {
	c.process = fn(c.process)
}

func (c *ClusterClient) Process(cmd Cmder) error {
	return c.process(cmd)
}

func (c *ClusterClient) defaultProcess(cmd Cmder) error {
	var node *clusterNode
	var ask bool
	for attempt := 0; attempt <= c.opt.MaxRedirects; attempt++ {
		if attempt > 0 {
			time.Sleep(c.retryBackoff(attempt))
		}

		if node == nil {
			var err error
			_, node, err = c.cmdSlotAndNode(cmd)
			if err != nil {
				cmd.setErr(err)
				break
			}
		}

		var err error
		if ask {
			pipe := node.Client.Pipeline()
			_ = pipe.Process(NewCmd("ASKING"))
			_ = pipe.Process(cmd)
			_, err = pipe.Exec()
			_ = pipe.Close()
			ask = false
		} else {
			err = node.Client.Process(cmd)
		}

		// If there is no error - we are done.
		if err == nil {
			break
		}

		// If slave is loading - read from master.
		if c.opt.ReadOnly && internal.IsLoadingError(err) {
			node.MarkAsLoading()
			continue
		}

		if internal.IsRetryableError(err, true) {
			node, err = c.nodes.Random()
			if err != nil {
				break
			}
			continue
		}

		var moved bool
		var addr string
		moved, ask, addr = internal.IsMovedError(err)
		if moved || ask {
			c.state.LazyReload()

			node, err = c.nodes.GetOrCreate(addr)
			if err != nil {
				break
			}
			continue
		}

		if err == pool.ErrClosed {
			node = nil
			continue
		}

		break
	}

	return cmd.Err()
}

// ForEachMaster concurrently calls the fn on each master node in the cluster.
// It returns the first error if any.
func (c *ClusterClient) ForEachMaster(fn func(client *Client) error) error {
	state, err := c.state.Get()
	if err != nil {
		return err
	}

	var wg sync.WaitGroup
	errCh := make(chan error, 1)
	for _, master := range state.masters {
		wg.Add(1)
		go func(node *clusterNode) {
			defer wg.Done()
			err := fn(node.Client)
			if err != nil {
				select {
				case errCh <- err:
				default:
				}
			}
		}(master)
	}
	wg.Wait()

	select {
	case err := <-errCh:
		return err
	default:
		return nil
	}
}

// ForEachSlave concurrently calls the fn on each slave node in the cluster.
// It returns the first error if any.
func (c *ClusterClient) ForEachSlave(fn func(client *Client) error) error {
	state, err := c.state.Get()
	if err != nil {
		return err
	}

	var wg sync.WaitGroup
	errCh := make(chan error, 1)
	for _, slave := range state.slaves {
		wg.Add(1)
		go func(node *clusterNode) {
			defer wg.Done()
			err := fn(node.Client)
			if err != nil {
				select {
				case errCh <- err:
				default:
				}
			}
		}(slave)
	}
	wg.Wait()

	select {
	case err := <-errCh:
		return err
	default:
		return nil
	}
}

// ForEachNode concurrently calls the fn on each known node in the cluster.
// It returns the first error if any.
func (c *ClusterClient) ForEachNode(fn func(client *Client) error) error {
	state, err := c.state.Get()
	if err != nil {
		return err
	}

	var wg sync.WaitGroup
	errCh := make(chan error, 1)
	worker := func(node *clusterNode) {
		defer wg.Done()
		err := fn(node.Client)
		if err != nil {
			select {
			case errCh <- err:
			default:
			}
		}
	}

	for _, node := range state.masters {
		wg.Add(1)
		go worker(node)
	}
	for _, node := range state.slaves {
		wg.Add(1)
		go worker(node)
	}

	wg.Wait()
	select {
	case err := <-errCh:
		return err
	default:
		return nil
	}
}

// PoolStats returns accumulated connection pool stats.
func (c *ClusterClient) PoolStats() *PoolStats {
	var acc PoolStats

	state, _ := c.state.Get()
	if state == nil {
		return &acc
	}

	for _, node := range state.masters {
		s := node.Client.connPool.Stats()
		acc.Hits += s.Hits
		acc.Misses += s.Misses
		acc.Timeouts += s.Timeouts

		acc.TotalConns += s.TotalConns
		acc.FreeConns += s.FreeConns
		acc.StaleConns += s.StaleConns
	}

	for _, node := range state.slaves {
		s := node.Client.connPool.Stats()
		acc.Hits += s.Hits
		acc.Misses += s.Misses
		acc.Timeouts += s.Timeouts

		acc.TotalConns += s.TotalConns
		acc.FreeConns += s.FreeConns
		acc.StaleConns += s.StaleConns
	}

	return &acc
}

func (c *ClusterClient) loadState() (*clusterState, error) {
	addrs, err := c.nodes.Addrs()
	if err != nil {
		return nil, err
	}

	var firstErr error
	for _, addr := range addrs {
		node, err := c.nodes.GetOrCreate(addr)
		if err != nil {
			if firstErr == nil {
				firstErr = err
			}
			continue
		}

		slots, err := node.Client.ClusterSlots().Result()
		if err != nil {
			if firstErr == nil {
				firstErr = err
			}
			continue
		}

		return newClusterState(c.nodes, slots, node.Client.opt.Addr)
	}

	return nil, firstErr
}

// reaper closes idle connections to the cluster.
func (c *ClusterClient) reaper(idleCheckFrequency time.Duration) {
	ticker := time.NewTicker(idleCheckFrequency)
	defer ticker.Stop()

	for range ticker.C {
		nodes, err := c.nodes.All()
		if err != nil {
			break
		}

		for _, node := range nodes {
			_, err := node.Client.connPool.(*pool.ConnPool).ReapStaleConns()
			if err != nil {
				internal.Logf("ReapStaleConns failed: %s", err)
			}
		}
	}
}

func (c *ClusterClient) Pipeline() Pipeliner {
	pipe := Pipeline{
		exec: c.processPipeline,
	}
	pipe.statefulCmdable.setProcessor(pipe.Process)
	return &pipe
}

func (c *ClusterClient) Pipelined(fn func(Pipeliner) error) ([]Cmder, error) {
	return c.Pipeline().Pipelined(fn)
}

func (c *ClusterClient) WrapProcessPipeline(
	fn func(oldProcess func([]Cmder) error) func([]Cmder) error,
) {
	c.processPipeline = fn(c.processPipeline)
}

func (c *ClusterClient) defaultProcessPipeline(cmds []Cmder) error {
	cmdsMap, err := c.mapCmdsByNode(cmds)
	if err != nil {
		setCmdsErr(cmds, err)
		return err
	}

	for attempt := 0; attempt <= c.opt.MaxRedirects; attempt++ {
		if attempt > 0 {
			time.Sleep(c.retryBackoff(attempt))
		}

		failedCmds := make(map[*clusterNode][]Cmder)

		for node, cmds := range cmdsMap {
			cn, _, err := node.Client.getConn()
			if err != nil {
				if err == pool.ErrClosed {
					c.remapCmds(cmds, failedCmds)
				} else {
					setCmdsErr(cmds, err)
				}
				continue
			}

			err = c.pipelineProcessCmds(node, cn, cmds, failedCmds)
			if err == nil || internal.IsRedisError(err) {
				_ = node.Client.connPool.Put(cn)
			} else {
				_ = node.Client.connPool.Remove(cn)
			}
		}

		if len(failedCmds) == 0 {
			break
		}
		cmdsMap = failedCmds
	}

	return firstCmdsErr(cmds)
}

func (c *ClusterClient) mapCmdsByNode(cmds []Cmder) (map[*clusterNode][]Cmder, error) {
	state, err := c.state.Get()
	if err != nil {
		setCmdsErr(cmds, err)
		return nil, err
	}

	cmdsMap := make(map[*clusterNode][]Cmder)
	for _, cmd := range cmds {
		slot := c.cmdSlot(cmd)
		node, err := state.slotMasterNode(slot)
		if err != nil {
			return nil, err
		}
		cmdsMap[node] = append(cmdsMap[node], cmd)
	}
	return cmdsMap, nil
}

func (c *ClusterClient) remapCmds(cmds []Cmder, failedCmds map[*clusterNode][]Cmder) {
	remappedCmds, err := c.mapCmdsByNode(cmds)
	if err != nil {
		setCmdsErr(cmds, err)
		return
	}

	for node, cmds := range remappedCmds {
		failedCmds[node] = cmds
	}
}

func (c *ClusterClient) pipelineProcessCmds(
	node *clusterNode, cn *pool.Conn, cmds []Cmder, failedCmds map[*clusterNode][]Cmder,
) error {
	_ = cn.SetWriteTimeout(c.opt.WriteTimeout)

	err := writeCmd(cn, cmds...)
	if err != nil {
		setCmdsErr(cmds, err)
		failedCmds[node] = cmds
		return err
	}

	// Set read timeout for all commands.
	_ = cn.SetReadTimeout(c.opt.ReadTimeout)

	return c.pipelineReadCmds(cn, cmds, failedCmds)
}

func (c *ClusterClient) pipelineReadCmds(
	cn *pool.Conn, cmds []Cmder, failedCmds map[*clusterNode][]Cmder,
) error {
	for _, cmd := range cmds {
		err := cmd.readReply(cn)
		if err == nil {
			continue
		}

		if c.checkMovedErr(cmd, err, failedCmds) {
			continue
		}

		if internal.IsRedisError(err) {
			continue
		}

		return err
	}
	return nil
}

func (c *ClusterClient) checkMovedErr(
	cmd Cmder, err error, failedCmds map[*clusterNode][]Cmder,
) bool {
	moved, ask, addr := internal.IsMovedError(err)

	if moved {
		c.state.LazyReload()

		node, err := c.nodes.GetOrCreate(addr)
		if err != nil {
			return false
		}

		failedCmds[node] = append(failedCmds[node], cmd)
		return true
	}

	if ask {
		node, err := c.nodes.GetOrCreate(addr)
		if err != nil {
			return false
		}

		failedCmds[node] = append(failedCmds[node], NewCmd("ASKING"), cmd)
		return true
	}

	return false
}

// TxPipeline acts like Pipeline, but wraps queued commands with MULTI/EXEC.
func (c *ClusterClient) TxPipeline() Pipeliner {
	pipe := Pipeline{
		exec: c.processTxPipeline,
	}
	pipe.statefulCmdable.setProcessor(pipe.Process)
	return &pipe
}

func (c *ClusterClient) TxPipelined(fn func(Pipeliner) error) ([]Cmder, error) {
	return c.TxPipeline().Pipelined(fn)
}

func (c *ClusterClient) defaultProcessTxPipeline(cmds []Cmder) error {
	state, err := c.state.Get()
	if err != nil {
		return err
	}

	cmdsMap := c.mapCmdsBySlot(cmds)
	for slot, cmds := range cmdsMap {
		node, err := state.slotMasterNode(slot)
		if err != nil {
			setCmdsErr(cmds, err)
			continue
		}
		cmdsMap := map[*clusterNode][]Cmder{node: cmds}

		for attempt := 0; attempt <= c.opt.MaxRedirects; attempt++ {
			if attempt > 0 {
				time.Sleep(c.retryBackoff(attempt))
			}

			failedCmds := make(map[*clusterNode][]Cmder)

			for node, cmds := range cmdsMap {
				cn, _, err := node.Client.getConn()
				if err != nil {
					if err == pool.ErrClosed {
						c.remapCmds(cmds, failedCmds)
					} else {
						setCmdsErr(cmds, err)
					}
					continue
				}

				err = c.txPipelineProcessCmds(node, cn, cmds, failedCmds)
				if err == nil || internal.IsRedisError(err) {
					_ = node.Client.connPool.Put(cn)
				} else {
					_ = node.Client.connPool.Remove(cn)
				}
			}

			if len(failedCmds) == 0 {
				break
			}
			cmdsMap = failedCmds
		}
	}

	return firstCmdsErr(cmds)
}

func (c *ClusterClient) mapCmdsBySlot(cmds []Cmder) map[int][]Cmder {
	cmdsMap := make(map[int][]Cmder)
	for _, cmd := range cmds {
		slot := c.cmdSlot(cmd)
		cmdsMap[slot] = append(cmdsMap[slot], cmd)
	}
	return cmdsMap
}

func (c *ClusterClient) txPipelineProcessCmds(
	node *clusterNode, cn *pool.Conn, cmds []Cmder, failedCmds map[*clusterNode][]Cmder,
) error {
	cn.SetWriteTimeout(c.opt.WriteTimeout)
	if err := txPipelineWriteMulti(cn, cmds); err != nil {
		setCmdsErr(cmds, err)
		failedCmds[node] = cmds
		return err
	}

	// Set read timeout for all commands.
	cn.SetReadTimeout(c.opt.ReadTimeout)

	if err := c.txPipelineReadQueued(cn, cmds, failedCmds); err != nil {
		setCmdsErr(cmds, err)
		return err
	}

	return pipelineReadCmds(cn, cmds)
}

func (c *ClusterClient) txPipelineReadQueued(
	cn *pool.Conn, cmds []Cmder, failedCmds map[*clusterNode][]Cmder,
) error {
	// Parse queued replies.
	var statusCmd StatusCmd
	if err := statusCmd.readReply(cn); err != nil {
		return err
	}

	for _, cmd := range cmds {
		err := statusCmd.readReply(cn)
		if err == nil {
			continue
		}

		if c.checkMovedErr(cmd, err, failedCmds) || internal.IsRedisError(err) {
			continue
		}

		return err
	}

	// Parse number of replies.
	line, err := cn.Rd.ReadLine()
	if err != nil {
		if err == Nil {
			err = TxFailedErr
		}
		return err
	}

	switch line[0] {
	case proto.ErrorReply:
		err := proto.ParseErrorReply(line)
		for _, cmd := range cmds {
			if !c.checkMovedErr(cmd, err, failedCmds) {
				break
			}
		}
		return err
	case proto.ArrayReply:
		// ok
	default:
		err := fmt.Errorf("redis: expected '*', but got line %q", line)
		return err
	}

	return nil
}

func (c *ClusterClient) pubSub(channels []string) *PubSub {
	opt := c.opt.clientOptions()

	var node *clusterNode
	return &PubSub{
		opt: opt,

		newConn: func(channels []string) (*pool.Conn, error) {
			if node == nil {
				var slot int
				if len(channels) > 0 {
					slot = hashtag.Slot(channels[0])
				} else {
					slot = -1
				}

				masterNode, err := c.slotMasterNode(slot)
				if err != nil {
					return nil, err
				}
				node = masterNode
			}
			return node.Client.newConn()
		},
		closeConn: func(cn *pool.Conn) error {
			return node.Client.connPool.CloseConn(cn)
		},
	}
}

// Subscribe subscribes the client to the specified channels.
// Channels can be omitted to create empty subscription.
func (c *ClusterClient) Subscribe(channels ...string) *PubSub {
	pubsub := c.pubSub(channels)
	if len(channels) > 0 {
		_ = pubsub.Subscribe(channels...)
	}
	return pubsub
}

// PSubscribe subscribes the client to the given patterns.
// Patterns can be omitted to create empty subscription.
func (c *ClusterClient) PSubscribe(channels ...string) *PubSub {
	pubsub := c.pubSub(channels)
	if len(channels) > 0 {
		_ = pubsub.PSubscribe(channels...)
	}
	return pubsub
}

func isLoopbackAddr(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return false
	}

	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}

	return ip.IsLoopback()
}

func appendNode(nodes []*clusterNode, node *clusterNode) []*clusterNode {
	for _, n := range nodes {
		if n == node {
			return nodes
		}
	}
	return append(nodes, node)
}

func appendIfNotExists(ss []string, es ...string) []string {
loop:
	for _, e := range es {
		for _, s := range ss {
			if s == e {
				continue loop
			}
		}
		ss = append(ss, e)
	}
	return ss
}

func remove(ss []string, es ...string) []string {
	if len(es) == 0 {
		return ss[:0]
	}
	for _, e := range es {
		for i, s := range ss {
			if s == e {
				ss = append(ss[:i], ss[i+1:]...)
				break
			}
		}
	}
	return ss
}
