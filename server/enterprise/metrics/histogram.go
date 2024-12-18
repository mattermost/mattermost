// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package metrics

import (
	"github.com/prometheus/client_golang/prometheus"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// HistogramVec is a wrapper of prometheus.HistogramVec that stores the buckets
// which are later passed down to WrappedObserver.
type HistogramVec struct {
	*prometheus.HistogramVec
	buckets []float64
	fqName  string
	logger  mlog.LoggerIFace
}

// WrappedObserver is a wrapper of prometheus.Observer which addtionally
// logs userIDs when the value exceeds or equals to the one in the highest bucket.
type WrappedObserver struct {
	prometheus.Observer
	labels     prometheus.Labels
	buckets    []float64
	logger     mlog.LoggerIFace
	metricName string
	userID     string
}

// NewHistogramVec returns a custom-purpose HistogramVec.
func NewHistogramVec(opts prometheus.HistogramOpts, labelNames []string, logger mlog.LoggerIFace) *HistogramVec {
	if len(opts.Buckets) == 0 {
		opts.Buckets = prometheus.DefBuckets
	}
	return &HistogramVec{
		HistogramVec: prometheus.NewHistogramVec(opts, labelNames),
		buckets:      opts.Buckets,
		fqName:       prometheus.BuildFQName(opts.Namespace, opts.Subsystem, opts.Name),
		logger:       logger,
	}
}

func (v *HistogramVec) With(labels prometheus.Labels, userID string) prometheus.Observer {
	h, err := v.GetMetricWith(labels)
	if err != nil {
		panic(err)
	}
	return &WrappedObserver{
		Observer:   h,
		labels:     labels,
		buckets:    v.buckets,
		logger:     v.logger,
		metricName: v.fqName,
		userID:     userID,
	}
}

func (o *WrappedObserver) Observe(v float64) {
	if v >= o.buckets[len(o.buckets)-1] {
		fields := []mlog.Field{
			mlog.String("metric_name", o.metricName),
			mlog.String("user_id", o.userID),
			mlog.Float("observed_value", v),
			mlog.Float("highest_bucket_value", o.buckets[len(o.buckets)-1]),
		}
		for k, v := range o.labels {
			fields = append(fields, mlog.String(k, v))
		}
		o.logger.Warn("Metric observation exceeded.", fields...)
	}
	o.Observer.Observe(v)
}
