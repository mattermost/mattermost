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
	MetricsSubsystemNotifications      = "notifications"
	MetricsSubsystemClientsMobileApp   = "mobileapp"
	MetricsSubsystemClientsWeb         = "webapp"
	MetricsSubsystemClientsDesktopApp  = "desktopapp"
	MetricsSubsystemAccessControl      = "access_control"
	MetricsCloudInstallationLabel      = "installationId"
	MetricsCloudDatabaseClusterLabel   = "databaseClusterName"
	MetricsCloudInstallationGroupLabel = "installationGroupId"
)

type MetricsInterfaceImpl struct {
	Platform *platform.PlatformService

	Registry *prometheus.Registry

	ClientSideUserIds map[string]bool

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
	HTTPWebsocketsGauge *prometheus.GaugeVec

	ClusterRequestsDuration prometheus.Histogram
	ClusterRequestsCounter  prometheus.Counter

	ClusterHealthGauge prometheus.GaugeFunc

	ClusterEventTypeCounters *prometheus.CounterVec
	ClusterEventMap          map[model.ClusterEvent]prometheus.Counter

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
	RedisTimesHistograms       *prometheus.HistogramVec
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

	NotificationTotalCounters       *prometheus.CounterVec
	NotificationAckCounters         *prometheus.CounterVec
	NotificationSuccessCounters     *prometheus.CounterVec
	NotificationErrorCounters       *prometheus.CounterVec
	NotificationNotSentCounters     *prometheus.CounterVec
	NotificationUnsupportedCounters *prometheus.CounterVec

	ClientTimeToFirstByte           *HistogramVec
	ClientTimeToLastByte            *HistogramVec
	ClientTimeToDOMInteractive      *HistogramVec
	ClientSplashScreenEnd           *HistogramVec
	ClientFirstContentfulPaint      *prometheus.HistogramVec
	ClientLargestContentfulPaint    *prometheus.HistogramVec
	ClientInteractionToNextPaint    *prometheus.HistogramVec
	ClientCumulativeLayoutShift     *prometheus.HistogramVec
	ClientLongTasks                 *prometheus.CounterVec
	ClientPageLoadDuration          *HistogramVec
	ClientChannelSwitchDuration     *prometheus.HistogramVec
	ClientTeamSwitchDuration        *prometheus.HistogramVec
	ClientRHSLoadDuration           *prometheus.HistogramVec
	ClientGlobalThreadsLoadDuration *prometheus.HistogramVec

	MobileClientLoadDuration                           *prometheus.HistogramVec
	MobileClientChannelSwitchDuration                  *prometheus.HistogramVec
	MobileClientTeamSwitchDuration                     *prometheus.HistogramVec
	MobileClientSessionMetadataGauge                   *prometheus.GaugeVec
	MobileClientNetworkRequestsTotalCompressedSize     *prometheus.HistogramVec
	MobileClientNetworkRequestsTotalRequests           *prometheus.HistogramVec
	MobileClientNetworkRequestsTotalParallelRequests   *prometheus.HistogramVec
	MobileClientNetworkRequestsTotalSequentialRequests *prometheus.HistogramVec
	MobileClientNetworkRequestsLatency                 *prometheus.HistogramVec
	MobileClientNetworkRequestsTotalSize               *prometheus.HistogramVec
	MobileClientNetworkRequestsElapsedTime             *prometheus.HistogramVec
	MobileClientNetworkRequestsAverageSpeed            *prometheus.HistogramVec
	MobileClientNetworkRequestsEffectiveLatency        *prometheus.HistogramVec

	DesktopClientCPUUsage    *prometheus.HistogramVec
	DesktopClientMemoryUsage *prometheus.HistogramVec

	AccessControlExpressionCompileDuration prometheus.Histogram
	AccessControlEvaluateDuration          prometheus.Histogram
	AccessControlSearchQueryDuration       prometheus.Histogram
	AccessControlCacheInvalidation         prometheus.Counter
}

func init() {
	platform.RegisterMetricsInterface(func(ps *platform.PlatformService, driver, dataSource string) einterfaces.MetricsInterface {
		return New(ps, driver, dataSource)
	})
}

// New creates a new MetricsInterface. The driver and datasource parameters are added during
// migrating configuration store to the new platform service. Once the store and license are migrated,
// we will be able to remove server dependency and lean on platform service during initialization.
func New(ps *platform.PlatformService, driver, dataSource string) *MetricsInterfaceImpl {
	m := &MetricsInterfaceImpl{
		Platform: ps,
	}

	// Initialize ClientSideUserIds map
	m.ClientSideUserIds = make(map[string]bool)
	for _, userId := range ps.Config().MetricsSettings.ClientSideUserIds {
		m.ClientSideUserIds[userId] = true
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

	// Helper function to apply additional labels to histogram options
	withLabels := func(opts prometheus.HistogramOpts) prometheus.HistogramOpts {
		opts.ConstLabels = additionalLabels
		return opts
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

	m.HTTPWebsocketsGauge = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemHTTP,
		Name:        "websockets_total",
		Help:        "The total number of websocket connections to this server.",
		ConstLabels: additionalLabels,
	}, []string{"origin_client"})
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

	m.ClusterRequestsDuration = prometheus.NewHistogram(withLabels(prometheus.HistogramOpts{
		Namespace: MetricsNamespace,
		Subsystem: MetricsSubsystemCluster,
		Name:      "cluster_request_duration_seconds",
		Help:      "The total duration in seconds of the inter-node cluster requests.",
	}))
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
	m.ClusterEventMap = make(map[model.ClusterEvent]prometheus.Counter)
	for _, event := range []model.ClusterEvent{
		// Note: Keep this list in sync with the events in model/cluster_message.go.
		model.ClusterEventPublish,
		model.ClusterEventUpdateStatus,
		model.ClusterEventInvalidateAllCaches,
		model.ClusterEventInvalidateCacheForReactions,
		model.ClusterEventInvalidateCacheForChannelMembersNotifyProps,
		model.ClusterEventInvalidateCacheForChannelByName,
		model.ClusterEventInvalidateCacheForChannel,
		model.ClusterEventInvalidateCacheForChannelGuestCount,
		model.ClusterEventInvalidateCacheForUser,
		model.ClusterEventInvalidateWebConnCacheForUser,
		model.ClusterEventClearSessionCacheForUser,
		model.ClusterEventInvalidateCacheForRoles,
		model.ClusterEventInvalidateCacheForRolePermissions,
		model.ClusterEventInvalidateCacheForProfileByIds,
		model.ClusterEventInvalidateCacheForAllProfiles,
		model.ClusterEventInvalidateCacheForProfileInChannel,
		model.ClusterEventInvalidateCacheForSchemes,
		model.ClusterEventInvalidateCacheForFileInfos,
		model.ClusterEventInvalidateCacheForWebhooks,
		model.ClusterEventInvalidateCacheForEmojisById,
		model.ClusterEventInvalidateCacheForEmojisIdByName,
		model.ClusterEventInvalidateCacheForChannelFileCount,
		model.ClusterEventInvalidateCacheForChannelPinnedpostsCounts,
		model.ClusterEventInvalidateCacheForChannelMemberCounts,
		model.ClusterEventInvalidateCacheForChannelsMemberCount,
		model.ClusterEventInvalidateCacheForLastPosts,
		model.ClusterEventInvalidateCacheForLastPostTime,
		model.ClusterEventInvalidateCacheForPostsUsage,
		model.ClusterEventInvalidateCacheForTeams,
		model.ClusterEventClearSessionCacheForAllUsers,
		model.ClusterEventInstallPlugin,
		model.ClusterEventRemovePlugin,
		model.ClusterEventPluginEvent,
		model.ClusterEventInvalidateCacheForTermsOfService,
		model.ClusterEventBusyStateChanged,
	} {
		m.ClusterEventMap[event] = m.ClusterEventTypeCounters.With(prometheus.Labels{"name": string(event)})
	}
	m.ClusterEventMap[model.ClusterEvent("other")] = m.ClusterEventTypeCounters.With(prometheus.Labels{"name": "other"})

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

	m.SearchPostSearchesDuration = prometheus.NewHistogram(withLabels(prometheus.HistogramOpts{
		Namespace: MetricsNamespace,
		Subsystem: MetricsSubsystemSearch,
		Name:      "posts_searches_duration_seconds",
		Help:      "The total duration in seconds of post searches.",
	}))
	m.Registry.MustRegister(m.SearchPostSearchesDuration)

	m.SearchFileSearchesCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemSearch,
		Name:        "files_searches_total",
		Help:        "The total number of file searches carried out.",
		ConstLabels: additionalLabels,
	})
	m.Registry.MustRegister(m.SearchFileSearchesCounter)

	m.SearchFileSearchesDuration = prometheus.NewHistogram(withLabels(prometheus.HistogramOpts{
		Namespace: MetricsNamespace,
		Subsystem: MetricsSubsystemSearch,
		Name:      "files_searches_duration_seconds",
		Help:      "The total duration in seconds of file searches.",
	}))
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
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemDB,
			Name:      "store_time",
			Help:      "Time to execute the store method",
		}),
		[]string{"method", "success"},
	)
	m.Registry.MustRegister(m.StoreTimesHistograms)

	m.APITimesHistograms = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemAPI,
			Name:      "time",
			Help:      "Time to execute the api handler",
		}),
		[]string{"handler", "method", "status_code", "origin_client", "page_load_context"},
	)
	m.Registry.MustRegister(m.APITimesHistograms)

	m.RedisTimesHistograms = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemDB,
			Name:      "cache_time",
			Help:      "Time to execute the cache handler",
		}),
		[]string{"cache_name", "operation"},
	)
	m.Registry.MustRegister(m.RedisTimesHistograms)

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
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemPlugin,
			Name:      "hook_time",
			Help:      "Time to execute plugin hook handler in seconds.",
		}),
		[]string{"plugin_id", "hook_name", "success"},
	)
	m.Registry.MustRegister(m.PluginHookTimeHistogram)

	m.PluginMultiHookTimeHistogram = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemPlugin,
			Name:      "multi_hook_time",
			Help:      "Time to execute multiple plugin hook handler in seconds.",
		}),
		[]string{"plugin_id"},
	)
	m.Registry.MustRegister(m.PluginMultiHookTimeHistogram)

	m.PluginMultiHookServerTimeHistogram = prometheus.NewHistogram(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemPlugin,
			Name:      "multi_hook_server_time",
			Help:      "Time for the server to execute multiple plugin hook handlers in seconds.",
		}),
	)
	m.Registry.MustRegister(m.PluginMultiHookServerTimeHistogram)

	m.PluginAPITimeHistogram = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemPlugin,
			Name:      "api_time",
			Help:      "Time to execute plugin API handlers in seconds.",
		}),
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
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemRemoteCluster,
			Name:      "ping_time",
			Help:      "The ping roundtrip times to the remote cluster",
		}),
		[]string{"remote_id"},
	)
	m.Registry.MustRegister(m.RemoteClusterPingTimesHistograms)

	m.RemoteClusterClockSkewHistograms = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemRemoteCluster,
			Name:      "clock_skew",
			Help:      "An approximated value for clock skew between clusters",
		}),
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
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemSharedChannels,
			Name:      "task_in_queue_duration_seconds",
			Help:      "Duration tasks spend in queue (seconds)",
		}),
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
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemSharedChannels,
			Name:      "sync_collection_duration_seconds",
			Help:      "Duration tasks spend collecting sync data (seconds)",
		}),
		[]string{"remote_id"},
	)
	m.Registry.MustRegister(m.SharedChannelsSyncCollectionHistogram)

	m.SharedChannelsSyncSendHistogram = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemSharedChannels,
			Name:      "sync_send_duration_seconds",
			Help:      "Duration tasks spend sending sync data (seconds)",
		}),
		[]string{"remote_id"},
	)
	m.Registry.MustRegister(m.SharedChannelsSyncSendHistogram)

	m.SharedChannelsSyncCollectionStepHistogram = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemSharedChannels,
			Name:      "sync_collection_step_duration_seconds",
			Help:      "Duration tasks spend in each step collecting data (seconds)",
		}),
		[]string{"remote_id", "step"},
	)
	m.Registry.MustRegister(m.SharedChannelsSyncCollectionStepHistogram)

	m.SharedChannelsSyncSendStepHistogram = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemSharedChannels,
			Name:      "sync_send_step_duration_seconds",
			Help:      "Duration tasks spend in each step sending data (seconds)",
		}),
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

	m.NotificationTotalCounters = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemNotifications,
			Name:        "total",
			Help:        "Total number of notification events",
			ConstLabels: additionalLabels,
		},
		[]string{"type", "platform"},
	)
	m.Registry.MustRegister(m.NotificationTotalCounters)

	m.NotificationAckCounters = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemNotifications,
			Name:        "total_ack",
			Help:        "Total number of notification events acknowledged",
			ConstLabels: additionalLabels,
		},
		[]string{"type", "platform"},
	)
	m.Registry.MustRegister(m.NotificationAckCounters)

	m.NotificationSuccessCounters = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemNotifications,
			Name:        "success",
			Help:        "Total number of successfully sent notifications",
			ConstLabels: additionalLabels,
		},
		[]string{"type", "platform"},
	)
	m.Registry.MustRegister(m.NotificationSuccessCounters)

	m.NotificationErrorCounters = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemNotifications,
			Name:        "error",
			Help:        "Total number of errors that stop the notification flow",
			ConstLabels: additionalLabels,
		},
		[]string{"type", "reason", "platform"},
	)
	m.Registry.MustRegister(m.NotificationErrorCounters)

	m.NotificationNotSentCounters = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemNotifications,
			Name:        "not_sent",
			Help:        "Total number of notifications the system deliberately did not send",
			ConstLabels: additionalLabels,
		},
		[]string{"type", "reason", "platform"},
	)
	m.Registry.MustRegister(m.NotificationNotSentCounters)

	m.NotificationUnsupportedCounters = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemNotifications,
			Name:        "unsupported",
			Help:        "Total number of untrackable notifications due to an unsupported app version",
			ConstLabels: additionalLabels,
		},
		[]string{"type", "reason", "platform"},
	)
	m.Registry.MustRegister(m.NotificationUnsupportedCounters)

	m.ClientTimeToFirstByte = NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsWeb,
			Name:      "time_to_first_byte",
			Help:      "Duration from when a browser starts to request a page from a server until when it starts to receive data in response (seconds)",
		}),
		[]string{"platform", "agent", "user_id"},
		m.Platform.Log(),
	)
	m.Registry.MustRegister(m.ClientTimeToFirstByte)

	m.ClientTimeToLastByte = NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsWeb,
			Name:      "time_to_last_byte",
			Help:      "Duration from when a browser starts to request a page from a server until when it receives the last byte of the resource or immediately before the transport connection is closed, whichever comes first. (seconds)",
		}),
		[]string{"platform", "agent", "user_id"},
		m.Platform.Log(),
	)
	m.Registry.MustRegister(m.ClientTimeToLastByte)

	m.ClientTimeToDOMInteractive = NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsWeb,
			Name:      "dom_interactive",
			Help:      "Duration from when a browser starts to request a page from a server until when it sets the document's readyState to interactive. (seconds)",
			Buckets:   []float64{.1, .25, .5, 1, 2.5, 5, 7.5, 10, 12.5, 15},
		}),
		[]string{"platform", "agent", "user_id"},
		m.Platform.Log(),
	)
	m.Registry.MustRegister(m.ClientTimeToDOMInteractive)

	m.ClientSplashScreenEnd = NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsWeb,
			Name:      "splash_screen",
			Help:      "Duration from when a browser starts to request a page from a server until when the splash screen ends. (seconds)",
			Buckets:   []float64{.1, .25, .5, 1, 2.5, 5, 7.5, 10, 12.5, 15},
		}),
		[]string{"platform", "agent", "page_type", "user_id"},
		m.Platform.Log(),
	)
	m.Registry.MustRegister(m.ClientSplashScreenEnd)

	m.ClientFirstContentfulPaint = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsWeb,
			Name:      "first_contentful_paint",
			Help:      "Duration of how long it takes for any content to be displayed on screen to a user (seconds)",

			// Extend the range of buckets for this while we get a better idea of the expected range of this metric is
			Buckets: []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 15, 20},
		}),
		[]string{"platform", "agent", "user_id"},
	)
	m.Registry.MustRegister(m.ClientFirstContentfulPaint)

	m.ClientLargestContentfulPaint = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsWeb,
			Name:      "largest_contentful_paint",
			Help:      "Duration of how long it takes for large content to be displayed on screen to a user (seconds)",

			// Extend the range of buckets for this while we get a better idea of the expected range of this metric is
			Buckets: []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 15, 20},
		}),
		[]string{"platform", "agent", "region", "user_id"},
	)
	m.Registry.MustRegister(m.ClientLargestContentfulPaint)

	m.ClientInteractionToNextPaint = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsWeb,
			Name:      "interaction_to_next_paint",
			Help:      "Measure of how long it takes for a user to see the effects of clicking with a mouse, tapping with a touchscreen, or pressing a key on the keyboard (seconds)",
		}),
		[]string{"platform", "agent", "interaction", "user_id"},
	)
	m.Registry.MustRegister(m.ClientInteractionToNextPaint)

	m.ClientCumulativeLayoutShift = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsWeb,
			Name:      "cumulative_layout_shift",
			Help:      "Measure of how much a page's content shifts unexpectedly",
		}),
		[]string{"platform", "agent", "user_id"},
	)
	m.Registry.MustRegister(m.ClientCumulativeLayoutShift)

	m.ClientLongTasks = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemClientsWeb,
			Name:        "long_tasks",
			Help:        "Counter of the number of times that the browser's main UI thread is blocked for more than 50ms by a single task",
			ConstLabels: additionalLabels,
		},
		[]string{"platform", "agent", "user_id"},
	)
	m.Registry.MustRegister(m.ClientLongTasks)

	m.ClientPageLoadDuration = NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsWeb,
			Name:      "page_load",
			Help:      "The amount of time from when the browser starts loading the web app until when the web app's load event has finished (seconds)",
			Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 20, 40},
		}),
		[]string{"platform", "agent", "user_id"},
		m.Platform.Log(),
	)
	m.Registry.MustRegister(m.ClientPageLoadDuration)

	m.ClientChannelSwitchDuration = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsWeb,
			Name:      "channel_switch",
			Help:      "Duration of the time taken from when a user clicks on a channel in the LHS to when posts in that channel become visible (seconds)",
		}),
		[]string{"platform", "agent", "fresh", "user_id"},
	)
	m.Registry.MustRegister(m.ClientChannelSwitchDuration)

	m.ClientTeamSwitchDuration = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsWeb,
			Name:      "team_switch",
			Help:      "Duration of the time taken from when a user clicks on a team in the LHS to when posts in that team become visible (seconds)",
		}),
		[]string{"platform", "agent", "fresh", "user_id"},
	)
	m.Registry.MustRegister(m.ClientTeamSwitchDuration)

	m.ClientRHSLoadDuration = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsWeb,
			Name:      "rhs_load",
			Help:      "Duration of the time taken from when a user clicks to open a thread in the RHS until when posts in that thread become visible (seconds)",
		}),
		[]string{"platform", "agent", "user_id"},
	)
	m.Registry.MustRegister(m.ClientRHSLoadDuration)

	m.ClientGlobalThreadsLoadDuration = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsWeb,
			Name:      "global_threads_load",
			Help:      "Duration of the time taken from when a user clicks to open Threads in the LHS until when the global threads view becomes visible (milliseconds)",
		}),
		[]string{"platform", "agent", "user_id"},
	)
	m.Registry.MustRegister(m.ClientGlobalThreadsLoadDuration)

	m.MobileClientLoadDuration = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsMobileApp,
			Name:      "mobile_load",
			Help:      "Duration of the time taken from when a user opens the app and the app finally loads all relevant information (seconds)",
			Buckets:   []float64{1, 1.5, 2, 3, 4, 4.5, 5, 5.5, 6, 7.5, 10, 20, 25, 30},
		}),
		[]string{"platform"},
	)

	m.MobileClientNetworkRequestsAverageSpeed = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsMobileApp,
			Name:      "mobile_network_requests_average_speed",
			Help:      "Average speed of network requests in megabytes per second (MBps)",
			Buckets:   []float64{1000, 10000, 50000, 100000, 500000, 1000000, 5000000},
		}),
		[]string{"platform", "agent", "network_request_group"},
	)

	m.MobileClientNetworkRequestsEffectiveLatency = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsMobileApp,
			Name:      "mobile_network_requests_effective_latency",
			Help:      "Effective latency of network requests in seconds",
			Buckets:   []float64{0.1, 0.25, 0.5, 1, 2.5, 5, 10},
		}),
		[]string{"platform", "agent", "network_request_group"},
	)

	m.MobileClientNetworkRequestsElapsedTime = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsMobileApp,
			Name:      "mobile_network_requests_elapsed_time",
			Help:      "Total elapsed time of network requests in seconds",
			Buckets:   []float64{0.1, 0.25, 0.5, 1, 2.5, 5, 10},
		}),
		[]string{"platform", "agent", "network_request_group"},
	)

	m.MobileClientNetworkRequestsLatency = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsMobileApp,
			Name:      "mobile_network_requests_latency",
			Help:      "Latency of network requests in seconds",
			Buckets:   []float64{0.1, 0.25, 0.5, 1, 2.5, 5, 10},
		}),
		[]string{"platform", "agent", "network_request_group"},
	)

	m.MobileClientNetworkRequestsTotalCompressedSize = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsMobileApp,
			Name:      "mobile_network_requests_total_compressed_size",
			Help:      "Total compressed size of network requests in bytes",
			Buckets:   []float64{0.1, 0.5, 1, 2, 5, 10, 20, 50},
		}),
		[]string{"platform", "agent", "network_request_group"},
	)

	m.MobileClientNetworkRequestsTotalParallelRequests = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsMobileApp,
			Name:      "mobile_network_requests_total_parallel_requests",
			Help:      "Total number of parallel network requests made",
			Buckets:   []float64{1, 2, 5, 10, 20, 50, 100},
		}),
		[]string{"platform", "agent", "network_request_group"},
	)

	m.MobileClientNetworkRequestsTotalRequests = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsMobileApp,
			Name:      "mobile_network_requests_total_requests",
			Help:      "Total number of network requests made",
			Buckets:   []float64{1, 2, 5, 10, 20, 50, 100},
		}),
		[]string{"platform", "agent", "network_request_group"},
	)

	m.MobileClientNetworkRequestsTotalSequentialRequests = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsMobileApp,
			Name:      "mobile_network_requests_total_sequential_requests",
			Help:      "Total number of sequential network requests made",
			Buckets:   []float64{1, 2, 5, 10, 20, 50, 100},
		}),
		[]string{"platform", "agent", "network_request_group"},
	)

	m.MobileClientNetworkRequestsTotalSize = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsMobileApp,
			Name:      "mobile_network_requests_total_size",
			Help:      "Total uncompressed size of network requests in bytes",
			Buckets:   []float64{1000, 10000, 50000, 100000, 500000, 1000000, 5000000},
		}),
		[]string{"platform", "agent", "network_request_group"},
	)

	m.Registry.MustRegister(m.MobileClientLoadDuration)
	m.Registry.MustRegister(m.MobileClientNetworkRequestsAverageSpeed)
	m.Registry.MustRegister(m.MobileClientNetworkRequestsEffectiveLatency)
	m.Registry.MustRegister(m.MobileClientNetworkRequestsElapsedTime)
	m.Registry.MustRegister(m.MobileClientNetworkRequestsLatency)
	m.Registry.MustRegister(m.MobileClientNetworkRequestsTotalCompressedSize)
	m.Registry.MustRegister(m.MobileClientNetworkRequestsTotalParallelRequests)
	m.Registry.MustRegister(m.MobileClientNetworkRequestsTotalRequests)
	m.Registry.MustRegister(m.MobileClientNetworkRequestsTotalSequentialRequests)
	m.Registry.MustRegister(m.MobileClientNetworkRequestsTotalSize)

	m.MobileClientChannelSwitchDuration = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsMobileApp,
			Name:      "mobile_channel_switch",
			Help:      "Duration of the time taken from when a user clicks on a channel name, and the full channel sreen is loaded (seconds)",
			Buckets:   []float64{0.150, 0.200, 0.300, 0.400, 0.450, 0.500, 0.550, 0.600, 0.750, 1, 2, 3},
		}),
		[]string{"platform"},
	)
	m.Registry.MustRegister(m.MobileClientChannelSwitchDuration)

	m.MobileClientTeamSwitchDuration = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsMobileApp,
			Name:      "mobile_team_switch",
			Help:      "Duration of the time taken from when a user clicks on a team, and the full categories screen is loaded (seconds)",
			Buckets:   []float64{0.150, 0.200, 0.250, 0.300, 0.350, 0.400, 0.500, 0.750, 1, 2, 3},
		}),
		[]string{"platform"},
	)
	m.Registry.MustRegister(m.MobileClientTeamSwitchDuration)

	m.MobileClientSessionMetadataGauge = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemClientsMobileApp,
			Name:        "mobile_session_metadata",
			Help:        "The number of mobile sessions in each version, platform and whether they have the notifications disabled",
			ConstLabels: additionalLabels,
		},
		[]string{"version", "platform", "notifications_disabled"},
	)
	m.Registry.MustRegister(m.MobileClientSessionMetadataGauge)

	m.DesktopClientCPUUsage = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsDesktopApp,
			Name:      "cpu_usage",
			Help:      "Average CPU usage of a specific process over an interval",
			Buckets:   []float64{0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 80, 100},
		}),
		[]string{"platform", "version", "processName"},
	)
	m.Registry.MustRegister(m.DesktopClientCPUUsage)

	m.DesktopClientMemoryUsage = prometheus.NewHistogramVec(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemClientsDesktopApp,
			Name:      "memory_usage",
			Help:      "Memory usage in MB of a specific process",
			Buckets:   []float64{0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 3000, 5000},
		}),
		[]string{"platform", "version", "processName"},
	)
	m.Registry.MustRegister(m.DesktopClientMemoryUsage)

	m.AccessControlSearchQueryDuration = prometheus.NewHistogram(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemAccessControl,
			Name:      "search_query_duration_seconds",
			Help:      "Duration of the time taken to query users against an expression (seconds)",
		}))
	m.Registry.MustRegister(m.AccessControlSearchQueryDuration)

	m.AccessControlEvaluateDuration = prometheus.NewHistogram(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemAccessControl,
			Name:      "evaluate_duration_seconds",
			Help:      "Duration of the time taken to evaluate the access control engine (seconds)",
		}))
	m.Registry.MustRegister(m.AccessControlEvaluateDuration)

	m.AccessControlExpressionCompileDuration = prometheus.NewHistogram(
		withLabels(prometheus.HistogramOpts{
			Namespace: MetricsNamespace,
			Subsystem: MetricsSubsystemAccessControl,
			Name:      "expression_compile_duration_seconds",
			Help:      "Duration of the time taken to compile the access control engine expression (seconds)",
		}))
	m.Registry.MustRegister(m.AccessControlExpressionCompileDuration)

	m.AccessControlCacheInvalidation = prometheus.NewCounter(
		prometheus.CounterOpts{
			Namespace:   MetricsNamespace,
			Subsystem:   MetricsSubsystemAccessControl,
			Name:        "cache_invalidation_total",
			Help:        "Total number of cache invalidations",
			ConstLabels: additionalLabels,
		})
	m.Registry.MustRegister(m.AccessControlCacheInvalidation)

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

func (mi *MetricsInterfaceImpl) ObserveRedisEndpointDuration(cacheName, operation string, elapsed float64) {
	mi.RedisTimesHistograms.With(prometheus.Labels{
		"cache_name": cacheName,
		"operation":  operation,
	}).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) IncrementClusterEventType(eventType model.ClusterEvent) {
	if event, ok := mi.ClusterEventMap[eventType]; ok {
		event.Inc()
		return
	}
	mi.ClusterEventMap[model.ClusterEvent("other")].Inc()
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

func normalizeNotificationPlatform(platform string) string {
	switch platform {
	case "apple_rn-v2", "apple_rnbeta-v2", "ios":
		return "ios"
	case "android_rn-v2", "android":
		return "android"
	case model.NotificationNoPlatform:
		return model.NotificationNoPlatform
	default:
		return "unknown"
	}
}

func (mi *MetricsInterfaceImpl) IncrementNotificationCounter(notificationType model.NotificationType, platform string) {
	mi.NotificationTotalCounters.With(prometheus.Labels{"type": string(notificationType), "platform": normalizeNotificationPlatform(platform)}).Inc()
}

func (mi *MetricsInterfaceImpl) IncrementNotificationAckCounter(notificationType model.NotificationType, platform string) {
	mi.NotificationAckCounters.With(prometheus.Labels{"type": string(notificationType), "platform": normalizeNotificationPlatform(platform)}).Inc()
}

func (mi *MetricsInterfaceImpl) IncrementNotificationSuccessCounter(notificationType model.NotificationType, platform string) {
	mi.NotificationSuccessCounters.With(prometheus.Labels{"type": string(notificationType), "platform": normalizeNotificationPlatform(platform)}).Inc()
}

func (mi *MetricsInterfaceImpl) IncrementNotificationErrorCounter(notificationType model.NotificationType, errorReason model.NotificationReason, platform string) {
	mi.NotificationErrorCounters.With(prometheus.Labels{"type": string(notificationType), "reason": string(errorReason), "platform": normalizeNotificationPlatform(platform)}).Inc()
}

func (mi *MetricsInterfaceImpl) IncrementNotificationNotSentCounter(notificationType model.NotificationType, notSentReason model.NotificationReason, platform string) {
	mi.NotificationNotSentCounters.With(prometheus.Labels{"type": string(notificationType), "reason": string(notSentReason), "platform": normalizeNotificationPlatform(platform)}).Inc()
}

func (mi *MetricsInterfaceImpl) IncrementNotificationUnsupportedCounter(notificationType model.NotificationType, notSentReason model.NotificationReason, platform string) {
	mi.NotificationUnsupportedCounters.With(prometheus.Labels{"type": string(notificationType), "reason": string(notSentReason), "platform": normalizeNotificationPlatform(platform)}).Inc()
}

func (mi *MetricsInterfaceImpl) IncrementHTTPWebSockets(originClient string) {
	mi.HTTPWebsocketsGauge.With(prometheus.Labels{"origin_client": originClient}).Inc()
}

func (mi *MetricsInterfaceImpl) DecrementHTTPWebSockets(originClient string) {
	mi.HTTPWebsocketsGauge.With(prometheus.Labels{"origin_client": originClient}).Dec()
}

func (mi *MetricsInterfaceImpl) getEffectiveUserID(userID string) string {
	if mi.ClientSideUserIds[userID] {
		return userID
	}
	return "<placeholder>"
}

func (mi *MetricsInterfaceImpl) ObserveClientTimeToFirstByte(platform, agent, userID string, elapsed float64) {
	effectiveUserID := mi.getEffectiveUserID(userID)
	mi.ClientTimeToFirstByte.With(prometheus.Labels{"platform": platform, "agent": agent, "user_id": effectiveUserID}, userID).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObserveClientTimeToLastByte(platform, agent, userID string, elapsed float64) {
	effectiveUserID := mi.getEffectiveUserID(userID)
	mi.ClientTimeToLastByte.With(prometheus.Labels{"platform": platform, "agent": agent, "user_id": effectiveUserID}, userID).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObserveClientTimeToDomInteractive(platform, agent, userID string, elapsed float64) {
	effectiveUserID := mi.getEffectiveUserID(userID)
	mi.ClientTimeToDOMInteractive.With(prometheus.Labels{"platform": platform, "agent": agent, "user_id": effectiveUserID}, userID).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObserveClientSplashScreenEnd(platform, agent, pageType, userID string, elapsed float64) {
	effectiveUserID := mi.getEffectiveUserID(userID)
	mi.ClientSplashScreenEnd.With(prometheus.Labels{"platform": platform, "agent": agent, "page_type": pageType, "user_id": effectiveUserID}, userID).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObserveClientFirstContentfulPaint(platform, agent, userID string, elapsed float64) {
	effectiveUserID := mi.getEffectiveUserID(userID)
	mi.ClientFirstContentfulPaint.With(prometheus.Labels{"platform": platform, "agent": agent, "user_id": effectiveUserID}).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObserveClientLargestContentfulPaint(platform, agent, region, userID string, elapsed float64) {
	effectiveUserID := mi.getEffectiveUserID(userID)
	mi.ClientLargestContentfulPaint.With(prometheus.Labels{"platform": platform, "agent": agent, "region": region, "user_id": effectiveUserID}).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObserveClientInteractionToNextPaint(platform, agent, interaction, userID string, elapsed float64) {
	effectiveUserID := mi.getEffectiveUserID(userID)
	mi.ClientInteractionToNextPaint.With(prometheus.Labels{"platform": platform, "agent": agent, "interaction": interaction, "user_id": effectiveUserID}).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObserveClientCumulativeLayoutShift(platform, agent, userID string, elapsed float64) {
	effectiveUserID := mi.getEffectiveUserID(userID)
	mi.ClientCumulativeLayoutShift.With(prometheus.Labels{"platform": platform, "agent": agent, "user_id": effectiveUserID}).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) IncrementClientLongTasks(platform, agent, userID string, inc float64) {
	effectiveUserID := mi.getEffectiveUserID(userID)
	mi.ClientLongTasks.With(prometheus.Labels{"platform": platform, "agent": agent, "user_id": effectiveUserID}).Add(inc)
}

func (mi *MetricsInterfaceImpl) ObserveClientPageLoadDuration(platform, agent, userID string, elapsed float64) {
	effectiveUserID := mi.getEffectiveUserID(userID)
	mi.ClientPageLoadDuration.With(prometheus.Labels{"platform": platform, "agent": agent, "user_id": effectiveUserID}, userID).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObserveClientChannelSwitchDuration(platform, agent, fresh, userID string, elapsed float64) {
	effectiveUserID := mi.getEffectiveUserID(userID)
	mi.ClientChannelSwitchDuration.With(prometheus.Labels{"platform": platform, "agent": agent, "fresh": fresh, "user_id": effectiveUserID}).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObserveClientTeamSwitchDuration(platform, agent, fresh, userID string, elapsed float64) {
	effectiveUserID := mi.getEffectiveUserID(userID)
	mi.ClientTeamSwitchDuration.With(prometheus.Labels{"platform": platform, "agent": agent, "fresh": fresh, "user_id": effectiveUserID}).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObserveClientRHSLoadDuration(platform, agent, userID string, elapsed float64) {
	effectiveUserID := mi.getEffectiveUserID(userID)
	mi.ClientRHSLoadDuration.With(prometheus.Labels{"platform": platform, "agent": agent, "user_id": effectiveUserID}).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObserveGlobalThreadsLoadDuration(platform, agent, userID string, elapsed float64) {
	effectiveUserID := mi.getEffectiveUserID(userID)
	mi.ClientGlobalThreadsLoadDuration.With(prometheus.Labels{"platform": platform, "agent": agent, "user_id": effectiveUserID}).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObserveDesktopCpuUsage(platform, version, process string, usage float64) {
	mi.DesktopClientCPUUsage.With(prometheus.Labels{"platform": platform, "version": version, "processName": process}).Observe(usage)
}

func (mi *MetricsInterfaceImpl) ObserveDesktopMemoryUsage(platform, version, process string, usage float64) {
	mi.DesktopClientMemoryUsage.With(prometheus.Labels{"platform": platform, "version": version, "processName": process}).Observe(usage)
}

func (mi *MetricsInterfaceImpl) ObserveMobileClientLoadDuration(platform string, elapsed float64) {
	mi.MobileClientLoadDuration.With(prometheus.Labels{"platform": platform}).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObserveMobileClientChannelSwitchDuration(platform string, elapsed float64) {
	mi.MobileClientChannelSwitchDuration.With(prometheus.Labels{"platform": platform}).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObserveMobileClientTeamSwitchDuration(platform string, elapsed float64) {
	mi.MobileClientTeamSwitchDuration.With(prometheus.Labels{"platform": platform}).Observe(elapsed)
}

func (mi *MetricsInterfaceImpl) ObserveMobileClientNetworkRequestsTotalCompressedSize(platform, agent, networkRequestGroup string, size float64) {
	mi.MobileClientNetworkRequestsTotalCompressedSize.With(prometheus.Labels{"platform": platform, "agent": agent, "network_request_group": networkRequestGroup}).Observe(size)
}

func (mi *MetricsInterfaceImpl) ObserveMobileClientNetworkRequestsTotalRequests(platform, agent, networkRequestGroup string, count float64) {
	mi.MobileClientNetworkRequestsTotalRequests.With(prometheus.Labels{"platform": platform, "agent": agent, "network_request_group": networkRequestGroup}).Observe(count)
}

func (mi *MetricsInterfaceImpl) ObserveMobileClientNetworkRequestsTotalParallelRequests(platform, agent, networkRequestGroup string, count float64) {
	mi.MobileClientNetworkRequestsTotalParallelRequests.With(prometheus.Labels{"platform": platform, "agent": agent, "network_request_group": networkRequestGroup}).Observe(count)
}

func (mi *MetricsInterfaceImpl) ObserveMobileClientNetworkRequestsTotalSequentialRequests(platform, agent, networkRequestGroup string, count float64) {
	mi.MobileClientNetworkRequestsTotalSequentialRequests.With(prometheus.Labels{"platform": platform, "agent": agent, "network_request_group": networkRequestGroup}).Observe(count)
}

func (mi *MetricsInterfaceImpl) ObserveMobileClientNetworkRequestsLatency(platform, agent, networkRequestGroup string, latency float64) {
	mi.MobileClientNetworkRequestsLatency.With(prometheus.Labels{"platform": platform, "agent": agent, "network_request_group": networkRequestGroup}).Observe(latency)
}

func (mi *MetricsInterfaceImpl) ObserveMobileClientNetworkRequestsTotalSize(platform, agent, networkRequestGroup string, size float64) {
	mi.MobileClientNetworkRequestsTotalSize.With(prometheus.Labels{"platform": platform, "agent": agent, "network_request_group": networkRequestGroup}).Observe(size)
}

func (mi *MetricsInterfaceImpl) ObserveMobileClientNetworkRequestsElapsedTime(platform, agent, networkRequestGroup string, elapsedTime float64) {
	mi.MobileClientNetworkRequestsElapsedTime.With(prometheus.Labels{"platform": platform, "agent": agent, "network_request_group": networkRequestGroup}).Observe(elapsedTime)
}

func (mi *MetricsInterfaceImpl) ObserveMobileClientNetworkRequestsAverageSpeed(platform, agent, networkRequestGroup string, speed float64) {
	mi.MobileClientNetworkRequestsAverageSpeed.With(prometheus.Labels{"platform": platform, "agent": agent, "network_request_group": networkRequestGroup}).Observe(speed)
}

func (mi *MetricsInterfaceImpl) ObserveMobileClientNetworkRequestsEffectiveLatency(platform, agent, networkRequestGroup string, latency float64) {
	mi.MobileClientNetworkRequestsEffectiveLatency.With(prometheus.Labels{"platform": platform, "agent": agent, "network_request_group": networkRequestGroup}).Observe(latency)
}

func (mi *MetricsInterfaceImpl) ObserveMobileClientSessionMetadata(version, platform string, value float64, notificationDisabled string) {
	mi.MobileClientSessionMetadataGauge.With(prometheus.Labels{"version": version, "platform": platform, "notifications_disabled": notificationDisabled}).Set(value)
}

func (mi *MetricsInterfaceImpl) ObserveAccessControlSearchQueryDuration(value float64) {
	mi.AccessControlSearchQueryDuration.Observe(value)
}

func (mi *MetricsInterfaceImpl) ObserveAccessControlExpressionCompileDuration(value float64) {
	mi.AccessControlExpressionCompileDuration.Observe(value)
}

func (mi *MetricsInterfaceImpl) ObserveAccessControlEvaluateDuration(value float64) {
	mi.AccessControlEvaluateDuration.Observe(value)
}

func (mi *MetricsInterfaceImpl) IncrementAccessControlCacheInvalidation() {
	mi.AccessControlCacheInvalidation.Inc()
}

func (mi *MetricsInterfaceImpl) ClearMobileClientSessionMetadata() {
	mi.MobileClientSessionMetadataGauge.Reset()
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
