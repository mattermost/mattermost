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

### Indexing arrays

Go's `text/template` does **not** accept bracket indexing — `{{.alerts[0]}}`
is a parse error. Use the built-in `index` action (or the Sprig `first` /
`last` / `slice` helpers) instead.

| Want to read                  | Template                                            |
|-------------------------------|-----------------------------------------------------|
| `messages[0]`                 | `{{index .messages 0}}`                             |
| `messages[0].text`            | `{{(index .messages 0).text}}`                      |
| `messages[0]["text"]`         | `{{index .messages 0 "text"}}`                      |
| `matrix[0][1]`                | `{{index (index .matrix 0) 1}}`                     |
| Nested map path               | `{{index .users 0 "address" "city"}}`               |
| First / last element (Sprig)  | `{{(first .alerts).summary}}` · `{{(last .alerts).summary}}` |
| Re-root onto an element       | `{{with index .alerts 0}}{{.summary}}{{end}}`       |
| Iterate every element         | `{{range .alerts}}{{.summary}}\n{{end}}`            |

**URL-encoding caveat.** `index` requires literal spaces between its
arguments. Spaces are not safe in a URL query value, so they must be
percent-encoded as `%20`:

```
# Unencoded (does not work — the server will reject the URL or truncate
# at the space):
POST /hooks/abc?tmpl=1&text={{index .alerts 0}}

# URL-encoded (correct):
POST /hooks/abc?tmpl=1&text={{index%20.alerts%200}}
```

Most HTTP clients and the Go `url.QueryEscape` helper do this for you.
A useful rule of thumb: build templated query values via
`url.QueryEscape("…template…")` rather than concatenating strings by
hand.

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

## Property values on posts

Templating can also populate per-post property values (the same
PropertyField definitions used by ABAC post policies and any other
property-aware feature) via a `?values.<field_name>={{...}}` query
parameter. Each rendered value is mapped to the channel-post
PropertyField with the matching name and persisted alongside the post
through `UpsertPropertyValues`.

```bash
curl -X POST -H 'Content-Type: application/json' \
  -d '{"level":"high","summary":"Disk full"}' \
  'https://mm.example.com/hooks/abc123?template=1&text={{.summary}}&values.severity={{.level}}'
```

The hook above creates a post with text `Disk full` and writes the
rendered value `"high"` against the channel-post `severity` property
field.

### Supported field types

The coercer translates the rendered string into the canonical JSON
shape stored on each PropertyValue type:

| Field type    | Rendered string handled as                                                              | Stored as                       |
|---------------|------------------------------------------------------------------------------------------|----------------------------------|
| `text`        | Any string                                                                               | bare JSON string                 |
| `select`      | An existing option ID (exact match) or an existing option name (case-insensitive)        | bare JSON string of the ID       |
| `multiselect` | Comma-separated list of tokens; each token resolved like `select`                        | JSON array of resolved IDs       |
| `date`        | RFC3339 timestamp (`2026-03-04T05:06:07Z`) or bare ISO date (`2026-03-04`), normalised   | RFC3339 string (UTC)             |
| `user`        | A 26-char Mattermost user ID (passthrough) or an existing username (looked up)            | bare JSON string of the user ID  |
| `multiuser`   | Comma-separated list of tokens; each token resolved like `user`                          | JSON array of resolved user IDs  |

### Discard-on-mismatch policy

Templated value writes are designed to fail open: any individual
mismatch is logged at warn level on the server and the offending value
is dropped, while the surrounding webhook post is still created and
every other resolvable value is still written. The following cases are
all warn-and-discard rather than 4xx:

- the named property field does not exist on the channel
- a `select` / `multiselect` token does not match any option (each
  unresolved option in a multiselect is dropped individually)
- a `date` rendered string does not parse as RFC3339 or `YYYY-MM-DD`
- a `user` / `multiuser` token is neither a valid user ID nor an
  existing username
- the field's type is one the coercer does not yet support

Real errors (DB connectivity failures, upsert failures) still surface
as HTTP 5xx; only the per-value "this rendered string cannot land at
the store" cases are quietly discarded.

### Auditing

The audit record gains a `templated_values` meta entry listing the
field names that were sent in the request (not the rendered values),
so operators can correlate which fields a producer attempted to set.
Discarded values are visible only in the server log; they do not
appear in the audit record.
