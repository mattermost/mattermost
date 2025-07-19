// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
)

// WebSocketPoolConfig holds configuration for WebSocket connection pool
type WebSocketPoolConfig struct {
	// Pool settings
	MaxConnections          int           `json:"max_connections"`
	MaxIdleConnections     int           `json:"max_idle_connections"`
	MaxConnectionsPerUser  int           `json:"max_connections_per_user"`
	ConnectionTimeout      time.Duration `json:"connection_timeout"`
	IdleTimeout           time.Duration `json:"idle_timeout"`
	KeepAliveInterval     time.Duration `json:"keep_alive_interval"`
	
	// Performance settings
	WorkerCount           int           `json:"worker_count"`
	BufferSize            int           `json:"buffer_size"`
	BatchSize             int           `json:"batch_size"`
	BatchTimeout          time.Duration `json:"batch_timeout"`
	
	// Rate limiting
	RateLimitEnabled      bool          `json:"rate_limit_enabled"`
	RateLimitPerSecond    int           `json:"rate_limit_per_second"`
	RateLimitBurst        int           `json:"rate_limit_burst"`
	RateLimitWindow       time.Duration `json:"rate_limit_window"`
	
	// Health check settings
	HealthCheckEnabled    bool          `json:"health_check_enabled"`
	HealthCheckInterval   time.Duration `json:"health_check_interval"`
	HealthCheckTimeout    time.Duration `json:"health_check_timeout"`
	MaxFailedHealthChecks int           `json:"max_failed_health_checks"`
	
	// Circuit breaker settings
	CircuitBreakerEnabled    bool          `json:"circuit_breaker_enabled"`
	CircuitBreakerThreshold  int           `json:"circuit_breaker_threshold"`
	CircuitBreakerTimeout    time.Duration `json:"circuit_breaker_timeout"`
	CircuitBreakerResetTime  time.Duration `json:"circuit_breaker_reset_time"`
	
	// Compression settings
	CompressionEnabled    bool   `json:"compression_enabled"`
	CompressionLevel      int    `json:"compression_level"`
	CompressionThreshold  int    `json:"compression_threshold"`
	
	// Monitoring settings
	MetricsEnabled        bool          `json:"metrics_enabled"`
	MetricsInterval       time.Duration `json:"metrics_interval"`
	DetailedMetrics       bool          `json:"detailed_metrics"`
	
	// Security settings
	MaxMessageSize        int64         `json:"max_message_size"`
	AllowedOrigins        []string      `json:"allowed_origins"`
	RequireAuth           bool          `json:"require_auth"`
	IPWhitelist           []string      `json:"ip_whitelist"`
	IPBlacklist           []string      `json:"ip_blacklist"`
}

// DefaultWebSocketPoolConfig returns default configuration
func DefaultWebSocketPoolConfig() *WebSocketPoolConfig {
	return &WebSocketPoolConfig{
		// Pool settings
		MaxConnections:          50000,
		MaxIdleConnections:     1000,
		MaxConnectionsPerUser:  10,
		ConnectionTimeout:      30 * time.Second,
		IdleTimeout:           5 * time.Minute,
		KeepAliveInterval:     30 * time.Second,
		
		// Performance settings
		WorkerCount:           8,
		BufferSize:            1000,
		BatchSize:             100,
		BatchTimeout:          50 * time.Millisecond,
		
		// Rate limiting
		RateLimitEnabled:      true,
		RateLimitPerSecond:    100,
		RateLimitBurst:        200,
		RateLimitWindow:       time.Minute,
		
		// Health check settings
		HealthCheckEnabled:    true,
		HealthCheckInterval:   30 * time.Second,
		HealthCheckTimeout:    5 * time.Second,
		MaxFailedHealthChecks: 3,
		
		// Circuit breaker settings
		CircuitBreakerEnabled:    true,
		CircuitBreakerThreshold:  10,
		CircuitBreakerTimeout:    30 * time.Second,
		CircuitBreakerResetTime:  5 * time.Minute,
		
		// Compression settings
		CompressionEnabled:    true,
		CompressionLevel:      6,
		CompressionThreshold:  1024,
		
		// Monitoring settings
		MetricsEnabled:        true,
		MetricsInterval:       10 * time.Second,
		DetailedMetrics:       false,
		
		// Security settings
		MaxMessageSize:        1024 * 1024, // 1MB
		AllowedOrigins:        []string{"*"},
		RequireAuth:           true,
		IPWhitelist:           []string{},
		IPBlacklist:           []string{},
	}
}

// ProductionWebSocketPoolConfig returns production-optimized configuration
func ProductionWebSocketPoolConfig() *WebSocketPoolConfig {
	config := DefaultWebSocketPoolConfig()
	
	// Production optimizations
	config.MaxConnections = 100000
	config.MaxIdleConnections = 5000
	config.WorkerCount = 16
	config.BufferSize = 2000
	config.BatchSize = 200
	config.BatchTimeout = 25 * time.Millisecond
	config.DetailedMetrics = true
	config.CompressionLevel = 9
	
	return config
}

// ValidateConfig validates the WebSocket pool configuration
func (c *WebSocketPoolConfig) ValidateConfig() error {
	if c.MaxConnections <= 0 {
		return fmt.Errorf("max_connections must be greater than 0")
	}
	
	if c.MaxIdleConnections <= 0 {
		return fmt.Errorf("max_idle_connections must be greater than 0")
	}
	
	if c.MaxIdleConnections > c.MaxConnections {
		return fmt.Errorf("max_idle_connections cannot be greater than max_connections")
	}
	
	if c.WorkerCount <= 0 {
		return fmt.Errorf("worker_count must be greater than 0")
	}
	
	if c.BufferSize <= 0 {
		return fmt.Errorf("buffer_size must be greater than 0")
	}
	
	if c.BatchSize <= 0 {
		return fmt.Errorf("batch_size must be greater than 0")
	}
	
	if c.ConnectionTimeout <= 0 {
		return fmt.Errorf("connection_timeout must be greater than 0")
	}
	
	if c.CompressionLevel < 1 || c.CompressionLevel > 9 {
		return fmt.Errorf("compression_level must be between 1 and 9")
	}
	
	return nil
}

// ToJSON converts configuration to JSON string
func (c *WebSocketPoolConfig) ToJSON() (string, error) {
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal config to JSON: %w", err)
	}
	return string(data), nil
}

// FromJSON loads configuration from JSON string
func (c *WebSocketPoolConfig) FromJSON(data string) error {
	if err := json.Unmarshal([]byte(data), c); err != nil {
		return fmt.Errorf("failed to unmarshal config from JSON: %w", err)
	}
	return c.ValidateConfig()
}

// ApplyEnvironmentOverrides applies environment-based configuration overrides
func (c *WebSocketPoolConfig) ApplyEnvironmentOverrides(cfg *model.Config) {
	if cfg.ServiceSettings.WebsocketPort != nil {
		// Apply WebSocket-specific overrides from main config
	}
	
	// Apply performance overrides based on system resources
	if c.WorkerCount == 0 {
		c.WorkerCount = 8 // Default fallback
	}
	
	// Apply security overrides
	if cfg.ServiceSettings.AllowCorsFrom != nil {
		c.AllowedOrigins = []string{*cfg.ServiceSettings.AllowCorsFrom}
	}
}

// GetOptimalWorkerCount returns optimal worker count based on system resources
func (c *WebSocketPoolConfig) GetOptimalWorkerCount() int {
	// This would ideally check system resources
	// For now, return configured value or reasonable default
	if c.WorkerCount > 0 {
		return c.WorkerCount
	}
	return 8
}

// GetConnectionLimits returns connection limits for load balancing
func (c *WebSocketPoolConfig) GetConnectionLimits() (max, idle, perUser int) {
	return c.MaxConnections, c.MaxIdleConnections, c.MaxConnectionsPerUser
}

// GetTimeouts returns various timeout configurations
func (c *WebSocketPoolConfig) GetTimeouts() (connection, idle, keepAlive time.Duration) {
	return c.ConnectionTimeout, c.IdleTimeout, c.KeepAliveInterval
}
