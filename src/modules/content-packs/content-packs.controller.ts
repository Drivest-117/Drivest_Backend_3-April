import { Controller, Get, Query } from '@nestjs/common';
import { ContentPacksService } from './content-packs.service';
import { GetContentManifestQueryDto } from './dto/get-content-manifest-query.dto';

@Controller('content-packs')
export class ContentPacksController {
  constructor(private readonly contentPacksService: ContentPacksService) {}

  @Get('manifest')
  async manifest(@Query() query: GetContentManifestQueryDto) {
    return this.contentPacksService.getManifest(query);
  }
}
