import http from 'k6/http';
import { check, group, sleep } from 'k6';

export const options = {
	vus: 5, // 5 virtual users
	duration: '30s',
	thresholds: {
		http_req_duration: ['p(95)<1000'],
		http_req_failed: ['rate<0.05'],
	},
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4567';
const API_URL = `${BASE_URL}/api`;

export default function () {
	group('API - Public Endpoints', function () {
		// Test public API endpoints
		const configResponse = http.get(`${API_URL}/config`);
		check(configResponse, {
			'config endpoint returns 200': (r) => r.status === 200,
			'config has valid JSON': (r) => {
				try {
					JSON.parse(r.body);
					return true;
				} catch (e) {
					return false;
				}
			},
		});

		sleep(1);

		// Test categories API
		const categoriesResponse = http.get(`${API_URL}/categories`);
		check(categoriesResponse, {
			'categories API returns 200': (r) => r.status === 200,
		});

		sleep(1);

		// Test recent topics API
		const recentResponse = http.get(`${API_URL}/recent`);
		check(recentResponse, {
			'recent API returns 200': (r) => r.status === 200,
		});
	});

	sleep(2);
}
