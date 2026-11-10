---
title: "Tools"
sidebar_position: 10
---

## Mattermost Server

In the [mattermost repository](https://github.com/mattermost/mattermost), we are using [Docker](https://www.docker.com/) images and [Docker Compose](https://docs.docker.com/compose/) to set up the development enviroment. The following are required images:

- [MySQL](https://www.mysql.com/)
- [PostgreSQL](https://www.postgresql.org/)
- [MinIO](https://min.io/)
- [Inbucket](https://www.inbucket.org/)
- [OpenLDAP](https://www.openldap.org/)
- [Elasticsearch](https://www.elastic.co)

We also have added optional tools to help with your development:

### Dejavu

[Dejavu](https://opensource.appbase.io/dejavu/) is a user interface for Elasticsearch when no UI is provided to visualize or modify the data you're storing inside Elasticsearch.

To use Dejavu, execute `docker-compose up -d dejavu`. It will run at `http://localhost:1358`.
