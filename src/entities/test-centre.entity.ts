import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Route } from './route.entity';

@Entity({ name: 'test_centres' })
export class TestCentre {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  slug: string | null;

  @Column()
  address: string;

  @Column()
  postcode: string;

  @Column()
  city: string;

  @Column()
  country: string;

  @Column('float')
  lat: number;

  @Column('float')
  lng: number;

  @Column({
    type: process.env.NODE_ENV === 'test' ? 'simple-json' : 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  } as any)
  @Index({ spatial: true })
  geo: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Route, (r) => r.centre)
  routes: Route[];
}
