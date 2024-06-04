// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import {GenericModal} from '@mattermost/components';

import ExternalLink from 'components/external_link';

export default function ReactionLimitReachedModal(props: {isAdmin: boolean; onExited: () => void}) {
    const body = props.isAdmin ? (
        <FormattedMessage
            id='reaction_limit_reached_modal.body.admin'
            defaultMessage="Oops! It looks like we've hit a ceiling on emoji reactions for this message. We've <link>set a limit</link> to keep things running smoothly on your server. As a system administrator, you can adjust this limit from the <linkAdmin>system console</linkAdmin>."
            values={{
                link: (msg: React.ReactNode) => (
                    <ExternalLink
                        location='reaction_limit_reached_modal'
                        href='https://mattermost.com/pl/configure-unique-emoji-reaction-limit'
                    >
                        {msg}
                    </ExternalLink>
                ),
                linkAdmin: (msg: React.ReactNode) => (
                    <Link
                        onClick={props.onExited}
                        to='/admin_console'
                    >
                        {msg}
                    </Link>
                ),
            }}
        />
    ) : (
        <FormattedMessage
            id='reaction_limit_reached_modal.body'
            defaultMessage="Oops! It looks like we've hit a ceiling on emoji reactions for this message. Please contact your system administrator for any adjustments to this limit."
        />
    );

    return (
        <GenericModal
            modalHeaderText={
                <FormattedMessage
                    id='reaction_limit_reached_modal.title'
                    defaultMessage="You've reached the reaction limit"
                />
            }
            compassDesign={true}
            confirmButtonText={
                <FormattedMessage
                    id='generic.okay'
                    defaultMessage='Okay'
                />
            }
            onExited={props.onExited}
            handleConfirm={props.onExited}
        >
            {body}
        </GenericModal>
    );
}
