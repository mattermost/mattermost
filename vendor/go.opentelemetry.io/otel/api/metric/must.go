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

// MeterMust is a wrapper for Meter interfaces that panics when any
// instrument constructor encounters an error.
type MeterMust struct {
	meter Meter
}

// BatchObserverMust is a wrapper for BatchObserver that panics when
// any instrument constructor encounters an error.
type BatchObserverMust struct {
	batch BatchObserver
}

// Must constructs a MeterMust implementation from a Meter, allowing
// the application to panic when any instrument constructor yields an
// error.
func Must(meter Meter) MeterMust {
	return MeterMust{meter: meter}
}

// NewInt64Counter calls `Meter.NewInt64Counter` and returns the
// instrument, panicking if it encounters an error.
func (mm MeterMust) NewInt64Counter(name string, cos ...InstrumentOption) Int64Counter {
	if inst, err := mm.meter.NewInt64Counter(name, cos...); err != nil {
		panic(err)
	} else {
		return inst
	}
}

// NewFloat64Counter calls `Meter.NewFloat64Counter` and returns the
// instrument, panicking if it encounters an error.
func (mm MeterMust) NewFloat64Counter(name string, cos ...InstrumentOption) Float64Counter {
	if inst, err := mm.meter.NewFloat64Counter(name, cos...); err != nil {
		panic(err)
	} else {
		return inst
	}
}

// NewInt64UpDownCounter calls `Meter.NewInt64UpDownCounter` and returns the
// instrument, panicking if it encounters an error.
func (mm MeterMust) NewInt64UpDownCounter(name string, cos ...InstrumentOption) Int64UpDownCounter {
	if inst, err := mm.meter.NewInt64UpDownCounter(name, cos...); err != nil {
		panic(err)
	} else {
		return inst
	}
}

// NewFloat64UpDownCounter calls `Meter.NewFloat64UpDownCounter` and returns the
// instrument, panicking if it encounters an error.
func (mm MeterMust) NewFloat64UpDownCounter(name string, cos ...InstrumentOption) Float64UpDownCounter {
	if inst, err := mm.meter.NewFloat64UpDownCounter(name, cos...); err != nil {
		panic(err)
	} else {
		return inst
	}
}

// NewInt64ValueRecorder calls `Meter.NewInt64ValueRecorder` and returns the
// instrument, panicking if it encounters an error.
func (mm MeterMust) NewInt64ValueRecorder(name string, mos ...InstrumentOption) Int64ValueRecorder {
	if inst, err := mm.meter.NewInt64ValueRecorder(name, mos...); err != nil {
		panic(err)
	} else {
		return inst
	}
}

// NewFloat64ValueRecorder calls `Meter.NewFloat64ValueRecorder` and returns the
// instrument, panicking if it encounters an error.
func (mm MeterMust) NewFloat64ValueRecorder(name string, mos ...InstrumentOption) Float64ValueRecorder {
	if inst, err := mm.meter.NewFloat64ValueRecorder(name, mos...); err != nil {
		panic(err)
	} else {
		return inst
	}
}

// NewInt64ValueObserver calls `Meter.NewInt64ValueObserver` and
// returns the instrument, panicking if it encounters an error.
func (mm MeterMust) NewInt64ValueObserver(name string, callback Int64ObserverFunc, oos ...InstrumentOption) Int64ValueObserver {
	if inst, err := mm.meter.NewInt64ValueObserver(name, callback, oos...); err != nil {
		panic(err)
	} else {
		return inst
	}
}

// NewFloat64ValueObserver calls `Meter.NewFloat64ValueObserver` and
// returns the instrument, panicking if it encounters an error.
func (mm MeterMust) NewFloat64ValueObserver(name string, callback Float64ObserverFunc, oos ...InstrumentOption) Float64ValueObserver {
	if inst, err := mm.meter.NewFloat64ValueObserver(name, callback, oos...); err != nil {
		panic(err)
	} else {
		return inst
	}
}

// NewInt64SumObserver calls `Meter.NewInt64SumObserver` and
// returns the instrument, panicking if it encounters an error.
func (mm MeterMust) NewInt64SumObserver(name string, callback Int64ObserverFunc, oos ...InstrumentOption) Int64SumObserver {
	if inst, err := mm.meter.NewInt64SumObserver(name, callback, oos...); err != nil {
		panic(err)
	} else {
		return inst
	}
}

// NewFloat64SumObserver calls `Meter.NewFloat64SumObserver` and
// returns the instrument, panicking if it encounters an error.
func (mm MeterMust) NewFloat64SumObserver(name string, callback Float64ObserverFunc, oos ...InstrumentOption) Float64SumObserver {
	if inst, err := mm.meter.NewFloat64SumObserver(name, callback, oos...); err != nil {
		panic(err)
	} else {
		return inst
	}
}

// NewInt64UpDownSumObserver calls `Meter.NewInt64UpDownSumObserver` and
// returns the instrument, panicking if it encounters an error.
func (mm MeterMust) NewInt64UpDownSumObserver(name string, callback Int64ObserverFunc, oos ...InstrumentOption) Int64UpDownSumObserver {
	if inst, err := mm.meter.NewInt64UpDownSumObserver(name, callback, oos...); err != nil {
		panic(err)
	} else {
		return inst
	}
}

// NewFloat64UpDownSumObserver calls `Meter.NewFloat64UpDownSumObserver` and
// returns the instrument, panicking if it encounters an error.
func (mm MeterMust) NewFloat64UpDownSumObserver(name string, callback Float64ObserverFunc, oos ...InstrumentOption) Float64UpDownSumObserver {
	if inst, err := mm.meter.NewFloat64UpDownSumObserver(name, callback, oos...); err != nil {
		panic(err)
	} else {
		return inst
	}
}

// NewBatchObserver returns a wrapper around BatchObserver that panics
// when any instrument constructor returns an error.
func (mm MeterMust) NewBatchObserver(callback BatchObserverFunc) BatchObserverMust {
	return BatchObserverMust{
		batch: mm.meter.NewBatchObserver(callback),
	}
}

// NewInt64ValueObserver calls `BatchObserver.NewInt64ValueObserver` and
// returns the instrument, panicking if it encounters an error.
func (bm BatchObserverMust) NewInt64ValueObserver(name string, oos ...InstrumentOption) Int64ValueObserver {
	if inst, err := bm.batch.NewInt64ValueObserver(name, oos...); err != nil {
		panic(err)
	} else {
		return inst
	}
}

// NewFloat64ValueObserver calls `BatchObserver.NewFloat64ValueObserver` and
// returns the instrument, panicking if it encounters an error.
func (bm BatchObserverMust) NewFloat64ValueObserver(name string, oos ...InstrumentOption) Float64ValueObserver {
	if inst, err := bm.batch.NewFloat64ValueObserver(name, oos...); err != nil {
		panic(err)
	} else {
		return inst
	}
}

// NewInt64SumObserver calls `BatchObserver.NewInt64SumObserver` and
// returns the instrument, panicking if it encounters an error.
func (bm BatchObserverMust) NewInt64SumObserver(name string, oos ...InstrumentOption) Int64SumObserver {
	if inst, err := bm.batch.NewInt64SumObserver(name, oos...); err != nil {
		panic(err)
	} else {
		return inst
	}
}

// NewFloat64SumObserver calls `BatchObserver.NewFloat64SumObserver` and
// returns the instrument, panicking if it encounters an error.
func (bm BatchObserverMust) NewFloat64SumObserver(name string, oos ...InstrumentOption) Float64SumObserver {
	if inst, err := bm.batch.NewFloat64SumObserver(name, oos...); err != nil {
		panic(err)
	} else {
		return inst
	}
}

// NewInt64UpDownSumObserver calls `BatchObserver.NewInt64UpDownSumObserver` and
// returns the instrument, panicking if it encounters an error.
func (bm BatchObserverMust) NewInt64UpDownSumObserver(name string, oos ...InstrumentOption) Int64UpDownSumObserver {
	if inst, err := bm.batch.NewInt64UpDownSumObserver(name, oos...); err != nil {
		panic(err)
	} else {
		return inst
	}
}

// NewFloat64UpDownSumObserver calls `BatchObserver.NewFloat64UpDownSumObserver` and
// returns the instrument, panicking if it encounters an error.
func (bm BatchObserverMust) NewFloat64UpDownSumObserver(name string, oos ...InstrumentOption) Float64UpDownSumObserver {
	if inst, err := bm.batch.NewFloat64UpDownSumObserver(name, oos...); err != nil {
		panic(err)
	} else {
		return inst
	}
}
