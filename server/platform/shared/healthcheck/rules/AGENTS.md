# AGENTS.md

Before adding or changing a health rule, read the "Writing a rule" section of the package comment in `doc.go`. It records the conventions every rule follows: license gating, remediation wording, diagnostics access, and the shared helpers to reuse.

Set `AppliesToCloud: true` only when a Cloud admin can change the setting the rule recommends. Leave it false when that setting is tagged `cloud_restrictable` in `model.Config`, because Cloud admins cannot apply the fix.
