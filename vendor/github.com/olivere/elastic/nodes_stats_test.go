// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"testing"
)

func TestNodesStats(t *testing.T) {
	client, err := NewClient()
	if err != nil {
		t.Fatal(err)
	}

	info, err := client.NodesStats().Human(true).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if info == nil {
		t.Fatal("expected nodes stats")
	}

	if info.ClusterName == "" {
		t.Errorf("expected cluster name; got: %q", info.ClusterName)
	}
	if len(info.Nodes) == 0 {
		t.Errorf("expected some nodes; got: %d", len(info.Nodes))
	}
	for id, node := range info.Nodes {
		if id == "" {
			t.Errorf("expected node id; got: %q", id)
		}
		if node == nil {
			t.Fatalf("expected node info; got: %v", node)
		}
		if len(node.Name) == 0 {
			t.Errorf("expected node name; got: %q", node.Name)
		}
		if node.Timestamp == 0 {
			t.Errorf("expected timestamp; got: %q", node.Timestamp)
		}
	}
}

func TestNodesStatsBuildURL(t *testing.T) {
	tests := []struct {
		NodeIds      []string
		Metrics      []string
		IndexMetrics []string
		Expected     string
	}{
		{
			NodeIds:      nil,
			Metrics:      nil,
			IndexMetrics: nil,
			Expected:     "/_nodes/stats",
		},
		{
			NodeIds:      []string{"node1"},
			Metrics:      nil,
			IndexMetrics: nil,
			Expected:     "/_nodes/node1/stats",
		},
		{
			NodeIds:      []string{"node1", "node2"},
			Metrics:      nil,
			IndexMetrics: nil,
			Expected:     "/_nodes/node1%2Cnode2/stats",
		},
		{
			NodeIds:      nil,
			Metrics:      []string{"indices"},
			IndexMetrics: nil,
			Expected:     "/_nodes/stats/indices",
		},
		{
			NodeIds:      nil,
			Metrics:      []string{"indices", "jvm"},
			IndexMetrics: nil,
			Expected:     "/_nodes/stats/indices%2Cjvm",
		},
		{
			NodeIds:      []string{"node1"},
			Metrics:      []string{"indices", "jvm"},
			IndexMetrics: nil,
			Expected:     "/_nodes/node1/stats/indices%2Cjvm",
		},
		{
			NodeIds:      nil,
			Metrics:      nil,
			IndexMetrics: []string{"fielddata"},
			Expected:     "/_nodes/stats/_all/fielddata",
		},
		{
			NodeIds:      []string{"node1"},
			Metrics:      nil,
			IndexMetrics: []string{"fielddata"},
			Expected:     "/_nodes/node1/stats/_all/fielddata",
		},
		{
			NodeIds:      nil,
			Metrics:      []string{"indices"},
			IndexMetrics: []string{"fielddata"},
			Expected:     "/_nodes/stats/indices/fielddata",
		},
		{
			NodeIds:      []string{"node1"},
			Metrics:      []string{"indices"},
			IndexMetrics: []string{"fielddata"},
			Expected:     "/_nodes/node1/stats/indices/fielddata",
		},
		{
			NodeIds:      []string{"node1", "node2"},
			Metrics:      []string{"indices", "jvm"},
			IndexMetrics: []string{"fielddata", "docs"},
			Expected:     "/_nodes/node1%2Cnode2/stats/indices%2Cjvm/fielddata%2Cdocs",
		},
	}

	client, err := NewClient()
	if err != nil {
		t.Fatal(err)
	}
	for i, tt := range tests {
		svc := client.NodesStats().NodeId(tt.NodeIds...).Metric(tt.Metrics...).IndexMetric(tt.IndexMetrics...)
		path, _, err := svc.buildURL()
		if err != nil {
			t.Errorf("#%d: expected no error, got %v", i, err)
		} else {
			if want, have := tt.Expected, path; want != have {
				t.Errorf("#%d: expected %q, got %q", i, want, have)
			}
		}
	}
}
