// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package rules registers the built-in health rule catalog; importing it for side effect
// populates healthcheck.Builtin(). Each area package gets one blank import in rules.go.
//
// # Writing a rule
//
// Never recommend what the server cannot do. When a rule's fix needs a licensed feature,
// wrap its Eval in healthcheck.Licensed with that feature's getter (healthcheck.FeatureCluster,
// healthcheck.FeatureElasticsearch, ...), healthcheck.AnyFeature when any of several features
// enables a fix, or healthcheck.AnyLicense when the server only needs some license loaded. The
// rule then resolves while the license lacks the feature, because the server ignores the
// settings it would recommend. Static remediation text names only fixes that are always
// available; licensed alternatives go in a message variant chosen when the license allows them.
//
// Licensed consults the license only when the rule would not resolve anyway, so a feature that
// is not configured stays resolved in packets without license data. Prefer it over checking
// the license before the rule's own checks.
//
// Gate rules with Snapshot.LicenseAllows, which counts a feature missing from a licensed
// packet as allowed. Use Snapshot.LicenseFeature, which reports such a feature as unknown,
// only before text that claims the license includes something.
//
// Read leader diagnostics through Snapshot.LeaderDiag rather than a stricter local copy: an
// older packet that does not record a section's status still carries its data, and rules
// already treat missing fields as unknown.
//
// Measure ages from Snapshot.CollectedAt, not the current time, so a packet read later reports
// what was true when it was collected.
//
// Reuse the shared helpers instead of local copies: healthcheck.Single, Gate and Licensed (and
// their Node variants) to wire Eval, the healthcheck.Feature getters, internal/hosts.IsLocal
// for loopback checks, internal/versions.Major for version strings, and internal/probes.Eval
// for probes of external services, which every node runs.
//
// Every new code goes in its package's block in TestBuiltinRegistry.
package rules
