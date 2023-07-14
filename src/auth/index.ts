import { Router } from 'itty-router';

export const router = Router({ base: '/api/auth' });

router.get('/state', async (req) => {
	const state = 'dummy-state';
	return new Response(state, {
		headers: {
			'content-type': 'text/plain;charset=UTF-8',
		},
	});
});
