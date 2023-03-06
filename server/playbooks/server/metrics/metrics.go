package metrics

import (
	"os"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
)

const (
	MetricsNamespace          = "playbooks_plugin"
	MetricsSubsystemPlaybooks = "playbooks"
	MetricsSubsystemRuns      = "runs"
	MetricsSubsystemSystem    = "system"

	MetricsCloudInstallationLabel = "installationId"
)

type InstanceInfo struct {
	Version        string
	InstallationID string
}

// Metrics used to instrumentate metrics in prometheus.
type Metrics struct {
	registry *prometheus.Registry

	instance *prometheus.GaugeVec

	playbooksCreatedCount  prometheus.Counter
	playbooksArchivedCount prometheus.Counter
	playbooksRestoredCount prometheus.Counter
	runsCreatedCount       prometheus.Counter
	runsFinishedCount      prometheus.Counter
	errorsCount            prometheus.Counter

	playbooksActiveTotal      prometheus.Gauge
	runsActiveTotal           prometheus.Gauge
	remindersOutstandingTotal prometheus.Gauge
	retrosOutstandingTotal    prometheus.Gauge
	followersActiveTotal      prometheus.Gauge
	participantsActiveTotal   prometheus.Gauge
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

	m.instance = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemSystem,
		Name:        "playbook_instance_info",
		Help:        "Instance information for Playbook.",
		ConstLabels: additionalLabels,
	}, []string{"Version"})
	m.registry.MustRegister(m.instance)
	m.instance.WithLabelValues(info.Version).Set(1)

	m.playbooksCreatedCount = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemPlaybooks,
		Name:        "playbook_created_count",
		Help:        "Number of playbooks created since the last launch.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.playbooksCreatedCount)

	m.playbooksArchivedCount = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemPlaybooks,
		Name:        "playbook_archived_count",
		Help:        "Number of playbooks archived since the last launch.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.playbooksArchivedCount)

	m.playbooksRestoredCount = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemPlaybooks,
		Name:        "playbook_restored_count",
		Help:        "Number of playbooks restored since the last launch.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.playbooksRestoredCount)

	m.runsCreatedCount = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemRuns,
		Name:        "runs_created_count",
		Help:        "Number of runs created since the last launch.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.runsCreatedCount)

	m.runsFinishedCount = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemRuns,
		Name:        "runs_finished_count",
		Help:        "Number of runs finished since the last launch.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.runsFinishedCount)

	m.errorsCount = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemSystem,
		Name:        "errors_count",
		Help:        "Number of errors since the last launch.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.errorsCount)

	m.playbooksActiveTotal = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemPlaybooks,
		Name:        "playbooks_active_total",
		Help:        "Total number of active playbooks.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.playbooksActiveTotal)

	m.runsActiveTotal = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemRuns,
		Name:        "runs_active_total",
		Help:        "Total number of active runs.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.runsActiveTotal)

	m.remindersOutstandingTotal = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemRuns,
		Name:        "reminders_outstanding_total",
		Help:        "Total number of outstanding reminders.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.remindersOutstandingTotal)

	m.retrosOutstandingTotal = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemRuns,
		Name:        "retros_outstanding_total",
		Help:        "Total number of outstanding retrospective reminders.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.retrosOutstandingTotal)

	m.followersActiveTotal = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemRuns,
		Name:        "followers_active_total",
		Help:        "Total number of active followers, including duplicates.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.followersActiveTotal)

	m.participantsActiveTotal = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemRuns,
		Name:        "participants_active_total",
		Help:        "Total number of active participants (i.e. members of the playbook run channel when the run is active), including duplicates",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.participantsActiveTotal)
	return m
}

func (m *Metrics) IncrementPlaybookCreatedCount(num int) {
	if m != nil {
		m.playbooksCreatedCount.Add(float64(num))
	}
}

func (m *Metrics) IncrementPlaybookArchivedCount(num int) {
	if m != nil {
		m.playbooksArchivedCount.Add(float64(num))
	}
}

func (m *Metrics) IncrementPlaybookRestoredCount(num int) {
	if m != nil {
		m.playbooksRestoredCount.Add(float64(num))
	}
}

func (m *Metrics) IncrementRunsCreatedCount(num int) {
	if m != nil {
		m.runsCreatedCount.Add(float64(num))
	}
}

func (m *Metrics) IncrementRunsFinishedCount(num int) {
	if m != nil {
		m.runsFinishedCount.Add(float64(num))
	}
}

func (m *Metrics) IncrementErrorsCount(num int) {
	if m != nil {
		m.errorsCount.Add(float64(num))
	}
}

func (m *Metrics) ObservePlaybooksActiveTotal(count int64) {
	if m != nil {
		m.playbooksActiveTotal.Set(float64(count))
	}
}

func (m *Metrics) ObserveRunsActiveTotal(count int64) {
	if m != nil {
		m.runsActiveTotal.Set(float64(count))
	}
}

func (m *Metrics) ObserveRemindersOutstandingTotal(count int64) {
	if m != nil {
		m.remindersOutstandingTotal.Set(float64(count))
	}
}

func (m *Metrics) ObserveRetrosOutstandingTotal(count int64) {
	if m != nil {
		m.retrosOutstandingTotal.Set(float64(count))
	}
}

func (m *Metrics) ObserveFollowersActiveTotal(count int64) {
	if m != nil {
		m.followersActiveTotal.Set(float64(count))
	}
}

func (m *Metrics) ObserveParticipantsActiveTotal(count int64) {
	if m != nil {
		m.participantsActiveTotal.Set(float64(count))
	}
}
