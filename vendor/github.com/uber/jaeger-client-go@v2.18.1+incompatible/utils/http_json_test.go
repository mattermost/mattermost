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

package utils

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type testJSONStruct struct {
	Name string
	Age  int
}

func TestGetJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Content-Type", "application/json")
		w.Write([]byte("{\"name\": \"Bender\", \"age\": 3}"))
	}))
	defer server.Close()

	var s testJSONStruct
	err := GetJSON(server.URL, &s)
	require.NoError(t, err)

	assert.Equal(t, "Bender", s.Name)
	assert.Equal(t, 3, s.Age)
}

func TestGetJSONErrors(t *testing.T) {
	var s testJSONStruct
	err := GetJSON("localhost:0", &s)
	assert.Error(t, err)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "some error", http.StatusInternalServerError)
	}))
	defer server.Close()

	err = GetJSON(server.URL, &s)
	assert.Error(t, err)
}
