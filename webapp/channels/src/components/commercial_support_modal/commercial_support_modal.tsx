// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';
import React from 'react';
import {Modal} from 'react-bootstrap';
import {defineMessages, FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import {extractFilenameFromContentDisposition} from '@mattermost/client';
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

const messages = defineMessages({
    genericError: {
        id: 'commercial_support_modal.download_error',
        defaultMessage: 'Unable to download the Support Packet. Please try again.',
    },
});

// Delay before releasing the downloaded file from memory. Revoking the object URL
// synchronously after click() can cancel the download in some browsers.
const REVOKE_OBJECT_URL_DELAY_MS = 40 * 1000;

function formatDownloadError(data: unknown): string | undefined {
    if (!data || typeof data !== 'object') {
        return undefined;
    }

    const {message, detailed_error: detailedError} = data as {message?: unknown; detailed_error?: unknown};
    const parts = [message, detailedError].filter((part): part is string => typeof part === 'string' && part.length > 0);

    return parts.length ? parts.join(': ') : undefined;
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

    generateDownloadURLWithParams = (): string => {
        const url = new URL(Client4.getSystemRoute() + '/support_packet');
        this.state.packetContents.forEach((content) => {
            if (content.id === 'basic.server.logs') {
                url.searchParams.set('basic_server_logs', String(content.selected));
            } else if (!content.mandatory && content.selected) {
                url.searchParams.append('plugin_packets', content.id);
            }
        });
        return url.toString();
    };

    extractFilename = (input: string | null): string => {
        // construct the expected filename in case of an error in the header
        const formattedDate = (moment(new Date())).format('YYYY-MM-DDTHH-mm');
        const presumedFileName = `mm_support_packet_${formattedDate}.zip`;

        return extractFilenameFromContentDisposition(input, presumedFileName);
    };

    downloadSupportPacket = async () => {
        this.abortController?.abort();
        const abortController = new AbortController();
        this.abortController = abortController;

        this.setState({loading: true, error: undefined});

        let blob: Blob;
        let filename: string;
        try {
            const res = await fetch(this.generateDownloadURLWithParams(), {
                method: 'GET',
                signal: abortController.signal,
            });

            if (!res.ok) {
                let data: unknown;
                try {
                    data = await res.json();
                } catch {
                    // The body isn't JSON, e.g. an HTML error page from a proxy.
                }

                if (!abortController.signal.aborted) {
                    this.setState({loading: false, error: formatDownloadError(data) ?? true});
                }
                return;
            }

            blob = await res.blob();
            filename = this.extractFilename(res.headers.get('content-disposition'));
        } catch {
            // Aborted requests mean the modal was closed or a new download started; there is nothing to report.
            if (!abortController.signal.aborted) {
                this.setState({loading: false, error: true});
            }
            return;
        }

        if (abortController.signal.aborted) {
            return;
        }

        this.setState({loading: false});

        const href = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.setAttribute('download', filename);
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

        const url = new URL('https://customers.mattermost.com/cloud/contact-us');
        url.searchParams.set('name', `${currentUser.first_name} ${currentUser.last_name}`);
        url.searchParams.set('email', currentUser.email);
        url.searchParams.set('inquiry', 'technical');
        return url.toString();
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
                                            strong: (chunks) => <strong>{chunks}</strong>,
                                            debugLink: (chunks) => <Link to='/admin_console/environment/logging'>{chunks}</Link>,
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
                                        {error === true ? <FormattedMessage {...messages.genericError}/> : error}
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
