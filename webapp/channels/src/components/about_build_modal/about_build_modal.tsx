// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import {ClientConfig, ClientLicense} from '@mattermost/types/config';

import MattermostLogo from 'components/widgets/icons/mattermost_logo';
import Nbsp from 'components/html_entities/nbsp';

import {AboutLinks} from 'utils/constants';

import ExternalLink from 'components/external_link';

import AboutBuildModalCloud from './about_build_modal_cloud/about_build_modal_cloud';

type Props = {

    /**
     * Function called after the modal has been hidden
     */
    onExited: () => void;

    /**
     * Global config object
     */
    config: Partial<ClientConfig>;

    /**
     * Global license object
     */
    license: ClientLicense;
};

type State = {
    show: boolean;
};

export default class AboutBuildModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            show: true,
        };
    }

    doHide = () => {
        this.setState({show: false});
        this.props.onExited();
    };

    render() {
        const config = this.props.config;
        const license = this.props.license;

        if (license.Cloud === 'true') {
            return (
                <AboutBuildModalCloud
                    {...this.props}
                    {...this.state}
                    doHide={this.doHide}
                />
            );
        }

        let title = (
            <FormattedMessage
                id='about.teamEditiont0'
                defaultMessage='Team Edition'
            />
        );

        let subTitle = (
            <FormattedMessage
                id='about.teamEditionSt'
                defaultMessage='All your team communication in one place, instantly searchable and accessible anywhere.'
            />
        );

        let learnMore = (
            <div>
                <FormattedMessage
                    id='about.teamEditionLearn'
                    defaultMessage='Join the Mattermost community at '
                />
                <ExternalLink
                    location='about_build_modal'
                    href='https://mattermost.com/community/'
                >
                    {'mattermost.com/community/'}
                </ExternalLink>
            </div>
        );

        let licensee;
        if (config.BuildEnterpriseReady === 'true') {
            title = (
                <FormattedMessage
                    id='about.teamEditiont1'
                    defaultMessage='Enterprise Edition'
                />
            );

            subTitle = (
                <FormattedMessage
                    id='about.enterpriseEditionSt'
                    defaultMessage='Modern communication from behind your firewall.'
                />
            );

            learnMore = (
                <div>
                    <FormattedMessage
                        id='about.enterpriseEditionLearn'
                        defaultMessage='Learn more about Enterprise Edition at '
                    />
                    <ExternalLink
                        location='about_build_modal'
                        href='https://mattermost.com/'
                    >
                        {'mattermost.com'}
                    </ExternalLink>
                </div>
            );

            if (license.IsLicensed === 'true') {
                title = (
                    <FormattedMessage
                        id='about.enterpriseEditione1'
                        defaultMessage='Enterprise Edition'
                    />
                );
                licensee = (
                    <div className='form-group'>
                        <FormattedMessage
                            id='about.licensed'
                            defaultMessage='Licensed to:'
                        />
                        <Nbsp/>{license.Company}
                    </div>
                );
            }
        }

        const termsOfService = (
            <ExternalLink
                location='about_build_modal'
                id='tosLink'
                href={AboutLinks.TERMS_OF_SERVICE}
            >
                <FormattedMessage
                    id='about.tos'
                    defaultMessage='Terms of Use'
                />
            </ExternalLink>
        );

        const privacyPolicy = (
            <ExternalLink
                id='privacyLink'
                location='about_build_modal'
                href={AboutLinks.PRIVACY_POLICY}
            >
                <FormattedMessage
                    id='about.privacy'
                    defaultMessage='Privacy Policy'
                />
            </ExternalLink>
        );

        // Only show build number if it's a number (so only builds from Jenkins)
        let buildnumber: JSX.Element | null = (
            <div data-testid='aboutModalBuildNumber'>
                <FormattedMessage
                    id='about.buildnumber'
                    defaultMessage='Build Number:'
                />
                <span id='buildnumberString'>{'\u00a0' + config.BuildNumber}</span>
            </div>
        );
        if (isNaN(Number(config.BuildNumber))) {
            buildnumber = null;
        }

        let mmversion: string | undefined = config.BuildNumber;
        if (!isNaN(Number(config.BuildNumber))) {
            mmversion = 'ci';
        }

        return (
            <Modal
                dialogClassName='a11y__modal about-modal'
                show={this.state.show}
                onHide={this.doHide}
                onExited={this.props.onExited}
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
                            values={{
                                appTitle: config.SiteName || 'Mattermost',
                            }}
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
                                <strong>
                                    {'Mattermost'} {title}
                                </strong>
                            </h3>
                            <p className='about-modal__subtitle pb-2'>
                                {subTitle}
                            </p>
                            <div className='form-group less'>
                                <div data-testid='aboutModalVersion'>
                                    <FormattedMessage
                                        id='about.version'
                                        defaultMessage='Mattermost Version:'
                                    />
                                    <span id='versionString'>
                                        {'\u00a0' + mmversion}
                                    </span>
                                </div>
                                <div data-testid='aboutModalDBVersionString'>
                                    <FormattedMessage
                                        id='about.dbversion'
                                        defaultMessage='Database Schema Version:'
                                    />
                                    <span id='dbversionString'>
                                        {'\u00a0' + config.SchemaVersion}
                                    </span>
                                </div>
                                {buildnumber}
                                <div>
                                    <FormattedMessage
                                        id='about.database'
                                        defaultMessage='Database:'
                                    />
                                    {'\u00a0' + config.SQLDriverName}
                                </div>
                            </div>
                            {licensee}
                        </div>
                    </div>
                    <div className='about-modal__footer'>
                        {learnMore}
                        <div className='form-group'>
                            <div className='about-modal__copyright'>
                                <FormattedMessage
                                    id='about.copyright'
                                    defaultMessage='Copyright 2015 - {currentYear} Mattermost, Inc. All rights reserved'
                                    values={{
                                        currentYear: new Date().getFullYear(),
                                    }}
                                />
                            </div>
                            <div className='about-modal__links'>
                                {termsOfService}
                                {' - '}
                                {privacyPolicy}
                            </div>
                        </div>
                    </div>
                    <div className='about-modal__notice form-group pt-3'>
                        <p>
                            <FormattedMessage
                                id='about.notice'
                                defaultMessage='Mattermost is made possible by the open source software used in our <linkServer>server</linkServer>, <linkDesktop>desktop</linkDesktop> and <linkMobile>mobile</linkMobile> apps.'
                                values={{
                                    linkServer: (msg: React.ReactNode) => (
                                        <ExternalLink
                                            location='about_build_modal'
                                            href='https://github.com/mattermost/mattermost-server/blob/master/NOTICE.txt'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                    linkDesktop: (msg: React.ReactNode) => (
                                        <ExternalLink
                                            location='about_build_modal'
                                            href='https://github.com/mattermost/desktop/blob/master/NOTICE.txt'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                    linkMobile: (msg: React.ReactNode) => (
                                        <ExternalLink
                                            location='about_build_modal'
                                            href='https://github.com/mattermost/mattermost-mobile/blob/master/NOTICE.txt'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                }}
                            />
                        </p>
                    </div>
                    <div className='about-modal__hash'>
                        <p>
                            <FormattedMessage
                                id='about.hash'
                                defaultMessage='Build Hash:'
                            />
                            <Nbsp/>
                            {config.BuildHash}
                            <br/>
                            <FormattedMessage
                                id='about.hashee'
                                defaultMessage='EE Build Hash:'
                            />
                            <Nbsp/>
                            {config.BuildHashEnterprise}
                        </p>
                        <p>
                            <FormattedMessage
                                id='about.date'
                                defaultMessage='Build Date:'
                            />
                            <Nbsp/>
                            {config.BuildDate}
                        </p>
                    </div>
                </Modal.Body>
            </Modal>
        );
    }
}
