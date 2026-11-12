---
title: "Enforce access control in your plugin"
sidebar_position: 30
---

From Mattermost v11.11, a plugin can protect its own resources, such as reports, agents or dashboards, with [attribute-based access control](/administration-guide/manage/admin/attribute-based-access-control) policies. Each policy holds rules that compare a user's attributes with the conditions the rule sets, and your plugin asks Mattermost whether a user may perform an action on a resource.

Mattermost also enforces its own permission policies, which restrict actions in channels such as uploading and downloading files. A plugin that performs one of those actions for users should check them too. See [Respect permission policies](#respect-permission-policies).

Policy evaluation needs a Mattermost Entry or Enterprise Advanced license, with [attribute-based access control enabled](/administration-guide/configure/system-attributes#enable-attribute-based-access-control). For the method reference, see the [server plugin SDK reference](/developers/integrate/reference/server#API.EvaluateAccessControl).

## How plugin policies work

A plugin policy protects one resource:

- **ID**: the resource's own ID, which must be a 26-character Mattermost ID, such as one created with `model.NewId()`. Resources without such an ID can't have a policy. Policy IDs are shared with every other policy on the server, so use the resource's own ID rather than one you make up.
- **Type**: `<pluginID>:<resourceType>`, for example `com.example.reports:report`. The plugin ID must be the calling plugin's ID. The resource type is your choice: up to 64 letters, digits, dots, dashes and underscores.
- **Name**: a name for the policy, required.
- **Rules**: one or more rules. Each rule has an `Expression` and the `Actions` it allows, and can have a `Name`.

Action names are also your choice, such as `view`, `edit` or `run_report`. Each one must use lowercase letters, digits and single underscores between words (`^[a-z0-9]+(_[a-z0-9]+)*$`), and be at most 64 characters long.

Rule expressions are written in CEL (Common Expression Language), the same language the System Console uses for access rules. For example, `user.attributes.Department == "Engineering"`. See the [policy expression reference](/administration-guide/manage/admin/abac-policy-expressions) for the attributes, operators and functions you can use. A plugin rule can use the user's attributes (`user.attributes.<name>`) and the built-in user fields such as `user.email`. Plugin resources have no attributes of their own and evaluation has no session, so a rule that uses `resource.attributes` or `user.session` doesn't match.

When Mattermost evaluates an action on a resource:

- The rules that list the action are combined with OR: the user is allowed if they match any of them.
- If the policy has no rule for the action, the user is denied.
- If a rule can't be evaluated, for example because the user doesn't have an attribute the rule uses, it doesn't match.
- If there's no policy for the resource, the decision is "no policy", and your plugin applies its own default.

Plugin policies are simpler than the policies admins create in the System Console. They can't import other policies or have roles or a team scope. Mattermost sets their version to `v0.5`.

## Save a policy

Use `SaveAccessControlPolicy` to create or update the policy for a resource:

```go
const reportResourceType = "com.example.reports:report"

func (p *Plugin) saveReportPolicy(actingUserID, reportID, reportName string) error {
	_, appErr := p.API.SaveAccessControlPolicy(actingUserID, &model.AccessControlPolicy{
		ID:   reportID,
		Name: reportName,
		Type: reportResourceType,
		Rules: []model.AccessControlPolicyRule{
			{
				Name:       "Engineering can view",
				Actions:    []string{"view"},
				Expression: `user.attributes.Department == "Engineering"`,
			},
			{
				Name:       "Engineering leads can edit",
				Actions:    []string{"edit", "delete"},
				Expression: `user.attributes.Department == "Engineering" && user.attributes.Role == "Lead"`,
			},
		},
	})
	if appErr != nil {
		return appErr
	}
	return nil
}
```

Things to know about saving:

- `actingUserID` must be an existing user. The change is validated and recorded in the audit log as that user.
- **Mattermost doesn't check that the acting user may change the policy.** Your plugin decides who can, for example by checking `p.API.HasPermissionTo(actingUserID, model.PermissionManageSystem)`, or by its own rules about who manages the resource.
- If the acting user isn't a system admin, they must match every rule of the policy they save. This stops users from locking themselves out.
- The policy's type can't be changed after the policy is created.
- Mattermost checks each expression when you save, and refuses a policy with an invalid one.

`GetAccessControlPolicy(id)` reads a policy back, and `DeleteAccessControlPolicy(actingUserID, resourceType, id)` deletes it. Both return a not-found error for a policy that doesn't exist or belongs to another plugin. Delete a resource's policy when you delete the resource.

## Check access

Call `EvaluateAccessControl(userID, resourceType, resourceID, action)` before you let a user act on a resource. It returns a `*model.AccessDecision`:

- **Allowed**: `Decision` is `true`.
- **Denied**: `Decision` is `false`.
- **No policy**: no policy protects the resource. `Decision` is `true`, `Context["reason"]` is `"no_policy"`, and `IsNoPolicy()` returns `true`. Don't treat this as a grant: apply your plugin's own default instead.

**Fail closed.** If `EvaluateAccessControl` returns an error, Mattermost couldn't make a decision, and your plugin must deny the action. That includes a resource that has a policy while attribute-based access control is disabled or unlicensed. Also treat a `nil` decision as a denial: on a server without this method, or when the call to the server fails, the plugin API returns `nil` for both the decision and the error.

```go
func (p *Plugin) canAccessReport(userID, reportID, action string) bool {
	decision, appErr := p.API.EvaluateAccessControl(userID, reportResourceType, reportID, action)
	if appErr != nil || decision == nil {
		p.API.LogWarn("Access check failed, denying", "report_id", reportID, "action", action)
		return false
	}
	if decision.IsNoPolicy() {
		// No policy protects this report: use the plugin's own rules.
		return p.defaultReportAccess(userID, reportID, action)
	}
	return decision.Decision
}
```

When attribute-based access control is unavailable, Mattermost still checks whether the resource has a policy. A resource without one gets the "no policy" decision, so your plugin keeps working on servers that don't use attribute-based access control.

## Build a policy editor

If your plugin lets admins write rules, these methods help its UI check an expression, test it against users and list the attributes a rule can use. Each takes an `actingUserID` and runs as that user. As with saving, Mattermost doesn't check that this user may make the call, so check permissions in your plugin first.

| Method | Use |
|---|---|
| `CheckAccessControlExpression(actingUserID, resourceType, expression)` | Checks an expression. Returns a list of errors, each with `Line`, `Column` and `Message`; an empty list means the expression is valid. |
| `QueryUsersForAccessControlExpression(actingUserID, resourceType, expression, term, cursorID, limit)` | Lists the users who match an expression, optionally filtered by a search term, so an admin can test a rule. Returns `Users` and `Total`. `limit` defaults to 50 and is capped at 100; pass the last user's ID as `cursorID` for the next page. |
| `GetAccessControlFieldsAutocomplete(actingUserID, after, limit)` | Lists the attributes a rule can use: the built-in user fields first, then user attributes. Pass an empty `after` to start at the beginning. `limit` defaults to 50 and is capped at 100. |
| `GetAccessControlVisualAST(actingUserID, resourceType, expression)` | Converts an expression to a list of conditions, each with an attribute, an operator and a value, so your UI can show it as a table. Returns an error for an expression that can't be shown that way, such as one that joins conditions on different attributes with OR. |

Like the rest of the plugin API, these methods run in your plugin's server. For your web app to use them, add routes to your plugin's `ServeHTTP` that call them, and call those routes from the web app.

## Respect permission policies

Admins can restrict what users can do in channels with [permission policies](/administration-guide/manage/admin/abac-system-wide-policies#permission-policies), such as who can upload and download files. If your plugin performs one of these actions for users, check the policies before it does.

For files, use `HasPermissionToFileAction(sessionID, fileID, action)` when your plugin serves file contents or attaches files for users. It needs Mattermost v12.0, or v11.7.12, v11.10.3, v11.11.1 or a later patch release of those versions.

- `sessionID` is the session of the user making the request. In `ServeHTTP`, it's `c.SessionId` from the `*plugin.Context`.
- `action` is `upload_file_attachment` or `download_file_attachment`.

It evaluates the policies that apply to the file's channel for that session's user, and returns `true` if the action is allowed. It returns `false` for any other action, an invalid session, a file that isn't in a channel, or an evaluation error, and `true` when attribute-based access control is turned off. It checks only the policies: check the user's ordinary permissions for the channel too.

```go
func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	fileID := r.URL.Query().Get("file_id")

	if !p.API.HasPermissionToFileAction(c.SessionId, fileID, model.AccessControlPolicyActionDownloadFileAttachment) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	// ... check channel permissions, then serve the file ...
}
```
