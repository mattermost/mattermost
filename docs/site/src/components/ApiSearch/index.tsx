import React, {type ReactNode, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import {useLocation} from '@docusaurus/router';
import {useBaseUrlUtils} from '@docusaurus/useBaseUrl';
// Same internal hook the theme's own DocSidebar/Mobile uses to close the
// drawer when a sidebar link is clicked.
import {useNavbarMobileSidebar} from '@docusaurus/theme-common/internal';
import MethodBadge from '@site/src/components/MethodBadge';
import useEndpointIndex from './useEndpointIndex';
import {searchEndpoints, type Endpoint, type SearchResult} from './search';
import styles from './styles.module.css';

const RESULT_LIMIT = 50;

export type Props = {
  /**
   * 'sidebar' renders the compact box pinned above the API sidebar tree —
   * pass the tree as `children` and it's swapped for the results while a
   * query is active. 'page' renders the roomier standalone box used on the
   * API landing page.
   */
  variant?: 'sidebar' | 'page';

  /** The sidebar tree, shown when the query is empty (sidebar variant). */
  children?: ReactNode;
};

/**
 * Site-relative URL of an endpoint's page. The `api` docs instance is mounted
 * at /api (docusaurus.config.ts) and index ids are doc ids, so
 * `reference/get-user` → `/api/reference/get-user`. <Link> adds the baseUrl.
 */
function endpointHref(endpoint: Endpoint): string {
  return `/api/${endpoint.id}`;
}

/**
 * Focuses the sidebar search box on `/`, the way ReDoc and most API
 * references do. Deliberately not Cmd/Ctrl+K: that belongs to Algolia's
 * site-wide modal, which searches prose across all three docs sections.
 */
function useSlashShortcut(enabled: boolean, inputRef: React.RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
      if (isTyping) {
        return;
      }

      event.preventDefault();
      inputRef.current?.focus();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled, inputRef]);
}

/**
 * Client-side search over every documented endpoint.
 *
 * Complements site search (Algolia, which indexes prose): this one is
 * path-aware, so `post /channels/members`, `delete reaction`, or a pasted
 * `/api/v4/users/{user_id}/image` all land on the right endpoint page. It
 * runs entirely in the browser against a generated index, so it also works
 * on local and preview builds, where Algolia credentials aren't available.
 */
export default function ApiSearch({variant = 'page', children}: Props) {
  const isSidebar = variant === 'sidebar';

  const [query, setQuery] = useState('');
  const {endpoints, failed, retry} = useEndpointIndex();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const {withBaseUrl} = useBaseUrlUtils();
  const {pathname} = useLocation();
  const mobileSidebar = useNavbarMobileSidebar();

  useSlashShortcut(isSidebar, inputRef);

  const trimmed = query.trim();

  const {results, total} = useMemo(
    () =>
      trimmed && endpoints
        ? searchEndpoints(endpoints, trimmed, RESULT_LIMIT)
        : {results: [] as SearchResult[], total: 0},
    [endpoints, trimmed],
  );

  resultRefs.current.length = results.length;

  const clear = useCallback(() => {
    setQuery('');
    inputRef.current?.focus();
  }, []);

  // On mobile the sidebar is a drawer over the page, and it only closes
  // itself for items it rendered (DocSidebar/Mobile hands them an
  // onItemClick). Results are ours, so they'd navigate behind an open
  // drawer without this.
  const onResultClick = useCallback(() => {
    if (mobileSidebar.shown) {
      mobileSidebar.toggle();
    }
  }, [mobileSidebar]);

  // Arrow keys walk the results by moving real focus, so Enter, middle-click
  // and screen-reader link announcements all keep working unchanged.
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault();
          resultRefs.current[index + 1]?.focus();
          break;
        }
        case 'ArrowUp': {
          event.preventDefault();
          if (index <= 0) {
            inputRef.current?.focus();
          } else {
            resultRefs.current[index - 1]?.focus();
          }
          break;
        }
        case 'Escape': {
          event.preventDefault();
          clear();
          break;
        }
        default:
      }
    },
    [clear],
  );

  const status = (() => {
    if (trimmed === '') {
      return null;
    }
    if (failed) {
      return (
        <>
          {'Endpoint search is unavailable — the index didn’t load. '}
          <button type="button" className={styles.retry} onClick={retry}>
            Retry
          </button>
        </>
      );
    }
    if (!endpoints) {
      return 'Loading endpoints…';
    }
    if (total === 0) {
      return `No endpoints match “${trimmed}”`;
    }
    if (total > results.length) {
      return `Top ${results.length} of ${total} matching endpoints`;
    }
    return `${total} matching endpoint${total === 1 ? '' : 's'}`;
  })();

  const searchBox = (
    <>
      <div className={styles.box}>
        <input
          ref={inputRef}
          type="search"
          className={styles.input}
          value={query}
          placeholder={isSidebar ? 'Search endpoints' : 'Search endpoints — path, method, or name'}
          aria-label="Search API endpoints"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => onKeyDown(event, -1)}
        />
        {trimmed === '' ? (
          isSidebar && (
            <kbd className={styles.shortcut} aria-hidden="true">
              /
            </kbd>
          )
        ) : (
          <button type="button" className={styles.clear} onClick={clear} aria-label="Clear search">
            {'×'}
          </button>
        )}
      </div>
      {status && (
        <p className={styles.status} role="status">
          {status}
        </p>
      )}
    </>
  );

  const resultRow = (result: SearchResult, index: number) => {
    const {endpoint} = result;
    const href = endpointHref(endpoint);
    const isActive = pathname === withBaseUrl(href);

    return (
      <li
        key={endpoint.id}
        className={clsx(
          isSidebar && 'menu__list-item',
          // Stable (non-hashed) marker so custom.css can keep its top-level
          // sidebar typography off these rows — they sit at level 1 of the
          // menu list but they're results, not nav entries.
          isSidebar && 'api-search-result',
          styles.result,
        )}
      >
        <Link
          ref={(node: HTMLAnchorElement | null) => {
            resultRefs.current[index] = node;
          }}
          to={href}
          className={clsx(
            isSidebar && 'menu__link',
            styles.resultLink,
            isActive && (isSidebar ? 'menu__link--active' : styles.resultLinkActive),
          )}
          onKeyDown={(event: React.KeyboardEvent) => onKeyDown(event, index)}
          onClick={onResultClick}
        >
          <span className={styles.resultHeading}>
            <MethodBadge method={endpoint.method} />
            <span className={styles.resultTitle}>{endpoint.title}</span>
          </span>
          {/* Second line: the path, and the deprecation tag alongside it —
              the title line is too narrow in the sidebar to share. */}
          <span className={styles.resultMeta}>
            <span className={styles.resultPath}>{endpoint.path}</span>
            {endpoint.deprecated && <span className={styles.deprecated}>Deprecated</span>}
          </span>
        </Link>
      </li>
    );
  };

  // Sidebar variant lives inside the theme's <ul class="menu__list">, so it
  // has to emit <li>s: the box in one, then either the results or the
  // untouched sidebar tree. The tree stays up whenever there are no results
  // to show — no match, still loading, index failed to load — so the status
  // line explains itself without stranding the reader on a blank sidebar.
  if (isSidebar) {
    return (
      <>
        <li className={clsx('menu__list-item', styles.search, styles.searchSidebar)}>
          {searchBox}
        </li>
        {results.length > 0 ? results.map(resultRow) : children}
      </>
    );
  }

  return (
    <div className={clsx(styles.search, styles.searchPage)}>
      {searchBox}
      {trimmed === '' && (
        <p className={styles.hint}>
          Try <code>post channel</code>, <code>delete reaction</code>, or a path fragment like{' '}
          <code>/users/{'{'}user_id{'}'}/image</code>.
        </p>
      )}
      {/* No empty bordered box when a query matches nothing (or the index
          didn't load) — the status line above says what happened. */}
      {results.length > 0 && (
        <ul className={styles.pageResults}>{results.map(resultRow)}</ul>
      )}
    </div>
  );
}
