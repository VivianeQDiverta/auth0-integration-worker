import { Router } from 'itty-router';
export const router = Router({ base: '/api/v1/front' });

router.get('/verify-access', async (req) => {
	const path = (req.query.path as string).replace(/\//g, ':').replace(/\d+/g, 'id');
	const permissions = req.headers.get('Permissions').replace(/"/g, '').split(',');
	const hasAccess = permissions.includes(`front${path}`);

	if (hasAccess) {
		return new Response(
			JSON.stringify({
				message: 'Access granted',
			}),
			{
				headers: {
					'Content-Type': 'application/json',
				},
			}
		);
	} else {
		return new Response(
			JSON.stringify({
				message: 'Not found',
			}),
			{
				headers: {
					'Content-Type': 'application/json',
				},
				status: 404,
			}
		);
	}
});
