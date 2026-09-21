import { useState } from "react";
import { motion } from "framer-motion";
import {
  connectToRobot,
  isMockMode,
  sendRobotCommand,
  type CommandResult,
  type RobotCommand,
} from "../services/robotService";

interface LogEntry extends CommandResult {
  id: number;
}

const DPAD: { command: RobotCommand; label: string; area: string }[] = [
  { command: "FORWARD", label: "↑", area: "col-start-2 row-start-1" },
  { command: "LEFT", label: "←", area: "col-start-1 row-start-2" },
  { command: "STOP", label: "■", area: "col-start-2 row-start-2" },
  { command: "RIGHT", label: "→", area: "col-start-3 row-start-2" },
  { command: "BACKWARD", label: "↓", area: "col-start-2 row-start-3" },
];

let logId = 0;

export function ControlConsole() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [pending, setPending] = useState<RobotCommand | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const mock = isMockMode();

  const pushLog = (result: CommandResult) => {
    setLog((entries) => [{ ...result, id: logId++ }, ...entries].slice(0, 6));
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const status = await connectToRobot();
      setConnected(status.connected);
    } catch (error) {
      pushLog({
        ok: false,
        command: "STOP",
        message: error instanceof Error ? error.message : "Connection failed.",
        timestamp: Date.now(),
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleCommand = async (command: RobotCommand) => {
    setPending(command);
    try {
      const result = await sendRobotCommand(command);
      pushLog(result);
    } catch (error) {
      pushLog({
        ok: false,
        command,
        message: error instanceof Error ? error.message : "Command failed.",
        timestamp: Date.now(),
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <section id="control" className="relative py-28 lg:py-36">
      <div className="mx-auto max-w-5xl px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.7 }}
          className="mx-auto mb-14 max-w-2xl text-center"
        >
          <p className="mb-4 font-mono text-xs tracking-[0.25em] text-cyan">
            [ 05 — CONTROL CONSOLE ]
          </p>
          <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Try the command interface
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            A demonstration of the same command set the smartphone app sends
            to ResQBot. No physical rover is connected here.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.7 }}
          className="glass-panel mx-auto max-w-3xl border border-white/10 p-6 sm:p-8"
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
            <div className="flex items-center gap-2.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  connected ? "bg-cyan" : "bg-orange"
                } ${connected ? "" : "animate-pulse-slow"}`}
                aria-hidden
              />
              <span className="font-mono text-xs tracking-widest text-muted">
                {connected ? "CONNECTED" : "DISCONNECTED"}
              </span>
            </div>
            <div className="flex items-center gap-2 border border-orange/30 bg-orange/5 px-3 py-1.5">
              <span className="font-mono text-[10px] tracking-widest text-orange">
                {mock ? "DEMONSTRATION — MOCK MODE" : "LIVE MODE"}
              </span>
            </div>
          </div>

          {!connected ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <p className="max-w-sm text-sm leading-relaxed text-muted">
                Connect to the simulated rover to enable the command console
                below. This does not contact any real hardware.
              </p>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="border border-cyan/50 px-6 py-3 font-mono text-xs tracking-widest text-cyan transition-colors hover:bg-cyan/10 disabled:opacity-50"
              >
                {connecting ? "CONNECTING…" : "CONNECT TO ROVER (DEMO)"}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
              <div className="flex flex-col items-center">
                <div className="grid w-40 grid-cols-3 grid-rows-3 gap-2">
                  {DPAD.map((btn) => (
                    <button
                      key={btn.command}
                      onClick={() => handleCommand(btn.command)}
                      disabled={pending !== null}
                      aria-label={btn.command}
                      className={`${btn.area} flex h-11 w-11 items-center justify-center border font-mono text-lg transition-colors disabled:opacity-40 ${
                        pending === btn.command
                          ? "border-cyan bg-cyan/10 text-cyan"
                          : "border-white/15 text-paper hover:border-cyan/50 hover:text-cyan"
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
                <p className="mt-4 font-mono text-[10px] tracking-widest text-muted">
                  DRIVE CONTROL
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleCommand("PICKUP")}
                  disabled={pending !== null}
                  className="border border-white/15 px-4 py-3 text-left font-mono text-xs tracking-widest text-paper transition-colors hover:border-cyan/50 hover:text-cyan disabled:opacity-40"
                >
                  {pending === "PICKUP" ? "COLLECTING…" : "COLLECT PAYLOAD"}
                </button>
                <button
                  onClick={() => handleCommand("LAUNCH")}
                  disabled={pending !== null}
                  className="border border-white/15 px-4 py-3 text-left font-mono text-xs tracking-widest text-paper transition-colors hover:border-cyan/50 hover:text-cyan disabled:opacity-40"
                >
                  {pending === "LAUNCH" ? "LAUNCHING…" : "LAUNCH PAYLOAD"}
                </button>
                <button
                  onClick={() => handleCommand("EMERGENCY_STOP")}
                  disabled={pending !== null}
                  className="border border-orange/60 bg-orange/10 px-4 py-3 text-left font-mono text-xs tracking-widest text-orange transition-colors hover:bg-orange/20 disabled:opacity-40"
                >
                  {pending === "EMERGENCY_STOP" ? "STOPPING…" : "EMERGENCY STOP"}
                </button>
              </div>
            </div>
          )}

          <div className="mt-8 border-t border-white/10 pt-5">
            <p className="mb-3 font-mono text-[10px] tracking-widest text-muted">
              COMMAND LOG
            </p>
            {log.length === 0 ? (
              <p className="font-mono text-xs text-muted/50">No commands sent yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {log.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between font-mono text-[11px] tracking-wide"
                  >
                    <span className={entry.ok ? "text-cyan" : "text-orange"}>
                      {entry.ok ? "OK" : "ERR"} · {entry.command}
                    </span>
                    <span className="text-muted">{entry.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
