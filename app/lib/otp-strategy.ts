import type { SessionStorage } from '@remix-run/node'
import type { AuthenticateOptions } from 'remix-auth'
import { Strategy } from 'remix-auth'
import type { User } from '@prisma/client'

export type FarcasterUser = {
  fid: string
  username?: string
  pfpUrl?: string
}

export class OtpStrategy extends Strategy<User, { code: string }> {
  name = 'otp'

  async authenticate(
    request: Request,
    sessionStorage: SessionStorage,
    options: AuthenticateOptions,
  ): Promise<User> {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')

    if (!code) {
      return await this.failure('Missing code', request, sessionStorage, options)
    }

    const user = await this.verify({ code })

    return this.success(user, request, sessionStorage, options)
  }
}
