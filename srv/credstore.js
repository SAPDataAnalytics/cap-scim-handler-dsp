// credstore.js
const jose = require("node-jose");
const { fetch, Headers } = require("undici");

function checkStatus(response) {
  if (!response.ok) throw Error("Unexpected status code: " + response.status);
  return response;
}

async function decryptPayload(privateKey, payload) {
  const key = await jose.JWK.asKey(
    `-----BEGIN PRIVATE KEY-----${privateKey}-----END PRIVATE KEY-----`,
    "pem",
    { alg: "RSA-OAEP-256", enc: "A256GCM" }
  );
  const decrypt = await jose.JWE.createDecrypt(key).decrypt(payload);
  return decrypt.plaintext.toString();
}

async function encryptPayload(publicKey, payload) {
  const key = await jose.JWK.asKey(
    `-----BEGIN PUBLIC KEY-----${publicKey}-----END PUBLIC KEY-----`,
    "pem",
    { alg: "RSA-OAEP-256" }
  );
  const options = {
    contentAlg: "A256GCM",
    compact: true,
    fields: { iat: Math.round(new Date().getTime() / 1000) }
  };
  return jose.JWE.createEncrypt(options, key)
    .update(Buffer.from(payload, "utf8"))
    .final();
}

function buildHeaders(binding, namespace, init) {
  const headers = new Headers(init);
  headers.set(
    "Authorization",
    `Basic ${Buffer.from(
      `${binding.username}:${binding.password}`
    ).toString("base64")}`
  );
  headers.set("sapcp-credstore-namespace", namespace);
  return headers;
}

async function fetchAndDecrypt(privateKey, url, method, headers, body) {
  return fetch(url, { method, headers, body })
    .then(checkStatus)
    .then(response => response.text())
    .then(payload => decryptPayload(privateKey, payload))
    .then(JSON.parse);
}

// Public API
async function readCredential(binding, namespace, type, name) {
  return fetchAndDecrypt(
    binding.encryption.client_private_key,
    `${binding.url}/${type}?name=${encodeURIComponent(name)}`,
    "get",
    buildHeaders(binding, namespace)
  );
}

async function writeCredential(binding, namespace, type, credential) {
  return fetchAndDecrypt(
    binding.encryption.client_private_key,
    `${binding.url}/${type}`,
    "post",
    buildHeaders(binding, namespace, { "Content-Type": "application/jose" }),
    await encryptPayload(
      binding.encryption.server_public_key,
      JSON.stringify(credential)
    )
  );
}

async function deleteCredential(binding, namespace, type, name) {
  return fetch(`${binding.url}/${type}?name=${encodeURIComponent(name)}`, {
    method: "delete",
    headers: buildHeaders(binding, namespace)
  }).then(checkStatus);
}

module.exports = {
  readCredential,
  writeCredential,
  deleteCredential
};
