output "application_log_group_name" { value = aws_cloudwatch_log_group.application.name }
output "notification_topic_arn" { value = aws_sns_topic.alerts.arn }
