resource "aws_iam_user" "bedrock_service" {
  name = "${var.project_name}-bedrock-service"
}

resource "aws_iam_user_policy" "bedrock_access" {
  name = "${var.project_name}-bedrock-invoke"
  user = aws_iam_user.bedrock_service.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_access_key" "bedrock_service" {
  user = aws_iam_user.bedrock_service.name
}
