import { CallHandler, ExecutionContext } from "@nestjs/common";
import { lastValueFrom, of } from "rxjs";
import { ResponseInterceptor } from "./response.interceptor";

describe("ResponseInterceptor", () => {
  const context = {} as ExecutionContext;

  it("wraps raw controller payloads in the API envelope", async () => {
    const interceptor = new ResponseInterceptor();
    const next = {
      handle: () => of({ id: 1 })
    } as CallHandler;

    await expect(lastValueFrom(interceptor.intercept(context, next))).resolves.toEqual({
      success: true,
      message: "Success",
      data: { id: 1 }
    });
  });

  it("does not double-wrap existing API envelopes", async () => {
    const payload = {
      success: true,
      message: "Logged out",
      data: null
    };
    const interceptor = new ResponseInterceptor();
    const next = {
      handle: () => of(payload)
    } as CallHandler;

    await expect(lastValueFrom(interceptor.intercept(context, next))).resolves.toBe(
      payload
    );
  });
});
