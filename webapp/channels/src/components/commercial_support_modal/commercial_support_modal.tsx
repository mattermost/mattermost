// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {defineMessages, FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import {ClientError} from '@mattermost/client';
import {buildQueryString} from '@mattermost/client/lib/helpers';
import {ChevronDownIcon, ChevronRightIcon, DownloadOutlineIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/compass-ui/components/button';
import {Checkbox} from '@mattermost/compass-ui/components/checkbox';
import {Icon} from '@mattermost/compass-ui/components/icon';
import type {SupportPacketContent} from '@mattermost/types/admin';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import AlertBanner from 'components/alert_banner';
import ExternalLink from 'components/external_link';

import './commercial_support_modal.scss';

const BASIC_CONTENTS_ID = 'basic.contents';
const SERVER_LOGS_ID = 'basic.server.logs';
const BASIC_CONTENTS_INCLUDED_LIST_ID = 'commercialSupportModalBasicContentsIncluded';

const messages = defineMessages({
    basicContentsLabel: {
        id: 'commercial_support_modal.basic_contents.label',
        defaultMessage: 'Basic contents',
    },
    serverLogsLabel: {
        id: 'commercial_support_modal.server_logs.label',
        defaultMessage: 'Server logs',
    },
    required: {
        id: 'commercial_support_modal.required',
        defaultMessage: '(required)',
    },
    basicContentsDescription: {
        id: 'commercial_support_modal.basic_contents.description',
        defaultMessage: 'Server version, license details, system diagnostics, sanitized configuration, usage counts, job status, permissions, plugin list, database schema, and performance profiles. Does not include message content.',
    },
    whatsIncluded: {
        id: 'commercial_support_modal.basic_contents.whats_included',
        defaultMessage: 'What\'s included',
    },
    serverLogsDescription: {
        id: 'commercial_support_modal.server_logs.description',
        defaultMessage: 'Recent server log files, including any advanced and audit log files. May contain usernames, email addresses, IP addresses, and error details.',
    },
});

const basicContentsIncludedItems = defineMessages({
    serverInfo: {
        id: 'commercial_support_modal.basic_contents.included.server_info',
        defaultMessage: 'Server version, license, and server ID',
    },
    diagnostics: {
        id: 'commercial_support_modal.basic_contents.included.diagnostics',
        defaultMessage: 'System diagnostics: OS, CPU, memory, database, file storage, and connectivity checks',
    },
    config: {
        id: 'commercial_support_modal.basic_contents.included.config',
        defaultMessage: 'Configuration with credentials removed',
    },
    usage: {
        id: 'commercial_support_modal.basic_contents.included.usage',
        defaultMessage: 'Usage counts: users, posts, channels, teams',
    },
    jobs: {
        id: 'commercial_support_modal.basic_contents.included.jobs',
        defaultMessage: 'Background job status',
    },
    permissions: {
        id: 'commercial_support_modal.basic_contents.included.permissions',
        defaultMessage: 'Permission schemes and roles',
    },
    plugins: {
        id: 'commercial_support_modal.basic_contents.included.plugins',
        defaultMessage: 'Installed plugins and their versions',
    },
    pluginData: {
        id: 'commercial_support_modal.basic_contents.included.plugin_data',
        defaultMessage: 'Usage counts and settings from installed plugins',
    },
    databaseSchema: {
        id: 'commercial_support_modal.basic_contents.included.database_schema',
        defaultMessage: 'Database table structure (no data)',
    },
    profiles: {
        id: 'commercial_support_modal.basic_contents.included.profiles',
        defaultMessage: 'Performance profiles (CPU, memory, goroutines)',
    },
});

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
    showBasicContentsIncluded: boolean;
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
    // The download keeps going after the modal closes, so the file is still saved.
    // Once unmounted, only the state updates are skipped.
    private unmounted = false;

    constructor(props: Props) {
        super(props);
        this.state = {
            show: true,
            showBannerWarning: props.showBannerWarning,
            packetContents: props.packetContents,
            loading: false,
            showBasicContentsIncluded: false,
        };
    }

    componentWillUnmount() {
        this.unmounted = true;
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
            basicServerLogs: packetContents.some((content) => content.id === SERVER_LOGS_ID && content.selected),
            pluginPackets: packetContents.
                filter((content) => content.id !== SERVER_LOGS_ID && !content.mandatory && content.selected).
                map((content) => content.id),
        };
    };

    toggleBasicContentsIncluded = () => {
        this.setState({showBasicContentsIncluded: !this.state.showBasicContentsIncluded});
    };

    renderOptionLabel = (item: SupportPacketContent) => {
        if (item.id === BASIC_CONTENTS_ID) {
            return <FormattedMessage {...messages.basicContentsLabel}/>;
        }

        if (item.id === SERVER_LOGS_ID) {
            return <FormattedMessage {...messages.serverLogsLabel}/>;
        }

        return item.label;
    };

    renderOptionDescription = (id: string) => {
        if (id === BASIC_CONTENTS_ID) {
            const {showBasicContentsIncluded} = this.state;
            return (
                <div className='CommercialSupportModal__option_details'>
                    <p
                        id={`${id}-description`}
                        className='CommercialSupportModal__option_description'
                    >
                        <FormattedMessage {...messages.basicContentsDescription}/>
                    </p>
                    <Button
                        emphasis='link'
                        size='small'
                        className='CommercialSupportModal__whats_included_toggle'
                        aria-expanded={showBasicContentsIncluded}
                        aria-controls={BASIC_CONTENTS_INCLUDED_LIST_ID}
                        onClick={this.toggleBasicContentsIncluded}
                        leadingIcon={<Icon glyph={showBasicContentsIncluded ? <ChevronDownIcon/> : <ChevronRightIcon/>}/>}
                    >
                        <FormattedMessage {...messages.whatsIncluded}/>
                    </Button>
                    {showBasicContentsIncluded && (
                        <ul
                            id={BASIC_CONTENTS_INCLUDED_LIST_ID}
                            className='CommercialSupportModal__whats_included_list'
                        >
                            {Object.entries(basicContentsIncludedItems).map(([key, message]) => (
                                <li key={key}>
                                    <FormattedMessage {...message}/>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            );
        }

        if (id === SERVER_LOGS_ID) {
            return (
                <div className='CommercialSupportModal__option_details'>
                    <p
                        id={`${id}-description`}
                        className='CommercialSupportModal__option_description'
                    >
                        <FormattedMessage {...messages.serverLogsDescription}/>
                    </p>
                </div>
            );
        }

        return null;
    };

    downloadSupportPacket = async () => {
        this.setState({loading: true, error: undefined});

        let packet: {blob: Blob; filename: string} | undefined;
        let error: State['error'];
        try {
            packet = await Client4.getSupportPacket(this.getSupportPacketOptions());
        } catch (err) {
            error = getDownloadError(err);
        }

        if (!this.unmounted) {
            this.setState({loading: false, error});
        }
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
                            {this.state.packetContents.map((item, index) => {
                                const description = this.renderOptionDescription(item.id);
                                const describedBy = [
                                    item.mandatory && `${item.id}-required`,
                                    description && `${item.id}-description`,
                                ].filter(Boolean).join(' ');
                                return (
                                    <div
                                        className='CommercialSupportModal__option'
                                        key={item.id}
                                    >
                                        <div className='CommercialSupportModal__option_header'>
                                            <Checkbox
                                                className='CommercialSupportModal__option_checkbox'
                                                id={item.id}
                                                name={item.id}
                                                checked={item.selected}
                                                disabled={item.mandatory}
                                                onChange={() => this.updateCheckStatus(index)}
                                                aria-describedby={describedBy || undefined}
                                            >
                                                {this.renderOptionLabel(item)}
                                            </Checkbox>
                                            {item.mandatory && (
                                                <span
                                                    id={`${item.id}-required`}
                                                    className='CommercialSupportModal__option_required'
                                                >
                                                    <FormattedMessage {...messages.required}/>
                                                </span>
                                            )}
                                        </div>
                                        {description}
                                    </div>
                                );
                            })}
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
