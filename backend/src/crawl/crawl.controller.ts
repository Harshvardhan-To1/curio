import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { CrawlService } from './crawl.service';
import { CreateCrawlDto } from './dto/create-crawl.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { IsString, IsUrl } from 'class-validator';

class AddPageDto {
  @IsString()
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  url!: string;
}

@Controller('api/crawl')
export class CrawlController {
  constructor(private readonly crawl: CrawlService) {}

  @Post()
  create(@Body() dto: CreateCrawlDto) {
    return this.crawl.create(dto);
  }

  @Get(':jobId/status')
  status(@Param('jobId', new ParseUUIDPipe()) jobId: string) {
    return this.crawl.getStatus(jobId);
  }

  @Sse(':jobId/stream')
  stream(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
  ): Observable<MessageEvent> {
    return this.crawl
      .stream(jobId)
      .pipe(
        map((event) => ({ data: event, type: event.type }) as MessageEvent),
      );
  }

  @Get(':jobId/corpus')
  corpus(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
    @Query() page: PaginationDto,
  ) {
    return this.crawl.getCorpus(jobId, page.offset, page.limit);
  }

  @Post(':jobId/page')
  addPage(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
    @Body() dto: AddPageDto,
  ) {
    return this.crawl.addPage(jobId, dto.url);
  }
}
