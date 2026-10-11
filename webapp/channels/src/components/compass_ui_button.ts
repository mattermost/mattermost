// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Button as NamedButton} from '@mattermost/compass-ui/components/button';
import * as CompassButtonModule from '@mattermost/compass-ui/components/button';

type CompassButtonModuleShape = {
    Button?: typeof NamedButton;
    default?: typeof NamedButton;
};

/**
 * Stable Compass Button reference for styled-components and WithTooltip children.
 *
 * Webpack may resolve `@mattermost/compass-ui/components/button` to either
 * `index.js` (named `Button` export) or `Button.js` (default export only).
 * Using a namespace import with a default fallback avoids `styled(undefined)`
 * / invalid element types when the named binding is missing.
 */
const mod = CompassButtonModule as CompassButtonModuleShape;
export const Button = (mod.Button ?? mod.default ?? NamedButton) as typeof NamedButton;

export type {
    ButtonAppearance,
    ButtonAsChildProps,
    ButtonEmphasis,
    ButtonProps,
    ButtonSize,
} from '@mattermost/compass-ui/components/button';
