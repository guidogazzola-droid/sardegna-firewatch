import {
  Environment,
  SignedDataVerifier,
} from "@apple/app-store-server-library";

const BUNDLE_ID = "com.guidogazzola.sardiniafirewatch";
const APP_APPLE_ID = 6793580504;

// Public Apple Root CA - G3 certificate (DER, base64). Apple distributes the
// same certificate from https://www.apple.com/certificateauthority/.
const APPLE_ROOT_CA_G3 =
  "MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==";

const roots = [Buffer.from(APPLE_ROOT_CA_G3, "base64")];
const productionVerifier = new SignedDataVerifier(
  roots,
  false,
  Environment.PRODUCTION,
  BUNDLE_ID,
  APP_APPLE_ID,
);
const sandboxVerifier = new SignedDataVerifier(
  roots,
  false,
  Environment.SANDBOX,
  BUNDLE_ID,
);

export async function verifyTerritoryEntitlement({
  territory,
  purchaseToken,
}) {
  if (territory?.free) {
    return { valid: true, environment: "BuiltIn", transactionId: null };
  }
  const token = String(purchaseToken || "").trim();
  if (!territory?.productId || token.split(".").length !== 3) {
    return { valid: false, reason: "missing-token" };
  }

  let transaction = null;
  let lastError = null;
  for (const verifier of [productionVerifier, sandboxVerifier]) {
    try {
      transaction = await verifier.verifyAndDecodeTransaction(token);
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!transaction) {
    return {
      valid: false,
      reason: "verification-failed",
      error: process.env.NODE_ENV === "development" ? lastError?.message : undefined,
    };
  }

  const valid =
    transaction.bundleId === BUNDLE_ID &&
    transaction.productId === territory.productId &&
    !transaction.revocationDate;
  return {
    valid,
    reason: valid ? null : "transaction-mismatch",
    environment: transaction.environment ?? null,
    transactionId: transaction.transactionId ?? null,
    originalTransactionId: transaction.originalTransactionId ?? null,
    productId: transaction.productId ?? null,
  };
}
