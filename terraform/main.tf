# This Terraform configuration documents the target AWS deployment for this
# project. It was NOT applied against a real AWS account — see the README's
# "Cloud & Runtime" section for why. Packaging the Express app for Lambda
# (e.g. via a "serverless-http"-style adapter) is out of scope for this plan;
# `deployment_package.zip` below is a placeholder for that build artifact.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# --- Secrets ---------------------------------------------------------------

resource "aws_secretsmanager_secret" "anthropic_api_key" {
  name = "smart-summarizer/anthropic-api-key"
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name = "smart-summarizer/jwt-secret"
}

# --- Database (DynamoDB) ----------------------------------------------------

resource "aws_dynamodb_table" "users" {
  name         = "smart-summarizer-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL"
  }
}

resource "aws_dynamodb_table" "summaries" {
  name         = "smart-summarizer-summaries"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  global_secondary_index {
    name            = "user_id-index"
    hash_key        = "user_id"
    projection_type = "ALL"
  }
}

# --- Lambda execution role ---------------------------------------------------

resource "aws_iam_role" "lambda_exec" {
  name = "smart-summarizer-lambda-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "lambda_permissions" {
  name = "smart-summarizer-lambda-permissions"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query"]
        Resource = [
          aws_dynamodb_table.users.arn,
          aws_dynamodb_table.summaries.arn,
          "${aws_dynamodb_table.users.arn}/index/*",
          "${aws_dynamodb_table.summaries.arn}/index/*",
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [aws_secretsmanager_secret.anthropic_api_key.arn, aws_secretsmanager_secret.jwt_secret.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# --- Lambda function ---------------------------------------------------------

resource "aws_lambda_function" "api" {
  function_name = "smart-summarizer-api"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  filename      = "deployment_package.zip"
  timeout       = 15

  environment {
    variables = {
      ANTHROPIC_SECRET_ARN = aws_secretsmanager_secret.anthropic_api_key.arn
      JWT_SECRET_ARN       = aws_secretsmanager_secret.jwt_secret.arn
      USERS_TABLE          = aws_dynamodb_table.users.name
      SUMMARIES_TABLE      = aws_dynamodb_table.summaries.name
    }
  }
}

# --- API Gateway (HTTP API) ---------------------------------------------------

resource "aws_apigatewayv2_api" "api" {
  name          = "smart-summarizer-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}
