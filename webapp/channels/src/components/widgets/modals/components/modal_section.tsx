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
}: Props): JSX.Element {
    const titleComponent = title && (
        <h4 className='mm-modal-generic-section__title'>
            {title}
        </h4>
    );

    const descriptionComponent = description && (
        <p className='mm-modal-generic-section__description'>
            {description}
        </p>
    );

    function titleRow() {
        if (titleSuffix) {
            return (
                <div className='mm-modal-generic-section__row'>
                    {titleComponent}
                    {titleSuffix}
                </div>
            );
        }

        return titleComponent;
    }

    const titleDescriptionSection = () => {
        if (title || description) {
            return (
                <div className='mm-modal-generic-section__title-description-ctr'>
                    {titleRow()}
                    {descriptionComponent}
                </div>
            );
        }
        return null;
    };

    return (
        <section className='mm-modal-generic-section'>
            {titleDescriptionSection()}
            <div className='mm-modal-generic-section__content'>
                {content}
            </div>
        </section>
    );
}

export default ModalSection;
