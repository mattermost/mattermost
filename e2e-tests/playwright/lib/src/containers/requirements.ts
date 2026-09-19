// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {StartedNetwork, StartedTestContainer} from 'testcontainers';

import {startAzuriteContainer} from './azurite_container';
import {startElasticsearchContainer} from './elasticsearch_container';
import {startKeycloakContainer} from './keycloak_container';
import {startMinioContainer} from './minio_container';
import {startOpenldapContainer} from './openldap_container';
import {startOpensearchContainer} from './opensearch_container';

import type {TestContainersServiceName} from '@/test_config';

// The single place to extend when a new additional service is needed. `stack.ts` starts these
// only for the names in testConfig.testcontainersServices.
export const ADDITIONAL_SERVICE_STARTERS: Record<
    TestContainersServiceName,
    (network: StartedNetwork) => Promise<StartedTestContainer>
> = {
    openldap: startOpenldapContainer,
    keycloak: startKeycloakContainer,
    elasticsearch: startElasticsearchContainer,
    opensearch: startOpensearchContainer,
    minio: startMinioContainer,
    azurite: startAzuriteContainer,
};
