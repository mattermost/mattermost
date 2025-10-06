// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ChangeEvent, FormEvent, SyntheticEvent} from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import type {CustomEmoji} from '@mattermost/types/emojis';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import BackstageHeader from 'components/backstage/components/backstage_header';
import FormError from 'components/form_error';
import SpinnerButton from 'components/spinner_button';

import {getHistory} from 'utils/browser_history';
import {Constants} from 'utils/constants';
import type EmojiMap from 'utils/emoji_map';

export interface AddEmojiProps {
    actions: {
        createCustomEmoji: (term: CustomEmoji, imageData: File) => Promise<ActionResult>;
        patchCustomEmoji?: (emoji: CustomEmoji) => Promise<ActionResult>;
        getCustomEmoji?: (emojiId: string) => Promise<ActionResult>;
    };
    emojiMap: EmojiMap;
    user: UserProfile;
    team: Team;
    match?: {
        params: {
            emojiId?: string;
        };
    };
}

type EmojiCreateArgs = {
    creator_id: string;
    name: string;
    description: string;
};

type AddEmojiState = {
    name: string;
    description: string;
    image: File | null;
    imageUrl: string | ArrayBuffer | null;
    saving: boolean;
    error: React.ReactNode;
    loading: boolean;
    isEditMode: boolean;
    emojiId: string;
};

interface AddErrorResponse {
    error: Error;
}

interface AddEmojiResponse {
    data: CustomEmoji;
}

export default class AddEmoji extends React.PureComponent<AddEmojiProps, AddEmojiState> {
    constructor(props: AddEmojiProps) {
        super(props);

        const isEditMode = Boolean(props.match?.params?.emojiId);
        const emojiId = props.match?.params?.emojiId || '';

        this.state = {
            name: '',
            description: '',
            image: null,
            imageUrl: '',
            saving: false,
            error: null,
            loading: isEditMode,
            isEditMode,
            emojiId,
        };
    }

    async componentDidMount() {
        if (this.state.isEditMode && this.props.actions.getCustomEmoji) {
            const result = await this.props.actions.getCustomEmoji(this.state.emojiId);
            if ('data' in result) {
                const emoji = (result as {data: CustomEmoji}).data;
                this.setState({
                    name: emoji.name,
                    description: emoji.description || '',
                    imageUrl: `${this.props.user ? '/api/v4' : ''}/emoji/${emoji.id}/image`,
                    loading: false,
                });
            } else {
                this.setState({
                    loading: false,
                    error: (
                        <FormattedMessage
                            id='add_emoji.failedToLoad'
                            defaultMessage='Failed to load emoji'
                        />
                    ),
                });
            }
        }
    }

    handleFormSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        return this.handleSubmit(e);
    };

    handleSaveButtonClick = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>): Promise<void> => {
        return this.handleSubmit(e);
    };

    handleSubmit = async (e: SyntheticEvent<unknown>): Promise<void> => {
        const {actions, emojiMap, user, team} = this.props;
        const {image, name, description, saving, isEditMode, emojiId} = this.state;

        e.preventDefault();

        if (saving) {
            return;
        }

        this.setState({
            saving: true,
            error: null,
        });

        // Handle edit mode
        if (isEditMode && actions.patchCustomEmoji) {
            const emoji: CustomEmoji = {
                id: emojiId,
                create_at: 0,
                update_at: 0,
                delete_at: 0,
                creator_id: user.id,
                name: name,
                description: description.trim(),
                category: 'custom',
            };

            const response = await actions.patchCustomEmoji(emoji);

            if ('data' in response) {
                getHistory().push('/' + team.name + '/emoji');
                return;
            }

            if ('error' in response) {
                const responseError = response as AddErrorResponse;
                if (responseError) {
                    this.setState({
                        saving: false,
                        error: responseError.error.message,
                    });
                    return;
                }
            }

            this.setState({
                saving: false,
                error: (
                    <FormattedMessage
                        id='add_emoji.failedToUpdate'
                        defaultMessage='Something went wrong when updating the custom emoji.'
                    />
                ),
            });
            return;
        }

        const emoji: EmojiCreateArgs = {
            creator_id: user.id,
            name: name.trim().toLowerCase(),
            description: description.trim(),
        };

        // trim surrounding colons if the user accidentally included them in the name
        if (emoji.name.startsWith(':') && emoji.name.endsWith(':')) {
            emoji.name = emoji.name.substring(1, emoji.name.length - 1);
        }

        if (!emoji.name) {
            this.setState({
                saving: false,
                error: (
                    <FormattedMessage
                        id='add_emoji.nameRequired'
                        defaultMessage='A name is required for the emoji'
                    />
                ),
            });

            return;
        }

        if ((/[^a-z0-9+_-]/).test(emoji.name)) {
            this.setState({
                saving: false,
                error: (
                    <FormattedMessage
                        id='add_emoji.nameInvalid'
                        defaultMessage="An emoji's name can only contain lowercase letters, numbers, and the symbols '-', '+' and '_'."
                    />
                ),
            });

            return;
        }

        if (emojiMap.hasSystemEmoji(emoji.name)) {
            this.setState({
                saving: false,
                error: (
                    <FormattedMessage
                        id='add_emoji.nameTaken'
                        defaultMessage='This name is already in use by a system emoji. Please choose another name.'
                    />
                ),
            });

            return;
        }

        if (emojiMap.has(emoji.name)) {
            this.setState({
                saving: false,
                error: (
                    <FormattedMessage
                        id='add_emoji.customNameTaken'
                        defaultMessage='This name is already in use by a custom emoji. Please choose another name.'
                    />
                ),
            });

            return;
        }

        if (!image) {
            this.setState({
                saving: false,
                error: (
                    <FormattedMessage
                        id='add_emoji.imageRequired'
                        defaultMessage='An image is required for the emoji'
                    />
                ),
            });

            return;
        }

        const maxFileSizeBytes = 1024 * 1024;
        if (image.size > maxFileSizeBytes) {
            this.setState({
                saving: false,
                error: (
                    <FormattedMessage
                        id='add_emoji.imageTooLarge'
                        defaultMessage='Unable to create emoji. Image must be less than 1 MB in size.'
                    />
                ),
            });

            return;
        }

        const response = await actions.createCustomEmoji(emoji as CustomEmoji, image);

        if ('data' in response) {
            const savedEmoji = response as AddEmojiResponse;
            if (savedEmoji && savedEmoji.data.name === emoji.name) {
                getHistory().push('/' + team.name + '/emoji');
                return;
            }
        }

        if ('error' in response) {
            const responseError = response as AddErrorResponse;
            if (responseError) {
                this.setState({
                    saving: false,
                    error: responseError.error.message,
                });

                return;
            }
        }

        const genericError = (
            <FormattedMessage
                id='add_emoji.failedToAdd'
                defaultMessage='Something went wrong when adding the custom emoji.'
            />
        );

        this.setState({
            saving: false,
            error: (genericError),
        });
    };

    updateName = (e: ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            name: e.target.value,
        });
    };

    updateDescription = (e: ChangeEvent<HTMLTextAreaElement>): void => {
        this.setState({
            description: e.target.value,
        });
    };

    updateImage = (e: ChangeEvent<HTMLInputElement>): void => {
        if (e.target.files == null || e.target.files.length === 0) {
            this.setState({
                image: null,
                imageUrl: '',
            });

            return;
        }

        const image = e.target.files![0];

        const reader = new FileReader();
        reader.onload = () => {
            this.setState({
                image,
                imageUrl: reader.result,
            });
        };
        reader.readAsDataURL(image);
    };

    render(): JSX.Element {
        const {isEditMode, loading} = this.state;

        if (loading) {
            return (
                <div className='backstage-content row'>
                    <div className='backstage-form'>
                        <FormattedMessage
                            id='add_emoji.loading'
                            defaultMessage='Loading...'
                        />
                    </div>
                </div>
            );
        }

        let filename = null;
        if (this.state.image) {
            filename = (
                <span className='add-emoji__filename'>
                    {this.state.image.name}
                </span>
            );
        }

        let preview = null;
        if (this.state.imageUrl) {
            preview = (
                <div className='form-group'>
                    <label
                        className='control-label col-sm-4'
                        htmlFor='preview'
                    >
                        <FormattedMessage
                            id='add_emoji.preview'
                            defaultMessage='Preview'
                        />
                    </label>
                    <div className='col-md-5 col-sm-8 add-emoji__preview'>
                        <FormattedMessage
                            id='add_emoji.preview.sentence'
                            defaultMessage='This is a sentence with {image} in it.'
                            values={{
                                image: (
                                    <span
                                        className='emoticon'
                                        style={{backgroundImage: 'url(' + this.state.imageUrl + ')'}}
                                    />
                                ),
                            }}
                        />
                    </div>
                </div>
            );
        }

        return (
            <div className='backstage-content row'>
                <BackstageHeader>
                    <Link to={'/' + this.props.team.name + '/emoji'}>
                        <FormattedMessage
                            id='emoji_list.header'
                            defaultMessage='Custom Emoji'
                        />
                    </Link>
                    <FormattedMessage
                        id={isEditMode ? 'edit_emoji.header' : 'add_emoji.header'}
                        defaultMessage={isEditMode ? 'Edit' : 'Add'}
                    />
                </BackstageHeader>
                <div className='backstage-form'>
                    <form
                        className='form-horizontal'
                        onSubmit={this.handleFormSubmit}
                    >
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='name'
                            >
                                <FormattedMessage
                                    id='add_emoji.name'
                                    defaultMessage='Name'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <input
                                    id='name'
                                    type='text'
                                    maxLength={64}
                                    className='form-control'
                                    value={this.state.name}
                                    onChange={this.updateName}
                                    disabled={isEditMode}
                                    readOnly={isEditMode}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_emoji.name.help'
                                        defaultMessage="Name your emoji. The name can be up to 64 characters, and can contain lowercase letters, numbers, and the symbols '-' and '_'."
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='description'
                            >
                                <FormattedMessage
                                    id='add_emoji.description'
                                    defaultMessage='Description'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <textarea
                                    id='description'
                                    maxLength={1024}
                                    className='form-control'
                                    value={this.state.description}
                                    onChange={this.updateDescription}
                                    rows={3}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_emoji.description.help'
                                        defaultMessage='Provide an optional description for your custom emoji (up to 1024 characters).'
                                    />
                                </div>
                            </div>
                        </div>
                        {!isEditMode && (
                            <div className='form-group'>
                                <label
                                    className='control-label col-sm-4'
                                    htmlFor='image'
                                >
                                    <FormattedMessage
                                        id='add_emoji.image'
                                        defaultMessage='Image'
                                    />
                                </label>
                                <div className='col-md-5 col-sm-8'>
                                    <div>
                                        <div className='add-emoji__upload'>
                                            <button className='btn btn-primary'>
                                                <FormattedMessage
                                                    id='add_emoji.image.button'
                                                    defaultMessage='Select'
                                                />
                                            </button>
                                            <input
                                                id='select-emoji'
                                                type='file'
                                                accept={Constants.ACCEPT_EMOJI_IMAGE}
                                                multiple={false}
                                                onChange={this.updateImage}
                                            />
                                        </div>
                                        {filename}
                                        <div className='form__help'>
                                            <FormattedMessage
                                                id='add_emoji.image.help'
                                                defaultMessage='Specify a .gif, .png, or .jpg file of up to 64 KB for your emoji. The dimensions can be up to 128 pixels by 128 pixels.'
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {preview}
                        <div className='backstage-form__footer'>
                            <FormError
                                type='backstage'
                                error={this.state.error}
                            />
                            <Link
                                className='btn btn-tertiary'
                                to={'/' + this.props.team.name + '/emoji'}
                            >
                                <FormattedMessage
                                    id='add_emoji.cancel'
                                    defaultMessage='Cancel'
                                />
                            </Link>
                            <SpinnerButton
                                data-testid='save-button'
                                className='btn btn-primary'
                                type='submit'
                                spinning={this.state.saving}
                                spinningText={defineMessage({id: 'add_emoji.saving', defaultMessage: 'Saving...'})}
                                onClick={this.handleSaveButtonClick}
                            >
                                <FormattedMessage
                                    id='add_emoji.save'
                                    defaultMessage='Save'
                                />
                            </SpinnerButton>
                        </div>
                    </form>
                </div>
            </div>
        );
    }
}
