// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {deleteCustomEmoji} from 'mattermost-redux/actions/emojis';
import {Emoji} from 'mattermost-redux/constants';

import EmojiListItem from 'components/emoji/emoji_list_item';
import LoadingScreen from 'components/loading_screen';
import LocalizedInput from 'components/localized_input/localized_input';
import SaveButton from 'components/save_button';
import NextIcon from 'components/widgets/icons/fa_next_icon';
import PreviousIcon from 'components/widgets/icons/fa_previous_icon';
import SearchIcon from 'components/widgets/icons/fa_search_icon';

import {t} from 'utils/i18n';

import type {CustomEmoji} from '@mattermost/types/emojis';
import type {ServerError} from '@mattermost/types/errors';
import type {ChangeEvent, ChangeEventHandler} from 'react';

const EMOJI_PER_PAGE = 50;
const EMOJI_SEARCH_DELAY_MILLISECONDS = 200;

interface Props {

    /**
     * Custom emojis on the system.
     */
    emojiIds: string[];

    /**
     * Function to scroll list to top.
     */
    scrollToTop: () => void;
    actions: {

        /**
         * Get pages of custom emojis.
         */
        getCustomEmojis: (page?: number, perPage?: number, sort?: string, loadUsers?: boolean) => Promise<{ data: CustomEmoji[]; error: ServerError }>;

        /**
         * Search custom emojis.
         */
        searchCustomEmojis: (term: string, options: any, loadUsers: boolean) => Promise<{ data: CustomEmoji[]; error: ServerError }>;
    };

}

interface State {
    loading: boolean;
    page: number;
    nextLoading: boolean;
    searchEmojis: string[] | null;
    missingPages: boolean;
}

export default class EmojiList extends React.PureComponent<Props, State> {
    private searchTimeout: NodeJS.Timeout | null;

    constructor(props: Props) {
        super(props);
        this.searchTimeout = null;
        this.state = {
            loading: true,
            page: 0,
            nextLoading: false,
            searchEmojis: null,
            missingPages: true,
        };
    }

    async componentDidMount(): Promise<void> {
        this.props.actions.getCustomEmojis(0, EMOJI_PER_PAGE + 1, Emoji.SORT_BY_NAME, true).
            then(({data}: { data: CustomEmoji[] }) => {
                this.setState({loading: false});
                if (data && data.length < EMOJI_PER_PAGE) {
                    this.setState({missingPages: false});
                }
            });
    }

    nextPage = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
        if (e) {
            e.preventDefault();
        }

        const next = this.state.page + 1;
        this.setState({nextLoading: true});
        this.props.actions.getCustomEmojis(next, EMOJI_PER_PAGE, Emoji.SORT_BY_NAME, true).
            then(({data}: { data: CustomEmoji[] }) => {
                this.setState({page: next, nextLoading: false});
                if (data && data.length < EMOJI_PER_PAGE) {
                    this.setState({missingPages: false});
                }

                this.props.scrollToTop();
            });
    };
    previousPage = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
        if (e) {
            e.preventDefault();
        }

        this.setState({
            page: this.state.page - 1,
            nextLoading: false,
            missingPages: true,
        });

        this.props.scrollToTop();
    };

    onSearchChange: ChangeEventHandler = (e: ChangeEvent): void => {
        if (!e || !e.target) {
            return;
        }

        const term = (e.target as HTMLInputElement).value || '';

        clearTimeout(this.searchTimeout!);

        this.searchTimeout = setTimeout(async () => {
            if (term.trim() === '') {
                this.setState({searchEmojis: null, page: 0});
                return;
            }

            this.setState({loading: true});

            const {data}: { data: CustomEmoji[] } = await this.props.actions.searchCustomEmojis(
                term,
                {},
                true,
            );

            if (data) {
                this.setState({
                    searchEmojis: data.map((em: CustomEmoji) => em.id),
                    loading: false,
                });
            } else {
                this.setState({searchEmojis: [], loading: false});
            }
        }, EMOJI_SEARCH_DELAY_MILLISECONDS);
    };

    deleteFromSearch = (emojiId: string): void => {
        if (!this.state.searchEmojis) {
            return;
        }

        const index = this.state.searchEmojis.indexOf(emojiId);

        if (index < 0) {
            return;
        }

        const newSearchEmojis = [...this.state.searchEmojis];
        newSearchEmojis.splice(index, 1);
        this.setState({searchEmojis: newSearchEmojis});
    };

    render(): JSX.Element {
        const searchEmojis = this.state.searchEmojis;
        const emojis = [];
        let nextButton;
        let previousButton;

        if (this.state.loading) {
            emojis.push(
                <tr
                    key='loading'
                    className='backstage-list__item backstage-list__empty'
                >
                    <td colSpan={4}>
                        <LoadingScreen key='loading'/>
                    </td>
                </tr>,
            );
        } else if (
            this.props.emojiIds.length === 0 ||
            (searchEmojis && searchEmojis.length === 0)
        ) {
            emojis.push(
                <tr
                    key='empty'
                    className='backstage-list__item backstage-list__empty'
                >
                    <td colSpan={4}>
                        <FormattedMessage
                            id='emoji_list.empty'
                            defaultMessage='No custom emoji found'
                        />
                    </td>
                </tr>,
            );
        } else if (searchEmojis) {
            searchEmojis.forEach((emojiId: string) => {
                emojis.push(
                    <EmojiListItem
                        key={'emoji_search_item' + emojiId}
                        emojiId={emojiId}
                        onDelete={this.deleteFromSearch}
                        actions={{deleteCustomEmoji}}
                    />,
                );
            });
        } else {
            const pageStart = this.state.page * EMOJI_PER_PAGE;
            const pageEnd = pageStart + EMOJI_PER_PAGE;
            const emojisToDisplay = this.props.emojiIds.slice(pageStart, pageEnd);

            emojisToDisplay.forEach((emojiId: string) => {
                emojis.push(
                    <EmojiListItem
                        key={'emoji_list_item' + emojiId}
                        emojiId={emojiId}
                        actions={{deleteCustomEmoji}}
                    />,
                );
            });

            if (this.state.missingPages) {
                const buttonContents = (
                    <span>
                        <FormattedMessage
                            id='filtered_user_list.next'
                            defaultMessage='Next'
                        />
                        <NextIcon additionalClassName='ml-2'/>
                    </span>
                );

                nextButton = (
                    <SaveButton
                        btnClass='btn-link'
                        extraClasses='pull-right'
                        onClick={this.nextPage}
                        saving={this.state.nextLoading}
                        disabled={this.state.nextLoading}
                        defaultMessage={buttonContents}
                        savingMessage={buttonContents}
                    />
                );
            }

            if (this.state.page > 0) {
                previousButton = (
                    <button
                        className='btn btn-link'
                        onClick={this.previousPage}
                    >
                        <PreviousIcon additionalClassName='mr-2'/>
                        <FormattedMessage
                            id='filtered_user_list.prev'
                            defaultMessage='Previous'
                        />
                    </button>
                );
            }
        }

        return (
            <div>
                <div className='backstage-filters'>
                    <div className='backstage-filter__search'>
                        <SearchIcon/>
                        <LocalizedInput
                            type='search'
                            className='form-control'
                            placeholder={{
                                id: t('emoji_list.search'),
                                defaultMessage: 'Search Custom Emoji',
                            }}
                            onChange={this.onSearchChange}
                            style={style.search}
                        />
                    </div>
                </div>
                <span className='backstage-list__help'>
                    <p>
                        <FormattedMessage
                            id='emoji_list.help'
                            defaultMessage="Custom emoji are available to everyone on your server. Type ':' followed by two characters in a message box to bring up the emoji selection menu."
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='emoji_list.help2'
                            defaultMessage="Tip: If you add #, ##, or ### as the first character on a new line containing emoji, you can use larger sized emoji. To try it out, send a message such as: '# :smile:'."
                        />
                    </p>
                </span>
                <div className='backstage-list'>
                    <table className='emoji-list__table'>
                        <thead>
                            <tr className='backstage-list__item emoji-list__table-header'>
                                <th className='emoji-list__name'>
                                    <FormattedMessage
                                        id='emoji_list.name'
                                        defaultMessage='Name'
                                    />
                                </th>
                                <th className='emoji-list__image'>
                                    <FormattedMessage
                                        id='emoji_list.image'
                                        defaultMessage='Image'
                                    />
                                </th>
                                <th className='emoji-list__creator'>
                                    <FormattedMessage
                                        id='emoji_list.creator'
                                        defaultMessage='Creator'
                                    />
                                </th>
                                <th className='emoji-list_actions'>
                                    <FormattedMessage
                                        id='emoji_list.actions'
                                        defaultMessage='Actions'
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody>{emojis}</tbody>
                    </table>
                </div>
                <div className='filter-controls pt-3'>
                    {previousButton}
                    {nextButton}
                </div>
            </div>
        );
    }
}

const style = {
    search: {flexGrow: 0, flexShrink: 0},
};
