// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"path"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(filestoreLocalInCluster, filestoreLocalInClusterVerify, filestoreS3NoBucket, filestoreS3SSLOff, filestoreUnreachable)
}

const filestoreConsolePath = "/admin_console/environment/file_storage"

var filestoreLocalInCluster = healthcheck.Rule{
	Code:     "FILESTORE_LOCAL_IN_CLUSTER",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityCritical,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.filestore_local_in_cluster.title"),
		RemediationID: healthcheck.TranslationId("health.rule.filestore_local_in_cluster.remediation"),
		ConsolePath:   filestoreConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "FileSettings.DriverName",
	Eval:       evalFilestoreLocalInCluster,
}

var filestoreLocalInClusterVerify = healthcheck.Rule{
	Code:     "FILESTORE_LOCAL_IN_CLUSTER_VERIFY",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.filestore_local_in_cluster_verify.title"),
		RemediationID: healthcheck.TranslationId("health.rule.filestore_local_in_cluster_verify.remediation"),
		ConsolePath:   filestoreConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "FileSettings.Directory",
	Eval:       evalFilestoreLocalInClusterVerify,
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
	Eval:       evalFilestoreS3NoBucket,
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
	Eval:       evalFilestoreS3SSLOff,
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
	Eval:       evalFilestoreUnreachable,
}

// localDirectoryInCluster returns FileSettings.Directory, with applies=false unless the local driver runs in a cluster.
func localDirectoryInCluster(s *healthcheck.Snapshot) (directory string, applies, ok bool) {
	clustered, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ClusterSettings.Enable })
	if !ok {
		return "", false, false
	}

	driver, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.FileSettings.DriverName })
	if !ok || !clustered || driver != model.ImageDriverLocal {
		return "", false, ok
	}

	directory, ok = s.ConfigString(func(cfg *model.Config) *string { return cfg.FileSettings.Directory })
	return directory, true, ok
}

func usesS3(s *healthcheck.Snapshot) (bool, bool) {
	driver, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.FileSettings.DriverName })
	return driver == model.ImageDriverS3, ok
}

func evalFilestoreLocalInCluster(s *healthcheck.Snapshot) []healthcheck.Result {
	directory, applies, ok := localDirectoryInCluster(s)
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	// path.IsAbs rather than filepath.IsAbs: mmctl may read a Linux packet on Windows.
	case applies && !path.IsAbs(directory):
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.filestore_local_in_cluster.message")).WithDetail("directory", directory)}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}

func evalFilestoreLocalInClusterVerify(s *healthcheck.Snapshot) []healthcheck.Result {
	directory, applies, ok := localDirectoryInCluster(s)
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case applies && path.IsAbs(directory):
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.filestore_local_in_cluster_verify.message")).WithDetail("directory", directory)}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}

func evalFilestoreS3NoBucket(s *healthcheck.Snapshot) []healthcheck.Result {
	s3, ok := usesS3(s)
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if !s3 {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	bucket, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.FileSettings.AmazonS3Bucket })
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case bucket == "":
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.filestore_s3_no_bucket.message"))}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}

func evalFilestoreS3SSLOff(s *healthcheck.Snapshot) []healthcheck.Result {
	s3, ok := usesS3(s)
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if !s3 {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	ssl, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.FileSettings.AmazonS3SSL })
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case !ssl:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.filestore_s3_ssl_off.message"))}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}

func evalFilestoreUnreachable(s *healthcheck.Snapshot) []healthcheck.Result {
	diag, ok := leaderDiag(s)
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)}
	}

	switch diag.FileStore.Status {
	case model.StatusFail:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.filestore_unreachable.message")).WithDetail("error", diag.FileStore.Error)}
	case model.StatusOk:
		return []healthcheck.Result{healthcheck.Resolved()}
	default:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)}
	}
}

func leaderDiag(s *healthcheck.Snapshot) (*model.SupportPacketDiagnostics, bool) {
	leader, ok := s.Leader()
	if !ok {
		return nil, false
	}

	return leader.Diag()
}
