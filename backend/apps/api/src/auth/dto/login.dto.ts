import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'demo@forgeline.dev' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'forgeline123' })
  @IsString()
  password: string;
}
