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
  // fetchUsersRaw already handles pagination; map the fields on top of it
  try {
    const resources = await fetchUsersRaw();
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
  const PAGE_SIZE = 100;

  try {
    const token = await getAccessToken();
    const { csrfToken, cookies } = await getCSRFToken(token);

    const cookieHeader = cookies?.join("; ");
    const headers = {
      Authorization: `Bearer ${token}`,
      "x-sap-sac-custom-auth": "true",
      "x-csrf-token": csrfToken,
      Cookie: cookieHeader
    };

    // First page — also tells us totalResults
    const firstResponse = await axios.get(`${apiBaseUrl}/api/v1/scim2/Users/`, {
      headers,
      params: { startIndex: 1, count: PAGE_SIZE }
    });

    const totalResults = firstResponse.data?.totalResults ?? 0;
    let allResources = firstResponse.data?.Resources || [];
    console.log(`\n📥 fetchUsersRaw: page 1 — ${allResources.length}/${totalResults} users`);

    // Fetch remaining pages if needed
    let startIndex = 1 + PAGE_SIZE;
    while (startIndex <= totalResults) {
      const pageResponse = await axios.get(`${apiBaseUrl}/api/v1/scim2/Users/`, {
        headers,
        params: { startIndex, count: PAGE_SIZE }
      });
      const pageResources = pageResponse.data?.Resources || [];
      allResources = allResources.concat(pageResources);
      console.log(`📥 fetchUsersRaw: page ${Math.ceil(startIndex / PAGE_SIZE) + 1} — ${allResources.length}/${totalResults} users`);
      startIndex += PAGE_SIZE;
    }

    console.log(`✅ fetchUsersRaw: Retrieved ${allResources.length} users total (totalResults: ${totalResults})`);
    console.log(`🔍 User details: ${allResources.map(u => `${u.userName || u.id} (${u.roles?.length || 0} roles)`).join(', ')}`);
    return allResources;
  } catch (err) {
    console.error("❌ Failed to fetch raw users:", err.response?.data || err.message);
    throw err;
  }
}

module.exports = { getAccessToken, getCSRFToken, fetchUsers, fetchUsersRaw };
