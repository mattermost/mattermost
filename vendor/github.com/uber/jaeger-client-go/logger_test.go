// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package jaeger

import (
	"testing"

	"github.com/uber/jaeger-client-go/log"
)

func TestLogger(t *testing.T) {
	for _, logger := range []Logger{StdLogger, NullLogger} {
		logger.Infof("Hi %s", "there")
		logger.Error("Bad wolf")
	}
}

func TestCompatibility(t *testing.T) {
	for _, logger := range []log.Logger{StdLogger, NullLogger} {
		logger.Infof("Hi %s", "there")
		logger.Error("Bad wolf")
	}

	for _, logger := range []Logger{log.StdLogger, log.NullLogger} {
		logger.Infof("Hi %s", "there")
		logger.Error("Bad wolf")
	}
}
