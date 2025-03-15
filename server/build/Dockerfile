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
ARG MM_PACKAGE="https://nimbupani-chat-builds.s3.us-east-1.amazonaws.com/builds/mattermost-team-linux-amd64%20%283%29.tar.gz?response-content-disposition=inline&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Security-Token=IQoJb3JpZ2luX2VjELj%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLWVhc3QtMSJHMEUCIFPIsjLd4SDxmZ68AMvFwirTs40p3mnicpwQ7jR39PxOAiEA61ZoUzJm%2FP4GmcoipMZDTMCy3%2F63XQ3rMP%2BMhge3E2AqywMIEBAAGgwyMTExMjU3NDA3NzYiDHyySpmhI9namclOXSqoA%2F8AmtzRE%2FuOFB2b9%2BXOQPstufir1gcDzWu6nymf4S0a0vhAGtt5O%2Bns57XjR%2BvdgHmBRNhRO4g%2FEKeBihR5EsFlN6W8n5z2SYI%2Bmqfo4B22xVAbR87YXmNYq8f%2BzZPIzAo5akVQJ5t71fD6B6CQmfa%2FodwmDaf6QZ0Ndtd0UHB7BnxdJB97cDgAhm4gTdUDTNbp6lb6Xzc8qlhpDYB%2BXI20pLlaKjNVYqnP%2BMUJpXCuXlvpeMOf1i8VaM%2F9JpMujHJSVHgivYTQWzbN5rfHx3PFRqr6rVe5lZZocXAOh7U2wUOM8P3fRp9on%2FOz241%2BmepVbvUaQrQssIglq8tDyfnhAUOIkyt9sZCzhX%2FtaU8JWNIRfbS6I5zcU6nDXy%2B%2F%2FgP4M8Gehtz3c4H8sYtHa6aSbUewDxy3xxjR3YQJFDg4mFzJZTvK5TuVzrxjj1tZzl9QtCsC7b5QO8ZFyCVS3Cq2hdvvbeRpKk9R0OeOSCJYvegVeVoECKkQEc%2FsV0AGRfanzKC7G0mkD8XxFmf3ahHaxObtWstcMqxt2fxk%2Bfw4n0deqTVNXgcwsdLUvgY65ALpBNPUI%2FfEjG2%2Fy62YIJPEsISf7VCAi5DYqn1vqDK5crJOfBzVE%2F3wfwOnwQFLYK5xZx2mY%2BgFjXX8SIaOcwdNToNOfJ6zueycRDfPp1z07kiB74l2Vnsoh7cIQNcOVEjRZJAnogJdhOjH6PcmxlmEkjwk3ju1JwC%2F%2Foc221zorMF2iObia%2BOwiNfx7ehJYQviOFbboVGa%2B0TWQQjNYU7HoSszCNxmgDjC0G5WwsABvFHSQrM1%2BVK7fM%2BBWeehcb7gk1p7EQJ%2BEKGMwmVJqG%2BFdRyecMgFJgoZO15ZHFVkWH%2BKvVKzK9V%2FOMSaQewISbVAAVxyNCAMbvfObTFvzeTxYk1TuGyihcxH4XIyALGBE2pPYuU6vem%2FRYjw61xwi6n%2Fhr2pLUWR0MWOQFhVK0cu8Skrukw9OvElkH2NbgZ8fSZ56SVRsY23lCRWqHcCgsyZH2yDGlB%2FmNCuEUybr%2F7FLRK5xA%3D%3D&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIATCKATETULVSJA75V%2F20250315%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20250315T072016Z&X-Amz-Expires=43200&X-Amz-SignedHeaders=host&X-Amz-Signature=315c580c2491164b661a66f6fc5e1714f6040d25c8964ee0d338c13e123f655d"

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
