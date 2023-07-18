import { Router } from 'itty-router';
import { router as authRouter } from './auth';

// now let's create a router (note the lack of "new")
const router = Router({ base: '/api'});

router.all('/auth/*', authRouter.handle);

// 404 for everything else
router.all('*', () => new Response('Not Found.', { status: 404 }));

export default router;
