import { beforeEach, describe, expect, it, vi } from "vitest";

import { gatewaysStatusApiV1GatewaysStatusGet } from "@/api/generated/gateways/gateways";

import { checkGatewayConnection, validateGatewayUrl } from "./gateway-form";

vi.mock("@/api/generated/gateways/gateways", () => ({
  gatewaysStatusApiV1GatewaysStatusGet: vi.fn(),
}));

const mockedGatewaysStatusApiV1GatewaysStatusGet = vi.mocked(
  gatewaysStatusApiV1GatewaysStatusGet,
);

describe("validateGatewayUrl", () => {
  it("requires ws/wss with an explicit port", () => {
    expect(validateGatewayUrl("https://gateway.example")).toBe(
      "Gateway URL must start with ws:// or wss://.",
    );
    expect(validateGatewayUrl("ws://gateway.example")).toBe(
      "Gateway URL must include an explicit port.",
    );
    expect(validateGatewayUrl("ws://gateway.example:18789")).toBeNull();
  });
});

describe("checkGatewayConnection", () => {
  beforeEach(() => {
    mockedGatewaysStatusApiV1GatewaysStatusGet.mockReset();
  });

  it("passes pairing and TLS toggles to gateway status API", async () => {
    mockedGatewaysStatusApiV1GatewaysStatusGet.mockResolvedValue({
      status: 200,
      data: { connected: true },
    } as never);

    const result = await checkGatewayConnection({
      gatewayUrl: "ws://gateway.example:18789",
      gatewayToken: "secret-token",
      gatewayDisableDevicePairing: true,
      gatewayAllowInsecureTls: true,
    });

    expect(mockedGatewaysStatusApiV1GatewaysStatusGet).toHaveBeenCalledWith({
      gateway_url: "ws://gateway.example:18789",
      gateway_token: "secret-token",
      gateway_disable_device_pairing: true,
      gateway_allow_insecure_tls: true,
    });
    expect(result).toEqual({ ok: true, message: "Gateway reachable." });
  });

  it("returns gateway-provided error message when offline", async () => {
    mockedGatewaysStatusApiV1GatewaysStatusGet.mockResolvedValue({
      status: 200,
      data: {
        connected: false,
        error: "missing required scope",
      },
    } as never);

    const result = await checkGatewayConnection({
      gatewayUrl: "ws://gateway.example:18789",
      gatewayToken: "",
      gatewayDisableDevicePairing: false,
      gatewayAllowInsecureTls: false,
    });

    expect(result).toEqual({ ok: false, message: "missing required scope" });
  });
});
