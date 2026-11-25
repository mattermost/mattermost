# Do not modify this file, if you want to configure your own environment copy
# this file in config.override.mk and modify that file, or defining environment
# variables using the same names found here.

# Enable services to be run in docker.
#
# Possible options: postgres, minio, azurite, inbucket, openldap, dejavu,
# keycloak, elasticsearch, opensearch, redis, prometheus,
# grafana, loki, otel-collector and ingress-sharedsecret.
#
# ingress-sharedsecret is an nginx on :8090 in front of the server on :8065 that rejects
# requests lacking the X-Mattermost-Preauth-Secret header (default 123456,
# override with MM_INGRESS_PREAUTH_SECRET). Use it to test the mobile
# shared secret feature.
#
# Must be space separated names.
#
# Example: postgres elasticsearch
ENABLED_DOCKER_SERVICES ?= postgres inbucket redis prometheus grafana loki otel-collector

# Disable entirely the use of docker
MM_NO_DOCKER ?= false

# Run the server in the background
RUN_SERVER_IN_BACKGROUND ?= true

# Data loaded by default in openldap when container starts.
#
# Possible options: test or qa
LDAP_DATA ?= test

# Mock the CWS.
MM_ENABLE_CWS_MOCK ?= false

# Skip running setup-go-work automatically.
# IGNORE_GO_WORK_IF_EXISTS is supported for backwards compatibility.
ifdef IGNORE_GO_WORK_IF_EXISTS
SKIP_SETUP_GO_WORK ?= $(IGNORE_GO_WORK_IF_EXISTS)
endif
SKIP_SETUP_GO_WORK ?= false
