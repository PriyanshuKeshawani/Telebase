import { SignJWT, jwtVerify } from 'jose';

const getSecretKey = () => {
  const secret = process.env.TELEBASE_MASTER_SECRET || 'fallback-secret-key-change-in-prod';
  return new TextEncoder().encode(secret);
};

export async function signJwt(payload: any, expiresIn: string | number = '7d') {
  const secretKey = getSecretKey();
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey);
}

export async function verifyJwt(token: string) {
  try {
    const secretKey = getSecretKey();
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch (error) {
    return null; // Invalid token
  }
}
