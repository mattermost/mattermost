// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode} from 'react';
import type {MessageDescriptor} from 'react-intl';

import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: ReactNode;
    spinning: boolean;
    spinningText: ReactNode | MessageDescriptor;
}

const SpinnerButton = ({
    spinning = false,
    spinningText,
    children,
    ...props
}: Props) => {
    return (
        <button
            disabled={spinning}
            {...props}
        >
            <LoadingWrapper
                loading={spinning}
                text={spinningText}
            >
                {children}
            </LoadingWrapper>
        </button>
    );
};
export default React.memo(SpinnerButton);
