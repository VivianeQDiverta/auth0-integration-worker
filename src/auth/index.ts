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

router.post('/extract-payload', async (req, env) => {
	const body = await req.json();
	const { auth0Token } = body;
	if (!auth0Token) {
		return new Response(
			JSON.stringify({
				error: 'missing auth0Token',
			}),
			{
				headers: {
					'content-type': 'application/json',
				},
			}
		);
	}

	// verify auth0Token signature
	const splitToken = auth0Token.split('.');
	const kid = JSON.parse(atob(splitToken[0])).kid;
	const textEncoder = new TextEncoder();
	const jwksRes = await fetch(`https://${env.AUTH0_DOMAIN}/.well-known/jwks.json`);
	const jwks = JSON.parse(await jwksRes.text());
	const key = jwks.keys.find((k: any) => k.kid === kid);
	const cryptoKey = await crypto.subtle.importKey(
		'jwk',
		key,
		{
			name: 'RSASSA-PKCS1-v1_5',
			hash: {
				name: 'SHA-256',
			},
		},
		false,
		['verify']
	);
	const base64DecodedSignature = atob(splitToken[2].replace(/_/g, '/').replace(/-/g, '+'));
	const signatureBuffer = Uint8Array.from(base64DecodedSignature.split(''), (c) => c.charCodeAt(0));
	const dataBuffer = textEncoder.encode(splitToken[0] + '.' + splitToken[1]);

	const auth0TokenVerified = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signatureBuffer, dataBuffer);
	if (!auth0TokenVerified) {
		return new Response(
			JSON.stringify({
				error: 'invalid auth0Token',
			}),
			{
				headers: {
					'content-type': 'application/json',
				},
			}
		);
	}

	// extract auth0 payload
	const auth0Payload = JSON.parse(atob(splitToken[1]));

	return new Response(
		JSON.stringify({
			success: true,
			auth0Payload,
		}),
		{
			headers: {
				'content-type': 'application/json',
			},
		}
	);
});
