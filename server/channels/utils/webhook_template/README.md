# Inline templating for incoming webhooks

Mattermost incoming webhooks accept Go [`text/template`](https://pkg.go.dev/text/template)
expressions in their query parameters. The expressions are evaluated
against the request's JSON body and the rendered values overwrite the
matching fields on the post the webhook produces.

This makes it possible to point a third-party producer (Grafana,
Alertmanager, GitHub, Sentry, custom scripts) at a Mattermost hook URL
without writing a bespoke bridge service: the producer keeps its native
payload, and the consumer (the person who created the hook URL)
declaratively maps fields into the post.

## End-to-end example

```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{"alert":{"summary":"Disk full","severity":"high"}}' \
  'https://mattermost.example.com/hooks/abc123?template=1&text={{.alert.summary}}'
```

Posts the message `Disk full` to the channel that hook `abc123` is bound
to.

## Enabling

Three conditions must hold for templating to engage on any given request.
If any one of them fails, today's webhook behaviour is preserved
unchanged.

### 1. Feature flag

`FeatureFlags.IncomingWebhookTemplates` must be `true`. The flag defaults
to `false` and is read at handler entry, so changes are hot-reloadable.

```bash
# config.json
{
  "FeatureFlags": { "IncomingWebhookTemplates": true }
}

# or via environment override
export MM_FEATUREFLAGS_INCOMINGWEBHOOKTEMPLATES=true
```

### 2. Gate query parameter

The caller must explicitly opt into templating by setting either of the
gate query parameters to a truthy value. Accepted values are
`1`, `yes`, `true` (case-insensitive).

```
?template=1
?template=yes
?template=true
?tmpl=1     # short alias
```

Without the gate, even fully-formed template values like `text={{.x}}`
are silently ignored (a debug-level log entry records that template-
shaped params were dropped). The gate exists so the server can skip
re-parsing the request body for the 99 % of webhook calls that don't use
templating.

### 3. Content-Type

The request body must be JSON. `Content-Type: application/json` (or no
Content-Type header at all) engages templating. Any other content type
returns HTTP 400 `web.incoming_webhook.template.bad_content_type.app_error`
when the gate is set — silently failing would be confusing for a caller
who has explicitly asked for templating.

| Flag on | Gate set | Content-Type    | Template params | Result                                                                                  |
|---------|----------|-----------------|-----------------|-----------------------------------------------------------------------------------------|
| no      | any      | any             | any             | Templating disabled; normal webhook path.                                                |
| yes     | no       | any             | any             | Template-shaped params ignored (Debug log); normal webhook path.                         |
| yes     | yes      | application/json| none            | Debug log; normal webhook path (nothing to template).                                    |
| yes     | yes      | application/json| ≥ 1             | **Templating engages.** Each template renders against the JSON body and overwrites its target field. |
| yes     | yes      | non-JSON        | any             | HTTP 400 `bad_content_type`.                                                              |

## How the overlay works

1. The request body is parsed today as `*model.IncomingWebhookRequest`
   exactly as it always has been (this preserves every existing decoding
   quirk: form-encoded `payload=`, multipart, control-char escaping).
2. If templating engages, the same body bytes are re-parsed as
   `map[string]any` and used as the template data context.
3. Each templated query parameter is rendered against that map.
4. The rendered value **overwrites** the corresponding field on the
   parsed `IncomingWebhookRequest`. Untemplated fields keep whatever the
   typed parse populated them with.
5. The merged request is handed to `HandleIncomingWebhook` exactly as
   today. Permission checks, channel resolution, attachment processing,
   and post creation are all unchanged.

The templating layer never inspects HTTP headers, cookies, or session
information. The data context is the request body and nothing else.

## Query-parameter reference

The `template` / `tmpl` gate must be present and truthy for any of the
per-field params below to be processed. The body is the JSON document
the template engine is evaluating against; expressions like `{{.foo}}`
refer to top-level keys of that JSON, `{{.a.b}}` to nested keys, and
`{{range .xs}}…{{end}}` to arrays.

### Top-level fields

| Query param   | Maps to (`IncomingWebhookRequest`) | Notes                                                          |
|---------------|------------------------------------|----------------------------------------------------------------|
| `template`    | — (gate)                           | `1` / `yes` / `true` engages templating; case-insensitive.     |
| `tmpl`        | — (gate alias)                     | Same as `template`.                                            |
| `text`        | `Text`                             | Post body.                                                     |
| `username`    | `Username`                         | Sender override.                                               |
| `icon_url`    | `IconURL`                          | Sender avatar URL override.                                    |
| `icon_emoji`  | `IconEmoji`                        | Sender avatar emoji override.                                  |
| `channel`     | `ChannelName`                      | Channel override; only honoured when the hook is not locked.   |
| `priority`    | `Priority.Priority`                | Post priority string (e.g. `urgent`, `important`).             |

### Attachment fields

`N` is the zero-based index of the attachment, `M` the zero-based index
of the field. Sparse indices (e.g. `attachments[2].title` without
`[0]`/`[1]`) grow the slice with empty attachments at the lower
positions.

| Query param                         | Maps to                                                     |
|-------------------------------------|-------------------------------------------------------------|
| `attachments[N].fallback`           | `Attachments[N].Fallback`                                   |
| `attachments[N].color`              | `Attachments[N].Color`                                      |
| `attachments[N].pretext`            | `Attachments[N].Pretext`                                    |
| `attachments[N].author_name`        | `Attachments[N].AuthorName`                                 |
| `attachments[N].author_link`        | `Attachments[N].AuthorLink`                                 |
| `attachments[N].author_icon`        | `Attachments[N].AuthorIcon`                                 |
| `attachments[N].title`              | `Attachments[N].Title`                                      |
| `attachments[N].title_link`         | `Attachments[N].TitleLink`                                  |
| `attachments[N].text`               | `Attachments[N].Text`                                       |
| `attachments[N].image_url`          | `Attachments[N].ImageURL`                                   |
| `attachments[N].thumb_url`          | `Attachments[N].ThumbURL`                                   |
| `attachments[N].footer`             | `Attachments[N].Footer`                                     |
| `attachments[N].footer_icon`        | `Attachments[N].FooterIcon`                                 |
| `attachments[N].timestamp`          | `Attachments[N].Timestamp` (string)                         |
| `attachments[N].fields[M].title`    | `Attachments[N].Fields[M].Title`                            |
| `attachments[N].fields[M].value`    | `Attachments[N].Fields[M].Value`                            |
| `attachments[N].fields[M].short`    | `Attachments[N].Fields[M].Short` (bool, parsed)             |

Unknown sub-keys (e.g. `attachments[0].nope`) are silently dropped — they
look like attachment params but don't target a real field.

## Template syntax cheat sheet

Templates use Go's [`text/template`](https://pkg.go.dev/text/template)
syntax. The whole body is the root data context; there is **no wrapper
object**.

| Pattern                                  | Result                                              |
|------------------------------------------|-----------------------------------------------------|
| `{{.foo}}`                               | Top-level key `foo`.                                |
| `{{.foo.bar}}`                           | Nested key.                                         |
| `{{index .items 0}}`                     | First element of an array.                          |
| `{{if .ok}}yes{{else}}no{{end}}`         | Conditional.                                        |
| `{{range .alerts}}{{.summary}}\n{{end}}` | Iterate.                                            |
| `{{with .alert}}{{.summary}}{{end}}`     | Re-root the context.                                |
| `{{.s \| upper}}`                        | Pipeline (functions chain left → right).            |

If a templated value renders to an empty string, the target field is set
to empty. Use Sprig's `default` to substitute a fallback (see below).

### Forbidden directives

For safety, the following actions are rejected before parsing — using
them in any template returns HTTP 400
`web.incoming_webhook.template.disallowed.app_error`:

- `{{call …}}` — invoke a function value at runtime
- `{{template "name" .}}` — reference a named template
- `{{define "name"}}…{{end}}` — define a template inline

The check is regex-based and considers leading `{{-` trim markers.
Identifiers like `{{.template}}` or `{{calling}}` are not affected
because of a word-boundary anchor in the regex.

## Allowed Sprig functions

In addition to the stdlib actions above, the
[Sprig](https://masterminds.github.io/sprig/) function library is
available. Sprig adds ~150 functions across these categories:

| Category    | Example functions                                                                                   |
|-------------|------------------------------------------------------------------------------------------------------|
| Strings     | `upper`, `lower`, `title`, `trim`, `trimAll`, `replace`, `contains`, `hasPrefix`, `split`, `quote`, `trunc` |
| Numbers     | `add`, `sub`, `mul`, `div`, `max`, `min`, `round`, `floor`, `ceil`                                   |
| Dates       | `now`, `date`, `dateInZone`, `ago`, `toDate`, `unixEpoch`                                            |
| Lists       | `first`, `last`, `rest`, `initial`, `slice`, `concat`, `compact`, `uniq`                             |
| Dicts       | `dict`, `get`, `set`, `hasKey`, `pluck`, `pick`, `omit`                                              |
| Defaults    | `default`, `coalesce`, `ternary`, `empty`                                                            |
| Regex       | `regexMatch`, `regexFind`, `regexReplaceAll`                                                         |
| Encoding    | `b64enc`, `b64dec`, `urlquery`, `toJson`, `toPrettyJson`                                             |
| Type checks | `typeOf`, `kindOf`, `isString`                                                                       |
| UUIDs       | `uuidv4`                                                                                              |

**Not available** (intentionally excluded by Sprig's `TxtFuncMap` or by
this server):

- `env`, `expandenv` — would leak server environment variables
- Filesystem helpers — none are in Sprig's text variant
- `getHostByName`, network helpers — none exposed
- `{{call …}}` / `{{template …}}` / `{{define …}}` — rejected by the
  denylist (see above)

For the full Sprig reference, see
<https://masterminds.github.io/sprig/>.

## Limits

To keep templating cheap and DoS-resistant, three protections are
enforced per request:

| Limit                | Value     | Error code                                              |
|----------------------|-----------|---------------------------------------------------------|
| Request body         | 128 KB    | `web.incoming_webhook.decode.app_error`                  |
| Rendered output      | 1 MB      | `web.incoming_webhook.template.too_large.app_error`      |
| Execution time       | 100 ms    | `web.incoming_webhook.template.timeout.app_error`        |
| Attachments          | 10        | `web.incoming_webhook.template.index_out_of_range.app_error` |
| Fields per attachment| 20        | `web.incoming_webhook.template.index_out_of_range.app_error` |

The execution timeout is wall-clock and applies to a single template
expression. A pathological pipeline like
`{{range until 1000000000}}{{end}}` will be aborted around the 100 ms
mark and the request fails with `timeout.app_error`.

## Worked examples

### 1. Grafana alert

Grafana sends a JSON payload like this:

```json
{
  "status": "firing",
  "commonAnnotations": {
    "summary": "Database connection pool exhausted",
    "description": "More than 95% of connections in use for 5m"
  },
  "commonLabels": { "severity": "warning", "service": "api" }
}
```

A hook URL that lays the alert out as a coloured attachment:

```
POST /hooks/abc123
  ?template=1
  &text={{.status | upper}}: {{.commonAnnotations.summary}}
  &attachments[0].color={{if eq .status "firing"}}danger{{else}}good{{end}}
  &attachments[0].title={{.commonAnnotations.summary}}
  &attachments[0].text={{.commonAnnotations.description}}
  &attachments[0].footer={{.commonLabels.service}} ({{.commonLabels.severity}})
```

Remember to URL-encode the values when sending the request; the example
above is shown unencoded for readability.

### 2. GitHub `push` webhook

GitHub's push payload looks like (abbreviated):

```json
{
  "ref": "refs/heads/main",
  "repository": { "full_name": "acme/widgets" },
  "pusher": { "name": "alice" },
  "commits": [
    { "id": "abc123", "message": "Fix off-by-one in pagination" },
    { "id": "def456", "message": "Bump version to 1.4.2" }
  ]
}
```

A hook that renders a one-line summary plus a commit list:

```
?template=1
  &text=**{{.pusher.name}}** pushed {{len .commits}} commit(s) to **{{.repository.full_name}}**
  &attachments[0].fallback={{.pusher.name}} pushed to {{.repository.full_name}}
  &attachments[0].fields[0].title=Branch
  &attachments[0].fields[0].value={{trimPrefix "refs/heads/" .ref}}
  &attachments[0].fields[0].short=true
  &attachments[0].fields[1].title=Commits
  &attachments[0].fields[1].value={{range .commits}}- {{.message}} ({{.id | trunc 7}})\n{{end}}
```

### 3. Sentry issue

Sentry's webhook for a new issue includes the project, the title, and a
URL into the dashboard:

```json
{
  "project_name": "frontend",
  "event": { "title": "TypeError: Cannot read property 'x' of undefined" },
  "url": "https://sentry.example.com/issues/42"
}
```

Render with a default for missing titles and a clickable attachment:

```
?template=1
  &text=:warning: **{{.project_name}}** — {{default "Unknown error" .event.title}}
  &attachments[0].color=danger
  &attachments[0].title_link={{.url}}
  &attachments[0].title=Open in Sentry
```

## Error reference

All template errors return HTTP 400 with a stable i18n key. The
`DetailedError` field of the response carries the failing field name so
operators can quickly identify which query parameter caused the failure.

| i18n key                                                              | Trigger                                                                                  |
|-----------------------------------------------------------------------|------------------------------------------------------------------------------------------|
| `web.incoming_webhook.template.bad_content_type.app_error`            | Gate set but `Content-Type` is not `application/json`.                                   |
| `web.incoming_webhook.template.disallowed.app_error`                  | Template contains `{{call}}`, `{{template}}`, or `{{define}}`.                            |
| `web.incoming_webhook.template.parse.app_error`                       | Template string is syntactically invalid (e.g. unterminated `{{`).                       |
| `web.incoming_webhook.template.execute.app_error`                     | Template parses but errors at runtime (e.g. dereferencing a non-map value).              |
| `web.incoming_webhook.template.timeout.app_error`                     | Template execution exceeded 100 ms.                                                       |
| `web.incoming_webhook.template.too_large.app_error`                   | Rendered output exceeded 1 MB.                                                            |
| `web.incoming_webhook.template.invalid_json_body.app_error`           | Body could not be parsed as JSON (templating mode requires JSON).                         |
| `web.incoming_webhook.template.short_invalid.app_error`               | `attachments[N].fields[M].short` rendered a value that is not a bool.                     |
| `web.incoming_webhook.template.index_out_of_range.app_error`          | Attachment or field index exceeds the configured maximum (10 / 20).                       |

## Auditing

Every templated webhook request emits an audit event
`incomingHookTemplated` with metadata:

- `webhook_id`
- `templated_fields` — the list of query-parameter names that were
  templated. **Rendered values are never written to the audit record**
  to prevent payload data leakage.

The audit record's status reflects whether all templates rendered
successfully (`success`) or one of them failed (`fail`).

## v2: property values on posts

A follow-up release will extend templating so the rendered values can
populate per-post property values (the same property fields used by
ABAC post policies). The interface is expected to be a new
`?values.<field_name>={{...}}` query parameter; until that ships,
templating can only drive the fields listed in this README.

The renderer in this package is designed to be reused by v2: parameter
extraction, denylist enforcement, limits, and error mapping all live
behind exported helpers and do not depend on the HTTP layer.
