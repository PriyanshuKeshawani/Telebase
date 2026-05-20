import app from './app';
import { BackupSyncManager } from './utils/backupSync';

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  console.log('🤖 Bootstrapping Telebase API state sync...');
  try {
    // Rebuild SQLite/PostgreSQL from Telegram index channel before starting Express
    await BackupSyncManager.restoreFromTelegram();
  } catch (error: any) {
    console.error('Failed to sync state from Telegram index channel:', error.message);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Telebase API is running on http://localhost:${PORT}`);
  });
}

bootstrap();
