// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import type {SupportPacketContent} from '@mattermost/types/admin';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import AlertBanner from 'components/alert_banner';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';

import './commercial_support_modal.scss';

type Props = {

    /**
     * Function called after the modal has been hidden
     */
    onExited: () => void;

    showBannerWarning: boolean;

    isCloud: boolean;

    currentUser: UserProfile;

    packetContents: SupportPacketContent[];
};

type State = {
    show: boolean;
    showBannerWarning: boolean;
    packetContents: SupportPacketContent[];
};

export default class CommercialSupportModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            show: true,
            showBannerWarning: props.showBannerWarning,
            packetContents: props.packetContents,
        };
    }

    componentDidUpdate = (prevProps: Props) => {
        if (this.props.showBannerWarning !== prevProps.showBannerWarning) {
            this.updateBannerWarning(this.props.showBannerWarning);
        }
    };

    doHide = () => {
        this.setState({show: false});
    };

    updateBannerWarning = (showBannerWarning: boolean) => {
        this.setState({showBannerWarning});
    };

    hideBannerWarning = () => {
        this.updateBannerWarning(false);
    };

    updateCheckStatus = (index: number) => {
        this.setState({
            packetContents: this.state.packetContents.map((content, currentIndex) => (
                (currentIndex === index && !content.mandatory) ? {...content, selected: !content.selected} : content
            )),
        });
    };

    genereateDownloadURLWithParams = (): string => {
        const url = new URL(Client4.getSystemRoute() + '/support_packet');
        this.state.packetContents.forEach((content) => {
            if (content.id === 'basic.server.logs') {
                url.searchParams.set('basic.server.logs', String(content.selected));
            } else if (!content.mandatory && content.selected) {
                url.searchParams.append('plugin_packets', content.id);
            }
        });
        return url.toString();
    };

    render() {
        const {showBannerWarning} = this.state;
        const {isCloud, currentUser} = this.props;

        const supportLink = isCloud ? `https://customers.mattermost.com/cloud/contact-us?name=${currentUser.first_name} ${currentUser.last_name}&email=${currentUser.email}&inquiry=technical` : 'https://support.mattermost.com/hc/en-us/requests/new';
        return (
            <Modal
                id='commercialSupportModal'
                dialogClassName='a11y__modal more-modal more-direct-channels'
                show={this.state.show}
                onHide={this.doHide}
                onExited={this.props.onExited}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        <FormattedMessage
                            id='commercial_support.title'
                            defaultMessage='Commercial Support'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className='CommercialSupportModal'>
                        <FormattedMarkdownMessage
                            id='commercial_support.description'
                            defaultMessage={'If you\'re experiencing issues, [submit a support ticket](!{supportLink}). To help with troubleshooting, it\'s recommended to download the support packet below that includes more details about your Mattermost environment.'}
                            values={{
                                supportLink,
                            }}
                        />
                        {showBannerWarning &&
                            <AlertBanner
                                mode='info'
                                message={
                                    <FormattedMarkdownMessage
                                        id='commercial_support.warning.banner'
                                        defaultMessage='Before downloading the support packet, set **Output Logs to File** to **true** and set **File Log Level** to **DEBUG** [here](!/admin_console/environment/logging).'
                                    />
                                }
                                onDismiss={this.hideBannerWarning}
                            />
                        }
                        <div className='CommercialSupportModal__packet_contents_download'>
                            <FormattedMarkdownMessage
                                id='commercial_support.download_contents'
                                defaultMessage={'**Select your support packet contents to download**'}
                            />
                        </div>
                        {this.state.packetContents.map((item, index) => (
                            <div
                                className='CommercialSupportModal__option'
                                key={item.id}
                            >
                                <input
                                    className='CommercialSupportModal__options__checkbox'
                                    id={item.id}
                                    name={item.id}
                                    type='checkbox'
                                    checked={item.selected}
                                    disabled={item.mandatory}
                                    onChange={() => this.updateCheckStatus(index)}
                                />
                                <FormattedMessage
                                    id='mettormost.plugin.metrics.support.packet'
                                    defaultMessage={item.label}
                                >
                                    {(text) => (
                                        <label
                                            className='CommercialSupportModal__options_checkbox_label'
                                            htmlFor={item.id}
                                        >
                                            {text}
                                        </label>)
                                    }
                                </FormattedMessage>
                            </div>
                        ))}
                        <div className='CommercialSupportModal__download'>
                            <a
                                className='btn btn-primary DownloadSupportPacket'
                                href={this.genereateDownloadURLWithParams()}
                                rel='noopener noreferrer'
                            >
                                <FormattedMessage
                                    id='commercial_support.download_support_packet'
                                    defaultMessage='Download Support Packet'
                                />
                            </a>
                        </div>
                    </div>
                </Modal.Body>
            </Modal>
        );
    }
}
