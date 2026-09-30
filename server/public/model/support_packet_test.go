// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/goccy/go-yaml"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSupportPacketStatsYAMLRoundTripPreservesNilAndZero(t *testing.T) {
	t.Parallel()

	stats := SupportPacketStats{
		Teams: new(int64),
	}

	data, err := yaml.Marshal(&stats)
	require.NoError(t, err)

	var roundTrip SupportPacketStats
	err = yaml.Unmarshal(data, &roundTrip)
	require.NoError(t, err)
	assert.Nil(t, roundTrip.Posts)
	require.NotNil(t, roundTrip.Teams)
	assert.Equal(t, int64(0), *roundTrip.Teams)
}

func TestSupportPacketStatsYAMLAllPopulatedMatchesLegacyBytes(t *testing.T) {
	t.Parallel()

	stats := SupportPacketStats{
		RegisteredUsers:     new(int64(1)),
		ActiveUsers:         new(int64(2)),
		DailyActiveUsers:    new(int64(3)),
		MonthlyActiveUsers:  new(int64(4)),
		DeactivatedUsers:    new(int64(5)),
		Guests:              new(int64(6)),
		SingleChannelGuests: new(int64(7)),
		BotAccounts:         new(int64(8)),
		Posts:               new(int64(9)),
		Channels:            new(int64(10)),
		Teams:               new(int64(11)),
		SlashCommands:       new(int64(12)),
		IncomingWebhooks:    new(int64(13)),
		OutgoingWebhooks:    new(int64(14)),
	}

	data, err := yaml.Marshal(&stats)
	require.NoError(t, err)

	const expected = `registered_users: 1
active_users: 2
daily_active_users: 3
monthly_active_users: 4
deactivated_users: 5
guests: 6
single_channel_guests: 7
bot_accounts: 8
posts: 9
channels: 10
teams: 11
slash_commands: 12
incoming_webhooks: 13
outgoing_webhooks: 14
`

	assert.Equal(t, expected, string(data))
}

func TestSupportPacketDiagnosticsYAMLOmitsNilAndKeepsZero(t *testing.T) {
	t.Parallel()

	var diagnostics SupportPacketDiagnostics
	diagnostics.Server.OpenFileDescriptors = new(int64(0))
	diagnostics.Database.MasterConnectionsInUse = new(0)
	diagnostics.Cluster.NumberOfNodes = new(0)
	diagnostics.Database.ReplicaPoolWaitCount = new(int64(0))
	diagnostics.FileStore.AvailableMB = new(uint64(0))

	data, err := yaml.Marshal(&diagnostics)
	require.NoError(t, err)

	body := string(data)
	assert.Contains(t, body, "open_file_descriptors: 0\n")
	assert.Contains(t, body, "master_connections_in_use: 0\n")
	assert.Contains(t, body, "number_of_nodes: 0\n")
	assert.Contains(t, body, "replica_pool_wait_count: 0\n")
	assert.Contains(t, body, "available_mb: 0\n")
	assert.NotContains(t, body, "max_file_descriptors")
	assert.NotContains(t, body, "schema_version")
	assert.NotContains(t, body, "hostname")
	assert.NotContains(t, body, "total_memory_mb")
	assert.NotContains(t, body, "  type:")
	assert.NotContains(t, body, "master_pool_wait_count")
	assert.NotContains(t, body, "total_mb")

	var roundTrip SupportPacketDiagnostics
	err = yaml.Unmarshal(data, &roundTrip)
	require.NoError(t, err)
	assert.Nil(t, roundTrip.Server.MaxFileDescriptors)
	assert.Nil(t, roundTrip.Database.Version)
	assert.Nil(t, roundTrip.Database.SchemaVersion)
	require.NotNil(t, roundTrip.Server.OpenFileDescriptors)
	assert.Equal(t, int64(0), *roundTrip.Server.OpenFileDescriptors)
	require.NotNil(t, roundTrip.Database.MasterConnectionsInUse)
	assert.Equal(t, 0, *roundTrip.Database.MasterConnectionsInUse)
	require.NotNil(t, roundTrip.Cluster.NumberOfNodes)
	assert.Equal(t, 0, *roundTrip.Cluster.NumberOfNodes)
	assert.Nil(t, roundTrip.Server.Hostname)
	assert.Nil(t, roundTrip.FileStore.TotalMB)
	require.NotNil(t, roundTrip.FileStore.AvailableMB)
	assert.Equal(t, uint64(0), *roundTrip.FileStore.AvailableMB)
}
