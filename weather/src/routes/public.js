import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve the weather page
router.get('/weather.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/weather.html'));
});

export { router as publicRouter };
export default router;

