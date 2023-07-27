import { Router } from 'itty-router';

export const router = Router({ base: '/api/auth' });

router.get('/generate-state', async () => {
	// generate a random state string
	const randomNumbers = crypto.getRandomValues(new Uint8Array(32));
	const stateKey = randomNumbers.reduce((acc, val) => acc + val.toString(16), '');

	// the state value can be anything you want to describe the app's state, as long as it's JSON serializable
	const stateValue = {
		createdAt: Date.now(),
	};

	return new Response(
		JSON.stringify({
			stateKey,
			stateValue,
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

	// extract auth0 payload
	const splitToken = auth0Token.split('.');
	const auth0Payload = JSON.parse(atob(splitToken[1]));

	// verify claims
	const now = Math.floor(Date.now() / 1000);
	if (
		auth0Payload.exp < now ||
		auth0Payload.aud !== `https://${env.API_DOMAIN}/api/v1` ||
		auth0Payload.iss !== `https://${env.AUTH0_DOMAIN}/`
	) {
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

	// verify auth0Token signature
	const kid = JSON.parse(atob(splitToken[0])).kid;
	const textEncoder = new TextEncoder();
	// TODO: cache this request. If the verification fails, invalidate the cache, retrieve the jwks and try the verification only once again
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
