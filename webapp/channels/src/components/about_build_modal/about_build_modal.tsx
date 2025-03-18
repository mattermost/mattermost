// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from "react";
import { Modal } from "react-bootstrap";
import { FormattedMessage } from "react-intl";

import type { ClientConfig, ClientLicense } from "@mattermost/types/config";

import ExternalLink from "components/external_link";
import Nbsp from "components/html_entities/nbsp";
import MattermostLogo from "components/widgets/icons/mattermost_logo";

import { AboutLinks } from "utils/constants";

import AboutBuildModalCloud from "./about_build_modal_cloud/about_build_modal_cloud";

type SocketStatus = {
    connected: boolean;
    serverHostname: string | undefined;
};

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

    socketStatus: SocketStatus;
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
        this.setState({ show: false });
        this.props.onExited();
    };

    render() {
        const config = this.props.config;
        const license = this.props.license;

        if (license.Cloud === "true") {
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
                id="about.teamEditiont0"
                defaultMessage="Team Edition"
            />
        );

        let subTitle = (
            <FormattedMessage
                id="about.teamEditionSt"
                defaultMessage="Revamping the social media to unlock the potential of your university's network for jobs, connections, and startups."
            />
        );

        let learnMoreQuestion = (
            <FormattedMessage
                id="about.teamEditionLearnQuestion"
                defaultMessage="What's nimbupani? 🍹"
            />
        );

        let learnMoreAnswer = (
            <div>
                <FormattedMessage
                    id="about.teamEditionLearnAnswer"
                    defaultMessage="Arriving in the U.S. as students, we encountered numerous challenges, from securing on-campus jobs to navigating internships and selecting the right courses. Lacking guidance, we often found ourselves sending countless LinkedIn requests and messages to seniors, seeking answers. This inspired us to create Nimbupani.ai—a platform designed to streamline these crucial aspects of university life for students like you. Our goal is to ensure no one feels lost or overwhelmed as they navigate their academic and professional paths. "
                />
                <div>
                    <ExternalLink
                        location="about_build_modal"
                        href="https://nimbupani.ai"
                    >
                        {"nimbupani.ai"}
                    </ExternalLink>
                </div>
            </div>
        );

        let learnMoreMattermost = (
            <div>
                <FormattedMessage
                    id="about.teamEditionLearnMattermost"
                    defaultMessage="Nimbupani chats is built using the open-source Mattermost platform, reconfigured to enhance collaboration and community engagement for students and alumni. "
                />
                <ExternalLink
                    location="about_build_modal"
                    href="https://mattermost.com/community/"
                >
                    {"mattermost.com/community/"}
                </ExternalLink>
            </div>
        );

        let licensee;
        if (config.BuildEnterpriseReady === "true") {
            title = (
                <FormattedMessage
                    id="about.teamEditiont1"
                    defaultMessage="Enterprise Edition"
                />
            );

            subTitle = (
                <FormattedMessage
                    id="about.enterpriseEditionSt"
                    defaultMessage="Modern communication from behind your firewall."
                />
            );

            learnMore = (
                <div>
                    <FormattedMessage
                        id="about.enterpriseEditionLearn"
                        defaultMessage="Learn more about Enterprise Edition at "
                    />
                    <ExternalLink
                        location="about_build_modal"
                        href="https://mattermost.com/"
                    >
                        {"mattermost.com"}
                    </ExternalLink>
                </div>
            );

            if (license.IsLicensed === "true") {
                title = (
                    <FormattedMessage
                        id="about.enterpriseEditione1"
                        defaultMessage="Enterprise Edition"
                    />
                );
                licensee = (
                    <div className="form-group">
                        <FormattedMessage
                            id="about.licensed"
                            defaultMessage="Licensed to:"
                        />
                        <Nbsp />
                        {license.Company}
                    </div>
                );
            }
        }

        const termsOfService = (
            <ExternalLink
                location="about_build_modal"
                id="tosLink"
                href={AboutLinks.TERMS_OF_SERVICE}
            >
                <FormattedMessage
                    id="about.tos"
                    defaultMessage="Terms of Use"
                />
            </ExternalLink>
        );

        const privacyPolicy = (
            <ExternalLink
                id="privacyLink"
                location="about_build_modal"
                href={AboutLinks.PRIVACY_POLICY}
            >
                <FormattedMessage
                    id="about.privacy"
                    defaultMessage="Privacy Policy"
                />
            </ExternalLink>
        );

        const buildnumber: JSX.Element | null = (
            <div data-testid="aboutModalBuildNumber">
                <FormattedMessage
                    id="about.buildnumber"
                    defaultMessage="Build Number:"
                />
                <span id="buildnumberString">
                    {"\u00a0" +
                        (config.BuildNumber === "dev"
                            ? "n/a"
                            : config.BuildNumber)}
                </span>
            </div>
        );

        const mmversion: string | undefined =
            config.BuildNumber === "dev" ? config.BuildNumber : config.Version;

        let serverHostname;
        if (!this.props.socketStatus.connected) {
            serverHostname = (
                <div>
                    <FormattedMessage
                        id="about.serverHostname"
                        defaultMessage="Hostname:"
                    />
                    <Nbsp />
                    <FormattedMessage
                        id="about.serverDisconnected"
                        defaultMessage="disconnected"
                    />
                </div>
            );
        } else if (this.props.socketStatus.serverHostname) {
            serverHostname = (
                <div>
                    <FormattedMessage
                        id="about.serverHostname"
                        defaultMessage="Hostname:"
                    />
                    <Nbsp />
                    {this.props.socketStatus.serverHostname}
                </div>
            );
        } else {
            serverHostname = (
                <div>
                    <FormattedMessage
                        id="about.serverHostname"
                        defaultMessage="Hostname:"
                    />
                    <Nbsp />
                    <FormattedMessage
                        id="about.serverUnknown"
                        defaultMessage="server did not provide hostname"
                    />
                </div>
            );
        }

        return (
            <Modal
                dialogClassName="a11y__modal about-modal"
                show={this.state.show}
                onHide={this.doHide}
                onExited={this.props.onExited}
                role="none"
                aria-labelledby="aboutModalLabel"
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title componentClass="h1" id="aboutModalLabel">
                        <FormattedMessage
                            id="about.title"
                            values={{
                                appTitle: config.SiteName || "Nimbupani",
                            }}
                            defaultMessage="About {appTitle}"
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="about-modal__content">
                        <div className="about-modal__logo">
                            <MattermostLogo />
                        </div>
                        <div>
                            <h3 className="about-modal__title">
                                <strong>{"Nimbupani"}</strong>
                            </h3>
                            <p className="about-modal__subtitle pb-2">
                                {subTitle}
                            </p>
                            <div className="form-group less">
                                <div data-testid="aboutModalVersion">
                                    <FormattedMessage
                                        id="about.version"
                                        defaultMessage="Mattermost Version:"
                                    />
                                    <span id="versionString">
                                        {"\u00a0" + mmversion}
                                    </span>
                                </div>
                                <div data-testid="aboutModalDBVersionString">
                                    <FormattedMessage
                                        id="about.dbversion"
                                        defaultMessage="Database Schema Version:"
                                    />
                                    <span id="dbversionString">
                                        {"\u00a0" + config.SchemaVersion}
                                    </span>
                                </div>
                                {buildnumber}
                                <div>
                                    <FormattedMessage
                                        id="about.database"
                                        defaultMessage="Database:"
                                    />
                                    {"\u00a0" + config.SQLDriverName}
                                </div>
                                {serverHostname}
                            </div>
                            {licensee}
                        </div>
                    </div>

                    <div className="about-modal__footer">
                        {learnMoreQuestion}
                        {learnMoreAnswer}
                        <div className="form-group">
                            <div className="about-modal__copyright">
                                <FormattedMessage
                                    id="about.copyright"
                                    defaultMessage="Copyright 2024 - {currentYear} Nimbupani LLC,  All rights reserved"
                                    values={{
                                        currentYear: new Date().getFullYear(),
                                    }}
                                />
                            </div>
                            <div className="about-modal__links">
                                {termsOfService}
                                {" - "}
                                {privacyPolicy}
                            </div>
                            <div className="about-modal__copyright">
                                {"Note: "} {learnMoreMattermost}
                            </div>
                        </div>
                    </div>
                </Modal.Body>
            </Modal>
        );
    }
}
