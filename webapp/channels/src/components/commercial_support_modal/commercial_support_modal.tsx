// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import {ClientError} from '@mattermost/client';
import {buildQueryString} from '@mattermost/client/lib/helpers';
import {DownloadOutlineIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/compass-ui/components/button';
import {Checkbox} from '@mattermost/compass-ui/components/checkbox';
import {Icon} from '@mattermost/compass-ui/components/icon';
import type {SupportPacketContent} from '@mattermost/types/admin';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import AlertBanner from 'components/alert_banner';
import ExternalLink from 'components/external_link';

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
    loading: boolean;

    /**
     * Error text from the server, or true when the download failed without a usable message.
     */
    error?: string | true;
};

// Delay before releasing the downloaded file from memory. Revoking the object URL
// synchronously after click() can cancel the download in some browsers.
const REVOKE_OBJECT_URL_DELAY_MS = 40 * 1000;

// Returns the server's error text, or true to show the generic message (e.g. for network errors).
function getDownloadError(err: unknown): string | true {
    if (err instanceof ClientError) {
        return [err.message, err.detailed_error].filter(Boolean).join(': ') || true;
    }
    return true;
}

export default class CommercialSupportModal extends React.PureComponent<Props, State> {
    private abortController?: AbortController;

    constructor(props: Props) {
        super(props);
        this.state = {
            show: true,
            showBannerWarning: props.showBannerWarning,
            packetContents: props.packetContents,
            loading: false,
        };
    }

    componentWillUnmount() {
        this.abortController?.abort();
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

    getSupportPacketOptions = () => {
        const {packetContents} = this.state;
        return {
            basicServerLogs: packetContents.some((content) => content.id === 'basic.server.logs' && content.selected),
            pluginPackets: packetContents.
                filter((content) => content.id !== 'basic.server.logs' && !content.mandatory && content.selected).
                map((content) => content.id),
        };
    };

    downloadSupportPacket = async () => {
        this.abortController?.abort();
        const abortController = new AbortController();
        this.abortController = abortController;

        this.setState({loading: true, error: undefined});

        let packet: {blob: Blob; filename: string} | undefined;
        let error: State['error'];
        try {
            packet = await Client4.getSupportPacket(this.getSupportPacketOptions(), abortController.signal);
        } catch (err) {
            error = getDownloadError(err);
        }

        // The modal was closed or a new download started; there is nothing to report.
        if (abortController.signal.aborted) {
            return;
        }

        this.setState({loading: false, error});
        if (!packet) {
            return;
        }

        const href = window.URL.createObjectURL(packet.blob);
        const link = document.createElement('a');
        link.href = href;
        link.setAttribute('download', packet.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => window.URL.revokeObjectURL(href), REVOKE_OBJECT_URL_DELAY_MS);
    };

    getSupportLink = (): string => {
        const {isCloud, currentUser} = this.props;
        if (!isCloud) {
            return 'https://support.mattermost.com/hc/en-us/requests/new';
        }

        return 'https://customers.mattermost.com/cloud/contact-us' + buildQueryString({
            name: [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' '),
            email: currentUser.email,
            inquiry: 'technical',
        });
    };

    render() {
        const {showBannerWarning, error} = this.state;
        const supportLink = this.getSupportLink();
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
                        <FormattedMessage
                            id='commercial_support_modal.description'
                            defaultMessage={'If you\'re experiencing issues, <supportLink>submit a support ticket</supportLink>. To help with troubleshooting, it\'s recommended to download the Support Packet below that includes more details about your Mattermost environment.'}
                            values={{
                                supportLink: (chunks) => (
                                    <ExternalLink
                                        key='supportLink'
                                        href={supportLink}
                                        location='commercialSupportModal'
                                    >
                                        {chunks}
                                    </ExternalLink>
                                ),
                            }}
                        />
                        {showBannerWarning &&
                            <AlertBanner
                                mode='info'
                                message={
                                    <FormattedMessage
                                        id='commercial_support_modal.warning.banner'
                                        defaultMessage='Before downloading the Support Packet, set <strong>Output Logs to File</strong> to <strong>true</strong> and set <strong>File Log Level</strong> to <strong>DEBUG</strong> <debugLink>here</debugLink>.'
                                        values={{
                                            strong: (chunks) => <strong key='strong'>{chunks}</strong>,
                                            debugLink: (chunks) => (
                                                <Link
                                                    key='debugLink'
                                                    to='/admin_console/environment/logging'
                                                >
                                                    {chunks}
                                                </Link>
                                            ),
                                        }}
                                    />
                                }
                                onDismiss={this.hideBannerWarning}
                            />
                        }
                        <div className='CommercialSupportModal__packet_contents_download'>
                            <strong>
                                <FormattedMessage
                                    id='commercial_support_modal.download_contents'
                                    defaultMessage={'Select your Support Packet contents to download'}
                                />
                            </strong>
                        </div>
                        <div className='CommercialSupportModal__options'>
                            {this.state.packetContents.map((item, index) => (
                                <div
                                    className='CommercialSupportModal__option'
                                    key={item.id}
                                >
                                    <Checkbox
                                        id={item.id}
                                        name={item.id}
                                        checked={item.selected}
                                        disabled={item.mandatory}
                                        onChange={() => this.updateCheckStatus(index)}
                                    >
                                        {item.label}
                                    </Checkbox>
                                </div>
                            ))}
                        </div>
                        <div className='CommercialSupportModal__download'>
                            {error && (
                                <div className='CommercialSupportModal__error'>
                                    <span className='error-text'>
                                        {error === true ? (
                                            <FormattedMessage
                                                id='commercial_support_modal.download_error'
                                                defaultMessage='Unable to download the Support Packet. Please try again.'
                                            />
                                        ) : error}
                                    </span>
                                </div>
                            )}
                            <Button
                                emphasis='primary'
                                className='DownloadSupportPacket'
                                onClick={this.downloadSupportPacket}
                                loading={this.state.loading}
                                leadingIcon={<Icon glyph={<DownloadOutlineIcon/>}/>}
                            >
                                <FormattedMessage
                                    id='commercial_support.download_support_packet'
                                    defaultMessage='Download Support Packet'
                                />
                            </Button>
                        </div>
                    </div>
                </Modal.Body>
            </Modal>
        );
    }
}
