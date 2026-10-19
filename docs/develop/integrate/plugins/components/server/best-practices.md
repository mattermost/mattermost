---
title: "Best practices"
sidebar_position: 0
---

## How should plugins serve publicly available static files?

Add all static files under a file directory named `public` within the plugin directory, and include the files in the plugin bundle using the Makefile.

## How do plugins make sure http requests are authentic?

Plugins can implement the [`ServeHTTP`](/developers/integrate/reference/server#Hooks.ServeHTTP) to listen to http requests. This can be used to receive post action requests when [Interactive Messages Buttons and Menus](https://docs.mattermost.com/developer/interactive-messages.html) are triggered by users.

When plugins act as an HTTP server, they serve requests from Mattermost clients (which are authenticated in a Mattermost sense), but may also serve HTTP requests from external services like webhooks. These requests from external services might use the Authorization header to authorize themselves against the plugin.

Since these requests are just HTTP requests, anyone can send them to the plugin. Hence, the plugin must make sure the requests are authentic. The Mattermost Server sets the HTTP header ``Mattermost-User-Id`` when the request is made by an authenticated client. If the plugin is expecting the request to come from an authenticated Mattermost user, and the ``Mattermost-User-Id`` is blank, it's the plugin's responsibility to reject the request.

From Mattermost v9.4, external systems can use the ``Authorization`` header to authenticate with the plugin. HTTP requests to server-side plugins can use an ``Authorization`` header in the request for the plugin to use, and the header value will be present in the request received by the plugin, as long as the token provided in the header is not a user token issued by the Mattermost server. This is useful for connecting external systems that require authentication through an Authorization header with their own token.

## How should plugins handle request cancellation?

Long-running `ServeHTTP` handlers should pass `r.Context()` to downstream operations and stop work when it is canceled. Mattermost v12.0 and later propagates deadlines and explicit cancellation for server-to-plugin and inter-plugin HTTP requests when the destination plugin is built with a context-aware plugin runtime.

Inter-plugin callers can opt in with `http.NewRequestWithContext` or `req.WithContext`. If cancellation happens before response headers arrive, `PluginHTTP` returns `nil` and the caller can inspect `request.Context().Err()`. If it happens after headers arrive, reading the response body returns `context.Canceled` or `context.DeadlineExceeded`. Callers must close response bodies as usual.

Context values are not propagated. Use headers or `plugin.Context` for supported cross-process metadata. Plugins that require end-to-end cancellation should declare Mattermost v12.0 as their minimum server version. Older servers retain legacy behavior: they continue to process the request without context propagation, and the call may not return promptly after cancellation.
