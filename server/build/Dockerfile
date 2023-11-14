FROM ubuntu:jammy-20230308@sha256:7a57c69fe1e9d5b97c5fe649849e79f2cfc3bf11d10bbd5218b4eb61716aebe6


# Setting bash as our shell, and enabling pipefail option
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Some ENV variables
ENV PATH="/mattermost/bin:${PATH}"
ARG MM_PACKAGE="https://releases.mattermost.com/9.1.2/mattermost-9.1.2-linux-amd64.tar.gz?src=docker"

# Install needed packages and indirect dependencies
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install --no-install-recommends -y \
  ca-certificates \
  curl \
  mime-support \
  unrtf \
  wv \
  poppler-utils \
  tidy \
  tzdata \
  && rm -rf /var/lib/apt/lists/*

# Set mattermost directories and permissions
RUN mkdir -p /mattermost/data /mattermost/plugins /mattermost/client/plugins \
  && if [ -n "$MM_PACKAGE" ]; then curl $MM_PACKAGE | tar -xvz ; \
  else echo "please set the MM_PACKAGE" ; exit 127 ; fi \
  && chmod -R g=u /mattermost /mattermost/data /mattermost/plugins /mattermost/client/plugins

# OpenShift runs containers using an arbitrarily assigned user ID
# The following lines modify the permissions so that the group root can access the necessary files
RUN chgrp -R 0 /mattermost && \
    chmod -R g=u /mattermost /etc/passwd

# Healthcheck to make sure container is ready
HEALTHCHECK --interval=30s --timeout=10s \
  CMD curl -f http://localhost:8065/api/v4/system/ping || exit 1

# Configure entrypoint and command
COPY --chmod=755 entrypoint.sh /
ENTRYPOINT ["/entrypoint.sh"]
WORKDIR /mattermost
CMD ["mattermost"]

EXPOSE 8065 8067 8074 8075

# Declare volumes for mount point directories
VOLUME ["/mattermost/data", "/mattermost/logs", "/mattermost/config", "/mattermost/plugins", "/mattermost/client/plugins"]
