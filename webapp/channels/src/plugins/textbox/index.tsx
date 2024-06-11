// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Textbox from 'components/textbox';
import type BaseTextbox from 'components/textbox/textbox';

type Props = Omit<React.ComponentPropsWithRef<typeof Textbox>, 'suggestionListPosition'> & {
    suggestionListStyle?: React.ComponentPropsWithRef<typeof Textbox>['suggestionListPosition'];
}

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
        />
    );
});

export default PluginTextbox;
