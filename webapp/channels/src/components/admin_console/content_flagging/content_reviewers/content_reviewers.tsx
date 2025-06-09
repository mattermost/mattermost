// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import AsyncSelect from 'react-select/async';

import {debounce} from 'mattermost-redux/actions/helpers';
import {searchProfiles} from 'mattermost-redux/actions/users';

import {Label} from 'components/admin_console/boolean_setting';
import CheckboxSetting from 'components/admin_console/checkbox_setting';
import {
    AdminSection,
    SectionContent,
    SectionHeader,
} from 'components/admin_console/system_properties/controls';

import './content_reviewers.scss';

import {UserMultiSelector} from '../../content_flagging/user_multiselector/user_multiselector';
import { searchTeams } from "mattermost-redux/actions/teams";
import { TeamOptionComponent } from "components/admin_console/content_flagging/content_reviewers/team_option";
import { Team } from "utils/text_formatting";
import { TeamSearchOpts } from "@mattermost/types/teams";

const noOp = () => null;

export default function ContentFlaggingContentReviewers() {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const [selectedTeamIDs, setSelectedTeamIDs] = useState<string[]>(['3fdro3m3z7rijngi7d5jweynbo', 'paxk6d4spif3pg5faai8a5hqac', 'ocujxjt68fgbfqymqh14bd3ego']);

    const [sameReviewersForAllTeams, setSameReviewersForAllTeams] = React.useState(false);

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
                                    isMulti={false}
                                    isClearable={false}
                                    hideSelectedOptions={false}
                                    cacheOptions={true}
                                    placeholder={teamSearchInputPlaceholder}
                                    loadingMessage={userLoadingMessage}
                                    noOptionsMessage={noUsersMessage}
                                    onChange={() => {}}
                                    loadOptions={searchTeamFromTerm}
                                    components={{
                                        DropdownIndicator: () => null,
                                        IndicatorSeparator: () => null,
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
