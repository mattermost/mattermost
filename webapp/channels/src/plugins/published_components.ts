// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type React from 'react';

import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {PublishedComponentProps, PublishedComponents} from '@mattermost/shared/types/global';

// Curated allowlist, not an escape hatch for rendering arbitrary core components.
const components = {
    WithTooltip,
} satisfies Record<keyof PublishedComponents, React.ComponentType<any>>;

// Fails the build here if a component's real props drift from the published contract,
// instead of silently breaking plugins.
type ContractHonored<T extends {[K in keyof PublishedComponents]: React.ComponentProps<(typeof components)[K]>}> = T;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type AssertPublishedComponentsContract = ContractHonored<PublishedComponentProps>;

export const publishedComponents: PublishedComponents = components;
