# Mattermost developer documentation

Website for Mattermost developer documentation, built using [Hugo](https://gohugo.io/). The `master` branch is continuously deployed to [developers.mattermost.com](https://developers.mattermost.com/).

This documentation lives within the [Mattermost monorepo](https://github.com/mattermost/mattermost) under `docs/developer/`.

## Contribute

### Prerequisites

- Go (version specified in `go.mod`) [(_download_)](https://go.dev/dl)
- Node.js v14+ [(_download_)](https://nodejs.org/en/download/)

Hugo is installed automatically via `go install` when running `make`.

### Set up your environment

1. Clone the monorepo and change to the developer docs directory.

    ```shell
    git clone git@github.com:mattermost/mattermost.git
    cd mattermost/docs/developer
    ```

2. Generate JSON plugin docs; this must be done at least once.

    ```shell
    make plugin-data
    ```

3. Start the Hugo development server.

    ```shell
    make run
    ```

4. Open [http://localhost:1313](http://localhost:1313) in a new browser tab to see the docs.

You're all set! You can start making changes as desired; the development server will automatically re-render affected docs pages.

**Note:** Before pushing changes, run a full build using `make` to make sure there are no build errors.

### Makefile targets

| Target | Description |
|---|---|
| `make` | Build the full site (default target, alias for `dist`) |
| `make run` | Start the Hugo development server with drafts enabled |
| `make build` | Build with verbose output and unused template checks |
| `make plugin-data` | Generate plugin documentation JSON (server + webapp) |
| `make test` | Run HTML validation on the built site |
| `make compass-icons` | Download Compass Icon fonts and CSS |

## Best practices

- The Mattermost developer documentation uses several custom Hugo [shortcodes](https://gohugo.io/content-management/shortcodes/) to control its presentation. Shortcodes are preferred over using raw HTML and should be used where possible.
- Links that navigate away from `developers.mattermost.com` should use the [newtabref shortcode](#open-links-in-a-new-tab).

### Hugo shortcodes

#### Collapse

The `collapse` shortcode creates a collapsible text box.

```gotemplate
{{<collapse id="client_bindings_request" title="Client requests bindings from server">}}
`GET /plugins/com.mattermost.apps/api/v1/bindings?user_id=ws4o4macctyn5ko8uhkkxmgfur&channel_id=qphz13bzbf8c7j778tdnaw3huc&scope=webapp`
{{</collapse>}}
```

![Example of collapse shortcode](readme_assets/shortcode-collapse.png)

Note that the `id` attribute of the shortcode must be unique on the page.

#### Compass icon

The `compass-icon` shortcode displays an icon from the [Compass Icon](https://mattermost.github.io/compass-icons/) set. The shortcode takes 2 arguments: the ID of the icon and an optional icon description which is used as alt text.

```gotemplate
{{<compass-icon icon-star "Mandatory Value">}}
```

![Example of compass-icon shortcode](readme_assets/shortcode-compass-icon.png)

#### Mermaid

The `mermaid` shortcode allows embedding [Mermaid](https://mermaid-js.github.io/mermaid/#/) diagram syntax into the page.
Each page that uses a Mermaid diagram must also have a `mermaid: true` property set in the page's frontmatter.

```gotemplate
{{<mermaid>}}
sequenceDiagram
    actor System Admin
    System Admin->>Mattermost server: install app
    Mattermost server->>Apps framework: install app
    Apps framework->>App: request manifest
    App->>Apps framework: send manifest
    Apps framework->>System Admin: request permissions
    System Admin->>Apps framework: grant permissions
    Apps framework->>Mattermost server: create bot
    Apps framework->>Mattermost server: create OAuth app
    Apps framework->>Apps framework: enable app
    Apps framework->>App: call OnInstall if defined
{{</mermaid>}}
```

![Example of Mermaid shortcode](readme_assets/shortcode-mermaid.png)

#### Open links in a new tab

The `newtabref` shortcode creates a link that opens in a new browser tab. The link text is followed by a Compass Icon which indicates the link will open in a new tab.

```gotemplate
All Apps should define a manifest ({{<newtabref title="godoc" href="https://pkg.go.dev/github.com/mattermost/mattermost-plugin-apps/apps#Manifest">}}) as a JSON object.
```

![Example of newtabref shortcode](readme_assets/shortcode-newtabref.png)

#### Note

The `note` shortcode displays a styled message box suitable for a note. The shortcode accepts 3 arguments: the title of the node, an optional Compass Icon ID, and an optional description for the Compass Icon.

```gotemplate
{{<note "Mandatory values" "icon-star" "Mandatory Value">}}
- The `app_id` and `homepage_url` values must be specified.
- At least one deployment method - `aws_lambda`, `open_faas`, or `http` - must be specified.
{{</note>}}
```

![Example of note shortcode](readme_assets/shortcode-note.png)

#### Tabbed content

A combination of the `tabs` and `tab` shortcodes create a section of tabbed content.
The `tabs` shortcode defines the list of available tabs in the tab "selection bar", each with a unique ID and name.
The `tab` shortcode defines the content for an individual tab.

Example of using tabbed content shortcodes:

```gotemplate
{{<tabs "tab_group_name" "tabid1,tabname1;tabid2,tabname2;..." "initial_tab_id">}}
{{<tab "tabid1" "display: block;">}}
- Content for tab #1
{{</tab>}}
{{<tab "tabid2">}}
- Content for tab #2
{{</tab>}}
```

##### `tabs` shortcode

The `tabs` shortcode creates the top portion of tabbed content: a list of available tabs, each with a click handler.

The general format of the shortcode is:

```gotemplate
{{<tabs "tab_group_name" "list_of_available_tabs" "initial_tab_id">}}
```

To ensure tabs in one group don't affect another group, a unique `tab_group_name` is required.
The available tabs in the group are defined in a single string of the format:

`tab1_id,tab1_name;tab2_id,tab2_name;...`

The following example defines a group of two tabs named `Android` and `iOS`:

```gotemplate
{{<tabs "mobile" "mobile-droid,Android;mobile-ios,iOS" "mobile-droid">}}
```

The `initial_tab_id` specifies the ID of the tab that should be active when the page loads.

##### `tab` shortcode

The `tab` shortcode defines a section of content for a specific tab.

The general format of the shortcode is:

```gotemplate
{{<tab "tab_id" "initial_tab_style">}}
...tab content defined here...
{{</tab>}}
```

The `tab_id` must correspond to a tab ID defined in a `tabs` shortcode.
The `initial_tab_style` is used to display the initial active tab's content by specifying a value of `display: block;`.

The following example defines content for two tabs with IDs `tab1_id` and `tab2_id`:

```gotemplate
{{<tab "tab1_id" "display: block;">}}
- Content for tab #1
{{</tab>}}
{{<tab "tab2_id">}}
- Content for tab #2
{{</tab>}}
```

##### Limitations of tabbed content

Due to the implementation of the `tab` shortcode, there are some limitations on what information can be rendered:

- `note` shortcodes cannot contain bulleted lists
