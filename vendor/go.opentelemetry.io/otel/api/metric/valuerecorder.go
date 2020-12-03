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

// Float64ValueRecorder is a metric that records float64 values.
type Float64ValueRecorder struct {
	syncInstrument
}

// Int64ValueRecorder is a metric that records int64 values.
type Int64ValueRecorder struct {
	syncInstrument
}

// BoundFloat64ValueRecorder is a bound instrument for Float64ValueRecorder.
//
// It inherits the Unbind function from syncBoundInstrument.
type BoundFloat64ValueRecorder struct {
	syncBoundInstrument
}

// BoundInt64ValueRecorder is a bound instrument for Int64ValueRecorder.
//
// It inherits the Unbind function from syncBoundInstrument.
type BoundInt64ValueRecorder struct {
	syncBoundInstrument
}

// Bind creates a bound instrument for this ValueRecorder. The labels are
// associated with values recorded via subsequent calls to Record.
func (c Float64ValueRecorder) Bind(labels ...label.KeyValue) (h BoundFloat64ValueRecorder) {
	h.syncBoundInstrument = c.bind(labels)
	return
}

// Bind creates a bound instrument for this ValueRecorder. The labels are
// associated with values recorded via subsequent calls to Record.
func (c Int64ValueRecorder) Bind(labels ...label.KeyValue) (h BoundInt64ValueRecorder) {
	h.syncBoundInstrument = c.bind(labels)
	return
}

// Measurement creates a Measurement object to use with batch
// recording.
func (c Float64ValueRecorder) Measurement(value float64) Measurement {
	return c.float64Measurement(value)
}

// Measurement creates a Measurement object to use with batch
// recording.
func (c Int64ValueRecorder) Measurement(value int64) Measurement {
	return c.int64Measurement(value)
}

// Record adds a new value to the list of ValueRecorder's records. The
// labels should contain the keys and values to be associated with
// this value.
func (c Float64ValueRecorder) Record(ctx context.Context, value float64, labels ...label.KeyValue) {
	c.directRecord(ctx, NewFloat64Number(value), labels)
}

// Record adds a new value to the ValueRecorder's distribution. The
// labels should contain the keys and values to be associated with
// this value.
func (c Int64ValueRecorder) Record(ctx context.Context, value int64, labels ...label.KeyValue) {
	c.directRecord(ctx, NewInt64Number(value), labels)
}

// Record adds a new value to the ValueRecorder's distribution using the labels
// previously bound to the ValueRecorder via Bind().
func (b BoundFloat64ValueRecorder) Record(ctx context.Context, value float64) {
	b.directRecord(ctx, NewFloat64Number(value))
}

// Record adds a new value to the ValueRecorder's distribution using the labels
// previously bound to the ValueRecorder via Bind().
func (b BoundInt64ValueRecorder) Record(ctx context.Context, value int64) {
	b.directRecord(ctx, NewInt64Number(value))
}
