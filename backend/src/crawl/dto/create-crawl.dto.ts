import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CrawlOptionsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  maxPages?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  maxDepth?: number;

  @IsOptional()
  @IsBoolean()
  sameOriginOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  respectRobots?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  requestsPerSecond?: number;
}

export class CreateCrawlDto {
  // require_tld:false so localhost fixtures pass in tests; SSRF guard still runs.
  @IsString()
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  url!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CrawlOptionsDto)
  options?: CrawlOptionsDto;
}
