---
title: "Streamlining Developer Access to Prometheus and Grafana"
slug: streamlining-developer-access-to-prometheus-and-grafana
date: 2021-02-02T00:00:00-04:00
categories:
    - "testing"
    - "performance"
author: Jesse Hallam
github: lieut-data
community: jesse.hallam
summary: With access to the Enterprise source code, the developer build tooling now automates the setup of Prometheus and Grafana for performance monitoring. Even the canonical Grafana dashboards are setup without any manual configuration required!
---

Our {{< newtabref href="https://github.com/mattermost/mattermost/blob/master/Makefile" title="Makefile" >}} entrypoint for developing against the {{< newtabref href="https://github.com/mattermost/mattermost" title="Mattermost Server" >}} already tries to simplify things for developers as much as possible.

For example, when invoking `make run-server`, this build tooling takes care of all of the following (among other things!):
* Downloading a suitable version of `mmctl` for API-driven command line interaction.
* Checking your installed Go version to avoid cryptic error messages.
* Downloading and starting various Docker containers:
    - `mysql` and `postgres`, both for a backend to the server and also to automate tests.
    - `inbucket` to simplify email testing without routing outside your machine.
    - `minio` to expose an S3-compatible interface to your local disk for hosting uploaded files
    - `openldap` to simplify testing alternate modes of authentication (requires access to the enterprise source).
    - `elasticsearch` to expose an improved search backend for posts and channels (requires access to the Enterprise source code).
* Linking your server to an automatically-detected `mattermost-webapp` directory.
* Optionally starting the server in the foreground if `RUN_SERVER_IN_BACKGROUND` is `false`.
* Piping the structured server logs through a `logrus` decorator for easier reading.
* Invoking the `go` compiler to run the server code in your local repository.

### Adding Prometheus and Grafana

As of https://github.com/mattermost/mattermost/pull/16649, this build tooling now supports automating the setup of Prometheus and Grafana Docker containers. Together, these tools form the backbone of our {{< newtabref href="https://docs.mattermost.com/deployment/metrics.html" title="Performance Monitoring (E20)" >}} functionality, scraping metrics from Mattermost to help give enterprise customers insight into the performance of their clusters. Automating this setup makes it easier for developers to test in a production-like environment, to help extend the monitoring available to customers, and even to run our certain kinds of loadtests using our {{< newtabref href="https://github.com/mattermost/mattermost-load-test-ng" title="loadtesting framework" >}}.

Since the corresponding Mattermost functionality is only available with access to the Enterprise source code, these containers aren't enabled by default. To turn them on, export the following environment variable into your shell:
```
export ENABLED_DOCKER_SERVICES="mysql postgres inbucket prometheus grafana"
```
Alternatively, you can follow the instructions in {{< newtabref href="https://github.com/mattermost/mattermost/blob/master/config.mk" title="config.mk" >}}. Note that it's not necessary to specify `minio`, `openldap`, or `elasticsearch` - these are added automatically when an Enterprise-enabled repository is detected.

The build tooling does more than just spin up two new containers, however. {{< newtabref href="https://github.com/mattermost/mattermost/tree/master/server/build/docker" title="Various configuration files" >}} also automate the following:

* Configuring Prometheus to scrape the Mattermost `:8067/metrics` endpoint (requires access to the Enterprise source code).
* Enabling anonymous access to Grafana (you can still log in with the default `admin`/`admin` credentials if needed).
* Configuring Grafana with the containerized Prometheus as the default data source.
* Installing our canonical Grafana dashboards ({{< newtabref href="https://grafana.com/grafana/dashboards/2539" title="Mattermost Performance KPI Metrics" >}}, {{< newtabref href="https://grafana.com/grafana/dashboards/2542" title="Mattermost Performance Monitoring" >}}, {{< newtabref href="https://grafana.com/grafana/dashboards/2545" title="Mattermost Performance Monitoring (Bonus Metrics)" >}}).

This means that simply running `make run-server` gets you immediate access to the Mattermost Performance dashboards at `http://localhost:3000`:

![Grafana home dashboard](/blog/2021-02-02-streamlining-developer-access-to-prometheus-and-grafana/grafana.png)

Prometheus is also available at `http://localhost:9090`:

![Prometheus landing page](/blog/2021-02-02-streamlining-developer-access-to-prometheus-and-grafana/prometheus.png)

### Enabling Metrics

Although the tooling is all set up to scrape metrics and display the dashboards, you'll need to do some one-time work to enable metrics within the Mattermost server.

First, be sure you have an Enterprise license installed. Staff members should have access to the shared developer license, but you can also request a trial license in-product. Browse to `/admin_console/about/license` on your local Mattermost instance to set up the license.

Second, enable performance monitoring. You can do this manually via `config.json` and setting `MetricsSettings.Enable` to `true`, or by exporting `MM_METRICSSETTINGS_ENABLE=true` into your shell before starting the server, or by enabling this manually via the System Console at `/admin_console/environment/performance_monitoring`:

![Performance monitoring configuration](/blog/2021-02-02-streamlining-developer-access-to-prometheus-and-grafana/performance-monitoring-config.png)

### What's next?

These changes weren't just made in isolation - in fact, this is all just infrastructure work for another recent project to improve Mattermost performance monitoring. Stay tuned for a follow-up blog post!
