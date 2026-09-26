# Chainguard lineage (public free catalog, no registry auth).
#   FROM cgr.dev/chainguard/wolfi-base@sha256:<digest> AS builder
#   FROM cgr.dev/chainguard/glibc-dynamic@sha256:<digest>
FROM cgr.dev/chainguard/wolfi-base@sha256:b6bfe8564bb0630778b04df06b42e78acf221e9540703cfc03d040ab7f91e357 AS builder
SHELL ["/bin/sh", "-o", "pipefail", "-c"]

ARG PUID=2000
ARG PGID=2000
ARG MM_PACKAGE="https://latest.mattermost.com/mattermost-enterprise-linux"

USER 0:0
# poppler-utils: PDF feature to text extraction for file search indexing.
RUN apk add --no-cache \
  curl \
  ca-certificates \
  mailcap \
  unrtf \
  wv \
  poppler-utils \
  tidy-html5 \
  tzdata

RUN mkdir -p /mattermost/data /mattermost/plugins /mattermost/client/plugins \
  && addgroup -g ${PGID} mattermost \
  && adduser -D -u ${PUID} -G mattermost -g "" -s /bin/sh -h /mattermost mattermost \
  && curl -L $MM_PACKAGE | tar -xvz \
  && chown -R mattermost:mattermost /mattermost /mattermost/data /mattermost/plugins /mattermost/client/plugins

# Create PostgreSQL client SSL directory structure for ssl_mode=require
RUN mkdir -p /mattermost/.postgresql \
  && chmod 700 /mattermost/.postgresql

RUN mkdir -p /var/tmp \
  && chmod 755 /var/tmp

FROM cgr.dev/chainguard/glibc-dynamic@sha256:3a06f226c257c2934900ef6a0bff311ceb5fe9df184f6d8159812b2dabb852f9

ENV PATH="/mattermost/bin:${PATH}"
ENV MM_SERVICESETTINGS_ENABLELOCALMODE="true"
ENV MM_INSTALL_TYPE="docker"

# Copy over metadata files needed by runtime
COPY --from=builder /etc/mime.types /etc

# Copy CA certificates for SSL/TLS validation with proper ownership
COPY --from=builder --chown=2000:2000 /etc/ssl/certs /etc/ssl/certs

# PDF feature: pdftotext for search indexing of uploaded PDFs
COPY --from=builder /usr/bin/pdftotext /usr/bin/pdftotext
COPY --from=builder /usr/bin/wvText /usr/bin/wvText
COPY --from=builder /usr/bin/wvWare /usr/bin/wvWare
COPY --from=builder /usr/bin/unrtf /usr/bin/unrtf
COPY --from=builder /usr/bin/tidy /usr/bin/tidy
COPY --from=builder /usr/share/wv /usr/share/wv
COPY --from=builder /usr/lib/libjpeg.so.8 /usr/lib/
COPY --from=builder /usr/lib/libopenjp2.so.7 /usr/lib/
COPY --from=builder /usr/lib/liblcms2.so.2 /usr/lib/
COPY --from=builder /usr/lib/libtiff.so.6 /usr/lib/
COPY --from=builder /usr/lib/libsmime3.so /usr/lib/
COPY --from=builder /usr/lib/libnss3.so /usr/lib/
COPY --from=builder /usr/lib/libplc4.so /usr/lib/
COPY --from=builder /usr/lib/libnspr4.so /usr/lib/
COPY --from=builder /usr/lib/libbz2.so.1 /usr/lib/
COPY --from=builder /usr/lib/libbrotlidec.so.1 /usr/lib/
COPY --from=builder /usr/lib/libexpat.so.1 /usr/lib/
COPY --from=builder /usr/lib/libwebp.so.7 /usr/lib/
COPY --from=builder /usr/lib/libzstd.so.1 /usr/lib/
COPY --from=builder /usr/lib/libnssutil3.so /usr/lib/
COPY --from=builder /usr/lib/libplds4.so /usr/lib/
COPY --from=builder /usr/lib/libbrotlicommon.so.1 /usr/lib/
COPY --from=builder /usr/lib/libsharpyuv.so.0 /usr/lib/

# Copy necessary libraries for document processing utilities
COPY --from=builder /usr/lib/libpoppler.so.163 /usr/lib/
COPY --from=builder /usr/lib/libfreetype.so.6 /usr/lib/
COPY --from=builder /usr/lib/libpng16.so.16 /usr/lib/
COPY --from=builder /usr/lib/libfontconfig.so.1 /usr/lib/
COPY --from=builder /usr/lib/libz.so.1 /usr/lib/
COPY --from=builder /usr/lib/libwv-1.2.so.4 /usr/lib/
COPY --from=builder /usr/lib/libtidy.so.58 /usr/lib/

# Copy mattermost from builder stage
COPY --from=builder --chown=2000:2000 /mattermost /mattermost
COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /etc/group /etc/group
COPY --from=builder --chown=2000:2000 /var/tmp /var/tmp

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
