import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ContentPacksService } from './content-packs.service';
import { UpsertContentPackDto } from './dto/upsert-content-pack.dto';

@Controller('v1/admin/content-packs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminContentPacksController {
  constructor(private readonly contentPacksService: ContentPacksService) {}

  @Post('upsert')
  async upsert(@Body() dto: UpsertContentPackDto) {
    return this.contentPacksService.upsert(dto);
  }
}
