export type ApiErrorCode =
  | "INVALID_CREDENTIALS"
  | "CAPTCHA_NOT_SUPPORTED"
  | "JW_UNAVAILABLE"
  | "UNAUTHORIZED"
  | "BAD_REQUEST";

export interface ApiError {
  ok: false;
  code: ApiErrorCode;
  message: string;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
