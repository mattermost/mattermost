// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

import AccessProblemSVG from 'components/common/svg_images_components/access_problem_svg';

import './no_permissions_view.scss';

type Props = {
    onDone: () => void;
};

export function NoPermissionsViewTitle() {
    return (
        <span className='NoPermissionsView__title'>
            <FormattedMessage
                id='invite_modal.no_permissions.title'
                defaultMessage='Unable to invite people'
            />
        </span>
    );
}

export function NoPermissionsViewFooter(props: Props) {
    return (
        <Button
            onClick={props.onDone}
            emphasis='primary'
            data-testid='confirm-done'
            aria-label='Close'
            title='Close'
        >
            <FormattedMessage
                id='invitation_modal.confirm.done'
                defaultMessage='Done'
            />
        </Button>
    );
}

export default function NoPermissionsView() {
    return (
        <div className='NoPermissionsView__body'>
            <div className='NoPermissionsView__description'>
                <FormattedMessage
                    id='invite_modal.no_permissions.description'
                    defaultMessage='You do not have permissions to add users or guests. If this seems like an error, please reach out to your system administrator.'
                />
            </div>
            <AccessProblemSVG
                width={222}
                height={136}
            />
        </div>
    );
}
