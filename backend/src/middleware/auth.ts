import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
  project?: any;
  userUuid?: string;
}

export async function requireApiKey(req: AuthRequest, res: Response, next: NextFunction) {
  const apiKey = req.headers['authorization'];

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing Authorization header containing Project API Key' });
  }

  const project = await prisma.project.findUnique({
    where: { api_key: apiKey },
    include: { bots: true }
  });

  if (!project) {
    return res.status(403).json({ error: 'Invalid API Key' });
  }

  req.project = project;

  // Simulate extraction of JWT sub to UUID if a JWT is provided in another header
  // Often clients might pass:
  // Authorization: <Project_key>
  // X-User-Token: <JWT>
  // If no user token, we might default to a public namespace or error.
  const userTokenHeader = req.headers['x-user-token'];
  if (userTokenHeader && typeof userTokenHeader === 'string') {
    try {
      // Decode JWT roughly to extract .sub
      // A full verify would require project-specific JWT secrets, which can be added later.
      const payloadBase64 = userTokenHeader.split('.')[1];
      if (payloadBase64) {
        const payloadStr = Buffer.from(payloadBase64, 'base64').toString('utf8');
        const payload = JSON.parse(payloadStr);
        req.userUuid = payload.sub || 'anonymous';
      }
    } catch {
      req.userUuid = 'anonymous';
    }
  } else {
    req.userUuid = 'anonymous'; // default
  }

  next();
}
