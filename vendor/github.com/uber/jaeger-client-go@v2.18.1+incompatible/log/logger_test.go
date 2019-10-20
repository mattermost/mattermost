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

package log

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestLogger(t *testing.T) {
	bbLogger := &BytesBufferLogger{}
	for _, logger := range []Logger{StdLogger, NullLogger, bbLogger} {
		logger.Infof("Hi %s", "there")
		logger.Error("Bad wolf")
	}
	assert.Equal(t, "INFO: Hi there\nERROR: Bad wolf\n", bbLogger.String())
	bbLogger.Flush()
	assert.Empty(t, bbLogger.String())
}
