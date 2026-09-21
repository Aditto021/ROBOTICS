// Mock-first service layer for future ESP32 integration.
// No physical rover is connected — every call here is simulated until
// VITE_ROBOT_API_BASE_URL is set AND live mode is explicitly enabled,
// and even then the live path is a stub that must be implemented and
// tested before use. Never assume a live connection is real.

export type RobotCommand =
  | "FORWARD"
  | "BACKWARD"
  | "LEFT"
  | "RIGHT"
  | "STOP"
  | "PICKUP"
  | "LAUNCH"
  | "EMERGENCY_STOP";

export type RobotMode = "mock" | "live";

export interface RobotStatus {
  connected: boolean;
  mode: RobotMode;
  battery: number | null;
  timestamp: number;
}

export interface CommandResult {
  ok: boolean;
  command: RobotCommand;
  message: string;
  timestamp: number;
}

const MOCK_MODE = (import.meta.env.VITE_ROBOT_MOCK_MODE ?? "true") !== "false";
const API_BASE = (import.meta.env.VITE_ROBOT_API_BASE_URL ?? "").trim();
const COMMAND_TIMEOUT_MS = 4000;

const LIVE_MODE_UNAVAILABLE =
  "Live ESP32 connection is not implemented in this build. ResQBot's control console currently runs in simulated mode only.";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Robot command timed out.")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export function isMockMode(): boolean {
  return MOCK_MODE || API_BASE.length === 0;
}

let mockConnected = false;
let mockBattery = 100;

export async function connectToRobot(): Promise<RobotStatus> {
  if (isMockMode()) {
    await delay(500);
    mockConnected = true;
    return { connected: true, mode: "mock", battery: mockBattery, timestamp: Date.now() };
  }
  throw new Error(LIVE_MODE_UNAVAILABLE);
}

export async function getRobotStatus(): Promise<RobotStatus> {
  if (isMockMode()) {
    await delay(150);
    return {
      connected: mockConnected,
      mode: "mock",
      battery: mockConnected ? mockBattery : null,
      timestamp: Date.now(),
    };
  }
  throw new Error(LIVE_MODE_UNAVAILABLE);
}

export async function sendRobotCommand(command: RobotCommand): Promise<CommandResult> {
  if (!isMockMode()) {
    throw new Error(LIVE_MODE_UNAVAILABLE);
  }

  if (!mockConnected) {
    return {
      ok: false,
      command,
      message: "Not connected. Connect to the rover before sending commands.",
      timestamp: Date.now(),
    };
  }

  try {
    await withTimeout(delay(350 + Math.random() * 300), COMMAND_TIMEOUT_MS);
  } catch (error) {
    return {
      ok: false,
      command,
      message: error instanceof Error ? error.message : "Command failed.",
      timestamp: Date.now(),
    };
  }

  mockBattery = Math.max(0, mockBattery - (command === "EMERGENCY_STOP" ? 0 : 1));

  return {
    ok: true,
    command,
    message: `${command.replace("_", " ")} acknowledged (simulated).`,
    timestamp: Date.now(),
  };
}

export async function stopRobot(): Promise<CommandResult> {
  return sendRobotCommand("EMERGENCY_STOP");
}
