# K6 Load Testing for NodeBB

This directory contains k6 load tests for the NodeBB forum application.

## Prerequisites

**K6 must be installed on your system.** It is NOT an npm package.

### Installation

**Debian/Ubuntu:**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**macOS:**
```bash
brew install k6
```

**Windows:**
```bash
choco install k6
```

**Docker:**
```bash
docker pull grafana/k6
```

## Running Tests

```bash
# Run individual tests
npm run k6:basic      # Basic load test (2 minutes)
npm run k6:api        # API endpoint test (1 minute)
npm run k6:stress     # Comprehensive stress test (~19 minutes)

# Run all tests sequentially
npm run k6:all
```

## Available Tests

### 1. Basic Load Test (`basic-load-test.js`)

Tests basic page loads with gradual load increase.

**What it tests:**
- Home page load
- Categories page
- Recent topics page
- Response times under load
- Error rates

**Load profile:**
- Ramp up to 10 users over 30s
- Maintain 10 users for 1 minute
- Ramp down to 0 over 30s

**Duration:** ~2 minutes

### 2. API Test (`api-test.js`)

Tests public API endpoints.

**What it tests:**
- `/api/config` endpoint
- `/api/categories` endpoint
- `/api/recent` endpoint
- JSON response validity
- API performance

**Load profile:**
- 5 virtual users
- 1 minute duration

### 3. Stress Test (`stress-test.js`)

Comprehensive stress test with realistic user behavior.

**What it tests:**
- **4 User Journey Types** (weighted random selection):
  - Casual Browser (40%): Quick visits to home and categories
  - Topic Reader (30%): Browses multiple topics in detail
  - Active User (20%): Extended session with deep exploration
  - API Consumer (10%): Heavy API usage
  
- **5 Test Scenarios** (sequential):
  1. **Warm-up** (30s): 5 users - establish baseline
  2. **Normal Load** (2m): 20 users - typical usage
  3. **Spike Test** (50s): 0→100→20 users - sudden traffic surge
  4. **Stress Test** (11m): 0→50→100→150→0 - push system limits
  5. **Soak Test** (5m): 30 users - sustained load

**Custom Metrics:**
- Error rate tracking
- Page load times
- API call times
- Success/failure counters

**Thresholds:**
- 95% of requests under 1s
- 99% of requests under 2s
- Less than 5% HTTP errors
- At least 10 requests/second

**Duration:** ~19 minutes

## Configuration

### Environment Variables

All tests support the following environment variable:

- `BASE_URL` - NodeBB base URL (default: `http://localhost:4567`)

**Example:**
```bash
BASE_URL=http://localhost:8080 npm run k6:basic
```

## Understanding Results

K6 outputs detailed metrics after each test run:

- **http_req_duration** - Response time statistics
- **http_req_failed** - Percentage of failed requests
- **http_reqs** - Total number of requests
- **checks** - Number of passed/failed checks
- **iterations** - Number of complete test iterations

### Thresholds

Tests include performance thresholds that must be met:

- ✅ **PASS** - All thresholds met, performance is acceptable
- ❌ **FAIL** - One or more thresholds failed, investigate performance issues

## Troubleshooting

### "k6: command not found"

K6 is not installed. Follow the installation instructions above for your platform.

### "Cannot connect to localhost:4567"

Make sure NodeBB is running before executing tests:

```bash
# First time setup
./nodebb setup

# Start NodeBB
./nodebb start

# Verify it's running
./nodebb status
```

### High failure rates

If tests show high failure rates:

1. Check if NodeBB is running properly
2. Verify the BASE_URL is correct
3. Check server logs for errors
4. Consider reducing the load (fewer VUs or shorter duration)

