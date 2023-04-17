// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {HTMLAttributes} from 'react';

type Props = Omit<HTMLAttributes<HTMLSpanElement | HTMLElement>, 'title' | 'component'> & {
    component?: 'i' | 'span';
    ariaLabel?: string;
    title?: string;
}

const LocalizedIcon = React.forwardRef((props: Props, ref?: React.Ref<HTMLSpanElement | HTMLElement>) => {
    const {
        component = 'i',
        ariaLabel,
        title,
        ...otherProps
    } = props;

    if (component !== 'i' && component !== 'span') {
        return null;
    }

    // Use an uppercase name since JSX thinks anything lowercase is an HTML tag
    const Component = component;

    const iconProps: HTMLAttributes<HTMLElement> = {
        ...otherProps,
    };
    if (ariaLabel) {
        iconProps['aria-label'] = ariaLabel;
    }
    if (title) {
        iconProps.title = title;
    }

    return (
        <Component
            ref={ref}
            {...iconProps}
        />
    );
});
LocalizedIcon.displayName = 'LocalizedIcon';

export default LocalizedIcon;
