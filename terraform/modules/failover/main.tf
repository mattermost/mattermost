data "archive_file" "lambda" {
  type        = "zip"
  source_file = "${path.module}/lambda/failover.py"
  output_path = "${path.module}/lambda/failover.zip"
}

data "aws_caller_identity" "current" {}

resource "aws_iam_role" "lambda" {
  name = "${var.name_prefix}-failover-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = { Name = "${var.name_prefix}-failover-lambda-role" }
}

resource "aws_iam_role_policy_attachment" "logs" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "xray" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

resource "aws_sqs_queue" "dlq" {
  name                      = "${var.name_prefix}-failover-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
  tags                      = { Name = "${var.name_prefix}-failover-dlq" }
}

resource "aws_iam_role_policy" "failover" {
  name = "${var.name_prefix}-failover-policy"
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadHealthAndCommandStatus"
        Effect   = "Allow"
        Action   = ["ec2:DescribeAddresses", "ec2:DescribeInstances", "ssm:GetCommandInvocation"]
        Resource = "*"
      },
      {
        Sid    = "StartOnlyMattermostInstances"
        Effect = "Allow"
        Action = ["ec2:StartInstances"]
        Resource = [
          "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:instance/${var.primary_instance_id}",
          "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:instance/${var.standby_instance_id}"
        ]
      },
      {
        Sid    = "MoveOnlyMattermostElasticIp"
        Effect = "Allow"
        Action = ["ec2:AssociateAddress"]
        Resource = [
          "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:elastic-ip/${var.elastic_ip_allocation_id}",
          "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:instance/${var.primary_instance_id}",
          "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:instance/${var.standby_instance_id}"
        ]
      },
      {
        Sid    = "RunHealthCheckOnlyOnMattermostInstances"
        Effect = "Allow"
        Action = ["ssm:SendCommand"]
        Resource = [
          "arn:aws:ssm:${var.aws_region}::document/AWS-RunShellScript",
          "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:instance/${var.primary_instance_id}",
          "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:instance/${var.standby_instance_id}"
        ]
      },
      {
        Sid      = "PublishFailoverNotifications"
        Effect   = "Allow"
        Action   = ["sns:Publish"]
        Resource = var.notification_topic_arn
      },
      {
        Sid      = "SendFailedInvocationsToDlq"
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = aws_sqs_queue.dlq.arn
      }
    ]
  })
}

resource "aws_lambda_function" "failover" {
  #checkov:skip=CKV_AWS_173:Environment values contain only resource identifiers and an SNS ARN, no credentials; secrets remain in SSM SecureString.
  #checkov:skip=CKV_AWS_117:Function calls AWS control-plane APIs and is kept outside the VPC to avoid NAT/VPC endpoint costs; it does not serve public inbound traffic.
  #checkov:skip=CKV_AWS_272:This academic demo has no AWS Signer signing profile or release-signing pipeline; configure code signing for production.
  function_name                  = "${var.name_prefix}-failover"
  role                           = aws_iam_role.lambda.arn
  handler                        = "failover.lambda_handler"
  runtime                        = "python3.12"
  filename                       = data.archive_file.lambda.output_path
  source_code_hash               = data.archive_file.lambda.output_base64sha256
  timeout                        = 240
  reserved_concurrent_executions = 1
  memory_size                    = 128

  dead_letter_config {
    target_arn = aws_sqs_queue.dlq.arn
  }

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      PRIMARY_INSTANCE_ID = var.primary_instance_id
      STANDBY_INSTANCE_ID = var.standby_instance_id
      EIP_ALLOCATION_ID   = var.elastic_ip_allocation_id
      SNS_TOPIC_ARN       = var.notification_topic_arn
    }
  }
  tags       = { Name = "${var.name_prefix}-failover" }
  depends_on = [aws_cloudwatch_log_group.lambda, aws_iam_role_policy_attachment.xray, aws_iam_role_policy.failover]
}

resource "aws_cloudwatch_event_rule" "schedule" {
  name                = "${var.name_prefix}-health-check-schedule"
  description         = "Check Mattermost health and move the Elastic IP to standby after repeated failures."
  schedule_expression = "rate(1 minute)"
}

resource "aws_cloudwatch_event_target" "lambda" {
  rule      = aws_cloudwatch_event_rule.schedule.name
  target_id = "${var.name_prefix}-failover-lambda"
  arn       = aws_lambda_function.failover.arn
}

resource "aws_lambda_permission" "eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.failover.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.schedule.arn
}

resource "aws_cloudwatch_log_group" "lambda" {
  #checkov:skip=CKV_AWS_158:CloudWatch Logs uses service-managed encryption; a customer KMS key adds avoidable cost for this demo.
  #checkov:skip=CKV_AWS_338:Seven-day retention is intentional for a short-lived academic environment and its budget.
  name              = "/aws/lambda/${var.name_prefix}-failover"
  retention_in_days = 7
  tags              = { Name = "${var.name_prefix}-failover-logs" }
}
