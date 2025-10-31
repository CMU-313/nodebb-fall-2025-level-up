import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const pageLoadTime = new Trend('page_load_time');
const apiCallTime = new Trend('api_call_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

export const options = {
	scenarios: {
		// Scenario 1: Warm-up - Light load to establish baseline
		warmup: {
			executor: 'constant-vus',
			vus: 5,
			duration: '30s',
		},
		
		// Scenario 2: Normal load - Simulate typical usage
		normal_load: {
			executor: 'constant-vus',
			vus: 20,
			duration: '2m',
			startTime: '30s',
		},
		
		// Scenario 3: Spike test - Sudden traffic surge
		spike: {
			executor: 'ramping-vus',
			startVUs: 0,
			stages: [
				{ duration: '10s', target: 100 }, // Rapid ramp-up
				{ duration: '30s', target: 100 }, // Hold spike
				{ duration: '10s', target: 20 },  // Back to normal
			],
			startTime: '2m30s',
		},
		
		// Scenario 4: Stress test - Push limits
		stress: {
			executor: 'ramping-vus',
			startVUs: 0,
			stages: [
				{ duration: '2m', target: 50 },  // Ramp up to moderate load
				{ duration: '3m', target: 100 }, // Increase to heavy load
				{ duration: '2m', target: 150 }, // Push to stress level
				{ duration: '2m', target: 150 }, // Maintain stress
				{ duration: '2m', target: 0 },   // Ramp down
			],
			startTime: '3m20s',
		},
		
		// Scenario 5: Soak test - Sustained load over time
		soak: {
			executor: 'constant-vus',
			vus: 30,
			duration: '5m',
			startTime: '14m20s',
		},
	},
	
	thresholds: {
		'http_req_duration': ['p(95)<1000', 'p(99)<2000'], // 95% under 1s, 99% under 2s
		'http_req_failed': ['rate<0.05'],                   // Less than 5% errors
		'errors': ['rate<0.1'],                             // Less than 10% custom errors
		'page_load_time': ['p(95)<1500'],                   // Page loads under 1.5s
		'api_call_time': ['p(95)<500'],                     // API calls under 500ms
		'http_reqs': ['rate>10'],                           // At least 10 req/s
	},
	
	// Save detailed results
	summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)', 'p(99.9)', 'count'],
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4567';

// Weighted random selection for realistic user behavior
function randomUserJourney() {
	const rand = Math.random();
	if (rand < 0.4) return 'casual_browser';
	if (rand < 0.7) return 'topic_reader';
	if (rand < 0.9) return 'active_user';
	return 'api_consumer';
}

export default function () {
	const journey = randomUserJourney();
	
	switch (journey) {
		case 'casual_browser':
			casualBrowser();
			break;
		case 'topic_reader':
			topicReader();
			break;
		case 'active_user':
			activeUser();
			break;
		case 'api_consumer':
			apiConsumer();
			break;
	}
}

// Journey 1: Casual Browser (40% of users)
function casualBrowser() {
	group('Casual Browser Journey', function () {
		// Visit home page
		let res = http.get(`${BASE_URL}/`);
		const success = check(res, {
			'home page loaded': (r) => r.status === 200,
			'home page has content': (r) => r.body.includes('NodeBB'),
		});
		errorRate.add(!success);
		pageLoadTime.add(res.timings.duration);
		success ? successfulRequests.add(1) : failedRequests.add(1);
		sleep(1 + Math.random() * 2);

		// Quick look at categories
		res = http.get(`${BASE_URL}/categories`);
		check(res, { 'categories loaded': (r) => r.status === 200 });
		pageLoadTime.add(res.timings.duration);
		sleep(1 + Math.random() * 3);

		// Leave (short session)
	});
}

// Journey 2: Topic Reader (30% of users)
function topicReader() {
	group('Topic Reader Journey', function () {
		// Start at recent topics
		let res = http.get(`${BASE_URL}/recent`);
		check(res, { 'recent page loaded': (r) => r.status === 200 });
		pageLoadTime.add(res.timings.duration);
		sleep(1 + Math.random() * 2);

		// Browse a few topics
		for (let i = 1; i <= 3; i++) {
			res = http.get(`${BASE_URL}/topic/${i}`);
			const success = check(res, {
				[`topic ${i} loaded`]: (r) => r.status === 200 || r.status === 404,
			});
			errorRate.add(!success && res.status !== 404);
			pageLoadTime.add(res.timings.duration);
			sleep(3 + Math.random() * 5); // Read time
		}

		// Check categories before leaving
		res = http.get(`${BASE_URL}/categories`);
		check(res, { 'categories loaded': (r) => r.status === 200 });
		pageLoadTime.add(res.timings.duration);
		sleep(1);
	});
}

// Journey 3: Active User (20% of users)
function activeUser() {
	group('Active User Journey', function () {
		// Visit home
		let res = http.get(`${BASE_URL}/`);
		check(res, { 'home loaded': (r) => r.status === 200 });
		pageLoadTime.add(res.timings.duration);
		sleep(1);

		// Check recent posts
		res = http.get(`${BASE_URL}/recent`);
		check(res, { 'recent loaded': (r) => r.status === 200 });
		pageLoadTime.add(res.timings.duration);
		sleep(2);

		// Browse categories
		res = http.get(`${BASE_URL}/categories`);
		check(res, { 'categories loaded': (r) => r.status === 200 });
		pageLoadTime.add(res.timings.duration);
		sleep(2);

		// Read multiple topics
		for (let i = 1; i <= 5; i++) {
			res = http.get(`${BASE_URL}/topic/${i}`);
			check(res, {
				[`topic ${i} accessible`]: (r) => r.status === 200 || r.status === 404,
			});
			pageLoadTime.add(res.timings.duration);
			sleep(2 + Math.random() * 4);
		}

		// Check popular posts
		res = http.get(`${BASE_URL}/popular`);
		check(res, { 'popular loaded': (r) => r.status === 200 });
		pageLoadTime.add(res.timings.duration);
		sleep(2);

		// Back to home
		res = http.get(`${BASE_URL}/`);
		check(res, { 'home revisited': (r) => r.status === 200 });
		pageLoadTime.add(res.timings.duration);
		sleep(1);
	});
}

// Journey 4: API Consumer (10% of users)
function apiConsumer() {
	group('API Consumer Journey', function () {
		// Fetch config
		let res = http.get(`${BASE_URL}/api/config`);
		const configSuccess = check(res, {
			'config API works': (r) => r.status === 200,
			'config is JSON': (r) => r.headers['Content-Type']?.includes('application/json'),
		});
		errorRate.add(!configSuccess);
		apiCallTime.add(res.timings.duration);
		configSuccess ? successfulRequests.add(1) : failedRequests.add(1);
		sleep(0.5);

		// Fetch categories via API
		res = http.get(`${BASE_URL}/api/categories`);
		const catSuccess = check(res, {
			'categories API works': (r) => r.status === 200,
			'categories is JSON': (r) => r.headers['Content-Type']?.includes('application/json'),
		});
		errorRate.add(!catSuccess);
		apiCallTime.add(res.timings.duration);
		catSuccess ? successfulRequests.add(1) : failedRequests.add(1);
		sleep(0.5);

		// Fetch recent topics via API
		res = http.get(`${BASE_URL}/api/recent`);
		const recentSuccess = check(res, {
			'recent API works': (r) => r.status === 200,
			'recent is JSON': (r) => r.headers['Content-Type']?.includes('application/json'),
		});
		errorRate.add(!recentSuccess);
		apiCallTime.add(res.timings.duration);
		recentSuccess ? successfulRequests.add(1) : failedRequests.add(1);
		sleep(0.5);

		// Fetch popular topics via API
		res = http.get(`${BASE_URL}/api/popular`);
		check(res, { 'popular API works': (r) => r.status === 200 });
		apiCallTime.add(res.timings.duration);
		sleep(0.5);
	});
}

// Summary handler to display custom metrics
export function handleSummary(data) {
	console.log('\n=== Custom Metrics Summary ===');
	console.log(`Total Successful Requests: ${data.metrics.successful_requests.values.count}`);
	console.log(`Total Failed Requests: ${data.metrics.failed_requests.values.count}`);
	console.log(`Error Rate: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%`);
	console.log(`Avg Page Load Time: ${data.metrics.page_load_time.values.avg.toFixed(2)}ms`);
	console.log(`Avg API Call Time: ${data.metrics.api_call_time.values.avg.toFixed(2)}ms`);
	
	return {
		'stdout': textSummary(data, { indent: ' ', enableColors: true }),
	};
}

function textSummary(data, options) {
	// This is a simplified version - k6 has a built-in textSummary
	// but this ensures it works even if not imported
	return `
Test Duration: ${data.state.testRunDurationMs}ms
VUs: ${data.metrics.vus.values.value}
Requests: ${data.metrics.http_reqs.values.count}
Failed Requests: ${data.metrics.http_req_failed.values.rate * 100}%
Request Duration (avg): ${data.metrics.http_req_duration.values.avg}ms
`;
}
