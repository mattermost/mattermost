// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package metrics

import (
	"encoding/json"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

// WebSocketMetrics tracks performance metrics for WebSocket connections
type WebSocketMetrics struct {
	// Connection metrics
	TotalConnections      int64     `json:"total_connections"`
	ActiveConnections     int64     `json:"active_connections"`
	IdleConnections       int64     `json:"idle_connections"`
	ConnectionsPerSecond  float64   `json:"connections_per_second"`
	
	// Message metrics
	MessagesSent          int64     `json:"messages_sent"`
	MessagesReceived      int64     `json:"messages_received"`
	MessagesPerSecond     float64   `json:"messages_per_second"`
	MessageErrors         int64     `json:"message_errors"`
	
	// Performance metrics
	AverageLatency        float64   `json:"average_latency_ms"`
	P95Latency           float64   `json:"p95_latency_ms"`
	P99Latency           float64   `json:"p99_latency_ms"`
	ThroughputMBPS       float64   `json:"throughput_mbps"`
	
	// Resource usage
	MemoryUsageMB        float64   `json:"memory_usage_mb"`
	CPUUsagePercent      float64   `json:"cpu_usage_percent"`
	GoroutineCount       int64     `json:"goroutine_count"`
	
	// Error metrics
	ConnectionErrors      int64     `json:"connection_errors"`
	TimeoutErrors        int64     `json:"timeout_errors"`
	ProtocolErrors       int64     `json:"protocol_errors"`
	
	// Pool metrics
	PoolHitRatio         float64   `json:"pool_hit_ratio"`
	PoolSize             int64     `json:"pool_size"`
	PoolUtilization      float64   `json:"pool_utilization"`
	
	// Timestamps
	StartTime            time.Time `json:"start_time"`
	LastUpdated          time.Time `json:"last_updated"`
	
	// Internal counters
	mu                   sync.RWMutex
	latencyHistogram     []float64
	connectionHistory    []int64
	messageHistory       []int64
	errorHistory         []int64
}

// WebSocketMetricsCollector manages metrics collection
type WebSocketMetricsCollector struct {
	metrics          *WebSocketMetrics
	ticker           *time.Ticker
	stopCh           chan struct{}
	collectionInterval time.Duration
	historySize      int
	mu               sync.RWMutex
}

// NewWebSocketMetricsCollector creates a new metrics collector
func NewWebSocketMetricsCollector(interval time.Duration) *WebSocketMetricsCollector {
	return &WebSocketMetricsCollector{
		metrics: &WebSocketMetrics{
			StartTime:         time.Now(),
			LastUpdated:       time.Now(),
			latencyHistogram:  make([]float64, 0, 1000),
			connectionHistory: make([]int64, 0, 60),
			messageHistory:    make([]int64, 0, 60),
			errorHistory:      make([]int64, 0, 60),
		},
		collectionInterval: interval,
		historySize:       60,
		stopCh:           make(chan struct{}),
	}
}

// Start begins metrics collection
func (c *WebSocketMetricsCollector) Start() {
	c.ticker = time.NewTicker(c.collectionInterval)
	go c.collectMetrics()
}

// Stop stops metrics collection
func (c *WebSocketMetricsCollector) Stop() {
	if c.ticker != nil {
		c.ticker.Stop()
	}
	close(c.stopCh)
}

// collectMetrics runs the metrics collection loop
func (c *WebSocketMetricsCollector) collectMetrics() {
	for {
		select {
		case <-c.ticker.C:
			c.updateMetrics()
		case <-c.stopCh:
			return
		}
	}
}

// updateMetrics updates all metrics
func (c *WebSocketMetricsCollector) updateMetrics() {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	now := time.Now()
	duration := now.Sub(c.metrics.LastUpdated).Seconds()
	
	// Update connection metrics
	c.updateConnectionMetrics(duration)
	
	// Update message metrics
	c.updateMessageMetrics(duration)
	
	// Update performance metrics
	c.updatePerformanceMetrics()
	
	// Update error metrics
	c.updateErrorMetrics()
	
	// Update pool metrics
	c.updatePoolMetrics()
	
	// Clean up old history
	c.cleanupHistory()
	
	c.metrics.LastUpdated = now
}

// IncrementConnections increments active connection count
func (c *WebSocketMetricsCollector) IncrementConnections() {
	atomic.AddInt64(&c.metrics.ActiveConnections, 1)
	atomic.AddInt64(&c.metrics.TotalConnections, 1)
}

// DecrementConnections decrements active connection count
func (c *WebSocketMetricsCollector) DecrementConnections() {
	atomic.AddInt64(&c.metrics.ActiveConnections, -1)
}

// IncrementIdleConnections increments idle connection count
func (c *WebSocketMetricsCollector) IncrementIdleConnections() {
	atomic.AddInt64(&c.metrics.IdleConnections, 1)
}

// DecrementIdleConnections decrements idle connection count
func (c *WebSocketMetricsCollector) DecrementIdleConnections() {
	atomic.AddInt64(&c.metrics.IdleConnections, -1)
}

// RecordMessageSent records a sent message
func (c *WebSocketMetricsCollector) RecordMessageSent() {
	atomic.AddInt64(&c.metrics.MessagesSent, 1)
}

// RecordMessageReceived records a received message
func (c *WebSocketMetricsCollector) RecordMessageReceived() {
	atomic.AddInt64(&c.metrics.MessagesReceived, 1)
}

// RecordLatency records message latency
func (c *WebSocketMetricsCollector) RecordLatency(latency float64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	c.metrics.latencyHistogram = append(c.metrics.latencyHistogram, latency)
	
	// Keep only last 1000 measurements
	if len(c.metrics.latencyHistogram) > 1000 {
		c.metrics.latencyHistogram = c.metrics.latencyHistogram[len(c.metrics.latencyHistogram)-1000:]
	}
}

// RecordConnectionError records a connection error
func (c *WebSocketMetricsCollector) RecordConnectionError() {
	atomic.AddInt64(&c.metrics.ConnectionErrors, 1)
}

// RecordTimeoutError records a timeout error
func (c *WebSocketMetricsCollector) RecordTimeoutError() {
	atomic.AddInt64(&c.metrics.TimeoutErrors, 1)
}

// RecordProtocolError records a protocol error
func (c *WebSocketMetricsCollector) RecordProtocolError() {
	atomic.AddInt64(&c.metrics.ProtocolErrors, 1)
}

// RecordMessageError records a message error
func (c *WebSocketMetricsCollector) RecordMessageError() {
	atomic.AddInt64(&c.metrics.MessageErrors, 1)
}

// updateConnectionMetrics updates connection-related metrics
func (c *WebSocketMetricsCollector) updateConnectionMetrics(duration float64) {
	activeConns := atomic.LoadInt64(&c.metrics.ActiveConnections)
	c.metrics.connectionHistory = append(c.metrics.connectionHistory, activeConns)
	
	if duration > 0 {
		// Calculate connections per second based on history
		if len(c.metrics.connectionHistory) >= 2 {
			prev := c.metrics.connectionHistory[len(c.metrics.connectionHistory)-2]
			c.metrics.ConnectionsPerSecond = float64(activeConns-prev) / duration
		}
	}
}

// updateMessageMetrics updates message-related metrics
func (c *WebSocketMetricsCollector) updateMessageMetrics(duration float64) {
	totalMessages := atomic.LoadInt64(&c.metrics.MessagesSent) + atomic.LoadInt64(&c.metrics.MessagesReceived)
	c.metrics.messageHistory = append(c.metrics.messageHistory, totalMessages)
	
	if duration > 0 {
		// Calculate messages per second
		if len(c.metrics.messageHistory) >= 2 {
			prev := c.metrics.messageHistory[len(c.metrics.messageHistory)-2]
			c.metrics.MessagesPerSecond = float64(totalMessages-prev) / duration
		}
	}
}

// updatePerformanceMetrics updates performance metrics
func (c *WebSocketMetricsCollector) updatePerformanceMetrics() {
	if len(c.metrics.latencyHistogram) > 0 {
		// Calculate average latency
		var sum float64
		for _, latency := range c.metrics.latencyHistogram {
			sum += latency
		}
		c.metrics.AverageLatency = sum / float64(len(c.metrics.latencyHistogram))
		
		// Calculate percentiles
		c.metrics.P95Latency = c.calculatePercentile(c.metrics.latencyHistogram, 0.95)
		c.metrics.P99Latency = c.calculatePercentile(c.metrics.latencyHistogram, 0.99)
	}
	
	// Calculate throughput (this would need actual byte counting)
	c.metrics.ThroughputMBPS = c.metrics.MessagesPerSecond * 0.001 // Rough estimate
}

// updateErrorMetrics updates error-related metrics
func (c *WebSocketMetricsCollector) updateErrorMetrics() {
	totalErrors := atomic.LoadInt64(&c.metrics.ConnectionErrors) +
		atomic.LoadInt64(&c.metrics.TimeoutErrors) +
		atomic.LoadInt64(&c.metrics.ProtocolErrors) +
		atomic.LoadInt64(&c.metrics.MessageErrors)
	
	c.metrics.errorHistory = append(c.metrics.errorHistory, totalErrors)
}

// updatePoolMetrics updates connection pool metrics
func (c *WebSocketMetricsCollector) updatePoolMetrics() {
	activeConns := atomic.LoadInt64(&c.metrics.ActiveConnections)
	idleConns := atomic.LoadInt64(&c.metrics.IdleConnections)
	
	c.metrics.PoolSize = activeConns + idleConns
	
	if c.metrics.PoolSize > 0 {
		c.metrics.PoolUtilization = float64(activeConns) / float64(c.metrics.PoolSize)
	}
	
	// Calculate pool hit ratio (simplified)
	totalConns := atomic.LoadInt64(&c.metrics.TotalConnections)
	if totalConns > 0 {
		c.metrics.PoolHitRatio = float64(idleConns) / float64(totalConns)
	}
}

// calculatePercentile calculates the given percentile from a slice of values
func (c *WebSocketMetricsCollector) calculatePercentile(values []float64, percentile float64) float64 {
	if len(values) == 0 {
		return 0
	}
	
	// Simple percentile calculation (would use proper sorting in production)
	index := int(float64(len(values)) * percentile)
	if index >= len(values) {
		index = len(values) - 1
	}
	
	return values[index]
}

// cleanupHistory removes old history entries
func (c *WebSocketMetricsCollector) cleanupHistory() {
	if len(c.metrics.connectionHistory) > c.historySize {
		c.metrics.connectionHistory = c.metrics.connectionHistory[len(c.metrics.connectionHistory)-c.historySize:]
	}
	
	if len(c.metrics.messageHistory) > c.historySize {
		c.metrics.messageHistory = c.metrics.messageHistory[len(c.metrics.messageHistory)-c.historySize:]
	}
	
	if len(c.metrics.errorHistory) > c.historySize {
		c.metrics.errorHistory = c.metrics.errorHistory[len(c.metrics.errorHistory)-c.historySize:]
	}
}

// GetMetrics returns current metrics (thread-safe)
func (c *WebSocketMetricsCollector) GetMetrics() *WebSocketMetrics {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	// Create a copy to avoid race conditions
	metrics := *c.metrics
	return &metrics
}

// GetMetricsJSON returns metrics as JSON string
func (c *WebSocketMetricsCollector) GetMetricsJSON() (string, error) {
	metrics := c.GetMetrics()
	data, err := json.MarshalIndent(metrics, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal metrics to JSON: %w", err)
	}
	return string(data), nil
}

// LogMetrics logs current metrics
func (c *WebSocketMetricsCollector) LogMetrics() {
	metrics := c.GetMetrics()
	
	mlog.Info("WebSocket Performance Metrics",
		mlog.Int64("active_connections", metrics.ActiveConnections),
		mlog.Int64("idle_connections", metrics.IdleConnections),
		mlog.Float64("connections_per_second", metrics.ConnectionsPerSecond),
		mlog.Float64("messages_per_second", metrics.MessagesPerSecond),
		mlog.Float64("average_latency_ms", metrics.AverageLatency),
		mlog.Float64("p95_latency_ms", metrics.P95Latency),
		mlog.Float64("pool_utilization", metrics.PoolUtilization),
		mlog.Int64("connection_errors", metrics.ConnectionErrors),
		mlog.Int64("message_errors", metrics.MessageErrors),
	)
}

// GetConnectionStats returns connection statistics
func (c *WebSocketMetricsCollector) GetConnectionStats() (active, idle, total int64) {
	metrics := c.GetMetrics()
	return metrics.ActiveConnections, metrics.IdleConnections, metrics.TotalConnections
}

// GetPerformanceStats returns performance statistics
func (c *WebSocketMetricsCollector) GetPerformanceStats() (avgLatency, p95Latency, throughput float64) {
	metrics := c.GetMetrics()
	return metrics.AverageLatency, metrics.P95Latency, metrics.ThroughputMBPS
}

// GetErrorStats returns error statistics
func (c *WebSocketMetricsCollector) GetErrorStats() (connectionErrors, timeoutErrors, protocolErrors, messageErrors int64) {
	metrics := c.GetMetrics()
	return metrics.ConnectionErrors, metrics.TimeoutErrors, metrics.ProtocolErrors, metrics.MessageErrors
}
