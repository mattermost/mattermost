# First stage - Ubuntu with document processing dependencies and curl for downloading
FROM ubuntu:noble-20251013@sha256:c35e29c9450151419d9448b0fd75374fec4fff364a27f176fb458d472dfc9e54 AS builder
# Setting bash as our shell, and enabling pipefail option
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Build Arguments
ARG PUID=2000
ARG PGID=2000
# MM_PACKAGE build arguments controls which version of mattermost to install, defaults to latest stable enterprise
# e.g. https://releases.mattermost.com/9.7.1/mattermost-9.7.1-linux-amd64.tar.gz
ARG MM_PACKAGE="https://latest.mattermost.com/mattermost-enterprise-linux"

# Message-Based Encryption demo: the release bundle carries its own SoftHSM runtime, so the image
# only needs to prepackage the signed plugin. pr-builds is public because this repository is private;
# pin the release and platform used by each cloud image build. Test image only.
ARG MBE_PLUGIN_VERSION="v0.1.1"
ARG MBE_PLUGIN_PLATFORM="linux-amd64"
ARG MBE_PLUGIN_URL="https://pr-builds.mattermost.com/mattermost-plugin-message-based-encryption/release/${MBE_PLUGIN_VERSION}/${MBE_PLUGIN_PLATFORM}/message-based-encryption.tar.gz"
ARG MBE_PLUGIN_SIG_URL="${MBE_PLUGIN_URL}.sig"

# Install needed packages and indirect dependencies
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

# Create PostgreSQL client SSL directory structure for ssl_mode=require
RUN mkdir -p /mattermost/.postgresql \
  && chmod 700 /mattermost/.postgresql

# Message-Based Encryption tech-preview: fetch the signed MBE plugin bundle + .sig into the
# prepackaged_plugins dir already populated by MM_PACKAGE. The server verifies it against the baked
# demo key, and the MBE plugin-state override auto-installs and activates it without replacing
# cloud's PluginStates map. The plugin provisions its bundled SoftHSM runtime on activation, with no
# image packages, HSM environment variables, or feature flags required. Test image only.
RUN mkdir -p /mattermost/prepackaged_plugins \
  && curl -fL "$MBE_PLUGIN_URL" -o /mattermost/prepackaged_plugins/message-based-encryption.tar.gz \
  && curl -fL "$MBE_PLUGIN_SIG_URL" -o /mattermost/prepackaged_plugins/message-based-encryption.tar.gz.sig \
  && chown mattermost:mattermost /mattermost/prepackaged_plugins/message-based-encryption.tar.gz /mattermost/prepackaged_plugins/message-based-encryption.tar.gz.sig

# Final stage using distroless for minimal attack surface
FROM gcr.io/distroless/base-debian12

# Some ENV variables
ENV PATH="/mattermost/bin:${PATH}"
ENV MM_SERVICESETTINGS_ENABLELOCALMODE="true"
ENV MM_INSTALL_TYPE="docker"

# Copy over metadata files needed by runtime
COPY --from=builder /etc/mime.types /etc

# Copy CA certificates for SSL/TLS validation with proper ownership
COPY --from=builder --chown=2000:2000 /etc/ssl/certs /etc/ssl/certs

# Copy document processing utilities and necessary support files
COPY --from=builder /usr/bin/pdftotext /usr/bin/pdftotext
COPY --from=builder /usr/bin/wvText /usr/bin/wvText
COPY --from=builder /usr/bin/wvWare /usr/bin/wvWare
COPY --from=builder /usr/bin/unrtf /usr/bin/unrtf
COPY --from=builder /usr/bin/tidy /usr/bin/tidy
COPY --from=builder /usr/share/wv /usr/share/wv

# Copy necessary libraries for document processing utilities
COPY --from=builder /usr/lib/libpoppler.so* /usr/lib/
COPY --from=builder /usr/lib/libfreetype.so* /usr/lib/
COPY --from=builder /usr/lib/libpng.so* /usr/lib/
COPY --from=builder /usr/lib/libwv.so* /usr/lib/
COPY --from=builder /usr/lib/libtidy.so* /usr/lib/
COPY --from=builder /usr/lib/libfontconfig.so* /usr/lib/

# Copy mattermost from builder stage (includes the MBE plugin bundle + .sig fetched into
# prepackaged_plugins above; prepackaged_plugins is deliberately NOT a VOLUME below, so it survives).
COPY --from=builder --chown=2000:2000 /mattermost /mattermost

# Copy passwd including mattermost user
COPY  passwd /etc/passwd

# We should refrain from running as privileged user
USER mattermost

# Healthcheck to make sure container is ready - using mmctl instead of curl for distroless compatibility
HEALTHCHECK --interval=30s --timeout=10s \
  CMD ["/mattermost/bin/mmctl", "system", "status", "--local"]

# Configure entrypoint and command with proper permissions
WORKDIR /mattermost
CMD ["/mattermost/bin/mattermost"]

EXPOSE 8065 8067 8074

# Declare volumes for mount point directories
VOLUME ["/mattermost/data", "/mattermost/logs", "/mattermost/config", "/mattermost/plugins", "/mattermost/client/plugins"]
