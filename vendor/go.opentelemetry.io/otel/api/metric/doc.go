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

// metric package provides an API for reporting diagnostic
// measurements using instruments categorized as follows:
//
// Synchronous instruments are called by the user with a Context.
// Asynchronous instruments are called by the SDK during collection.
//
// Additive instruments are semantically intended for capturing a sum.
// Non-additive instruments are intended for capturing a distribution.
//
// Additive instruments may be monotonic, in which case they are
// non-descreasing and naturally define a rate.
//
// The synchronous instrument names are:
//
//   Counter:           additive, monotonic
//   UpDownCounter:     additive
//   ValueRecorder:     non-additive
//
// and the asynchronous instruments are:
//
//   SumObserver:       additive, monotonic
//   UpDownSumObserver: additive
//   ValueObserver:     non-additive
//
// All instruments are provided with support for either float64 or
// int64 input values.
//
// The Meter interface supports allocating new instruments as well as
// interfaces for recording batches of synchronous measurements or
// asynchronous observations.  To obtain a Meter, use a Provider.
//
// The Provider interface supports obtaining a named Meter interface.
// To obtain a Provider implementation, initialize and configure any
// compatible SDK.
package metric // import "go.opentelemetry.io/otel/api/metric"
