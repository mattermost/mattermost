# mattermost-plugin-api
A hackathon project to explore reworking the Mattermost Plugin API.

The plugin API as exposed in [github.com/mattermost/mattermost-server/plugin](http://github.com/mattermost/mattermost-server/plugin) began with the hope of adopting a consistent interface and style. But our vision for how to structure the API changed over time, along with our ability to remain consistent. 

Fixing the API in place is difficult. Any backwards incompatible changes to the RPC API would break existing plugins. Even backwards incompatible changes to the plugin helpers would break semver, requiring a coordinated major version bump with parent repository. Adding new methods improves the experience for newer plugins, but forever clutters the [plugin GoDoc](https://godoc.org/github.com/mattermost/mattermost-server/plugin).

Instead, we opted to wrap the existing RPC API and helpers with a client hosted in this separate repository. Issues fixed and improvements added include:
* `*model.AppError` eliminated, safely returning an `error` interface instead
* TBD

The API exposed by this client officially replaces direct use of the RPC API and helpers. While we will maintain backwards compatibility with the existing RPC API, we may bump the major version of this repository in coordination with a breaking semver change. This will affect only plugin authors who opt in to the newer package, and existing plugins will continue to compile and run without changes using the older version of the package.

Usage of this package is altogether optional, allowing plugin authors to switch to this package as needed. However, note that all new helpers and abstractions over the RPC API are expected to be added only to this package.
