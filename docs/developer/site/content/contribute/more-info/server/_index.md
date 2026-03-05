---
title: "Server"
heading: "Contribute to the Mattermost Server"
description: "The server, which is written in Go and compiles on a single binary, is the highly scalable backbone of the Mattermost project."
date: "2018-04-19T12:01:23-04:00"
weight: 2
aliases:
  - /contribute/server
---

The server is the highly scalable backbone of the Mattermost project. Written in Go, it compiles to a single, standalone binary. It's generally stateless except for the WebSocket connections and some in-memory caches.

Communication with Mattermost clients and integrations mainly occurs through the RESTful JSON web API and WebSocket connections primarily used for event delivery.

Data storage is done with MySQL or PostgreSQL for non-binary data. Files are stored locally, on network drives or in a service such as S3 or Minio.

## Repository

https://github.com/mattermost/mattermost

## Server packages

The server consists of several different Go packages:

* `api4` - Version 4 of the RESTful JSON Web Service
* `app` - Logic layer for getting, modifying, and interacting with models
* `cmd` - Command line interface
* `einterfaces` - Interfaces for Enterprise Edition features
* `jobs` - Job server and scheduling
* `model` - Definitions and helper functions for data models
* `store` - Storage layer for interacting with caches and databases
* `utils` - Utility functions for various tasks
* `web` - Serves static pages
