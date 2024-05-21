// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode} from 'react';

import './modal_section.scss';

type Props = {
    title?: ReactNode;
    description?: ReactNode;
    content: JSX.Element;
    titleSuffix?: JSX.Element;
};

function ModalSection({
    title,
    description,
    content,
    titleSuffix,
}: Props) {
    const titleComponent = title && (
        <h4 className='modalSectionTitle'>
            {title}
            {titleSuffix}
        </h4>
    );

    const descriptionComponent = description && (
        <p className='modalSectionDescription'>
            {description}
        </p>
    );

    return (
        <section className='mm-modal-generic-section'>
            {(title || description) && (
                <div className='modalSectionHeader'>
                    {titleComponent}
                    {descriptionComponent}
                </div>
            )}
            <div className='modalSectionContent'>
                {content}
            </div>
        </section>
    );
}

export default ModalSection;
