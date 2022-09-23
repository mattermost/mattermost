FROM debian:buster-slim@sha256:5b0b1a9a54651bbe9d4d3ee96bbda2b2a1da3d2fa198ddebbced46dfdca7f216


# Setting bash as our shell, and enabling pipefail option
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Some ENV variables
ENV PATH="/mattermost/bin:${PATH}"
ARG PUID=2000
ARG PGID=2000
ARG MM_PACKAGE="https://releases.mattermost.com/7.3.0/mattermost-7.3.0-linux-amd64.tar.gz?src=docker"

# # Install needed packages and indirect dependencies
RUN apt-get update \
  && apt-get install --no-install-recommends -y \
  ca-certificates=20200601~deb10u2 \
  curl=7.64.0-4+deb10u2 \
  mime-support=3.62 \
  unrtf=0.21.10-clean-1 \
  wv=1.2.9-4.2+b2 \
  poppler-utils=0.71.0-5 \
  tidy=2:5.6.0-10 \
  libssl1.1=1.1.1n-0+deb10u3 \
  sensible-utils=0.0.12 \
  libsasl2-modules-db=2.1.27+dfsg-1+deb10u2 \
  libsasl2-2=2.1.27+dfsg-1+deb10u2 \
  libldap-common=2.4.47+dfsg-3+deb10u7 \
  libldap-2.4-2=2.4.47+dfsg-3+deb10u7 \
  libicu63=63.1-6+deb10u3 \
  libxml2=2.9.4+dfsg1-7+deb10u4 \
  ucf=3.0038+nmu1 \
  openssl=1.1.1n-0+deb10u3 \
  libkeyutils1=1.6-6 \
  libkrb5support0=1.17-3+deb10u4 \
  libk5crypto3=1.17-3+deb10u4 \
  libkrb5-3=1.17-3+deb10u4 \
  libgssapi-krb5-2=1.17-3+deb10u4 \
  libnghttp2-14=1.36.0-2+deb10u1 \
  libpsl5=0.20.2-2 \
  librtmp1=2.4+20151223.gitfa8646d.1-2 \
  libssh2-1=1.8.0-2.1 \
  libcurl4=7.64.0-4+deb10u2 \
  fonts-dejavu-core=2.37-1 \
  fontconfig-config=2.13.1-2 \
  libbsd0=0.9.1-2+deb10u1 \
  libexpat1=2.2.6-2+deb10u4 \
  libpng16-16=1.6.36-6 \
  libfreetype6=2.9.1-3+deb10u2 \
  libfontconfig1=2.13.1-2 \
  libpixman-1-0=0.36.0-1 \
  libxau6=1:1.0.8-1+b2 \
  libxdmcp6=1:1.1.2-3 \
  libxcb1=1.13.1-2 \
  libx11-data=2:1.6.7-1+deb10u2 \
  libx11-6=2:1.6.7-1+deb10u2 \
  libxcb-render0=1.13.1-2 \
  libxcb-shm0=1.13.1-2 \
  libxext6=2:1.3.3-1+b2 \
  libxrender1=1:0.9.10-1 \
  libcairo2=1.16.0-4+deb10u1 \
  libcurl3-gnutls=7.64.0-4+deb10u3 \
  libglib2.0-0=2.58.3-2+deb10u3 \
  libgsf-1-common=1.14.45-1 \
  libgsf-1-114=1.14.45-1 \
  libjbig0=2.1-3.1+b2 \
  libjpeg62-turbo=1:1.5.2-2+deb10u1 \
  liblcms2-2=2.9-3 \
  libnspr4=2:4.20-1 \
  libsqlite3-0=3.27.2-3+deb10u1 \
  libnss3=2:3.42.1-1+deb10u5 \
  libopenjp2-7=2.3.0-2+deb10u2 \
  libwebp6=0.6.1-2+deb10u1 \
  libtiff5=4.1.0+git191117-2~deb10u4 \
  libpoppler82=0.71.0-5 \
  libtidy5deb1=2:5.6.0-10 \
  libwmf0.2-7=0.2.8.4-14 \
  libwv-1.2-4=1.2.9-4.2+b2 \
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
