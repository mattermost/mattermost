# API Overview

This provides a basic overview of the Mattermost API. All examples assume there is a Mattermost instance running at http://localhost:8065.

## Schema

All API access is done through `yourdomain.com/api/v1/`, with all data being sent and received as JSON.


## Authentication

The majority of the Mattermost API involves interacting with teams. Therefore, most API methods require authentication as a user. There are two ways to authenticate into a Mattermost system.

##### Session Token

Make an HTTP POST to `yourdomain.com/api/v1/users/login` with a JSON body indicating the `name` of the team, the user's `email` and `password`.

```
curl -i -d '{"name":"exampleteam","email":"someone@nowhere.com","password":"thisisabadpassword"}' http://localhost:8065/api/v1/users/login
```

If successful, the response will contain a `Token` header and a User object in the body.

```
HTTP/1.1 200 OK
Set-Cookie: MMSID=hyr5dmb1mbb49c44qmx4whniso; Path=/; Max-Age=2592000; HttpOnly
Token: hyr5dmb1mbb49c44qmx4whniso
X-Ratelimit-Limit: 10
X-Ratelimit-Remaining: 9
X-Ratelimit-Reset: 1
X-Request-Id: smda55ckcfy89b6tia58shk5fh
X-Version-Id: developer
Date: Fri, 11 Sep 2015 13:21:14 GMT
Content-Length: 657
Content-Type: application/json; charset=utf-8

{{user object as json}}
```

Include the `Token` as part of the `Authentication` header on your future API requests with the `Bearer` method.

```
curl -i -H 'Authorization: Bearer hyr5dmb1mbb49c44qmx4whniso' http://localhost:8065/api/v1/users/me
```

That's it! You should now be able to access the API as the user you logged in as.

##### OAuth2

Coming soon...


## Client Errors

All errors will return an appropriate HTTP response code along with the following JSON body:

```
{
    "message": "", // the reason for the error
    "detailed_error": "", // some extra details about the error
    "request_id": "", // the ID of the request
    "status_code": 0 // the HTTP status code
}
```


## Rate Limiting

Whenever you make an HTTP request to the Mattermost API you might notice the following headers included in the response:
```
X-Ratelimit-Limit: 10
X-Ratelimit-Remaining: 9
X-Ratelimit-Reset: 1441983590

```

These headers are telling you your current rate limit status.

Header                | Description
--------------------- | -----------
X-Ratelimit-Limit     | The maximum number of requests you can make per second.
X-Ratelimit-Remaining | The number of requests remaining in the current window.
X-Ratelimit-Reset     | The remaining UTC epoch seconds before the rate limit resets.

If you exceed your rate limit for a window you will receive the following error in the body of the response:
```
HTTP/1.1 429 Too Many Requests
Date: Tue, 10 Sep 2015 11:20:28 GMT
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1

limit exceeded
```
