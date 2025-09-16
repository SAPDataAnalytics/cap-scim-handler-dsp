// scim_dsp.js
const axios = require("axios");
const qs = require("qs");
const { getSCIMConfig } = require("./secrets");

async function getAccessToken() {
  const { authTokenUrl, clientId, clientSecret } = await getSCIMConfig();
  console.log("➡️ Getting access token...");

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const response = await axios.post(
      authTokenUrl,
      qs.stringify({ grant_type: "client_credentials" }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${authHeader}`
        }
      }
    );

    const token = response.data.access_token;
    console.log("✅ Access token retrieved");
    return token;
  } catch (err) {
    console.error("❌ Failed to get access token:", err.response?.data || err.message);
    throw err;
  }
}

async function getCSRFToken(bearerToken) {
  const { apiBaseUrl } = await getSCIMConfig();
  const csrfUrl = `${apiBaseUrl}/api/v1/csrf`;
  console.log("➡️ Fetching CSRF token from:", csrfUrl);

  try {
    const response = await axios.get(csrfUrl, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "x-sap-sac-custom-auth": "true",
        "x-csrf-token": "fetch"
      }
    });

    const csrfToken = response.headers["x-csrf-token"];
    const setCookie = response.headers["set-cookie"];

    console.log("✅ CSRF token:", csrfToken);
    console.log("✅ Cookies:", setCookie);

    return { csrfToken, cookies: setCookie };
  } catch (err) {
    console.error("❌ Failed to get CSRF token:", err.response?.data || err.message);
    throw err;
  }
}

async function fetchUsers() {
  const { apiBaseUrl } = await getSCIMConfig();

  try {
    const token = await getAccessToken();
    const { csrfToken, cookies } = await getCSRFToken(token);

    const cookieHeader = cookies?.join("; ");
    console.log("➡️ Fetching users with CSRF + Cookie");

    const response = await axios.get(`${apiBaseUrl}/api/v1/scim2/Users/`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-sap-sac-custom-auth": "true",
        "x-csrf-token": csrfToken,
        Cookie: cookieHeader
      }
    });

    console.log("✅ Users fetched successfully");
    const resources = response.data?.Resources || [];
    return resources.map(user => {
      const givenName = user.name?.givenName || "";
      const familyName = user.name?.familyName || "";
      const displayName = user.displayName;
      const email =
        user.emails?.find(e => e.type === "work" && e.primary)?.value ||
        user.emails?.[0]?.value ||
        "";
      const id = user.id;
      const userName = user.userName;
      return { firstName: givenName, lastName: familyName, email, displayName, id, userName };
    });
  } catch (err) {
    console.error("❌ Failed to fetch users:", err.response?.data || err.message);
    throw err;
  }
}

async function fetchUsersRaw() {
  const { apiBaseUrl } = await getSCIMConfig();

  try {
    const token = await getAccessToken();
    const { csrfToken, cookies } = await getCSRFToken(token);

    const cookieHeader = cookies?.join("; ");

    const response = await axios.get(`${apiBaseUrl}/api/v1/scim2/Users/`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-sap-sac-custom-auth": "true",
        "x-csrf-token": csrfToken,
        Cookie: cookieHeader
      }
    });

    // Return the SCIM "Resources" array unchanged
    return response.data?.Resources || [];
  } catch (err) {
    console.error("❌ Failed to fetch raw users:", err.response?.data || err.message);
    throw err;
  }
}

module.exports = { getAccessToken, getCSRFToken, fetchUsers, fetchUsersRaw };
