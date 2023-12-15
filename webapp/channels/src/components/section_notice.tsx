// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import Markdown from 'components/markdown';

import './section_notice.scss';

type Props = {
    title: string;
    text: string;
    button?: {
        onClick: () => void;
        text: string;
    };
    isError?: boolean;
};

const SectionNotice = ({
    title,
    text,
    button,
    isError,
}: Props) => {
    return (
        <div className={classNames('sectionNoticeContainer', {error: isError})}>
            <i className={classNames('icon icon-information-outline sectionNoticeIcon', {error: isError})}/>
            <div className='sectionNoticeBody'>
                <h1 className='sectionNoticeTitle'>{title}</h1>
                <Markdown message={text}/>
                {button &&
                <button
                    onClick={button.onClick}
                    className='btn btn-primary sectionNoticeButton'
                >
                    {button.text}
                </button>
                }
            </div>
        </div>
    );
};

export default SectionNotice;
