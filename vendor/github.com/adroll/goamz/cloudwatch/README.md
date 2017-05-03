#GoLang AWS Cloudwatch

## Installation
Please refer to the project's main page at [https://github.com/AdRoll/goamz](https://github.com/AdRoll/goamz) for instructions about how to install.

## Available methods

<table>
 <tr>
  <td>GetMetricStatistics</td>
  <td>Gets statistics for the specified metric.</td>
 </tr>
 <tr>
  <td>ListMetrics</td>
  <td>Returns a list of valid metrics stored for the AWS account.</td>
 </tr>
 <tr>
  <td>PutMetricData</td>
  <td>Publishes metric data points to Amazon CloudWatch.</td>
 </tr>
 </table>

[Please refer to AWS Cloudwatch's documentation for more info](http://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_Operations.html)

##Examples
####Get Metric Statistics

```go
import (
    "fmt"
    "time"
    "os"
    "github.com/AdRoll/goamz/aws"
    "github.com/AdRoll/goamz/cloudwatch"
)

func test_get_metric_statistics() {
    region := aws.Regions["a_region"]
    namespace:= "AWS/ELB"
    dimension  := &cloudwatch.Dimension{
                                         Name: "LoadBalancerName", 
                                         Value: "your_value",
                                       }
    metricName := "RequestCount"
    now := time.Now()
    prev := now.Add(time.Duration(600)*time.Second*-1) // 600 secs = 10 minutes

    auth, err := aws.GetAuth("your_AccessKeyId", "your_SecretAccessKey", "", now)
    if err != nil {
       fmt.Printf("Error: %+v\n", err)
       os.Exit(1)
    }

    cw, err := cloudwatch.NewCloudWatch(auth, region.CloudWatchServicepoint)
    request := &cloudwatch.GetMetricStatisticsRequest {
                Dimensions: []cloudwatch.Dimension{*dimension},
                EndTime: now,
                StartTime: prev,
                MetricName: metricName,
                Unit: cloudwatch.UnitCount, // Not mandatory
                Period: 60,
                Statistics: []string{cloudwatch.StatisticDatapointSum},
                Namespace: namespace,
            }

    response, err := cw.GetMetricStatistics(request)
    if err == nil {
        fmt.Printf("%+v\n", response)
    } else {
        fmt.Printf("Error: %+v\n", err)
    }
}
```
####List Metrics

```go
import (
    "fmt"
    "time"
    "os"
    "github.com/AdRoll/goamz/aws"
    "github.com/AdRoll/goamz/cloudwatch"
)

func test_list_metrics() {
    region := aws.Regions["us-east-1"]  // Any region here
    now := time.Now()

    auth, err := aws.GetAuth("an AccessKeyId", "a SecretAccessKey", "", now)
    if err != nil {
       fmt.Printf("Error: %+v\n", err)
       os.Exit(1)
    }
    cw, err := cloudwatch.NewCloudWatch(auth, region.CloudWatchServicepoint)
    request := &cloudwatch.ListMetricsRequest{Namespace: "AWS/EC2"}

    response, err := cw.ListMetrics(request)
    if err == nil {
        fmt.Printf("%+v\n", response)
    } else {
        fmt.Printf("Error: %+v\n", err)
    }
}
```