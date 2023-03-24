// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';
import {CSSTransition} from 'react-transition-group';
import {useSelector} from 'react-redux';

import {AccordionItemType} from 'components/common/accordion/accordion';
import {trackEvent} from 'actions/telemetry_actions';
import {GlobalState} from 'types/store';
import {TELEMETRY_CATEGORIES} from 'utils/constants';
import {Board, Channel, Integration, Playbook, WorkTemplate} from '@mattermost/types/work_templates';
import {MarketplacePlugin} from '@mattermost/types/marketplace';

import {getTemplateDefaultIllustration} from '../utils';

import Accordion from './preview/accordion';
import Chip from './preview/chip';
import PreviewSection from './preview/section';

export interface PreviewProps {
    className?: string;
    template: WorkTemplate;
    pluginsEnabled: boolean;
}

interface IllustrationAnimations {
    prior: {
        animateIn: boolean;
        illustration: string;
    };
    current: {
        animateIn: boolean;
        illustration: string;
    };
}

const ANIMATE_TIMEOUTS = {
    appear: 0,
    enter: 200,
    exit: 200,
};

const Preview = ({template, className, pluginsEnabled}: PreviewProps) => {
    const {formatMessage} = useIntl();

    const nodeRefForPrior = useRef(null);
    const nodeRefForCurrent = useRef(null);

    const [integrations, setIntegrations] = useState<Integration[]>();

    const plugins: MarketplacePlugin[] = useSelector((state: GlobalState) => state.views.marketplace.plugins);

    const [illustrationDetails, setIllustrationDetails] = useState<IllustrationAnimations>(() => {
        const defaultIllustration = getTemplateDefaultIllustration(template);
        return {
            prior: {
                animateIn: false,
                illustration: defaultIllustration,
            },
            current: {
                animateIn: true,
                illustration: defaultIllustration,
            },
        };
    });

    useEffect(() => {
        trackEvent(TELEMETRY_CATEGORIES.WORK_TEMPLATES, 'pageview_preview');
    }, []);

    useEffect(() => {
        if (illustrationDetails.prior.animateIn) {
            setIllustrationDetails((prevState: IllustrationAnimations) => ({
                prior: {
                    ...prevState.prior,
                    animateIn: false,
                },
                current: {
                    ...prevState.current,
                    animateIn: true,
                },
            }));
        }
    }, [illustrationDetails.prior.animateIn]);

    const handleIllustrationUpdate = (illustration: string) => {
        // don't refresh if this is the same illustration
        if (illustrationDetails.current.illustration === illustration) {
            return;
        }

        setIllustrationDetails({
            prior: {...illustrationDetails.current},
            current: {
                animateIn: false,
                illustration,
            },
        });
    };

    const [channels, boards, playbooks, availableIntegrations] = useMemo(() => {
        const channels: Channel[] = [];
        const boards: Board[] = [];
        const playbooks: Playbook[] = [];
        const availableIntegrations: Integration[] = [];
        template.content.forEach((c) => {
            if (c.channel) {
                channels.push(c.channel);
            }
            if (c.board) {
                boards.push(c.board);
            }
            if (c.playbook) {
                playbooks.push(c.playbook);
            }
            if (c.integration) {
                availableIntegrations.push(c.integration);
            }
        });
        return [channels, boards, playbooks, availableIntegrations];
    }, [template.content]);

    useEffect(() => {
        if (!pluginsEnabled) {
            return;
        }
        const intg =
            availableIntegrations?.
                flatMap((integration) => {
                    return plugins.reduce((acc: Integration[], curr) => {
                        if (curr.manifest.id === integration.id) {
                            acc.push({
                                ...integration,
                                name: curr.manifest.name,
                                icon: curr.icon_data,
                                installed: curr.installed_version !== '',
                            });

                            return acc;
                        }
                        return acc;
                    }, [] as Integration[]);
                }).sort((first: Integration) => {
                    return first.installed ? -1 : 1;
                });
        if (intg?.length) {
            setIntegrations(intg);
        }
    }, [plugins, availableIntegrations, pluginsEnabled]);

    // building accordion items
    const accordionItemsData: AccordionItemType[] = [];
    if (channels.length > 0) {
        accordionItemsData.push({
            id: 'channels',
            icon: <i className='icon-product-channels'/>,
            title: formatMessage({id: 'work_templates.preview.accordion_title_channels', defaultMessage: 'Channels'}),
            extraContent: <Chip>{channels.length}</Chip>,
            items: [(
                <PreviewSection
                    key={'channels'}
                    id={'channels'}
                    message={template.description.channel.message}
                    items={channels}
                    onUpdateIllustration={(illustration) => handleIllustrationUpdate(illustration)}
                />
            )],
        });
    }
    if (boards.length > 0) {
        accordionItemsData.push({
            id: 'boards',
            icon: <i className='icon-product-boards'/>,
            title: formatMessage({id: 'work_templates.preview.accordion_title_boards', defaultMessage: 'Boards'}),
            extraContent: <Chip>{boards.length}</Chip>,
            items: [(
                <PreviewSection
                    key={'boards'}
                    id={'boards'}
                    message={template.description.board.message}
                    items={boards}
                    onUpdateIllustration={(illustration) => handleIllustrationUpdate(illustration)}
                />
            )],
        });
    }
    if (playbooks.length > 0) {
        accordionItemsData.push({
            id: 'playbooks',
            icon: <i className='icon-product-playbooks'/>,
            title: formatMessage({id: 'work_templates.preview.accordion_title_playbooks', defaultMessage: 'Playbooks'}),
            extraContent: <Chip>{playbooks.length}</Chip>,
            items: [(
                <PreviewSection
                    key={'playbooks'}
                    id={'playbooks'}
                    message={template.description.playbook.message}
                    items={playbooks}
                    onUpdateIllustration={(illustration) => handleIllustrationUpdate(illustration)}
                />
            )],
        });
    }
    if (integrations?.length && pluginsEnabled) {
        accordionItemsData.push({
            id: 'integrations',
            icon: <i className='icon-power-plug-outline'/>,
            title: 'Integrations',
            extraContent: <Chip>{integrations.length}</Chip>,
            items: [(
                <PreviewSection
                    key={'integrations'}
                    id={'integrations'}
                    message={template.description.integration.message}
                    items={integrations}
                    categoryId={template.category}
                />
            )],
        });
    }

    // When opening an accordion section, change the illustration to whatever has been open
    const handleItemOpened = (index: number) => {
        trackEvent(TELEMETRY_CATEGORIES.WORK_TEMPLATES, 'expand_preview_section', {section: accordionItemsData[index].id, category: template.category, template: template.id});
        const item = accordionItemsData[index];
        const newPrior = {
            ...illustrationDetails.current,
            animateIn: true,
        };
        const newCurrent: IllustrationAnimations['current'] = {
            animateIn: false,
            illustration: '',
        };
        switch (item.id) {
        case 'channels':
            newCurrent.illustration = channels[0].illustration;
            break;
        case 'boards':
            newCurrent.illustration = boards[0].illustration;
            break;
        case 'playbooks':
            newCurrent.illustration = playbooks[0].illustration;
            break;
        case 'integrations':
            newCurrent.illustration = template.description.integration.illustration;
            break;
        default:
            return;
        }

        setIllustrationDetails({
            prior: newPrior,
            current: newCurrent,
        });
    };

    return (
        <div className={className}>
            <div className='content-side'>
                <strong>{formatMessage({id: 'work_templates.preview.what_you_get', defaultMessage: 'Here\'s what you\'ll get:'})}</strong>
                <Accordion
                    accordionItemsData={accordionItemsData}
                    openFirstElement={true}
                    onItemOpened={handleItemOpened}
                />
            </div>
            <div className='img-wrapper'>
                <CSSTransition
                    nodeRef={nodeRefForPrior}
                    in={illustrationDetails.prior.animateIn}
                    timeout={ANIMATE_TIMEOUTS}
                    classNames='prior-illustration'
                >
                    <img
                        ref={nodeRefForPrior}
                        src={illustrationDetails.prior.illustration}
                    />
                </CSSTransition>
                <CSSTransition
                    nodeRef={nodeRefForCurrent}
                    in={illustrationDetails.current.animateIn}
                    timeout={ANIMATE_TIMEOUTS}
                    classNames='current-illustration'
                >
                    <img
                        ref={nodeRefForCurrent}
                        src={illustrationDetails.current.illustration}
                    />
                </CSSTransition>
            </div>
        </div>
    );
};

const StyledPreview = styled(Preview)`
    display: flex;

    .content-side {
        min-width: 387px;
        width: 387px;
        height: 416px;
        padding-right: 32px;
    }

    strong {
        display: block;
        font-family: 'Metropolis';
        font-weight: 600;
        font-size: 18px;
        line-height: 24px;
        color: var(--center-channel-text);
        margin-bottom: 8px;
    }

    .img-wrapper {
        position: relative;
        width: 100%;
        margin-top: 32px;
    }

    img {
        box-shadow: var(--elevation-2);
        border-radius: 8px;
        position: absolute;
    }

    .prior-illustration-enter,
    .prior-illustration-enter-done,
    .prior-illustration-exit-done {
        opacity: 0;
    }

    .prior-illustration-exit {
      opacity: 1;
    }

    .prior-illustration-exit-active {
      opacity: 0;
      transition: opacity 200ms ease-in-out;
    }

    .current-illustration-enter,
    .current-illustration-exit,
    .current-illustration-exit-done {
        opacity: 0;
    }

    .current-illustration-enter-active {
      opacity: 1;
      transition: opacity 200ms ease-in-out;
    }

    .current-illustration-enter-done {
      opacity: 1;
    }
`;

export default StyledPreview;
