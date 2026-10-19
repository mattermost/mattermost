// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(filestoreLocalInCluster, filestoreS3NoBucket, filestoreS3SSLOff, filestoreUnreachable)
}

const filestoreConsolePath = "/admin_console/environment/file_storage"

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
	Eval:       evalFilestoreLocalInCluster,
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
	EvalNode:   evalFilestoreUnreachable,
}

func usesS3(s *healthcheck.Snapshot) (bool, bool) {
	driver, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.FileSettings.DriverName })
	return driver == model.ImageDriverS3, ok
}

func evalFilestoreLocalInCluster(s *healthcheck.Snapshot) []healthcheck.Result {
	clustered, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ClusterSettings.Enable })
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if !clustered {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	driver, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.FileSettings.DriverName })
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if driver != model.ImageDriverLocal {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	directory, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.FileSettings.Directory })
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.filestore_local_in_cluster.message")).WithDetail("directory", directory)}
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

func evalFilestoreUnreachable(_ *healthcheck.Snapshot, n *healthcheck.NodeSnapshot) []healthcheck.Result {
	diag, ok := n.Diag()
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
