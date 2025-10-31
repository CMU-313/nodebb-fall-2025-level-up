# K6 Load Testing Setup

This repository includes k6 load tests for performance testing NodeBB.

## ⚠️ Important: K6 Installation Required

**K6 is NOT installed via `npm install`.** It must be installed separately as a system binary.

### Quick Install

**Debian/Ubuntu (including dev containers):**
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

### Verify Installation

```bash
k6 version
```

You should see something like: `k6 v1.3.0`

## Running Tests

Once k6 is installed:

```bash
# Make sure NodeBB is running first
./nodebb start

# In another terminal, run tests
npm run k6:basic    # Quick 2-minute test
npm run k6:api      # API endpoint test
npm run k6:stress   # Full 19-minute stress test
npm run k6:all      # Run all tests
```

## What if npm install fails?

Since k6 has been removed from `package.json` dependencies, `npm install` will work fine without k6 installed. The k6 tests are optional - you only need k6 if you want to run load tests.

## Documentation

See `k6-tests/README.md` for detailed test information.
