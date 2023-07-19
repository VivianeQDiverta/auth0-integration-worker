import { Router } from 'itty-router';
import { router as frontRouter } from './front';

export const router = Router({ base: '/api/v1' });

router.get('/front/*', frontRouter.handle);

router.all('/*', (req) => {
	const permissions = req.headers.get('Permissions').replace(/"/g, '').split(',');
	return new Response(
		JSON.stringify({
			path: req.url,
			method: req.method,
			permissions,
		}),
		{
			headers: {
				'Content-Type': 'application/json',
			},
		}
	);
});
