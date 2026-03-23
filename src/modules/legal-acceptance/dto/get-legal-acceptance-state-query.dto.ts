import { IsIn } from 'class-validator';
import {
  MARKETPLACE_LEGAL_SURFACES,
  MarketplaceLegalSurface,
} from '../legal-acceptance.constants';

export class GetLegalAcceptanceStateQueryDto {
  @IsIn([...MARKETPLACE_LEGAL_SURFACES])
  surface: MarketplaceLegalSurface;
}
