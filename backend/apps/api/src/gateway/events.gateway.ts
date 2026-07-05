import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Job } from '@forgeline/database';

/**
 * Socket.io Gateway for real-time dashboard updates.
 *
 * Events emitted:
 * - job:status_changed — When any job transitions state
 * - queue:stats_updated — When queue stats change
 * - worker:heartbeat — Worker health updates
 * - worker:status_changed — Worker online/offline/draining
 *
 * Clients can join rooms to scope their updates:
 * - project:{projectId} — Updates for all queues in a project
 * - queue:{queueId} — Updates for a specific queue
 */
@WebSocketGateway({
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3001', 'http://localhost:8080'],
    credentials: true,
  },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:project')
  handleJoinProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() projectId: string,
  ) {
    client.join(`project:${projectId}`);
    this.logger.debug(`Client ${client.id} joined project:${projectId}`);
    return { joined: `project:${projectId}` };
  }

  @SubscribeMessage('join:queue')
  handleJoinQueue(
    @ConnectedSocket() client: Socket,
    @MessageBody() queueId: string,
  ) {
    client.join(`queue:${queueId}`);
    this.logger.debug(`Client ${client.id} joined queue:${queueId}`);
    return { joined: `queue:${queueId}` };
  }

  @SubscribeMessage('leave:project')
  handleLeaveProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() projectId: string,
  ) {
    client.leave(`project:${projectId}`);
    return { left: `project:${projectId}` };
  }

  @SubscribeMessage('leave:queue')
  handleLeaveQueue(
    @ConnectedSocket() client: Socket,
    @MessageBody() queueId: string,
  ) {
    client.leave(`queue:${queueId}`);
    return { left: `queue:${queueId}` };
  }

  // ─── Emit Methods (called by services) ────────────

  emitJobUpdate(job: Job) {
    const event = {
      jobId: job.id,
      queueId: job.queueId,
      status: job.status,
      type: job.type,
      priority: job.priority,
      attempt: job.attempt,
      claimedBy: job.claimedBy,
      updatedAt: new Date().toISOString(),
    };

    // Emit to the specific queue room
    this.server?.to(`queue:${job.queueId}`).emit('job:status_changed', event);

    // Also emit globally for the pipeline visualization
    this.server?.emit('job:status_changed', event);
  }

  emitQueueUpdate(queueId: string, data: any) {
    this.server?.to(`queue:${queueId}`).emit('queue:stats_updated', {
      queueId,
      ...data,
      updatedAt: new Date().toISOString(),
    });
    this.server?.emit('queue:stats_updated', { queueId, ...data });
  }

  emitWorkerUpdate(workerId: string, data: any) {
    this.server?.emit('worker:heartbeat', {
      workerId,
      ...data,
      updatedAt: new Date().toISOString(),
    });
  }

  emitWorkerStatusChange(workerId: string, status: string) {
    this.server?.emit('worker:status_changed', {
      workerId,
      status,
      updatedAt: new Date().toISOString(),
    });
  }
}
