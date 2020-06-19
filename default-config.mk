# Do not modify this file, if you want to configure your own environment copy
# this file in config.mk and modify that file, or defining environment
# variables using the same names found here.

# Enable services to be run in docker, possible options: mysql, postgres,
# minio, inbucket, openldap and elasticsearch
# Must be space spearated names.
# Example: mysql postgres elasticsearch
ENABLED_DOCKER_SERVICES ?= mysql

# Disable entirely the use of docker
MM_NO_DOCKER ?= false

# Run the server in the background
RUN_SERVER_IN_BACKGROUND ?= true
