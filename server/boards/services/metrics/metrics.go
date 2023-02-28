package metrics

import (
	"os"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
)

const (
	MetricsNamespace       = "focalboard"
	MetricsSubsystemBlocks = "blocks"
	MetricsSubsystemBoards = "boards"
	MetricsSubsystemTeams  = "teams"
	MetricsSubsystemSystem = "system"

	MetricsCloudInstallationLabel = "installationId"
)

type InstanceInfo struct {
	Version        string
	BuildNum       string
	Edition        string
	InstallationID string
}

// Metrics used to instrumentate metrics in prometheus.
type Metrics struct {
	registry *prometheus.Registry

	instance  *prometheus.GaugeVec
	startTime prometheus.Gauge

	loginCount     prometheus.Counter
	logoutCount    prometheus.Counter
	loginFailCount prometheus.Counter

	blocksInsertedCount prometheus.Counter
	blocksPatchedCount  prometheus.Counter
	blocksDeletedCount  prometheus.Counter

	blockCount *prometheus.GaugeVec
	boardCount prometheus.Gauge
	teamCount  prometheus.Gauge

	blockLastActivity prometheus.Gauge
}

// NewMetrics Factory method to create a new metrics collector.
func NewMetrics(info InstanceInfo) *Metrics {
	m := &Metrics{}

	m.registry = prometheus.NewRegistry()
	options := collectors.ProcessCollectorOpts{
		Namespace: MetricsNamespace,
	}
	m.registry.MustRegister(collectors.NewProcessCollector(options))
	m.registry.MustRegister(collectors.NewGoCollector())

	additionalLabels := map[string]string{}
	if info.InstallationID != "" {
		additionalLabels[MetricsCloudInstallationLabel] = os.Getenv("MM_CLOUD_INSTALLATION_ID")
	}

	m.loginCount = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemSystem,
		Name:        "login_total",
		Help:        "Total number of logins.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.loginCount)

	m.logoutCount = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemSystem,
		Name:        "logout_total",
		Help:        "Total number of logouts.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.logoutCount)

	m.loginFailCount = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemSystem,
		Name:        "login_fail_total",
		Help:        "Total number of failed logins.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.loginFailCount)

	m.instance = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemSystem,
		Name:        "focalboard_instance_info",
		Help:        "Instance information for Focalboard.",
		ConstLabels: additionalLabels,
	}, []string{"Version", "BuildNum", "Edition"})
	m.registry.MustRegister(m.instance)
	m.instance.WithLabelValues(info.Version, info.BuildNum, info.Edition).Set(1)

	m.startTime = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemSystem,
		Name:        "server_start_time",
		Help:        "The time the server started.",
		ConstLabels: additionalLabels,
	})
	m.startTime.SetToCurrentTime()
	m.registry.MustRegister(m.startTime)

	m.blocksInsertedCount = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemBlocks,
		Name:        "blocks_inserted_total",
		Help:        "Total number of blocks inserted.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.blocksInsertedCount)

	m.blocksPatchedCount = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemBlocks,
		Name:        "blocks_patched_total",
		Help:        "Total number of blocks patched.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.blocksPatchedCount)

	m.blocksDeletedCount = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemBlocks,
		Name:        "blocks_deleted_total",
		Help:        "Total number of blocks deleted.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.blocksDeletedCount)

	m.blockCount = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemBlocks,
		Name:        "blocks_total",
		Help:        "Total number of blocks.",
		ConstLabels: additionalLabels,
	}, []string{"BlockType"})
	m.registry.MustRegister(m.blockCount)

	m.boardCount = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemBoards,
		Name:        "boards_total",
		Help:        "Total number of boards.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.boardCount)

	m.teamCount = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemTeams,
		Name:        "teams_total",
		Help:        "Total number of teams.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.teamCount)

	m.blockLastActivity = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemBlocks,
		Name:        "blocks_last_activity",
		Help:        "Time of last block insert, update, delete.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.blockLastActivity)

	return m
}

func (m *Metrics) IncrementLoginCount(num int) {
	if m != nil {
		m.loginCount.Add(float64(num))
	}
}

func (m *Metrics) IncrementLogoutCount(num int) {
	if m != nil {
		m.logoutCount.Add(float64(num))
	}
}

func (m *Metrics) IncrementLoginFailCount(num int) {
	if m != nil {
		m.loginFailCount.Add(float64(num))
	}
}

func (m *Metrics) IncrementBlocksInserted(num int) {
	if m != nil {
		m.blocksInsertedCount.Add(float64(num))
		m.blockLastActivity.SetToCurrentTime()
	}
}

func (m *Metrics) IncrementBlocksPatched(num int) {
	if m != nil {
		m.blocksPatchedCount.Add(float64(num))
		m.blockLastActivity.SetToCurrentTime()
	}
}

func (m *Metrics) IncrementBlocksDeleted(num int) {
	if m != nil {
		m.blocksDeletedCount.Add(float64(num))
		m.blockLastActivity.SetToCurrentTime()
	}
}

func (m *Metrics) ObserveBlockCount(blockType string, count int64) {
	if m != nil {
		m.blockCount.WithLabelValues(blockType).Set(float64(count))
	}
}

func (m *Metrics) ObserveBoardCount(count int64) {
	if m != nil {
		m.boardCount.Set(float64(count))
	}
}

func (m *Metrics) ObserveTeamCount(count int64) {
	if m != nil {
		m.teamCount.Set(float64(count))
	}
}
