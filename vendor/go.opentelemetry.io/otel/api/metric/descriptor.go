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

import "go.opentelemetry.io/otel/api/unit"

// Descriptor contains all the settings that describe an instrument,
// including its name, metric kind, number kind, and the configurable
// options.
type Descriptor struct {
	name       string
	kind       Kind
	numberKind NumberKind
	config     InstrumentConfig
}

// NewDescriptor returns a Descriptor with the given contents.
func NewDescriptor(name string, mkind Kind, nkind NumberKind, opts ...InstrumentOption) Descriptor {
	return Descriptor{
		name:       name,
		kind:       mkind,
		numberKind: nkind,
		config:     ConfigureInstrument(opts),
	}
}

// Name returns the metric instrument's name.
func (d Descriptor) Name() string {
	return d.name
}

// MetricKind returns the specific kind of instrument.
func (d Descriptor) MetricKind() Kind {
	return d.kind
}

// Description provides a human-readable description of the metric
// instrument.
func (d Descriptor) Description() string {
	return d.config.Description
}

// Unit describes the units of the metric instrument.  Unitless
// metrics return the empty string.
func (d Descriptor) Unit() unit.Unit {
	return d.config.Unit
}

// NumberKind returns whether this instrument is declared over int64,
// float64, or uint64 values.
func (d Descriptor) NumberKind() NumberKind {
	return d.numberKind
}

// InstrumentationName returns the name of the library that provided
// instrumentation for this instrument.
func (d Descriptor) InstrumentationName() string {
	return d.config.InstrumentationName
}

// InstrumentationVersion returns the version of the library that provided
// instrumentation for this instrument.
func (d Descriptor) InstrumentationVersion() string {
	return d.config.InstrumentationVersion
}
