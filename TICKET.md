# No pagination in "Saved Posts" panel

## Bug Reproduction:

1) Save a minimum of 61 posts.
2) Click on the "Saved Posts" icon in the top bar to open the saved posts on the right-hand side (RHS).
3) Notice that only 60 posts are displayed, and the 61st and beyond post are not visible.

## Expected Results:
All saved posts, regardless of the 60-post limit, should be visible as we scroll through them.

## Possible Solution:
Take a look on the file 'webapp/channels/src/components/search_results/search_results.tsx.' This component serves as the common component for retrieving and displaying results for saved, pinned, and searched files. In the code, you'll notice that we currently make only one call to retrieve saved posts. However, in the API client, if no parameters are passed, it defaults to loading a maximum of 60 saved posts. To address this limitation, we need to implement a load more function. This function will be triggered when the user scrolls to the bottom, checking if the next page of results is non-zero. If the results are zero, we stop calling the load more function, ensuring that all the user's saved posts are displayed beyond the 60-item limit.