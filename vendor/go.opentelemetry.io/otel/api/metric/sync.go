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
	"errors"

	"go.opentelemetry.io/otel/label"
)

// ErrSDKReturnedNilImpl is returned when a new `MeterImpl` returns nil.
var ErrSDKReturnedNilImpl = errors.New("SDK returned a nil implementation")

// Measurement is used for reporting a synchronous batch of metric
// values. Instances of this type should be created by synchronous
// instruments (e.g., Int64Counter.Measurement()).
type Measurement struct {
	// number needs to be aligned for 64-bit atomic operations.
	number     Number
	instrument SyncImpl
}

// syncInstrument contains a SyncImpl.
type syncInstrument struct {
	instrument SyncImpl
}

// syncBoundInstrument contains a BoundSyncImpl.
type syncBoundInstrument struct {
	boundInstrument BoundSyncImpl
}

// asyncInstrument contains a AsyncImpl.
type asyncInstrument struct {
	instrument AsyncImpl
}

// SyncImpl returns the instrument that created this measurement.
// This returns an implementation-level object for use by the SDK,
// users should not refer to this.
func (m Measurement) SyncImpl() SyncImpl {
	return m.instrument
}

// Number returns a number recorded in this measurement.
func (m Measurement) Number() Number {
	return m.number
}

// AsyncImpl returns the instrument that created this observation.
// This returns an implementation-level object for use by the SDK,
// users should not refer to this.
func (m Observation) AsyncImpl() AsyncImpl {
	return m.instrument
}

// Number returns a number recorded in this observation.
func (m Observation) Number() Number {
	return m.number
}

// AsyncImpl implements AsyncImpl.
func (a asyncInstrument) AsyncImpl() AsyncImpl {
	return a.instrument
}

// SyncImpl returns the implementation object for synchronous instruments.
func (s syncInstrument) SyncImpl() SyncImpl {
	return s.instrument
}

func (s syncInstrument) bind(labels []label.KeyValue) syncBoundInstrument {
	return newSyncBoundInstrument(s.instrument.Bind(labels))
}

func (s syncInstrument) float64Measurement(value float64) Measurement {
	return newMeasurement(s.instrument, NewFloat64Number(value))
}

func (s syncInstrument) int64Measurement(value int64) Measurement {
	return newMeasurement(s.instrument, NewInt64Number(value))
}

func (s syncInstrument) directRecord(ctx context.Context, number Number, labels []label.KeyValue) {
	s.instrument.RecordOne(ctx, number, labels)
}

func (h syncBoundInstrument) directRecord(ctx context.Context, number Number) {
	h.boundInstrument.RecordOne(ctx, number)
}

// Unbind calls SyncImpl.Unbind.
func (h syncBoundInstrument) Unbind() {
	h.boundInstrument.Unbind()
}

// checkNewAsync receives an AsyncImpl and potential
// error, and returns the same types, checking for and ensuring that
// the returned interface is not nil.
func checkNewAsync(instrument AsyncImpl, err error) (asyncInstrument, error) {
	if instrument == nil {
		if err == nil {
			err = ErrSDKReturnedNilImpl
		}
		instrument = NoopAsync{}
	}
	return asyncInstrument{
		instrument: instrument,
	}, err
}

// checkNewSync receives an SyncImpl and potential
// error, and returns the same types, checking for and ensuring that
// the returned interface is not nil.
func checkNewSync(instrument SyncImpl, err error) (syncInstrument, error) {
	if instrument == nil {
		if err == nil {
			err = ErrSDKReturnedNilImpl
		}
		// Note: an alternate behavior would be to synthesize a new name
		// or group all duplicately-named instruments of a certain type
		// together and use a tag for the original name, e.g.,
		//   name = 'invalid.counter.int64'
		//   label = 'original-name=duplicate-counter-name'
		instrument = NoopSync{}
	}
	return syncInstrument{
		instrument: instrument,
	}, err
}

func newSyncBoundInstrument(boundInstrument BoundSyncImpl) syncBoundInstrument {
	return syncBoundInstrument{
		boundInstrument: boundInstrument,
	}
}

func newMeasurement(instrument SyncImpl, number Number) Measurement {
	return Measurement{
		instrument: instrument,
		number:     number,
	}
}

// wrapInt64CounterInstrument converts a SyncImpl into Int64Counter.
func wrapInt64CounterInstrument(syncInst SyncImpl, err error) (Int64Counter, error) {
	common, err := checkNewSync(syncInst, err)
	return Int64Counter{syncInstrument: common}, err
}

// wrapFloat64CounterInstrument converts a SyncImpl into Float64Counter.
func wrapFloat64CounterInstrument(syncInst SyncImpl, err error) (Float64Counter, error) {
	common, err := checkNewSync(syncInst, err)
	return Float64Counter{syncInstrument: common}, err
}

// wrapInt64UpDownCounterInstrument converts a SyncImpl into Int64UpDownCounter.
func wrapInt64UpDownCounterInstrument(syncInst SyncImpl, err error) (Int64UpDownCounter, error) {
	common, err := checkNewSync(syncInst, err)
	return Int64UpDownCounter{syncInstrument: common}, err
}

// wrapFloat64UpDownCounterInstrument converts a SyncImpl into Float64UpDownCounter.
func wrapFloat64UpDownCounterInstrument(syncInst SyncImpl, err error) (Float64UpDownCounter, error) {
	common, err := checkNewSync(syncInst, err)
	return Float64UpDownCounter{syncInstrument: common}, err
}

// wrapInt64ValueRecorderInstrument converts a SyncImpl into Int64ValueRecorder.
func wrapInt64ValueRecorderInstrument(syncInst SyncImpl, err error) (Int64ValueRecorder, error) {
	common, err := checkNewSync(syncInst, err)
	return Int64ValueRecorder{syncInstrument: common}, err
}

// wrapFloat64ValueRecorderInstrument converts a SyncImpl into Float64ValueRecorder.
func wrapFloat64ValueRecorderInstrument(syncInst SyncImpl, err error) (Float64ValueRecorder, error) {
	common, err := checkNewSync(syncInst, err)
	return Float64ValueRecorder{syncInstrument: common}, err
}
