import React, {ComponentProps, useEffect, useState} from 'react';

import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';
import {useDispatch, useSelector} from 'react-redux';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {ArrowLeftIcon} from '@mattermost/compass-icons/components';
import {ApolloProvider} from '@apollo/client';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import {getPlaybooksGraphQLClient} from 'src/graphql_client';
import {usePlaybook} from 'src/graphql/hooks';
import {BaseInput, BaseTextArea} from 'src/components/assets/inputs';
import GenericModal, {InlineLabel, ModalSideheading} from 'src/components/widgets/generic_modal';
import {createPlaybookRun} from 'src/client';
import {ButtonLabel, StyledChannelSelector, VerticalSplit} from 'src/components/backstage/playbook_edit/automation/channel_access';
import ClearIndicator from 'src/components/backstage/playbook_edit/automation/clear_indicator';
import MenuList from 'src/components/backstage/playbook_edit/automation/menu_list';
import {HorizontalSpacer, RadioInput} from 'src/components/backstage/styles';
import {displayPlaybookCreateModal} from 'src/actions';
import PlaybooksSelector from 'src/components/playbooks_selector';
import {SecondaryButton} from 'src/components/assets/buttons';
import SearchInput from 'src/components/backstage/search_input';
import {useCanCreatePlaybooksInTeam} from 'src/hooks';
import {RUN_NAME_MAX_LENGTH} from 'src/constants';

const ID = 'playbooks_run_playbook_dialog';

export const makeModalDefinition = (
    playbookId: string | undefined,
    triggerChannelId: string | undefined,
    teamId: string,
    onRunCreated: (runId: string, channelId: string, statsData: object) => void,
) => ({
    modalId: ID,
    dialogType: ApolloWrappedModal,
    dialogProps: {playbookId, triggerChannelId, teamId, onRunCreated},
});

type Props = {
    playbookId?: string,
    triggerChannelId?: string,
    teamId: string,
    onRunCreated: (runId: string, channelId: string, statsData: object) => void,
} & Partial<ComponentProps<typeof GenericModal>>;

const RunPlaybookModal = ({
    playbookId,
    triggerChannelId,
    teamId,
    onRunCreated,
    ...modalProps
}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const [step, setStep] = useState(playbookId === undefined ? 'select-playbook' : 'run-details');
    const [selectedPlaybookId, setSelectedPlaybookId] = useState(playbookId);
    const [playbook] = usePlaybook(selectedPlaybookId || '');
    const [runName, setRunName] = useState('');
    const [runSummary, setRunSummary] = useState('');
    const [channelMode, setChannelMode] = useState('');
    const [channelId, setChannelId] = useState('');
    const [createPublicRun, setCreatePublicRun] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showsearch, setShowsearch] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const canCreatePlaybooks = useCanCreatePlaybooksInTeam(teamId || '');

    const currentChannelId = useSelector(getCurrentChannelId);
    let userId = useSelector(getCurrentUserId);
    if (playbook?.default_owner_enabled && playbook.default_owner_id) {
        userId = playbook.default_owner_id;
    }

    useEffect(() => {
        if (playbook?.channel_mode === 'create_new_channel') {
            setRunName(playbook.channel_name_template);
        }
    }, [playbook, playbook?.channel_name_template, playbook?.channel_mode]);

    useEffect(() => {
        if (playbook && playbook?.run_summary_template_enabled) {
            setRunSummary(playbook.run_summary_template);
        }
    }, [playbook, playbook?.run_summary_template_enabled, playbook?.run_summary_template]);

    useEffect(() => {
        if (playbook) {
            setChannelMode(playbook.channel_mode);
        }
    }, [playbook, playbook?.channel_mode]);

    useEffect(() => {
        if (playbook) {
            setChannelId(playbook.channel_id);
        }
    }, [playbook, playbook?.channel_id]);

    useEffect(() => {
        if (playbook) {
            setCreatePublicRun(playbook.create_public_playbook_run);
        }
    }, [playbook, playbook?.create_public_playbook_run]);

    const createNewChannel = channelMode === 'create_new_channel';
    const linkExistingChannel = channelMode === 'link_existing_channel';
    const isFormValid = runName !== '' && runName.length <= RUN_NAME_MAX_LENGTH && (createNewChannel || channelId !== '');

    const handleSetChannelMode = (mode: 'link_existing_channel' | 'create_new_channel') => {
        setChannelMode(mode);

        // Default to the current channel when choosing link to the existing channel, we are in a channel context and the playbook does not have a linked channel
        if (mode === 'link_existing_channel' && playbook?.channel_mode === 'create_new_channel' && channelId === '' && currentChannelId) {
            setChannelId(currentChannelId);
        }
    };

    const onCreatePlaybook = () => {
        dispatch(displayPlaybookCreateModal({}));
        modalProps.onHide?.();
    };
    const onSubmit = () => {
        if (!playbook || !selectedPlaybookId || isSubmitting) {
            return;
        }

        setIsSubmitting(true);
        createPlaybookRun(
            selectedPlaybookId,
            userId,
            playbook.team_id,
            runName,
            runSummary,
            linkExistingChannel ? channelId : undefined,
            createNewChannel ? createPublicRun : undefined,
        )
            .then((newPlaybookRun) => {
                modalProps.onHide?.();
                const statsData = {
                    playbookId: selectedPlaybookId,
                    channelMode,
                    public: createNewChannel ? createPublicRun : undefined,
                    hasPlaybookChanged: playbookId !== selectedPlaybookId,
                    hasNameChanged: runName !== playbook.channel_name_template,
                    hasSummaryChanged: runSummary !== playbook.run_summary_template,
                    hasChannelModeChanged: channelMode !== playbook.channel_mode,
                    hasChannelIdChanged: channelId !== playbook.channel_id,
                    hasPublicChanged: !linkExistingChannel && createPublicRun !== playbook.create_public_playbook_run,
                };
                onRunCreated(newPlaybookRun.id, newPlaybookRun.channel_id, statsData);
            }).catch(() => {
            // show error
            }).finally(() => setIsSubmitting(false));
    };

    // Start a run tab
    if (step === 'run-details') {
        return (
            <StyledGenericModal
                cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
                confirmButtonText={formatMessage({defaultMessage: 'Start run'})}
                showCancel={true}
                isConfirmDisabled={isSubmitting || !isFormValid}
                handleConfirm={onSubmit}
                autoCloseOnConfirmButton={false}
                id={ID}
                modalHeaderText={(
                    <ColContainer>
                        <IconWrapper
                            onClick={() => {
                                setSearchTerm('');
                                setStep('select-playbook');
                            }}
                        >
                            <ArrowLeftIcon
                                size={24}
                                color={'rgba(var(--center-channel-color-rgb), 0.56)'}
                            />
                        </IconWrapper>
                        <HeaderTitle>
                            <FormattedMessage defaultMessage='Start a run'/>
                            <ModalSideheading>{playbook?.title}</ModalSideheading>
                        </HeaderTitle>
                    </ColContainer>
                )}
                {...modalProps}
            >
                <Body>
                    <RunNameSection
                        runName={runName}
                        onSetRunName={setRunName}
                    />

                    <InlineLabel>{formatMessage({defaultMessage: 'Run summary'})}</InlineLabel>
                    <BaseTextArea
                        data-testid={'run-summary-input'}
                        rows={5}
                        value={runSummary}
                        onChange={(e) => setRunSummary(e.target.value)}
                    />
                    <ConfigChannelSection
                        teamId={teamId}
                        channelId={channelId}
                        channelMode={channelMode}
                        createPublicRun={createPublicRun}
                        onSetCreatePublicRun={setCreatePublicRun}
                        onSetChannelMode={handleSetChannelMode}
                        onSetChannelId={setChannelId}
                    />
                </Body>
            </StyledGenericModal>
        );
    }

    // Select a playbook tab
    return (
        <StyledGenericModal
            showCancel={false}
            isConfirmDisabled={!isFormValid}
            id={ID}
            modalHeaderText={(
                <RowContainer>
                    <ColContainer>
                        <HeaderTitle>
                            <FormattedMessage defaultMessage='Select a playbook'/>
                        </HeaderTitle>
                        <HeaderButtonWrapper>
                            {canCreatePlaybooks && <CreatePlaybookButton onClick={onCreatePlaybook}>
                                <FormattedMessage defaultMessage='Create new playbook'/>
                            </CreatePlaybookButton>}
                        </HeaderButtonWrapper>
                    </ColContainer>
                    {showsearch && <SearchWrapper>
                        <SearchInput
                            testId={'search-filter'}
                            default={''}
                            onSearch={(term) => setSearchTerm(term)}
                            placeholder={formatMessage({defaultMessage: 'Search playbooks'})}
                            width={'100%'}
                        />
                    </SearchWrapper>}
                </RowContainer>
            )}
            {...modalProps}
        >
            <Body>
                <PlaybooksSelector
                    onCreatePlaybook={onCreatePlaybook}
                    teamID={teamId}
                    channelID={triggerChannelId || ''}
                    onZeroCaseNoPlaybooks={(isZeroNoShow: boolean) => setShowsearch(!isZeroNoShow)}
                    searchTerm={searchTerm}
                    onSelectPlaybook={(id) => {
                        setSelectedPlaybookId(id);
                        setStep('run-details');
                    }}
                />
            </Body>
        </StyledGenericModal>
    );
};

type runNameProps = {
    runName: string;
    onSetRunName: (name: string) => void;
};

const RunNameSection = ({runName, onSetRunName}: runNameProps) => {
    const {formatMessage} = useIntl();
    const [error, setError] = useState('');

    const onRunNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (error && value.length <= RUN_NAME_MAX_LENGTH) {
            setError('');
        } else if (!error && value.length > RUN_NAME_MAX_LENGTH) {
            setError(formatMessage({defaultMessage: 'The run name should not exceed {maxLength} characters'}, {maxLength: RUN_NAME_MAX_LENGTH}));
        }

        onSetRunName(value);
    };

    return (<>
        <RunNameLabel invalid={Boolean(error)}>
            {formatMessage({defaultMessage: 'Run name'})}{error ? ' *' : ''}
        </RunNameLabel>
        <BaseInput
            invalid={Boolean(error)}
            data-testid={'run-name-input'}
            autoFocus={true}
            type={'text'}
            value={runName}
            onChange={onRunNameChange}
        />
        {error && <ErrorMessage data-testid={'run-name-error'}>{error}</ErrorMessage>}
    </>);
};

type channelProps = {
    teamId: string;
    channelMode: string;
    channelId: string;
    createPublicRun: boolean;
    onSetCreatePublicRun: (val: boolean) => void;
    onSetChannelMode: (mode: 'link_existing_channel' | 'create_new_channel') => void;
    onSetChannelId: (channelId: string) => void;
};

const ConfigChannelSection = ({teamId, channelMode, channelId, createPublicRun, onSetCreatePublicRun, onSetChannelMode, onSetChannelId}: channelProps) => {
    const {formatMessage} = useIntl();
    const createNewChannel = channelMode === 'create_new_channel';
    const linkExistingChannel = channelMode === 'link_existing_channel';
    return (
        <ChannelContainer>
            <ChannelBlock>
                <StyledRadioInput
                    data-testid={'link-existing-channel-radio'}
                    type='radio'
                    checked={linkExistingChannel}
                    onChange={() => onSetChannelMode('link_existing_channel')}
                />
                <FormattedMessage defaultMessage='Link to an existing channel'/>
            </ChannelBlock>
            {linkExistingChannel && (
                <SelectorWrapper>
                    <StyledChannelSelector
                        id={'link-existing-channel-selector'}
                        onChannelSelected={(channel_id: string) => onSetChannelId(channel_id)}
                        channelIds={channelId ? [channelId] : []}
                        isClearable={true}
                        selectComponents={{ClearIndicator, DropdownIndicator: () => null, IndicatorSeparator: () => null, MenuList}}
                        isDisabled={false}
                        captureMenuScroll={false}
                        shouldRenderValue={true}
                        teamId={teamId}
                        isMulti={false}
                    />
                </SelectorWrapper>
            )}

            <ChannelBlock >
                <StyledRadioInput
                    data-testid={'create-channel-radio'}
                    type='radio'
                    checked={createNewChannel}
                    onChange={() => onSetChannelMode('create_new_channel')}
                />
                <FormattedMessage defaultMessage='Create a run channel'/>
            </ChannelBlock>

            {createNewChannel && (
                <HorizontalSplit>
                    <VerticalSplit>
                        <ButtonLabel disabled={false}>
                            <RadioInput
                                data-testid={'create-public-channel-radio'}
                                type='radio'
                                checked={createPublicRun}
                                onChange={() => onSetCreatePublicRun(true)}
                            />
                            <Icon
                                disabled={false}
                                active={createPublicRun}
                                className={'icon-globe'}
                            />
                            <BigText>{formatMessage({defaultMessage: 'Public channel'})}</BigText>
                        </ButtonLabel>
                        <HorizontalSpacer size={8}/>
                        <ButtonLabel disabled={false}>
                            <RadioInput
                                data-testid={'create-private-channel-radio'}
                                type='radio'
                                checked={!createPublicRun}
                                onChange={() => onSetCreatePublicRun(false)}
                            />
                            <Icon
                                disabled={false}
                                active={!createPublicRun}
                                className={'icon-lock-outline'}
                            />
                            <BigText>{formatMessage({defaultMessage: 'Private channel'})}</BigText>
                        </ButtonLabel>
                    </VerticalSplit>
                </HorizontalSplit>
            )}
        </ChannelContainer>
    );
};

const StyledGenericModal = styled(GenericModal)`
    &&& {
        h1 {
            width:100%;
        }

        .modal-header {
            padding: 24px 31px;
            margin-bottom: 0;
            box-shadow: inset 0px -1px 0px rgba(var(--center-channel-color-rgb), 0.16);
        }
        .modal-content {
            padding: 0px;
        }
        .modal-body {
            padding: 24px 31px;
        }
        .modal-footer {
           box-shadow: inset 0px -1px 0px rgba(var(--center-channel-color-rgb), 0.16);
           padding: 0 31px 28px 31px;
        }
    }
`;

const ColContainer = styled.div`
    display: flex;
    flex-direction: row;
`;

const RowContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 15px;
`;

const HeaderTitle = styled.div`
    display: flex;
    flex-direction: row;
    height: 28px;
    align-items: center;
`;

const IconWrapper = styled.div`
    display: flex;
    cursor: pointer;
    flex-direction: column;
    height: 28px;
    justify-content: center;
    margin-right: 8px;
`;

const Body = styled.div`
    display: flex;
    flex-direction: column;
    & > div, & > input {
        margin-bottom: 12px;
    }
`;

const ChannelContainer = styled.div`
    margin-top: 39px;
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

const StyledRadioInput = styled(RadioInput)`
    && {
        margin: 0;
    }
`;

const ChannelBlock = styled.label`
    display: flex;
    flex-direction: row;
    width: 350px;
    align-items: center;
    column-gap: 12px;
    align-self: 'flex-start';
    font-weight: inherit;
    margin-bottom: 0;
    cursor: pointer;
`;

const SelectorWrapper = styled.div`
    margin-left: 28px;
    min-height: 40px;
`;

const Icon = styled.i<{ active?: boolean, disabled: boolean }>`
    font-size: 16px;
    line-height: 16px;
    color: ${({active, disabled}) => (active && !disabled ? 'var(--button-bg)' : 'rgba(var(--center-channel-color-rgb), 0.56)')};
`;

const BigText = styled.div`
    font-size: 14px;
    line-height: 20px;
    font-weight: 400;
`;

const HorizontalSplit = styled.div`
    display: block;
    text-align: left;
    margin-left: 28px;
`;

const HeaderButtonWrapper = styled.div`
    margin-left: auto;
    margin-right: 30px;
`;
const CreatePlaybookButton = styled(SecondaryButton)`
    font-family: 'Open Sans';
    height: 32px;
    padding: 0 10px;
`;

const SearchWrapper = styled.div`
`;

const RunNameLabel = styled(InlineLabel)<{invalid?: boolean}>`
    color: ${(props) => (props.invalid ? 'var(--error-text)' : 'rgba(var(--center-channel-color-rgb), 0.64)')};
`;

const ErrorMessage = styled.div`
    color: var(--error-text);
    font-size: 12px;
    line-height: 16px;
    margin-top: -8px;
    font-weight: 400;
    margin-bottom: 20px !important;
`;

const ApolloWrappedModal = (props: Props) => {
    const client = getPlaybooksGraphQLClient();
    return <ApolloProvider client={client}><RunPlaybookModal {...props}/></ApolloProvider>;
};

