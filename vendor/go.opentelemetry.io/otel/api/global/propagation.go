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

package global

import (
	"go.opentelemetry.io/otel/api/global/internal"
	"go.opentelemetry.io/otel/api/propagation"
)

// Propagators returns the registered global propagators instance.  If
// none is registered then an instance of propagators.NoopPropagators
// is returned.
func Propagators() propagation.Propagators {
	return internal.Propagators()
}

// SetPropagators registers `p` as the global propagators instance.
func SetPropagators(p propagation.Propagators) {
	internal.SetPropagators(p)
}
