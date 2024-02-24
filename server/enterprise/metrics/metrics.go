// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package metrics

import (
	"database/sql"
	"math"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/go-sql-driver/mysql"

	"github.com/pkg/errors"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

const (
	MetricsNamespace                   = "mattermost"
	MetricsSubsystemPosts              = "post"
	MetricsSubsystemDB                 = "db"
	MetricsSubsystemAPI                = "api"
	MetricsSubsystemPlugin             = "plugin"
	MetricsSubsystemHTTP               = "http"
	MetricsSubsystemCluster            = "cluster"
	MetricsSubsystemLogin              = "login"
	MetricsSubsystemCaching            = "cache"
	MetricsSubsystemWebsocket          = "websocket"
	MetricsSubsystemSearch             = "search"
	MetricsSubsystemLogging            = "logging"
	MetricsSubsystemRemoteCluster      = "remote_cluster"
	MetricsSubsystemSharedChannels     = "shared_channels"
	MetricsSubsystemSystem             = "system"
	MetricsSubsystemJobs               = "jobs"
	MetricsCloudInstallationLabel      = "installationId"
	MetricsCloudDatabaseClusterLabel   = "databaseClusterName"
	MetricsCloudInstallationGroupLabel = "installationGroupId"
)

type MetricsInterfaceImpl struct {
	Platform *platform.PlatformService

	Registry *prometheus.Registry

	DbMasterConnectionsGauge prometheus.GaugeFunc
	DbReadConnectionsGauge   prometheus.GaugeFunc
	DbSearchConnectionsGauge prometheus.GaugeFunc
	DbReplicaLagGaugeAbs     *prometheus.GaugeVec
	DbReplicaLagGaugeTime    *prometheus.GaugeVec

	PostCreateCounter     prometheus.Counter
	WebhookPostCounter    prometheus.Counter
	PostSentEmailCounter  prometheus.Counter
	PostSentPushCounter   prometheus.Counter
	PostBroadcastCounter  prometheus.Counter
	PostFileAttachCounter prometheus.Counter

	HTTPRequestsCounter prometheus.Counter
	HTTPErrorsCounter   prometheus.Counter
	HTTPWebsocketsGauge prometheus.GaugeFunc

	ClusterRequestsDuration prometheus.Histogram
	ClusterRequestsCounter  prometheus.Counter

	ClusterHealthGauge prometheus.GaugeFunc

	ClusterEventTypeCounters                     *prometheus.CounterVec
	ClusterEventTypePublish                      prometheus.Counter
	ClusterEventTypeStatus                       prometheus.Counter
	ClusterEventTypeInvAll                       prometheus.Counter
	ClusterEventTypeInvReactions                 prometheus.Counter
	ClusterEventTypeInvWebhook                   prometheus.Counter
	ClusterEventTypeInvChannelPosts              prometheus.Counter
	ClusterEventTypeInvChannelMembersNotifyProps prometheus.Counter
	ClusterEventTypeInvChannelMembers            prometheus.Counter
	ClusterEventTypeInvChannelByName             prometheus.Counter
	ClusterEventTypeInvChannel                   prometheus.Counter
	ClusterEventTypeInvUser                      prometheus.Counter
	ClusterEventTypeInvSessions                  prometheus.Counter
	ClusterEventTypeInvRoles                     prometheus.Counter
	ClusterEventTypeOther                        prometheus.Counter

	LoginCounter     prometheus.Counter
	LoginFailCounter prometheus.Counter

	EtagMissCounters *prometheus.CounterVec
	EtagHitCounters  *prometheus.CounterVec

	MemCacheMissCounters         *prometheus.CounterVec
	MemCacheHitCounters          *prometheus.CounterVec
	MemCacheInvalidationCounters *prometheus.CounterVec

	MemCacheHitCounterSession          prometheus.Counter
	MemCacheMissCounterSession         prometheus.Counter
	MemCacheInvalidationCounterSession prometheus.Counter

	WebsocketEventCounters *prometheus.CounterVec

	WebSocketBroadcastCounters                    *prometheus.CounterVec
	WebSocketBroadcastTyping                      prometheus.Counter
	WebSocketBroadcastChannelViewed               prometheus.Counter
	WebSocketBroadcastPosted                      prometheus.Counter
	WebSocketBroadcastNewUser                     prometheus.Counter
	WebSocketBroadcastUserAdded                   prometheus.Counter
	WebSocketBroadcastUserUpdated                 prometheus.Counter
	WebSocketBroadcastUserRemoved                 prometheus.Counter
	WebSocketBroadcastPreferenceChanged           prometheus.Counter
	WebSocketBroadcastephemeralMessage            prometheus.Counter
	WebSocketBroadcastStatusChange                prometheus.Counter
	WebSocketBroadcastHello                       prometheus.Counter
	WebSocketBroadcastResponse                    prometheus.Counter
	WebsocketBroadcastPostEdited                  prometheus.Counter
	WebsocketBroadcastPostDeleted                 prometheus.Counter
	WebsocketBroadcastPostUnread                  prometheus.Counter
	WebsocketBroadcastChannelConverted            prometheus.Counter
	WebsocketBroadcastChannelCreated              prometheus.Counter
	WebsocketBroadcastChannelDeleted              prometheus.Counter
	WebsocketBroadcastChannelRestored             prometheus.Counter
	WebsocketBroadcastChannelUpdated              prometheus.Counter
	WebsocketBroadcastChannelMemberUpdated        prometheus.Counter
	WebsocketBroadcastChannelSchemeUpdated        prometheus.Counter
	WebsocketBroadcastDirectAdded                 prometheus.Counter
	WebsocketBroadcastGroupAdded                  prometheus.Counter
	WebsocketBroadcastAddedToTeam                 prometheus.Counter
	WebsocketBroadcastLeaveTeam                   prometheus.Counter
	WebsocketBroadcastUpdateTeam                  prometheus.Counter
	WebsocketBroadcastDeleteTeam                  prometheus.Counter
	WebsocketBroadcastRestoreTeam                 prometheus.Counter
	WebsocketBroadcastUpdateTeamScheme            prometheus.Counter
	WebsocketBroadcastUserRoleUpdated             prometheus.Counter
	WebsocketBroadcastMemberroleUpdated           prometheus.Counter
	WebsocketBroadcastPreferencesChanged          prometheus.Counter
	WebsocketBroadcastPreferencesDeleted          prometheus.Counter
	WebsocketBroadcastReactionAdded               prometheus.Counter
	WebsocketBroadcastReactionRemoved             prometheus.Counter
	WebsocketBroadcastGroupMemberDelete           prometheus.Counter
	WebsocketBroadcastGroupMemberAdd              prometheus.Counter
	WebsocketBroadcastSidebarCategoryCreated      prometheus.Counter
	WebsocketBroadcastSidebarCategoryUpdated      prometheus.Counter
	WebsocketBroadcastSidebarCategoryDeleted      prometheus.Counter
	WebsocketBroadcastSidebarCategoryOrderUpdated prometheus.Counter
	WebsocketBroadcastThreadUpdated               prometheus.Counter
	WebsocketBroadcastThreadFollowChanged         prometheus.Counter
	WebsocketBroadcastThreadReadChanged           prometheus.Counter
	WebsocketBroadcastDraftCreated                prometheus.Counter
	WebsocketBroadcastDraftUpdated                prometheus.Counter
	WebsocketBroadcastDraftDeleted                prometheus.Counter

	WebSocketBroadcastOther                      prometheus.Counter
	WebSocketBroadcastBufferGauge                *prometheus.GaugeVec
	WebSocketBroadcastBufferUsersRegisteredGauge *prometheus.GaugeVec
	WebSocketReconnectCounter                    *prometheus.CounterVec

	SearchPostSearchesCounter  prometheus.Counter
	SearchPostSearchesDuration prometheus.Histogram
	SearchFileSearchesCounter  prometheus.Counter
	SearchFileSearchesDuration prometheus.Histogram
	StoreTimesHistograms       *prometheus.HistogramVec
	APITimesHistograms         *prometheus.HistogramVec
	SearchPostIndexCounter     prometheus.Counter
	SearchFileIndexCounter     prometheus.Counter
	SearchUserIndexCounter     prometheus.Counter
	SearchChannelIndexCounter  prometheus.Counter
	ActiveUsers                prometheus.Gauge

	PluginHookTimeHistogram            *prometheus.HistogramVec
	PluginMultiHookTimeHistogram       *prometheus.HistogramVec
	PluginMultiHookServerTimeHistogram prometheus.Histogram
	PluginAPITimeHistogram             *prometheus.HistogramVec

	LoggerQueueGauge      *DynamicGauge
	LoggerLoggedCounters  *DynamicCounter
	LoggerErrorCounters   *DynamicCounter
	LoggerDroppedCounters *DynamicCounter
	LoggerBlockedCounters *DynamicCounter

	RemoteClusterMsgSentCounters        *prometheus.CounterVec
	RemoteClusterMsgReceivedCounters    *prometheus.CounterVec
	RemoteClusterMsgErrorsCounter       *prometheus.CounterVec
	RemoteClusterPingTimesHistograms    *prometheus.HistogramVec
	RemoteClusterClockSkewHistograms    *prometheus.HistogramVec
	RemoteClusterConnStateChangeCounter *prometheus.CounterVec

	SharedChannelsSyncCount                   *prometheus.CounterVec
	SharedChannelsTaskInQueueHistogram        prometheus.Histogram
	SharedChannelsQueueSize                   prometheus.Gauge
	SharedChannelsSyncCollectionHistogram     *prometheus.HistogramVec
	SharedChannelsSyncSendHistogram           *prometheus.HistogramVec
	SharedChannelsSyncCollectionStepHistogram *prometheus.HistogramVec
	SharedChannelsSyncSendStepHistogram       *prometheus.HistogramVec

	ServerStartTime prometheus.Gauge

	JobsActive *prometheus.GaugeVec
}

func init() {
	platform.RegisterMetricsInterface(func(ps *platform.PlatformService, driver, dataSource string) einterfaces.MetricsInterface {
		return New(ps, driver, dataSource)
	})
}

// New creates a new MetricsInterface. The driver and datasoruce parameters are added during
// migrating configuration store to the new platform service. Once the store and license are migrated,
// we will be able to remove server dependency and lean on platform service during initialization.
func New(ps *platform.PlatformService, driver, dataSource string) *MetricsInterfaceImpl {
	m := &MetricsInterfaceImpl{
		Platform: ps,
	}

	m.Registry = prometheus.NewRegistry()
	options := collectors.ProcessCollectorOpts{
		Namespace: MetricsNamespace,
	}
	m.Registry.MustRegister(collectors.NewProcessCollector(options))
	m.Registry.MustRegister(collectors.NewGoCollector())

	additionalLabels := map[string]string{}
	if os.Getenv("MM_CLOUD_INSTALLATION_ID") != "" {
		additionalLabels[MetricsCloudInstallationLabel] = os.Getenv("MM_CLOUD_INSTALLATION_ID")
		if os.Getenv("MM_CLOUD_GROUP_ID") != "" {
			additionalLabels[MetricsCloudInstallationGroupLabel] = os.Getenv("MM_CLOUD_GROUP_ID")
		}
		cluster, err := extractDBCluster(driver, dataSource)
		if err != nil {
			ps.Log().Warn("Failed to extract DB Cluster label", mlog.Err(err))
		} else {
			additionalLabels[MetricsCloudDatabaseClusterLabel] = cluster
		}
	}
	// Posts Subsystem

	m.PostCreateCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemPosts,
		Name:        "total",
		Help:        "The total number of posts created.",
		ConstLabels: additionalLabels,
	})
	m.Registry.MustRegister(m.PostCreateCounter)

	m.WebhookPostCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemPosts,
		Name:        "webhooks_total",
		Help:        "Total number of webhook posts created.",
		ConstLabels: additionalLabels,
	})
	m.Registry.MustRegister(m.WebhookPostCounter)

	m.PostSentEmailCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemPosts,
		Name:        "emails_sent_total",
		Help:        "The total number of emails sent because a post was created.",
		ConstLabels: additionalLabels,
	})
	m.Registry.MustRegister(m.PostSentEmailCounter)

	m.PostSentPushCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemPosts,
		Name:        "pushes_sent_total",
		Help:        "The total number of mobile push notifications sent because a post was created.",
		ConstLabels: additionalLabels,
	})
	m.Registry.MustRegister(m.PostSentPushCounter)

	m.PostBroadcastCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemPosts,
		Name:        "broadcasts_total",
		Help:        "The total number of websocket broadcasts sent because a post was created.",
		ConstLabels: additionalLabels,
	})
	m.Registry.MustRegister(m.PostBroadcastCounter)

	m.PostFileAttachCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemPosts,
		Name:        "file_attachments_total",
		Help:        "The total number of file attachments created because a post was created.",
		ConstLabels: additionalLabels,
	})
	m.Registry.MustRegister(m.PostFileAttachCounter)

	// Database Subsystem

	m.DbMasterConnectionsGauge = prometheus.NewGaugeFunc(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemDB,
		Name:        "master_connections_total",
		Help:        "The total number of connections to the master database.",
		ConstLabels: additionalLabels,
	}, func() float64 { return float64(m.Platform.Store.TotalMasterDbConnections()) })
	m.Registry.MustRegister(m.DbMasterConnectionsGauge)

	m.DbReadConnectionsGauge = prometheus.NewGaugeFunc(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemDB,
		Name:        "read_replica_connections_total",
		Help:        "The total number of connections to all the read replica databases.",
		ConstLabels: additionalLabels,
	}, func() float64 {
		// We use the event hook for total read_replica connections to populate
		// the replica lag metrics.
		// The reason for doing it this way is that the replica lag metrics need the node
		// as a label value, which means we need to populate the metric ourselves. Since this
		// is not an event based metric, we would need to maintain a poller goroutine ourselves
		// to do that. Therefore using the Prometheus in-built metric writer interface helps us
		// to avoid writing that code.
		if m.Platform.IsLeader() {
			err := m.Platform.Store.ReplicaLagAbs()
			if err != nil {
				m.Platform.Log().Warn("ReplicaLagAbs query returned error", mlog.Err(err))
			}
			err = m.Platform.Store.ReplicaLagTime()
			if err != nil {
				m.Platform.Log().Warn("ReplicaLagTime query returned error", mlog.Err(err))
			}
		}

		return float64(m.Platform.Store.TotalReadDbConnections())
	})
	m.Registry.MustRegister(m.DbReadConnectionsGauge)

	m.DbSearchConnectionsGauge = prometheus.NewGaugeFunc(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemDB,
		Name:        "search_replica_connections_total",
		Help:        "The total number of connections to the search replica database.",
		ConstLabels: additionalLabels,
	}, func() float64 { return float64(m.Platform.Store.TotalSearchDbConnections()) })
	m.Registry.MustRegister(m.DbSearchConnectionsGauge)

	m.DbReplicaLagGaugeAbs = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemDB,
			Name:        "replica_lag_abs",
			Help:        "An abstract unit for measuring replica lag.",
			ConstLabels: additionalLabels,
		},
		[]string{"node"},
	)
	m.Registry.MustRegister(m.DbReplicaLagGaugeAbs)

	m.DbReplicaLagGaugeTime = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemDB,
			Name:        "replica_lag_time",
			Help:        "A time unit for measuring replica lag.",
			ConstLabels: additionalLabels,
		},
		[]string{"node"},
	)
	m.Registry.MustRegister(m.DbReplicaLagGaugeTime)

	// HTTP Subsystem

	m.HTTPWebsocketsGauge = prometheus.NewGaugeFunc(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemHTTP,
		Name:        "websockets_total",
		Help:        "The total number of websocket connections to this server.",
		ConstLabels: additionalLabels,
	}, func() float64 { return float64(m.Platform.TotalWebsocketConnections()) })
	m.Registry.MustRegister(m.HTTPWebsocketsGauge)

	m.HTTPRequestsCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemHTTP,
		Name:        "requests_total",
		Help:        "The total number of http API requests.",
		ConstLabels: additionalLabels,
	})
	m.Registry.MustRegister(m.HTTPRequestsCounter)

	m.HTTPErrorsCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemHTTP,
		Name:        "errors_total",
		Help:        "The total number of http API errors.",
		ConstLabels: additionalLabels,
	})
	m.Registry.MustRegister(m.HTTPErrorsCounter)

	// Cluster Subsystem

	m.ClusterHealthGauge = prometheus.NewGaugeFunc(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemCluster,
		Name:        "cluster_health_score",
		Help:        "A score that gives an idea of how well it is meeting the soft-real time requirements of the gossip protocol.",
		ConstLabels: additionalLabels,
	}, func() float64 {
		if m.Platform.Cluster() == nil {
			return 0
		}

		return float64(m.Platform.Cluster().HealthScore())
	})
	m.Registry.MustRegister(m.ClusterHealthGauge)

	m.ClusterRequestsCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemCluster,
		Name:        "cluster_requests_total",
		Help:        "The total number of inter-node requests.",
		ConstLabels: additionalLabels,
	})
	m.Registry.MustRegister(m.ClusterRequestsCounter)

	m.ClusterRequestsDuration = prometheus.NewHistogram(prometheus.HistogramOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemCluster,
		Name:        "cluster_request_duration_seconds",
		Help:        "The total duration in seconds of the inter-node cluster requests.",
		ConstLabels: additionalLabels,
	})
	m.Registry.MustRegister(m.ClusterRequestsDuration)

	m.ClusterEventTypeCounters = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemCluster,
			Name:        "cluster_event_type_totals",
			Help:        "The total number of cluster requests sent for any type.",
			ConstLabels: additionalLabels,
		},
		[]string{"name"},
	)
	m.Registry.MustRegister(m.ClusterEventTypeCounters)
	m.ClusterEventTypePublish = m.ClusterEventTypeCounters.With(prometheus.Labels{"name": string(model.ClusterEventPublish)})
	m.ClusterEventTypeStatus = m.ClusterEventTypeCounters.With(prometheus.Labels{"name": string(model.ClusterEventUpdateStatus)})
	m.ClusterEventTypeInvAll = m.ClusterEventTypeCounters.With(prometheus.Labels{"name": string(model.ClusterEventInvalidateAllCaches)})
	m.ClusterEventTypeInvReactions = m.ClusterEventTypeCounters.With(prometheus.Labels{"name": string(model.ClusterEventInvalidateCacheForReactions)})
	m.ClusterEventTypeInvChannelMembersNotifyProps = m.ClusterEventTypeCounters.With(prometheus.Labels{"name": string(model.ClusterEventInvalidateCacheForChannelMembersNotifyProps)})
	m.ClusterEventTypeInvChannelByName = m.ClusterEventTypeCounters.With(prometheus.Labels{"name": string(model.ClusterEventInvalidateCacheForChannelByName)})
	m.ClusterEventTypeInvChannel = m.ClusterEventTypeCounters.With(prometheus.Labels{"name": string(model.ClusterEventInvalidateCacheForChannel)})
	m.ClusterEventTypeInvUser = m.ClusterEventTypeCounters.With(prometheus.Labels{"name": string(model.ClusterEventInvalidateCacheForUser)})
	m.ClusterEventTypeInvSessions = m.ClusterEventTypeCounters.With(prometheus.Labels{"name": string(model.ClusterEventClearSessionCacheForUser)})
	m.ClusterEventTypeInvRoles = m.ClusterEventTypeCounters.With(prometheus.Labels{"name": string(model.ClusterEventInvalidateCacheForRoles)})
	m.ClusterEventTypeOther = m.ClusterEventTypeCounters.With(prometheus.Labels{"name": "other"})

	// Login Subsystem

	m.LoginCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemLogin,
		Name:        "logins_total",
		Help:        "The total number of successful logins.",
		ConstLabels: additionalLabels,
	})
	m.Registry.MustRegister(m.LoginCounter)

	m.LoginFailCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemLogin,
		Name:        "logins_fail_total",
		Help:        "The total number of failed logins.",
		ConstLabels: additionalLabels,
	})
	m.Registry.MustRegister(m.LoginFailCounter)

	// Caching Subsystem

	m.EtagMissCounters = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemCaching,
			Name:        "etag_miss_total",
			Help:        "Total number of etag misses",
			ConstLabels: additionalLabels,
		},
		[]string{"route"},
	)
	m.Registry.MustRegister(m.EtagMissCounters)

	m.EtagHitCounters = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemCaching,
			Name:        "etag_hit_total",
			Help:        "Total number of etag hits (304)",
			ConstLabels: additionalLabels,
		},
		[]string{"route"},
	)
	m.Registry.MustRegister(m.EtagHitCounters)

	m.MemCacheMissCounters = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemCaching,
			Name:        "mem_miss_total",
			Help:        "Total number of memory cache misses",
			ConstLabels: additionalLabels,
		},
		[]string{"name"},
	)
	m.Registry.MustRegister(m.MemCacheMissCounters)
	m.MemCacheMissCounterSession = m.MemCacheMissCounters.With(prometheus.Labels{"name": "Session"})

	m.MemCacheHitCounters = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemCaching,
			Name:        "mem_hit_total",
			Help:        "Total number of memory cache hits",
			ConstLabels: additionalLabels,
		},
		[]string{"name"},
	)
	m.Registry.MustRegister(m.MemCacheHitCounters)
	m.MemCacheHitCounterSession = m.MemCacheHitCounters.With(prometheus.Labels{"name": "Session"})

	m.MemCacheInvalidationCounters = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemCaching,
			Name:        "mem_invalidation_total",
			Help:        "Total number of memory cache invalidations",
			ConstLabels: additionalLabels,
		},
		[]string{"name"},
	)
	m.Registry.MustRegister(m.MemCacheInvalidationCounters)
	m.MemCacheInvalidationCounterSession = m.MemCacheInvalidationCounters.With(prometheus.Labels{"name": "Session"})

	// Websocket Subsystem

	m.WebSocketBroadcastCounters = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemWebsocket,
			Name:        "broadcasts_total",
			Help:        "The total number of websocket broadcasts sent for any type.",
			ConstLabels: additionalLabels,
		},
		[]string{"name"},
	)
	m.Registry.MustRegister(m.WebSocketBroadcastCounters)
	m.WebSocketBroadcastTyping = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventTyping)})
	m.WebSocketBroadcastChannelViewed = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventMultipleChannelsViewed)})
	m.WebSocketBroadcastPosted = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventPosted)})
	m.WebSocketBroadcastNewUser = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventNewUser)})
	m.WebSocketBroadcastUserAdded = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventUserAdded)})
	m.WebSocketBroadcastUserUpdated = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventUserUpdated)})
	m.WebSocketBroadcastUserRemoved = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventUserRemoved)})
	m.WebSocketBroadcastPreferenceChanged = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventPreferenceChanged)})
	m.WebSocketBroadcastephemeralMessage = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventEphemeralMessage)})
	m.WebSocketBroadcastStatusChange = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventStatusChange)})
	m.WebSocketBroadcastHello = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventHello)})
	m.WebSocketBroadcastResponse = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventResponse)})
	m.WebsocketBroadcastPostEdited = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventPostEdited)})
	m.WebsocketBroadcastPostDeleted = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventPostDeleted)})
	m.WebsocketBroadcastPostUnread = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventPostUnread)})
	m.WebsocketBroadcastChannelConverted = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventChannelConverted)})
	m.WebsocketBroadcastChannelCreated = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventChannelCreated)})
	m.WebsocketBroadcastChannelDeleted = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventChannelDeleted)})
	m.WebsocketBroadcastChannelRestored = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventChannelRestored)})
	m.WebsocketBroadcastChannelUpdated = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventChannelUpdated)})
	m.WebsocketBroadcastChannelMemberUpdated = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventChannelMemberUpdated)})
	m.WebsocketBroadcastChannelSchemeUpdated = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventChannelSchemeUpdated)})
	m.WebsocketBroadcastDirectAdded = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventDirectAdded)})
	m.WebsocketBroadcastGroupAdded = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventGroupAdded)})
	m.WebsocketBroadcastAddedToTeam = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventAddedToTeam)})
	m.WebsocketBroadcastLeaveTeam = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventLeaveTeam)})
	m.WebsocketBroadcastUpdateTeam = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventUpdateTeam)})
	m.WebsocketBroadcastDeleteTeam = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventDeleteTeam)})
	m.WebsocketBroadcastRestoreTeam = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventRestoreTeam)})
	m.WebsocketBroadcastUpdateTeamScheme = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventUpdateTeamScheme)})
	m.WebsocketBroadcastUserRoleUpdated = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventUserRoleUpdated)})
	m.WebsocketBroadcastMemberroleUpdated = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventMemberroleUpdated)})
	m.WebsocketBroadcastPreferencesChanged = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventPreferencesChanged)})
	m.WebsocketBroadcastPreferencesDeleted = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventPreferencesDeleted)})
	m.WebsocketBroadcastReactionAdded = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventReactionAdded)})
	m.WebsocketBroadcastReactionRemoved = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventReactionRemoved)})
	m.WebsocketBroadcastGroupMemberDelete = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventGroupMemberDelete)})
	m.WebsocketBroadcastGroupMemberAdd = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventGroupMemberAdd)})
	m.WebsocketBroadcastSidebarCategoryCreated = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventSidebarCategoryCreated)})
	m.WebsocketBroadcastSidebarCategoryUpdated = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventSidebarCategoryUpdated)})
	m.WebsocketBroadcastSidebarCategoryDeleted = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventSidebarCategoryDeleted)})
	m.WebsocketBroadcastSidebarCategoryOrderUpdated = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventSidebarCategoryOrderUpdated)})
	m.WebsocketBroadcastThreadUpdated = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventThreadUpdated)})
	m.WebsocketBroadcastThreadFollowChanged = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventThreadFollowChanged)})
	m.WebsocketBroadcastThreadReadChanged = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventThreadReadChanged)})
	m.WebsocketBroadcastDraftCreated = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventDraftCreated)})
	m.WebsocketBroadcastDraftUpdated = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventDraftUpdated)})
	m.WebsocketBroadcastDraftDeleted = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": string(model.WebsocketEventDraftDeleted)})
	m.WebSocketBroadcastOther = m.WebSocketBroadcastCounters.With(prometheus.Labels{"name": "other"})

	m.WebsocketEventCounters = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemWebsocket,
			Name:        "event_total",
			Help:        "Total number of websocket events",
			ConstLabels: additionalLabels,
		},
		[]string{"type"},
	)
	m.Registry.MustRegister(m.WebsocketEventCounters)

	m.WebSocketBroadcastBufferGauge = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemWebsocket,
			Name:        "broadcast_buffer_size",
			Help:        "Number of events in the websocket broadcasts buffer waiting to be processed",
			ConstLabels: additionalLabels,
		},
		[]string{"hub"},
	)
	m.Registry.MustRegister(m.WebSocketBroadcastBufferGauge)

	m.WebSocketBroadcastBufferUsersRegisteredGauge = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemWebsocket,
			Name:        "broadcast_buffer_users_registered",
			Help:        "Number of users registered in a broadcast buffer hub",
			ConstLabels: additionalLabels,
		},
		[]string{"hub"},
	)
	m.Registry.MustRegister(m.WebSocketBroadcastBufferUsersRegisteredGauge)

	m.WebSocketReconnectCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemWebsocket,
			Name:        "reconnects_total",
			Help:        "Total number of websocket reconnect attempts",
			ConstLabels: additionalLabels,
		},
		[]string{"type"},
	)
	m.Registry.MustRegister(m.WebSocketReconnectCounter)

	// Search Subsystem

	m.SearchPostSearchesCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemSearch,
		Name:        "posts_searches_total",
		Help:        "The total number of post searches carried out.",
		ConstLabels: additionalLabels,
	})
	m.Registry.MustRegister(m.SearchPostSearchesCounter)

	m.SearchPostSearchesDuration = prometheus.NewHistogram(prometheus.HistogramOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemSearch,
		Name:        "posts_searches_duration_seconds",
		Help:        "The total duration in seconds of post searches.",
		ConstLabels: additionalLabels,
	})
	m.Registry.MustRegister(m.SearchPostSearchesDuration)

	m.SearchFileSearchesCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemSearch,
		Name:        "files_searches_total",
		Help:        "The total number of file searches carried out.",
		ConstLabels: additionalLabels,
	})
	m.Registry.MustRegister(m.SearchFileSearchesCounter)

	m.SearchFileSearchesDuration = prometheus.NewHistogram(prometheus.HistogramOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemSearch,
		Name:        "files_searches_duration_seconds",
		Help:        "The total duration in seconds of file searches.",
		ConstLabels: additionalLabels,
	})
	m.Registry.MustRegister(m.SearchFileSearchesDuration)

	m.ActiveUsers = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemDB,
		Name:        "active_users",
		Help:        "The total number of active users.",
		ConstLabels: additionalLabels,
	})
	m.Registry.MustRegister(m.ActiveUsers)

	m.StoreTimesHistograms = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemDB,
			Name:        "store_time",
			Help:        "Time to execute the store method",
			ConstLabels: additionalLabels,
		},
		[]string{"method", "success"},
	)
	m.Registry.MustRegister(m.StoreTimesHistograms)

	m.APITimesHistograms = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemAPI,
			Name:        "time",
			Help:        "Time to execute the api handler",
			ConstLabels: additionalLabels,
		},
		[]string{"handler", "method", "status_code", "origin_client", "page_load_context"},
	)
	m.Registry.MustRegister(m.APITimesHistograms)

	m.SearchPostIndexCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemSearch,
		Name:        "post_index_total",
		Help:        "The total number of posts indexes carried out.",
		ConstLabels: additionalLabels,
	})
	m.Registry.MustRegister(m.SearchPostIndexCounter)

	m.SearchFileIndexCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemSearch,
		Name:        "file_index_total",
		Help:        "The total number of files indexes carried out.",
		ConstLabels: additionalLabels,
	})
	m.Registry.MustRegister(m.SearchFileIndexCounter)

	m.SearchUserIndexCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemSearch,
		Name:        "user_index_total",
		Help:        "The total number of user indexes carried out.",
		ConstLabels: additionalLabels,
	})
	m.Registry.MustRegister(m.SearchUserIndexCounter)

	m.SearchChannelIndexCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemSearch,
		Name:        "channel_index_total",
		Help:        "The total number of channel indexes carried out.",
		ConstLabels: additionalLabels,
	})
	m.Registry.MustRegister(m.SearchChannelIndexCounter)

	// Plugin Subsystem

	m.PluginHookTimeHistogram = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemPlugin,
			Name:        "hook_time",
			Help:        "Time to execute plugin hook handler in seconds.",
			ConstLabels: additionalLabels,
		},
		[]string{"plugin_id", "hook_name", "success"},
	)
	m.Registry.MustRegister(m.PluginHookTimeHistogram)

	m.PluginMultiHookTimeHistogram = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemPlugin,
			Name:        "multi_hook_time",
			Help:        "Time to execute multiple plugin hook handler in seconds.",
			ConstLabels: additionalLabels,
		},
		[]string{"plugin_id"},
	)
	m.Registry.MustRegister(m.PluginMultiHookTimeHistogram)

	m.PluginMultiHookServerTimeHistogram = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemPlugin,
			Name:        "multi_hook_server_time",
			Help:        "Time for the server to execute multiple plugin hook handlers in seconds.",
			ConstLabels: additionalLabels,
		},
	)
	m.Registry.MustRegister(m.PluginMultiHookServerTimeHistogram)

	m.PluginAPITimeHistogram = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemPlugin,
			Name:        "api_time",
			Help:        "Time to execute plugin API handlers in seconds.",
			ConstLabels: additionalLabels,
		},
		[]string{"plugin_id", "api_name", "success"},
	)
	m.Registry.MustRegister(m.PluginAPITimeHistogram)

	// Logging subsystem

	m.LoggerQueueGauge = NewDynamicGauge(
		prometheus.GaugeOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemLogging,
			Name:      "logger_queue_used",
			Help:      "Number of records in log target queue.",
		},
		"target",
	)
	m.Registry.MustRegister(m.LoggerQueueGauge.gauge)

	m.LoggerLoggedCounters = NewDynamicCounter(
		prometheus.CounterOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemLogging,
			Name:      "logger_logged_total",
			Help:      "The total number of records logged.",
		},
		"target",
	)
	m.Registry.MustRegister(m.LoggerLoggedCounters.counter)

	m.LoggerErrorCounters = NewDynamicCounter(
		prometheus.CounterOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemLogging,
			Name:      "logger_error_total",
			Help:      "The total number of logger errors.",
		},
		"target",
	)
	m.Registry.MustRegister(m.LoggerErrorCounters.counter)

	m.LoggerDroppedCounters = NewDynamicCounter(
		prometheus.CounterOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemLogging,
			Name:      "logger_dropped_total",
			Help:      "The total number of dropped log records.",
		},
		"target",
	)
	m.Registry.MustRegister(m.LoggerDroppedCounters.counter)

	m.LoggerBlockedCounters = NewDynamicCounter(
		prometheus.CounterOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemLogging,
			Name:      "logger_blocked_total",
			Help:      "The total number of log records that were blocked/delayed.",
		},
		"target",
	)
	m.Registry.MustRegister(m.LoggerBlockedCounters.counter)

	// Remote Cluster service

	m.RemoteClusterMsgSentCounters = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemRemoteCluster,
			Name:        "msg_sent_total",
			Help:        "Total number of messages sent to the remote cluster",
			ConstLabels: additionalLabels,
		},
		[]string{"remote_id"},
	)
	m.Registry.MustRegister(m.RemoteClusterMsgSentCounters)

	m.RemoteClusterMsgReceivedCounters = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemRemoteCluster,
			Name:        "msg_received_total",
			Help:        "Total number of messages received from the remote cluster",
			ConstLabels: additionalLabels,
		},
		[]string{"remote_id"},
	)
	m.Registry.MustRegister(m.RemoteClusterMsgReceivedCounters)

	m.RemoteClusterMsgErrorsCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemRemoteCluster,
			Name:        "msg_errors_total",
			Help:        "Total number of message errors",
			ConstLabels: additionalLabels,
		},
		[]string{"remote_id", "timeout"},
	)
	m.Registry.MustRegister(m.RemoteClusterMsgErrorsCounter)

	m.RemoteClusterPingTimesHistograms = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemRemoteCluster,
			Name:        "ping_time",
			Help:        "The ping roundtrip times to the remote cluster",
			ConstLabels: additionalLabels,
		},
		[]string{"remote_id"},
	)
	m.Registry.MustRegister(m.RemoteClusterPingTimesHistograms)

	m.RemoteClusterClockSkewHistograms = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemRemoteCluster,
			Name:        "clock_skew",
			Help:        "An approximated value for clock skew between clusters",
			ConstLabels: additionalLabels,
		},
		[]string{"remote_id"},
	)
	m.Registry.MustRegister(m.RemoteClusterClockSkewHistograms)

	m.RemoteClusterConnStateChangeCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemRemoteCluster,
			Name:        "conn_state_change_total",
			Help:        "Total number of connection state changes",
			ConstLabels: additionalLabels,
		},
		[]string{"remote_id", "online"},
	)
	m.Registry.MustRegister(m.RemoteClusterConnStateChangeCounter)

	// Shared Channel service

	m.SharedChannelsSyncCount = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemSharedChannels,
			Name:        "sync_count",
			Help:        "Count of sync events processed for each remote",
			ConstLabels: additionalLabels,
		},
		[]string{"remote_id"},
	)
	m.Registry.MustRegister(m.SharedChannelsSyncCount)

	m.SharedChannelsTaskInQueueHistogram = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemSharedChannels,
			Name:        "task_in_queue_duration_seconds",
			Help:        "Duration tasks spend in queue (seconds)",
			ConstLabels: additionalLabels,
		},
	)
	m.Registry.MustRegister(m.SharedChannelsTaskInQueueHistogram)

	m.SharedChannelsQueueSize = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemSharedChannels,
			Name:        "task_queue_size",
			Help:        "Current number of tasks in queue",
			ConstLabels: additionalLabels,
		},
	)
	m.Registry.MustRegister(m.SharedChannelsQueueSize)

	m.SharedChannelsSyncCollectionHistogram = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemSharedChannels,
			Name:        "sync_collection_duration_seconds",
			Help:        "Duration tasks spend collecting sync data (seconds)",
			ConstLabels: additionalLabels,
		},
		[]string{"remote_id"},
	)
	m.Registry.MustRegister(m.SharedChannelsSyncCollectionHistogram)

	m.SharedChannelsSyncSendHistogram = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemSharedChannels,
			Name:        "sync_send_duration_seconds",
			Help:        "Duration tasks spend sending sync data (seconds)",
			ConstLabels: additionalLabels,
		},
		[]string{"remote_id"},
	)
	m.Registry.MustRegister(m.SharedChannelsSyncSendHistogram)

	m.SharedChannelsSyncCollectionStepHistogram = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemSharedChannels,
			Name:        "sync_collection_step_duration_seconds",
			Help:        "Duration tasks spend in each step collecting data (seconds)",
			ConstLabels: additionalLabels,
		},
		[]string{"remote_id", "step"},
	)
	m.Registry.MustRegister(m.SharedChannelsSyncCollectionStepHistogram)

	m.SharedChannelsSyncSendStepHistogram = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemSharedChannels,
			Name:        "sync_send_step_duration_seconds",
			Help:        "Duration tasks spend in each step sending data (seconds)",
			ConstLabels: additionalLabels,
		},
		[]string{"remote_id", "step"},
	)
	m.Registry.MustRegister(m.SharedChannelsSyncSendStepHistogram)

	m.ServerStartTime = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemSystem,
		Name:        "server_start_time",
		Help:        "The time the server started.",
		ConstLabels: additionalLabels,
	})
	m.ServerStartTime.SetToCurrentTime()
	m.Registry.MustRegister(m.ServerStartTime)

	m.JobsActive = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemJobs,
			Name:        "active",
			Help:        "Number of active jobs",
			ConstLabels: additionalLabels,
		},
		[]string{"type"},
	)
	m.Registry.MustRegister(m.JobsActive)
	return m
}

func (mi *MetricsInterfaceImpl) isLicensed() bool {
	license := mi.Platform.License()
	return (license != nil && *license.Features.Metrics) || (model.BuildNumber == "dev")
}

func (mi *MetricsInterfaceImpl) Register() {
	if !mi.isLicensed() {
		return
	}

	mi.Platform.HandleMetrics("/metrics", promhttp.HandlerFor(mi.Registry, promhttp.HandlerOpts{}))
	mi.Platform.Logger().Info("Metrics endpoint is initiated", mlog.String("address", *mi.Platform.Config().MetricsSettings.ListenAddress))
}

func (mi *MetricsInterfaceImpl) RegisterDBCollector(db *sql.DB, name string) {
	mi.Registry.MustRegister(collectors.NewDBStatsCollector(db, name))
}

func (mi *MetricsInterfaceImpl) UnregisterDBCollector(db *sql.DB, name string) {
	mi.Registry.Unregister(collectors.NewDBStatsCollector(db, name))
}

func (mi *MetricsInterfaceImpl) IncrementPostCreate() {
	mi.PostCreateCounter.Inc()
}

func (mi *MetricsInterfaceImpl) IncrementWebhookPost() {
	mi.WebhookPostCounter.Inc()
}

func (mi *MetricsInterfaceImpl) IncrementPostSentEmail() {
	mi.PostSentEmailCounter.Inc()
}

func (mi *MetricsInterfaceImpl) IncrementPostSentPush() {
	mi.PostSentPushCounter.Inc()
}

func (mi *MetricsInterfaceImpl) IncrementPostBroadcast() {
	mi.PostBroadcastCounter.Inc()
}

func (mi *MetricsInterfaceImpl) IncrementWebSocketBroadcast(eventType model.WebsocketEventType) {
	switch eventType {
	case model.WebsocketEventPosted:
		mi.IncrementPostBroadcast()
		mi.WebSocketBroadcastPosted.Inc()
	case model.WebsocketEventTyping:
		mi.WebSocketBroadcastTyping.Inc()
	case model.WebsocketEventMultipleChannelsViewed:
		mi.WebSocketBroadcastChannelViewed.Inc()
	case model.WebsocketEventNewUser:
		mi.WebSocketBroadcastNewUser.Inc()
	case model.WebsocketEventUserAdded:
		mi.WebSocketBroadcastUserAdded.Inc()
	case model.WebsocketEventUserUpdated:
		mi.WebSocketBroadcastUserUpdated.Inc()
	case model.WebsocketEventUserRemoved:
		mi.WebSocketBroadcastUserRemoved.Inc()
	case model.WebsocketEventPreferenceChanged:
		mi.WebSocketBroadcastPreferenceChanged.Inc()
	case model.WebsocketEventEphemeralMessage:
		mi.WebSocketBroadcastephemeralMessage.Inc()
	case model.WebsocketEventStatusChange:
		mi.WebSocketBroadcastStatusChange.Inc()
	case model.WebsocketEventHello:
		mi.WebSocketBroadcastHello.Inc()
	case model.WebsocketEventResponse:
		mi.WebSocketBroadcastResponse.Inc()
	case model.WebsocketEventPostEdited:
		mi.WebsocketBroadcastPostEdited.Inc()
	case model.WebsocketEventPostDeleted:
		mi.WebsocketBroadcastPostDeleted.Inc()
	case model.WebsocketEventPostUnread:
		mi.WebsocketBroadcastPostUnread.Inc()
	case model.WebsocketEventChannelConverted:
		mi.WebsocketBroadcastChannelConverted.Inc()
	case model.WebsocketEventChannelCreated:
		mi.WebsocketBroadcastChannelCreated.Inc()
	case model.WebsocketEventChannelDeleted:
		mi.WebsocketBroadcastChannelDeleted.Inc()
	case model.WebsocketEventChannelRestored:
		mi.WebsocketBroadcastChannelRestored.Inc()
	case model.WebsocketEventChannelUpdated:
		mi.WebsocketBroadcastChannelUpdated.Inc()
	case model.WebsocketEventChannelMemberUpdated:
		mi.WebsocketBroadcastChannelMemberUpdated.Inc()
	case model.WebsocketEventChannelSchemeUpdated:
		mi.WebsocketBroadcastChannelSchemeUpdated.Inc()
	case model.WebsocketEventDirectAdded:
		mi.WebsocketBroadcastDirectAdded.Inc()
	case model.WebsocketEventGroupAdded:
		mi.WebsocketBroadcastGroupAdded.Inc()
	case model.WebsocketEventAddedToTeam:
		mi.WebsocketBroadcastAddedToTeam.Inc()
	case model.WebsocketEventLeaveTeam:
		mi.WebsocketBroadcastLeaveTeam.Inc()
	case model.WebsocketEventUpdateTeam:
		mi.WebsocketBroadcastUpdateTeam.Inc()
	case model.WebsocketEventDeleteTeam:
		mi.WebsocketBroadcastDeleteTeam.Inc()
	case model.WebsocketEventRestoreTeam:
		mi.WebsocketBroadcastRestoreTeam.Inc()
	case model.WebsocketEventUpdateTeamScheme:
		mi.WebsocketBroadcastUpdateTeamScheme.Inc()
	case model.WebsocketEventUserRoleUpdated:
		mi.WebsocketBroadcastUserRoleUpdated.Inc()
	case model.WebsocketEventMemberroleUpdated:
		mi.WebsocketBroadcastMemberroleUpdated.Inc()
	case model.WebsocketEventPreferencesChanged:
		mi.WebsocketBroadcastPreferencesChanged.Inc()
	case model.WebsocketEventPreferencesDeleted:
		mi.WebsocketBroadcastPreferencesDeleted.Inc()
	case model.WebsocketEventReactionAdded:
		mi.WebsocketBroadcastReactionAdded.Inc()
	case model.WebsocketEventReactionRemoved:
		mi.WebsocketBroadcastReactionRemoved.Inc()
	case model.WebsocketEventGroupMemberDelete:
		mi.WebsocketBroadcastGroupMemberDelete.Inc()
	case model.WebsocketEventGroupMemberAdd:
		mi.WebsocketBroadcastGroupMemberAdd.Inc()
	case model.WebsocketEventSidebarCategoryCreated:
		mi.WebsocketBroadcastSidebarCategoryCreated.Inc()
	case model.WebsocketEventSidebarCategoryUpdated:
		mi.WebsocketBroadcastSidebarCategoryUpdated.Inc()
	case model.WebsocketEventSidebarCategoryDeleted:
		mi.WebsocketBroadcastSidebarCategoryDeleted.Inc()
	case model.WebsocketEventSidebarCategoryOrderUpdated:
		mi.WebsocketBroadcastSidebarCategoryOrderUpdated.Inc()
	case model.WebsocketEventThreadUpdated:
		mi.WebsocketBroadcastThreadUpdated.Inc()
	case model.WebsocketEventThreadFollowChanged:
		mi.WebsocketBroadcastThreadFollowChanged.Inc()
	case model.WebsocketEventThreadReadChanged:
		mi.WebsocketBroadcastThreadReadChanged.Inc()
	case model.WebsocketEventDraftCreated:
		mi.WebsocketBroadcastDraftCreated.Inc()
	case model.WebsocketEventDraftUpdated:
		mi.WebsocketBroadcastDraftUpdated.Inc()
	case model.WebsocketEventDraftDeleted:
		mi.WebsocketBroadcastDraftDeleted.Inc()
	default:
		mi.WebSocketBroadcastOther.Inc()
	}
}

func (mi *MetricsInterfaceImpl) IncrementPostFileAttachment(count int) {
	mi.PostFileAttachCounter.Add(float64(count))
}

func (mi *MetricsInterfaceImpl) IncrementHTTPRequest() {
	mi.HTTPRequestsCounter.Inc()
}

func (mi *MetricsInterfaceImpl) IncrementHTTPError() {
	mi.HTTPErrorsCounter.Inc()
}

func (mi *MetricsInterfaceImpl) IncrementClusterRequest() {
	mi.ClusterRequestsCounter.Inc()
}

func (mi *MetricsInterfaceImpl) ObserveClusterRequestDuration(elapsed float64) {
	mi.ClusterRequestsDuration.Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObserveStoreMethodDuration(method string, success string, elapsed float64) {
	mi.StoreTimesHistograms.With(prometheus.Labels{"method": method, "success": success}).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObserveAPIEndpointDuration(handler, method, statusCode, originClient, pageLoadContext string, elapsed float64) {
	mi.APITimesHistograms.With(prometheus.Labels{"handler": handler, "method": method, "status_code": statusCode, "origin_client": originClient, "page_load_context": pageLoadContext}).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) IncrementClusterEventType(eventType model.ClusterEvent) {
	switch eventType {
	case model.ClusterEventPublish:
		mi.ClusterEventTypePublish.Inc()
	case model.ClusterEventUpdateStatus:
		mi.ClusterEventTypeStatus.Inc()
	case model.ClusterEventInvalidateAllCaches:
		mi.ClusterEventTypeInvAll.Inc()
	case model.ClusterEventInvalidateCacheForReactions:
		mi.ClusterEventTypeInvReactions.Inc()
	case model.ClusterEventInvalidateCacheForChannelMembersNotifyProps:
		mi.ClusterEventTypeInvChannelMembersNotifyProps.Inc()
	case model.ClusterEventInvalidateCacheForChannelByName:
		mi.ClusterEventTypeInvChannelByName.Inc()
	case model.ClusterEventInvalidateCacheForChannel:
		mi.ClusterEventTypeInvChannel.Inc()
	case model.ClusterEventInvalidateCacheForUser:
		mi.ClusterEventTypeInvUser.Inc()
	case model.ClusterEventClearSessionCacheForUser:
		mi.ClusterEventTypeInvSessions.Inc()
	case model.ClusterEventInvalidateCacheForRoles:
		mi.ClusterEventTypeInvRoles.Inc()
	default:
		mi.ClusterEventTypeOther.Inc()
	}
}

func (mi *MetricsInterfaceImpl) IncrementLogin() {
	mi.LoginCounter.Inc()
}

func (mi *MetricsInterfaceImpl) IncrementLoginFail() {
	mi.LoginFailCounter.Inc()
}

func (mi *MetricsInterfaceImpl) IncrementEtagMissCounter(route string) {
	mi.EtagMissCounters.With(prometheus.Labels{"route": route}).Inc()
}

func (mi *MetricsInterfaceImpl) IncrementEtagHitCounter(route string) {
	mi.EtagHitCounters.With(prometheus.Labels{"route": route}).Inc()
}

func (mi *MetricsInterfaceImpl) IncrementMemCacheMissCounter(cacheName string) {
	mi.MemCacheMissCounters.With(prometheus.Labels{"name": cacheName}).Inc()
}

func (mi *MetricsInterfaceImpl) IncrementMemCacheHitCounter(cacheName string) {
	mi.MemCacheHitCounters.With(prometheus.Labels{"name": cacheName}).Inc()
}

func (mi *MetricsInterfaceImpl) IncrementMemCacheInvalidationCounter(cacheName string) {
	mi.MemCacheInvalidationCounters.With(prometheus.Labels{"name": cacheName}).Inc()
}

func (mi *MetricsInterfaceImpl) IncrementMemCacheMissCounterSession() {
	mi.MemCacheMissCounterSession.Inc()
}

func (mi *MetricsInterfaceImpl) IncrementMemCacheHitCounterSession() {
	mi.MemCacheHitCounterSession.Inc()
}

func (mi *MetricsInterfaceImpl) IncrementMemCacheInvalidationCounterSession() {
	mi.MemCacheInvalidationCounterSession.Inc()
}

func (mi *MetricsInterfaceImpl) AddMemCacheMissCounter(cacheName string, amount float64) {
	mi.MemCacheMissCounters.With(prometheus.Labels{"name": cacheName}).Add(amount)
}

func (mi *MetricsInterfaceImpl) AddMemCacheHitCounter(cacheName string, amount float64) {
	mi.MemCacheHitCounters.With(prometheus.Labels{"name": cacheName}).Add(amount)
}

func (mi *MetricsInterfaceImpl) IncrementWebsocketEvent(eventType model.WebsocketEventType) {
	mi.WebsocketEventCounters.With(prometheus.Labels{"type": string(eventType)}).Inc()
}

func (mi *MetricsInterfaceImpl) IncrementWebsocketReconnectEvent(eventType string) {
	mi.WebSocketReconnectCounter.With(prometheus.Labels{"type": eventType}).Inc()
}

func (mi *MetricsInterfaceImpl) IncrementWebSocketBroadcastBufferSize(hub string, amount float64) {
	mi.WebSocketBroadcastBufferGauge.With(prometheus.Labels{"hub": hub}).Add(math.Abs(amount))
}

func (mi *MetricsInterfaceImpl) DecrementWebSocketBroadcastBufferSize(hub string, amount float64) {
	mi.WebSocketBroadcastBufferGauge.With(prometheus.Labels{"hub": hub}).Add(-math.Abs(amount))
}

func (mi *MetricsInterfaceImpl) IncrementWebSocketBroadcastUsersRegistered(hub string, amount float64) {
	mi.WebSocketBroadcastBufferUsersRegisteredGauge.With(prometheus.Labels{"hub": hub}).Add(math.Abs(amount))
}

func (mi *MetricsInterfaceImpl) DecrementWebSocketBroadcastUsersRegistered(hub string, amount float64) {
	mi.WebSocketBroadcastBufferUsersRegisteredGauge.With(prometheus.Labels{"hub": hub}).Add(-math.Abs(amount))
}

func (mi *MetricsInterfaceImpl) IncrementPostsSearchCounter() {
	mi.SearchPostSearchesCounter.Inc()
}

func (mi *MetricsInterfaceImpl) IncrementFilesSearchCounter() {
	mi.SearchFileSearchesCounter.Inc()
}

func (mi *MetricsInterfaceImpl) ObserveEnabledUsers(users int64) {
	mi.ActiveUsers.Set(float64(users))
}

func (mi *MetricsInterfaceImpl) ObservePostsSearchDuration(elapsed float64) {
	mi.SearchPostSearchesDuration.Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObserveFilesSearchDuration(elapsed float64) {
	mi.SearchFileSearchesDuration.Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) IncrementPostIndexCounter() {
	mi.SearchPostIndexCounter.Inc()
}

func (mi *MetricsInterfaceImpl) IncrementFileIndexCounter() {
	mi.SearchFileIndexCounter.Inc()
}

func (mi *MetricsInterfaceImpl) IncrementUserIndexCounter() {
	mi.SearchUserIndexCounter.Inc()
}

func (mi *MetricsInterfaceImpl) IncrementChannelIndexCounter() {
	mi.SearchChannelIndexCounter.Inc()
}

func (mi *MetricsInterfaceImpl) ObservePluginHookDuration(pluginID, hookName string, success bool, elapsed float64) {
	mi.PluginHookTimeHistogram.With(prometheus.Labels{"plugin_id": pluginID, "hook_name": hookName, "success": strconv.FormatBool(success)}).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObservePluginMultiHookIterationDuration(pluginID string, elapsed float64) {
	mi.PluginMultiHookTimeHistogram.With(prometheus.Labels{"plugin_id": pluginID}).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObservePluginMultiHookDuration(elapsed float64) {
	mi.PluginMultiHookServerTimeHistogram.Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObservePluginAPIDuration(pluginID, apiName string, success bool, elapsed float64) {
	mi.PluginAPITimeHistogram.With(prometheus.Labels{"plugin_id": pluginID, "api_name": apiName, "success": strconv.FormatBool(success)}).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) GetLoggerMetricsCollector() mlog.MetricsCollector {
	return &LoggerMetricsCollector{
		queueGauge:      mi.LoggerQueueGauge,
		loggedCounters:  mi.LoggerLoggedCounters,
		errorCounters:   mi.LoggerErrorCounters,
		droppedCounters: mi.LoggerDroppedCounters,
		blockedCounters: mi.LoggerBlockedCounters,
	}
}

func (mi *MetricsInterfaceImpl) IncrementRemoteClusterMsgSentCounter(remoteID string) {
	mi.RemoteClusterMsgSentCounters.With(prometheus.Labels{"remote_id": remoteID}).Inc()
}

func (mi *MetricsInterfaceImpl) IncrementRemoteClusterMsgReceivedCounter(remoteID string) {
	mi.RemoteClusterMsgReceivedCounters.With(prometheus.Labels{"remote_id": remoteID}).Inc()
}

func (mi *MetricsInterfaceImpl) IncrementRemoteClusterMsgErrorsCounter(remoteID string, timeout bool) {
	mi.RemoteClusterMsgErrorsCounter.With(prometheus.Labels{
		"remote_id": remoteID,
		"timeout":   strconv.FormatBool(timeout),
	}).Inc()
}

func (mi *MetricsInterfaceImpl) ObserveRemoteClusterPingDuration(remoteID string, elapsed float64) {
	mi.RemoteClusterPingTimesHistograms.With(prometheus.Labels{"remote_id": remoteID}).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObserveRemoteClusterClockSkew(remoteID string, skew float64) {
	mi.RemoteClusterClockSkewHistograms.With(prometheus.Labels{"remote_id": remoteID}).Observe(skew)
}

func (mi *MetricsInterfaceImpl) IncrementJobActive(jobType string) {
	mi.JobsActive.With(prometheus.Labels{"type": jobType}).Inc()
}

func (mi *MetricsInterfaceImpl) DecrementJobActive(jobType string) {
	mi.JobsActive.With(prometheus.Labels{"type": jobType}).Dec()
}

func (mi *MetricsInterfaceImpl) IncrementRemoteClusterConnStateChangeCounter(remoteID string, online bool) {
	mi.RemoteClusterConnStateChangeCounter.With(prometheus.Labels{
		"remote_id": remoteID,
		"online":    strconv.FormatBool(online),
	}).Inc()
}

func (mi *MetricsInterfaceImpl) IncrementSharedChannelsSyncCounter(remoteID string) {
	mi.SharedChannelsSyncCount.With(prometheus.Labels{
		"remote_id": remoteID,
	}).Inc()
}

func (mi *MetricsInterfaceImpl) ObserveSharedChannelsTaskInQueueDuration(elapsed float64) {
	mi.SharedChannelsTaskInQueueHistogram.Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObserveSharedChannelsQueueSize(size int64) {
	mi.SharedChannelsQueueSize.Set(float64(size))
}

func (mi *MetricsInterfaceImpl) ObserveSharedChannelsSyncCollectionDuration(remoteID string, elapsed float64) {
	mi.SharedChannelsSyncCollectionHistogram.With(prometheus.Labels{
		"remote_id": remoteID,
	}).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObserveSharedChannelsSyncSendDuration(remoteID string, elapsed float64) {
	mi.SharedChannelsSyncSendHistogram.With(prometheus.Labels{
		"remote_id": remoteID,
	}).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObserveSharedChannelsSyncCollectionStepDuration(remoteID string, step string, elapsed float64) {
	mi.SharedChannelsSyncCollectionStepHistogram.With(prometheus.Labels{
		"remote_id": remoteID,
		"step":      step,
	}).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObserveSharedChannelsSyncSendStepDuration(remoteID string, step string, elapsed float64) {
	mi.SharedChannelsSyncSendStepHistogram.With(prometheus.Labels{
		"remote_id": remoteID,
		"step":      step,
	}).Observe(elapsed)
}

// SetReplicaLagAbsolute sets the absolute replica lag for a given node.
func (mi *MetricsInterfaceImpl) SetReplicaLagAbsolute(node string, value float64) {
	mi.DbReplicaLagGaugeAbs.With(prometheus.Labels{"node": node}).Set(value)
}

// SetReplicaLagTime sets the time-based replica lag for a given node.
func (mi *MetricsInterfaceImpl) SetReplicaLagTime(node string, value float64) {
	mi.DbReplicaLagGaugeTime.With(prometheus.Labels{"node": node}).Set(value)
}

func extractDBCluster(driver, connectionString string) (string, error) {
	host, err := extractHost(driver, connectionString)
	if err != nil {
		return "", err
	}

	clusterEnd := strings.Index(host, ".")
	if clusterEnd == -1 {
		return host, nil
	}

	return host[:clusterEnd], nil
}

func extractHost(driver, connectionString string) (string, error) {
	switch driver {
	case model.DatabaseDriverPostgres:
		parsedURL, err := url.Parse(connectionString)
		if err != nil {
			return "", errors.Wrap(err, "failed to parse postgres connection string")
		}
		return parsedURL.Host, nil
	case model.DatabaseDriverMysql:
		config, err := mysql.ParseDSN(connectionString)
		if err != nil {
			return "", errors.Wrap(err, "failed to parse mysql connection string")
		}
		host := strings.Split(config.Addr, ":")[0]

		return host, nil
	}
	return "", errors.Errorf("unsupported database driver: %q", driver)
}
