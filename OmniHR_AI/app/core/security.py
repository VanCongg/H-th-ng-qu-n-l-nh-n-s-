# Xác thực request nội bộ từ NestJS bằng header X-Internal-Service-Token.

from typing import Annotated
import hmac

from fastapi import Header, HTTPException, status

from app.core.config import settings


# Thiếu token hoặc sai token thì trả 401. So sánh bằng hmac.compare_digest (thời gian không đổi)
# để không lộ thông tin qua thời gian phản hồi.
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
