---
title: "Community Grafana"
heading: "Community Grafana - Mattermost"
description: "Grafana runs in the Mattermost Cloud infrastructure in the same cluster that community installations are hosted."
date: 2020-03-31T20:52:46-05:00
weight: 20
---

## Community Grafana

The Grafana application is used to visualise the performance metrics of the community installations. The application runs in the Mattermost Cloud infrastructure in the same cluster that community installations are hosted.

Grafana URL: https://grafana.mattermost.com

## How to create and use the variable that enables selection between installations

To get the different versions of installations in a simple variable, a variable of type query needs to be created with a query value of **label_values(v1alpha1_mattermost_com_installation)**. Then in each of the Grafana panels that selection between installations is required, the following filter should be applied in the query **{v1alpha1_mattermost_com_installation=~"$mattermost"}** where *mattermost* is the name of the variable created. An example of a query can be seen below:

```
sum(irate(mattermost_post_total{v1alpha1_mattermost_com_installation=~"$mattermost"}[5m]))
```

Due to the fact that the community servers are running in the cloud infrastructure and because the **community-daily** installation is managed by the cloud provisioner it needs to have a unique name, which in this case is **mm-swbn**. Therefore, users in the dropdown list of their community server variable will see the options **community**, **community-release** and **mm-swbn**, which is the community-daily.

For any questions please contact the [cloud team](https://community-daily.mattermost.com/core/channels/cloud)
