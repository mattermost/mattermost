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

package rpcmetrics

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNormalizedEndpoints(t *testing.T) {
	n := newNormalizedEndpoints(1, DefaultNameNormalizer)

	assertLen := func(l int) {
		n.mux.RLock()
		defer n.mux.RUnlock()
		assert.Len(t, n.names, l)
	}

	assert.Equal(t, "ab-cd", n.normalize("ab^cd"), "one translation")
	assert.Equal(t, "ab-cd", n.normalize("ab^cd"), "cache hit")
	assertLen(1)
	assert.Equal(t, "", n.normalize("xys"), "cache overflow")
	assertLen(1)
}

func TestNormalizedEndpointsDoubleLocking(t *testing.T) {
	n := newNormalizedEndpoints(1, DefaultNameNormalizer)
	assert.Equal(t, "ab-cd", n.normalize("ab^cd"), "fill out the cache")
	assert.Equal(t, "", n.normalizeWithLock("xys"), "cache overflow")
}
