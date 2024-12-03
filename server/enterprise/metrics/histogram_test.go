// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package metrics

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
)

func TestWrappedObserver(t *testing.T) {
	th := api4.Setup(t)
	defer th.TearDown()

	h := NewHistogramVec(prometheus.HistogramOpts{
		Namespace: MetricsNamespace,
		Subsystem: MetricsSubsystemClientsWeb,
		Name:      "test",
		Buckets:   []float64{0, 5, 10},
	}, []string{"l1"}, th.TestLogger)

	h.With(prometheus.Labels{"l1": "hello"}, th.BasicUser.Id).Observe(6)
	require.NoError(t, th.TestLogger.Flush())
	testlib.AssertNoLog(t, th.LogBuffer, mlog.LvlWarn.Name, "Metric observation exceeded.")

	h.With(prometheus.Labels{"l1": "hello"}, th.BasicUser.Id).Observe(10)
	require.NoError(t, th.TestLogger.Flush())
	testlib.AssertLog(t, th.LogBuffer, mlog.LvlWarn.Name, "Metric observation exceeded.")
}
