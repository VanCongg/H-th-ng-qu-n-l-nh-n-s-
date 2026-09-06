from typing import Annotated
import hmac

from fastapi import Header, HTTPException, status

from app.core.config import settings


def verify_internal_token(
    x_internal_service_token: Annotated[
        str | None, Header(alias="X-Internal-Service-Token")
    ] = None,
) -> None:
    if (
        not settings.internal_token
        or not x_internal_service_token
        or not hmac.compare_digest(x_internal_service_token, settings.internal_token)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )
