// secrets.js
const path = require("path");

// Load .env file for local development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
}

// Load VCAP locally if needed (for local dev)
if (!process.env.VCAP_SERVICES) {
  try {
    const local = require(path.resolve(__dirname, "default-env.json"));
    if (local && local.VCAP_SERVICES) {
      process.env.VCAP_SERVICES = JSON.stringify(local.VCAP_SERVICES);
    } else {
      throw new Error("default-env.json missing VCAP_SERVICES");
    }
  } catch (e) {
    // Not fatal if you prefer to keep envs; throw if you want hard failure
    console.warn("⚠️ Could not auto-load default-env.json:", e.message);
  }
}

const cache = new Map();

/**
 * Reads a password-type credential value from environment variables (returns the string value)
 */
async function getPassword(name) {
  if (cache.has(name)) return cache.get(name);
  const envName = name.toUpperCase().replace(/-/g, '_');
  const value = process.env[envName];
  if (!value) {
    throw new Error(`Environment variable "${envName}" not found`);
  }
  cache.set(name, value);
  return value;
}

/**
 * Returns a normalized SCIM config object from environment variables
 * Items expected:
 *  - DSP_SCIM_TOKEN_URL
 *  - DSP_SCIM_BASE_URL
 *  - DSP_SCIM_CLIENT_ID
 *  - DSP_SCIM_CLIENT_SECRET
 */
async function getSCIMConfig() {
  const [tokenUrl, baseUrl, clientId, clientSecret] = await Promise.all([
    getPassword("dsp-scim-token-url"),
    getPassword("dsp-scim-base-url"),
    getPassword("dsp-scim-client-id"),
    getPassword("dsp-scim-client-secret")
  ]);

  const apiBaseUrl = baseUrl.replace(/\/+$/, ""); // trim trailing slash
  return {
    authTokenUrl: tokenUrl,
    apiBaseUrl,
    clientId,
    clientSecret
  };
}

module.exports = {
  getPassword,
  getSCIMConfig
};
