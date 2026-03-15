'use strict';
/**
 * Get the search terms from the input field and redirect the user to the search page
 */
const performSearchUsingPageRedirect = () => {
    const searchQuery = document.getElementById("search-query");
    if (searchQuery && searchQuery.value.length > 1) {
        const redirectURL = new URL("search/", BASE_URL);
        redirectURL.searchParams.set("q", searchQuery.value);
        window.location.href = redirectURL.toString();
    }
};

/**
 * Perform a search from the page sidebar
 * @param {KeyboardEvent} evt The KeyboardEvent associated with the search event
 */
const performSidebarSearch = (evt) => {
    if (evt.key === "Enter") {
        performSearchUsingPageRedirect();
    }
};

document.addEventListener("DOMContentLoaded", () => {
    // Hook up the input field with the performSearch method
    const searchInput = document.getElementById("search-query");
    if (searchInput) {
        searchInput.addEventListener("keyup", performSidebarSearch);
    }
});
