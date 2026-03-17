import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentPackManifest } from '../../entities/content-pack-manifest.entity';
import { ContentPacksService } from './content-packs.service';
import { ContentPacksController } from './content-packs.controller';
import { AdminContentPacksController } from './admin-content-packs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ContentPackManifest])],
  controllers: [ContentPacksController, AdminContentPacksController],
  providers: [ContentPacksService],
  exports: [ContentPacksService],
})
export class ContentPacksModule {}
