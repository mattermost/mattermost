// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {PureComponent, ReactNode} from 'react';

import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

type Props = {
    children?: ReactNode;
    spinning: boolean;
    spinningText: ReactNode;
    onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}

export default class SpinnerButton extends PureComponent<Props & React.ButtonHTMLAttributes<HTMLButtonElement>> {
    public static defaultProps: Partial<Props> = {
        spinning: false,
    }

    public render(): JSX.Element {
        const {spinning, spinningText, children, ...props} = this.props;

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
    }
}
