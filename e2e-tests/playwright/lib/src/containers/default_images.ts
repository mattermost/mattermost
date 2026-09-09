// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Single place to check and bump every image.
// The Mattermost server's default is overridable via the SERVER_IMAGE env var (testConfig.serverImage).
export const MATTERMOST_SERVER_IMAGE = 'mattermostdevelopment/mattermost-enterprise-edition:master';
export const POSTGRES_IMAGE = 'postgres:15';
export const INBUCKET_IMAGE = 'inbucket/inbucket:3.1.1';
export const OPENLDAP_IMAGE = 'osixia/openldap:1.4.0';
export const KEYCLOAK_IMAGE = 'quay.io/keycloak/keycloak:23.0.7';
export const MINIO_IMAGE = 'minio/minio:RELEASE.2024-06-22T05-26-45Z';
export const AZURITE_IMAGE = 'mcr.microsoft.com/azure-storage/azurite:3.34.0';
// Built from a Dockerfile on top of docker.elastic.co/elasticsearch/elasticsearch, rather than
// pulled as a fixed image — so only the version is fixed here.
export const ELASTICSEARCH_VERSION = '9.0.0';
// Built from a Dockerfile on top of opensearchproject/opensearch, rather than pulled as a fixed
// image — so only the version is fixed here.
export const OPENSEARCH_VERSION = '3.0.0';
