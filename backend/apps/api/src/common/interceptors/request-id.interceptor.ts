import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * Attaches a unique request ID to every incoming request
 * for structured logging and tracing.
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const requestId = request.headers['x-request-id'] || `req_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
    request.requestId = requestId;
    
    const response = context.switchToHttp().getResponse();
    response.setHeader('x-request-id', requestId);

    return next.handle();
  }
}
