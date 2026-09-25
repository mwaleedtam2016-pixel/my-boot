import { Guild, Client } from "discord.js";

// Pre-generated sleek round badge PNG icons (Green Up Arrow, Red Down Arrow, Neutral Double Arrow pointing RIGHT ▶️)
export const EMOJI_DATA_URIS = {
  upward: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAhElEQVR4nO3TQQqAMAwAwb7Iv/lP/6Qnb1LYZINRGvDanaY4xho427Gfs++1cBmEhlVINp5CWPEQwo4jBDnwHhVB4xSh317dQjSubCEbTyOMOEF8D0CnZAPWX7AAPQEUkQE8xlsACCIKmMZbAOhTaKuvRqC4jQjFLUQqnoFoYQopC/92LvlcWZt8Z7tJAAAAAElFTkSuQmCC",
  downward: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAhElEQVR4nO3SwQ2AIBBEUQqzBPtvwTL0bsjK7PwNxDCJV/9DbG1P3HUed/RMC5dB1DAKceMWgoqnEHRcQlTFhxGjL3oPASgnyQJCxFSAepcOoIvYgA1Qg18r+QJUfE0AhUjHlR/RiYcAB4HElwBkEGhcRZTEaUQqTiGsuAPBwiqkLPzbPce1YdvoJ8WSAAAAAElFTkSuQmCC",
  neutral: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAoklEQVR4nO2TQQrAIBADfVQ/0U/0/79o6cGLqJt1E7ZIA95CZkAt5Y8zx3nds5MGlol4wVSRKDwkwYIvSbDhLgkVHJZIFWjLb6xBpANL9MZrZgJWBxKwxkcApANJIOM9ANKhCrQQpCMRqACks6dA2hWkPkLpN+xJIMM0+EjAGvOATYHRVTDPFP4JAaUEBFdJuOBsiSU4SyIEj4jQwF4RGXjbPMRxY7zUbkBNAAAAAElFTkSuQmCC",
};

/**
 * Ensures that a guild has the 3 price trend emojis (upward, downward, neutral).
 * Auto-creates missing emojis and re-fetches cache so IDs are always 100% valid.
 */
export async function ensureGuildEmojis(guild: Guild): Promise<void> {
  try {
    const me = await guild.members.fetchMe().catch(() => null);
    if (me && !me.permissions.has("ManageGuildExpressions") && !me.permissions.has("ManageEmojisAndStickers")) {
      console.log(`ℹ️ [EMOJIS] Skipping emoji creation in "${guild.name}" (Missing Manage Emojis permission)`);
      return;
    }
    const emojis = await guild.emojis.fetch();

    const requiredEmojis = [
      { name: "upward", alt: ["upward"], attachment: EMOJI_DATA_URIS.upward },
      { name: "downward", alt: ["downward"], attachment: EMOJI_DATA_URIS.downward },
      { name: "neutral~1", alt: ["neutral", "neutral~1"], attachment: EMOJI_DATA_URIS.neutral },
    ];

    for (const req of requiredEmojis) {
      const existing = emojis.find((e) => e.name === req.name || req.alt.includes(e.name));
      if (!existing) {
        try {
          const created = await guild.emojis.create({
            attachment: req.attachment,
            name: req.name,
            reason: "Auto-created Fire Bank price trend emoji",
          });
          console.log(`✅ Created emoji :${created.name}: (${created.id}) in guild "${guild.name}"`);
        } catch (err) {
          console.error(`⚠️ Could not create emoji :${req.name}: in guild "${guild.name}"`);
        }
      }
    }
    // Re-fetch to guarantee cache is completely up to date with valid emoji objects
    await guild.emojis.fetch();
  } catch (err) {
    console.error(`Error ensuring emojis for guild ${guild.name}:`, err);
  }
}

/**
 * Syncs emojis across all guilds the client is currently connected to.
 */
export async function syncAllGuildEmojis(client: Client): Promise<void> {
  console.log("🔄 Synchronizing custom trend emojis across all guilds...");
  for (const [, guild] of client.guilds.cache) {
    await ensureGuildEmojis(guild);
  }
}
