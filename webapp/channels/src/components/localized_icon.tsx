// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {HTMLAttributes} from 'react';
import {useIntl, MessageDescriptor} from 'react-intl';
import {PrimitiveType, FormatXMLElementFn} from 'intl-messageformat';

type Props = Omit<HTMLAttributes<HTMLSpanElement | HTMLElement>, 'title' | 'component'> & {
    component?: 'i' | 'span';
    ariaLabel?: MessageDescriptor & {
        values?: Record<string, PrimitiveType | FormatXMLElementFn<string, string>>;
    };
    title?: MessageDescriptor & {
        values?: Record<string, PrimitiveType | FormatXMLElementFn<string, string>>;
    };
}

const LocalizedIcon = React.forwardRef((props: Props, ref?: React.Ref<HTMLSpanElement | HTMLElement>) => {
    const {
        component = 'i',
        ariaLabel,
        title,
        ...otherProps
    } = props;

    const {formatMessage} = useIntl();

    if (component !== 'i' && component !== 'span') {
        return null;
    }

    // Use an uppercase name since JSX thinks anything lowercase is an HTML tag
    const Component = component;

    const iconProps: HTMLAttributes<HTMLElement> = {
        ...otherProps,
    };
    if (ariaLabel) {
        iconProps['aria-label'] = formatMessage({id: ariaLabel.id, defaultMessage: ariaLabel.defaultMessage}, ariaLabel.values);
    }
    if (title) {
        iconProps.title = formatMessage({id: title.id, defaultMessage: title.defaultMessage}, title.values);
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
