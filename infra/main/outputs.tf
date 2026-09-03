output "bedrock_access_key_id" {
  value = aws_iam_access_key.bedrock_service.id
}

output "bedrock_secret_access_key" {
  value     = aws_iam_access_key.bedrock_service.secret
  sensitive = true
}
