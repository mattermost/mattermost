// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {useIntl} from 'react-intl';

import './modal_section.scss';

type Props = {
    title: MessageDescriptor;
    description?: MessageDescriptor;
    content: JSX.Element;
    titleSuffix?: JSX.Element;
};

function ModalSection({
    title,
    description,
    content,
    titleSuffix,
}: Props): JSX.Element {
    const {formatMessage} = useIntl();
    const titleContent = (
        <h4 className='mm-modal-generic-section__title'>
            {formatMessage({id: title.id, defaultMessage: title.defaultMessage})}
        </h4>
    );

    const descriptionContent = description && (
        <p className='mm-modal-generic-section__description'>
            {formatMessage({id: description.id, defaultMessage: description.defaultMessage})}
        </p>
    );

    function titleRow() {
        if (titleSuffix) {
            return (<div className='mm-modal-generic-section__row'>
                {titleContent}
                {titleSuffix}
            </div>);
        }
        return titleContent;
    }

    return (
        <section className='mm-modal-generic-section'>
            <div className='mm-modal-generic-section__info-ctr'>
                {titleRow()}
                {descriptionContent}
            </div>
            <div className='mm-modal-generic-section__content'>
                {content}
            </div>
        </section>
    );
}

export default ModalSection;
