// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import './divider.scss';

type Props = {
    className?: string;
};

// A plain horizontal-rule separator styled with the same hairline-border
// token used elsewhere (e.g. compass_design_provider's MUI divider color,
// admin console table borders) -- unlike Menu.Separator (components/menu),
// this has no MUI/theme-provider dependency, so it renders correctly
// anywhere, not just inside a Menu.Container's popover tree.
export default function Divider({className}: Props): JSX.Element {
    return (
        <hr className={classNames('Divider', className)}/>
    );
}
