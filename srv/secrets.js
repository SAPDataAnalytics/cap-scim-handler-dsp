// secrets.js
const path = require("path");
const { readCredential } = require("./credstore");

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

const binding = (() => {
  try {
    return JSON.parse(process.env.VCAP_SERVICES).credstore[0].credentials;
  } catch {
    throw new Error("VCAP_SERVICES.credstore[0].credentials not found");
  }
})();

const NAMESPACE = "dsp-scim";
const cache = new Map();

/**
 * Reads a password-type credential value (returns the string value)
 */
async function getPassword(name) {
  if (cache.has(name)) return cache.get(name);
  const res = await readCredential(binding, NAMESPACE, "password", name);
  // res typically looks like: { name, value, username?, metadata?, ... }
  if (!res || typeof res.value !== "string") {
    throw new Error(`Credential "${name}" is missing or has no 'value'`);
  }
  cache.set(name, res.value);
  return res.value;
}

/**
 * Returns a normalized SCIM config object from the Credential Store
 * Items expected (as shown in your screenshot):
 *  - dsp-scim-token-url
 *  - dsp-scim-base-url
 *  - dsp-scim-client-id
 *  - dsp-scim-client-secret
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
