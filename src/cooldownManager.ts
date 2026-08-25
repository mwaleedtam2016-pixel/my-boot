import { EmbedBuilder, CommandInteraction, Message } from "discord.js";

// Cooldown durations in milliseconds for each command
export const COMMAND_COOLDOWNS: Record<string, number> = {
  wheel: 4 * 60 * 1000,     // عجلة - 4 دقائق
  invest: 5 * 60 * 1000,    // استثمار - 5 دقائق
  buy: 3 * 60 * 1000,       // شراء - 3 دقائق
  sell: 3 * 60 * 1000,      // بيع - 3 دقائق
  emoji: 6 * 60 * 1000,     // ايموجي - 6 دقائق
  trade: 5 * 60 * 1000,     // تداول - 5 دقائق
  salary: 4 * 60 * 1000,    // الراتب - 4 دقائق
  challenge: 3 * 60 * 1000, // تحدي - 3 دقائق
  math: 5 * 60 * 1000,      // رياضيات - 5 دقائق
  button: 6 * 60 * 1000,    // زر - 6 دقائق
  riddle: 7 * 60 * 1000,    // لغز - 7 دقائق
  game: 5 * 60 * 1000,      // لعبه - 5 دقائق
  robbery: 5 * 60 * 1000,   // نهب - 5 دقائق
  shield: 3 * 60 * 1000,    // حماية - 3 دقائق
  assets: 1 * 60 * 1000,    // ممتلكات - 1 دقيقة
  prices: 1 * 60 * 1000,    // أسعار - 1 دقيقة
};

// Arabic display names for formatting messages
export const COMMAND_ARABIC_NAMES: Record<string, string> = {
  wheel: "عجلة",
  invest: "استثمار",
  buy: "شراء",
  sell: "بيع",
  emoji: "ايموجي",
  trade: "تداول",
  salary: "الراتب",
  challenge: "تحدي",
  math: "رياضيات",
  button: "زر",
  riddle: "لغز",
  game: "لعبه",
  robbery: "نهب",
  shield: "حماية",
  assets: "ممتلكات",
  prices: "أسعار",
};

/**
 * CooldownManager handles per-command, per-user cooldown tracking.
 * Storage structure: commandName -> Map<userId, expireTimestamp>
 */
export class CooldownManager {
  private cooldowns = new Map<string, Map<string, number>>();

  /**
   * Get remaining cooldown time in milliseconds for a specific user and command.
   */
  public getRemaining(commandName: string, userId: string): number {
    const commandMap = this.cooldowns.get(commandName);
    if (!commandMap) return 0;

    const expireTime = commandMap.get(userId);
    if (!expireTime) return 0;

    const remaining = expireTime - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Set a cooldown for a user on a specific command.
   */
  public set(commandName: string, userId: string, customDurationMs?: number): void {
    const duration = customDurationMs ?? COMMAND_COOLDOWNS[commandName] ?? 0;
    if (duration <= 0) return;

    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Map<string, number>());
    }

    const commandMap = this.cooldowns.get(commandName)!;
    commandMap.set(userId, Date.now() + duration);
  }

  /**
   * Formats milliseconds into human-readable Arabic minutes and seconds.
   * Example: "3 دقائق و 12 ثانية" or "45 ثانية"
   */
  public formatTime(remainingMs: number): string {
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0 && seconds > 0) {
      return `${minutes} دقائق و ${seconds} ثانية`;
    } else if (minutes > 0) {
      return `${minutes} ${minutes === 1 ? "دقيقة" : "دقائق"}`;
    } else {
      return `${seconds} ثانية`;
    }
  }

  /**
   * Checks if user is on cooldown. If yes, sends an Embed reply formatted exactly as requested.
   */
  public async checkAndHandle(
    commandName: string,
    userId: string,
    target: CommandInteraction | Message
  ): Promise<boolean> {
    const remainingMs = this.getRemaining(commandName, userId);
    if (remainingMs <= 0) {
      return true; // Not on cooldown
    }

    const timeFormatted = this.formatTime(remainingMs);
    const arabicName = COMMAND_ARABIC_NAMES[commandName] || commandName;

    const userObj = "author" in target ? target.author : target.user;
    const authorName = userObj.username;
    const authorAvatarUrl = userObj.displayAvatarURL();

    const embed = new EmbedBuilder()
      .setColor(2829617)
      .setAuthor({
        name: authorName,
        iconURL: authorAvatarUrl,
      })
      .setDescription(
        [
          `| **${arabicName}**`,
          ``,
          `**بإمكانك إستخدام الامر مرة اخرى بعد :**`,
          `| **${timeFormatted}**`,
        ].join("\n")
      )
      .setTimestamp();

    if ("reply" in target && typeof target.reply === "function") {
      if ("isCommand" in target && typeof target.isCommand === "function") {
        // Slash Command Interaction
        await (target as CommandInteraction).reply({
          embeds: [embed],
          ephemeral: true,
        });
      } else {
        // Text Message
        await (target as Message).reply({ embeds: [embed] });
      }
    }

    return false; // On cooldown
  }
}

export const cooldownManager = new CooldownManager();
