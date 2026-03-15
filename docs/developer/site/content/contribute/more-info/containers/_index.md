---
title: "Containers"
heading: "Mattermost containers and official Docker images"
description: "Mattermost uses Docker to publish the official images for the Mattermost Server, and this page lists all Docker repositories in use."
aliases:
  - /contribute/containers
---

Mattermost uses the {{< newtabref href="https://hub.docker.com/u/mattermost" title="Docker Registry" >}} to publish the official images for the Mattermost Server and also for other supporting images that are used for internal/public development and testing.

This page lists all the Docker repositories currently in use.

## Mattermost official docker images

- {{< newtabref href="https://hub.docker.com/r/mattermost/mattermost-enterprise-edition" title="mattermost/mattermost-enterprise-edition" >}} - **Official Mattermost Server** image for the **Enterprise Edition version**. To find the Dockerfile please refer to the {{< newtabref href="https://github.com/mattermost/mattermost/tree/master/server/build" title="GitHub repo" >}}.

- {{< newtabref href="https://hub.docker.com/r/mattermost/mattermost-team-edition" title="mattermost/mattermost-team-edition" >}} - **Official Mattermost Server** image for the **Team Edition version**. To find the Dockerfile please refer to the {{< newtabref href="https://github.com/mattermost/mattermost/tree/master/server/build" title="GitHub repo" >}}.

- {{< newtabref href="https://hub.docker.com/r/mattermost/mattermost-push-proxy" title="mattermost/mattermost-push-proxy" >}} - Mattermost Push Proxy. [Documentation]({{< ref "/contribute/more-info/mobile/push-notifications/service" >}}). {{< newtabref href="https://github.com/mattermost/mattermost-push-proxy" title="GitHub repo" >}}.

- {{< newtabref href="https://hub.docker.com/r/mattermost/mattermost-loadtest" title="mattermost/mattermost-loadtest" >}} - Image for the Load Test application. Tools for profiling Mattermost under heavy load. {{< newtabref href="https://github.com/mattermost/mattermost-load-test" title="GitHub repo" >}}.

- {{< newtabref href="https://hub.docker.com/r/mattermost/mattermost-operator" title="mattermost/mattermost-operator" >}} - Official image for Mattermost Operator for Kubernetes. For more information please refer to the {{< newtabref href="https://github.com/mattermost/mattermost-operator" title="GitHub repo" >}}.

- {{< newtabref href="https://hub.docker.com/r/mattermost/mattermost-cloud" title="mattermost/mattermost-cloud" >}} - Mattermost Private Cloud is a SaaS offering meant to smooth and accelerate the customer journey from trial to full adoption. For more information please refer to the {{< newtabref href="https://github.com/mattermost/mattermost-cloud" title="GitHub repo" >}}.

- {{< newtabref href="https://hub.docker.com/r/mattermost/mattermost-preview" title="mattermost/mattermost-preview" >}} - This is a Docker image to install Mattermost in Preview Mode for exploring product functionality on a single machine using Docker. {{< newtabref href="http://bit.ly/1W76riY" title="Documentation" >}}. {{< newtabref href="https://github.com/mattermost/mattermost-docker-preview" title="GitHub repo" >}}.

- {{< newtabref href="https://hub.docker.com/r/mattermost/platform" title="mattermost/platform" >}} - Mirror of **mattermost/mattermost-preview**. This is a Docker image to install Mattermost in Preview Mode for exploring product functionality on a single machine using Docker. Preview image (mirror). {{< newtabref href="http://bit.ly/1W76riY" title="Documentation" >}}. {{< newtabref href="https://github.com/mattermost/mattermost-docker-preview" title="GitHub repo" >}}.

## Community-maintained Docker images

- {{< newtabref href="https://hub.docker.com/r/mattermost/mattermost-prod-app" title="mattermost/mattermost-prod-app" >}} - Community driven image for Mattermost Server. **This Docker repository will be deprecated in Mattermost 6.0**. For more information and to check the Dockerfile please refer to the {{< newtabref href="https://github.com/mattermost/mattermost-docker" title="GitHub repo" >}}.

- {{< newtabref href="https://hub.docker.com/r/mattermost/mattermost-prod-db" title="mattermost/mattermost-prod-db" >}} - Community driven image for Database to run together with **mattermost/mattermost-prod-app**. **This Docker repository will be deprecated in Mattermost 6.0**. For more information and to check the Dockerfile please refer to the {{< newtabref href="https://github.com/mattermost/mattermost-docker" title="GitHub repo" >}}.

- {{< newtabref href="https://hub.docker.com/r/mattermost/mattermost-prod-web" title="mattermost/mattermost-prod-web" >}} - Community driven image for WebServer to run together with **mattermost/mattermost-prod-app**. **This Docker repository will be deprecated in Mattermost 6.0**. For more information and to check the Dockerfile please refer to the {{< newtabref href="https://github.com/mattermost/mattermost-docker" title="GitHub repo" >}}.

## Mattermost internal Docker images

- {{< newtabref href="https://hub.docker.com/r/mattermost/mattermost-test-enterprise" title="mattermost/mattermost-test-enterprise" >}} - Repository where all testing images are published and available for any type of testing. These images are built from the CircleCI Pipelines from the {{< newtabref href="https://github.com/mattermost/mattermost" title="mattermost-server" >}} and {{< newtabref href="https://github.com/mattermost/mattermost-webapp" title="mattermost-webapp" >}}.

- {{< newtabref href="https://hub.docker.com/r/mattermost/mattermost-test-team" title="mattermost/mattermost-test-team" >}} - Repository where all testing images are published and available for any type of testing. These images are built from the CircleCI Pipelines from the {{< newtabref href="https://github.com/mattermost/mattermost" title="mattermost-server" >}} and {{< newtabref href="https://github.com/mattermost/mattermost-webapp" title="mattermost-webapp" >}}.

- {{< newtabref href="https://hub.docker.com/r/mattermost/mattermost-elasticsearch-docker" title="mattermost/mattermost-elasticsearch-docker" >}} - Used in in CI and for local development. Please refer to the {{< newtabref href="https://github.com/mattermost/mattermost/blob/master/docker-compose.yaml" title="GitHub repo" >}} for more information.

- {{< newtabref href="https://hub.docker.com/r/mattermost/mattermost-build-server" title="mattermost/mattermost-build-server" >}} - Image used to build Mattermost used in CI. To check the Docker file refer to the {{< newtabref href="https://github.com/mattermost/mattermost/blob/master/server/build/Dockerfile.buildenv" title="GitHub repo" >}}.

- {{< newtabref href="https://hub.docker.com/r/mattermost/mattermost-wait-for-dep" title="mattermost/mattermost-wait-for-dep" >}} - Image used to wait for the other containers to start. Used in in CI and for local development. Please refer to the {{< newtabref href="https://github.com/mattermost/mattermost/blob/master/docker-compose.yaml" title="GitHub repo" >}} for more information.

- {{< newtabref href="https://hub.docker.com/r/mattermost/sync-helpwanted-tickets" title="mattermost/sync-helpwanted-tickets" >}} - For internal use. This image runs the sync with Jira tickets and GitHub Issues. To check the code please refer to the {{< newtabref href="https://github.com/mattermost/mattermost-utilities/tree/master/github_jira_tools" title="GitHub repo" >}}.

- {{< newtabref href="https://hub.docker.com/repository/docker/mattermost/podman" title="mattermost/podman" >}} - For internal use. Contains Podman to build/tag/push container images.

- {{< newtabref href="https://hub.docker.com/repository/docker/mattermost/chewbacca-bot" title="mattermost/chewbacca" >}} - For internal use. A GitHub Bot for administrative tasks. Please refer to the {{< newtabref href="https://github.com/mattermost/chewbacca" title="GitHub repo" >}} for more information.

- {{< newtabref href="https://hub.docker.com/repository/docker/mattermost/matterwick" title="mattermost/matterwick" >}} - For internal use. A GitHub Bot to spin test servers for pull requests. Please refer to the {{< newtabref href="https://github.com/mattermost/matterwick" title="GitHub repo" >}} for more information.

- {{< newtabref href="https://hub.docker.com/repository/docker/mattermost/webrtc" title="mattermost/webrtc" >}} - DEPRECATED. Preview docker image of Mattermost WebRTC.
