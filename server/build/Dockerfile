# PDF extraction utilities, sourced from Debian 12 rather than the builder below
# because the final stage is gcr.io/distroless/base-debian12, so this matches its
# glibc exactly. Noble Glibc 2.39 vs Debian 12 2.36
FROM debian:12@sha256:6ebd97fa83deb272194a2cf015b3d26a4d538e9ad3a7a79d544c8af5b0a01443 AS poppler
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install --no-install-recommends -y \
  poppler-utils \
  poppler-data \
  && rm -rf /var/lib/apt/lists/*

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

# Install needed packages and indirect dependencies
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install --no-install-recommends -y \
  ca-certificates \
  curl \
  media-types \
  mailcap \
  unrtf \
  wv \
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
COPY --from=poppler /usr/bin/pdftotext /usr/bin/pdftotext

# CJK character data from poppler-data. Without these, a PDF that uses a
# predefined CMap fails with "Missing language pack for 'Adobe-GB1' mapping" and
# yields no text at all. cMap resolves the encoding to CIDs and cidToUnicode maps
# those CIDs to Unicode; both are required. poppler-data's nameToUnicode and
# unicodeMap are not copied because extraction does not consult them.
COPY --from=poppler /usr/share/poppler/cMap /usr/share/poppler/cMap
COPY --from=poppler /usr/share/poppler/cidToUnicode /usr/share/poppler/cidToUnicode
COPY --from=builder /usr/bin/wvText /usr/bin/wvText
COPY --from=builder /usr/bin/wvWare /usr/bin/wvWare
COPY --from=builder /usr/bin/unrtf /usr/bin/unrtf
COPY --from=builder /usr/bin/tidy /usr/bin/tidy
COPY --from=builder /usr/share/wv /usr/share/wv

# Copy necessary libraries for document processing utilities
# pdftotext's runtime dependencies, by exact soname under the Debian/Ubuntu
# multiarch path. Listing each file explicitly rather than globbing /usr/lib/ is
# deliberate: a glob that matches nothing is silently accepted and produces an
# image whose extractor binaries cannot load (see GH-36182), while a missing
# explicit path fails the build. libc.so.6 and libm.so.6 are omitted because the
# base image already provides them at a compatible version.
COPY --from=poppler /usr/lib/x86_64-linux-gnu/libpoppler.so.126 /usr/lib/x86_64-linux-gnu/libpoppler.so.126
COPY --from=poppler /usr/lib/x86_64-linux-gnu/libstdc++.so.6 /usr/lib/x86_64-linux-gnu/libstdc++.so.6
COPY --from=poppler /usr/lib/x86_64-linux-gnu/libgcc_s.so.1 /usr/lib/x86_64-linux-gnu/libgcc_s.so.1
COPY --from=poppler /usr/lib/x86_64-linux-gnu/libfreetype.so.6 /usr/lib/x86_64-linux-gnu/libfreetype.so.6
COPY --from=poppler /usr/lib/x86_64-linux-gnu/libfontconfig.so.1 /usr/lib/x86_64-linux-gnu/libfontconfig.so.1
COPY --from=poppler /usr/lib/x86_64-linux-gnu/libexpat.so.1 /usr/lib/x86_64-linux-gnu/libexpat.so.1
COPY --from=poppler /usr/lib/x86_64-linux-gnu/libpng16.so.16 /usr/lib/x86_64-linux-gnu/libpng16.so.16
COPY --from=poppler /usr/lib/x86_64-linux-gnu/libjpeg.so.62 /usr/lib/x86_64-linux-gnu/libjpeg.so.62
COPY --from=poppler /usr/lib/x86_64-linux-gnu/libtiff.so.6 /usr/lib/x86_64-linux-gnu/libtiff.so.6
COPY --from=poppler /usr/lib/x86_64-linux-gnu/libwebp.so.7 /usr/lib/x86_64-linux-gnu/libwebp.so.7
COPY --from=poppler /usr/lib/x86_64-linux-gnu/libopenjp2.so.7 /usr/lib/x86_64-linux-gnu/libopenjp2.so.7
COPY --from=poppler /usr/lib/x86_64-linux-gnu/liblcms2.so.2 /usr/lib/x86_64-linux-gnu/liblcms2.so.2
COPY --from=poppler /usr/lib/x86_64-linux-gnu/libLerc.so.4 /usr/lib/x86_64-linux-gnu/libLerc.so.4
COPY --from=poppler /usr/lib/x86_64-linux-gnu/libjbig.so.0 /usr/lib/x86_64-linux-gnu/libjbig.so.0
COPY --from=poppler /usr/lib/x86_64-linux-gnu/libdeflate.so.0 /usr/lib/x86_64-linux-gnu/libdeflate.so.0
COPY --from=poppler /usr/lib/x86_64-linux-gnu/liblzma.so.5 /usr/lib/x86_64-linux-gnu/liblzma.so.5
COPY --from=poppler /usr/lib/x86_64-linux-gnu/libzstd.so.1 /usr/lib/x86_64-linux-gnu/libzstd.so.1
COPY --from=poppler /usr/lib/x86_64-linux-gnu/libz.so.1 /usr/lib/x86_64-linux-gnu/libz.so.1
COPY --from=poppler /usr/lib/x86_64-linux-gnu/libbrotlidec.so.1 /usr/lib/x86_64-linux-gnu/libbrotlidec.so.1
COPY --from=poppler /usr/lib/x86_64-linux-gnu/libbrotlicommon.so.1 /usr/lib/x86_64-linux-gnu/libbrotlicommon.so.1
COPY --from=poppler /usr/lib/x86_64-linux-gnu/libnss3.so /usr/lib/x86_64-linux-gnu/libnss3.so
COPY --from=poppler /usr/lib/x86_64-linux-gnu/libnssutil3.so /usr/lib/x86_64-linux-gnu/libnssutil3.so
COPY --from=poppler /usr/lib/x86_64-linux-gnu/libsmime3.so /usr/lib/x86_64-linux-gnu/libsmime3.so
COPY --from=poppler /usr/lib/x86_64-linux-gnu/libnspr4.so /usr/lib/x86_64-linux-gnu/libnspr4.so
COPY --from=poppler /usr/lib/x86_64-linux-gnu/libplc4.so /usr/lib/x86_64-linux-gnu/libplc4.so
COPY --from=poppler /usr/lib/x86_64-linux-gnu/libplds4.so /usr/lib/x86_64-linux-gnu/libplds4.so
COPY --from=builder /usr/lib/libwv.so* /usr/lib/
COPY --from=builder /usr/lib/libtidy.so* /usr/lib/

# Copy mattermost from builder stage
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
