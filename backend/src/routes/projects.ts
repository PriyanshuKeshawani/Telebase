import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';

const router = Router();

function generateApiKey(): string {
  return `sk_proj_${crypto.randomBytes(16).toString('hex')}`;
}

router.post('/', async (req: Request, res: Response) => {
  const { name, channel_id, storage_type, supabase_url, supabase_key } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const apiKey = generateApiKey();
    const project = await prisma.project.create({
      data: {
        name,
        channel_id: channel_id || null,
        api_key: apiKey,
        storage_type: storage_type || 'TELEGRAM',
        supabase_url: supabase_url || null,
        supabase_key: supabase_key || null,
      }
    });
    return res.json({ project });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:id/add-bot', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { bot_token } = req.body;

  if (!bot_token) {
    return res.status(400).json({ error: 'bot_token is required' });
  }

  try {
    const bot = await prisma.bot.create({
      data: {
        project_id: id,
        token: bot_token
      }
    });
    return res.json({ bot });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:id/remove-bot', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { bot_token } = req.body;

  try {
    // Delete bots with this project id and token
    await prisma.bot.deleteMany({
      where: {
        project_id: id,
        token: bot_token
      }
    });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
