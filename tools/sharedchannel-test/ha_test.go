package main

import (
	"runtime"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestClusterLeader(t *testing.T) {
	tests := []struct {
		name          string
		infos         []*model.ClusterInfo
		wantLeader    string
		wantConnected int
	}{
		{
			name: "no nodes",
		},
		{
			name: "nodes registered only in the DB are skipped",
			infos: []*model.ClusterInfo{
				{Id: "a", Hostname: "node-a"},
				{Id: "b", Hostname: "node-b"},
			},
		},
		{
			name: "single connected node",
			infos: []*model.ClusterInfo{
				{Id: "a", Hostname: "node-a", ConfigHash: "h"},
			},
			wantLeader:    "node-a",
			wantConnected: 1,
		},
		{
			name: "lowest id wins regardless of order",
			infos: []*model.ClusterInfo{
				{Id: "c", Hostname: "node-c", ConfigHash: "h"},
				{Id: "a", Hostname: "node-a", ConfigHash: "h"},
				{Id: "b", Hostname: "node-b", ConfigHash: "h"},
			},
			wantLeader:    "node-a",
			wantConnected: 3,
		},
		{
			name: "lower id without a config hash cannot lead",
			infos: []*model.ClusterInfo{
				{Id: "a", Hostname: "node-a"},
				{Id: "c", Hostname: "node-c", ConfigHash: "h"},
				{Id: "b", Hostname: "node-b", ConfigHash: "h"},
			},
			wantLeader:    "node-b",
			wantConnected: 2,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			leader, connected := clusterLeader(tt.infos)
			assert.Equal(t, tt.wantLeader, leader)
			assert.Equal(t, tt.wantConnected, connected)
		})
	}
}

func TestRoundRobinProxyPick(t *testing.T) {
	newProxy := func(up ...bool) *roundRobinProxy {
		p := &roundRobinProxy{}
		for i, u := range up {
			p.backends = append(p.backends, &proxyBackend{url: string(rune('a' + i)), up: u})
		}
		return p
	}
	pickN := func(t *testing.T, p *roundRobinProxy, n int) []string {
		var urls []string
		for range n {
			b := p.pick()
			require.NotNil(t, b)
			urls = append(urls, b.url)
		}
		return urls
	}

	t.Run("rotates through all up backends", func(t *testing.T) {
		p := newProxy(true, true, true)
		assert.Equal(t, []string{"a", "b", "c", "a", "b"}, pickN(t, p, 5))
	})

	t.Run("skips down backends", func(t *testing.T) {
		p := newProxy(true, false, true)
		assert.Equal(t, []string{"a", "c", "a", "c"}, pickN(t, p, 4))
	})

	t.Run("single up backend is always picked", func(t *testing.T) {
		p := newProxy(false, true, false)
		assert.Equal(t, []string{"b", "b", "b"}, pickN(t, p, 3))
	})

	t.Run("all down returns nil", func(t *testing.T) {
		p := newProxy(false, false)
		assert.Nil(t, p.pick())
	})

	t.Run("no backends returns nil", func(t *testing.T) {
		assert.Nil(t, newProxy().pick())
	})

	t.Run("backend coming back up rejoins the rotation", func(t *testing.T) {
		p := newProxy(true, false)
		assert.Equal(t, []string{"a", "a"}, pickN(t, p, 2))
		p.backends[1].up = true
		assert.Equal(t, []string{"b", "a"}, pickN(t, p, 2))
	})
}

func TestValidateHAConfig(t *testing.T) {
	isLinux := runtime.GOOS == "linux"

	tests := []struct {
		name    string
		cfg     Config
		wantErr string
	}{
		{name: "zero nodes", cfg: Config{Nodes: 0}, wantErr: "--nodes must be between"},
		{name: "negative nodes", cfg: Config{Nodes: -1}, wantErr: "--nodes must be between"},
		{name: "above max", cfg: Config{Nodes: maxNodesPerSide + 1, Manage: true}, wantErr: "--nodes must be between"},
		{name: "single node unmanaged", cfg: Config{Nodes: 1}},
		{name: "single node managed", cfg: Config{Nodes: 1, Manage: true}},
		{name: "multiple nodes unmanaged", cfg: Config{Nodes: 2}, wantErr: "requires managed mode"},
		{name: "multiple nodes managed", cfg: Config{Nodes: 2, Manage: true}},
		{name: "max nodes managed", cfg: Config{Nodes: maxNodesPerSide, Manage: true}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			wantErr := tt.wantErr
			if wantErr == "" && tt.cfg.Nodes > 1 && !isLinux {
				wantErr = "requires Linux"
			}

			err := validateHAConfig(tt.cfg)
			if wantErr == "" {
				assert.NoError(t, err)
				return
			}
			require.Error(t, err)
			assert.Contains(t, err.Error(), wantErr)
		})
	}
}
