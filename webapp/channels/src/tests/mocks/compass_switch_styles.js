// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Stable Compass Switch CSS-module class names for Jest snapshots.
 * The published `@mattermost/compass-ui` Switch.module.scss.js embeds
 * content-hash suffixes that can differ across installs of the same version,
 * which makes DOM snapshots flake across environments.
 */
const styles = {
    switch: 'switch',
    switch__input: 'switch__input',
    'switch__secondary-label': 'switch__secondary-label',
    switch__labels: 'switch__labels',
    switch__label: 'switch__label',
    switch__track: 'switch__track',
    switch__knob: 'switch__knob',
    'switch--size-small': 'switch--size-small',
    'switch--size-medium': 'switch--size-medium',
    'switch--size-large': 'switch--size-large',
    'switch--semi-bold': 'switch--semi-bold',
    'switch--with-secondary': 'switch--with-secondary',
};

module.exports = styles;
module.exports.default = styles;
