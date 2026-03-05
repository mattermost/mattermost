---
title: "Debugging Using Charles"
heading: "Debugging Using Charles"
description: "Learn about using Charles to debug against community servers while running a local copy of the mattermost webapp."
slug: debugging-using-charles
date: 2019-10-21T00:00:00-04:00
author: Jesse Hallam
github: lieut-data
community: jesse.hallam
---

I recently acquired a copy of {{< newtabref href="https://www.charlesproxy.com" title="Charles" >}}, the well-known Web Debugging Proxy Application. I've actually stumbled across this product on multiple occasions, but never bothered to actually try it... almost exclusively because I thought the website looked a little dated. In trying to suss out the root cause behind {{< newtabref href="https://mattermost.atlassian.net/browse/MM-19091" title="MM-19091" >}}, I needed a way to debug against our {{< newtabref href="https://community.mattermost.com" title="community" >}} servers but running with my local copy of the {{< newtabref href="https://github.com/mattermost/mattermost-webapp" title="mattermost webapp" >}}. This would allow me to insert `console.log` debugging statements and even use the {{< newtabref href="https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi?hl=en" title="React Developer Tools" >}} without the minified component names.

What follows is a brief how-to guide for replicating this setup on macOS. Charles is also available for Windows and Linux, but I imagine the configuration steps should be similar. Note too that unrestricted use of Charles requires a paid license, but if you want to experiment with these steps, the application will run for 30 minutes at a time for up to 30 days with all features enabled.

## Setting up Charles

Start by {{< newtabref href="https://www.charlesproxy.com/download/" title="downloading Charles" >}}. After you copy the tool to your Applications directory and run it, Charles will automatically start proxying:

![image](/blog/2019-10-21-debugging-using-charles/proxying.png)

Notice, however, that the contents of any SSL connections are initially opaque. The real power of Charles comes from being able to install root certificates and effectively man-in-the-middle your SSL connections.

Follow the help documentation to configure {{< newtabref href="https://www.charlesproxy.com/documentation/using-charles/ssl-certificates/" title="SSL Certificates" >}}, then open the `Proxy` menu and choose `SSL Proxying Settings...`. Select `Enable SSL Proxying` and configure a wildcard to match our three community servers. Charles even proxies websocket connections!

![image](/blog/2019-10-21-debugging-using-charles/configure-ssl-proxying.png)

After saving these settings and restarting your browser, you should be able to inspect all the traffic to and from {{< newtabref href="https://community.mattermost.com" title="community.mattermost.com" >}} (running our last stable release), {{< newtabref href="https://community-release.mattermost.com" title="community-release.mattermost.com" >}} (running our upcoming stable release), and {{< newtabref href="https://community-daily.mattermost.com" title="community-daily.mattermost.com" >}} (running master):

![image](/blog/2019-10-21-debugging-using-charles/proxying-community.png)

Note that all three of our community server endpoints share the same database, allowing you to switch between the various branches using the same Mattermost account.

## Static Assets vs. Programmatic Interactions

Debugging community using a local webapp involves redirecting requests for static frontend assets to a local directory (or a `localhost` server), while leaving untouched any API calls and other programmatic interactions against the server backend.

There are effectively two kinds of static assets served by the Mattermost application:

* `index.html` is the bootstrapping page that references various favicons alongside the root JavaScript bundle containing the rest of the single page application
* `static/*` are the JavaScript bundles, CSS, images, and plugin resources used in the single page application

Note that the server doesn't actually expect a request for `/index.html`, but serves up this file on any number of paths:

* `/` landing on the site without any path
* `/login` following a login link from an email, or just reloading the page
* `/<team>/` any configured team, such as `core` or our internal `private-core` teams
* `/<team>/<channel>` a channel on any configured team
* `/<team>/pl/<post>` a permalink to a post
* (endless other combinations, including unrecognized paths)

Once the bootstrapping code is served, the application examines the current path and renders the appropriate part of the application.

In addition to the static assets, the server expects a number of programmatic interactions:

* `/api/*` any REST API request
* `/login/sso/saml` login flows via SAML
* `/oauth/*` OAuth application flows
* (various similar endpoints)

Unfortunately, the overlap here between static assets and programmatic interactions makes splitting the routing slightly tricky when redirecting requests locally. For example:

* `/login` should be redirected so as to serve the local `index.html`
* `/login/sso/saml` should be sent to the server to avoid breaking SAML login

## Overriding `community*.mattermost.com` static assets

To configure Charles to redirect requests for static frontend assets, open the `Tools` menu and choose `Map Remote...`:

![image](/blog/2019-10-21-debugging-using-charles/map-remote.png)

(To avoid having to configure these manually, you can also just download and import [map-remote.xml](/blog/2019-10-21-debugging-using-charles/map-remote.xml).)

The rules above yield the following results:

* `/login` is sent to `localhost:8065/login`, serving up `index.html` during the login flow
* `/static/*` is sent to `localhost:8065/static/*`, serving up all static assets
* `/core/*` is sent to `localhost:8065/core/*`, serving up `index.html` for any link on the core team
* `/private-core/*` is sent to `localhost:8065/core/*`, serving up `index.html` for any link on the private core team
* all other paths continue to route directly to the community server

To start your debugging session, first make sure your local Mattermost server is running by following the [Developer Setup](https://developers.mattermost.com/contribute/webapp/developer-setup/) instructions. Then, browse to `/login` against the community server of your choice. If you're not already logged in, this will allow you to complete any necessary login flow (even through SAML!), but you'll get sent back to `/` and what appears to just be a blank page with console errors. Manually head back to `/login` and you'll find yourself successfully logged in on community with all static assets being served up by your local development server instance:

![image](/blog/2019-10-21-debugging-using-charles/debugging-community.png)

There are a shortcomings with this configuration:

* There appears to be no way in Charles to map just `/` to `localhost:8065` without also mapping `/*`, breaking the programmatic endpoints. I've reached out to Charles support for help, but for now, it means that the `/login` flow will be interrupted as described above. Similarly, logging out triggers a blank page and requires manually heading back to `/login`.
* Requests for plugin assets are correctly proxied, but unless you have the exact same versions installed locally, the client-side portion of these plugins fail to load. If you have a different version of the plugin installed, the plugins still won't load since we embed the hash of the file into the request to avoid unexpected caching.

## Conclusion

The configuration above is only the tip of the iceberg when it comes to using Charles for debugging. Think of Charles like an external `Network` tab from the Chrome Developer Tools, but spanning all your tabs across all your applications. Should you run into any networking problems, or just want to stop using Charles altogether, it's easy to turn off the proxy altogether by selecting the `Proxy` menu and unchecking `macOS Proxy`.

If anyone has suggestions on this topic, please feel free to continue the {{< newtabref href="https://community.mattermost.com/core/pl/tmetoow5cpgmbg8ftok4tr6scy" title="conversation on this topic" >}}. I'd love to find a way to optimize the Charles configuration, and even find a way to enable proxying using open source tooling alone.
