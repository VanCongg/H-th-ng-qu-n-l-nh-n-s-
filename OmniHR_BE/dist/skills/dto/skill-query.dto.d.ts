import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
export declare class SkillQueryDto extends PaginationQueryDto {
    category?: string;
    isActive?: boolean;
}
