# Do not modify this file, if you want to configure your own environment copy
# this file in config.override.mk and modify that file, or defining environment
# variables using the same names found here.

# Enable services to be run in docker.
#
# Possible options: mysql, postgres, minio, inbucket, openldap, dejavu,
# keycloak, elasticsearch, prometheus, and grafana.
#
# Must be space separated names.
#
# Example: mysql postgres elasticsearch
ifeq ($(BUILD_ENTERPRISE_READY),true)
ENABLED_DOCKER_SERVICES ?= mysql postgres inbucket prometheus grafana
else
ENABLED_DOCKER_SERVICES ?= mysql postgres inbucket
endif

# Disable entirely the use of docker
MM_NO_DOCKER ?= false

# Run the server in the background
RUN_SERVER_IN_BACKGROUND ?= true

# Data loaded by default in openldap when container starts.
#
# Posible options: test or qa
LDAP_DATA ?= test
