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

// The file is organized as follows:
//
//  - Provider interface
//  - Meter struct
//  - RecordBatch
//  - BatchObserver
//  - Synchronous instrument constructors (2 x int64,float64)
//  - Asynchronous instrument constructors (1 x int64,float64)
//  - Batch asynchronous constructors (1 x int64,float64)
//  - Internals

// Provider supports named Meter instances.
type Provider interface {
	// Meter creates an implementation of the Meter interface.
	// The instrumentationName must be the name of the library providing
	// instrumentation. This name may be the same as the instrumented code
	// only if that code provides built-in instrumentation. If the
	// instrumentationName is empty, then a implementation defined default
	// name will be used instead.
	Meter(instrumentationName string, opts ...MeterOption) Meter
}

// Meter is the OpenTelemetry metric API, based on a `MeterImpl`
// implementation and the `Meter` library name.
//
// An uninitialized Meter is a no-op implementation.
type Meter struct {
	impl          MeterImpl
	name, version string
}

// RecordBatch atomically records a batch of measurements.
func (m Meter) RecordBatch(ctx context.Context, ls []label.KeyValue, ms ...Measurement) {
	if m.impl == nil {
		return
	}
	m.impl.RecordBatch(ctx, ls, ms...)
}

// NewBatchObserver creates a new BatchObserver that supports
// making batches of observations for multiple instruments.
func (m Meter) NewBatchObserver(callback BatchObserverFunc) BatchObserver {
	return BatchObserver{
		meter:  m,
		runner: newBatchAsyncRunner(callback),
	}
}

// NewInt64Counter creates a new integer Counter instrument with the
// given name, customized with options.  May return an error if the
// name is invalid (e.g., empty) or improperly registered (e.g.,
// duplicate registration).
func (m Meter) NewInt64Counter(name string, options ...InstrumentOption) (Int64Counter, error) {
	return wrapInt64CounterInstrument(
		m.newSync(name, CounterKind, Int64NumberKind, options))
}

// NewFloat64Counter creates a new floating point Counter with the
// given name, customized with options.  May return an error if the
// name is invalid (e.g., empty) or improperly registered (e.g.,
// duplicate registration).
func (m Meter) NewFloat64Counter(name string, options ...InstrumentOption) (Float64Counter, error) {
	return wrapFloat64CounterInstrument(
		m.newSync(name, CounterKind, Float64NumberKind, options))
}

// NewInt64UpDownCounter creates a new integer UpDownCounter instrument with the
// given name, customized with options.  May return an error if the
// name is invalid (e.g., empty) or improperly registered (e.g.,
// duplicate registration).
func (m Meter) NewInt64UpDownCounter(name string, options ...InstrumentOption) (Int64UpDownCounter, error) {
	return wrapInt64UpDownCounterInstrument(
		m.newSync(name, UpDownCounterKind, Int64NumberKind, options))
}

// NewFloat64UpDownCounter creates a new floating point UpDownCounter with the
// given name, customized with options.  May return an error if the
// name is invalid (e.g., empty) or improperly registered (e.g.,
// duplicate registration).
func (m Meter) NewFloat64UpDownCounter(name string, options ...InstrumentOption) (Float64UpDownCounter, error) {
	return wrapFloat64UpDownCounterInstrument(
		m.newSync(name, UpDownCounterKind, Float64NumberKind, options))
}

// NewInt64ValueRecorder creates a new integer ValueRecorder instrument with the
// given name, customized with options.  May return an error if the
// name is invalid (e.g., empty) or improperly registered (e.g.,
// duplicate registration).
func (m Meter) NewInt64ValueRecorder(name string, opts ...InstrumentOption) (Int64ValueRecorder, error) {
	return wrapInt64ValueRecorderInstrument(
		m.newSync(name, ValueRecorderKind, Int64NumberKind, opts))
}

// NewFloat64ValueRecorder creates a new floating point ValueRecorder with the
// given name, customized with options.  May return an error if the
// name is invalid (e.g., empty) or improperly registered (e.g.,
// duplicate registration).
func (m Meter) NewFloat64ValueRecorder(name string, opts ...InstrumentOption) (Float64ValueRecorder, error) {
	return wrapFloat64ValueRecorderInstrument(
		m.newSync(name, ValueRecorderKind, Float64NumberKind, opts))
}

// NewInt64ValueObserver creates a new integer ValueObserver instrument
// with the given name, running a given callback, and customized with
// options.  May return an error if the name is invalid (e.g., empty)
// or improperly registered (e.g., duplicate registration).
func (m Meter) NewInt64ValueObserver(name string, callback Int64ObserverFunc, opts ...InstrumentOption) (Int64ValueObserver, error) {
	if callback == nil {
		return wrapInt64ValueObserverInstrument(NoopAsync{}, nil)
	}
	return wrapInt64ValueObserverInstrument(
		m.newAsync(name, ValueObserverKind, Int64NumberKind, opts,
			newInt64AsyncRunner(callback)))
}

// NewFloat64ValueObserver creates a new floating point ValueObserver with
// the given name, running a given callback, and customized with
// options.  May return an error if the name is invalid (e.g., empty)
// or improperly registered (e.g., duplicate registration).
func (m Meter) NewFloat64ValueObserver(name string, callback Float64ObserverFunc, opts ...InstrumentOption) (Float64ValueObserver, error) {
	if callback == nil {
		return wrapFloat64ValueObserverInstrument(NoopAsync{}, nil)
	}
	return wrapFloat64ValueObserverInstrument(
		m.newAsync(name, ValueObserverKind, Float64NumberKind, opts,
			newFloat64AsyncRunner(callback)))
}

// NewInt64SumObserver creates a new integer SumObserver instrument
// with the given name, running a given callback, and customized with
// options.  May return an error if the name is invalid (e.g., empty)
// or improperly registered (e.g., duplicate registration).
func (m Meter) NewInt64SumObserver(name string, callback Int64ObserverFunc, opts ...InstrumentOption) (Int64SumObserver, error) {
	if callback == nil {
		return wrapInt64SumObserverInstrument(NoopAsync{}, nil)
	}
	return wrapInt64SumObserverInstrument(
		m.newAsync(name, SumObserverKind, Int64NumberKind, opts,
			newInt64AsyncRunner(callback)))
}

// NewFloat64SumObserver creates a new floating point SumObserver with
// the given name, running a given callback, and customized with
// options.  May return an error if the name is invalid (e.g., empty)
// or improperly registered (e.g., duplicate registration).
func (m Meter) NewFloat64SumObserver(name string, callback Float64ObserverFunc, opts ...InstrumentOption) (Float64SumObserver, error) {
	if callback == nil {
		return wrapFloat64SumObserverInstrument(NoopAsync{}, nil)
	}
	return wrapFloat64SumObserverInstrument(
		m.newAsync(name, SumObserverKind, Float64NumberKind, opts,
			newFloat64AsyncRunner(callback)))
}

// NewInt64UpDownSumObserver creates a new integer UpDownSumObserver instrument
// with the given name, running a given callback, and customized with
// options.  May return an error if the name is invalid (e.g., empty)
// or improperly registered (e.g., duplicate registration).
func (m Meter) NewInt64UpDownSumObserver(name string, callback Int64ObserverFunc, opts ...InstrumentOption) (Int64UpDownSumObserver, error) {
	if callback == nil {
		return wrapInt64UpDownSumObserverInstrument(NoopAsync{}, nil)
	}
	return wrapInt64UpDownSumObserverInstrument(
		m.newAsync(name, UpDownSumObserverKind, Int64NumberKind, opts,
			newInt64AsyncRunner(callback)))
}

// NewFloat64UpDownSumObserver creates a new floating point UpDownSumObserver with
// the given name, running a given callback, and customized with
// options.  May return an error if the name is invalid (e.g., empty)
// or improperly registered (e.g., duplicate registration).
func (m Meter) NewFloat64UpDownSumObserver(name string, callback Float64ObserverFunc, opts ...InstrumentOption) (Float64UpDownSumObserver, error) {
	if callback == nil {
		return wrapFloat64UpDownSumObserverInstrument(NoopAsync{}, nil)
	}
	return wrapFloat64UpDownSumObserverInstrument(
		m.newAsync(name, UpDownSumObserverKind, Float64NumberKind, opts,
			newFloat64AsyncRunner(callback)))
}

// NewInt64ValueObserver creates a new integer ValueObserver instrument
// with the given name, running in a batch callback, and customized with
// options.  May return an error if the name is invalid (e.g., empty)
// or improperly registered (e.g., duplicate registration).
func (b BatchObserver) NewInt64ValueObserver(name string, opts ...InstrumentOption) (Int64ValueObserver, error) {
	if b.runner == nil {
		return wrapInt64ValueObserverInstrument(NoopAsync{}, nil)
	}
	return wrapInt64ValueObserverInstrument(
		b.meter.newAsync(name, ValueObserverKind, Int64NumberKind, opts, b.runner))
}

// NewFloat64ValueObserver creates a new floating point ValueObserver with
// the given name, running in a batch callback, and customized with
// options.  May return an error if the name is invalid (e.g., empty)
// or improperly registered (e.g., duplicate registration).
func (b BatchObserver) NewFloat64ValueObserver(name string, opts ...InstrumentOption) (Float64ValueObserver, error) {
	if b.runner == nil {
		return wrapFloat64ValueObserverInstrument(NoopAsync{}, nil)
	}
	return wrapFloat64ValueObserverInstrument(
		b.meter.newAsync(name, ValueObserverKind, Float64NumberKind, opts,
			b.runner))
}

// NewInt64SumObserver creates a new integer SumObserver instrument
// with the given name, running in a batch callback, and customized with
// options.  May return an error if the name is invalid (e.g., empty)
// or improperly registered (e.g., duplicate registration).
func (b BatchObserver) NewInt64SumObserver(name string, opts ...InstrumentOption) (Int64SumObserver, error) {
	if b.runner == nil {
		return wrapInt64SumObserverInstrument(NoopAsync{}, nil)
	}
	return wrapInt64SumObserverInstrument(
		b.meter.newAsync(name, SumObserverKind, Int64NumberKind, opts, b.runner))
}

// NewFloat64SumObserver creates a new floating point SumObserver with
// the given name, running in a batch callback, and customized with
// options.  May return an error if the name is invalid (e.g., empty)
// or improperly registered (e.g., duplicate registration).
func (b BatchObserver) NewFloat64SumObserver(name string, opts ...InstrumentOption) (Float64SumObserver, error) {
	if b.runner == nil {
		return wrapFloat64SumObserverInstrument(NoopAsync{}, nil)
	}
	return wrapFloat64SumObserverInstrument(
		b.meter.newAsync(name, SumObserverKind, Float64NumberKind, opts,
			b.runner))
}

// NewInt64UpDownSumObserver creates a new integer UpDownSumObserver instrument
// with the given name, running in a batch callback, and customized with
// options.  May return an error if the name is invalid (e.g., empty)
// or improperly registered (e.g., duplicate registration).
func (b BatchObserver) NewInt64UpDownSumObserver(name string, opts ...InstrumentOption) (Int64UpDownSumObserver, error) {
	if b.runner == nil {
		return wrapInt64UpDownSumObserverInstrument(NoopAsync{}, nil)
	}
	return wrapInt64UpDownSumObserverInstrument(
		b.meter.newAsync(name, UpDownSumObserverKind, Int64NumberKind, opts, b.runner))
}

// NewFloat64UpDownSumObserver creates a new floating point UpDownSumObserver with
// the given name, running in a batch callback, and customized with
// options.  May return an error if the name is invalid (e.g., empty)
// or improperly registered (e.g., duplicate registration).
func (b BatchObserver) NewFloat64UpDownSumObserver(name string, opts ...InstrumentOption) (Float64UpDownSumObserver, error) {
	if b.runner == nil {
		return wrapFloat64UpDownSumObserverInstrument(NoopAsync{}, nil)
	}
	return wrapFloat64UpDownSumObserverInstrument(
		b.meter.newAsync(name, UpDownSumObserverKind, Float64NumberKind, opts,
			b.runner))
}

// MeterImpl returns the underlying MeterImpl of this Meter.
func (m Meter) MeterImpl() MeterImpl {
	return m.impl
}

// newAsync constructs one new asynchronous instrument.
func (m Meter) newAsync(
	name string,
	mkind Kind,
	nkind NumberKind,
	opts []InstrumentOption,
	runner AsyncRunner,
) (
	AsyncImpl,
	error,
) {
	if m.impl == nil {
		return NoopAsync{}, nil
	}
	desc := NewDescriptor(name, mkind, nkind, opts...)
	desc.config.InstrumentationName = m.name
	desc.config.InstrumentationVersion = m.version
	return m.impl.NewAsyncInstrument(desc, runner)
}

// newSync constructs one new synchronous instrument.
func (m Meter) newSync(
	name string,
	metricKind Kind,
	numberKind NumberKind,
	opts []InstrumentOption,
) (
	SyncImpl,
	error,
) {
	if m.impl == nil {
		return NoopSync{}, nil
	}
	desc := NewDescriptor(name, metricKind, numberKind, opts...)
	desc.config.InstrumentationName = m.name
	desc.config.InstrumentationVersion = m.version
	return m.impl.NewSyncInstrument(desc)
}
