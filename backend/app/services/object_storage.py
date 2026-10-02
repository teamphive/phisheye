import asyncio
import os
from collections.abc import Callable
from functools import partial
from typing import Any
from uuid import uuid4

import boto3
from botocore.exceptions import BotoCoreError, ClientError


class ObjectStorageError(RuntimeError):
    """Storage operation failed."""


def _setting(name: str, default: str | None = None) -> str:
    value = os.getenv(name, default)
    if not value:
        raise ObjectStorageError(f"{name} is not configured")
    return value


def _client():
    return boto3.client(
        "s3",
        endpoint_url=_setting("S3_ENDPOINT_URL"),
        aws_access_key_id=_setting("S3_ACCESS_KEY_ID"),
        aws_secret_access_key=_setting("S3_SECRET_ACCESS_KEY"),
        region_name=os.getenv("S3_REGION", "us-east-1"),
    )


def _run(operation: Callable[..., Any], **kwargs: Any) -> Any:
    try:
        return operation(**kwargs)
    except (BotoCoreError, ClientError) as exc:
        raise ObjectStorageError("Object storage operation failed") from exc


def _put_eml(*, bucket: str, key: str, content: bytes) -> None:
    client = _client()
    try:
        client.head_bucket(Bucket=bucket)
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") not in {"404", "NoSuchBucket"}:
            raise
        client.create_bucket(Bucket=bucket)

    client.put_object(
        Bucket=bucket,
        Key=key,
        Body=content,
        ContentType="message/rfc822",
    )


async def store_eml(content: bytes) -> str:
    key = str(uuid4())
    bucket = _setting("S3_BUCKET")
    operation = partial(
        _run,
        _put_eml,
        bucket=bucket,
        key=key,
        content=content,
    )
    await asyncio.to_thread(operation)
    return key


def _get_eml(*, bucket: str, key: str) -> bytes:
    return _client().get_object(Bucket=bucket, Key=key)["Body"].read()


async def load_eml(key: str) -> bytes:
    bucket = _setting("S3_BUCKET")
    operation = partial(_run, _get_eml, bucket=bucket, key=key)
    return await asyncio.to_thread(operation)


async def delete_object(key: str) -> None:
    bucket = _setting("S3_BUCKET")
    operation = partial(_run, _client().delete_object, Bucket=bucket, Key=key)
    await asyncio.to_thread(operation)
