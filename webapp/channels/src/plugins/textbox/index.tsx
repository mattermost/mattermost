// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Textbox from 'components/textbox';
import type BaseTextbox from 'components/textbox/textbox';

// Without `testId`: a plugin's ids would be runtime values the webapp's testid grammar can't check (plugins name
// their own under `plugins.<plugin key>`).
type Props = Omit<React.ComponentPropsWithRef<typeof Textbox>, 'suggestionListPosition' | 'testId'> & {
    suggestionListStyle?: React.ComponentPropsWithRef<typeof Textbox>['suggestionListPosition'];
};

const PluginTextbox = React.forwardRef((props: Props, ref?: React.Ref<BaseTextbox>) => {
    const {
        suggestionListStyle,
        ...otherProps
    } = props;

    return (
        <Textbox
            ref={ref}
            suggestionListPosition={suggestionListStyle}
            {...otherProps}
            testId={undefined}
        />
    );
});

export default PluginTextbox;
