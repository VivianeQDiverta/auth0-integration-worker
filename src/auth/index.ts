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

router.post('/update-token', async (req, env) => {
	const body = await req.json();
	const { auth0Token, kurocoEdgePayload } = body;
	if (!auth0Token || !kurocoEdgePayload) {
		return new Response(
			JSON.stringify({
				error: 'missing auth0Token or kurocoEdgePayload',
			}),
			{
				headers: {
					'content-type': 'application/json',
				},
			}
		);
	}

	// extract auth0 payload
	const auth0Payload = auth0Token.split('.')[1];
	const auth0PayloadDecoded = JSON.parse(atob(auth0Payload));

	// generate new kuroco edge token
	const header = btoa(
		JSON.stringify({
			alg: 'RS256',
			typ: 'JWT',
		})
	);
	const payload = btoa(
		JSON.stringify({
			...kurocoEdgePayload,
			auth: auth0PayloadDecoded,
		})
	);
	const privateKey = env.KE_PRIVATE_KEY;
	const encoder = new TextEncoder();
	const dataBuffer = encoder.encode(`${header}.${payload}`);
	const secretBuffer = Uint8Array.from(
		atob(privateKey)
			.split('')
			.map((c) => c.charCodeAt(0))
	);
	const key = await crypto.subtle.importKey(
		'pkcs8',
		secretBuffer,
		{
			name: 'RSASSA-PKCS1-v1_5',
			hash: {
				name: 'SHA-256',
			},
		},
		false,
		['sign']
	);
	const signatureBuffer = await crypto.subtle.sign(
		{
			name: 'RSASSA-PKCS1-v1_5',
		},
		key,
		dataBuffer
	);
	const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
	const kurocoEdgeToken = `${header}.${payload}.${signature}`;

	return new Response(
		JSON.stringify({
			success: true,
			kurocoEdgeToken,
		}),
		{
			headers: {
				'content-type': 'application/json',
				//'set-cookie': 'cookie1=value1; SameSite=None; Secure'
			},
		}
	);
});
