import figlet from "figlet";
import { theme } from "./theme.js";

export async function showBanner(): Promise<void> {
  const text = figlet.textSync("Projeto Zero", { font: "Standard" });
  console.log(theme.brand(text));
  console.log(theme.muted("  Interactive CLI Setup Wizard v0.1.0\n"));
}
