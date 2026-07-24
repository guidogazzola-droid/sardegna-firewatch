const PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const RECEIPTS_ENDPOINT = "https://exp.host/--/api/v2/push/getReceipts";

function headers(accessToken) {
  return {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

async function responseJson(response, label) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    throw new Error(`${label}: HTTP ${response.status}`);
  }
  return payload;
}

export async function sendExpoPushNotifications(
  messages,
  { fetchImpl = fetch, accessToken = "", endpoint = PUSH_ENDPOINT } = {},
) {
  if (!messages.length) return [];
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await responseJson(response, "Expo Push");
  const tickets = Array.isArray(payload.data) ? payload.data : [payload.data];
  if (tickets.length !== messages.length) {
    throw new Error("Expo Push: numero di ticket inatteso");
  }
  return tickets;
}

export async function fetchExpoPushReceipts(
  receiptIds,
  { fetchImpl = fetch, accessToken = "", endpoint = RECEIPTS_ENDPOINT } = {},
) {
  if (!receiptIds.length) return {};
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({ ids: receiptIds }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await responseJson(response, "Expo Push receipts");
  return payload.data && typeof payload.data === "object" ? payload.data : {};
}
