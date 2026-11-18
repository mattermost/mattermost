# Releases use the Chainguard org images. Without org access, override with the public images (best-effort, unpinned):
#   --build-arg BASE_IMAGE=cgr.dev/chainguard/static:latest-glibc --build-arg BUILDER_IMAGE=cgr.dev/chainguard/go:latest-dev
ARG BASE_IMAGE=cgr.dev/mattermost.com/static:latest-glibc-tzdata@sha256:24b478e60886e5312178582a4e92c3279436f0fb27f77574d6dead1c7515f9ca
ARG BUILDER_IMAGE=cgr.dev/mattermost.com/go:v1.27.4-dev@sha256:b6a19327050733f9428d8927d13c55338ebe699be0d9deab481208ad798f1c08

FROM ${BASE_IMAGE} AS base

FROM ${BUILDER_IMAGE} AS builder
SHELL ["/bin/sh", "-o", "pipefail", "-c"]

# Build Arguments
ARG PUID=2000
ARG PGID=2000
# MM_PACKAGE build arguments controls which version of mattermost to install, defaults to latest stable enterprise
# e.g. https://releases.mattermost.com/9.7.1/mattermost-9.7.1-linux-amd64.tar.gz
ARG MM_PACKAGE="https://latest.mattermost.com/mattermost-enterprise-linux"

RUN apk add --no-cache curl

# static has no glibc, so it is installed here.
# Document extraction for file search:
#   poppler-utils: pdfinfo + pdftotext (docconv needs both)
#   unrtf + glibc-iconv: RTF
#   tidy-html5: HTML
#   wv: kept for parity; .doc does not work because wvText is a /bin/sh script
# Packages are installed into a chroot copy of the base, so the apk database (and scanners/SBOMs) track them:
# https://www.chainguard.dev/docs/chainguard/containers/building-and-modifying/install-apks-in-distroless-variants
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
RUN curl -fsSL --retry 3 --connect-timeout 30 --max-time 120 \
      "https://poppler.freedesktop.org/poppler-data-${POPPLER_DATA_VERSION}.tar.gz" \
      -o /tmp/poppler-data.tar.gz \
  && echo "${POPPLER_DATA_SHA256}  /tmp/poppler-data.tar.gz" | sha256sum -c - \
  && tar -xzf /tmp/poppler-data.tar.gz -C /tmp --no-same-owner \
  && mkdir -p /base-chroot/usr/share/poppler /base-chroot/usr/share/licenses/poppler-data \
  && cp -a "/tmp/poppler-data-${POPPLER_DATA_VERSION}/cMap" \
           "/tmp/poppler-data-${POPPLER_DATA_VERSION}/cidToUnicode" /base-chroot/usr/share/poppler/ \
  && cp "/tmp/poppler-data-${POPPLER_DATA_VERSION}/COPYING" \
        "/tmp/poppler-data-${POPPLER_DATA_VERSION}/COPYING.adobe" \
        "/tmp/poppler-data-${POPPLER_DATA_VERSION}/COPYING.gpl2" /base-chroot/usr/share/licenses/poppler-data/ \
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
