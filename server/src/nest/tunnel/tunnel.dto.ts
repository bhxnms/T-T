import { cloudflareTunnelConfigPutSchema, cloudflareTunnelTestRequestSchema } from '@trek/shared';

import { createZodDto } from 'nestjs-zod';

/**
 * createZodDto wrappers over the @trek/shared tunnel contracts — the global
 * ZodValidationPipe (APP_PIPE) validates @Body() params typed with these, and
 * validate-body-contracts.ts refuses boot for any unwrapped mutation body.
 */
export class CloudflareTunnelConfigDto extends createZodDto(cloudflareTunnelConfigPutSchema) {}
export class CloudflareTunnelTestRequestDto extends createZodDto(cloudflareTunnelTestRequestSchema) {}
