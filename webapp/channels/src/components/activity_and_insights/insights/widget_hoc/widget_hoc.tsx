// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentType, useCallback, useState} from 'react';
import {useDispatch} from 'react-redux';
import {useIntl} from 'react-intl';

import {openModal} from 'actions/views/modals';

import {trackEvent} from 'actions/telemetry_actions';

import {CardSize, InsightsWidgetTypes, TimeFrame} from '@mattermost/types/insights';

import InsightsCard from '../card/card';
import InsightsModal from '../insights_modal/insights_modal';

import {InsightsScopes, InsightsCardTitles, ModalIdentifiers} from 'utils/constants';
import {DispatchFunc} from 'mattermost-redux/types/actions';

export interface WidgetHocProps {
    size: CardSize;
    widgetType: InsightsWidgetTypes;
    filterType: string;
    class: string;
    timeFrame: TimeFrame;
}

function widgetHoc<T>(WrappedComponent: ComponentType<T>) {
    const Component = (props: T & WidgetHocProps) => {
        const {formatMessage} = useIntl();
        const dispatch = useDispatch<DispatchFunc>();
        const [showModal, setShowModal] = useState(false);

        const title = useCallback(() => {
            if (props.filterType === InsightsScopes.MY && Object.keys(InsightsCardTitles[props.widgetType].myTitle).length !== 0) {
                return formatMessage(InsightsCardTitles[props.widgetType].myTitle);
            }
            if (props.filterType === InsightsScopes.TEAM && Object.keys(InsightsCardTitles[props.widgetType].teamTitle).length !== 0) {
                return formatMessage(InsightsCardTitles[props.widgetType].teamTitle);
            }
            return '';
        }, [props.filterType, props.widgetType]);

        const subTitle = useCallback(() => {
            if (props.filterType === InsightsScopes.MY && Object.keys(InsightsCardTitles[props.widgetType].mySubTitle).length !== 0) {
                return formatMessage(InsightsCardTitles[props.widgetType].mySubTitle);
            }
            if (props.filterType === InsightsScopes.TEAM && Object.keys(InsightsCardTitles[props.widgetType].teamSubTitle).length !== 0) {
                return formatMessage(InsightsCardTitles[props.widgetType].teamSubTitle);
            }
            return '';
        }, [props.filterType, props.widgetType]);

        const openInsightsModal = useCallback(() => {
            trackEvent('insights', `open_modal_${props.widgetType.toLowerCase()}`);
            setShowModal(true);
            dispatch(openModal({
                modalId: ModalIdentifiers.INSIGHTS,
                dialogType: InsightsModal,
                dialogProps: {
                    widgetType: props.widgetType,
                    title: title(),
                    subtitle: subTitle(),
                    filterType: props.filterType,
                    timeFrame: props.timeFrame,
                    setShowModal,
                },
            }));
        }, [props.widgetType, title, subTitle, props.filterType, props.timeFrame]);

        return (
            <InsightsCard
                class={props.class}
                title={title()}
                subTitle={subTitle()}
                size={props.size}
                onClick={openInsightsModal}
            >
                <WrappedComponent
                    {...(props as unknown as T)}
                    showModal={showModal}
                />
            </InsightsCard>
        );
    };

    return Component;
}

export default widgetHoc;
