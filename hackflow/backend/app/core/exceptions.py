from __future__ import annotations

from fastapi import HTTPException, status


class AppError(HTTPException):
    """Base application error with a structured detail."""

    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(status_code=status_code, detail={"code": code, "message": message})


class NotFoundError(AppError):
    def __init__(self, resource: str, identifier: str | None = None) -> None:
        msg = f"{resource} not found" + (f": {identifier}" if identifier else "")
        super().__init__(status.HTTP_404_NOT_FOUND, "NOT_FOUND", msg)


class ConflictError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(status.HTTP_409_CONFLICT, "CONFLICT", message)


class ForbiddenError(AppError):
    def __init__(self, message: str = "Insufficient permissions") -> None:
        super().__init__(status.HTTP_403_FORBIDDEN, "FORBIDDEN", message)


class UnauthorizedError(AppError):
    def __init__(self, message: str = "Authentication required") -> None:
        super().__init__(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", message)


class ValidationError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", message)


class DeadlinePassedError(AppError):
    def __init__(self, message: str = "Deadline has passed") -> None:
        super().__init__(status.HTTP_410_GONE, "DEADLINE_PASSED", message)
