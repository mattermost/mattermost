// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Keep Button exported for plugins that load this module via
// window.loadSharedDependency('@mattermost/shared/components/button').
export {Button} from './button';
export type {ButtonProps} from './button';
export {buttonClassNames} from './button_classes';
export type {ButtonEmphasis, ButtonSize, ButtonVariant} from './button_classes';
