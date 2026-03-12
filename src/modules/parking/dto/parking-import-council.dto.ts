import { IsIn, IsOptional, IsString } from 'class-validator';

export class ParkingImportCouncilDto {
  @IsString()
  councilId!: string;

  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  sourceFile?: string;

  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv';

  @IsOptional()
  @IsIn(['normalized', 'flat_rows'])
  mode?: 'normalized' | 'flat_rows';
}
