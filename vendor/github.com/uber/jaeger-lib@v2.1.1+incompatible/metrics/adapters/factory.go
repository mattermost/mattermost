// Copyright (c) 2018 Uber Technologies, Inc.
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

package adapters

import (
	"github.com/uber/jaeger-lib/metrics"
)

// FactoryWithTags creates metrics with fully qualified name and tags.
type FactoryWithTags interface {
	Counter(options metrics.Options) metrics.Counter
	Gauge(options metrics.Options) metrics.Gauge
	Timer(options metrics.TimerOptions) metrics.Timer
	Histogram(options metrics.HistogramOptions) metrics.Histogram
}

// Options affect how the adapter factory behaves.
type Options struct {
	ScopeSep string
	TagsSep  string
	TagKVSep string
}

func defaultOptions(options Options) Options {
	o := options
	if o.ScopeSep == "" {
		o.ScopeSep = "."
	}
	if o.TagsSep == "" {
		o.TagsSep = "."
	}
	if o.TagKVSep == "" {
		o.TagKVSep = "_"
	}
	return o
}

// WrapFactoryWithTags creates a real metrics.Factory that supports subscopes.
func WrapFactoryWithTags(f FactoryWithTags, options Options) metrics.Factory {
	return &factory{
		Options: defaultOptions(options),
		factory: f,
		cache:   newCache(),
	}
}

type factory struct {
	Options
	factory FactoryWithTags
	scope   string
	tags    map[string]string
	cache   *cache
}

func (f *factory) Counter(options metrics.Options) metrics.Counter {
	fullName, fullTags, key := f.getKey(options.Name, options.Tags)
	return f.cache.getOrSetCounter(key, func() metrics.Counter {
		return f.factory.Counter(metrics.Options{
			Name: fullName,
			Tags: fullTags,
			Help: options.Help,
		})
	})
}

func (f *factory) Gauge(options metrics.Options) metrics.Gauge {
	fullName, fullTags, key := f.getKey(options.Name, options.Tags)
	return f.cache.getOrSetGauge(key, func() metrics.Gauge {
		return f.factory.Gauge(metrics.Options{
			Name: fullName,
			Tags: fullTags,
			Help: options.Help,
		})
	})
}

func (f *factory) Timer(options metrics.TimerOptions) metrics.Timer {
	fullName, fullTags, key := f.getKey(options.Name, options.Tags)
	return f.cache.getOrSetTimer(key, func() metrics.Timer {
		return f.factory.Timer(metrics.TimerOptions{
			Name:    fullName,
			Tags:    fullTags,
			Help:    options.Help,
			Buckets: options.Buckets,
		})
	})
}

func (f *factory) Histogram(options metrics.HistogramOptions) metrics.Histogram {
	fullName, fullTags, key := f.getKey(options.Name, options.Tags)
	return f.cache.getOrSetHistogram(key, func() metrics.Histogram {
		return f.factory.Histogram(metrics.HistogramOptions{
			Name:    fullName,
			Tags:    fullTags,
			Help:    options.Help,
			Buckets: options.Buckets,
		})
	})
}

func (f *factory) Namespace(scope metrics.NSOptions) metrics.Factory {
	return &factory{
		cache:   f.cache,
		scope:   f.subScope(scope.Name),
		tags:    f.mergeTags(scope.Tags),
		factory: f.factory,
		Options: f.Options,
	}
}

func (f *factory) getKey(name string, tags map[string]string) (fullName string, fullTags map[string]string, key string) {
	fullName = f.subScope(name)
	fullTags = f.mergeTags(tags)
	key = metrics.GetKey(fullName, fullTags, f.TagsSep, f.TagKVSep)
	return
}

func (f *factory) mergeTags(tags map[string]string) map[string]string {
	ret := make(map[string]string, len(f.tags)+len(tags))
	for k, v := range f.tags {
		ret[k] = v
	}
	for k, v := range tags {
		ret[k] = v
	}
	return ret
}

func (f *factory) subScope(name string) string {
	if f.scope == "" {
		return name
	}
	if name == "" {
		return f.scope
	}
	return f.scope + f.ScopeSep + name
}
