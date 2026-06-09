import { ArgumentMetadata, PipeTransform } from "@nestjs/common";
export declare class SanitizeInputPipe implements PipeTransform {
    transform(value: unknown, _metadata: ArgumentMetadata): unknown;
    private clean;
}
