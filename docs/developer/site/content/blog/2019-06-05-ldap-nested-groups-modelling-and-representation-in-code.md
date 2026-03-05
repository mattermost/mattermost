---
title: "LDAP Nested Groups: Modelling and Representation in Code"
heading: "LDAP Nested Groups: Modelling and Representation in Code"
description: "This post describes what LDAP “nested groups” are and how we ended up modelling and representing them in code."
slug: ldap-nested-groups-modelling-and-representation-in-code
author: Martin Kraft
date: 2019-06-05T12:00:00-04:00
github: mkraft
community: martin.kraft
---

## LDAP Group Sync in Mattermost

In {{< newtabref href="https://mattermost.com" title="Mattermost" >}} v5.8 we deployed {{< newtabref href="https://mattermost.com/pl/default-ldap-group-sync" title="LDAP group sync feature" >}} to enable Enterprise Edition customers to create and synchronize groups in Mattermost matching their LDAP groups. The goal was to ease onboarding by automatically adding group members to configured teams and channels. 

With the upcoming Mattermost v5.12 we're adding the ability to create teams and channels that are only accessible to those synced groups. This post describes what LDAP "nested groups" are and how we ended up modelling and representing them in code.

## Defining Nested Groups

The two main types of groups in LDAP are `groupOfNames` and `groupOfUniqueNames`. At minimum they have a `cn` (common name) attribute and can have membership attributes `member` or `uniqueMember`, respectively. 

As an example, the below LDIF creates two groups: `developers` and `senior-developers`.

```ldif
dn: cn=developers,ou=groups,dc=www,dc=test,dc=com
changetype: add
objectclass: groupOfNames
member: uid=miranda,ou=users,dc=www,dc=test,dc=com
member: cn=senior-developers,ou=groups,dc=www,dc=test,dc=com

dn: cn=senior-developers,ou=groups,dc=www,dc=test,dc=com
changetype: add
objectclass: groupOfNames
member: uid=suzanne,ou=users,dc=www,dc=test,dc=com
```

The `developers` group has two members: a person `miranda` and another group `senior-developers`. The `senior-developers` group has a single member: a person `suzanne`. 

When a group has another group as a member we call it a "nested group".

## Objectives

There are two main query operations one wants to perform when dealing with nested groups.

1. List all of the members of group X.
2. List all of the groups that person Y belongs to. 

For our example, these propositions are all true:

* `developers` has members `[miranda, suzanne]`
* `senior-developers` has members `[suzanne]`
* `suzanne` is a member of groups `[developers, senior-developers]`
* `miranda` is a member of groups `[developers]`

## Native Solution

There's an "extensible match operator" called `LDAP_MATCHING_RULE_IN_CHAIN` that, if installed, traverses nested groups. It's used by adding the string `:1.2.840.113556.1.4.1941:` to your query filter.

For example, this filter retrieves all of the recursive members of `developers`:

```
(&
    (objectClass=person)
    (memberOf:1.2.840.113556.1.4.1941:=cn=developers,ou=groups,dc=www,dc=test,dc=com)
)
```

And this filter retrieves all of the recursive groups that `suzanne` belongs to:

```
(member:1.2.840.113556.1.4.1941:=uid=suzanne,ou=users,dc=www,dc=test,dc=com)
```

However, not all LDAP implementations natively support `LDAP_MATCHING_RULE_IN_CHAIN`, so when we set out to support LDAP nested groups in Mattermost I realized we would need to do the group traversal in our application code.

## Modelling the Problem

We can represent our example arrangement with a directed graph (aka digraph) as seen in *figure 1*.

![nested group](/img/nested-group.png)
*figure 1*

The digraph makes the structure easy to reason about and, moreover, because cycles are possible in LDAP nested groups — group A can have group B as a member which in turn has group A as a member — the digraph is critical to avoiding needless code complexity and errors. Here's how it works:

### From a Group's Perspective

To list all of the members of, say, the `developers` group, simply traverse the graph in *figure 1* starting at `developers`. All reachable vertices (that are people) are the members of the `developers` group. 

### From a Person's Perspective

To list all of the groups that, say, `suzanne` belongs to, reverse all of the edges in the graph (aka transpose it) — as seen in *figure 2* — and traverse the graph starting at `suzanne`. All of the reachable vertices (that are groups) are the groups that `suzanne` belongs to. 

![nested group transposed](/img/nested-group-transposed.png)
*figure 2* 

The same data model and traversal logic can be reused to achieve both of our main objectives.

## Representation in Code

In Mattermost I represent the digraph as an adjacency list. In Golang our *figure 1* graph looks like this:

```go
adjacencyList := map[string][]string{
    "group/developers":        []string{"person/miranda", "group/senior-developers"},
    "group/senior-developers": []string{"person/suzanne"},
    //"person/miranda":          []string{},
    //"person/suzanne":          []string{},
}
```

Normally an adjacency list representing a graph would include all vertices as keys in the array or map. However, in our LDAP case people will never have groups or other people nested under them, so I was able to remove those keys without losing any relevant data.

Our reversed graph from *figure 2* is represented as an adjacency list like this:

```go
transposedAdjacencyList := map[string][]string{
    "person/miranda":          []string{"group/developers"},
    "group/senior-developers": []string{"group/developers"},
    "person/suzanne":          []string{"group/senior-developers"},
    "group/developers":        []string{},
}
```

One can input the adjacency list into a breadth-first (or depth-first) search — avoiding cycles — to get the reachable vertices. It performs well at scale and is easy to serialize and debug.

That pretty much summarizes the interesting parts of modelling and representing LDAP nested groups. If you have any questions feel free to reach out. Thanks for reading!

[cross-posted from {{< newtabref href="http://martin.upspin.org/2019/06/03/ldap-nested-groups-modelling-and-representation-in-code.html" title="Martin's personal blog" >}}]
