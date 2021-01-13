/*
 *
 * Copyright 2020 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

// Package unix implements a resolver for unix targets.
package unix

import (
	"google.golang.org/grpc/internal/transport/networktype"
	"google.golang.org/grpc/resolver"
)

const scheme = "unix"

type builder struct{}

func (*builder) Build(target resolver.Target, cc resolver.ClientConn, _ resolver.BuildOptions) (resolver.Resolver, error) {
	cc.UpdateState(resolver.State{Addresses: []resolver.Address{networktype.Set(resolver.Address{Addr: target.Endpoint}, "unix")}})
	return &nopResolver{}, nil
}

func (*builder) Scheme() string {
	return scheme
}

type nopResolver struct {
}

func (*nopResolver) ResolveNow(resolver.ResolveNowOptions) {}

func (*nopResolver) Close() {}

func init() {
	resolver.Register(&builder{})
}
