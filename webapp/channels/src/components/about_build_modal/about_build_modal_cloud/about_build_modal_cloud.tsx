// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import classNames from 'classnames';

import ExternalLink from 'components/external_link';
import MattermostLogo from 'components/widgets/icons/mattermost_logo';

import type {GlobalState} from 'types/store';

import './about_build_modal_cloud.scss';

type Props = {
    onExited: () => void;
    config: any;
    license: any;
    show: boolean;
    doHide: () => void;
};

export default function AboutBuildModalCloud(props: Props) {
    const config = props.config;
    const license = props.license;

    let companyName = license.Company;
    const companyInfo = useSelector((state: GlobalState) => state.entities.cloud.customer);

    if (companyInfo) {
        companyName = companyInfo.name;
    }

    const title = (
        <FormattedMessage
            id='about.cloudEdition'
            defaultMessage='Cloud'
        />
    );

    const subTitle = (
        <FormattedMessage
            id='about.enterpriseEditionSst'
            defaultMessage='High trust messaging for the enterprise'
        />
    );

    const licensee = (
        <div className='form-group'>
            <FormattedMessage
                id='about.licensed'
                defaultMessage='Licensed to:'
            />
            {'\u00a0' + companyName}
        </div>
    );

    let mmversion = config.BuildNumber;
    if (!isNaN(config.BuildNumber)) {
        mmversion = 'ci';
    }

    return (
        <Modal
            dialogClassName={classNames('a11y__modal', 'about-modal', 'cloud')}
            show={props.show}
            onHide={props.doHide}
            onExited={props.onExited}
            role='dialog'
            aria-labelledby='aboutModalLabel'
        >
            <Modal.Header closeButton={true}>
                <Modal.Title
                    componentClass='h1'
                    id='aboutModalLabel'
                >
                    <FormattedMessage
                        id='about.title'
                        values={{appTitle: config.SiteName || 'Mattermost'}}
                        defaultMessage='About {appTitle}'
                    />
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className='about-modal__content'>
                    <div className='about-modal__logo'>
                        <MattermostLogo/>
                    </div>
                    <div>
                        <h3 className='about-modal__title'>
                            <strong>{'Mattermost'} {title}</strong>
                        </h3>
                        <p className='subtitle'>{subTitle}</p>
                        <div className='description'>
                            <div>
                                <FormattedMessage
                                    id='about.version'
                                    defaultMessage='Mattermost Version:'
                                />
                                <span id='versionString'>{'\u00a0' + mmversion}</span>
                            </div>
                        </div>
                        {licensee}
                        <div className='about-footer'>
                            <FormattedMessage
                                id='about.notice'
                                defaultMessage='Mattermost is made possible by the open source software used in our <linkServer>server</linkServer>, <linkDesktop>desktop</linkDesktop> and <linkMobile>mobile</linkMobile> apps.'
                                values={{
                                    linkServer: (msg: React.ReactNode) => (
                                        <ExternalLink
                                            href='https://github.com/mattermost/mattermost-server/blob/master/NOTICE.txt'
                                            location='about_build_modal_cloud'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                    linkDesktop: (msg: React.ReactNode) => (
                                        <ExternalLink
                                            href='https://github.com/mattermost/desktop/blob/master/NOTICE.txt'
                                            location='about_build_modal_cloud'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                    linkMobile: (msg: React.ReactNode) => (
                                        <ExternalLink
                                            href='https://github.com/mattermost/mattermost-mobile/blob/master/NOTICE.txt'
                                            location='about_build_modal_cloud'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                }}
                            />
                            <div className='copy-right'>
                                <FormattedMessage
                                    id='about.copyright'
                                    defaultMessage='Copyright 2015 - {currentYear} Mattermost, Inc. All rights reserved'
                                    values={{
                                        currentYear: new Date().getFullYear(),
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                    <div/>
                </div>
                <div className='about-modal__hash'>
                    <p>
                        <FormattedMessage
                            id='about.hash'
                            defaultMessage='Build Hash:'
                        />
                        {config.BuildHash}
                        <br/>
                        <FormattedMessage
                            id='about.hashee'
                            defaultMessage='EE Build Hash:'
                        />
                        {config.BuildHashEnterprise}
                    </p>
                    <p>
                        <FormattedMessage
                            id='about.date'
                            defaultMessage='Build Date:'
                        />
                        {config.BuildDate}
                    </p>
                </div>
            </Modal.Body>
        </Modal>
    );
}
