---
title: Tools
heading: "Mattermost Server tools"
description: "Learn more about the tooling that is required to set up the developer's environment."
date: 2020-04-22T17:52:04-05:00
weight: 10
aliases:
  - /contribute/server/tooling
---

## Mattermost Server

In the {{< newtabref href="https://github.com/mattermost/mattermost" title="mattermost repository" >}}, we are using {{< newtabref href="https://www.docker.com/" title="Docker" >}} images and {{< newtabref href="https://docs.docker.com/compose/" title="Docker Compose" >}} to set up the development enviroment. The following are required images:

- {{< newtabref href="https://www.mysql.com/" title="MySQL" >}}
- {{< newtabref href="https://www.postgresql.org/" title="PostgreSQL" >}}
- {{< newtabref href="https://min.io/" title="MinIO" >}}
- {{< newtabref href="https://www.inbucket.org/" title="Inbucket" >}}
- {{< newtabref href="https://www.openldap.org/" title="OpenLDAP" >}}
- {{< newtabref href="https://www.elastic.co" title="Elasticsearch" >}}

We also have added optional tools to help with your development:

### Dejavu

{{< newtabref href="https://opensource.appbase.io/dejavu/" title="Dejavu" >}} is a user interface for Elasticsearch when no UI is provided to visualize or modify the data you're storing inside Elasticsearch.

To use Dejavu, execute `docker-compose up -d dejavu`. It will run at `http://localhost:1358`.
