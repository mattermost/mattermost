---
title: "Containers"
---

Mattermost uses the [Docker Registry](https://hub.docker.com/u/mattermost) to publish the official images for the Mattermost Server and also for other supporting images that are used for internal/public development and testing.

This page lists all the Docker repositories currently in use.

## Mattermost official docker images

- [mattermost/mattermost-enterprise-edition](https://hub.docker.com/r/mattermost/mattermost-enterprise-edition) - **Official Mattermost Server** image for the **Enterprise Edition version**. To find the Dockerfile please refer to the [GitHub repo](https://github.com/mattermost/mattermost/tree/master/server/build).

- [mattermost/mattermost-team-edition](https://hub.docker.com/r/mattermost/mattermost-team-edition) - **Official Mattermost Server** image for the **Team Edition version**. To find the Dockerfile please refer to the [GitHub repo](https://github.com/mattermost/mattermost/tree/master/server/build).

- [mattermost/mattermost-push-proxy](https://hub.docker.com/r/mattermost/mattermost-push-proxy) - Mattermost Push Proxy. [Documentation](/developers/contribute/more-info/mobile/push-notifications/service). [GitHub repo](https://github.com/mattermost/mattermost-push-proxy).

- [mattermost/mattermost-loadtest](https://hub.docker.com/r/mattermost/mattermost-loadtest) - Image for the Load Test application. Tools for profiling Mattermost under heavy load. [GitHub repo](https://github.com/mattermost/mattermost-load-test).

- [mattermost/mattermost-operator](https://hub.docker.com/r/mattermost/mattermost-operator) - Official image for Mattermost Operator for Kubernetes. For more information please refer to the [GitHub repo](https://github.com/mattermost/mattermost-operator).

- [mattermost/mattermost-cloud](https://hub.docker.com/r/mattermost/mattermost-cloud) - Mattermost Private Cloud is a SaaS offering meant to smooth and accelerate the customer journey from trial to full adoption. For more information please refer to the [GitHub repo](https://github.com/mattermost/mattermost-cloud).

- [mattermost/mattermost-preview](https://hub.docker.com/r/mattermost/mattermost-preview) - This is a Docker image to install Mattermost in Preview Mode for exploring product functionality on a single machine using Docker. [Documentation](http://bit.ly/1W76riY). [GitHub repo](https://github.com/mattermost/mattermost-docker-preview).

- [mattermost/platform](https://hub.docker.com/r/mattermost/platform) - Mirror of **mattermost/mattermost-preview**. This is a Docker image to install Mattermost in Preview Mode for exploring product functionality on a single machine using Docker. Preview image (mirror). [Documentation](http://bit.ly/1W76riY). [GitHub repo](https://github.com/mattermost/mattermost-docker-preview).

## Community-maintained Docker images

- [mattermost/mattermost-prod-app](https://hub.docker.com/r/mattermost/mattermost-prod-app) - Community driven image for Mattermost Server. **This Docker repository will be deprecated in Mattermost 6.0**. For more information and to check the Dockerfile please refer to the [GitHub repo](https://github.com/mattermost/mattermost-docker).

- [mattermost/mattermost-prod-db](https://hub.docker.com/r/mattermost/mattermost-prod-db) - Community driven image for Database to run together with **mattermost/mattermost-prod-app**. **This Docker repository will be deprecated in Mattermost 6.0**. For more information and to check the Dockerfile please refer to the [GitHub repo](https://github.com/mattermost/mattermost-docker).

- [mattermost/mattermost-prod-web](https://hub.docker.com/r/mattermost/mattermost-prod-web) - Community driven image for WebServer to run together with **mattermost/mattermost-prod-app**. **This Docker repository will be deprecated in Mattermost 6.0**. For more information and to check the Dockerfile please refer to the [GitHub repo](https://github.com/mattermost/mattermost-docker).

## Mattermost internal Docker images

- [mattermost/mattermost-test-enterprise](https://hub.docker.com/r/mattermost/mattermost-test-enterprise) - Repository where all testing images are published and available for any type of testing. These images are built from the CircleCI Pipelines from the [mattermost-server](https://github.com/mattermost/mattermost) and [mattermost-webapp](https://github.com/mattermost/mattermost-webapp).

- [mattermost/mattermost-test-team](https://hub.docker.com/r/mattermost/mattermost-test-team) - Repository where all testing images are published and available for any type of testing. These images are built from the CircleCI Pipelines from the [mattermost-server](https://github.com/mattermost/mattermost) and [mattermost-webapp](https://github.com/mattermost/mattermost-webapp).

- [mattermost/mattermost-elasticsearch-docker](https://hub.docker.com/r/mattermost/mattermost-elasticsearch-docker) - Used in in CI and for local development. Please refer to the [GitHub repo](https://github.com/mattermost/mattermost/blob/master/docker-compose.yaml) for more information.

- [mattermost/mattermost-build-server](https://hub.docker.com/r/mattermost/mattermost-build-server) - Image used to build Mattermost used in CI. To check the Docker file refer to the [GitHub repo](https://github.com/mattermost/mattermost/blob/master/server/build/Dockerfile.buildenv).

- [mattermost/mattermost-wait-for-dep](https://hub.docker.com/r/mattermost/mattermost-wait-for-dep) - Image used to wait for the other containers to start. Used in in CI and for local development. Please refer to the [GitHub repo](https://github.com/mattermost/mattermost/blob/master/docker-compose.yaml) for more information.

- [mattermost/sync-helpwanted-tickets](https://hub.docker.com/r/mattermost/sync-helpwanted-tickets) - For internal use. This image runs the sync with Jira tickets and GitHub Issues. To check the code please refer to the [GitHub repo](https://github.com/mattermost/mattermost-utilities/tree/master/github_jira_tools).

- [mattermost/podman](https://hub.docker.com/repository/docker/mattermost/podman) - For internal use. Contains Podman to build/tag/push container images.

- [mattermost/chewbacca](https://hub.docker.com/repository/docker/mattermost/chewbacca-bot) - For internal use. A GitHub Bot for administrative tasks. Please refer to the [GitHub repo](https://github.com/mattermost/chewbacca) for more information.

- [mattermost/matterwick](https://hub.docker.com/repository/docker/mattermost/matterwick) - For internal use. A GitHub Bot to spin test servers for pull requests. Please refer to the [GitHub repo](https://github.com/mattermost/matterwick) for more information.

- [mattermost/webrtc](https://hub.docker.com/repository/docker/mattermost/webrtc) - DEPRECATED. Preview docker image of Mattermost WebRTC.
