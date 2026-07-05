import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Worker, WorkerHeartbeat } from '@forgeline/database';

@Injectable()
export class WorkersService {
  constructor(
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
    @InjectRepository(WorkerHeartbeat)
    private readonly heartbeatRepo: Repository<WorkerHeartbeat>,
  ) {}

  async findAll() {
    return this.workerRepo.find({
      order: { registeredAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    return this.workerRepo.findOneOrFail({ where: { id } });
  }

  async getHeartbeats(workerId: string, limit: number = 50) {
    return this.heartbeatRepo.find({
      where: { workerId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getHealthSummary() {
    const workers = await this.workerRepo.find();
    const online = workers.filter((w) => w.status === 'online').length;
    const draining = workers.filter((w) => w.status === 'draining').length;
    const offline = workers.filter((w) => w.status === 'offline').length;
    const totalLoad = workers.reduce((sum, w) => sum + w.currentLoad, 0);
    const totalCapacity = workers
      .filter((w) => w.status === 'online')
      .reduce((sum, w) => sum + w.maxConcurrency, 0);

    return {
      total: workers.length,
      online,
      draining,
      offline,
      totalLoad,
      totalCapacity,
      utilization: totalCapacity > 0 ? Math.round((totalLoad / totalCapacity) * 100) : 0,
      workers,
    };
  }
}
