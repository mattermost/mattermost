// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    ComponentProps,
    ReactNode,
    useMemo,
    useState,
} from 'react';
import {Link} from 'react-router-dom';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {DateTime, Duration} from 'luxon';

import {GlobalState} from '@mattermost/types/store';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import {ApolloProvider, useQuery} from '@apollo/client';

import GenericModal, {Description, Label} from 'src/components/widgets/generic_modal';
import UnsavedChangesModal from 'src/components/widgets/unsaved_changes_modal';

import {
    Mode,
    Option,
    ms,
    useDateTimeInput,
    useMakeOption,
} from 'src/components/datetime_input';

import {useFormattedUsernames, usePost} from 'src/hooks';

import MarkdownTextbox from 'src/components/markdown_textbox';

import {pluginUrl} from 'src/browser_routing';
import {postStatusUpdate} from 'src/client';
import {nearest} from 'src/utils';
import Tooltip from 'src/components/widgets/tooltip';

import WarningIcon from 'src/components/assets/icons/warning_icon';

import CheckboxInput from 'src/components/backstage/runs_list/checkbox_input';
import {makeUncontrolledConfirmModalDefinition} from 'src/components/widgets/confirmation_modal';
import {browserHistory, modals} from 'src/webapp_globals';
import {openUpdateRunStatusModal, showRunActionsModal} from 'src/actions';
import {VerticalSpacer} from 'src/components/backstage/styles';
import RouteLeavingGuard from 'src/components/backstage/route_leaving_guard';
import {useFinishRunConfirmationMessage} from 'src/components/backstage/playbook_runs/playbook_run/finish_run';
import {getPlaybooksGraphQLClient} from 'src/graphql_client';
import {getFragmentData, graphql} from 'src/graphql/generated';
import {DefaultMessageFragment, ReminderTimerFragment} from 'src/graphql/generated/graphql';

const ID = 'playbooks_update_run_status_dialog';
const NAMES_ON_TOOLTIP = 5;

type Props = {
    playbookRunId: string;
    channelId: string;
    hasPermission: boolean;
    message?: string,
    reminderInSeconds?: number,
    finishRunChecked?: boolean,
} & Partial<ComponentProps<typeof GenericModal>>;

export const makeModalDefinition = (props: Props) => ({
    modalId: ID,
    dialogType: ApolloWrappedModal,
    dialogProps: props,
});

const runStatusModalQueryDocument = graphql(/* GraphQL */`
    query RunStatusModal($runID: String!) {
        run(id: $runID) {
            id
            name
            teamID
            ...DefaultMessage
            ...ReminderTimer
            broadcastChannelIDs
            statusUpdateBroadcastChannelsEnabled
            checklists {
                items {
                    state
                }
            }
            followers
        }
    }
`);

const UpdateRunStatusModal = ({
    playbookRunId,
    channelId,
    hasPermission,
    message: providedMessage,
    reminderInSeconds: providedReminder,
    finishRunChecked: providedFinishRunChecked,
    ...modalProps
}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage, formatList} = useIntl();
    const currentUserId = useSelector(getCurrentUserId);
    const {data} = useQuery(runStatusModalQueryDocument, {
        variables: {
            runID: playbookRunId,
        },
        fetchPolicy: 'network-only',
    });
    const run = data?.run;

    const [message, setMessage] = useState(providedMessage);
    const defaultMessage = useDefaultMessage(getFragmentData(DefaultMessage, run));
    if (message == null && defaultMessage) {
        setMessage(defaultMessage);
    }

    const confirmationMessage = useFinishRunConfirmationMessage(run);

    const [showModal, setShowModal] = useState(true);
    const [showUnsaved, setShowUnsaved] = useState(false);
    const [showUnsavedRoute, setShowUnsaveRoute] = useState(false);
    const [finishRun, setFinishRun] = useState(providedFinishRunChecked || false);

    const {input: reminderInput, reminder} = useReminderTimerOption(getFragmentData(ReminderTimer, run), finishRun, providedReminder);
    const isReminderValid = finishRun || (reminder && reminder > 0);
    let warningMessage = formatMessage({defaultMessage: 'Date must be in the future.'});
    if (!reminder || reminder === 0) {
        warningMessage = formatMessage({defaultMessage: 'Please specify a future date/time for the update reminder.'});
    }

    // Extract channel and follower names
    // The limit applied must be done at the end to consider the chance
    // that the names are hidden to us (channels we haven't joined or are private)
    const broadcastChannelNames = useSelector((state: GlobalState) => {
        return run?.broadcastChannelIDs.reduce<string[]>((result, id) => {
            const displayName = getChannel(state, id)?.display_name;
            if (displayName) {
                result.push(displayName);
            }
            return result;
        }, []);
    })?.slice(0, NAMES_ON_TOOLTIP) || [];
    const followerNames = useFormattedUsernames(run?.followers)?.slice(0, NAMES_ON_TOOLTIP);

    const generateTooltipText = (names: string[], total: number) => {
        // other should be added when:
        // - we have more items than the limit (NAMES_ON_TOOLTIP)
        // - we have les than the limit (NAMES_ON_TOOLTIP) but some are hidden
        const shouldAddOther = total > NAMES_ON_TOOLTIP || names.length < total;
        return names.length ? formatMessage({defaultMessage: '{text}{rest, plural, =0 {} one { and other} other { and {rest} others}}'}, {
            text: shouldAddOther ? names.join(', ') : formatList(names, {type: 'conjunction'}),
            rest: total - names.length,
        }) : '';
    };

    const pendingChanges = !(providedMessage === message || message === defaultMessage || message === '');

    const onTentativeHide = () => {
        if (pendingChanges) {
            setShowUnsaved(true);
        } else {
            onActualHide();
        }
    };

    const onActualHide = () => {
        modalProps.onHide?.();
        setTimeout(() => {
            setShowUnsaved(false);
        }, 300);
    };

    const onConfirm = () => {
        if (hasPermission && message?.trim() && currentUserId && channelId && run?.teamID) {
            postStatusUpdate(
                playbookRunId,
                {message, reminder, finishRun},
                {user_id: currentUserId, channel_id: channelId, team_id: run?.teamID}
            );
            onActualHide();
        }
    };

    const onSubmit = () => {
        if (finishRun) {
            onActualHide();

            dispatch(modals.openModal(makeUncontrolledConfirmModalDefinition({
                show: true,
                title: formatMessage({defaultMessage: 'Confirm finish run'}),
                message: confirmationMessage,
                confirmButtonText: formatMessage({defaultMessage: 'Finish run'}),
                onConfirm,
                onCancel: () => {
                    dispatch(openUpdateRunStatusModal(playbookRunId, channelId, hasPermission, message, reminder, finishRun));
                    setShowModal(true);
                },
            })));
        } else {
            onConfirm();
        }
    };

    const description = () => {
        let broadcastChannelCount = 0;
        if (run?.statusUpdateBroadcastChannelsEnabled) {
            broadcastChannelCount = run?.broadcastChannelIDs.length ?? 0;
        }
        const followersChannelCount = run?.followers?.length ?? 0;

        const OverviewLink = (...chunks: string[]): ReactNode => (
            <Link
                data-testid='run-overview-link'
                to={pluginUrl(`/runs/${playbookRunId}?from=status_modal`)}
            >
                {chunks}
            </Link>
        );

        if ((broadcastChannelCount + followersChannelCount) === 0) {
            return formatMessage({
                defaultMessage: 'This update will be saved to <OverviewLink>overview page</OverviewLink>.',
            }, {OverviewLink});
        }

        return formatMessage({
            defaultMessage: 'This update for the run <i>{runName}</i> will be broadcasted to {hasChannels, select, true {<OverviewLink><ChannelsTooltip>{broadcastChannelCount, plural, =1 {one channel} other {{broadcastChannelCount, number} channels}}</ChannelsTooltip></OverviewLink>} other {}}{hasFollowersAndChannels, select, true { and } other {}}{hasFollowers, select, true {<FollowersTooltip>{followersChannelCount, plural, =1 {one direct message} other {{followersChannelCount, number} direct messages}}</FollowersTooltip>} other {}}.',
        }, {
            OverviewLink,
            ChannelsTooltip: (...chunks) => (
                <Tooltip
                    id={`${ID}_broadcast_channels_tooltip`}
                    content={generateTooltipText(broadcastChannelNames, broadcastChannelCount)}
                >
                    <TooltipContent tabIndex={0}>{chunks}</TooltipContent>
                </Tooltip>
            ),
            FollowersTooltip: (...chunks) => (
                <Tooltip
                    id={`${ID}_broadcast_followers_tooltip`}
                    content={generateTooltipText(followerNames, followersChannelCount)}
                >
                    <TooltipContent tabIndex={1}>{chunks}</TooltipContent>
                </Tooltip>
            ),
            i: (x: React.ReactNode) => <i>{x}</i>,
            runName: run?.name || '',
            hasFollowersAndChannels: Boolean(broadcastChannelCount && followersChannelCount).toString(),
            hasChannels: Boolean(broadcastChannelCount).toString(),
            hasFollowers: Boolean(followersChannelCount).toString(),
            broadcastChannelCount,
            followersChannelCount,
        });
    };

    const form = (
        <FormContainer>
            <Description data-testid='update_run_status_description'>{description()}</Description>
            <Label>
                {formatMessage({defaultMessage: 'Change since last update'})}
            </Label>
            <MarkdownTextbox
                id='update_run_status_textbox'
                value={message ?? ''}
                setValue={setMessage}
                channelId={channelId}
            />
            <Label>
                {formatMessage({defaultMessage: 'Timer for next update'})}
            </Label>
            {reminderInput}
            {!isReminderValid &&
                <WarningLine>
                    <WarningIcon/> {warningMessage}
                </WarningLine>
            }
            <VerticalSpacer size={8}/>
        </FormContainer>
    );

    const footer = (
        <StyledCheckboxInput
            testId={'mark-run-as-finished'}
            text={formatMessage({defaultMessage: 'Also mark the run as finished'})}
            checked={finishRun}
            onChange={(checked) => setFinishRun(checked)}
        />
    );

    const warning = (
        <WarningBlock>
            <span>
                {formatMessage({defaultMessage: 'You do not have permission to post an update.'})}
            </span>
        </WarningBlock>
    );

    const preopenRunActionsModal = () => {
        // Open modal only if there are already broadcast channels
        if (run?.broadcastChannelIDs.length) {
            dispatch(showRunActionsModal());
        }
    };

    return (
        <>
            <GenericModal
                show={showModal && !showUnsaved && !showUnsavedRoute}
                modalHeaderText={formatMessage({defaultMessage: 'Post update'})}
                cancelButtonText={hasPermission ? formatMessage({defaultMessage: 'Cancel'}) : formatMessage({defaultMessage: 'Close'})}
                confirmButtonText={hasPermission ? formatMessage({defaultMessage: 'Post update'}) : formatMessage({defaultMessage: 'Ok'})}
                handleCancel={() => true}
                {...modalProps}
                onHide={onTentativeHide}
                onExited={() => null}
                handleConfirm={hasPermission ? onSubmit : null}
                autoCloseOnConfirmButton={false}
                isConfirmDisabled={!(hasPermission && message?.trim() && currentUserId && channelId && run?.teamID && isReminderValid)}
                id={ID}
                footer={footer}
                components={{FooterContainer}}
            >
                {hasPermission ? form : warning}
            </GenericModal>
            <UnsavedChangesModal
                show={showUnsaved}
                onConfirm={onActualHide}
                onCancel={() => setShowUnsaved(false)}
            />
            <RouteLeavingGuard
                onCancel={() => {
                    setShowModal(true);
                    setShowUnsaveRoute(false);
                }}
                navigate={(path) => {
                    modalProps.onHide?.();
                    preopenRunActionsModal();
                    browserHistory.push(path);
                }}
                shouldBlockNavigation={(newLoc) => {
                    const locChanged = location.pathname !== newLoc.pathname;

                    // block nav and keep modal
                    if (locChanged && pendingChanges) {
                        setShowUnsaveRoute(true);
                        return true;
                    }

                    if (locChanged) {
                        modalProps.onHide?.();
                        preopenRunActionsModal();
                    }
                    return false;
                }}
            />

        </>
    );
};

const DefaultMessage = graphql(/* GraphQL */`
    fragment DefaultMessage on Run {
        reminderMessageTemplate
        statusPosts {
            id
            deleteAt
        }
    }
`);

const useDefaultMessage = (run: Maybe<DefaultMessageFragment>) => {
    const lastStatusPostMeta = run?.statusPosts.slice().reverse().find(({deleteAt}) => !deleteAt);
    const [lastStatusPost] = usePost(lastStatusPostMeta?.id ?? '');

    if (!run) {
        return null;
    }

    if (lastStatusPostMeta) {
        // last status exist and should have a post-message
        return lastStatusPost?.message;
    }

    // run loaded and was no last status post, but there might be a message template
    return run?.reminderMessageTemplate;
};

const ReminderTimer = graphql(/* GraphQL */`
    fragment ReminderTimer on Run {
        previousReminder
        reminderTimerDefaultSeconds
        statusPosts {
            deleteAt
        }
    }
`);

const useReminderTimerOption = (
    run: Maybe<ReminderTimerFragment>,
    disabled?: boolean,
    preselectedValue?: number,
) => {
    const {locale} = useIntl();
    const makeOption = useMakeOption(Mode.DurationValue);

    const defaults = useMemo(() => {
        const options = [
            makeOption({hours: 1}),
            makeOption({days: 1}),
            makeOption({days: 7}),
        ];

        let value: Option | undefined;
        if (preselectedValue) {
            value = makeOption({seconds: preselectedValue});
        }
        if (run) {
            if (!value && run.previousReminder) {
                value = makeOption({seconds: nearest(run.previousReminder * 1e-9, 60)});
            }

            if (run.reminderTimerDefaultSeconds) {
                const defaultReminderOption = makeOption({seconds: run.reminderTimerDefaultSeconds});
                if (!options.find((o) => ms(o.value) === ms(defaultReminderOption.value))) {
                    // don't duplicate an option that exists already
                    options.push(defaultReminderOption);
                }

                if (!value && !run?.statusPosts.some(({deleteAt}) => !deleteAt)) {
                    // set preselected-default if it was not set previously
                    // and there are no previous status posts (excluding deleted)
                    // (the previous reminder timer specified take precedence)
                    value = defaultReminderOption;
                }
            }
        }

        const matched = options.find((o) => value && ms(o.value) === ms(value.value));
        if (matched) {
            // don't duplicate an option that exists already
            value = matched;
        } else if (value) {
            options.push(value);
        }
        options.sort((a, b) => ms(a.value) - ms(b.value));

        return {options, value};
    }, [run, preselectedValue, locale]);

    const {input, value} = useDateTimeInput({
        mode: Mode.DateTimeValue,
        parsingOptions: {forwardDate: true, defaultUnit: 'minutes'},
        defaultOptions: defaults.options,
        defaultValue: defaults.value,
        id: 'reminder_timer_datetime',
        disabled,
    });

    let reminder = 0;
    if (value?.value) {
        reminder = (Duration.isDuration(value.value) ? value.value : value.value.diff(DateTime.now())).as('seconds');
    }

    return {input, reminder};
};

const FormContainer = styled.div`
    display: flex;
    flex-direction: column;
    color: var(--center-channel-color);

    ${Description} {
        span {
            text-decoration: underline;
            font-weight: bold;
        }
    }
`;

const TooltipContent = styled.span`
    cursor: pointer;
`;

const WarningBlock = styled.div`
    padding: 2rem;
    display: flex;
    place-content: center;

    span {
        padding: 1.5rem;
    }
`;

const WarningLine = styled.p`
    color: var(--error-text);
    margin-top: 0.6rem;
`;

const FooterContainer = styled.div`
    display: flex;
    flex-direction: row-reverse;
    align-items: center;
`;

const StyledCheckboxInput = styled(CheckboxInput)`
    padding: 10px 16px 10px 0;
    margin-right: auto;
    white-space: normal;

    &:hover {
        background-color: transparent;
    }
`;

const ApolloWrappedModal = (props: Props) => {
    const client = getPlaybooksGraphQLClient();
    return <ApolloProvider client={client}><UpdateRunStatusModal {...props}/></ApolloProvider>;
};
