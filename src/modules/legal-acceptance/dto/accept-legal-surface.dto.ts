import { IsIn, IsObject, IsOptional } from 'class-validator';
import {
  MARKETPLACE_LEGAL_SURFACES,
  MarketplaceLegalSurface,
} from '../legal-acceptance.constants';

export class AcceptLegalSurfaceDto {
  @IsIn([...MARKETPLACE_LEGAL_SURFACES])
  surface: MarketplaceLegalSurface;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
