import http from 'k6/http';
import { check, sleep } from 'k6';

// Test configuration
export const options = {
	stages: [
		{ duration: '30s', target: 10 }, // Ramp up to 10 users over 30s
		{ duration: '1m', target: 10 },  // Stay at 10 users for 1m
		{ duration: '30s', target: 0 },  // Ramp down to 0 users
	],
	thresholds: {
		http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
		http_req_failed: ['rate<0.01'],   // Error rate must be less than 1%
	},
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4567';

export default function () {
	// Test 1: Home page load
	const homeResponse = http.get(`${BASE_URL}/`);
	check(homeResponse, {
		'home page status is 200': (r) => r.status === 200,
		'home page loads in <500ms': (r) => r.timings.duration < 500,
	});

	sleep(1);

	// Test 2: Categories page
	const categoriesResponse = http.get(`${BASE_URL}/categories`);
	check(categoriesResponse, {
		'categories status is 200': (r) => r.status === 200,
	});

	sleep(1);

	// Test 3: Recent topics
	const recentResponse = http.get(`${BASE_URL}/recent`);
	check(recentResponse, {
		'recent page status is 200': (r) => r.status === 200,
	});

	sleep(2);
}
