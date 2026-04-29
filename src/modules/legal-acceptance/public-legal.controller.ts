import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PublicLegalService } from './public-legal.service';

@ApiTags('legal')
@Controller('v1/legal/public')
export class PublicLegalController {
  constructor(private readonly publicLegalService: PublicLegalService) {}

  @Get(':documentId')
  @Header('Content-Type', 'text/html; charset=utf-8')
  renderDocument(
    @Param('documentId') documentId: string,
    @Query('locale') locale?: string,
  ) {
    return this.publicLegalService.renderPublicDocument(documentId, locale?.trim() || 'en-GB');
  }
}
