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

# Message-Based Encryption tech-preview: public URL of the signed MBE plugin bundle + detached
# signature, published to pr-builds.mattermost.com by the plugin repo's sign-plugin.yml workflow.
# Defaults to the stable latest/ alias, which sign-plugin.yml overwrites on each run — so revving the
# plugin needs no Dockerfile edit, just re-dispatch the workflow and rebuild the image. The enterprise
# CI image build passes only MM_PACKAGE (no way to inject extra build-args), hence ARG defaults. Same
# host the server package is fetched from, so no auth is needed at build. To PIN a specific build
# instead of latest, override with the commit/<sha>/ URL the workflow prints. Test image only.
ARG MBE_PLUGIN_URL="https://pr-builds.mattermost.com/mattermost-plugin-message-based-encryption/latest/message-based-encryption.tar.gz"
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
# prepackaged_plugins dir already populated by MM_PACKAGE. The server verifies the signature at boot
# against the baked dev key (mbeDevPublicKey) and, with PLUGINSTATES enabling it, auto-installs it
# (processPrepackagedPlugins runs after the startup filestore sync). -f makes the build fail loudly
# if the bundle URL has not been published yet. Test image only.
RUN mkdir -p /mattermost/prepackaged_plugins \
  && curl -fL "$MBE_PLUGIN_URL" -o /mattermost/prepackaged_plugins/message-based-encryption.tar.gz \
  && curl -fL "$MBE_PLUGIN_SIG_URL" -o /mattermost/prepackaged_plugins/message-based-encryption.tar.gz.sig \
  && chown mattermost:mattermost /mattermost/prepackaged_plugins/message-based-encryption.tar.gz /mattermost/prepackaged_plugins/message-based-encryption.tar.gz.sig

# Message-Based Encryption tech-preview: a dedicated SoftHSM2 builder on ubuntu:22.04 (glibc 2.35),
# not the noble builder above (glibc 2.39), because the distroless base below ships glibc 2.36 —
# noble-built softhsm binaries fail at load with a missing GLIBC_2.38. The token and AES-256 wrapping
# KEK are initialized here at build time so the image is HSM-ready with no runtime init step
# (Kubernetes has no docker-exec hook). Non-secret dev values; test image only.
FROM ubuntu:22.04 AS hsmbuilder
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install --no-install-recommends -y \
  softhsm2 \
  opensc \
  && rm -rf /var/lib/apt/lists/*
RUN export SOFTHSM2_CONF=/etc/softhsm/softhsm2.conf \
  && mkdir -p /var/lib/softhsm/tokens \
  && softhsm2-util --init-token --free --label pbe-dev --pin 1234 --so-pin 1234 \
  && pkcs11-tool --module /usr/lib/softhsm/libsofthsm2.so --token-label pbe-dev --pin 1234 \
       --keygen --key-type aes:32 --label pbe-kek-dev --usage-wrap --usage-decrypt --sensitive

# Final stage using distroless for minimal attack surface
FROM gcr.io/distroless/base-debian12

# Some ENV variables
ENV PATH="/mattermost/bin:${PATH}"
ENV MM_SERVICESETTINGS_ENABLELOCALMODE="true"
ENV MM_INSTALL_TYPE="docker"

# Message-Based Encryption tech-preview: point the plugin at the bundled SoftHSM2 PKCS#11 provider,
# tell SoftHSM2 where its config + baked token store live, and enable the read-side decrypt hook so
# encrypted channels work out of the box. Test image only.
ENV MBE_PKCS11_LIBRARY_PATH="/usr/lib/softhsm/libsofthsm2.so"
ENV SOFTHSM2_CONF="/etc/softhsm/softhsm2.conf"
ENV MM_FEATUREFLAGS_CONSUMEPOSTHOOK="true"

# Message-Based Encryption tech-preview: the plugin reads these HSM settings directly from the
# environment (its applyEnvFallbacks) when its plugin config is empty, so they need not be entered in
# the console; they match the dev token/KEK baked into the hsmbuilder stage. Non-secret dev values;
# test image only. (We do NOT bake MM_PLUGINSETTINGS_PLUGINSTATES: that env REPLACES the whole
# PluginStates map, which wiped cloud's enabled plugins — calls/playbooks/boards/agents. MBE is left
# as a normal signed prepackaged plugin, verified by the baked mbeDevPublicKey.)
ENV MBE_PKCS11_TOKEN_LABEL="pbe-dev"
ENV MBE_PKCS11_PIN="1234"
ENV MBE_KEK_LABEL="pbe-kek-dev"

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

# Message-Based Encryption tech-preview: SoftHSM2 PKCS#11 provider + the dev token/KEK baked in the
# hsmbuilder stage, plus the C++/OpenSSL runtime libraries it needs (the distroless base ships glibc
# and libcrypto, but not libstdc++/libgcc). /usr/lib/softhsm/libsofthsm2.so is a symlink into
# x86_64-linux-gnu/softhsm, so both dirs are copied. The config + token store are chowned to the
# runtime user (2000) so it can read the config and write SoftHSM2's lock files. Test image only.
COPY --from=hsmbuilder /usr/lib/x86_64-linux-gnu/softhsm/ /usr/lib/x86_64-linux-gnu/softhsm/
COPY --from=hsmbuilder /usr/lib/softhsm/ /usr/lib/softhsm/
COPY --from=hsmbuilder /usr/bin/softhsm2-util /usr/bin/softhsm2-util
COPY --from=hsmbuilder --chown=2000:2000 /etc/softhsm/ /etc/softhsm/
COPY --from=hsmbuilder --chown=2000:2000 /var/lib/softhsm/ /var/lib/softhsm/
COPY --from=hsmbuilder /usr/lib/x86_64-linux-gnu/libstdc++.so.6* /usr/lib/x86_64-linux-gnu/
COPY --from=hsmbuilder /usr/lib/x86_64-linux-gnu/libgcc_s.so.1* /usr/lib/x86_64-linux-gnu/
COPY --from=hsmbuilder /usr/lib/x86_64-linux-gnu/libcrypto.so.3* /usr/lib/x86_64-linux-gnu/

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
