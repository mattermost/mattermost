// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import AccessDeniedSvg from 'components/common/svg_images_components/access_denied_svg';

import './no_permissions_view.scss';

type Props = {
    footerClass: string;
    onDone: () => void;
    title?: string;
    description?: string;
}

export default function NoPermissionsView(props: Props) {
    return (
        <>
            <Modal.Header
                className='NoPermissionsView__header'
                closeButton={true}
            >
                <Modal.Title className='NoPermissionsView__title'>
                    <FormattedMessage
                        id='invite_modal.no_permissions.title'
                        defaultMessage='Unable to invite people'
                    />
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className='NoPermissionsView__body'>
                    <div className='NoPermissionsView__description'>
                        <FormattedMessage
                            id='invite_modal.no_permissions.description'
                            defaultMessage='You do not have permissions to add users or guests. If this seems like an error, please reach out to your system administrator.'
                        />
                    </div>
                    <AccessDeniedSvg
                        width={211}
                        height={156}
                    />
                </div>
            </Modal.Body>
            <Modal.Footer className={props.footerClass}>
                <button
                    onClick={props.onDone}
                    className='btn btn-primary'
                    data-testid='confirm-done'
                    aria-label='Close'
                    title='Close'
                >
                    <FormattedMessage
                        id='invitation_modal.confirm.done'
                        defaultMessage='Done'
                    />
                </button>
            </Modal.Footer>
        </>
    );
}
