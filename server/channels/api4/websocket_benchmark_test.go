// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/channels/api4"
	"github.com/mattermost/mattermost-server/v6/server/channels/app"
	"github.com/mattermost/mattermost-server/v6/shared/metrics"
)

// BenchmarkWebSocketConnectionPool tests connection pool performance
func BenchmarkWebSocketConnectionPool(b *testing.B) {
	th := Setup(b).InitBasic()
	defer th.TearDown()

	// Configure optimized settings
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableDeveloper = true
		*cfg.ServiceSettings.WebsocketPort = 8065
	})

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		th.App.ServeHTTP(w, r)
	}))
	defer server.Close()

	wsURL := "ws" + server.URL[4:] + model.API_URL_SUFFIX_V4 + "/websocket"

	b.ResetTimer()
	
	// Test scenarios
	scenarios := []struct {
		name        string
		connections int
		duration    time.Duration
	}{
		{"1K_Connections", 1000, 30 * time.Second},
		{"5K_Connections", 5000, 60 * time.Second},
		{"10K_Connections", 10000, 120 * time.Second},
		{"25K_Connections", 25000, 300 * time.Second},
		{"50K_Connections", 50000, 600 * time.Second},
	}

	for _, scenario := range scenarios {
		b.Run(scenario.name, func(b *testing.B) {
			benchmarkWebSocketConnections(b, th, wsURL, scenario.connections, scenario.duration)
		})
	}
}

func benchmarkWebSocketConnections(b *testing.B, th *TestHelper, wsURL string, numConnections int, duration time.Duration) {
	var (
		successfulConnections int64
		failedConnections     int64
		totalMessages         int64
		totalLatency          int64
		connectionErrors      int64
		wg                    sync.WaitGroup
	)

	ctx, cancel := context.WithTimeout(context.Background(), duration)
	defer cancel()

	// Connection worker pool
	connectionChan := make(chan int, numConnections)
	workerCount := 100 // Concurrent connection workers

	// Start connection workers
	for i := 0; i < workerCount; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			
			for connectionID := range connectionChan {
				select {
				case <-ctx.Done():
					return
				default:
					startTime := time.Now()
					
					// Create WebSocket connection
					conn, err := createWebSocketConnection(wsURL, th.BasicUser.AuthToken)
					if err != nil {
						atomic.AddInt64(&failedConnections, 1)
						atomic.AddInt64(&connectionErrors, 1)
						continue
					}

					atomic.AddInt64(&successfulConnections, 1)
					connectionLatency := time.Since(startTime).Nanoseconds()
					atomic.AddInt64(&totalLatency, connectionLatency)

					// Send test messages
					go sendTestMessages(conn, &totalMessages, ctx)
					
					// Keep connection alive
					go keepConnectionAlive(conn, ctx)
				}
			}
		}()
	}

	// Start performance monitoring
	go monitorPerformance(b, &successfulConnections, &totalMessages, duration)

	// Send connection requests
	go func() {
		defer close(connectionChan)
		for i := 0; i < numConnections; i++ {
			select {
			case <-ctx.Done():
				return
			case connectionChan <- i:
			}
		}
	}()

	// Wait for completion or timeout
	wg.Wait()

	// Calculate and report metrics
	avgLatency := float64(totalLatency) / float64(successfulConnections) / 1e6 // Convert to milliseconds
	successRate := float64(successfulConnections) / float64(numConnections) * 100
	messagesPerSecond := float64(totalMessages) / duration.Seconds()

	b.ReportMetric(float64(successfulConnections), "successful_connections")
	b.ReportMetric(float64(failedConnections), "failed_connections")
	b.ReportMetric(avgLatency, "avg_latency_ms")
	b.ReportMetric(successRate, "success_rate_%")
	b.ReportMetric(messagesPerSecond, "messages_per_second")
	b.ReportMetric(float64(connectionErrors), "connection_errors")

	// Performance assertions
	require.True(b, successRate >= 95.0, "Success rate should be at least 95%%")
	require.True(b, avgLatency <= 100.0, "Average latency should be under 100ms")
	require.True(b, messagesPerSecond >= 1000.0, "Should handle at least 1000 messages/second")
}

func createWebSocketConnection(wsURL, authToken string) (*websocket.Conn, error) {
	header := http.Header{}
	header.Set("Authorization", "Bearer "+authToken)
	
	dialer := &websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
		ReadBufferSize:   4096,
		WriteBufferSize:  4096,
	}

	conn, _, err := dialer.Dial(wsURL, header)
	if err != nil {
		return nil, err
	}

	// Set connection limits
	conn.SetReadLimit(32768)
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	return conn, nil
}

func sendTestMessages(conn *websocket.Conn, totalMessages *int64, ctx context.Context) {
	defer conn.Close()

	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			message := &model.WebSocketRequest{
				Seq:    1,
				Action: "ping",
				Data:   map[string]interface{}{"test": "benchmark"},
			}

			if err := conn.WriteJSON(message); err != nil {
				return
			}

			atomic.AddInt64(totalMessages, 1)
		}
	}
}

func keepConnectionAlive(conn *websocket.Conn, ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func monitorPerformance(b *testing.B, connections, messages *int64, duration time.Duration) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	startTime := time.Now()
	
	for {
		select {
		case <-time.After(duration):
			return
		case <-ticker.C:
			elapsed := time.Since(startTime).Seconds()
			currentConnections := atomic.LoadInt64(connections)
			currentMessages := atomic.LoadInt64(messages)
			
			b.Logf("Time: %.0fs | Connections: %d | Messages: %d | Rate: %.2f msg/s", 
				elapsed, currentConnections, currentMessages, float64(currentMessages)/elapsed)
		}
	}
}

// BenchmarkWebSocketMemoryUsage tests memory efficiency
func BenchmarkWebSocketMemoryUsage(b *testing.B) {
	th := Setup(b).InitBasic()
	defer th.TearDown()

	connectionCounts := []int{1000, 5000, 10000, 25000, 50000}

	for _, count := range connectionCounts {
		b.Run(fmt.Sprintf("Memory_%d_Connections", count), func(b *testing.B) {
			var m1, m2 runtime.MemStats
			
			// Measure initial memory
			runtime.GC()
			runtime.ReadMemStats(&m1)

			// Create connections
			connections := make([]*websocket.Conn, count)
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				th.App.ServeHTTP(w, r)
			}))
			defer server.Close()

			wsURL := "ws" + server.URL[4:] + model.API_URL_SUFFIX_V4 + "/websocket"

			for i := 0; i < count; i++ {
				conn, err := createWebSocketConnection(wsURL, th.BasicUser.AuthToken)
				if err != nil {
					b.Fatalf("Failed to create connection %d: %v", i, err)
				}
				connections[i] = conn
			}

			// Measure memory after connections
			runtime.GC()
			runtime.ReadMemStats(&m2)

			// Calculate memory usage
			memoryUsed := m2.Alloc - m1.Alloc
			memoryPerConnection := float64(memoryUsed) / float64(count)

			b.ReportMetric(float64(memoryUsed), "total_memory_bytes")
			b.ReportMetric(memoryPerConnection, "memory_per_connection_bytes")

			// Cleanup
			for _, conn := range connections {
				if conn != nil {
					conn.Close()
				}
			}
			server.Close()

			// Performance assertions
			require.True(b, memoryPerConnection <= 8192, "Memory per connection should be under 8KB")
		})
	}
}

// BenchmarkWebSocketThroughput tests message throughput
func BenchmarkWebSocketThroughput(b *testing.B) {
	th := Setup(b).InitBasic()
	defer th.TearDown()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		th.App.ServeHTTP(w, r)
	}))
	defer server.Close()

	wsURL := "ws" + server.URL[4:] + model.API_URL_SUFFIX_V4 + "/websocket"

	messageSizes := []int{64, 256, 1024, 4096, 16384}
	connectionCounts := []int{100, 500, 1000, 2500, 5000}

	for _, msgSize := range messageSizes {
		for _, connCount := range connectionCounts {
			b.Run(fmt.Sprintf("Throughput_%db_%dc", msgSize, connCount), func(b *testing.B) {
				benchmarkThroughput(b, th, wsURL, msgSize, connCount)
			})
		}
	}
}

func benchmarkThroughput(b *testing.B, th *TestHelper, wsURL string, messageSize, connectionCount int) {
	var (
		totalMessages int64
		totalBytes    int64
		wg           sync.WaitGroup
	)

	testDuration := 60 * time.Second
	ctx, cancel := context.WithTimeout(context.Background(), testDuration)
	defer cancel()

	// Create test message
	testData := make([]byte, messageSize)
	for i := range testData {
		testData[i] = byte(i % 256)
	}

	// Create connections
	connections := make([]*websocket.Conn, connectionCount)
	for i := 0; i < connectionCount; i++ {
		conn, err := createWebSocketConnection(wsURL, th.BasicUser.AuthToken)
		require.NoError(b, err)
		connections[i] = conn
		defer conn.Close()
	}

	b.ResetTimer()
	startTime := time.Now()

	// Start message senders
	for _, conn := range connections {
		wg.Add(1)
		go func(c *websocket.Conn) {
			defer wg.Done()
			
			ticker := time.NewTicker(10 * time.Millisecond)
			defer ticker.Stop()

			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					message := &model.WebSocketRequest{
						Seq:    1,
						Action: "custom_test",
						Data:   map[string]interface{}{"payload": testData},
					}

					if err := c.WriteJSON(message); err != nil {
						return
					}

					atomic.AddInt64(&totalMessages, 1)
					atomic.AddInt64(&totalBytes, int64(messageSize))
				}
			}
		}(conn)
	}

	wg.Wait()
	duration := time.Since(startTime).Seconds()

	// Calculate metrics
	messagesPerSecond := float64(totalMessages) / duration
	bytesPerSecond := float64(totalBytes) / duration
	megabytesPerSecond := bytesPerSecond / (1024 * 1024)

	b.ReportMetric(messagesPerSecond, "messages_per_second")
	b.ReportMetric(megabytesPerSecond, "megabytes_per_second")
	b.ReportMetric(float64(totalMessages), "total_messages")
	b.ReportMetric(float64(totalBytes), "total_bytes")

	// Performance assertions
	expectedMsgPerSec := float64(connectionCount * 10) // 10 msg/sec per connection minimum
	require.True(b, messagesPerSecond >= expectedMsgPerSec, 
		"Throughput too low: %.2f < %.2f messages/second", messagesPerSecond, expectedMsgPerSec)
}

// BenchmarkWebSocketLatency tests connection and message latency
func BenchmarkWebSocketLatency(b *testing.B) {
	th := Setup(b).InitBasic()
	defer th.TearDown()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		th.App.ServeHTTP(w, r)
	}))
	defer server.Close()

	wsURL := "ws" + server.URL[4:] + model.API_URL_SUFFIX_V4 + "/websocket"

	b.Run("Connection_Latency", func(b *testing.B) {
		var totalLatency int64
		var successfulConnections int64

		b.ResetTimer()
		b.RunParallel(func(pb *testing.PB) {
			for pb.Next() {
				start := time.Now()
				conn, err := createWebSocketConnection(wsURL, th.BasicUser.AuthToken)
				latency := time.Since(start).Nanoseconds()

				if err == nil {
					atomic.AddInt64(&totalLatency, latency)
					atomic.AddInt64(&successfulConnections, 1)
					conn.Close()
				}
			}
		})

		if successfulConnections > 0 {
			avgLatency := float64(totalLatency) / float64(successfulConnections) / 1e6
			b.ReportMetric(avgLatency, "avg_connection_latency_ms")
			require.True(b, avgLatency <= 50.0, "Connection latency should be under 50ms")
		}
	})

	b.Run("Message_Latency", func(b *testing.B) {
		conn, err := createWebSocketConnection(wsURL, th.BasicUser.AuthToken)
		require.NoError(b, err)
		defer conn.Close()

		var totalLatency int64
		var messageCount int64

		b.ResetTimer()
		b.RunParallel(func(pb *testing.PB) {
			for pb.Next() {
				start := time.Now()
				
				message := &model.WebSocketRequest{
					Seq:    1,
					Action: "ping",
					Data:   map[string]interface{}{"timestamp": start.UnixNano()},
				}

				if err := conn.WriteJSON(message); err == nil {
					latency := time.Since(start).Nanoseconds()
					atomic.AddInt64(&totalLatency, latency)
					atomic.AddInt64(&messageCount, 1)
				}
			}
		})

		if messageCount > 0 {
			avgLatency := float64(totalLatency) / float64(messageCount) / 1e6
			b.ReportMetric(avgLatency, "avg_message_latency_ms")
			require.True(b, avgLatency <= 10.0, "Message latency should be under 10ms")
		}
	})
}
