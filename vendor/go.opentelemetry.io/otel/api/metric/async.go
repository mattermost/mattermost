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
//  - Observation type
//  - Three kinds of Observer callback (int64, float64, batch)
//  - Three kinds of Observer result (int64, float64, batch)
//  - Three kinds of Observe() function (int64, float64, batch)
//  - Three kinds of AsyncRunner interface (abstract, single, batch)
//  - Two kinds of Observer constructor (int64, float64)
//  - Two kinds of Observation() function (int64, float64)
//  - Various internals

// Observation is used for reporting an asynchronous  batch of metric
// values. Instances of this type should be created by asynchronous
// instruments (e.g., Int64ValueObserver.Observation()).
type Observation struct {
	// number needs to be aligned for 64-bit atomic operations.
	number     Number
	instrument AsyncImpl
}

// Int64ObserverFunc is a type of callback that integral
// observers run.
type Int64ObserverFunc func(context.Context, Int64ObserverResult)

// Float64ObserverFunc is a type of callback that floating point
// observers run.
type Float64ObserverFunc func(context.Context, Float64ObserverResult)

// BatchObserverFunc is a callback argument for use with any
// Observer instrument that will be reported as a batch of
// observations.
type BatchObserverFunc func(context.Context, BatchObserverResult)

// Int64ObserverResult is passed to an observer callback to capture
// observations for one asynchronous integer metric instrument.
type Int64ObserverResult struct {
	instrument AsyncImpl
	function   func([]label.KeyValue, ...Observation)
}

// Float64ObserverResult is passed to an observer callback to capture
// observations for one asynchronous floating point metric instrument.
type Float64ObserverResult struct {
	instrument AsyncImpl
	function   func([]label.KeyValue, ...Observation)
}

// BatchObserverResult is passed to a batch observer callback to
// capture observations for multiple asynchronous instruments.
type BatchObserverResult struct {
	function func([]label.KeyValue, ...Observation)
}

// Observe captures a single integer value from the associated
// instrument callback, with the given labels.
func (ir Int64ObserverResult) Observe(value int64, labels ...label.KeyValue) {
	ir.function(labels, Observation{
		instrument: ir.instrument,
		number:     NewInt64Number(value),
	})
}

// Observe captures a single floating point value from the associated
// instrument callback, with the given labels.
func (fr Float64ObserverResult) Observe(value float64, labels ...label.KeyValue) {
	fr.function(labels, Observation{
		instrument: fr.instrument,
		number:     NewFloat64Number(value),
	})
}

// Observe captures a multiple observations from the associated batch
// instrument callback, with the given labels.
func (br BatchObserverResult) Observe(labels []label.KeyValue, obs ...Observation) {
	br.function(labels, obs...)
}

// AsyncRunner is expected to convert into an AsyncSingleRunner or an
// AsyncBatchRunner.  SDKs will encounter an error if the AsyncRunner
// does not satisfy one of these interfaces.
type AsyncRunner interface {
	// AnyRunner() is a non-exported method with no functional use
	// other than to make this a non-empty interface.
	AnyRunner()
}

// AsyncSingleRunner is an interface implemented by single-observer
// callbacks.
type AsyncSingleRunner interface {
	// Run accepts a single instrument and function for capturing
	// observations of that instrument.  Each call to the function
	// receives one captured observation.  (The function accepts
	// multiple observations so the same implementation can be
	// used for batch runners.)
	Run(ctx context.Context, single AsyncImpl, capture func([]label.KeyValue, ...Observation))

	AsyncRunner
}

// AsyncBatchRunner is an interface implemented by batch-observer
// callbacks.
type AsyncBatchRunner interface {
	// Run accepts a function for capturing observations of
	// multiple instruments.
	Run(ctx context.Context, capture func([]label.KeyValue, ...Observation))

	AsyncRunner
}

var _ AsyncSingleRunner = (*Int64ObserverFunc)(nil)
var _ AsyncSingleRunner = (*Float64ObserverFunc)(nil)
var _ AsyncBatchRunner = (*BatchObserverFunc)(nil)

// newInt64AsyncRunner returns a single-observer callback for integer Observer instruments.
func newInt64AsyncRunner(c Int64ObserverFunc) AsyncSingleRunner {
	return &c
}

// newFloat64AsyncRunner returns a single-observer callback for floating point Observer instruments.
func newFloat64AsyncRunner(c Float64ObserverFunc) AsyncSingleRunner {
	return &c
}

// newBatchAsyncRunner returns a batch-observer callback use with multiple Observer instruments.
func newBatchAsyncRunner(c BatchObserverFunc) AsyncBatchRunner {
	return &c
}

// AnyRunner implements AsyncRunner.
func (*Int64ObserverFunc) AnyRunner() {}

// AnyRunner implements AsyncRunner.
func (*Float64ObserverFunc) AnyRunner() {}

// AnyRunner implements AsyncRunner.
func (*BatchObserverFunc) AnyRunner() {}

// Run implements AsyncSingleRunner.
func (i *Int64ObserverFunc) Run(ctx context.Context, impl AsyncImpl, function func([]label.KeyValue, ...Observation)) {
	(*i)(ctx, Int64ObserverResult{
		instrument: impl,
		function:   function,
	})
}

// Run implements AsyncSingleRunner.
func (f *Float64ObserverFunc) Run(ctx context.Context, impl AsyncImpl, function func([]label.KeyValue, ...Observation)) {
	(*f)(ctx, Float64ObserverResult{
		instrument: impl,
		function:   function,
	})
}

// Run implements AsyncBatchRunner.
func (b *BatchObserverFunc) Run(ctx context.Context, function func([]label.KeyValue, ...Observation)) {
	(*b)(ctx, BatchObserverResult{
		function: function,
	})
}

// wrapInt64ValueObserverInstrument converts an AsyncImpl into Int64ValueObserver.
func wrapInt64ValueObserverInstrument(asyncInst AsyncImpl, err error) (Int64ValueObserver, error) {
	common, err := checkNewAsync(asyncInst, err)
	return Int64ValueObserver{asyncInstrument: common}, err
}

// wrapFloat64ValueObserverInstrument converts an AsyncImpl into Float64ValueObserver.
func wrapFloat64ValueObserverInstrument(asyncInst AsyncImpl, err error) (Float64ValueObserver, error) {
	common, err := checkNewAsync(asyncInst, err)
	return Float64ValueObserver{asyncInstrument: common}, err
}

// wrapInt64SumObserverInstrument converts an AsyncImpl into Int64SumObserver.
func wrapInt64SumObserverInstrument(asyncInst AsyncImpl, err error) (Int64SumObserver, error) {
	common, err := checkNewAsync(asyncInst, err)
	return Int64SumObserver{asyncInstrument: common}, err
}

// wrapFloat64SumObserverInstrument converts an AsyncImpl into Float64SumObserver.
func wrapFloat64SumObserverInstrument(asyncInst AsyncImpl, err error) (Float64SumObserver, error) {
	common, err := checkNewAsync(asyncInst, err)
	return Float64SumObserver{asyncInstrument: common}, err
}

// wrapInt64UpDownSumObserverInstrument converts an AsyncImpl into Int64UpDownSumObserver.
func wrapInt64UpDownSumObserverInstrument(asyncInst AsyncImpl, err error) (Int64UpDownSumObserver, error) {
	common, err := checkNewAsync(asyncInst, err)
	return Int64UpDownSumObserver{asyncInstrument: common}, err
}

// wrapFloat64UpDownSumObserverInstrument converts an AsyncImpl into Float64UpDownSumObserver.
func wrapFloat64UpDownSumObserverInstrument(asyncInst AsyncImpl, err error) (Float64UpDownSumObserver, error) {
	common, err := checkNewAsync(asyncInst, err)
	return Float64UpDownSumObserver{asyncInstrument: common}, err
}
