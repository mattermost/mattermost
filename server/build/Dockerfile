# Chainguard org registry: runtime packages are installed with Chainguard's chroot method so the apk database,
# and therefore scanners and SBOMs, see them:
# https://www.chainguard.dev/docs/chainguard/containers/building-and-modifying/install-apks-in-distroless-variants
FROM cgr.dev/mattermost.com/static:latest-glibc-tzdata@sha256:36542c5fe401475745257d2ee33717242b5284f3016dce1b9516f9b5ee4c6d37 AS base

FROM cgr.dev/mattermost.com/go:v1.27.3-dev@sha256:b58f86ef28ccbfefda1b86f57cbc5640c7fadaf91c220354cffb2a0da32736ab AS builder
SHELL ["/bin/sh", "-o", "pipefail", "-c"]

# Build Arguments
ARG PUID=2000
ARG PGID=2000
# MM_PACKAGE build arguments controls which version of mattermost to install, defaults to latest stable enterprise
# e.g. https://releases.mattermost.com/9.7.1/mattermost-9.7.1-linux-amd64.tar.gz
ARG MM_PACKAGE="https://latest.mattermost.com/mattermost-enterprise-linux"

RUN apk add --no-cache curl

# static has no glibc, so it is installed here.
# Document extraction for file search (see DOCKER_IMAGE_PLAN.md):
#   poppler-utils: pdfinfo + pdftotext (docconv needs both)
#   unrtf + glibc-iconv: RTF
#   tidy-html5: HTML
#   wv: kept for parity; .doc does not work because wvText is a /bin/sh script
COPY --from=base / /base-chroot
RUN apk add --no-cache --no-scripts --root /base-chroot \
    glibc \
    ld-linux \
    glibc-iconv \
    mailcap \
    poppler-utils \
    tidy-html5 \
    tzdata \
    unrtf \
    wv \
  && ldconfig -r /base-chroot

# CJK PDFs: Wolfi has no poppler-data package. Pinned and checksummed until it ships one.
ARG POPPLER_DATA_VERSION=0.4.12
ARG POPPLER_DATA_SHA256=c835b640a40ce357e1b83666aabd95edffa24ddddd49b8daff63adb851cdab74
RUN curl -fsSL "https://poppler.freedesktop.org/poppler-data-${POPPLER_DATA_VERSION}.tar.gz" \
      -o /tmp/poppler-data.tar.gz \
  && echo "${POPPLER_DATA_SHA256}  /tmp/poppler-data.tar.gz" | sha256sum -c - \
  && tar -xzf /tmp/poppler-data.tar.gz -C /tmp \
  && mkdir -p /base-chroot/usr/share/poppler \
  && cp -a "/tmp/poppler-data-${POPPLER_DATA_VERSION}/cMap" \
           "/tmp/poppler-data-${POPPLER_DATA_VERSION}/cidToUnicode" /base-chroot/usr/share/poppler/ \
  && rm -rf /tmp/poppler-data.tar.gz "/tmp/poppler-data-${POPPLER_DATA_VERSION}"

RUN chown -R "${PUID}:${PGID}" /base-chroot/etc/ssl/certs \
  && chmod 1777 /base-chroot/var/tmp

# Download Mattermost
RUN mkdir -p /mattermost/data /mattermost/plugins /mattermost/client/plugins \
  && curl -L $MM_PACKAGE | tar -xvz \
  && chown -R ${PUID}:${PGID} /mattermost /mattermost/data /mattermost/plugins /mattermost/client/plugins

# Create PostgreSQL client SSL directory structure for ssl_mode=require
RUN mkdir -p /mattermost/.postgresql \
  && chmod 700 /mattermost/.postgresql

# Final stage using distroless for minimal attack surface
FROM scratch

# Some ENV variables
ENV PATH="/mattermost/bin:/usr/sbin:/usr/bin:/sbin:/bin"
ENV MM_SERVICESETTINGS_ENABLELOCALMODE="true"
ENV MM_INSTALL_TYPE="docker"

COPY --from=builder /base-chroot /
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
