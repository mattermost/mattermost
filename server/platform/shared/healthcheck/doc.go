// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package healthcheck contains the built-in health rule engine behind the System Console's
// Site health page and mmctl health check. The rule catalog lives in the rules package, whose
// documentation covers how to write a rule, including never recommending a fix the license
// cannot use.
//
// The decisions below shape the engine. Changing one changes behavior admins rely on, so
// treat them as constraints, not suggestions.
//
// # Rules
//
// The server evaluates every rule. The System Console only displays the findings the API
// returns.
//
// Rules are Go functions over a typed [Snapshot], with no expression language, so renaming a
// field the rules read breaks the build instead of silently turning a rule off.
//
// This package, the rules and the packet reader import nothing else from the server, so a rule
// cannot reach the store or the app layer, and mmctl can link them to evaluate packets offline.
// The one exception is the config package: AUDIT_LOG_OFF falls back to
// config.IsAuditLoggingActive for packets from servers that do not record their audit logging
// state. TestImportsStayOutOfTheServer enforces this.
//
// A live server and a Support Packet produce the same [Snapshot], so a rule cannot tell them
// apart and an offline check answers like the live one.
//
// Missing data is not zero. A value that was not collected is nil, or its section is marked
// failed, and the rule returns [Unknown] instead of judging a zero.
//
// One rule may return several results under its code: one cluster-wide result, one per node,
// or both. A rule that panics yields [Unknown] for itself alone and does not stop the run.
//
// # Findings
//
// A finding's identity is its [Fingerprint] of code, subject and scope. The subject names the
// setting or target, never its value, and the scope is a hostname, or empty for a
// cluster-wide finding. Changing a shipped rule's subject or scope orphans its mutes.
//
// A finding is [StateFiring], [StateResolved] or [StateUnknown], and unknown is not resolved.
// A finding that a run did not evaluate turns unknown once its rule's [Volatility] class
// allows ([Policy]). Resolved means a problem cleared, so a check that passes and has never
// fired stores nothing.
//
// Findings store translation ids and details, never prose: evaluation has no locale, and admins
// read one finding in several languages. Text is rendered when the API or mmctl returns a
// finding (model.HealthFinding.Render). Changed wording gets a new id, so outdated
// translations don't show.
//
// Muting is the only way to suppress a finding. A mute applies to one fingerprint and lasts
// until an admin removes it; there is no snooze, assignee or required reason. A different
// failure of the same rule has a different fingerprint and fires again. A mute goes away with
// its finding once the finding has not been seen for [DefaultFindingRetention].
//
// Each rule declares a [Volatility] class. Today it only sets how fast an unevaluated finding
// turns unknown; per-class smoothing of flapping findings is not built yet.
//
// Findings with [SurfaceInternal] are for support engineers. The API and the System Console
// never return them; only mmctl health check --packet shows them.
//
// # Runs
//
// A run is a health_check job (channels/jobs/health_check). Its worker runs only on app
// servers, which have joined the cluster, whatever JobSettings.RunJobs says, so only the
// scheduler is registered with the jobs framework. Runs never overlap, and a run with no
// activity for 15 minutes is closed as failed.
//
// Every node collects all of its diagnostics, external probes included, in every run. The
// node running the check asks the others over the cluster and waits up to three minutes for
// their replies.
//
// A rule that probes an external service, such as SMTP or LDAP, produces one cluster-wide
// finding that lists the failing nodes, with its own message when only some nodes fail. One
// mute therefore covers every node.
//
// A node that does not reply has [ErrNodeNoReply] and fires NODE_NOT_RESPONDING, which carries
// the node through [Result.WithUnreachableNode]. The reconciler then drops that node's other
// unknown results, so one missing node does not fill the page.
package healthcheck
