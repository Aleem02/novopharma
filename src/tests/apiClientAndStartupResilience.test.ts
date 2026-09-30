import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiClient } from "../main/services/apiClient";
import { FirebaseAuthService } from "../main/services/firebaseAuth";
import { ActivationService } from "../main/services/activationService";
import { InstallationIdentityService } from "../main/security/installationIdentity";
import { ApiError } from "../shared/types";

vi.mock("../main/services/firebaseAuth", () => ({
  FirebaseAuthService: {
    isAuthenticated: vi.fn(),
    getIdToken: vi.fn(),
  },
}));

vi.mock("../main/security/installationIdentity", () => ({
  InstallationIdentityService: {
    initializeIdentity: vi.fn(),
    isActivated: vi.fn(),
    setActivationStatus: vi.fn(),
    markAsActivated: vi.fn(),
  },
}));

vi.mock("../main/infrastructure/logger", () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ApiClient Timeout & Startup Resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_BACKEND_URL", "https://novopharma-admin.vercel.app");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("ApiClient.request", () => {
    it("1. Successful request resolves data and clears timeout", async () => {
      vi.mocked(FirebaseAuthService.getIdToken).mockResolvedValue("mock-token");

      const mockResponse = { success: true, data: "test" };
      const globalFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      vi.stubGlobal("fetch", globalFetch);

      const result = await ApiClient.request("https://novopharma-admin.vercel.app/test", {}, 5000);

      expect(result).toEqual(mockResponse);
      expect(globalFetch).toHaveBeenCalledWith(
        "https://novopharma-admin.vercel.app/test",
        expect.objectContaining({
          headers: expect.any(Headers),
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it("2. HTTP error status (401/403/500) throws mapped exception", async () => {
      vi.mocked(FirebaseAuthService.getIdToken).mockResolvedValue("mock-token");

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }));

      await expect(ApiClient.request("https://novopharma-admin.vercel.app/test")).rejects.toThrow("UNAUTHENTICATED");

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      }));

      await expect(ApiClient.request("https://novopharma-admin.vercel.app/test")).rejects.toThrow("NOT_ACTIVATED");

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }));

      await expect(ApiClient.request("https://novopharma-admin.vercel.app/test")).rejects.toThrow(ApiError);
    });

    it("3. Network failure throws NETWORK_UNAVAILABLE", async () => {
      vi.mocked(FirebaseAuthService.getIdToken).mockResolvedValue("mock-token");

      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

      await expect(ApiClient.request("https://novopharma-admin.vercel.app/test")).rejects.toThrow("NETWORK_UNAVAILABLE");
    });

    it("4. Timeout aborts request and throws NETWORK_UNAVAILABLE cleanly", async () => {
      vi.mocked(FirebaseAuthService.getIdToken).mockResolvedValue("mock-token");

      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";

      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation((_url, options) => {
          return new Promise((_resolve, reject) => {
            if (options.signal) {
              options.signal.addEventListener("abort", () => {
                reject(abortError);
              });
            }
          });
        }),
      );

      // Fast timeout test (50ms)
      await expect(
        ApiClient.request("https://novopharma-admin.vercel.app/test", {}, 50),
      ).rejects.toThrow("NETWORK_UNAVAILABLE");
    });
  });

  describe("Activation Status Sync & Local Activation Resilience", () => {
    it("5. Backend responds normally: syncs status successfully", async () => {
      vi.mocked(FirebaseAuthService.isAuthenticated).mockResolvedValue(true);
      vi.mocked(InstallationIdentityService.initializeIdentity).mockReturnValue({
        version: 1,
        installationId: "inst-123",
        algorithm: "Ed25519",
        publicKey: "pk",
        createdAt: Date.now(),
        isActivated: false,
      });
      vi.mocked(InstallationIdentityService.isActivated).mockReturnValue(false);

      const spyRequest = vi.spyOn(ApiClient, "request").mockResolvedValue({ activated: true });

      await ActivationService.syncStatusWithBackend();

      expect(spyRequest).toHaveBeenCalledWith(
        "https://novopharma-admin.vercel.app/api/desktop/activation/status",
        expect.objectContaining({ method: "POST" }),
      );
      expect(InstallationIdentityService.setActivationStatus).toHaveBeenCalledWith(true);
    });

    it("6. Backend responds with 403/404 (Revocation): De-activates locally", async () => {
      vi.mocked(FirebaseAuthService.isAuthenticated).mockResolvedValue(true);
      vi.mocked(InstallationIdentityService.initializeIdentity).mockReturnValue({
        version: 1,
        installationId: "inst-123",
        algorithm: "Ed25519",
        publicKey: "pk",
        createdAt: Date.now(),
        isActivated: true,
      });

      vi.spyOn(ApiClient, "request").mockRejectedValue(new ApiError(403, "Forbidden"));

      await ActivationService.syncStatusWithBackend();

      expect(InstallationIdentityService.setActivationStatus).toHaveBeenCalledWith(false);
    });

    it("7. Backend unreachable or times out: Preserves local activation flag and resolves cleanly", async () => {
      vi.mocked(FirebaseAuthService.isAuthenticated).mockResolvedValue(true);
      vi.mocked(InstallationIdentityService.initializeIdentity).mockReturnValue({
        version: 1,
        installationId: "inst-123",
        algorithm: "Ed25519",
        publicKey: "pk",
        createdAt: Date.now(),
        isActivated: true,
      });

      vi.spyOn(ApiClient, "request").mockRejectedValue(new Error("NETWORK_UNAVAILABLE"));

      // Must resolve cleanly without throwing exception so caller in AuthScreen continues
      await expect(ActivationService.syncStatusWithBackend()).resolves.toBeUndefined();

      // Does NOT de-activate locally on network timeout
      expect(InstallationIdentityService.setActivationStatus).not.toHaveBeenCalled();
    });
  });
});
