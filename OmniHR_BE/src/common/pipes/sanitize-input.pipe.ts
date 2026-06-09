import { ArgumentMetadata, Injectable, PipeTransform } from "@nestjs/common";

@Injectable()
export class SanitizeInputPipe implements PipeTransform {
  transform(value: unknown, _metadata: ArgumentMetadata) {
    return this.clean(value);
  }

  private clean(value: unknown): unknown {
    if (typeof value === "string") {
      return value
        .trim()
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/javascript:/gi, "");
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.clean(item));
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
          key,
          this.clean(entry)
        ])
      );
    }

    return value;
  }
}
