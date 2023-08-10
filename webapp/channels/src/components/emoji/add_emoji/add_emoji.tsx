// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import BackstageHeader from 'components/backstage/components/backstage_header';
import FormError from 'components/form_error';
import SpinnerButton from 'components/spinner_button';

import {getHistory} from 'utils/browser_history';
import {Constants} from 'utils/constants';
import {localizeMessage} from 'utils/utils';

import type {CustomEmoji} from '@mattermost/types/emojis';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {ActionResult} from 'mattermost-redux/types/actions';
import type {ChangeEvent, FormEvent, SyntheticEvent} from 'react';
import type EmojiMap from 'utils/emoji_map';

export interface AddEmojiProps {
    actions: {
        createCustomEmoji: (term: CustomEmoji, imageData: File) => Promise<ActionResult>;
    };
    emojiMap: EmojiMap;
    user: UserProfile;
    team: Team;
}

type EmojiCreateArgs = {
    creator_id: string;
    name: string;
};

type AddEmojiState = {
    name: string;
    image: File | null;
    imageUrl: string | ArrayBuffer | null;
    saving: boolean;
    error: React.ReactNode;
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

        this.state = {
            name: '',
            image: null,
            imageUrl: '',
            saving: false,
            error: null,
        };
    }

    handleFormSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        return this.handleSubmit(e);
    };

    handleSaveButtonClick = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>): Promise<void> => {
        return this.handleSubmit(e);
    };

    handleSubmit = async (e: SyntheticEvent<unknown>): Promise<void> => {
        const {actions, emojiMap, user, team} = this.props;
        const {image, name, saving} = this.state;

        e.preventDefault();

        if (saving) {
            return;
        }

        this.setState({
            saving: true,
            error: null,
        });

        const emoji: EmojiCreateArgs = {
            creator_id: user.id,
            name: name.trim().toLowerCase(),
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
                defaultMessage='Something when wrong when adding the custom emoji.'
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
                        id='add_emoji.header'
                        defaultMessage='Add'
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
                        {preview}
                        <div className='backstage-form__footer'>
                            <FormError
                                type='backstage'
                                error={this.state.error}
                            />
                            <Link
                                className='btn btn-link btn-sm'
                                to={'/' + this.props.team.name + '/emoji'}
                            >
                                <FormattedMessage
                                    id='add_emoji.cancel'
                                    defaultMessage='Cancel'
                                />
                            </Link>
                            <SpinnerButton
                                className='btn btn-primary'
                                type='submit'
                                spinning={this.state.saving}
                                spinningText={localizeMessage('add_emoji.saving', 'Saving...')}
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
