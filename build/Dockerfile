FROM debian:buster-slim@sha256:5b0b1a9a54651bbe9d4d3ee96bbda2b2a1da3d2fa198ddebbced46dfdca7f216

# Setting bash as our shell, and enabling pipefail option
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Some ENV variables
ENV PATH="/mattermost/bin:${PATH}"
ARG PUID=2000
ARG PGID=2000
ARG MM_PACKAGE="https://releases.mattermost.com/7.0.0/mattermost-7.0.0-linux-amd64.tar.gz?src=docker"

# # Install needed packages
RUN apt-get update \
  && apt-get install --no-install-recommends -y \
  ca-certificates=20200601~deb10u2 \
  curl=7.64.0-4+deb10u2 \
  mime-support=3.62 \
  unrtf=0.21.10-clean-1 \
  wv=1.2.9-4.2+b2 \
  poppler-utils=0.71.0-5 \
  tidy=2:5.6.0-10 \
  && rm -rf /var/lib/apt/lists/*

# Set mattermost group/user and download Mattermost
RUN mkdir -p /mattermost/data /mattermost/plugins /mattermost/client/plugins \
    && addgroup -gid ${PGID} mattermost \
    && adduser -q --disabled-password --uid ${PUID} --gid ${PGID} --gecos "" --home /mattermost mattermost \
    && if [ -n "$MM_PACKAGE" ]; then curl $MM_PACKAGE | tar -xvz ; \
    else echo "please set the MM_PACKAGE" ; exit 127 ; fi \
    && chown -R mattermost:mattermost /mattermost /mattermost/data /mattermost/plugins /mattermost/client/plugins

# We should refrain from running as privileged user
USER mattermost

#Healthcheck to make sure container is ready
HEALTHCHECK --interval=30s --timeout=10s \
  CMD curl -f http://localhost:8065/api/v4/system/ping || exit 1

# Configure entrypoint and command
COPY entrypoint.sh /
ENTRYPOINT ["/entrypoint.sh"]
WORKDIR /mattermost
CMD ["mattermost"]

EXPOSE 8065 8067 8074 8075

# Declare volumes for mount point directories
VOLUME ["/mattermost/data", "/mattermost/logs", "/mattermost/config", "/mattermost/plugins", "/mattermost/client/plugins"]

