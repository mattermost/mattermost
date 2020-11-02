// Copyright The OpenTelemetry Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package metric

import (
	"context"

	"go.opentelemetry.io/otel/label"
)

// Float64Counter is a metric that accumulates float64 values.
type Float64Counter struct {
	syncInstrument
}

// Int64Counter is a metric that accumulates int64 values.
type Int64Counter struct {
	syncInstrument
}

// BoundFloat64Counter is a bound instrument for Float64Counter.
//
// It inherits the Unbind function from syncBoundInstrument.
type BoundFloat64Counter struct {
	syncBoundInstrument
}

// BoundInt64Counter is a boundInstrument for Int64Counter.
//
// It inherits the Unbind function from syncBoundInstrument.
type BoundInt64Counter struct {
	syncBoundInstrument
}

// Bind creates a bound instrument for this counter. The labels are
// associated with values recorded via subsequent calls to Record.
func (c Float64Counter) Bind(labels ...label.KeyValue) (h BoundFloat64Counter) {
	h.syncBoundInstrument = c.bind(labels)
	return
}

// Bind creates a bound instrument for this counter. The labels are
// associated with values recorded via subsequent calls to Record.
func (c Int64Counter) Bind(labels ...label.KeyValue) (h BoundInt64Counter) {
	h.syncBoundInstrument = c.bind(labels)
	return
}

// Measurement creates a Measurement object to use with batch
// recording.
func (c Float64Counter) Measurement(value float64) Measurement {
	return c.float64Measurement(value)
}

// Measurement creates a Measurement object to use with batch
// recording.
func (c Int64Counter) Measurement(value int64) Measurement {
	return c.int64Measurement(value)
}

// Add adds the value to the counter's sum. The labels should contain
// the keys and values to be associated with this value.
func (c Float64Counter) Add(ctx context.Context, value float64, labels ...label.KeyValue) {
	c.directRecord(ctx, NewFloat64Number(value), labels)
}

// Add adds the value to the counter's sum. The labels should contain
// the keys and values to be associated with this value.
func (c Int64Counter) Add(ctx context.Context, value int64, labels ...label.KeyValue) {
	c.directRecord(ctx, NewInt64Number(value), labels)
}

// Add adds the value to the counter's sum using the labels
// previously bound to this counter via Bind()
func (b BoundFloat64Counter) Add(ctx context.Context, value float64) {
	b.directRecord(ctx, NewFloat64Number(value))
}

// Add adds the value to the counter's sum using the labels
// previously bound to this counter via Bind()
func (b BoundInt64Counter) Add(ctx context.Context, value int64) {
	b.directRecord(ctx, NewInt64Number(value))
}
