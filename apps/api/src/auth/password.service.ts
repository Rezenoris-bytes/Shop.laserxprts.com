import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing and token generation.
 *
 * Argon2id with parameters at the OWASP-recommended floor. These are tuned for
 * a small VPS that also runs MySQL and Next.js: memory cost dominates, and
 * 19 MiB per hash keeps a burst of login attempts from starving the database.
 */
@Injectable()
export class PasswordService {
  private readonly options: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MiB
    timeCost: 2,
    parallelism: 1,
  };

  /**
   * A pre-computed hash used to keep failed logins the same cost as successful
   * ones. Without it, "unknown email" returns measurably faster than "wrong
   * password", which turns the login form into an account-enumeration oracle.
   */
  private dummyHash: string | null = null;

  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      // A malformed hash in the database must read as "wrong password",
      // never as a 500 that reveals the account exists.
      return false;
    }
  }

  /** Burns equivalent CPU when the email does not exist. */
  async verifyDummy(plain: string): Promise<void> {
    this.dummyHash ??= await this.hash('lei-timing-equaliser-not-a-real-password');
    await this.verify(this.dummyHash, plain);
  }

  /** URL-safe opaque token for password resets and refresh tokens. */
  generateToken(bytes = 48): string {
    return randomBytes(bytes).toString('base64url');
  }

  /**
   * Tokens are stored hashed. A leaked database must not yield usable reset
   * links or refresh tokens.
   */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Constant-time comparison for token hashes. */
  tokensMatch(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  /**
   * Public reference for enquiries and service requests.
   *
   * Deliberately random rather than sequential: a sequential public reference
   * lets anyone enumerate other customers' enquiries by incrementing it.
   * Excludes I, O, 0, 1 so a reference read over the phone is unambiguous.
   */
  generatePublicRef(length = 12): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i += 1) {
      out += alphabet[bytes[i]! % alphabet.length];
    }
    return out;
  }
}
