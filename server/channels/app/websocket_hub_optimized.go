// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package websocket

import (
	"context"
	"crypto/tls"
	"net"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

const (
	// Connection Pool Constants
	DefaultPoolCapacity     = 5000
	MaxPoolCapacity        = 50000
	ConnectionLifetime     = 24 * time.Hour
	PoolCleanupInterval    = 5 * time.Minute
	
	// Connection Configuration
	ReadBufferSize         = 4096
	WriteBufferSize        = 4096
	HandshakeTimeout       = 10 * time.Second
	PongWaitTimeout        = 60 * time.Second
	PingPeriod            = 54 * time.Second
	WriteWaitTimeout       = 10 * time.Second
	
	// Performance Tuning
	MaxMessageSize         = 32768
	CompressionLevel       = 1
	CompressionThreshold   = 1024
	
	// Load Balancing
	MaxConnectionsPerIP    = 100
	RateLimitWindow       = time.Minute
	RateLimitMaxRequests  = 1000
)

// ConnectionPool manages a pool of WebSocket connections with advanced features
type ConnectionPool struct {
	mu                sync.RWMutex
	connections       map[string]*PooledWebSocketConnection
	connectionsByIP   map[string][]*PooledWebSocketConnection
	idleConnections   chan *PooledWebSocketConnection
	
	// Configuration
	maxCapacity       int
	currentSize       int64
	upgrader          *websocket.Upgrader
	
	// Lifecycle management
	ctx               context.Context
	cancel            context.CancelFunc
	cleanupTicker     *time.Ticker
	
	// Performance metrics
	metrics           *ConnectionPoolMetrics
	rateLimiter       *RateLimiter
	loadBalancer      *LoadBalancer
	
	// Logging
	logger            mlog.LoggerIFace
	
	// Connection factories
	connectionFactory ConnectionFactory
	tlsConfig        *tls.Config
}

// PooledWebSocketConnection represents a connection in the pool with enhanced metadata
type PooledWebSocketConnection struct {
	// Core WebSocket connection
	conn              *websocket.Conn
	
	// Metadata
	id                string
	userID            string
	sessionID         string
	remoteAddr        string
	userAgent         string
	
	// Timing information
	createdAt         time.Time
	lastActivity      time.Time
	lastPing          time.Time
	lastPong          time.Time
	
	// State management
	isActive          bool
	isAuthenticated   bool
	compressionEnabled bool
	
	// Performance tracking
	messagesSent      int64
	messagesReceived  int64
	bytesSent         int64
	bytesReceived     int64
	errorCount        int64
	
	// Channels for message handling
	sendChan          chan []byte
	closeChan         chan struct{}
	
	// Connection-specific context
	ctx               context.Context
	cancel            context.CancelFunc
	
	// Mutex for thread safety
	mu                sync.RWMutex
}

// ConnectionPoolMetrics tracks detailed performance metrics
type ConnectionPoolMetrics struct {
	mu                        sync.RWMutex
	
	// Connection metrics
	TotalConnections          int64
	ActiveConnections         int64
	IdleConnections          int64
	ConnectionsCreated        int64
	ConnectionsDestroyed      int64
	ConnectionsReused         int64
	
	// Performance metrics
	AverageConnectionLifetime time.Duration
	AverageMessageLatency     time.Duration
	TotalBytesTransferred     int64
	MessagesPerSecond         int64
	ConnectionsPerSecond      int64
	
	// Error metrics
	ConnectionErrors          int64
	TimeoutErrors            int64
	AuthenticationErrors      int64
	RateLimitErrors          int64
	
	// Resource utilization
	MemoryUsage              int64
	CPUUsage                 float64
	NetworkUtilization       float64
	
	// Load balancing metrics
	LoadBalancerHits         int64
	LoadBalancerMisses       int64
	AverageLoadPerConnection float64
	
	LastUpdated              time.Time
}

// RateLimiter implements advanced rate limiting with sliding window
type RateLimiter struct {
	mu           sync.RWMutex
	windows      map[string]*SlidingWindow
	maxRequests  int
	windowSize   time.Duration
	cleanupTimer *time.Timer
}

// SlidingWindow tracks requests in a time window
type SlidingWindow struct {
	requests    []time.Time
	mu          sync.Mutex
}

// LoadBalancer distributes connections across multiple backend servers
type LoadBalancer struct {
	mu        sync.RWMutex
	backends  []*Backend
	algorithm LoadBalancingAlgorithm
	current   int
}

// Backend represents a backend server for load balancing
type Backend struct {
	URL           string
	Weight        int
	Connections   int64
	MaxConnections int64
	IsHealthy     bool
	LastHealthCheck time.Time
}

// LoadBalancingAlgorithm defines load balancing strategies
type LoadBalancingAlgorithm int

const (
	RoundRobin LoadBalancingAlgorithm = iota
	LeastConnections
	WeightedRoundRobin
	IPHash
)

// ConnectionFactory creates new WebSocket connections
type ConnectionFactory interface {
	CreateConnection(w http.ResponseWriter, r *http.Request) (*websocket.Conn, error)
	ConfigureConnection(conn *websocket.Conn) error
}

// DefaultConnectionFactory implements ConnectionFactory
type DefaultConnectionFactory struct {
	upgrader *websocket.Upgrader
}

// NewConnectionPool creates a new optimized connection pool
func NewConnectionPool(maxCapacity int, logger mlog.LoggerIFace) *ConnectionPool {
	if maxCapacity <= 0 {
		maxCapacity = DefaultPoolCapacity
	}
	if maxCapacity > MaxPoolCapacity {
		maxCapacity = MaxPoolCapacity
	}

	ctx, cancel := context.WithCancel(context.Background())

	upgrader := &websocket.Upgrader{
		ReadBufferSize:   ReadBufferSize,
		WriteBufferSize:  WriteBufferSize,
		HandshakeTimeout: HandshakeTimeout,
		CheckOrigin: func(r *http.Request) bool {
			return true // Configure based on your security requirements
		},
		EnableCompression: true,
	}

	pool := &ConnectionPool{
		connections:       make(map[string]*PooledWebSocketConnection),
		connectionsByIP:   make(map[string][]*PooledWebSocketConnection),
		idleConnections:   make(chan *PooledWebSocketConnection, maxCapacity/10),
		maxCapacity:       maxCapacity,
		upgrader:          upgrader,
		ctx:               ctx,
		cancel:            cancel,
		cleanupTicker:     time.NewTicker(PoolCleanupInterval),
		metrics:           NewConnectionPoolMetrics(),
		rateLimiter:       NewRateLimiter(RateLimitMaxRequests, RateLimitWindow),
		loadBalancer:      NewLoadBalancer(),
		logger:            logger,
		connectionFactory: &DefaultConnectionFactory{upgrader: upgrader},
	}

	// Start background routines
	go pool.cleanupRoutine()
	go pool.metricsCollector()
	go pool.rateLimiterCleanup()

	return pool
}

// AcquireConnection gets or creates a WebSocket connection
func (p *ConnectionPool) AcquireConnection(w http.ResponseWriter, r *http.Request, userID, sessionID string) (*PooledWebSocketConnection, error) {
	remoteIP := getClientIP(r)
	
	// Check rate limiting
	if !p.rateLimiter.Allow(remoteIP) {
		atomic.AddInt64(&p.metrics.RateLimitErrors, 1)
		return nil, &model.AppError{
			Message: "Rate limit exceeded",
			StatusCode: http.StatusTooManyRequests,
		}
	}

	// Check connection limits per IP
	if err := p.checkConnectionLimits(remoteIP); err != nil {
		return nil, err
	}

	// Try to reuse idle connection
	if idleConn := p.getIdleConnection(); idleConn != nil {
		if p.reuseConnection(idleConn, userID, sessionID, r) {
			atomic.AddInt64(&p.metrics.ConnectionsReused, 1)
			return idleConn, nil
		}
	}

	// Create new connection
	return p.createNewConnection(w, r, userID, sessionID)
}

// createNewConnection creates a brand new WebSocket connection
func (p *ConnectionPool) createNewConnection(w http.ResponseWriter, r *http.Request, userID, sessionID string) (*PooledWebSocketConnection, error) {
	p.mu.Lock()
	if int64(len(p.connections)) >= int64(p.maxCapacity) {
		p.mu.Unlock()
		return nil, &model.AppError{
			Message: "Connection pool capacity exceeded",
			StatusCode: http.StatusServiceUnavailable,
		}
	}
	p.mu.Unlock()

	// Upgrade HTTP connection to WebSocket
	conn, err := p.connectionFactory.CreateConnection(w, r)
	if err != nil {
		atomic.AddInt64(&p.metrics.ConnectionErrors, 1)
		return nil, &model.AppError{
			Message: "Failed to upgrade connection",
			DetailedError: err.Error(),
		}
	}

	// Configure connection
	if err := p.connectionFactory.ConfigureConnection(conn); err != nil {
		conn.Close()
		return nil, err
	}

	ctx, cancel := context.WithCancel(p.ctx)
	connectionID := generateConnectionID(userID, sessionID, getClientIP(r))

	pooledConn := &PooledWebSocketConnection{
		conn:               conn,
		id:                 connectionID,
		userID:             userID,
		sessionID:          sessionID,
		remoteAddr:         getClientIP(r),
		userAgent:          r.UserAgent(),
		createdAt:          time.Now(),
		lastActivity:       time.Now(),
		isActive:           true,
		compressionEnabled: true,
		sendChan:           make(chan []byte, 256),
		closeChan:          make(chan struct{}),
		ctx:                ctx,
		cancel:             cancel,
	}

	// Register connection
	p.mu.Lock()
	p.connections[connectionID] = pooledConn
	p.connectionsByIP[pooledConn.remoteAddr] = append(p.connectionsByIP[pooledConn.remoteAddr], pooledConn)
	atomic.AddInt64(&p.currentSize, 1)
	p.mu.Unlock()

	// Start connection handlers
	go p.handleConnection(pooledConn)
	go p.connectionWriter(pooledConn)
	go p.connectionReader(pooledConn)

	atomic.AddInt64(&p.metrics.ConnectionsCreated, 1)
	atomic.AddInt64(&p.metrics.ActiveConnections, 1)

	p.logger.Debug("New WebSocket connection created",
		mlog.String("connection_id", connectionID),
		mlog.String("user_id", userID),
		mlog.String("remote_addr", pooledConn.remoteAddr))

	return pooledConn, nil
}

// ReleaseConnection returns a connection to the pool
func (p *ConnectionPool) ReleaseConnection(connectionID string) error {
	p.mu.RLock()
	conn, exists := p.connections[connectionID]
	p.mu.RUnlock()

	if !exists {
		return &model.AppError{
			Message: "Connection not found",
		}
	}

	conn.mu.Lock()
	if !conn.isActive {
		conn.mu.Unlock()
		return nil // Already released
	}

	conn.isActive = false
	conn.lastActivity = time.Now()
	conn.mu.Unlock()

	// Try to put in idle pool for reuse
	select {
	case p.idleConnections <- conn:
		atomic.AddInt64(&p.metrics.ActiveConnections, -1)
		atomic.AddInt64(&p.metrics.IdleConnections, 1)
	default:
		// Idle pool full, destroy connection
		p.destroyConnection(connectionID)
	}

	return nil
}

// DestroyConnection permanently removes a connection
func (p *ConnectionPool) destroyConnection(connectionID string) {
	p.mu.Lock()
	conn, exists := p.connections[connectionID]
	if !exists {
		p.mu.Unlock()
		return
	}

	delete(p.connections, connectionID)
	
	// Remove from IP-based tracking
	ipConnections := p.connectionsByIP[conn.remoteAddr]
	for i, c := range ipConnections {
		if c.id == connectionID {
			p.connectionsByIP[conn.remoteAddr] = append(ipConnections[:i], ipConnections[i+1:]...)
			break
		}
	}
	
	if len(p.connectionsByIP[conn.remoteAddr]) == 0 {
		delete(p.connectionsByIP, conn.remoteAddr)
	}
	
	atomic.AddInt64(&p.currentSize, -1)
	p.mu.Unlock()

	// Clean up connection
	conn.cancel()
	conn.conn.Close()
	close(conn.closeChan)

	atomic.AddInt64(&p.metrics.ConnectionsDestroyed, 1)
	if conn.isActive {
		atomic.AddInt64(&p.metrics.ActiveConnections, -1)
	} else {
		atomic.AddInt64(&p.metrics.IdleConnections, -1)
	}

	p.logger.Debug("WebSocket connection destroyed",
		mlog.String("connection_id", connectionID))
}

// handleConnection manages the lifecycle of a connection
func (p *ConnectionPool) handleConnection(conn *PooledWebSocketConnection) {
	defer p.destroyConnection(conn.id)

	pingTicker := time.NewTicker(PingPeriod)
	defer pingTicker.Stop()

	for {
		select {
		case <-conn.ctx.Done():
			return
		case <-conn.closeChan:
			return
		case <-pingTicker.C:
			conn.mu.Lock()
			if !conn.isActive {
				conn.mu.Unlock()
				return
			}
			
			if err := conn.conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(WriteWaitTimeout)); err != nil {
				conn.mu.Unlock()
				atomic.AddInt64(&conn.errorCount, 1)
				return
			}
			
			conn.lastPing = time.Now()
			conn.mu.Unlock()
		}
	}
}

// connectionWriter handles outgoing messages
func (p *ConnectionPool) connectionWriter(conn *PooledWebSocketConnection) {
	for {
		select {
		case <-conn.ctx.Done():
			return
		case <-conn.closeChan:
			return
		case message := <-conn.sendChan:
			conn.mu.Lock()
			if !conn.isActive {
				conn.mu.Unlock()
				return
			}

			conn.conn.SetWriteDeadline(time.Now().Add(WriteWaitTimeout))
			
			messageType := websocket.TextMessage
			if len(message) > CompressionThreshold && conn.compressionEnabled {
				messageType = websocket.BinaryMessage
			}

			if err := conn.conn.WriteMessage(messageType, message); err != nil {
				conn.mu.Unlock()
				atomic.AddInt64(&conn.errorCount, 1)
				return
			}

			atomic.AddInt64(&conn.messagesSent, 1)
			atomic.AddInt64(&conn.bytesSent, int64(len(message)))
			conn.lastActivity = time.Now()
			conn.mu.Unlock()
		}
	}
}

// connectionReader handles incoming messages
func (p *ConnectionPool) connectionReader(conn *PooledWebSocketConnection) {
	conn.conn.SetReadLimit(MaxMessageSize)
	conn.conn.SetReadDeadline(time.Now().Add(PongWaitTimeout))
	conn.conn.SetPongHandler(func(string) error {
		conn.mu.Lock()
		conn.lastPong = time.Now()
		conn.lastActivity = time.Now()
		conn.mu.Unlock()
		conn.conn.SetReadDeadline(time.Now().Add(PongWaitTimeout))
		return nil
	})

	for {
		select {
		case <-conn.ctx.Done():
			return
		case <-conn.closeChan:
			return
		default:
			messageType, message, err := conn.conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					atomic.AddInt64(&conn.errorCount, 1)
				}
				return
			}

			conn.mu.Lock()
			atomic.AddInt64(&conn.messagesReceived, 1)
			atomic.AddInt64(&conn.bytesReceived, int64(len(message)))
			conn.lastActivity = time.Now()
			conn.mu.Unlock()

			// Process message based on type
			switch messageType {
			case websocket.TextMessage, websocket.BinaryMessage:
				// Handle application messages
				// This would integrate with your message handling system
			}
		}
	}
}

// Helper functions and methods

func (p *ConnectionPool) getIdleConnection() *PooledWebSocketConnection {
	select {
	case conn := <-p.idleConnections:
		return conn
	default:
		return nil
	}
}

func (p *ConnectionPool) reuseConnection(conn *PooledWebSocketConnection, userID, sessionID string, r *http.Request) bool {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	// Check if connection is still healthy
	if time.Since(conn.lastActivity) > ConnectionLifetime {
		return false
	}

	// Update connection metadata
	conn.userID = userID
	conn.sessionID = sessionID
	conn.isActive = true
	conn.lastActivity = time.Now()

	return true
}

func (p *ConnectionPool) checkConnectionLimits(remoteIP string) error {
	p.mu.RLock()
	connections := p.connectionsByIP[remoteIP]
	p.mu.RUnlock()

	if len(connections) >= MaxConnectionsPerIP {
		return &model.AppError{
			Message: "Too many connections from this IP",
			StatusCode: http.StatusTooManyRequests,
		}
	}

	return nil
}

func (p *ConnectionPool) cleanupRoutine() {
	for {
		select {
		case <-p.ctx.Done():
			return
		case <-p.cleanupTicker.C:
			p.performCleanup()
		}
	}
}

func (p *ConnectionPool) performCleanup() {
	now := time.Now()
	toDestroy := make([]string, 0)

	p.mu.RLock()
	for id, conn := range p.connections {
		conn.mu.RLock()
		if !conn.isActive && now.Sub(conn.lastActivity) > ConnectionLifetime {
			toDestroy = append(toDestroy, id)
		}
		conn.mu.RUnlock()
	}
	p.mu.RUnlock()

	for _, id := range toDestroy {
		p.destroyConnection(id)
	}

	p.logger.Debug("Connection pool cleanup completed",
		mlog.Int("connections_destroyed", len(toDestroy)),
		mlog.Int64("active_connections", atomic.LoadInt64(&p.metrics.ActiveConnections)))
}

func (p *ConnectionPool) metricsCollector() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-p.ctx.Done():
			return
		case <-ticker.C:
			p.updateMetrics()
		}
	}
}

func (p *ConnectionPool) updateMetrics() {
	p.mu.RLock()
	totalConnections := len(p.connections)
	p.mu.RUnlock()

	p.metrics.mu.Lock()
	p.metrics.TotalConnections = int64(totalConnections)
	p.metrics.LastUpdated = time.Now()
	p.metrics.mu.Unlock()
}

func (p *ConnectionPool) rateLimiterCleanup() {
	ticker := time.NewTicker(time.Minute * 5)
	defer ticker.Stop()

	for {
		select {
		case <-p.ctx.Done():
			return
		case <-ticker.C:
			p.rateLimiter.cleanup()
		}
	}
}

// CreateConnection implements ConnectionFactory
func (f *DefaultConnectionFactory) CreateConnection(w http.ResponseWriter, r *http.Request) (*websocket.Conn, error) {
	return f.upgrader.Upgrade(w, r, nil)
}

// ConfigureConnection implements ConnectionFactory
func (f *DefaultConnectionFactory) ConfigureConnection(conn *websocket.Conn) error {
	conn.EnableWriteCompression(true)
	return nil
}

// Utility functions
func getClientIP(r *http.Request) string {
	xForwardedFor := r.Header.Get("X-Forwarded-For")
	if xForwardedFor != "" {
		return xForwardedFor
	}
	
	xRealIP := r.Header.Get("X-Real-IP")
	if xRealIP != "" {
		return xRealIP
	}
	
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	return host
}

func generateConnectionID(userID, sessionID, remoteAddr string) string {
	return userID + ":" + sessionID + ":" + remoteAddr + ":" + time.Now().Format("20060102150405")
}

// Constructor functions
func NewConnectionPoolMetrics() *ConnectionPoolMetrics {
	return &ConnectionPoolMetrics{
		LastUpdated: time.Now(),
	}
}

func NewRateLimiter(maxRequests int, windowSize time.Duration) *RateLimiter {
	return &RateLimiter{
		windows:     make(map[string]*SlidingWindow),
		maxRequests: maxRequests,
		windowSize:  windowSize,
	}
}

func NewLoadBalancer() *LoadBalancer {
	return &LoadBalancer{
		backends:  make([]*Backend, 0),
		algorithm: RoundRobin,
	}
}

// RateLimiter methods
func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	window, exists := rl.windows[key]
	if !exists {
		window = &SlidingWindow{
			requests: make([]time.Time, 0),
		}
		rl.windows[key] = window
	}

	now := time.Now()
	cutoff := now.Add(-rl.windowSize)

	// Clean old requests
	window.mu.Lock()
	validRequests := make([]time.Time, 0)
	for _, req := range window.requests {
		if req.After(cutoff) {
			validRequests = append(validRequests, req)
		}
	}
	window.requests = validRequests

	// Check if we can add new request
	if len(window.requests) >= rl.maxRequests {
		window.mu.Unlock()
		return false
	}

	window.requests = append(window.requests, now)
	window.mu.Unlock()

	return true
}

func (rl *RateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	cutoff := time.Now().Add(-rl.windowSize * 2)
	
	for key, window := range rl.windows {
		window.mu.Lock()
		hasValidRequests := false
		for _, req := range window.requests {
			if req.After(cutoff) {
				hasValidRequests = true
				break
			}
		}
		
		if !hasValidRequests {
			delete(rl.windows, key)
		}
		window.mu.Unlock()
	}
}

// Shutdown gracefully shuts down the connection pool
func (p *ConnectionPool) Shutdown() {
	p.cancel()
	p.cleanupTicker.Stop()

	// Close all connections
	p.mu.RLock()
	connectionIDs := make([]string, 0, len(p.connections))
	for id := range p.connections {
		connectionIDs = append(connectionIDs, id)
	}
	p.mu.RUnlock()

	for _, id := range connectionIDs {
		p.destroyConnection(id)
	}

	close(p.idleConnections)

	p.logger.Info("Connection pool shutdown completed")
}
