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

package zipkin_test

import (
	"log"

	"github.com/opentracing/opentracing-go"
	"github.com/uber/jaeger-client-go"
	jlog "github.com/uber/jaeger-client-go/log"
	"github.com/uber/jaeger-client-go/transport/zipkin"
)

func ExampleNewHTTPTransport() {
	// assume this is your main()

	transport, err := zipkin.NewHTTPTransport(
		"http://localhost:9411/api/v1/spans",
		zipkin.HTTPBatchSize(10),
		zipkin.HTTPLogger(jlog.StdLogger),
	)
	if err != nil {
		log.Fatalf("Cannot initialize Zipkin HTTP transport: %v", err)
	}
	tracer, closer := jaeger.NewTracer(
		"my-service-name",
		jaeger.NewConstSampler(true),
		jaeger.NewRemoteReporter(transport, nil),
	)
	defer closer.Close()
	opentracing.SetGlobalTracer(tracer)

	// initialize servers
}
