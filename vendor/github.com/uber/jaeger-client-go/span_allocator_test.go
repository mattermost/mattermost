// Copyright (c) 2019 The Jaeger Authors.
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

import "testing"

func BenchmarkSpanAllocator(b *testing.B) {
	b.ResetTimer()
	b.ReportAllocs()

	b.Run("SyncPool", func(b *testing.B) {
		benchSpanAllocator(newSyncPollSpanAllocator(), b)
	})

	b.Run("Simple", func(b *testing.B) {
		benchSpanAllocator(simpleSpanAllocator{}, b)
	})
}

func benchSpanAllocator(allocator SpanAllocator, b *testing.B) {
	b.RunParallel(func(pb *testing.PB) {
		queue := make(chan *Span, 1000)
		cancel := make(chan bool, 1)
		go func() {
			for span := range queue {
				allocator.Put(span)
			}
			cancel <- true
		}()
		for pb.Next() {
			queue <- allocator.Get()
		}
		close(queue)
		<-cancel
	})
}
