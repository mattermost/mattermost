// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"sync"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

const (
	// Connection Pool Configuration
	DefaultPoolSize        = 1000
	MaxPoolSize           = 10000
	ConnectionTimeout     = 30 * time.Second
	HealthCheckInterval   = 5 * time.Minute
	IdleTimeout          = 10 * time.Minute
	MaxIdleConnections   = 100
)

// WebSocketConnectionPool manages a pool of websocket connections for optimal performance
type WebSocketConnectionPool struct {
	mu                sync.RWMutex
	connections       map[string]*PooledConnection
	idleConnections   chan *PooledConnection
	activeConnections int
	maxConnections    int
	healthChecker     *time.Ticker
	metrics          *PoolMetrics
	logger           mlog.LoggerIFace
	ctx              context.Context
	cancel           context.CancelFunc
}

// PooledConnection represents a connection in the pool with metadata
type PooledConnection struct {
	ID           string
	UserID       string
	SessionID    string
	TeamID       string
	LastUsed     time.Time
	CreatedAt    time.Time
	IsActive     bool
	MessageCount int64
	BytesSent    int64
	BytesReceived int64
	Connection   *WebConn
}

// PoolMetrics tracks performance metrics for the connection pool
type PoolMetrics struct {
	mu                    sync.RWMutex
	TotalConnections      int64
	ActiveConnections     int64
	IdleConnections       int64
	ConnectionsCreated    int64
	ConnectionsDestroyed  int64
	PoolHits             int64
	PoolMisses           int64
	AverageLatency       time.Duration
	TotalBytesTransferred int64
	ErrorCount           int64
	LastHealthCheck      time.Time
}

// NewWebSocketConnectionPool creates a new connection pool with specified configuration
func NewWebSocketConnectionPool(maxConnections int, logger mlog.LoggerIFace) *WebSocketConnectionPool {
	if maxConnections <= 0 {
		maxConnections = DefaultPoolSize
	}
	if maxConnections > MaxPoolSize {
		maxConnections = MaxPoolSize
	}

	ctx, cancel := context.WithCancel(context.Background())
	
	pool := &WebSocketConnectionPool{
		connections:       make(map[string]*PooledConnection),
		idleConnections:   make(chan *PooledConnection, MaxIdleConnections),
		maxConnections:    maxConnections,
		healthChecker:     time.NewTicker(HealthCheckInterval),
		metrics:          &PoolMetrics{},
		logger:           logger,
		ctx:              ctx,
		cancel:           cancel,
	}

	// Start background health checker
	go pool.healthCheckRoutine()
	
	// Start metrics collector
	go pool.metricsCollector()

	return pool
}

// AcquireConnection gets a connection from the pool or creates a new one
func (p *WebSocketConnectionPool) AcquireConnection(userID, sessionID, teamID string) (*PooledConnection, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	connectionID := generateConnectionID(userID, sessionID, teamID)

	// Check if connection already exists
	if conn, exists := p.connections[connectionID]; exists && conn.IsActive {
		conn.LastUsed = time.Now()
		p.metrics.incrementHits()
		return conn, nil
	}

	// Try to get idle connection
	select {
	case idleConn := <-p.idleConnections:
		if p.isConnectionHealthy(idleConn) {
			idleConn.UserID = userID
			idleConn.SessionID = sessionID
			idleConn.TeamID = teamID
			idleConn.LastUsed = time.Now()
			idleConn.IsActive = true
			p.connections[connectionID] = idleConn
			p.activeConnections++
			p.metrics.incrementHits()
			return idleConn, nil
		}
	default:
		// No idle connections available
	}

	// Create new connection if under limit
	if p.activeConnections >= p.maxConnections {
		p.metrics.incrementMisses()
		return nil, &model.AppError{
			Message: "Connection pool limit reached",
			DetailedError: "Maximum number of connections exceeded",
		}
	}

	newConn := &PooledConnection{
		ID:        connectionID,
		UserID:    userID,
		SessionID: sessionID,
		TeamID:    teamID,
		LastUsed:  time.Now(),
		CreatedAt: time.Now(),
		IsActive:  true,
	}

	p.connections[connectionID] = newConn
	p.activeConnections++
	p.metrics.incrementConnectionsCreated()
	p.metrics.incrementMisses()

	return newConn, nil
}

// ReleaseConnection returns a connection to the pool
func (p *WebSocketConnectionPool) ReleaseConnection(connectionID string) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	conn, exists := p.connections[connectionID]
	if !exists {
		return &model.AppError{
			Message: "Connection not found in pool",
			DetailedError: "Connection ID does not exist",
		}
	}

	conn.IsActive = false
	conn.LastUsed = time.Now()
	p.activeConnections--

	// Try to put in idle pool
	select {
	case p.idleConnections <- conn:
		// Successfully added to idle pool
	default:
		// Idle pool is full, destroy connection
		delete(p.connections, connectionID)
		p.metrics.incrementConnectionsDestroyed()
	}

	return nil
}

// DestroyConnection permanently removes a connection from the pool
func (p *WebSocketConnectionPool) DestroyConnection(connectionID string) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if conn, exists := p.connections[connectionID]; exists {
		if conn.IsActive {
			p.activeConnections--
		}
		delete(p.connections, connectionID)
		p.metrics.incrementConnectionsDestroyed()
	}
}

// GetMetrics returns current pool metrics
func (p *WebSocketConnectionPool) GetMetrics() *PoolMetrics {
	p.metrics.mu.RLock()
	defer p.metrics.mu.RUnlock()

	return &PoolMetrics{
		TotalConnections:      p.metrics.TotalConnections,
		ActiveConnections:     p.metrics.ActiveConnections,
		IdleConnections:       p.metrics.IdleConnections,
		ConnectionsCreated:    p.metrics.ConnectionsCreated,
		ConnectionsDestroyed:  p.metrics.ConnectionsDestroyed,
		PoolHits:             p.metrics.PoolHits,
		PoolMisses:           p.metrics.PoolMisses,
		AverageLatency:       p.metrics.AverageLatency,
		TotalBytesTransferred: p.metrics.TotalBytesTransferred,
		ErrorCount:           p.metrics.ErrorCount,
		LastHealthCheck:      p.metrics.LastHealthCheck,
	}
}

// healthCheckRoutine performs periodic health checks on connections
func (p *WebSocketConnectionPool) healthCheckRoutine() {
	for {
		select {
		case <-p.ctx.Done():
			return
		case <-p.healthChecker.C:
			p.performHealthCheck()
		}
	}
}

// performHealthCheck checks and cleans up unhealthy connections
func (p *WebSocketConnectionPool) performHealthCheck() {
	p.mu.Lock()
	defer p.mu.Unlock()

	now := time.Now()
	toRemove := make([]string, 0)

	for id, conn := range p.connections {
		if now.Sub(conn.LastUsed) > IdleTimeout {
			toRemove = append(toRemove, id)
		}
	}

	// Remove stale connections
	for _, id := range toRemove {
		if conn, exists := p.connections[id]; exists {
			if conn.IsActive {
				p.activeConnections--
			}
			delete(p.connections, id)
			p.metrics.incrementConnectionsDestroyed()
		}
	}

	p.metrics.mu.Lock()
	p.metrics.LastHealthCheck = now
	p.metrics.mu.Unlock()

	p.logger.Debug("WebSocket pool health check completed", 
		mlog.Int("removed_connections", len(toRemove)),
		mlog.Int("active_connections", p.activeConnections),
		mlog.Int("total_connections", len(p.connections)))
}

// metricsCollector updates pool metrics periodically
func (p *WebSocketConnectionPool) metricsCollector() {
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

// updateMetrics calculates and updates current metrics
func (p *WebSocketConnectionPool) updateMetrics() {
	p.mu.RLock()
	activeCount := p.activeConnections
	totalCount := len(p.connections)
	idleCount := len(p.idleConnections)
	p.mu.RUnlock()

	p.metrics.mu.Lock()
	p.metrics.ActiveConnections = int64(activeCount)
	p.metrics.TotalConnections = int64(totalCount)
	p.metrics.IdleConnections = int64(idleCount)
	p.metrics.mu.Unlock()
}

// isConnectionHealthy checks if a connection is still healthy
func (p *WebSocketConnectionPool) isConnectionHealthy(conn *PooledConnection) bool {
	if conn == nil {
		return false
	}
	
	// Check if connection is too old
	if time.Since(conn.CreatedAt) > ConnectionTimeout {
		return false
	}
	
	// Check if connection has been idle too long
	if time.Since(conn.LastUsed) > IdleTimeout {
		return false
	}
	
	return true
}

// generateConnectionID creates a unique identifier for a connection
func generateConnectionID(userID, sessionID, teamID string) string {
	return userID + ":" + sessionID + ":" + teamID
}

// Metrics helper methods
func (m *PoolMetrics) incrementHits() {
	m.mu.Lock()
	m.PoolHits++
	m.mu.Unlock()
}

func (m *PoolMetrics) incrementMisses() {
	m.mu.Lock()
	m.PoolMisses++
	m.mu.Unlock()
}

func (m *PoolMetrics) incrementConnectionsCreated() {
	m.mu.Lock()
	m.ConnectionsCreated++
	m.mu.Unlock()
}

func (m *PoolMetrics) incrementConnectionsDestroyed() {
	m.mu.Lock()
	m.ConnectionsDestroyed++
	m.mu.Unlock()
}

// Shutdown gracefully shuts down the connection pool
func (p *WebSocketConnectionPool) Shutdown() {
	p.cancel()
	p.healthChecker.Stop()
	
	p.mu.Lock()
	defer p.mu.Unlock()
	
	// Close all connections
	for id := range p.connections {
		delete(p.connections, id)
	}
	
	// Drain idle connections channel
	close(p.idleConnections)
	for range p.idleConnections {
		// Drain channel
	}
	
	p.logger.Info("WebSocket connection pool shutdown completed")
}
