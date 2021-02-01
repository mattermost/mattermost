FROM alpine:3.12

# Some ENV variables
ENV PATH="/mattermost/bin:${PATH}"
ARG PUID=2000
ARG PGID=2000
ARG MM_PACKAGE="https://releases.mattermost.com/5.31.0/mattermost-5.31.0-linux-amd64.tar.gz?src=docker"


# Install some needed packages
RUN apk add --no-cache \
  ca-certificates \
  curl \
  libc6-compat \
  libffi-dev \
  linux-headers \
  mailcap \
  netcat-openbsd \
  xmlsec-dev \
  tzdata \
  && rm -rf /tmp/*

# Get Mattermost
RUN mkdir -p /mattermost/data /mattermost/plugins /mattermost/client/plugins \
  && if [ ! -z "$MM_PACKAGE" ]; then curl $MM_PACKAGE | tar -xvz ; \
  else echo "please set the MM_PACKAGE" ; fi \
  && addgroup -g ${PGID} mattermost \
  && adduser -D -u ${PUID} -G mattermost -h /mattermost -D mattermost \
  && chown -R mattermost:mattermost /mattermost /mattermost/plugins /mattermost/client/plugins

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
