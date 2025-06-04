// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/blang/semver/v4"
	"github.com/go-playground/validator/v10"
	"github.com/mattermost/mattermost/server/public/model"
)

// validate is a package-level validator instance
var validate = validator.New()

func init() {
	// Register custom semver validation
	validate.RegisterValidation("semver", validateSemver)
}

// validateSemver is a custom validation function for semver format
func validateSemver(fl validator.FieldLevel) bool {
	version := fl.Field().String()
	_, err := semver.ParseTolerant(version)
	return err == nil
}

func (api *API) InitClientPerformanceMetrics() {
	api.BaseRoutes.APIRoot.Handle("/client_perf", api.APISessionRequiredTrustRequester(submitPerformanceReport)).Methods(http.MethodPost)
}

func submitPerformanceReport(c *Context, w http.ResponseWriter, r *http.Request) {
	// we return early if server does not have any metrics infra available
	if c.App.Metrics() == nil || !*c.App.Config().MetricsSettings.EnableClientMetrics {
		return
	}

	var report model.PerformanceReport
	if jsonErr := json.NewDecoder(r.Body).Decode(&report); jsonErr != nil {
		c.SetInvalidParamWithErr("submitPerformanceReport", jsonErr)
		return
	}

	if err := validate.Struct(&report); err != nil {
		c.SetInvalidParamWithErr("submitPerformanceReport", err)
		return
	}

	// Additional custom validation for performance report
	if err := validatePerformanceReportCustom(&report); err != nil {
		c.SetInvalidParamWithErr("submitPerformanceReport", err)
		return
	}

	if appErr := c.App.RegisterPerformanceReport(c.AppContext, &report); appErr != nil {
		c.Err = appErr
		return
	}

	ReturnStatusOK(w)
}

// validatePerformanceReportCustom performs additional validation that can't be done with struct tags
func validatePerformanceReportCustom(report *model.PerformanceReport) error {
	// Custom validation for version and timestamps that were in the original IsValid method
	reportVersion, err := semver.ParseTolerant(report.Version)
	if err != nil {
		return fmt.Errorf("could not parse semver version: %s, %w", report.Version, err)
	}

	performanceReportVersion := semver.MustParse("0.1.0")
	if reportVersion.Major != performanceReportVersion.Major || reportVersion.Minor > performanceReportVersion.Minor {
		return fmt.Errorf("report version is not supported: server version: %s, report version: %s", performanceReportVersion.String(), report.Version)
	}

	now := model.GetMillis()
	performanceReportTTLMilliseconds := 300 * 1000 // 300 seconds/5 minutes
	if report.End < float64(now-int64(performanceReportTTLMilliseconds)) {
		return fmt.Errorf("report is outdated: end_time %f is past %d ms from now", report.End, performanceReportTTLMilliseconds)
	}

	return nil
}
