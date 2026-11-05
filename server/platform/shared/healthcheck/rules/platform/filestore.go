// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"math"
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules/internal/probes"
)

func init() {
	healthcheck.Register(filestoreLocalInCluster, filestoreS3NoBucket, filestoreS3SSLOff, filestoreDiskLow, filestoreDiskFull, filestoreUnreachable)
}

const (
	filestoreConsolePath = "/admin_console/environment/file_storage"

	filestoreDiskLowDivisor   = 10 // below 10% of the volume
	filestoreDiskFullDivisor  = 20 // below 5% of the volume
	filestoreDiskLowCapMB     = 10 * 1024
	filestoreDiskFullCapMB    = 5 * 1024
	filestoreDiskLowFloorMB   = 1024
	filestoreDiskSpaceSubject = "FileSettings.Directory"
	megabytesPerGigabyte      = 1024
)

var filestoreLocalInCluster = healthcheck.Rule{
	Code:     "FILESTORE_LOCAL_IN_CLUSTER",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.filestore_local_in_cluster.title"),
		RemediationID: healthcheck.TranslationId("health.rule.filestore_local_in_cluster.remediation"),
		ConsolePath:   filestoreConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "FileSettings.Directory",
	Eval: healthcheck.Licensed(healthcheck.FeatureCluster,
		healthcheck.Gate((*healthcheck.Snapshot).ClusterEnabled, healthcheck.ReasonConfigUnavailable, evalFilestoreLocalInCluster)),
}

var filestoreS3NoBucket = healthcheck.Rule{
	Code:     "FILESTORE_S3_NO_BUCKET",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityCritical,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.filestore_s3_no_bucket.title"),
		RemediationID: healthcheck.TranslationId("health.rule.filestore_s3_no_bucket.remediation"),
		ConsolePath:   filestoreConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "FileSettings.AmazonS3Bucket",
	Eval:       healthcheck.Gate(usesS3, healthcheck.ReasonConfigUnavailable, evalFilestoreS3NoBucket),
}

var filestoreS3SSLOff = healthcheck.Rule{
	Code:     "FILESTORE_S3_SSL_OFF",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.filestore_s3_ssl_off.title"),
		RemediationID: healthcheck.TranslationId("health.rule.filestore_s3_ssl_off.remediation"),
		ConsolePath:   filestoreConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "FileSettings.AmazonS3SSL",
	Eval:       healthcheck.Gate(usesS3, healthcheck.ReasonConfigUnavailable, evalFilestoreS3SSLOff),
}

var filestoreDiskLow = healthcheck.Rule{
	Code:     "FILESTORE_DISK_LOW",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.filestore_disk_low.title"),
		RemediationID: healthcheck.TranslationId("health.rule.filestore_disk_low.remediation"),
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    filestoreDiskSpaceSubject,
	EvalNode:   healthcheck.SingleNode(evalFilestoreDiskLow),
}

var filestoreDiskFull = healthcheck.Rule{
	Code:     "FILESTORE_DISK_FULL",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityCritical,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.filestore_disk_full.title"),
		RemediationID: healthcheck.TranslationId("health.rule.filestore_disk_full.remediation"),
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    filestoreDiskSpaceSubject,
	EvalNode:   healthcheck.SingleNode(evalFilestoreDiskFull),
}

var filestoreUnreachable = healthcheck.Rule{
	Code:     "FILESTORE_UNREACHABLE",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.filestore_unreachable.title"),
		RemediationID: healthcheck.TranslationId("health.rule.filestore_unreachable.remediation"),
		ConsolePath:   filestoreConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityProbe,
	Subject:    "FileSettings.DriverName",
	Eval:       healthcheck.Single(evalFilestoreUnreachable),
}

func usesS3(s *healthcheck.Snapshot) (bool, bool) {
	driver, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.FileSettings.DriverName })
	return driver == model.ImageDriverS3, ok
}

func evalFilestoreLocalInCluster(s *healthcheck.Snapshot) healthcheck.Result {
	driver, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.FileSettings.DriverName })
	if !ok {
		return healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)
	}
	if driver != model.ImageDriverLocal {
		return healthcheck.Resolved()
	}

	directory, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.FileSettings.Directory })
	if !ok {
		return healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)
	}
	return healthcheck.Firing(healthcheck.TranslationId("health.rule.filestore_local_in_cluster.message")).WithDetail("directory", directory)
}

func evalFilestoreS3NoBucket(s *healthcheck.Snapshot) healthcheck.Result {
	bucket, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.FileSettings.AmazonS3Bucket })
	switch {
	case !ok:
		return healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)
	case bucket == "":
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.filestore_s3_no_bucket.message"))
	default:
		return healthcheck.Resolved()
	}
}

func evalFilestoreS3SSLOff(s *healthcheck.Snapshot) healthcheck.Result {
	ssl, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.FileSettings.AmazonS3SSL })
	switch {
	case !ok:
		return healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)
	case !ssl:
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.filestore_s3_ssl_off.message"))
	default:
		return healthcheck.Resolved()
	}
}

// Each threshold is a share of the volume capped at an absolute size, so large volumes are not
// flagged while plenty of space remains. Comparisons stay in integers so exact boundaries are not
// blurred by floating-point rounding.
func filestoreDiskIsFull(totalMB, availableMB uint64) bool {
	return availableMB*filestoreDiskFullDivisor < totalMB && availableMB < filestoreDiskFullCapMB
}

// The 1 GiB floor keeps the low threshold above the full threshold on small volumes, so they
// warn before they turn critical.
func filestoreDiskIsLow(totalMB, availableMB uint64) bool {
	belowThreshold := (availableMB*filestoreDiskLowDivisor < totalMB && availableMB < filestoreDiskLowCapMB) ||
		availableMB < filestoreDiskLowFloorMB
	return belowThreshold && !filestoreDiskIsFull(totalMB, availableMB)
}

func formatFilestoreGiB(megabytes uint64) string {
	precision := 1
	if megabytes > 0 && megabytes < megabytesPerGigabyte {
		precision = 3
	}
	return strconv.FormatFloat(float64(megabytes)/megabytesPerGigabyte, 'f', precision, 64)
}

func formatFilestorePercent(freeRatio float64) string {
	percent := math.Floor(10_000*freeRatio) / 100
	return strconv.FormatFloat(percent, 'f', 2, 64)
}

func evalFilestoreDisk(n *healthcheck.NodeSnapshot, messageID string, fires func(totalMB, availableMB uint64) bool) healthcheck.Result {
	diag, ok := n.Diag()
	if !ok || diag.FileStore.Driver == "" {
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	}
	if diag.FileStore.Driver != model.ImageDriverLocal {
		return healthcheck.Resolved()
	}
	if !n.Has(model.SectionFilestoreDisk) || diag.FileStore.TotalMB == nil || diag.FileStore.AvailableMB == nil || *diag.FileStore.TotalMB == 0 {
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	}

	totalMB, availableMB := *diag.FileStore.TotalMB, *diag.FileStore.AvailableMB
	if availableMB > totalMB {
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	}
	freeRatio := float64(availableMB) / float64(totalMB)
	if !fires(totalMB, availableMB) {
		return healthcheck.Resolved().WithValue(freeRatio)
	}

	return healthcheck.Firing(messageID).
		WithDetail("available_gib", formatFilestoreGiB(availableMB)).
		WithDetail("total_gib", formatFilestoreGiB(totalMB)).
		WithDetail("percent", formatFilestorePercent(freeRatio)).
		WithValue(freeRatio)
}

func evalFilestoreDiskLow(_ *healthcheck.Snapshot, n *healthcheck.NodeSnapshot) healthcheck.Result {
	return evalFilestoreDisk(n, healthcheck.TranslationId("health.rule.filestore_disk_low.message"), filestoreDiskIsLow)
}

func evalFilestoreDiskFull(_ *healthcheck.Snapshot, n *healthcheck.NodeSnapshot) healthcheck.Result {
	return evalFilestoreDisk(n, healthcheck.TranslationId("health.rule.filestore_disk_full.message"), filestoreDiskIsFull)
}

func evalFilestoreUnreachable(s *healthcheck.Snapshot) healthcheck.Result {
	return probes.Eval(s, filestoreProbe,
		healthcheck.TranslationId("health.rule.filestore_unreachable.message"),
		healthcheck.TranslationId("health.rule.filestore_unreachable.message.partial"))
}

func filestoreProbe(n *healthcheck.NodeSnapshot) (status, probeErr string) {
	diag, ok := n.SectionDiag(model.SectionFilestoreConn)
	if !ok {
		return "", ""
	}

	return diag.FileStore.Status, diag.FileStore.Error
}
