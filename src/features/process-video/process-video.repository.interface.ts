import { Video, CreateVideoDTO, UpdateVideoDTO } from '../../@types/process-video.types';

export interface IProcessVideoRepository {
  findById(id: string): Promise<Video | null>;
  findAll(): Promise<Video[]>;
  create(data: CreateVideoDTO): Promise<Video>;
  update(id: string, data: UpdateVideoDTO): Promise<Video>;
  delete(id: string): Promise<void>;
}
