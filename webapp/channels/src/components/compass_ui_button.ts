// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as CompassButtonModule from '@mattermost/compass-ui/components/button';

type CompassButtonComponent = typeof CompassButtonModule.Button;

type CompassButtonModuleShape = {
    Button?: CompassButtonComponent;
    default?: CompassButtonComponent;
};

/**
 * Stable Compass Button reference for styled-components.
 *
 * Webpack may resolve `@mattermost/compass-ui/components/button` to either
 * `index.js` (named `Button` export) or `Button.js` (default export only).
 * Using a namespace import with a default fallback avoids `styled(undefined)`
 * when the named binding is missing.
 */
const mod = CompassButtonModule as CompassButtonModuleShape;
export const Button = (mod.Button ?? mod.default) as CompassButtonComponent;

export type {
    ButtonAppearance,
    ButtonAsChildProps,
    ButtonEmphasis,
    ButtonProps,
    ButtonSize,
} from '@mattermost/compass-ui/components/button';
