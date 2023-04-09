// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useState, useCallback} from 'react';

import {Modal} from 'react-bootstrap';

import {InsightsWidgetTypes, TimeFrame} from '@mattermost/types/insights';

import TimeFrameDropdown from '../time_frame_dropdown/time_frame_dropdown';
import TopReactionsTable from '../top_reactions/top_reactions_table/top_reactions_table';
import TopChannelsTable from '../top_channels/top_channels_table/top_channels_table';
import TopThreadsTable from '../top_threads/top_threads_table/top_threads_table';
import TopBoardsTable from '../top_boards/top_boards_table/top_boards_table';
import LeastActiveChannelsTable from '../least_active_channels/least_active_channels_table/least_active_channels_table';
import TopPlaybooksTable from '../top_playbooks/top_playbooks_table/top_playbooks_table';
import TopDMsTable from '../top_dms_and_new_members/top_dms_table/top_dms_table';
import NewMembersTable from '../top_dms_and_new_members/new_members_table/new_members_table';

import './../../activity_and_insights.scss';
import './insights_modal.scss';

type Props = {
    onExited: () => void;
    widgetType: InsightsWidgetTypes;
    title: string;
    subtitle: string;
    filterType: string;
    timeFrame: TimeFrame;
    setShowModal?: (show: boolean) => void;
}

const InsightsModal = (props: Props) => {
    const [show, setShow] = useState(true);
    const [timeFrame, setTimeFrame] = useState(props.timeFrame);
    const [offset, setOffset] = useState(0);

    const setTimeFrameValue = useCallback((value) => {
        setTimeFrame(value.value);
        setOffset(0);
    }, []);

    const doHide = useCallback(() => {
        props.setShowModal?.(false);
        setShow(false);
    }, []);

    const modalContent = useCallback(() => {
        switch (props.widgetType) {
        case InsightsWidgetTypes.TOP_CHANNELS:
            return (
                <TopChannelsTable
                    filterType={props.filterType}
                    timeFrame={timeFrame}
                    closeModal={doHide}
                />
            );
        case InsightsWidgetTypes.TOP_REACTIONS:
            return (
                <TopReactionsTable
                    filterType={props.filterType}
                    timeFrame={timeFrame}
                />
            );
        case InsightsWidgetTypes.TOP_THREADS:
            return (
                <TopThreadsTable
                    filterType={props.filterType}
                    timeFrame={timeFrame}
                    closeModal={doHide}
                />
            );
        case InsightsWidgetTypes.TOP_BOARDS:
            return (
                <TopBoardsTable
                    filterType={props.filterType}
                    timeFrame={timeFrame}
                    closeModal={doHide}
                />
            );
        case InsightsWidgetTypes.LEAST_ACTIVE_CHANNELS:
            return (
                <LeastActiveChannelsTable
                    filterType={props.filterType}
                    timeFrame={timeFrame}
                    closeModal={doHide}
                />
            );
        case InsightsWidgetTypes.TOP_PLAYBOOKS:
            return (
                <TopPlaybooksTable
                    filterType={props.filterType}
                    timeFrame={timeFrame}
                    closeModal={doHide}
                />
            );
        case InsightsWidgetTypes.TOP_DMS:
            return (
                <TopDMsTable
                    filterType={props.filterType}
                    timeFrame={timeFrame}
                    closeModal={doHide}
                />
            );
        case InsightsWidgetTypes.NEW_TEAM_MEMBERS:
            return (
                <NewMembersTable
                    filterType={props.filterType}
                    timeFrame={timeFrame}
                    closeModal={doHide}
                    offset={offset}
                    setOffset={setOffset}
                />
            );
        default:
            return null;
        }
    }, [props.widgetType, timeFrame, offset]);

    return (
        <Modal
            dialogClassName='a11y__modal insights-modal'
            show={show}
            onHide={doHide}
            onExited={props.onExited}
            aria-labelledby='insightsModalLabel'
            id='insightsModal'
        >
            <Modal.Header closeButton={true}>
                <div className='title-section'>
                    <Modal.Title
                        componentClass='h1'
                        id='insightsModalTitle'
                    >
                        {props.title}
                    </Modal.Title>
                    <div className='subtitle'>
                        {props.subtitle}
                    </div>
                </div>
                <TimeFrameDropdown
                    timeFrame={timeFrame}
                    setTimeFrame={setTimeFrameValue}
                />
            </Modal.Header>
            <Modal.Body
                className='overflow--visible'
            >
                {modalContent()}
            </Modal.Body>
        </Modal>
    );
};

export default memo(InsightsModal);
