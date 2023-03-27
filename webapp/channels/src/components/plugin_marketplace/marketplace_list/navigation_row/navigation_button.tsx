// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

type NavigationButtonProps = {
    onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    messageId: string;
    defaultMessage: string;
};

export default class NavigationButton extends React.PureComponent <NavigationButtonProps> {
    onClick = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
        event.preventDefault();
        this.props.onClick(event);
    };

    render(): JSX.Element {
        const {onClick, messageId, defaultMessage} = this.props;
        return (
            <button
                className='btn btn-link'
                onClick={onClick}
            >
                <FormattedMessage
                    id={messageId}
                    defaultMessage={defaultMessage}
                />
            </button>
        );
    }
}
