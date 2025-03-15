FROM ubuntu:noble-20240605@sha256:2e863c44b718727c860746568e1d54afd13b2fa71b160f5cd9058fc436217b30

# Setting bash as our shell, and enabling pipefail option
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Some ENV variables
ENV PATH="/mattermost/bin:${PATH}"

# Build Arguments
ARG PUID=2000
ARG PGID=2000
# MM_PACKAGE build arguments controls which version of mattermost to install, defaults to latest stable enterprise
# i.e. https://releases.mattermost.com/9.7.1/mattermost-9.7.1-linux-amd64.tar.gz
ARG MM_PACKAGE="https://nimbupani-chat-builds.s3.us-east-1.amazonaws.com/test/nimbupani-mm-amd64.tar.gz?response-content-disposition=inline&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Security-Token=IQoJb3JpZ2luX2VjELH%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLWVhc3QtMSJHMEUCIH0%2BCXMfcfApkyJAoblQg1%2Bg3ZHXTL7Hg0dL1qh3gaDjAiEAsjcDCA759cxZGeRu8QjrQrWf5N39z4byQ%2B71eDWwWjkq1AMI%2Bv%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARAAGgwyMTExMjU3NDA3NzYiDFC8D%2BFke76pJ9W%2FJyqoAxFaAjyCL2Fr59IUTGATFBvCwJ%2BqvZQqD%2BVD7329tH8Zt56gxMqrSDk%2F8azSFKTGqmfNWocJ6q0BOe39JhZgacSiRVl4m4xT0Gj22I8OAwu%2BwTdn9ZN82UDhqvM7hdK5L1D3Pd6jCxvICqSDUQHusgrppKAi1EO2MUYubC1u7UJvogXSk4%2FCzBmq%2B3IyhcbDIidF8Fk2Zxr0jxAs2%2B4LGi2YcMzBNrvs%2BhJBvkMjOzSmhrzu9LXi9b2hq5jSb0HpL1OslNr6EVHOi%2FZr690jornTXycTkFKlLNy16o%2FlK92O9dJyKwZ%2Fnf1eabYArhe5qx77YNdvMvC%2BwqpQhxwwNk4AAkXJJREC9udtE0wDUKxOT2wks%2FZUG0duMrfFI2UofW9tQNYoRCvQLwu%2BSgriXe7ivpCegzgmqXhq4%2FZKWex%2FUhhquXYKv3pP8KdtX9Sw8wkJ1FwZ1B6oyIHcBptyyU7%2FixwbNRoY0tvln0aR3NgkrbxN8RLW4jY2%2B1AbFiWBWY4FeVZot9aX%2FsdRPPWNeaLXRkYvmuofhhKlDpQH2az6a3PUH8dcBxkwj%2FLRvgY65AIk%2BJX4wgSHpLElqHGqKwQ%2FM7EcYTbqgXawlHR5QmKMr3xmkO%2FF1TMMamsDnFDSPqQOONFWwv5vsG0JS%2FmC6gtlKPvAYzFvQQZ0ZmrAr1mbg97vRsuIf3OZb1SRI16K94dtc%2FIGRR0f7jqGKojHlGH%2Bore%2BgVrSjDcu%2BTFNSQJ2B3loVi9gP61AuI3r6MQ264bV2v3hX%2B3%2BjT9Mwswi1M4GOL7LcVLgcqpeWrEpywGvlG0CxyjM2Srw1vHlAraQMqIhHKjPfXHBKAeoTGpL1fw2W0BM5HiAt%2Bho7x2UPXGSo8FSpnDeQjUuRnaQ5bS3VM%2FWBnFKr181oITFmn76WWzpas8CqKJRvb1oRX5rjGalYnjEMh%2F7mZ0sMBd4WsTEBlpBjZmMctat3TvD8n15am8XUiDe2ahSUj4Kqi0u5MtBzmHpJ%2F4k3ofmXlxv2bnG4Jpqgo%2Bb2PzQGVqWvdVAVceD%2B1KsKA%3D%3D&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIATCKATETUFF7WPVYQ%2F20250315%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20250315T002812Z&X-Amz-Expires=720&X-Amz-SignedHeaders=host&X-Amz-Signature=12a0bc32c74c7708cfccd301dadf4342f435914fffdc2a9b7f0e4b266cbb04f9"

# # Install needed packages and indirect dependencies
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install --no-install-recommends -y \
  ca-certificates \
  curl \
  media-types \
  mailcap \
  unrtf \
  wv \
  poppler-utils \
  tidy \
  tzdata \
  && rm -rf /var/lib/apt/lists/*

# Set mattermost group/user and download Mattermost
RUN mkdir -p /mattermost/data /mattermost/plugins /mattermost/client/plugins \
  && groupadd --gid ${PGID} mattermost \
  && useradd --uid ${PUID} --gid ${PGID} --comment "" --home-dir /mattermost mattermost \
  && curl -L $MM_PACKAGE | tar -xvz \
  && chown -R mattermost:mattermost /mattermost /mattermost/data /mattermost/plugins /mattermost/client/plugins

# We should refrain from running as privileged user
USER mattermost

# We should refrain from running as privileged user
USER mattermost

# Healthcheck to make sure container is ready
HEALTHCHECK --interval=30s --timeout=10s \
  CMD curl -f http://localhost:8065/api/v4/system/ping || exit 1

# Configure entrypoint and command with proper permissions
COPY --chown=mattermost:mattermost --chmod=765 entrypoint.sh /
ENTRYPOINT ["/entrypoint.sh"]
WORKDIR /mattermost
CMD ["mattermost"]

EXPOSE 8065 8067 8074 8075

# Declare volumes for mount point directories
VOLUME ["/mattermost/data", "/mattermost/logs", "/mattermost/config", "/mattermost/plugins", "/mattermost/client/plugins"]
