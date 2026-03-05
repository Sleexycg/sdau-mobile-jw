import type { ApiErrorCode } from "@/types/api";

export class JwError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}
