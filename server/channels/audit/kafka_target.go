// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/mattermost/logr/v2"
	"github.com/segmentio/kafka-go"
)

const (
	kafkaRetryBackoffMillis    int64 = 100
	kafkaMaxRetryBackoffMillis int64 = 30 * 1000 // 30 seconds
	kafkaWriteTimeout                = 10 * time.Second
)

// KafkaOptions defines the configuration for the Kafka audit target.
type KafkaOptions struct {
	Brokers []string `json:"brokers"`
	Topic   string   `json:"topic"`
}

// CheckValid validates the Kafka target options.
func (o KafkaOptions) CheckValid() error {
	if len(o.Brokers) == 0 {
		return errors.New("missing brokers")
	}
	if o.Topic == "" {
		return errors.New("missing topic")
	}
	return nil
}

// KafkaTarget is a logr target that writes audit log records to a Kafka topic.
type KafkaTarget struct {
	options  KafkaOptions
	writer   *kafka.Writer
	shutdown chan struct{}
}

// NewKafkaTarget creates a new Kafka audit target.
func NewKafkaTarget(options KafkaOptions) *KafkaTarget {
	return &KafkaTarget{
		options:  options,
		shutdown: make(chan struct{}),
	}
}

// Init initializes the Kafka producer.
func (k *KafkaTarget) Init() error {
	k.writer = &kafka.Writer{
		Addr:         kafka.TCP(k.options.Brokers...),
		Topic:        k.options.Topic,
		Balancer:     &kafka.LeastBytes{},
		WriteTimeout: kafkaWriteTimeout,
	}
	return nil
}

// schemaEnvelope is the Kafka Connect JSON schema envelope format.
// The JDBC Sink Connector uses this to map fields to database columns.
var schemaEnvelope = map[string]any{
	"type": "struct",
	"fields": []map[string]any{
		{"field": "timestamp", "type": "int64", "optional": true},
		{"field": "event", "type": "string", "optional": false},
	},
}

// Write produces the formatted log record bytes to the configured Kafka topic.
// The message is wrapped in a Kafka Connect schema envelope so the JDBC Sink
// Connector can map it to database columns.
// It retries with exponential backoff on failure, matching the pattern used by
// the TCP target in logr/v2.
func (k *KafkaTarget) Write(p []byte, rec *logr.LogRec) (int, error) {
	envelope := map[string]any{
		"schema": schemaEnvelope,
		"payload": map[string]any{
			"timestamp": rec.Time().UnixMilli(),
			"event":     string(p),
		},
	}
	msg, err := json.Marshal(envelope)
	if err != nil {
		return 0, fmt.Errorf("kafka target: failed to marshal envelope: %w", err)
	}

	backoff := kafkaRetryBackoffMillis
	for {
		select {
		case <-k.shutdown:
			return 0, nil
		default:
		}

		ctx, cancel := context.WithTimeout(context.Background(), kafkaWriteTimeout)
		err := k.writer.WriteMessages(ctx, kafka.Message{
			Value: msg,
		})
		cancel()

		if err == nil {
			return len(p), nil
		}

		rec.Logger().Logr().ReportError(fmt.Errorf("kafka target %s write error: %w", k.String(), err))
		backoff = k.sleep(backoff)
	}
}

// Shutdown closes the Kafka producer.
func (k *KafkaTarget) Shutdown() error {
	close(k.shutdown)
	if k.writer != nil {
		return k.writer.Close()
	}
	return nil
}

// String returns a description of this target.
func (k *KafkaTarget) String() string {
	return fmt.Sprintf("KafkaTarget[%s]", k.options.Topic)
}

func (k *KafkaTarget) sleep(backoff int64) int64 {
	select {
	case <-k.shutdown:
	case <-time.After(time.Millisecond * time.Duration(backoff)):
	}
	nextBackoff := backoff + (backoff >> 1)
	return min(nextBackoff, kafkaMaxRetryBackoffMillis)
}

// KafkaTargetFactory creates a Kafka target from JSON options. It can be used as a
// logr TargetFactory to handle the "kafka" target type in AdvancedLoggingJSON config.
func KafkaTargetFactory(targetType string, options json.RawMessage) (logr.Target, error) {
	if targetType != "kafka" {
		return nil, fmt.Errorf("unsupported target type: %s", targetType)
	}

	var opts KafkaOptions
	if len(options) == 0 {
		return nil, errors.New("missing kafka target options")
	}
	if err := json.Unmarshal(options, &opts); err != nil {
		return nil, fmt.Errorf("error decoding kafka target options: %w", err)
	}
	if err := opts.CheckValid(); err != nil {
		return nil, fmt.Errorf("invalid kafka target options: %w", err)
	}

	return NewKafkaTarget(opts), nil
}
