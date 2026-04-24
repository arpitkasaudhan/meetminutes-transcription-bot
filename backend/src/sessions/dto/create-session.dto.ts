import { IsString, IsUrl, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateSessionDto {
  @IsUrl({}, { message: 'meetUrl must be a valid URL' })
  meetUrl: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  botDisplayName: string;
}
