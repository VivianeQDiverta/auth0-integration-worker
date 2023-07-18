import { Router } from 'itty-router';

export const router = Router({ base: '/api/auth' });

router.get('/state', async (req) => {
	// generate a random state string
	const randomNumbers = crypto.getRandomValues(new Uint8Array(32));
	const state = randomNumbers.reduce((acc, val) => acc + val.toString(16), '');
	return new Response(
		JSON.stringify({
			state,
		}),
		{
			headers: {
				'content-type': 'application/json',
			},
		}
	);
});
