export declare class UpdatePolicyDto {
    name?: string;
    description?: string;
    resource?: string;
    action?: string;
    effect?: string;
    condition?: Record<string, unknown>;
    isActive?: boolean;
}
