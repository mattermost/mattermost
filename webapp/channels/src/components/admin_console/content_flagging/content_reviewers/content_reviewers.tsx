// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import AsyncSelect from 'react-select/async';

import type {TeamSearchOpts} from '@mattermost/types/teams';

import {debounce} from 'mattermost-redux/actions/helpers';
import { getTeam, getTeams, searchTeams } from "mattermost-redux/actions/teams";

import {Label} from 'components/admin_console/boolean_setting';
import CheckboxSetting from 'components/admin_console/checkbox_setting';
import {
    AdminSection,
    SectionContent,
    SectionHeader,
} from 'components/admin_console/system_properties/controls';

import './content_reviewers.scss';

import type {Team} from 'utils/text_formatting';

import {TeamOptionComponent} from './team_option';

import {UserMultiSelector} from '../../content_flagging/user_multiselector/user_multiselector';

const noOp = () => null;

export default function ContentFlaggingContentReviewers() {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    // TODO: Replace with actual team IDs from your settings
    const [selectedTeamIDs, setSelectedTeamIDs] = useState<string[]>(['3fdro3m3z7rijngi7d5jweynbo', 'paxk6d4spif3pg5faai8a5hqac', 'ocujxjt68fgbfqymqh14bd3ego']);
    const [selectedTeams, setSelectedTeams] = useState<Team[]>([]);

    const [sameReviewersForAllTeams, setSameReviewersForAllTeams] = useState(false);

    // Fetch teams when the component mounts
    useEffect(() => {
        const fetchTeams = async () => {
            const teamPromises = selectedTeamIDs.map((teamID) => dispatch(getTeam(teamID)));
            try {
                const teams = await Promise.all(teamPromises);
                const validTeams = teams.filter((team) => team && team.data && team.data.id).map((team) => team.data as Team);
                setSelectedTeams(validTeams);
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Error fetching teams:', error);
            }
        };

        // only need to fetch the selected teams initially.
        if (selectedTeams.length === 0) {
            fetchTeams();
        }
    }, [dispatch, selectedTeamIDs, selectedTeams]);

    const handleSameReviewersForAllTeamsChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setSameReviewersForAllTeams(event.target.value === 'true');
    }, []);

    const teamSearchInputPlaceholder = useMemo(() => {
        return (
            <div className='teamSearchInputPlaceholder'>
                <span
                    id='searchIcon'
                    aria-hidden='true'
                >
                    <i className='icon icon-magnify'/>
                </span>
                <FormattedMessage
                    id='admin.contentFlagging.reviewerSettings.teamReviewers.placeholder'
                    defaultMessage='Search and select teams'
                />
            </div>
        );
    }, []);
    const userLoadingMessage = useCallback(() => formatMessage({id: 'admin.userMultiSelector.loading', defaultMessage: 'Loading users'}), []);
    const noUsersMessage = useCallback(() => formatMessage({id: 'admin.userMultiSelector.noUsers', defaultMessage: 'No users found'}), []);

    const searchTeamFromTerm = useMemo(() => debounce(async (searchTerm: string, callback) => {
        try {
            const response = await dispatch(searchTeams(searchTerm, {page: 0, per_page: 50} as TeamSearchOpts));

            if (response && response.data && response.data && response.data.teams && response.data.teams.length > 0) {
                const teams = (response.data.teams as Team[]).
                    map((team) => ({
                        value: team.id,
                        label: team.display_name,
                        raw: team,
                    }));

                callback(teams);
            }

            callback([]);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
            callback([]);
        }
    }, 200), [dispatch]);

    return (
        <AdminSection>
            <SectionHeader>
                <hgroup>
                    <h1 className='content-flagging-section-title'>
                        <FormattedMessage
                            id='admin.contentFlagging.reviewerSettings.title'
                            defaultMessage='Content Reviewers'
                        />
                    </h1>
                    <h5 className='content-flagging-section-description'>
                        <FormattedMessage
                            id='admin.contentFlagging.reviewerSettings.description'
                            defaultMessage='Define who should review content in your environment'
                        />
                    </h5>
                </hgroup>
            </SectionHeader>

            <SectionContent>
                <div className='content-flagging-section-setting-wrapper'>
                    {/* Same reviewers for all teams */}
                    <div className='content-flagging-section-setting'>
                        <div className='setting-title'>
                            <FormattedMessage
                                id='admin.contentFlagging.reviewerSettings.sameReviewersForAllTeams'
                                defaultMessage='Same reviewers for all teams:'
                            />
                        </div>

                        <div className='setting-content'>
                            <Label isDisabled={false}>
                                <input
                                    data-testid='sameReviewersForAllTeams_true'
                                    id='sameReviewersForAllTeams_true'
                                    type='radio'
                                    value='true'
                                    checked={sameReviewersForAllTeams}
                                    onChange={handleSameReviewersForAllTeamsChange}
                                />
                                <FormattedMessage
                                    id='admin.true'
                                    defaultMessage='True'
                                />
                            </Label>

                            <Label isDisabled={false}>
                                <input
                                    data-testid='sameReviewersForAllTeams_false'
                                    id='sameReviewersForAllTeams_false'
                                    type='radio'
                                    value='false'
                                    checked={!sameReviewersForAllTeams}
                                    onChange={handleSameReviewersForAllTeamsChange}
                                />
                                <FormattedMessage
                                    id='admin.false'
                                    defaultMessage='False'
                                />
                            </Label>
                        </div>
                    </div>

                    {
                        sameReviewersForAllTeams &&
                        <div className='content-flagging-section-setting'>
                            <div className='setting-title'>
                                <FormattedMessage
                                    id='admin.contentFlagging.reviewerSettings.commonReviewers'
                                    defaultMessage='Reviewers:'
                                />
                            </div>

                            <div className='setting-content'>
                                <UserMultiSelector
                                    id='content_reviewers_common_reviewers'
                                />
                            </div>
                        </div>
                    }

                    {
                        !sameReviewersForAllTeams &&
                        <div className='content-flagging-section-setting teamSpecificReviewerSection'>
                            <div className='setting-title'>
                                <FormattedMessage
                                    id='admin.contentFlagging.reviewerSettings.commonReviewers'
                                    defaultMessage='Reviewers'
                                />
                            </div>

                            <div className='helpText'>
                                <FormattedMessage
                                    id='admin.contentFlagging.reviewerSettings.teamReviewers.helpText'
                                    defaultMessage='Assign reviewers for the teams in which you want to enable content flagging'
                                />
                            </div>

                            <div className='teamSearchWrapper'>
                                <AsyncSelect
                                    id='teamSearchSelect'
                                    inputId='teamSearchSelect_input'
                                    classNamePrefix='team-multiselector'
                                    className='Input Input__focus'
                                    isClearable={false}
                                    hideSelectedOptions={false}
                                    cacheOptions={true}
                                    placeholder={teamSearchInputPlaceholder}
                                    loadingMessage={userLoadingMessage}
                                    noOptionsMessage={noUsersMessage}
                                    loadOptions={searchTeamFromTerm}
                                    controlShouldRenderValue={false}
                                    components={{
                                        DropdownIndicator: () => null,
                                        IndicatorSeparator: () => null,
                                        SingleValue: () => null,
                                        Option: TeamOptionComponent,
                                    }}
                                />

                                <button
                                    className='selectAllTeamsButton btn btn-link'
                                >
                                    <FormattedMessage
                                        id='admin.contentFlagging.reviewerSettings.teamReviewers.addTeam'
                                        defaultMessage='Select all teams'
                                    />
                                </button>
                            </div>

                            <div>

                            </div>

                        </div>
                    }

                    <div className='content-flagging-section-setting'>
                        <div className='setting-title'>
                            <FormattedMessage
                                id='admin.contentFlagging.reviewerSettings.additionalReviewers'
                                defaultMessage='Additional reviewers'
                            />
                        </div>

                        <div className='setting-content-wrapper'>
                            <div className='setting-content'>
                                <CheckboxSetting
                                    id='notifyOnDismissal_reviewers'
                                    label={
                                        <FormattedMessage
                                            id='admin.contentFlagging.reviewerSettings.additionalReviewers.systemAdmins'
                                            defaultMessage='System Administrators'
                                        />
                                    }
                                    defaultChecked={false}
                                    onChange={noOp}
                                    setByEnv={false}
                                />

                                <CheckboxSetting
                                    id='notifyOnDismissal_author'
                                    label={
                                        <FormattedMessage
                                            id='admin.contentFlagging.reviewerSettings.additionalReviewers.teamAdmins'
                                            defaultMessage='Team Administrators'
                                        />
                                    }
                                    defaultChecked={false}
                                    onChange={noOp}
                                    setByEnv={false}
                                />
                            </div>

                            <div className='helpText'>
                                <FormattedMessage
                                    id='admin.contentFlagging.reviewerSettings.additionalReviewers.helpText'
                                    defaultMessage='If enabled, system administrators will be sent flagged posts for review from every team that they are a part of. Team administrators will only be sent flagged posts for review from their respective teams.'
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </SectionContent>
        </AdminSection>
    );
}
