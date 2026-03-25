import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { buildTypeOrmOptions } from './typeorm-options';
config();

const dataSource = new DataSource(buildTypeOrmOptions({
  entities: [__dirname + '/../**/*.entity.{ts,js}'],
  migrations: [__dirname + '/../migrations/*.{ts,js}'],
}));

export default dataSource;
