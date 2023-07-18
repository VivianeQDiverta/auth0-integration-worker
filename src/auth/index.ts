import { Router } from 'itty-router';

export const router = Router({ base: '/api/auth' });

router.get('/generate-state', async (req, env) => {
	// generate a random state string
	const randomNumbers = crypto.getRandomValues(new Uint8Array(32));
	const state = randomNumbers.reduce((acc, val) => acc + val.toString(16), '');

	// store the state in the KV store with a 60 second TTL
	// with values describing the app's state that can be added here
	const value = JSON.stringify({
		createdAt: Date.now(),
	});
	await env.STATE.put(state, value, { expirationTtl: 60 });
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

router.get('/verify-state', async (req, env) => {
	const receivedState = req.query.state;
	if (!receivedState) {
		return new Response(
			JSON.stringify({
				error: 'missing state',
			}),
			{
				headers: {
					'content-type': 'application/json',
				},
			}
		);
	}

	// check if the state exists in the KV store
	const state = await env.STATE.get(receivedState, 'json');
	if (!state) {
		return new Response(
			JSON.stringify({
				error: 'invalid state',
			}),
			{
				headers: {
					'content-type': 'application/json',
				},
				status: 400,
			}
		);
	}

	// delete the state from the KV store
	await env.STATE.delete(receivedState);

	return new Response(
		JSON.stringify({
			state: JSON.stringify(state), // return as string so that KurocoEdge can read it
		}),
		{
			headers: {
				'content-type': 'application/json',
			},
		}
	);
});
