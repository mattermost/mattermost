// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import './section_creator.scss';

type Props = {
    title: {
        id: string;
        defaultMessage: string;
    };
    description?: {
        id: string;
        defaultMessage: string;
    };
    content: JSX.Element;
    titleSuffix?: JSX.Element;
};

function SectionCreator({
    title,
    description,
    content,
    titleSuffix,
}: Props): JSX.Element {
    const {formatMessage} = useIntl();
    const Title = (
        <h4 className='mm-modal-generic-section__title'>
            {formatMessage({id: title.id, defaultMessage: title.defaultMessage})}
        </h4>
    );

    const Description = description && (
        <p className='mm-modal-generic-section__description'>
            {formatMessage({id: description.id, defaultMessage: description.defaultMessage})}
        </p>
    );

    function titleRow() {
        if (titleSuffix) {
            return (<div className='mm-modal-generic-section__row'>
                {Title}
                {titleSuffix}
            </div>);
        }
        return Title;
    }

    return (
        <section className='mm-modal-generic-section'>
            <div className='mm-modal-generic-section__info-ctr'>
                {titleRow()}
                {Description}
            </div>
            <div className='mm-modal-generic-section__content'>
                {content}
            </div>
        </section>
    );
}

export default SectionCreator;
